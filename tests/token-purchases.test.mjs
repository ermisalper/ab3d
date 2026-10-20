import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { createHmac } from "node:crypto";

const actor = "creator@example.test", other = "other@example.test", origin = "https://ab3d.example.test", domain = "tokens-offline.myshopify.com";
const secret = "offline-webhook-signing-fixture-only";
const runtime = { env: {}, actor, releases: [], physicalProfiles: [{ variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/202" }] }] };
globalThis.__tokenPurchaseOffline = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (["cloudflare:workers", "next/headers", "next/navigation"].includes(specifier)) return { url: `tokens-fixture:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith("/app/token-pack-releases.ts")) return { format: "module", source: "export const TOKEN_PACK_RELEASES = globalThis.__tokenPurchaseOffline.releases;", shortCircuit: true };
    if (url.endsWith("/app/cappatex-profiles.ts")) return { format: "module", source: "export const CAPPATEX_PRINT_PROFILES = globalThis.__tokenPurchaseOffline.physicalProfiles;", shortCircuit: true };
    if (url.endsWith("/app/legal-version.ts")) return { format: "module", source: "export let LEGAL_VERSION='2026-08-19'; export function updateLegalFixture(value){ LEGAL_VERSION=value; }", shortCircuit: true };
    const source = {
      "tokens-fixture:cloudflare:workers": "export const env = globalThis.__tokenPurchaseOffline.env;",
      "tokens-fixture:next/headers": "export async function headers(){return new Headers(globalThis.__tokenPurchaseOffline.actor?{'oai-authenticated-user-email':globalThis.__tokenPurchaseOffline.actor}:{});}",
      "tokens-fixture:next/navigation": "export function redirect(){throw new Error('Unexpected redirect');}",
    }[url];
    return source ? { format: "module", source, shortCircuit: true } : next(url, context);
  },
});
const { GET } = await import("../app/api/token-purchases/route.ts");
const { POST } = await import("../app/api/token-purchases/checkout/route.ts");
const { POST: receipt } = await import("../app/api/token-purchases/webhooks/shopify/route.ts");
const { POST: physicalReceipt } = await import("../app/api/cappatex/webhooks/shopify/route.ts");
const { CAPPATEX_PRINT_PROFILES } = await import("../app/cappatex-profiles.ts");
const { TOKEN_PACKS, TOKEN_TERMS_VERSION } = await import("../app/token-packs.ts");
const { safeTokenCheckoutUrl } = await import("../app/token-purchase-shopify.ts");
const { updateLegalFixture } = await import("../app/legal-version.ts");
const catalogueBaseline = TOKEN_PACKS.map(pack => ({ ...pack }));

class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:"); this.writes = 0; this.failBatchAt = -1;
    this.db.exec("PRAGMA foreign_keys=ON");
    for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()) this.db.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  prepare(query) {
    const db = this.db;
    const statement = (args = []) => ({
      query, args,
      bind: (...values) => statement(values),
      first: async () => { const row = db.prepare(query).get(...args); return row ? { ...row } : null; },
      all: async () => ({ success: true, results: db.prepare(query).all(...args).map(row => ({ ...row })) }),
      run: async () => { this.writes++; return { success: true, meta: { changes: Number(db.prepare(query).run(...args).changes) } }; },
    });
    return statement();
  }
  async batch(statements) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement, index) => {
        if (this.failBatchAt === index) { this.failBatchAt = -1; throw new Error("Injected SQLite batch failure"); }
        this.writes++;
        return { success: true, meta: { changes: Number(this.db.prepare(statement.query).run(...statement.args).changes) } };
      });
      this.db.exec("COMMIT"); return results;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}
const envNames = ["TOKEN_PURCHASES_ENABLED", "SHOPIFY_WEBHOOK_SECRET", "SHOPIFY_STORE_DOMAIN", "AB3D_UNLIMITED_EMAILS", "SHOPIFY_STOREFRONT_ACCESS_TOKEN"];
const previousEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const priorFetch = globalThis.fetch;
let db, calls, variantMutation, cartMutation, cartMode;
beforeEach(() => {
  updateLegalFixture("2026-08-19"); TOKEN_PACKS.forEach((pack, index) => Object.assign(pack, catalogueBaseline[index]));
  db = new D1(); runtime.env.DB = db; runtime.actor = actor; calls = []; variantMutation = null; cartMutation = null; cartMode = "ok";
  process.env.TOKEN_PURCHASES_ENABLED = "true"; process.env.SHOPIFY_WEBHOOK_SECRET = secret; process.env.SHOPIFY_STORE_DOMAIN = domain;
  process.env.AB3D_UNLIMITED_EMAILS = ""; delete process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  runtime.releases.splice(0, runtime.releases.length, ...TOKEN_PACKS.map((pack, index) => ({
    packId: pack.id, version: "offline-v1", shopDomain: domain, variantId: `gid://shopify/ProductVariant/${1001 + index}`,
    sku: `OFFLINE-${pack.id}`, countries: ["CH", "LI"], digital: true, taxInclusive: true,
    checkoutVerifiedAt: "2026-01-01T00:00:00Z", webhookReceiptVerifiedAt: "2026-01-01T00:00:00Z",
  })));
  for (const email of [actor, other]) db.db.prepare("INSERT INTO accounts(email,token_balance,plan,subscription_status,created_at,updated_at) VALUES (?,4,'free','inactive',0,0)").run(email);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `https://${domain}/api/2026-07/graphql.json`, "All provider responses are local fixtures; no external request is sent");
    const input = JSON.parse(options.body); calls.push(input);
    if (input.query.includes("query TokenPackVariant")) {
      const release = runtime.releases.find(item => item.variantId === input.variables.id), pack = TOKEN_PACKS.find(item => item.id === release.packId);
      const variant = { id: release.variantId, sku: release.sku, availableForSale: true, requiresShipping: false, requiresComponents: false,
        price: { amount: (pack.priceCents / 100).toFixed(2), currencyCode: "CHF" }, quantityRule: { minimum: 1, maximum: null, increment: 1 },
        sellingPlanAllocations: { nodes: [] }, product: { requiresSellingPlan: false } };
      if (variantMutation) variantMutation(variant);
      return Response.json({ data: { node: variant } });
    }
    assert.ok(input.query.includes("mutation TokenPackCartCreate"));
    if (cartMode === "timeout") throw new Error("Offline simulated unknown Shopify result");
    const lineInput = input.variables.input.lines[0], release = runtime.releases.find(item => item.variantId === lineInput.merchandiseId);
    const pack = TOKEN_PACKS.find(item => item.id === release.packId), money = { amount: (pack.priceCents / 100).toFixed(2), currencyCode: "CHF" };
    const count = calls.filter(call => call.query.includes("mutation TokenPackCartCreate")).length;
    const cart = { id: `gid://shopify/Cart/offline-cart-${count}`, checkoutUrl: `https://${domain}/checkouts/offline-${count}`,
      totalQuantity: 1, attributes: input.variables.input.attributes, buyerIdentity: input.variables.input.buyerIdentity,
      cost: { totalAmount: money, subtotalAmount: money }, discountCodes: [], appliedGiftCards: [], deliveryGroups: { nodes: [] },
      lines: { nodes: [{ quantity: 1, attributes: lineInput.attributes, sellingPlanAllocation: null, discountAllocations: [],
        cost: { totalAmount: money, amountPerQuantity: money }, merchandise: { id: release.variantId, sku: release.sku, requiresShipping: false, requiresComponents: false } }] } };
    if (cartMutation) cartMutation(cart);
    return Response.json({ data: { cartCreate: { cart, userErrors: [], warnings: [] } } });
  };
});
afterEach(() => { db.db.close(); globalThis.fetch = priorFetch; TOKEN_PACKS.forEach((pack, index) => Object.assign(pack, catalogueBaseline[index])); });
after(() => {
  hooks.deregister(); delete globalThis.__tokenPurchaseOffline;
  for (const [name, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});

function body(extra = {}) { return { packId: "tokens-5", country: "CH", termsAccepted: true, requestId: crypto.randomUUID(), ...extra }; }
function checkout(value = body(), requestOrigin = origin) {
  return POST(new Request(`${origin}/api/token-purchases/checkout`, { method: "POST", headers: { origin: requestOrigin, "Content-Type": "application/json" }, body: JSON.stringify(value) }));
}
function rows(table = "token_purchases") { return db.db.prepare(`SELECT * FROM ${table}`).all().map(row => ({ ...row })); }
function balance(email = actor) { return db.db.prepare("SELECT token_balance FROM accounts WHERE email=?").get(email).token_balance; }
async function prepared(extra) {
  const input = body(extra), response = await checkout(input); assert.equal(response.status, 200, await response.clone().text());
  const result = await response.json(), row = rows().find(item => item.id === result.purchaseId);
  return { input, row, snapshot: JSON.parse(row.snapshot_json), hash: row.snapshot_sha256, result };
}
function paid(preparation, overrides = {}) {
  const { snapshot: s, hash } = preparation, price = (s.priceCents / 100).toFixed(2);
  const attributes = [{ name: "AB3D_TOKEN_PURCHASE_ID", value: s.id }, { name: "AB3D_TOKEN_SNAPSHOT_SHA256", value: hash }, { name: "AB3D_TOKEN_PACK_ID", value: s.packId }];
  return { id: 12345, admin_graphql_api_id: "gid://shopify/Order/12345", email: s.email, contact_email: s.email,
    financial_status: "paid", cancelled_at: null, test: false, currency: "CHF", presentment_currency: "CHF", taxes_included: true,
    total_price: price, current_total_price: price, subtotal_price: price, current_subtotal_price: price,
    total_discounts: "0.00", current_total_discounts: "0.00", total_outstanding: "0.00", refunds: [],
    shipping_lines: [], total_shipping_price_set: { shop_money: { amount: "0.00", currency_code: "CHF" }, presentment_money: { amount: "0.00", currency_code: "CHF" } },
    billing_address: { country_code: s.country }, shipping_address: null, note_attributes: structuredClone(attributes),
    line_items: [{ id: 6789, variant_id: Number(s.release.variantId.split("/").at(-1)), quantity: 1, current_quantity: 1, sku: s.release.sku,
      price, total_discount: "0.00", discount_allocations: [], properties: structuredClone(attributes), requires_shipping: false, gift_card: false }],
    ...overrides };
}
function webhook(order, extraHeaders = {}, rawOverride) {
  const raw = rawOverride ?? JSON.stringify(order), signature = createHmac("sha256", secret).update(raw).digest("base64");
  return receipt(new Request(`${origin}/api/token-purchases/webhooks/shopify`, { method: "POST", headers: {
    "x-shopify-shop-domain": domain, "x-shopify-topic": "orders/paid", "x-shopify-event-id": crypto.randomUUID(),
    "x-shopify-hmac-sha256": signature, ...extraHeaders,
  }, body: raw }));
}
function physicalWebhook(order) {
  const raw = JSON.stringify(order), signature = createHmac("sha256", secret).update(raw).digest("base64");
  return physicalReceipt(new Request(`${origin}/api/cappatex/webhooks/shopify`, { method: "POST", headers: {
    "x-shopify-shop-domain": domain, "x-shopify-topic": "orders/paid", "x-shopify-webhook-id": crypto.randomUUID(), "x-shopify-hmac-sha256": signature,
  }, body: raw }));
}

test("shared packages have exact one-off CHF prices and no inferred Shopify bindings", () => {
  assert.deepEqual(TOKEN_PACKS.map(({ id, tokens, priceCents, currency }) => ({ id, tokens, priceCents, currency })), [
    { id: "tokens-5", tokens: 5, priceCents: 500, currency: "CHF" }, { id: "tokens-15", tokens: 15, priceCents: 1200, currency: "CHF" },
    { id: "tokens-40", tokens: 40, priceCents: 2800, currency: "CHF" },
  ]);
  const registry = readFileSync(new URL("../app/token-pack-releases.ts", import.meta.url), "utf8");
  assert.match(registry, /TOKEN_PACK_RELEASES: readonly TokenPackRelease\[\] = \[\]/);
});

test("closed gates never mutate any table or contact Shopify, including for forged browser prices", async () => {
  const scenarios = [() => { process.env.TOKEN_PURCHASES_ENABLED = "false"; }, () => { delete process.env.SHOPIFY_WEBHOOK_SECRET; },
    () => { runtime.releases.length = 0; }, () => { runtime.releases[0].taxInclusive = false; },
    () => { runtime.releases[0].webhookReceiptVerifiedAt = ""; }, () => { runtime.releases[0].checkoutVerifiedAt = "2099-01-01T00:00:00Z"; }];
  const releases = structuredClone(runtime.releases);
  for (const closeGate of scenarios) {
    process.env.TOKEN_PURCHASES_ENABLED = "true"; process.env.SHOPIFY_WEBHOOK_SECRET = secret; runtime.releases.splice(0, runtime.releases.length, ...structuredClone(releases));
    closeGate();
    const response = await checkout(body({ priceCents: 1, tokens: 999999, email: other }));
    assert.equal(response.status, 503); assert.equal((await response.json()).code, "not_ready");
    assert.equal(db.writes, 0); assert.equal(calls.length, 0); assert.equal(rows().length, 0); assert.equal(balance(), 4);
  }
});

test("authentication, strict same-origin and bounded streams precede checkout effects", async () => {
  runtime.actor = null; assert.equal((await GET()).status, 401); assert.equal((await checkout()).status, 401); runtime.actor = actor;
  assert.equal((await checkout(body(), "https://evil.example.test")).status, 403);
  assert.equal((await POST(new Request(`${origin}/api/token-purchases/checkout`, { method: "POST", body: JSON.stringify(body()) }))).status, 403);
  const oversized = new Request(`${origin}/api/token-purchases/checkout`, { method: "POST", headers: { origin }, body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(" ".repeat(5000))); controller.close(); } }), duplex: "half" });
  assert.equal((await POST(oversized)).status, 413); assert.equal(db.writes, 0); assert.equal(calls.length, 0);
});

