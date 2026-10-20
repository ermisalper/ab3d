import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const user = "creator@example.test", operator = "operator@example.test", other = "other@example.test";
const origin = "https://ab3d.example.test", sourceId = "converted-offline-0001";
const runtime = { env: {}, actor: user, quoteAdjustment: 0 };
globalThis.__productionOrdersOffline = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (["cloudflare:workers", "next/headers", "next/navigation"].includes(specifier)) return { url: `production-fixture:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith("/app/production-quote.ts")) {
      // Retain the real calculation and allow only its resulting estimate to change
      // between retries, as it could after a future pricing revision.
      const source = readFileSync(new URL(url), "utf8").replace("export function productionQuote(", "function baseProductionQuote(")
        + "\nexport function productionQuote(input){ const quote=baseProductionQuote(input); return quote ? {...quote, estimatedTotalCents: quote.estimatedTotalCents + globalThis.__productionOrdersOffline.quoteAdjustment} : null; }";
      return { ...next(url, context), source, shortCircuit: true };
    }
    const source = {
      "production-fixture:cloudflare:workers": "export const env = globalThis.__productionOrdersOffline.env;",
      "production-fixture:next/headers": "export async function headers(){return new Headers(globalThis.__productionOrdersOffline.actor?{'oai-authenticated-user-email':globalThis.__productionOrdersOffline.actor}:{});}",
      "production-fixture:next/navigation": "export function redirect(){throw new Error('Unexpected redirect');}",
    }[url];
    return source ? { format: "module", source, shortCircuit: true } : next(url, context);
  },
});
const { POST, GET, PATCH } = await import("../app/api/production-orders/route.ts");
const { productionQuote } = await import("../app/production-quote.ts");
const { productionInquiryDetails } = await import("../app/production-inquiry-details.ts");

class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.writes = 0; this.inquiryInserts = 0; this.failInquiryBefore = false; this.failInquiryAfter = false;
    this.db.exec("PRAGMA foreign_keys=ON");
    for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()) this.db.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  prepare(query) {
    const db = this.db;
    const statement = (args = []) => ({
      bind: (...values) => statement(values),
      first: async () => { const row = db.prepare(query).get(...args); return row ? { ...row } : null; },
      all: async () => ({ success: true, results: db.prepare(query).all(...args).map(row => ({ ...row })) }),
      run: async () => {
        const inquiry = /INSERT\s+INTO\s+production_orders/i.test(query);
        this.writes++; if (inquiry) this.inquiryInserts++;
        if (inquiry && this.failInquiryBefore) { this.failInquiryBefore = false; throw new Error("Sensitive fixture database failure before insert hidden@example.test"); }
        const changes = Number(db.prepare(query).run(...args).changes);
        if (inquiry && this.failInquiryAfter) { this.failInquiryAfter = false; throw new Error("Sensitive fixture database failure after commit private/model.stl"); }
        return { success: true, meta: { changes } };
      },
    });
    return statement();
  }
}
const priorFetch = globalThis.fetch, priorOwners = process.env.AB3D_OWNER_EMAILS, priorUnlimited = process.env.AB3D_UNLIMITED_EMAILS;
let database;
beforeEach(() => {
  database = new D1(); runtime.env.DB = database; runtime.actor = user; runtime.quoteAdjustment = 0;
  process.env.AB3D_OWNER_EMAILS = operator; process.env.AB3D_UNLIMITED_EMAILS = "";
  globalThis.fetch = async () => { throw new Error("No live network or provider request is allowed in production inquiry tests"); };
  for (const email of [user, operator, other]) database.db.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES (?,20,'free','inactive',0,0)").run(email);
  addTask(sourceId);
});
afterEach(() => {
  database.db.close(); globalThis.fetch = priorFetch;
  for (const [name, value] of [["AB3D_OWNER_EMAILS", priorOwners], ["AB3D_UNLIMITED_EMAILS", priorUnlimited]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
after(() => { hooks.deregister(); delete globalThis.__productionOrdersOffline; });
function addTask(id, email = user, kind = "convert", status = "SUCCEEDED") {
  database.db.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES (?,?,?,0,?,0,0,0)").run(id, email, kind, status);
}
const valid = { sourceTaskId: sourceId, templateId: "free-design", heightCm: 20, material: "PLA", finish: "Roh", quantity: 1 };
const request = (method, body, requestOrigin = origin) => new Request(`${origin}/api/production-orders`, {
  method, headers: { origin: requestOrigin, host: "ab3d.example.test", "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const post = extra => POST(request("POST", { ...valid, ...extra }));
const inquiryRequestId = "11111111-2222-4333-8444-555555555555";
const patch = (id, status) => PATCH(request("PATCH", { id, status }));
const rows = () => database.db.prepare("SELECT * FROM production_orders ORDER BY created_at,id").all().map(row => ({ ...row }));
function legacy(id = "PRINT-LEGACY0001", status = "awaiting_payment", email = user) {
  database.db.prepare("INSERT INTO production_orders(id,email,status,source_task_id,source_task_type,template_name,height_mm,material,finish,quantity,estimated_total_cents,currency,created_at,updated_at) VALUES (?,?,?,?,'convert','Historisches Modell',200,'PLA','Roh',1,12345,'CHF',0,0)").run(id, email, status, sourceId);
  return id;
}

test("server ignores client prices, template names and complexity, storing only a nonbinding inquiry", async () => {
  for (const estimatedTotal of [undefined, 1, -100, 99999, "0.01", null]) {
    const response = await post({ estimatedTotal, templateName: "Injected offer", complexity: .001 });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.order.status, "inquiry"); assert.equal(result.order.estimatedTotalCents, 4500); assert.equal(result.order.currency, "CHF");
    assert.match(result.message, /keine Zahlung und kein Fertigungsauftrag/);
  }
  assert.equal(rows().length, 6);
  for (const row of rows()) {
    assert.equal(row.estimated_total_cents, 4500); assert.equal(row.template_name, "Eigene Idee");
    assert.equal(row.status, "inquiry"); assert.equal(row.height_mm, 200);
  }
  assert.equal(database.db.prepare("SELECT token_balance FROM accounts WHERE email=?").get(user).token_balance, 20);
});

test("the shared estimate keeps existing material, finish, minimum and volume formulas", () => {
  assert.equal(productionQuote(valid).estimatedTotalCents, 4500);
  assert.equal(productionQuote({ ...valid, quantity: 3 }).estimatedTotalCents, 12000);
  assert.equal(productionQuote({ ...valid, quantity: 5 }).estimatedTotalCents, 18500);
  assert.equal(productionQuote({ ...valid, material: "PETG", finish: "Premium", quantity: 3 }).estimatedTotalCents, 23500);
  assert.equal(productionQuote({ ...valid, templateId: "keycap", heightCm: 2 }).estimatedTotalCents, 2500);
  assert.equal(productionQuote({ ...valid, templateId: "chibi", heightCm: 14 }).templateName, "Chibi-Figur");
});

test("optional inquiry context is trimmed, canonical and bound to the authenticated customer", async () => {
  const requestDetails = {
    customerNote: "  Bitte in Salbeigrün.\r\nFrage: Sind zwei Teile möglich?  ",
    city: "  Zürich  ", country: " CH ", postalCode: " 8000 ",
    phone: " +41 78 123 45 67 ", name: "  Léa Müller 🏔️ ",
  };
  const response = await post({ email: other, requestDetails });
  assert.equal(response.status, 200);
  const row = rows()[0];
  assert.equal(row.email, user);
  assert.equal(row.request_details_json, JSON.stringify({
    name: "Léa Müller 🏔️", phone: "+41 78 123 45 67", country: "CH", postalCode: "8000", city: "Zürich",
    customerNote: "Bitte in Salbeigrün.\nFrage: Sind zwei Teile möglich?",
  }));
  assert.equal(row.status, "inquiry");
  assert.equal(database.db.prepare("SELECT token_balance FROM accounts WHERE email=?").get(user).token_balance, 20);
  assert.equal(database.db.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n, 0);
});

test("older clients, blank context and existing orders do not acquire invented contact data", async () => {
  const id = legacy();
  for (const requestDetails of [undefined, {}, { name: "  ", phone: "", country: " ", postalCode: "", city: " ", customerNote: "\r\n " }]) {
    assert.equal((await post({ requestDetails })).status, 200);
  }
  assert.equal(rows().length, 4);
  assert.ok(rows().every(row => row.request_details_json === null));
  assert.equal(rows().find(row => row.id === id).status, "awaiting_payment");
  assert.deepEqual(productionInquiryDetails(undefined), {});
});

test("contact fields reject wrong types, unsupported countries, controls and field overflows", async () => {
  for (const requestDetails of [
    null, [], "contact", 12, { name: 123 }, { phone: false }, { city: null }, { customerNote: {} },
    { country: "DE" }, { country: "ch" }, { email: other }, { street: "Private address" }, { constructor: "unsafe" },
    { name: "Line\nBreak" }, { phone: "\u0000+41" }, { city: "Zürich\t" }, { customerNote: "Note\u007f" }, { customerNote: "Note\r" },
    { name: "a".repeat(121) }, { phone: "1".repeat(41) }, { city: "a".repeat(121), country: "CH" },
    { customerNote: "x".repeat(1001) }, { postalCode: "9".repeat(13), country: "LI" },
    { postalCode: "8000" }, { city: "Vaduz" }, { postalCode: "800", country: "CH" }, { postalCode: "80000", country: "CH" },
  ]) assert.equal((await post({ requestDetails })).status, 400, JSON.stringify(requestDetails));
  assert.equal(rows().length, 0);
});

test("country-only context and valid partial quote locations are accepted without a full delivery address", async () => {
  for (const requestDetails of [{ country: "CH" }, { country: "LI", postalCode: "9490" }, { country: "CH", city: "Genève" },
    { name: "x".repeat(120), phone: "+".repeat(40), country: "LI", postalCode: "9490", city: "x".repeat(120), customerNote: "x".repeat(1000) }]) {
    const response = await post({ requestDetails });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(JSON.parse(rows().find(row => row.id === result.order.id).request_details_json), requestDetails);
  }
});

test("legacy inquiry listings do not expose raw private request details, including an attempted all-scope read", async () => {
  await post({ requestDetails: { name: "Private name", phone: "+41 78 123 45 67", customerNote: "Private note" } });
  for (const actor of [user, other, operator]) {
    runtime.actor = actor;
    const response = await GET(new Request(`${origin}/api/production-orders?scope=production`));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Cache-Control"), /private, no-store/);
    const json = await response.json();
    if (actor === other) assert.deepEqual(json.orders, []);
    assert.doesNotMatch(JSON.stringify(json), /Private name|Private note|\+41 78|request_details_json|requestDetails/);
  }
});

test("the raw inquiry body is limited by UTF-8 bytes even without an honest content-length", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...valid, ignored: "ä".repeat(7000) }));
  for (const contentLength of [undefined, "1", String(bytes.length)]) {
    let cancelled = false;
    const headers = { origin, host: "ab3d.example.test", "Content-Type": "application/json" };
    if (contentLength) headers["content-length"] = contentLength;
    const body = new ReadableStream({
      start(controller) { controller.enqueue(bytes.subarray(0, 100)); controller.enqueue(bytes.subarray(100)); },
      cancel() { cancelled = true; },
    });
    const response = await POST(new Request(`${origin}/api/production-orders`, { method: "POST", headers, body, duplex: "half" }));
    assert.equal(response.status, 413);
    if (contentLength !== String(bytes.length)) assert.equal(cancelled, true);
  }
  assert.equal(rows().length, 0);
});

test("invalid JSON, invalid UTF-8, arrays and empty bodies cannot create an inquiry", async () => {
  for (const body of ["{broken", "[]", "null", "", new Uint8Array([0xff])]) {
    assert.equal((await POST(new Request(`${origin}/api/production-orders`, {
      method: "POST", headers: { origin, host: "ab3d.example.test", "Content-Type": "application/json" }, body,
    }))).status, 400);
  }
  assert.equal(rows().length, 0);
});

test("invalid quantities, size precision, template bounds and enum coercions cannot become saved inquiries", async () => {
  for (const input of [
    { quantity: 0 }, { quantity: 21 }, { quantity: 1.5 }, { quantity: "2" }, { quantity: null },
    { heightCm: 4.9 }, { heightCm: 50.1 }, { heightCm: "20" }, { heightCm: null }, { heightCm: 20.01 },
    { templateId: "keycap", heightCm: 5 }, { templateId: "chibi", heightCm: 7.9 },
    { material: "unknown" }, { finish: "unknown" }, { templateId: "unknown" }, { templateId: "__proto__" }, { templateId: "constructor" },
  ]) assert.equal((await post(input)).status, 400, JSON.stringify(input));
  assert.equal(rows().length, 0);
});

test("missing template identity cannot fall back to an arbitrary client name or estimate", async () => {
  assert.equal((await post({ templateId: undefined, templateName: "Eigene Idee", estimatedTotal: 45 })).status, 400);
  assert.equal(productionQuote(null), null); assert.equal(rows().length, 0);
});

test("a saved inquiry requires an owned completed conversion task", async () => {
  addTask("other-convert-0001", other);
  addTask("unfinished-convert-0001", user, "convert", "IN_PROGRESS");
  addTask("wrong-kind-task-0001", user, "resize");
  for (const sourceTaskId of ["unknown-task-0001", "other-convert-0001", "unfinished-convert-0001", "wrong-kind-task-0001"]) assert.equal((await post({ sourceTaskId })).status, 409);
  assert.equal(rows().length, 0);
});

test("authentication and same-origin checks precede inquiry creation", async () => {
  runtime.actor = null; assert.equal((await post({})).status, 401);
  runtime.actor = user;
  assert.equal((await POST(request("POST", valid, "https://other.example.test"))).status, 403);
  const absentOrigin = new Request(`${origin}/api/production-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(valid) });
  assert.equal((await POST(absentOrigin)).status, 403); assert.equal(rows().length, 0);
});

