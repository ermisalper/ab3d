import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const user = "creator@example.test", operator = "operator@example.test", other = "other@example.test";
const origin = "https://ab3d.example.test", sourceId = "converted-offline-0001";
const runtime = { env: {}, actor: user };
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
    this.db.exec("PRAGMA foreign_keys=ON");
    for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()) this.db.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  prepare(query) {
    const db = this.db;
    const statement = (args = []) => ({
      bind: (...values) => statement(values),
      first: async () => { const row = db.prepare(query).get(...args); return row ? { ...row } : null; },
      all: async () => ({ success: true, results: db.prepare(query).all(...args).map(row => ({ ...row })) }),
      run: async () => ({ success: true, meta: { changes: Number(db.prepare(query).run(...args).changes) } }),
    });
    return statement();
  }
}
const priorFetch = globalThis.fetch, priorOwners = process.env.AB3D_OWNER_EMAILS, priorUnlimited = process.env.AB3D_UNLIMITED_EMAILS;
let database;
beforeEach(() => {
  database = new D1(); runtime.env.DB = database; runtime.actor = user;
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