test("invalid pack/country/terms/request IDs cannot create or change a purchase", async () => {
  for (const bad of [{ packId: "__proto__" }, { packId: "unknown" }, { country: "DE" }, { country: null }, { termsAccepted: "true" }, { termsAccepted: false }, { requestId: "123" }, { requestId: null }]) {
    assert.equal((await checkout(body(bad))).status, 400, JSON.stringify(bad));
  }
  assert.equal(db.writes, 0); assert.equal(calls.length, 0);
});

test("fresh variant query rejects price, SKU, digital, quantity and subscription mismatches before reservation", async () => {
  const mismatches = [v => { v.sku = "wrong"; }, v => { v.id = "gid://shopify/ProductVariant/9999"; }, v => { v.availableForSale = false; },
    v => { v.requiresShipping = true; }, v => { v.requiresComponents = true; }, v => { v.price.amount = "4.99"; }, v => { v.price.currencyCode = "EUR"; },
    v => { v.sellingPlanAllocations.nodes.push({ sellingPlan: { id: "offline-plan" } }); }, v => { v.product.requiresSellingPlan = true; },
    v => { v.quantityRule.minimum = 2; }, v => { v.quantityRule.increment = 2; }, v => { delete v.requiresShipping; }];
  for (const mismatch of mismatches) { variantMutation = mismatch; assert.equal((await checkout()).status, 503); assert.equal(rows().length, 0); }
  assert.equal(calls.filter(call => call.query.includes("mutation")).length, 0); assert.equal(db.writes, 0);
});