test("inquiries remain isolated from payment and production even for the operator", async () => {
  const created = await (await post({})).json(); runtime.actor = operator;
  for (const status of ["paid", "production", "shipped"]) assert.equal((await patch(created.order.id, status)).status, 409);
  assert.equal(rows()[0].status, "inquiry");
  assert.equal((await patch(created.order.id, "cancelled")).status, 200);
  assert.equal(rows()[0].status, "cancelled");
  assert.equal((await patch(created.order.id, "paid")).status, 409);
});

test("historical orders and prices remain unchanged and keep their sequential status flow", async () => {
  const id = legacy(); await post({});
  const old = rows().find(row => row.id === id); assert.equal(old.status, "awaiting_payment"); assert.equal(old.estimated_total_cents, 12345);
  runtime.actor = operator;
  assert.equal((await patch(id, "production")).status, 409);
  assert.equal((await patch(id, "paid")).status, 200);
  assert.equal((await patch(id, "shipped")).status, 409);
  assert.equal((await patch(id, "production")).status, 200);
  assert.equal((await patch(id, "shipped")).status, 200);
  assert.equal((await patch(id, "paid")).status, 409);
  assert.equal(rows().find(row => row.id === id).estimated_total_cents, 12345);
});

test("other customers cannot update statuses or read another customer's inquiry", async () => {
  const created = await (await post({})).json(); runtime.actor = other;
  assert.equal((await patch(created.order.id, "cancelled")).status, 403);
  const listing = await (await GET(new Request(`${origin}/api/production-orders?scope=production`))).json();
  assert.deepEqual(listing.orders, []);
  runtime.actor = operator;
  assert.equal((await (await GET(new Request(`${origin}/api/production-orders?scope=production`))).json()).orders.length, 1);
  assert.equal((await patch("PRINT-MISSING001", "cancelled")).status, 404);
});

