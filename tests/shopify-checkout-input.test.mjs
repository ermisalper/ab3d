import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

// The actual checkout handler and catalogue parser run against local SQLite and fetch fixtures.
const ORIGIN = "https://checkout.example.test", DOMAIN = "checkout-fixture.myshopify.com";
const runtimeKey = "__shopifyCheckoutInputFixture", runtime = { env: {} };
globalThis[runtimeKey] = runtime;
const sources = new Map([
  ["cloudflare:workers", `export const env = globalThis.${runtimeKey}.env;`],
  ["next/headers", "export async function headers() { return new Headers(); }"],
  ["next/navigation", "export function redirect() { throw new Error('Unexpected redirect'); }"],
]);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (sources.has(specifier)) return { url: `checkout-input:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const file = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(file)) return next(file.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    return url.startsWith("checkout-input:")
      ? { format: "module", source: sources.get(url.slice("checkout-input:".length)), shortCircuit: true }
      : next(url, context);
  },
});
const { POST } = await import("../app/api/shopify/checkout/route.ts");
const { LEGAL_VERSION } = await import("../app/legal-version.ts");

const configured = { SHOPIFY_STORE_DOMAIN: DOMAIN, SHOPIFY_API_VERSION: "2026-07", SHOPIFY_STOREFRONT_ACCESS_TOKEN: "offline-storefront-fixture" };
const previousEnv = Object.fromEntries(Object.keys(configured).map(name => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
let sqlite, calls, writes, available;
beforeEach(() => {
  Object.assign(process.env, configured);
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const folder = new URL("../drizzle/", import.meta.url);
  for (const name of readdirSync(folder).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(name, folder), "utf8"));
  calls = []; writes = 0; available = true;
  runtime.env.DB = { prepare(sql) { return { bind(...args) { return { async run() {
    writes++; return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } };
  } }; } }; } };
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `https://${DOMAIN}/api/2026-07/graphql.json`, "No live provider network is permitted");
    assert.equal(init.method, "POST");
    const request = JSON.parse(init.body); calls.push(request);
    if (request.query.includes("Ab3dCollectionCatalog")) return Response.json({ data: { collection: {
      id: "gid://shopify/Collection/1", handle: "ab3d-3d-produkte", title: "Offline collection",
      products: { pageInfo: { hasNextPage: false }, nodes: [{
        id: "gid://shopify/Product/10", handle: "offline-object", title: "Offline object", description: "Synthetic fixture",
        variants: { pageInfo: { hasNextPage: false }, nodes: [{ id: "gid://shopify/ProductVariant/20", title: "Standard",
          sku: "OFFLINE-OBJECT", availableForSale: available, price: { amount: "20.00", currencyCode: "CHF" },
          selectedOptions: [{ name: "Size", value: "S" }, { name: "Color", value: "White" }] }] },
      }] },
    } } });
    assert.match(request.query, /Ab3dCartCreate/);
    return Response.json({ data: { cartCreate: { cart: { id: "gid://shopify/Cart/offline", checkoutUrl: `https://${DOMAIN}/checkouts/offline` }, userErrors: [] } } });
  };
});
afterEach(() => {
  sqlite.close(); globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
after(() => { hooks.deregister(); delete globalThis[runtimeKey]; });

const item = () => ({ productHandle: "offline-object", variantId: "gid://shopify/ProductVariant/20", quantity: 2 });
const body = () => ({ termsAccepted: true, items: [item()] });
function request(value, extraHeaders = {}) {
  return new Request(`${ORIGIN}/api/shopify/checkout`, { method: "POST", body: typeof value === "string" ? value : JSON.stringify(value),
    headers: { Origin: ORIGIN, Host: "checkout.example.test", "Content-Type": "application/json", ...extraHeaders } });
}
function noEffects() { assert.equal(calls.length, 0); assert.equal(writes, 0); }

for (const declared of [undefined, "1", "20001"]) test(`ordinary checkout bounds actual streamed bytes (declared length ${declared ?? "absent"})`, async () => {
  const state = { reads: 0, cancelled: false };
  const stream = new ReadableStream({
    pull(controller) { state.reads++; if (state.reads > 3) controller.close(); else controller.enqueue(new Uint8Array(10_000).fill(32)); },
    cancel() { state.cancelled = true; },
  }, { highWaterMark: 0 });
  const response = await POST(new Request(`${ORIGIN}/api/shopify/checkout`, { method: "POST", body: stream, duplex: "half",
    headers: { Origin: ORIGIN, Host: "checkout.example.test", ...(declared === undefined ? {} : { "Content-Length": declared }) } }));
  assert.equal(response.status, 413); assert.equal((await response.json()).code, "request_too_large");
  assert.equal(state.reads, declared === "20001" ? 0 : 3); assert.equal(state.cancelled, declared !== "20001");
  noEffects();
});

for (const value of [null, [], "invalid", 1, true]) test(`ordinary checkout rejects a non-object JSON body: ${JSON.stringify(value)}`, async () => {
  const response = await POST(request(value)); assert.equal(response.status, 400); noEffects();
});
for (const value of [null, [], "invalid", 1, true, {}, { ...item(), quantity: "2" }, { ...item(), quantity: true },
  { ...item(), quantity: 1.5 }, { ...item(), quantity: 0 }, { ...item(), productHandle: 7 }, { ...item(), variantId: {} }]) {
  test(`ordinary checkout rejects malformed cart items without effects: ${JSON.stringify(value)}`, async () => {
    const response = await POST(request({ termsAccepted: true, items: [value] }));
    assert.equal(response.status, 400); assert.equal((await response.json()).code, "invalid_item"); noEffects();
  });
}
test("ordinary checkout rejects malformed JSON and UTF-8 before reading the catalogue", async () => {
  assert.equal((await POST(request('{"termsAccepted":'))).status, 400);
  const response = await POST(new Request(`${ORIGIN}/api/shopify/checkout`, { method: "POST", body: new Uint8Array([0x22, 0xff, 0x22]),
    headers: { Origin: ORIGIN, Host: "checkout.example.test" } }));
  assert.equal(response.status, 400); noEffects();
});
test("ordinary checkout retains origin and explicit terms checks", async () => {
  assert.equal((await POST(request(body(), { Origin: "https://other.example.test" }))).status, 403);
  const response = await POST(request({ ...body(), termsAccepted: false }));
  assert.equal(response.status, 400); assert.equal((await response.json()).code, "terms_required"); noEffects();
});
test("ordinary checkout still binds SKU, variant, quantities and versioned consent to the server catalogue", async () => {
  const response = await POST(request({ ...body(), priceCents: 1, email: "untrusted@example.test" }));
  assert.equal(response.status, 200); const receipt = await response.json();
  assert.equal(receipt.checkoutUrl, `https://${DOMAIN}/checkouts/offline`); assert.match(receipt.sessionId, /^CHK-[A-Z0-9]{16}$/);
  assert.equal(calls.length, 2); assert.equal(writes, 1);
  const cart = calls[1].variables.input;
  assert.deepEqual(cart.lines[0].merchandiseId, item().variantId); assert.equal(cart.lines[0].quantity, 2);
  assert.ok(cart.attributes.some(value => value.key === "LEGAL_TERMS_VERSION" && value.value === LEGAL_VERSION));
  assert.equal(cart.buyerIdentity, undefined);
  const session = sqlite.prepare("SELECT * FROM checkout_sessions").get();
  assert.equal(session.currency, "CHF"); assert.equal(session.status, "checkout_created");
  assert.equal(session.estimated_total_cents, 4900); assert.equal(session.legal_version, LEGAL_VERSION);
  const saved = JSON.parse(session.items_json)[0]; assert.equal(saved.sku, "OFFLINE-OBJECT"); assert.equal(saved.unitPriceCents, 2000);
});
test("ordinary checkout retains unknown variant and unavailable stock rejection", async () => {
  const mismatch = body(); mismatch.items[0].variantId = "gid://shopify/ProductVariant/999";
  assert.equal((await POST(request(mismatch))).status, 400); assert.equal(writes, 0);
  available = false;
  assert.equal((await POST(request(body()))).status, 409); assert.equal(writes, 0);
  assert.ok(calls.every(call => call.query.includes("Ab3dCollectionCatalog")));
});