test("server-owned prices, tokens, authenticated account and accepted legal versions are frozen without issuing credit", async () => {
  const preparedPurchase = await prepared({ packId: "tokens-15", country: "LI", tokens: 9000, priceCents: 1, email: other });
  const { row, snapshot } = preparedPurchase;
  assert.equal(row.email, actor); assert.equal(row.tokens, 15); assert.equal(row.price_cents, 1200); assert.equal(row.country, "LI");
  assert.equal(snapshot.email, actor); assert.equal(snapshot.tokens, 15); assert.equal(snapshot.priceCents, 1200); assert.equal(snapshot.tokenTermsVersion, TOKEN_TERMS_VERSION);
  assert.ok(snapshot.legalVersion); assert.equal(row.status, "checkout_created"); assert.equal(rows("token_ledger").length, 0); assert.equal(balance(), 4);
  assert.throws(() => db.db.prepare("UPDATE token_purchases SET snapshot_json = '{}' WHERE id=?").run(row.id), /immutable_token_purchase/);
  assert.throws(() => db.db.prepare("UPDATE token_purchases SET tokens = 999 WHERE id=?").run(row.id), /immutable_token_purchase/);
});

test("same UUID and input returns the same cart without another Shopify request; changed input is rejected", async () => {
  const preparedPurchase = await prepared(); const count = calls.length;
  const retry = await checkout(preparedPurchase.input); assert.equal(retry.status, 200); assert.deepEqual(await retry.json(), preparedPurchase.result);
  assert.equal(calls.length, count); assert.equal(rows().length, 1);
  const changed = await checkout({ ...preparedPurchase.input, packId: "tokens-15" }); assert.equal(changed.status, 409);
  assert.equal((await changed.json()).code, "request_conflict"); assert.equal(calls.length, count);
});

