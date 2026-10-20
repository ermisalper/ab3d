import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const owner = "operator@example.test", customer = "customer@example.test", other = "other@example.test";
const origin = "https://ab3d.example.test", id = "PRINT-ABCDE00001";
const runtime = { env: {}, actor: owner };
globalThis.__productionOfferOffline = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (["cloudflare:workers", "next/headers", "next/navigation"].includes(specifier))
      return { url: `offer-fixture:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    const source = {
      "offer-fixture:cloudflare:workers": "export const env = globalThis.__productionOfferOffline.env;",
      "offer-fixture:next/headers": "export async function headers(){return new Headers(globalThis.__productionOfferOffline.actor?{'oai-authenticated-user-email':globalThis.__productionOfferOffline.actor}:{});}",
      "offer-fixture:next/navigation": "export function redirect(){throw new Error('Unexpected redirect');}",
    }[url];
    return source ? { format: "module", source, shortCircuit: true } : next(url, context);
  },
});
const { emptyProductionOffer, calculateProductionOffer, parseProductionOffer, parseOfferMoney, formatOfferMoneyInput,
  productionOfferSheet, productionOfferHash } = await import("../app/production-offer.ts");
const { GET, PUT } = await import("../app/api/ab3d/operations/[id]/offer/route.ts");
const { GET: customerOrders } = await import("../app/api/production-orders/route.ts");
const migrationNames = readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort();
const migrations = migrationNames.map(name => ({ name, sql: readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8") }));

class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:"); this.writes = 0; this.queries = []; this.failBatchAt = -1; this.afterBatch = null;
    this.db.exec("PRAGMA foreign_keys=ON");
    for (const migration of migrations) this.db.exec(migration.sql);
  }
  prepare(query) {
    this.queries.push(query);
    const statement = (args = []) => ({
      query, args, bind: (...values) => statement(values),
      first: async () => { const row = this.db.prepare(query).get(...args); return row ? { ...row } : null; },
      all: async () => ({ success: true, results: this.db.prepare(query).all(...args).map(row => ({ ...row })) }),
      run: async () => { this.writes++; return { success: true, meta: { changes: Number(this.db.prepare(query).run(...args).changes) } }; },
    });
    return statement();
  }
  async batch(statements) {
    this.db.exec("BEGIN IMMEDIATE");
    let results;
    try {
      results = statements.map((statement, index) => {
        if (this.failBatchAt === index) { this.failBatchAt = -1; throw new Error("Injected private audit failure: hidden-customer@example.test"); }
        this.writes++;
        return { success: true, meta: { changes: Number(this.db.prepare(statement.query).run(...statement.args).changes) } };
      });
      this.db.exec("COMMIT");
    } catch (failure) { this.db.exec("ROLLBACK"); throw failure; }
    if (this.afterBatch) { const fn = this.afterBatch; this.afterBatch = null; await fn(); }
    return results;
  }
}
const envNames = ["AB3D_OWNER_EMAILS", "AB3D_UNLIMITED_EMAILS", "CAPPATEX_GENERATION_ALLOWED_EMAILS"];
const priorEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]])), priorFetch = globalThis.fetch;
let db, fetches;
function addOrder(database, orderId = id, email = customer, status = "inquiry") {
  const taskId = `offline-model-${orderId}`;
  database.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES (?,?,'convert',0,'SUCCEEDED',0,0,0)").run(taskId, email);
  database.prepare(`INSERT INTO production_orders(id,email,status,source_task_id,source_task_type,template_name,height_mm,material,finish,quantity,estimated_total_cents,currency,created_at,updated_at)
    VALUES (?,?,?,?,'convert','Eigene Idee',200,'PLA','Roh',2,9000,'CHF',100,100)`).run(orderId, email, status, taskId);
}
beforeEach(() => {
  db = new D1(); runtime.env.DB = db; runtime.actor = owner; fetches = 0;
  process.env.AB3D_OWNER_EMAILS = owner; process.env.AB3D_UNLIMITED_EMAILS = ""; process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS = other;
  for (const email of [owner, customer, other]) db.db.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES (?,4,'free','inactive',0,0)").run(email);
  addOrder(db.db);
  runtime.env.BUCKET = new Proxy({}, { get() { throw new Error("Offer drafts must not read artwork storage"); } });
  globalThis.fetch = async () => { fetches++; throw new Error("No external request is permitted by offer draft tests"); };
});
afterEach(() => {
  assert.equal(fetches, 0, "Internal estimates never contact suppliers, customers, payment or AI services");
  db.db.close(); globalThis.fetch = priorFetch;
  for (const [name, value] of Object.entries(priorEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});
after(() => { hooks.deregister(); delete globalThis.__productionOfferOffline; });

const complete = () => {
  const payload = emptyProductionOffer();
  Object.assign(payload, { fulfillment: "external", supplierReference: "Offline-Werkstatt", material: "PLA", color: "Weiss",
    dimensionsMm: { width: "12.34", depth: "40", height: "200" }, quantity: 3, printMinutesPerUnit: 75, plannedSaleTotalCents: 333 });
  for (const cost of Object.values(payload.costs)) Object.assign(cost, { state: "excluded" });
  payload.costs.material = { state: "included", oneOffCents: 101, perUnitCents: 33 };
  return payload;
};
const rows = table => db.db.prepare(`SELECT * FROM ${table}`).all().map(row => ({ ...row }));
const ctx = (orderId = id) => ({ params: Promise.resolve({ id: orderId }) });
const req = (method = "GET", body, headers = {}, orderId = id) => new Request(`${origin}/api/ab3d/operations/${orderId}/offer`, {
  method, headers: { origin, "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const get = (orderId = id) => GET(req("GET", undefined, {}, orderId), ctx(orderId));
const put = (body = { version: 0, payload: complete() }, orderId = id, headers = {}) => PUT(req("PUT", body, headers, orderId), ctx(orderId));
function privateHeaders(response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}

test("offer money and totals use exact integer CHF cents with a labelled revenue margin", () => {
  assert.equal(parseOfferMoney("0.10") + parseOfferMoney("0,20"), 30);
  assert.equal(parseOfferMoney(" 12,3 "), 1230); assert.equal(parseOfferMoney(""), null); assert.equal(parseOfferMoney("0"), 0);
  assert.equal(parseOfferMoney("1000000.00"), 100_000_000); assert.equal(formatOfferMoneyInput(1230), "12.30");
  assert.equal(formatOfferMoneyInput(null), "");
  for (const value of ["1.001", "1e3", "-1", "+1", "NaN", "Infinity", "1 000", "1000000.01"])
    assert.throws(() => parseOfferMoney(value));
  const result = calculateProductionOffer(complete());
  assert.deepEqual(result, { knownOneOffCents: 101, knownPerUnitCents: 33, knownTotalCents: 200, totalCostCents: 200,
    revenueCents: 333, marginCents: 133, marginBasisPoints: 3994, openCostItems: [], costsComplete: true });
  const losing = complete(); losing.plannedSaleTotalCents = 101; losing.costs.material = { state: "included", oneOffCents: 102, perUnitCents: 0 };
  assert.equal(calculateProductionOffer(losing).marginBasisPoints, -99);
  const zero = complete(); zero.plannedSaleTotalCents = 0; zero.costs.material = { state: "included", oneOffCents: 0, perUnitCents: 0 };
  assert.equal(calculateProductionOffer(zero).marginCents, 0); assert.equal(calculateProductionOffer(zero).marginBasisPoints, null);
  const maximum = complete(); maximum.quantity = 1000; maximum.plannedSaleTotalCents = 1;
  for (const cost of Object.values(maximum.costs)) Object.assign(cost, { state: "included", oneOffCents: 100_000_000, perUnitCents: 100_000_000 });
  const bounded = calculateProductionOffer(maximum);
  assert.equal(bounded.totalCostCents, 700_700_000_000); assert.equal(bounded.marginCents, -700_699_999_999);
  assert.equal(bounded.marginBasisPoints, -7_006_999_999_990_000); assert.ok(Number.isSafeInteger(bounded.marginBasisPoints));
});

test("unknown cost amounts, quantity and sale value remain unknown instead of silently becoming zero", () => {
  const empty = calculateProductionOffer(emptyProductionOffer());
  for (const key of ["knownOneOffCents", "knownPerUnitCents", "knownTotalCents", "totalCostCents", "revenueCents", "marginCents", "marginBasisPoints"])
    assert.equal(empty[key], null, key);
  assert.equal(empty.costsComplete, false); assert.equal(empty.openCostItems.length, 8);
  const onlyUnit = emptyProductionOffer(); onlyUnit.quantity = 2;
  onlyUnit.costs.material = { state: "included", oneOffCents: null, perUnitCents: 100 };
  const unitPartial = calculateProductionOffer(onlyUnit);
  assert.equal(unitPartial.knownOneOffCents, null); assert.equal(unitPartial.knownPerUnitCents, 100);
  assert.equal(unitPartial.knownTotalCents, 200); assert.equal(unitPartial.totalCostCents, null);
  const onlyOnce = emptyProductionOffer(); onlyOnce.quantity = 2;
  onlyOnce.costs.material = { state: "included", oneOffCents: 100, perUnitCents: null };
  const oncePartial = calculateProductionOffer(onlyOnce);
  assert.equal(oncePartial.knownOneOffCents, 100); assert.equal(oncePartial.knownPerUnitCents, null);
  assert.equal(oncePartial.knownTotalCents, 100); assert.equal(oncePartial.totalCostCents, null);
  const incomplete = complete(); incomplete.costs.material.oneOffCents = null;
  const result = calculateProductionOffer(incomplete);
  assert.equal(result.knownTotalCents, 99); assert.equal(result.totalCostCents, null); assert.equal(result.marginCents, null); assert.equal(result.costsComplete, false);
  assert.match(result.openCostItems.join(" "), /Materialkosten/);
  incomplete.quantity = null; assert.equal(calculateProductionOffer(incomplete).knownTotalCents, null);
  const noSale = complete(); noSale.plannedSaleTotalCents = null;
  assert.equal(calculateProductionOffer(noSale).totalCostCents, 200); assert.equal(calculateProductionOffer(noSale).marginCents, null);
});

test("strict payload and dimension validation reject forged calculations, production flags, floats and unsafe sizes", () => {
  const valid = complete(); valid.dimensionsMm.width = "00012.340";
  assert.equal(parseProductionOffer(valid).dimensionsMm.width, "12.34");
  for (const mutate of [p => { p.marginCents = 1_000_000; }, p => { p.status = "paid"; }, p => { p.paymentConfirmed = true; },
    p => { p.quantity = 1.1; }, p => { p.quantity = 0; }, p => { p.quantity = 1001; }, p => { p.quantity = "3"; },
    p => { p.plannedSaleTotalCents = 0.1; }, p => { p.costs.material.perUnitCents = Number.MAX_SAFE_INTEGER; },
    p => { p.dimensionsMm.width = "0"; }, p => { p.dimensionsMm.width = "1e3"; }, p => { p.dimensionsMm.width = "10000.001"; },
    p => { p.dimensionsMm.width = "1.0001"; }, p => { p.notes = "hidden\0payload"; }, p => { p.material = "x".repeat(81); },
    p => { p.costs.material.state = "estimated"; }, p => { p.costs.material.currency = "USD"; }, p => { delete p.costs.shipping; }]) {
    const payload = complete(); mutate(payload); assert.throws(() => parseProductionOffer(payload), /invalid_offer/);
  }
  for (const value of [null, [], {}, "offer"]) assert.throws(() => parseProductionOffer(value), /invalid_offer/);
});

test("internal manufacturing sheet describes only the selected draft and never asserts a contract, payment or production", () => {
  const sheet = productionOfferSheet(id, complete());
  assert.equal(sheet.find(row => row.label === "Anfrage").value, id);
  assert.match(sheet.find(row => row.label === "Dokument").value, /Entwurf.*keine Beauftragung/);
  assert.equal(sheet.find(row => row.label === "Fertigungsweg").value, "Externer Fertigungsdienstleister");
  assert.equal(sheet.find(row => row.label === "Interne Lieferantenreferenz").value, "Offline-Werkstatt");
  assert.match(sheet.find(row => row.label === "Zahlung / Produktionsfreigabe").value, /Nicht.*bestätigt/);
  assert.equal(productionOfferSheet(id, emptyProductionOffer()).find(row => row.label === "Menge").value, "Offen");
});

test("offer routes require a configured AB3D owner before database access or reading internal prices", async () => {
  for (const [actor, status] of [[null, 401], [customer, 403], [other, 403], [`${owner}.attacker.test`, 403]]) {
    runtime.actor = actor;
    for (const response of [await get(), await put()]) { assert.equal(response.status, status); privateHeaders(response); }
  }
  runtime.actor = owner; process.env.AB3D_OWNER_EMAILS = "";
  for (const response of [await get(), await put()]) assert.equal(response.status, 403);
  assert.equal(db.queries.length, 0); assert.equal(db.writes, 0);
});

test("GET returns an explicitly empty version-zero draft for an existing inquiry without inventing costs or writing", async () => {
  const before = rows("production_orders"), response = await get(), result = await response.json();
  assert.equal(response.status, 200); privateHeaders(response);
  assert.equal(result.orderId, id); assert.equal(result.version, 0); assert.equal(result.updatedAt, null); assert.equal(result.updatedBy, null);
  assert.deepEqual(result.payload, emptyProductionOffer()); assert.deepEqual(result.events, []);
  assert.equal(result.calculation.totalCostCents, null); assert.equal(result.calculation.marginCents, null);
  assert.equal(db.writes, 0); assert.equal(rows("production_offer_drafts").length, 0); assert.deepEqual(rows("production_orders"), before);
  assert.equal((await get("PRINT-MISSING001")).status, 404); assert.equal((await get("PRINT-invalid")).status, 400);
});

test("saved draft freezes normalized inputs, recomputes money on the server and changes no request, payment, credit or production state", async () => {
  const protectedTables = ["production_orders", "production_reviews", "production_review_events", "accounts", "token_ledger", "shopify_orders", "cappatex_fulfillments"];
  const before = Object.fromEntries(protectedTables.map(table => [table, rows(table)]));
  const payload = complete(); payload.notes = "  Private Kalkulation  "; payload.dimensionsMm.width = "00012.340";
  const response = await put({ version: 0, payload }), result = await response.json();
  assert.equal(response.status, 200); privateHeaders(response);
  assert.equal(result.version, 1); assert.equal(result.updatedBy, owner); assert.ok(Number.isSafeInteger(result.updatedAt));
  assert.equal(result.payload.notes, "Private Kalkulation"); assert.equal(result.payload.dimensionsMm.width, "12.34");
  assert.equal(result.calculation.totalCostCents, 200); assert.equal(result.calculation.marginCents, 133);
  assert.equal(result.events.length, 1); assert.equal(result.events[0].version, 1); assert.equal(result.events[0].actorEmail, owner);
  const stored = rows("production_offer_drafts")[0];
  assert.equal(stored.payload_sha256, await productionOfferHash(stored.payload_json));
  assert.deepEqual(JSON.parse(stored.payload_json), result.payload); assert.ok(!stored.payload_json.includes("marginCents"));
  assert.equal(rows("production_offer_events").length, 1);
  const reload = await (await get()).json(); assert.deepEqual(reload, result);
  for (const table of protectedTables) assert.deepEqual(rows(table), before[table], table);
  assert.ok(db.queries.filter(query => /^\s*(?:INSERT|UPDATE)/i.test(query)).every(query => /production_offer_(?:drafts|events)/.test(query)));
});

test("same-version double clicks and stale saves cannot append audits or overwrite a newer draft", async () => {
  assert.equal((await put()).status, 200);
  for (const version of [0, 2, 999_999]) {
    const payload = complete(); payload.notes = "Stale must not save";
    const response = await put({ version, payload }); assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "offer_conflict"); privateHeaders(response);
  }
  assert.equal(rows("production_offer_events").length, 1); assert.equal(rows("production_offer_drafts")[0].version, 1);
  const payload = complete(); payload.notes = "Confirmed revision 2";
  const response = await put({ version: 1, payload }); assert.equal(response.status, 200);
  assert.equal((await response.json()).version, 2); assert.equal(rows("production_offer_events").length, 2);
});

test("concurrent initial saves have one winner, and responses remain bound to their own committed revision", async () => {
  const first = complete(), second = complete(); first.notes = "First editor"; second.notes = "Other editor";
  const responses = await Promise.all([put({ version: 0, payload: first }), put({ version: 0, payload: second })]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  assert.equal(rows("production_offer_events").length, 1);
  db.afterBatch = async () => {
    const payload = complete(); payload.notes = "Later committed revision";
    assert.equal((await put({ version: 2, payload })).status, 200);
  };
  const ownPayload = complete(); ownPayload.notes = "Own exact revision";
  const response = await put({ version: 1, payload: ownPayload }), own = await response.json();
  assert.equal(response.status, 200); assert.equal(own.version, 2); assert.equal(own.payload.notes, "Own exact revision");
  assert.equal(rows("production_offer_drafts")[0].version, 3);
  assert.equal(JSON.parse(rows("production_offer_drafts")[0].payload_json).notes, "Later committed revision");
  assert.deepEqual(rows("production_offer_events").map(event => event.version).sort(), [1, 2, 3]);
});

test("audit failures atomically roll back both initial and subsequent draft saves, without leaking internal errors", async () => {
  db.failBatchAt = 1;
  let response = await put(); assert.equal(response.status, 503); privateHeaders(response);
  assert.doesNotMatch(JSON.stringify(await response.json()), /hidden-customer|Injected|SQLite|INSERT|nonce/i);
  assert.equal(rows("production_offer_drafts").length, 0); assert.equal(rows("production_offer_events").length, 0);
  assert.equal((await put()).status, 200);
  const beforeDraft = rows("production_offer_drafts"), beforeAudit = rows("production_offer_events"), payload = complete();
  payload.notes = "Must roll back"; db.failBatchAt = 1;
  response = await put({ version: 1, payload }); assert.equal(response.status, 503);
  assert.deepEqual(rows("production_offer_drafts"), beforeDraft); assert.deepEqual(rows("production_offer_events"), beforeAudit);
  assert.equal((await put({ version: 1, payload })).status, 200, "Only an explicit retry may save after rollback");
  assert.equal(rows("production_offer_drafts")[0].version, 2); assert.equal(rows("production_offer_events").length, 2);
});

test("invalid API envelopes, forged totals, payment fields and cross-origin writes fail before persistence", async () => {
  for (const body of [null, [], {}, { version: "0", payload: complete() }, { version: -1, payload: complete() },
    { version: 1_000_000, payload: complete() }, { version: 0.5, payload: complete() }, { version: 0, payload: complete(), status: "paid" },
    { version: 0, payload: complete(), calculation: { totalCostCents: 0 } },
    { version: 0, payload: { ...complete(), marginCents: 1_000_000 } },
    { version: 0, payload: { ...complete(), productionApproved: true } }])
    assert.equal((await put(body)).status, 400);
  for (const badOrigin of ["https://other.example.test", "https://ab3d.example.test.attacker.test", "null"])
    assert.equal((await put(undefined, id, { origin: badOrigin })).status, 403);
  const missingOrigin = new Request(`${origin}/api/ab3d/operations/${id}/offer`, { method: "PUT", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal((await PUT(missingOrigin, ctx())).status, 403);
  assert.equal((await put(undefined, id, { "content-type": "text/plain" })).status, 400);
  assert.equal((await put(undefined, "PRINT-invalid")).status, 400); assert.equal((await put(undefined, "PRINT-MISSING001")).status, 404);
  assert.equal(rows("production_offer_drafts").length, 0); assert.equal(rows("production_offer_events").length, 0); assert.equal(db.writes, 0);
});

test("bounded raw request reading rejects malformed UTF-8, broken JSON and oversized chunked bodies before any write", async () => {
  for (const [body, type] of [["{", "application/json"], [new Uint8Array([123, 0x80, 125]), "application/json"]]) {
    const request = new Request(`${origin}/api/ab3d/operations/${id}/offer`, { method: "PUT", headers: { origin, "content-type": type }, body });
    assert.equal((await PUT(request, ctx())).status, 400);
  }
  for (const declared of ["20001", "not-a-length"]) {
    const request = req("PUT", { version: 0, payload: complete() }, { "content-length": declared });
    assert.equal((await PUT(request, ctx())).status, 413);
  }
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(10_000)); controller.enqueue(new Uint8Array(10_001)); }, cancel() { cancelled = true; } });
  const request = new Request(`${origin}/api/ab3d/operations/${id}/offer`, { method: "PUT", duplex: "half", headers: { origin, "content-type": "application/json" }, body: stream });
  const response = await PUT(request, ctx()); assert.equal(response.status, 413); assert.equal(cancelled, true); privateHeaders(response);
  assert.equal(db.writes, 0); assert.equal(rows("production_offer_drafts").length, 0);
});

test("corrupted saved hashes, invalid JSON and invalid versions return unavailable rather than an empty replacement", async () => {
  await put(); const saved = rows("production_offer_drafts")[0], audit = rows("production_offer_events");
  const payload = complete(); payload.notes = "Private text should not leak";
  for (const change of [
    { json: JSON.stringify(payload), hash: saved.payload_sha256, version: 1 },
    { json: "Invalid private raw JSON hidden@example.test", hash: await productionOfferHash("Invalid private raw JSON hidden@example.test"), version: 1 },
    { json: saved.payload_json, hash: saved.payload_sha256, version: 0 },
  ]) {
    db.db.prepare("UPDATE production_offer_drafts SET payload_json=?,payload_sha256=?,version=? WHERE order_id=?").run(change.json, change.hash, change.version, id);
    for (const response of [await get(), await put({ version: 1, payload: complete() })]) {
      assert.equal(response.status, 503); privateHeaders(response);
      assert.doesNotMatch(JSON.stringify(await response.json()), /Invalid|hidden@example|Private text|integrity|payload_json/i);
    }
    assert.deepEqual(rows("production_offer_events"), audit);
    assert.equal(rows("production_offer_drafts")[0].payload_json, change.json);
  }
});

test("internal costing and supplier references remain absent from every customer's inquiry list", async () => {
  const payload = complete(); payload.notes = "Private offer budget"; payload.supplierReference = "INTERNAL-SUPPLIER-ONLY";
  assert.equal((await put({ version: 0, payload })).status, 200);
  for (const email of [customer, other]) {
    runtime.actor = email;
    const response = await customerOrders(new Request(`${origin}/api/production-orders`)), result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.orders.length, email === customer ? 1 : 0);
    assert.doesNotMatch(JSON.stringify(result), /Private offer budget|INTERNAL-SUPPLIER|plannedSaleTotalCents|marginCents|production_offer|supplierReference/);
  }
});

test("new offer migration preserves legacy inquiries and reviews, accepts new drafts and enforces unique audit versions and request references", async () => {
  const migration = migrations.find(entry => entry.name.startsWith("0014_")); assert.ok(migration);
  const legacy = new DatabaseSync(":memory:");
  try {
    legacy.exec("PRAGMA foreign_keys=ON");
    for (const entry of migrations.filter(entry => entry.name < migration.name)) legacy.exec(entry.sql);
    legacy.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES (?,4,'free','inactive',0,0)").run(customer);
    addOrder(legacy, "PRINT-LEGACY0001", customer, "awaiting_payment");
    legacy.prepare("INSERT INTO production_reviews(order_id,state,notes,version,write_nonce,updated_by,updated_at) VALUES (?,'reviewing','Existing note',1,'old-review',?,100)").run("PRINT-LEGACY0001", owner);
    const beforeOrders = legacy.prepare("SELECT * FROM production_orders").all(), beforeReviews = legacy.prepare("SELECT * FROM production_reviews").all();
    legacy.exec(migration.sql);
    assert.deepEqual(legacy.prepare("SELECT * FROM production_orders").all(), beforeOrders); assert.deepEqual(legacy.prepare("SELECT * FROM production_reviews").all(), beforeReviews);
    assert.equal(legacy.prepare("SELECT COUNT(*) AS n FROM production_offer_drafts").get().n, 0);
    addOrder(legacy, "PRINT-NEW000001", customer);
    const json = JSON.stringify(complete()), hash = await productionOfferHash(json);
    legacy.prepare("INSERT INTO production_offer_drafts(order_id,version,payload_json,payload_sha256,write_nonce,updated_by,updated_at) VALUES (?,1,?,?,?, ?,100)")
      .run("PRINT-NEW000001", json, hash, "new-offer", owner);
    const insertEvent = legacy.prepare("INSERT INTO production_offer_events(id,order_id,version,actor_email,created_at) VALUES (?,?,?,?,100)");
    insertEvent.run("audit-1", "PRINT-NEW000001", 1, owner);
    assert.throws(() => insertEvent.run("audit-2", "PRINT-NEW000001", 1, owner), /UNIQUE/);
    assert.throws(() => insertEvent.run("audit-3", "PRINT-NO-ORDER", 1, owner), /FOREIGN KEY/);
    assert.equal(legacy.prepare("SELECT COUNT(*) AS n FROM production_offer_drafts").get().n, 1);
    assert.equal(legacy.prepare("SELECT COUNT(*) AS n FROM production_orders").get().n, 2);
    assert.equal(legacy.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally { legacy.close(); }
});