test("the studio uses the shared quote and labels submission as a nonbinding inquiry", () => {
  const studio = readFileSync(new URL("../app/ai-design-studio.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../app/konto/account-dashboard.tsx", import.meta.url), "utf8");
  assert.match(studio, /productionQuote\(\{ templateId: selectedTemplate.id/);
  assert.doesNotMatch(studio, /estimatedTotal: estimate|Für \$\{money.format\(estimate\)\} fertigen lassen/);
  assert.match(studio, /Unverbindlich bei AB3D anfragen/);
  assert.match(studio, /keine Zahlung oder Produktion/);
  assert.match(dashboard, /inquiry: "Unverbindliche Anfrage/);
});

test("keyed inquiry retries return the original ID and frozen estimate without another write, even after the pricing formula changes", async () => {
  const first = await post({ requestId: inquiryRequestId }), saved = await first.json();
  assert.equal(first.status, 200); assert.equal(saved.order.estimatedTotalCents, 4500);
  const writes = database.writes;
  runtime.quoteAdjustment = 12_345;
  const repeated = await post({ requestId: inquiryRequestId.toUpperCase(), estimatedTotal: 1, templateName: "Ignored", complexity: 9 });
  assert.equal(repeated.status, 200); assert.equal(repeated.headers.get("cache-control"), "private, no-store");
  assert.equal(repeated.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual((await repeated.json()).order, saved.order);
  assert.equal(database.writes, writes); assert.equal(database.inquiryInserts, 1); assert.equal(rows().length, 1);
  assert.equal(rows()[0].inquiry_request_id, inquiryRequestId); assert.match(rows()[0].inquiry_request_sha256, /^[a-f0-9]{64}$/);
  assert.equal(rows()[0].status, "inquiry"); assert.equal(database.db.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n, 0);
});

test("equivalent normalized contacts and empty optional fields preserve the same inquiry identity", async () => {
  const first = await (await post({ requestId: inquiryRequestId, requestDetails: { name: " Léa ", country: " CH ", postalCode: " 8000 ", customerNote: " Test\r\nZeile " } })).json();
  const writes = database.writes;
  const response = await post({ requestId: inquiryRequestId, requestDetails: { customerNote: "Test\nZeile", phone: " ", postalCode: "8000", country: "CH", name: "Léa" } });
  assert.equal(response.status, 200); assert.equal((await response.json()).order.id, first.order.id); assert.equal(database.writes, writes);
  const otherKey = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const empty = await (await post({ requestId: otherKey })).json();
  const emptyRetry = await post({ requestId: otherKey, requestDetails: { phone: " ", name: "" } });
  assert.equal(emptyRetry.status, 200); assert.equal((await emptyRetry.json()).order.id, empty.order.id); assert.equal(rows().length, 2);
});

test("a reused inquiry key with changed quantity, model selection or contact semantics is rejected without mutation", async () => {
  await post({ requestId: inquiryRequestId, requestDetails: { customerNote: "Erster Wunsch" } });
  const before = rows(), writes = database.writes;
  for (const change of [{ quantity: 2 }, { material: "PETG" }, { heightCm: 21 }, { finish: "Premium" },
    { templateId: "chibi" }, { requestDetails: { customerNote: "Anderer Wunsch" } }, { requestDetails: { name: "Anderer Name" } }]) {
    const response = await post({ requestId: inquiryRequestId, requestDetails: { customerNote: "Erster Wunsch" }, ...change });
    assert.equal(response.status, 409); assert.equal((await response.json()).code, "inquiry_conflict");
  }
  assert.deepEqual(rows(), before); assert.equal(database.writes, writes);
});

test("parallel requests with the same account and inquiry key create exactly one row", async () => {
  const results = await Promise.all([post({ requestId: inquiryRequestId }), post({ requestId: inquiryRequestId }), post({ requestId: inquiryRequestId })]);
  assert.ok(results.every(response => response.status === 200));
  const ids = await Promise.all(results.map(async response => (await response.json()).order.id));
  assert.equal(new Set(ids).size, 1); assert.equal(rows().length, 1); assert.equal(rows()[0].status, "inquiry");
  const changed = await Promise.all([post({ requestId: inquiryRequestId }), post({ requestId: inquiryRequestId, quantity: 2 })]);
  assert.deepEqual(changed.map(response => response.status).sort(), [200, 409]); assert.equal(rows().length, 1);
  const freshKey = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const race = await Promise.all([post({ requestId: freshKey, quantity: 1 }), post({ requestId: freshKey, quantity: 2 })]);
  assert.deepEqual(race.map(response => response.status).sort(), [200, 409]);
  assert.equal(rows().filter(row => row.inquiry_request_id === freshKey).length, 1);
});

test("idempotency keys are private to the authenticated account and never bypass task ownership", async () => {
  const own = await (await post({ requestId: inquiryRequestId })).json();
  runtime.actor = other;
  assert.equal((await post({ requestId: inquiryRequestId })).status, 409, "Another user's task never becomes usable through a known request key");
  addTask("other-converted-0001", other);
  const theirs = await post({ requestId: inquiryRequestId, sourceTaskId: "other-converted-0001", email: user });
  assert.equal(theirs.status, 200); assert.notEqual((await theirs.json()).order.id, own.order.id);
  assert.equal(rows().length, 2); assert.deepEqual(new Set(rows().map(row => row.email)), new Set([user, other]));
  for (const actor of [user, other]) {
    runtime.actor = actor;
    const listing = await (await GET(new Request(`${origin}/api/production-orders`))).json();
    assert.equal(listing.orders.length, 1); assert.equal(listing.orders[0].email, actor);
    assert.doesNotMatch(JSON.stringify(listing), /inquiry_request_|requestSha256|requestId/);
  }
});

test("invalid keyed request IDs and same-host cross-scheme origins fail before any database mutation", async () => {
  for (const requestId of [null, 0, {}, "", "11111111-2222-1333-8444-555555555555", "11111111-2222-4333-7444-555555555555", "../escape", "x".repeat(200)])
    assert.equal((await post({ requestId })).status, 400);
  assert.equal((await POST(request("POST", valid, "http://ab3d.example.test"))).status, 403);
  const noOrigin = new Request(`${origin}/api/production-orders`, { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" }, body: JSON.stringify(valid) });
  assert.equal((await POST(noOrigin)).status, 403);
  assert.equal(database.writes, 0); assert.equal(rows().length, 0);
});

test("a lost database response after insert remains safely retryable with the same key and no duplicate inquiry", async () => {
  database.failInquiryAfter = true;
  let response = await post({ requestId: inquiryRequestId });
  assert.equal(response.status, 503); assert.equal((await response.clone().json()).code, "inquiry_unavailable");
  assert.doesNotMatch(await response.text(), /Sensitive|fixture|private\/model|after commit|INSERT/);
  assert.equal(rows().length, 1); const original = rows()[0], writes = database.writes;
  response = await post({ requestId: inquiryRequestId }); assert.equal(response.status, 200);
  assert.equal((await response.json()).order.id, original.id); assert.equal(rows().length, 1); assert.equal(database.writes, writes);
  database.failInquiryBefore = true;
  const another = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  response = await post({ requestId: another }); assert.equal(response.status, 503); assert.equal(rows().length, 1);
  response = await post({ requestId: another }); assert.equal(response.status, 200); assert.equal(rows().length, 2);
});

test("inquiry idempotency migration preserves legacy requests, permits legacy null keys and prevents duplicate keyed requests per account", () => {
  const migrationFiles = readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort();
  const newest = migrationFiles.find(name => name.startsWith("0015_")); assert.ok(newest);
  const old = new DatabaseSync(":memory:");
  try {
    old.exec("PRAGMA foreign_keys=ON");
    for (const name of migrationFiles.filter(name => name < newest)) old.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
    for (const email of [user, other]) old.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES (?,20,'free','inactive',0,0)").run(email);
    old.prepare("INSERT INTO generation_tasks(task_id,email,kind,token_cost,status,refunded,created_at,updated_at) VALUES (?,?,'convert',0,'SUCCEEDED',0,0,0)").run(sourceId, user);
    const insert = old.prepare("INSERT INTO production_orders(id,email,status,source_task_id,source_task_type,template_name,height_mm,material,finish,quantity,estimated_total_cents,currency,created_at,updated_at) VALUES (?,?,'inquiry',?,'convert','Legacy',200,'PLA','Roh',1,12345,'CHF',0,0)");
    insert.run("PRINT-LEGACY0001", user, sourceId);
    old.exec(readFileSync(new URL(`../drizzle/${newest}`, import.meta.url), "utf8"));
    const legacyRow = old.prepare("SELECT * FROM production_orders").get();
    assert.equal(legacyRow.status, "inquiry"); assert.equal(legacyRow.estimated_total_cents, 12345);
    assert.equal(legacyRow.inquiry_request_id, null); assert.equal(legacyRow.inquiry_request_sha256, null);
    insert.run("PRINT-LEGACY0002", user, sourceId);
    const update = old.prepare("UPDATE production_orders SET inquiry_request_id=?,inquiry_request_sha256=? WHERE id=?");
    update.run(inquiryRequestId, "a".repeat(64), "PRINT-LEGACY0001");
    assert.throws(() => update.run(inquiryRequestId, "b".repeat(64), "PRINT-LEGACY0002"), /UNIQUE/);
    old.prepare("UPDATE production_orders SET email=? WHERE id=?").run(other, "PRINT-LEGACY0002");
    update.run(inquiryRequestId, "b".repeat(64), "PRINT-LEGACY0002");
    assert.equal(old.prepare("SELECT COUNT(*) AS n FROM production_orders").get().n, 2); assert.equal(old.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally { old.close(); }
});