test("concurrent retries reserve one immutable purchase and create at most one cart", async () => {
  const input = body(), responses = await Promise.all([checkout(input), checkout(input), checkout(input)]);
  assert.equal(responses.filter(response => response.status === 200).length >= 1, true);
  assert.ok(responses.every(response => [200, 409].includes(response.status)));
  assert.equal(rows().length, 1); assert.equal(calls.filter(call => call.query.includes("mutation")).length, 1); assert.equal(balance(), 4);
});

test("unknown cart results are held for manual review and never retried even with a fresh UUID", async () => {
  cartMode = "timeout"; const input = body();
  assert.equal((await checkout(input)).status, 409); assert.equal(rows()[0].status, "checkout_uncertain");
  const count = calls.length; assert.equal((await checkout(input)).status, 409); assert.equal((await checkout()).status, 409);
  assert.equal(calls.length, count); assert.equal(rows().length, 1); assert.equal(balance(), 4);
});

test("unsafe checkout URLs, cart price changes or replaced attributes never become an available checkout", async () => {
  for (const value of [`https://evil.example.test/checkouts/1`, `http://${domain}/checkouts/1`, `https://user@${domain}/checkouts/1`, `https://${domain}/account`, `https://${domain}/checkouts/1#fragment`]) assert.equal(safeTokenCheckoutUrl(value, domain), null);
  const mismatches = [c => { c.checkoutUrl = "https://evil.example.test/checkouts/1"; }, c => { c.cost.totalAmount = { amount: "4.00", currencyCode: "CHF" }; },
    c => { c.lines.nodes[0].quantity = 2; }, c => { c.lines.nodes[0].merchandise.requiresShipping = true; },
    c => { c.lines.nodes[0].attributes.push(c.lines.nodes[0].attributes[0]); }, c => { c.appliedGiftCards.push({ id: "gift" }); },
    c => { c.buyerIdentity.email = other; }, c => { c.deliveryGroups.nodes.push({ id: "shipping" }); }];
  for (const mismatch of mismatches) {
    cartMutation = mismatch; assert.equal((await checkout()).status, 409); assert.equal(rows().at(-1).status, "checkout_uncertain");
    // Fixture-only cleanup of an unpaid ambiguous checkout, to exercise the next independent mismatch.
    db.db.prepare("UPDATE token_purchases SET status='checkout_created' WHERE status='checkout_uncertain'").run();
  }
  assert.equal(balance(), 4); assert.equal(rows("token_ledger").length, 0);
});

