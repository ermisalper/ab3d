import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

// Actual handlers and SQLite migrations; identities, credentials and all network responses are local fixtures.
const ORIGIN = "https://limits.example.test";
const DOMAIN = "limits-fixture.myshopify.com";
const EMAIL = "owner@example.test";
const SECRET = "offline-body-limit-fixture";
const key = "__cappatexRequestLimitTest";
const runtime = { actor: EMAIL, env: {} };
globalThis[key] = runtime;
const sources = new Map([
  ["cloudflare:workers", `export const env = globalThis.${key}.env;`],
  ["next/headers", `export async function headers() { const actor = globalThis.${key}.actor; return new Headers(actor ? { "oai-authenticated-user-email": actor } : {}); }`],
  ["next/navigation", "export function redirect() { throw new Error('Unexpected redirect'); }"],
]);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (sources.has(specifier)) return { url: `offline-limits:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const file = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(file)) return nextResolve(file.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("offline-limits:")) return { format: "module", source: sources.get(url.slice("offline-limits:".length)), shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { POST: checkout } = await import("../app/api/cappatex/checkout/route.ts");
const { POST: webhook } = await import("../app/api/cappatex/webhooks/shopify/route.ts");
const { GET: audit } = await import("../app/api/cappatex/audit/route.ts");

class MemoryD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("PRAGMA foreign_keys = ON");
    const folder = new URL("../drizzle/", import.meta.url);
    for (const name of readdirSync(folder).filter(name => name.endsWith(".sql")).sort()) this.sqlite.exec(readFileSync(new URL(name, folder), "utf8"));
  }
  prepare(sql) {
    const sqlite = this.sqlite;
    const statement = (args = []) => ({
      bind: (...values) => statement(values),
      first: async column => {
        const row = sqlite.prepare(sql).get(...args);
        return row ? column ? row[column] : { ...row } : null;
      },
      all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
      runSync() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
      async run() { return this.runSync(); },
    });
    return statement();
  }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try { const results = statements.map(s => s.runSync()); this.sqlite.exec("COMMIT"); return results; }
    catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}

const configured = { CAPPATEX_CHECKOUT_ENABLED: "true", CAPPATEX_FULFILLMENT_ENABLED: "false",
  SHOPIFY_STORE_DOMAIN: DOMAIN, SHOPIFY_WEBHOOK_SECRET: SECRET, SHOPIFY_API_VERSION: "2026-07",
  SHOPIFY_STOREFRONT_ACCESS_TOKEN: "offline-storefront-token", PRINTIFY_SHOP_ID: "offline-shop",
  PRINTIFY_API_TOKEN: "offline-production-token", PRINTIFY_CATALOG_API_TOKEN: "offline-read-token",
  CAPPATEX_GENERATION_ALLOWED_EMAILS: EMAIL, AB3D_OWNER_EMAILS: "", AB3D_UNLIMITED_EMAILS: "" };
const previousEnv = Object.fromEntries(Object.keys(configured).map(name => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
let db, requests;
beforeEach(() => {
  Object.assign(process.env, configured);
  runtime.actor = EMAIL;
  db = new MemoryD1();
  Object.assign(runtime.env, { DB: db });
  requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url: url.href, method: init.method || "GET", authorization: new Headers(init.headers).get("Authorization") });
    assert.equal(init.method || "GET", url.hostname === DOMAIN ? "POST" : "GET", "Only read-only provider queries are permitted");
    if (url.hostname === DOMAIN) return Response.json({ data: { collection: { id: "gid://shopify/Collection/1", title: "Offline collection", handle: "offline", products: { nodes: [], pageInfo: { hasNextPage: false } } } } });
    assert.equal(url.hostname, "api.printify.com", "No live network is allowed");
    if (url.pathname.endsWith("/products.json")) return Response.json({ data: [], last_page: 1 });
    if (url.pathname === "/v1/shops.json") return Response.json([{ id: "offline-shop", title: "Offline shop" }]);
    if (url.pathname.endsWith("/variants.json")) return Response.json({ variants: [] });
    if (url.pathname.endsWith("/shipping.json")) return Response.json({ profiles: [] });
    throw new Error(`Unexpected local fixture request ${url.pathname}`);
  };
});
afterEach(() => {
  db.sqlite.close();
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
after(() => { hooks.deregister(); delete globalThis[key]; });

function overflowStream(chunkSize) {
  const state = { reads: 0, cancelled: false };
  const body = new ReadableStream({
    pull(controller) { state.reads++; controller.enqueue(new Uint8Array(chunkSize)); },
    cancel() { state.cancelled = true; },
  }, { highWaterMark: 0 });
  return { state, body };
}
function webhookHeaders(extra = {}) {
  return { "Content-Type": "application/json", "x-shopify-topic": "orders/paid", "x-shopify-webhook-id": "offline-body-event",
    "x-shopify-shop-domain": DOMAIN, "x-shopify-hmac-sha256": "invalid", ...extra };
}
function assertNoCommerce() {
  for (const table of ["cappatex_snapshots", "cappatex_fulfillments", "shopify_orders"]) {
    assert.equal(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
  }
  assert.equal(requests.length, 0);
}

for (const declaredLength of [undefined, "1", "8001"]) test(`checkout bounds streamed bytes before parsing or commerce (Content-Length ${declaredLength ?? "absent"})`, async () => {
  const { body, state } = overflowStream(4000);
  const response = await checkout(new Request(`${ORIGIN}/api/cappatex/checkout`, { method: "POST", body, duplex: "half",
    headers: { Origin: ORIGIN, ...(declaredLength === undefined ? {} : { "Content-Length": declaredLength }) } }));
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, "request_too_large");
  assert.equal(state.reads, declaredLength === "8001" ? 0 : 3, "Do not drain an oversized request");
  assert.equal(state.cancelled, declaredLength !== "8001");
  assertNoCommerce();
});

for (const declaredLength of [undefined, "1", "1000001"]) test(`webhook bounds raw bytes before HMAC or commerce (Content-Length ${declaredLength ?? "absent"})`, async () => {
  const { body, state } = overflowStream(500_000);
  const response = await webhook(new Request(`${ORIGIN}/api/cappatex/webhooks/shopify`, { method: "POST", body, duplex: "half",
    headers: webhookHeaders(declaredLength === undefined ? {} : { "Content-Length": declaredLength }) }));
  assert.equal(response.status, 413);
  assert.equal(state.reads, declaredLength === "1000001" ? 0 : 3);
  assert.equal(state.cancelled, declaredLength !== "1000001");
  assertNoCommerce();
});

test("a chunked webhook keeps whitespace and split UTF-8 bytes unchanged for HMAC", async () => {
  const order = { id: 17, financial_status: "paid", email: "customer@example.test", currency: "CHF", subtotal_price: "20.00", total_price: "29.00",
    shipping_address: { first_name: "Bérk", last_name: "Fixture", address1: "Musterweg 1", city: "Zürich", zip: "8000", country_code: "CH" },
    line_items: [{ title: "Finished catalogue item", sku: "OFFLINE-FINISHED", quantity: 1, price: "20.00" }] };
  const raw = new TextEncoder().encode(` \n${JSON.stringify(order, null, 2)}\n `);
  const signingKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", signingKey, raw)).toString("base64");
  let index = 0;
  const body = new ReadableStream({ pull(controller) {
    if (index === raw.length) controller.close(); else controller.enqueue(raw.subarray(index, ++index));
  } });
  const response = await webhook(new Request(`${ORIGIN}/api/cappatex/webhooks/shopify`, { method: "POST", body, duplex: "half",
    headers: webhookHeaders({ "x-shopify-hmac-sha256": signature }) }));
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).status, "order_recorded");
  assert.equal(db.sqlite.prepare("SELECT customer_name FROM shopify_orders WHERE order_id = '17'").get().customer_name, "Bérk Fixture");
  assert.equal(requests.length, 0);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM cappatex_fulfillments").get().n, 0);
});

test("a changed signed payload is rejected after bounded reading without recording an order", async () => {
  const raw = new TextEncoder().encode('{"id":17}');
  const signingKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", signingKey, raw)).toString("base64");
  const response = await webhook(new Request(`${ORIGIN}/api/cappatex/webhooks/shopify`, { method: "POST", body: '{"id":18}',
    headers: webhookHeaders({ "x-shopify-hmac-sha256": signature }) }));
  assert.equal(response.status, 401);
  assertNoCommerce();
});

for (const separateReadToken of [true, false]) test(`owner audit uses ${separateReadToken ? "the read-only credential" : "the existing credential fallback"} and never implies production write access`, async () => {
  if (!separateReadToken) delete process.env.PRINTIFY_CATALOG_API_TOKEN;
  const response = await audit(new Request(`${ORIGIN}/api/cappatex/audit?blueprint=301&provider=401`));
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json();
  assert.equal(body.catalogCredential, separateReadToken ? "catalog_read_token" : "production_token_fallback");
  assert.equal(body.productionWritePermissions.status, "unverified");
  assert.deepEqual(body.productionWritePermissions.requiredScopes, ["products.write", "uploads.write", "orders.write"]);
  assert.match(body.productionWritePermissions.message, /ungeprüft/);
  const providerReads = requests.filter(r => new URL(r.url).hostname === "api.printify.com");
  assert.equal(providerReads.length, 4);
  assert.ok(providerReads.every(r => r.method === "GET" && r.authorization === `Bearer ${separateReadToken ? "offline-read-token" : "offline-production-token"}`));
  assert.ok(!JSON.stringify(body).includes("offline-read-token") && !JSON.stringify(body).includes("offline-production-token"));
});

test("read-only audit requires the owner identity before contacting either provider", async () => {
  for (const actor of [null, "other@example.test"]) {
    runtime.actor = actor;
    assert.equal((await audit(new Request(`${ORIGIN}/api/cappatex/audit`))).status, 403);
  }
  assertNoCommerce();
});