test("owner history is isolated, contains no cart secrets and still refreshes when checkout is disabled", async () => {
  const preparedPurchase = await prepared(); runtime.actor = other;
  assert.equal((await (await GET()).json()).purchases.length, 0); runtime.actor = actor; process.env.TOKEN_PURCHASES_ENABLED = "false";
  const result = await (await GET()).json(); assert.equal(result.enabled, false); assert.ok(result.packs.every(pack => !pack.available));
  assert.equal(result.purchases.length, 1); assert.equal(result.purchases[0].requestId, preparedPurchase.input.requestId);
  assert.deepEqual(Object.keys(result.purchases[0]).sort(), ["createdAt", "currency", "id", "packId", "priceCents", "requestId", "status", "tokens"].sort());
  assert.equal(calls.length, 2);
});

test("webhook rejects bad HMAC, wrong shop/topic/event IDs and oversized raw streams without credit", async () => {
  const preparedPurchase = await prepared(), order = paid(preparedPurchase);
  for (const header of [{ "x-shopify-hmac-sha256": "wrong" }, { "x-shopify-hmac-sha256": createHmac("sha256", "wrong-secret").update(JSON.stringify(order)).digest("base64") },
    { "x-shopify-shop-domain": "different.myshopify.com" }, { "x-shopify-topic": "orders/create" }, { "x-shopify-event-id": "invalid" }, { "x-shopify-test": "true" }]) {
    assert.notEqual((await webhook(order, header)).status, 200);
  }
  assert.equal((await webhook(order, {}, " ".repeat(256_001))).status, 413);
  assert.equal(balance(), 4); assert.equal(rows("token_purchase_receipts").length, 0); assert.equal(rows("token_ledger").length, 0);
});

test("signed physical orders are acknowledged without token effects; malformed or mixed token markers remain review cases", async () => {
  const preparedPurchase = await prepared(), order = paid(preparedPurchase);
  order.note_attributes = []; order.line_items[0].properties = [{ name: "CAPPATEX_SNAPSHOT_ID", value: "CPS-" + "a".repeat(32) }];
  order.line_items[0].requires_shipping = true; order.shipping_address = { country_code: "CH" };
  const writes = db.writes, networkCalls = calls.length;
  const response = await webhook(order); assert.equal(response.status, 200); assert.equal((await response.json()).status, "ignored_physical_order");
  assert.equal(db.writes, writes); assert.equal(calls.length, networkCalls); assert.equal(balance(), 4);
  order.note_attributes.push({ name: "AB3D_TOKEN_BROKEN", value: "invalid" }); assert.equal((await webhook(order)).status, 409);
  order.note_attributes = []; order.line_items[0].properties.push({ name: "_AB3D_TOKEN_PURCHASE_ID", value: "invalid" });
  assert.equal((await webhook(order)).status, 409); assert.equal(rows("token_purchase_receipts").length, 0);
  order.line_items[0].properties.pop(); process.env.TOKEN_PURCHASES_ENABLED = "false"; runtime.releases.length = 0;
  assert.equal((await webhook(order)).status, 200, "An irrelevant signed physical delivery remains a no-op when new token sales are closed");
});

test("physical fulfillment acknowledges pure signed digital token orders without recording shipping or invoking Printify", async () => {
  const preparedPurchase = await prepared(), order = paid(preparedPurchase), writes = db.writes, networkCalls = calls.length;
  const response = await physicalWebhook(order); assert.equal(response.status, 200); assert.equal((await response.json()).status, "ignored_digital_token_order");
  assert.equal(db.writes, writes); assert.equal(calls.length, networkCalls); assert.equal(rows("shopify_orders").length, 0); assert.equal(rows("cappatex_fulfillments").length, 0); assert.equal(balance(), 4);
  order.line_items[0].properties.push({ name: "CAPPATEX_SNAPSHOT_ID", value: "CPS-" + "a".repeat(32) });
  assert.equal((await physicalWebhook(order)).status, 400);
  order.line_items[0].properties.pop(); order.line_items[0].requires_shipping = true;
  assert.equal((await physicalWebhook(order)).status, 400);
  order.line_items[0].requires_shipping = false; order.line_items[0].variant_id = CAPPATEX_PRINT_PROFILES[0].variants[0].shopifyVariantId.split("/").at(-1);
  assert.equal((await physicalWebhook(order)).status, 400); assert.equal(db.writes, writes); assert.equal(balance(), 4);
});

test("only an exact, paid, real and unmodified digital order can credit the frozen token amount", async () => {
  const preparedPurchase = await prepared();
  const mutations = [o => { o.financial_status = "pending"; }, o => { o.financial_status = "partially_paid"; }, o => { o.test = true; },
    o => { o.cancelled_at = "2026-01-02T00:00:00Z"; }, o => { o.email = other; }, o => { o.contact_email = other; },
    o => { o.currency = "EUR"; }, o => { o.presentment_currency = "EUR"; }, o => { o.billing_address.country_code = "DE"; },
    o => { o.billing_address.country_code = "LI"; }, o => { delete o.billing_address; }, o => { o.total_price = "4.99"; },
    o => { o.current_total_price = "4.00"; }, o => { o.total_discounts = "1.00"; }, o => { o.current_total_discounts = "1.00"; },
    o => { o.total_outstanding = "1.00"; }, o => { o.refunds.push({ id: 1 }); }, o => { o.taxes_included = false; },
    o => { o.shipping_lines.push({ price: "0.00" }); }, o => { o.total_shipping_price_set.shop_money.amount = "1.00"; },
    o => { o.admin_graphql_api_id = "gid://shopify/Order/9999"; }, o => { o.line_items[0].variant_id = 9999; },
    o => { o.line_items[0].sku = "wrong"; }, o => { o.line_items[0].quantity = 2; }, o => { o.line_items[0].current_quantity = 0; },
    o => { o.line_items[0].requires_shipping = true; }, o => { o.line_items[0].gift_card = true; }, o => { o.line_items[0].price = "1.00"; },
    o => { o.line_items[0].discount_allocations.push({ amount: "0.00" }); }, o => { o.line_items[0].selling_plan_allocation = { id: "plan" }; },
    o => { o.line_items.push(structuredClone(o.line_items[0])); }, o => { o.line_items[0].properties.push(structuredClone(o.line_items[0].properties[0])); },
    o => { o.line_items[0].properties[1].value = "a".repeat(64); }, o => { o.line_items[0].properties[2].value = "tokens-40"; },
    o => { o.note_attributes[0].value = "TP-" + "0".repeat(32); }, o => { o.note_attributes.push(structuredClone(o.note_attributes[0])); },
    o => { o.line_items[0].properties.push({ name: "AB3D_TOKEN_COUNT", value: "999999" }); }];
  for (const mutation of mutations) { const order = paid(preparedPurchase); mutation(order); assert.equal((await webhook(order)).status, 409, mutation.toString()); }
  assert.equal(balance(), 4); assert.equal(rows("token_ledger").length, 0); assert.equal(rows("token_purchase_events").length, 0);
  assert.equal((await webhook(paid(preparedPurchase))).status, 200); assert.equal(balance(), 9);
});

test("paid receipts are atomic and exactly once across repeated events, delivery IDs and concurrent requests", async () => {
  const preparedPurchase = await prepared({ packId: "tokens-40", country: "LI" }), order = paid(preparedPurchase), eventId = crypto.randomUUID();
  const responses = await Promise.all([webhook(order, { "x-shopify-event-id": eventId }), webhook(order, { "x-shopify-event-id": eventId }), webhook(order)]);
  assert.ok(responses.every(response => response.status === 200)); assert.equal(balance(), 44);
  assert.equal(rows("token_purchase_receipts").length, 1); assert.equal(rows("token_ledger").length, 1);
  assert.equal(rows("token_ledger")[0].delta, 40); assert.equal(rows("token_ledger")[0].task_id, preparedPurchase.snapshot.id);
  assert.equal(rows()[0].status, "credited"); assert.equal(rows()[0].order_key, `${domain}:12345`);
  const changedDelivery = paid(preparedPurchase, { id: 99999, admin_graphql_api_id: "gid://shopify/Order/99999" });
  assert.equal((await webhook(changedDelivery)).status, 409); assert.equal(balance(), 44);
});

test("one paid order cannot be rebound to another purchase or account", async () => {
  const first = await prepared(); assert.equal((await webhook(paid(first))).status, 200);
  runtime.actor = other; const second = await prepared({ packId: "tokens-15" });
  assert.equal((await webhook(paid(second))).status, 409); assert.equal(balance(), 9); assert.equal(balance(other), 4); assert.equal(rows("token_ledger").length, 1);
});

test("one event ID cannot be reused with a different signed body and cannot suppress a later legitimate payment", async () => {
  const first = await prepared(), eventId = crypto.randomUUID();
  assert.equal((await webhook(paid(first), { "x-shopify-event-id": eventId })).status, 200);
  const second = await prepared({ packId: "tokens-15" }), secondOrder = paid(second, { id: 23456, admin_graphql_api_id: "gid://shopify/Order/23456" });
  assert.equal((await webhook(secondOrder, { "x-shopify-event-id": eventId })).status, 409); assert.equal(balance(), 9);
  assert.equal((await webhook(secondOrder)).status, 200); assert.equal(balance(), 24);
});

test("existing paid checkouts honor their frozen prices and terms when new sales close or the current catalogue changes", async () => {
  const preparedPurchase = await prepared(), order = paid(preparedPurchase);
  process.env.TOKEN_PURCHASES_ENABLED = "false"; runtime.releases[0].version = "offline-v2"; runtime.releases.length = 0;
  TOKEN_PACKS[0].priceCents = 600; TOKEN_PACKS[0].tokens = 6; updateLegalFixture("2026-10-21");
  assert.equal((await checkout()).status, 503); assert.equal((await (await GET()).json()).enabled, false);
  assert.equal((await webhook(order)).status, 200); assert.equal(balance(), 9); assert.equal(rows("token_ledger")[0].delta, 5);
  assert.equal((await webhook(order)).status, 200); assert.equal(balance(), 9);
  assert.equal(JSON.parse(rows()[0].snapshot_json).priceCents, 500); assert.equal(JSON.parse(rows()[0].snapshot_json).legalVersion, "2026-08-19");
});

test("missing receipt secret, nonexistent purchases or a corrupted immutable snapshot cannot mint tokens", async () => {
  const preparedPurchase = await prepared(), order = paid(preparedPurchase);
  delete process.env.SHOPIFY_WEBHOOK_SECRET; assert.equal((await webhook(order)).status, 503); process.env.SHOPIFY_WEBHOOK_SECRET = secret;
  const unknown = paid(preparedPurchase); unknown.line_items[0].properties[0].value = "TP-" + "f".repeat(32);
  unknown.note_attributes[0].value = unknown.line_items[0].properties[0].value; assert.equal((await webhook(unknown)).status, 409);
  db.db.exec("DROP TRIGGER token_purchase_snapshot_immutable");
  db.db.prepare("UPDATE token_purchases SET snapshot_sha256=? WHERE id=?").run("0".repeat(64), preparedPurchase.snapshot.id);
  assert.equal((await webhook(order)).status, 409); assert.equal(balance(), 4); assert.equal(rows("token_ledger").length, 0);
});

test("a SQLite failure after the balance update rolls back receipt, balance and ledger before a safe redelivery", async () => {
  const preparedPurchase = await prepared(), order = paid(preparedPurchase), eventId = crypto.randomUUID();
  db.failBatchAt = 3; assert.equal((await webhook(order, { "x-shopify-event-id": eventId })).status, 503);
  assert.equal(balance(), 4); assert.equal(rows("token_purchase_events").length, 0); assert.equal(rows("token_purchase_receipts").length, 0);
  assert.equal(rows("token_ledger").length, 0); assert.equal(rows()[0].status, "checkout_created");
  assert.equal((await webhook(order, { "x-shopify-event-id": eventId })).status, 200); assert.equal(balance(), 9); assert.equal(rows("token_ledger").length, 1);
});

test("unlimited test accounts still receive purchased credit exactly once and keep their plan unchanged", async () => {
  process.env.AB3D_UNLIMITED_EMAILS = actor; const preparedPurchase = await prepared({ packId: "tokens-15" }), order = paid(preparedPurchase);
  assert.equal((await webhook(order)).status, 200); assert.equal((await webhook(order)).status, 200); assert.equal(balance(), 19);
  const account = db.db.prepare("SELECT plan,subscription_status FROM accounts WHERE email=?").get(actor);
  assert.equal(account.plan, "free"); assert.equal(account.subscription_status, "inactive"); assert.equal(rows("token_ledger").length, 1);
});
