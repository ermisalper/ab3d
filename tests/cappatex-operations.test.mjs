import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";

const owner = "operator@example.test", other = "customer@example.test";
const runtime = { env: {}, actor: owner };
globalThis.__cappatexOperationsOffline = runtime;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (["cloudflare:workers", "next/headers", "next/navigation"].includes(specifier))
      return { url: `operations-fixture:${specifier}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    const source = {
      "operations-fixture:cloudflare:workers": "export const env = globalThis.__cappatexOperationsOffline.env;",
      "operations-fixture:next/headers": "export async function headers(){return new Headers(globalThis.__cappatexOperationsOffline.actor?{'oai-authenticated-user-email':globalThis.__cappatexOperationsOffline.actor}:{});}",
      "operations-fixture:next/navigation": "export function redirect(){throw new Error('Unexpected redirect');}",
    }[url];
    return source ? { format: "module", source, shortCircuit: true } : next(url, context);
  },
});
const api = await import("../app/api/cappatex/operations/route.ts");
const { fulfillmentSummary } = await import("../app/cappatex-operations.ts");

class ReadOnlyD1 {
  queries = [];
  writeAttempts = 0;
  failReads = false;
  constructor() {
    this.db = new DatabaseSync(":memory:");
    for (const name of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort())
      this.db.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  prepare(sql) {
    this.queries.push(sql);
    if (!/^SELECT\s/i.test(sql.trim())) { this.writeAttempts++; throw new Error("Dashboard attempted to write"); }
    if (this.failReads) throw new Error("Sensitive fixture database failure: hidden@example.test/private-artwork");
    return {
      all: async () => ({ success: true, results: this.db.prepare(sql).all().map(row => ({ ...row })) }),
      run: async () => { this.writeAttempts++; throw new Error("Dashboard attempted to write"); },
    };
  }
  async batch() { this.writeAttempts++; throw new Error("Dashboard attempted to batch-write"); }
}
const variables = ["CAPPATEX_GENERATION_ALLOWED_EMAILS", "CAPPATEX_GENERATION_AUDIENCE", "AB3D_OWNER_EMAILS",
  "CAPPATEX_CHECKOUT_ENABLED", "CAPPATEX_FULFILLMENT_ENABLED", "CAPPATEX_AUTO_PRODUCTION_ENABLED", "SHOPIFY_WEBHOOK_SECRET", "SHOPIFY_STORE_DOMAIN", "TOKEN_PURCHASES_ENABLED"];
const previous = Object.fromEntries(variables.map(key => [key, process.env[key]]));
const priorFetch = globalThis.fetch;
let database, networkCalls;
beforeEach(() => {
  database = new ReadOnlyD1(); runtime.env.DB = database; runtime.actor = owner; networkCalls = 0;
  Object.assign(process.env, { CAPPATEX_GENERATION_ALLOWED_EMAILS: owner, CAPPATEX_GENERATION_AUDIENCE: "subscribers",
    AB3D_OWNER_EMAILS: other, CAPPATEX_CHECKOUT_ENABLED: "false", CAPPATEX_FULFILLMENT_ENABLED: "false", CAPPATEX_AUTO_PRODUCTION_ENABLED: "false",
    SHOPIFY_WEBHOOK_SECRET: "offline-webhook-secret-never-expose", SHOPIFY_STORE_DOMAIN: "fixture-shop.myshopify.com", TOKEN_PURCHASES_ENABLED: "false" });
  runtime.env.BUCKET = new Proxy({}, { get() { throw new Error("Dashboard must not access artwork storage"); } });
  globalThis.fetch = async () => { networkCalls++; throw new Error("Live network prohibited in operations tests"); };
});
afterEach(() => {
  assert.equal(database.writeAttempts, 0, "Dashboard must not write or dispatch orders");
  assert.equal(networkCalls, 0, "Dashboard must not call Shopify, Printify or another external API");
  database.db.close(); globalThis.fetch = priorFetch;
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
after(() => { hooks.deregister(); delete globalThis.__cappatexOperationsOffline; });

function add(id, state = "pending", updated = 1000, extra = {}) {
  database.db.prepare("INSERT INTO cappatex_fulfillments(id,external_id,input_sha256,request_sha256,state,printify_order_id,error_code,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, `ab3d-${id}`, "hidden@example.test/customer-order-payload", "private/artwork/file.png", state,
      extra.printifyOrderId || null, extra.errorCode || null, updated - 100, updated);
}
function privateHeaders(response) {
  assert.match(response.headers.get("cache-control"), /private/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}
function row(state, updated, error = null) {
  return { id: "order-fixture", external_id: "ab3d-fixture", state, printify_order_id: null,
    error_code: error, created_at: 0, updated_at: updated };
}

test("operations denies anonymous and nonallowlisted users before any database read", async () => {
  for (const actor of [null, other, `prefix-${owner}`, `${owner}.attacker.test`]) {
    runtime.actor = actor;
    const response = await api.GET(); assert.equal(response.status, 403); privateHeaders(response);
    assert.deepEqual(await response.json(), { error: "Keine Berechtigung." });
  }
  assert.equal(database.queries.length, 0);
});

test("operations fails closed with missing owner allowlist despite subscriber audience or other owner settings", async () => {
  for (const allowlist of ["", " ", other, `${other}, ${owner}.attacker.test`]) {
    process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS = allowlist;
    const response = await api.GET(); assert.equal(response.status, 403); privateHeaders(response);
  }
  assert.equal(database.queries.length, 0);
  process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS = ` ${other}, OPERATOR@EXAMPLE.TEST `;
  assert.equal((await api.GET()).status, 200);
});

test("owner response contains only operational metadata, generic reasons and boolean configuration", async () => {
  add("private-fixture", "manual_review", 1000, { printifyOrderId: "printify-fixture-123", errorCode: "secret-customer-address-or-provider-error" });
  const before = database.db.prepare("SELECT * FROM cappatex_fulfillments").all();
  const response = await api.GET(); assert.equal(response.status, 200); privateHeaders(response);
  const result = await response.json();
  assert.deepEqual(Object.keys(result).sort(), ["checkedAt", "configuration", "counts", "limit", "orders", "readiness"]);
  assert.deepEqual(Object.keys(result.orders[0]).sort(), ["createdAt", "id", "label", "needsReview", "printifyOrderId", "reason", "reference", "stalled", "state", "updatedAt"]);
  assert.equal(result.orders[0].reason, "Weitere Prüfung erforderlich.");
  assert.equal(result.orders[0].printifyOrderId, "printify-fixture-123");
  assert.equal(result.orders[0].needsReview, true);
  assert.equal(result.configuration.checkoutEnabled, false); assert.equal(result.configuration.fulfillmentEnabled, false);
  assert.equal(result.configuration.automaticProductionRequested, false); assert.equal(result.configuration.productionWritePermissions, "unverified");
  assert.equal(result.configuration.webhookConfigured, true);
  assert.equal(typeof result.configuration.registeredProfiles, "number");
  assert.equal(result.configuration.registeredShippingReleases, 0);
  assert.equal(result.configuration.tokenPurchasesRequested, false);
  assert.equal(result.configuration.registeredTokenPackReleases, 0);
  assert.equal(result.readiness.checkedAt, result.checkedAt);
  assert.equal(result.readiness.externalChecksPerformed, false);
  assert.ok(Number.isSafeInteger(result.checkedAt));
  const serialized = JSON.stringify(result);
  for (const hidden of ["hidden@example.test", "private/artwork", "secret-customer", "offline-webhook-secret", "fixture-shop.myshopify.com", "payload_json", "input_sha256", "request_sha256"])
    assert.ok(!serialized.includes(hidden), `Response leaked ${hidden}`);
  assert.deepEqual(database.db.prepare("SELECT * FROM cappatex_fulfillments").all(), before);
  assert.equal(database.queries.length, 2);
  assert.ok(database.queries.every(sql => !/SELECT\s+\*|JOIN|payload_json|email|address|artwork|input_sha256|request_sha256/i.test(sql)));
});

test("latest order list is bounded and counts include older records without mutation", async () => {
  for (let i = 0; i < 53; i++) add(`order-${String(i).padStart(2, "0")}`, i % 2 ? "manual_review" : "pending", 1000 + i);
  const result = await (await api.GET()).json();
  assert.equal(result.limit, 50); assert.equal(result.orders.length, 50);
  assert.equal(result.orders[0].id, "order-52"); assert.equal(result.orders.at(-1).id, "order-03");
  assert.equal(result.counts.reduce((sum, count) => sum + count.total, 0), 53);
  assert.equal(database.db.prepare("SELECT COUNT(*) n FROM cappatex_fulfillments").get().n, 53);
});

test("configuration flags are exact, report production risk and never imply verified write rights", async () => {
  Object.assign(process.env, { CAPPATEX_CHECKOUT_ENABLED: "true", CAPPATEX_FULFILLMENT_ENABLED: "true", CAPPATEX_AUTO_PRODUCTION_ENABLED: "true", TOKEN_PURCHASES_ENABLED: "true" });
  const result = await (await api.GET()).json();
  let config = result.configuration;
  assert.equal(config.checkoutEnabled, true); assert.equal(config.fulfillmentEnabled, true); assert.equal(config.automaticProductionRequested, true);
  assert.equal(config.productionWritePermissions, "unverified");
  assert.equal(config.tokenPurchasesRequested, true);
  assert.equal(result.readiness.rows.find(row => row.id === "webhook-delivery").status, "ungeprueft");
  for (const id of ["token-variants", "sales-prices", "customer-shipping", "required-labels"])
    assert.equal(result.readiness.rows.find(row => row.id === id).status, "blockiert", "Flags and a secret must never be promoted to live approval");
  Object.assign(process.env, { CAPPATEX_CHECKOUT_ENABLED: "TRUE", CAPPATEX_FULFILLMENT_ENABLED: "1", CAPPATEX_AUTO_PRODUCTION_ENABLED: " true ", SHOPIFY_WEBHOOK_SECRET: " ", TOKEN_PURCHASES_ENABLED: "TRUE" });
  config = (await (await api.GET()).json()).configuration;
  assert.equal(config.checkoutEnabled, false); assert.equal(config.fulfillmentEnabled, false); assert.equal(config.automaticProductionRequested, false);
  assert.equal(config.webhookConfigured, false);
  assert.equal(config.tokenPurchasesRequested, false);
  assert.equal(api.POST, undefined); assert.equal(api.PATCH, undefined); assert.equal(api.DELETE, undefined);
});

test("database failures return an uncached generic unavailable response without internal details", async () => {
  database.failReads = true;
  const response = await api.GET(); assert.equal(response.status, 503); privateHeaders(response);
  const result = await response.json();
  assert.deepEqual(result, { error: "Die Betreiberübersicht ist vorübergehend nicht verfügbar." });
  assert.ok(!JSON.stringify(result).includes("hidden@example.test"));
});

test("uncertain creation is always reviewable, while stale preparation and creation use the exact 15-minute boundary", () => {
  const now = 2_000_000, boundary = 15 * 60_000;
  assert.equal(fulfillmentSummary(row("creating", now), now).needsReview, true);
  assert.equal(fulfillmentSummary(row("creating", now), now).stalled, false);
  for (const state of ["preparing", "creating"]) {
    assert.equal(fulfillmentSummary(row(state, now - boundary + 1), now).stalled, false);
    const result = fulfillmentSummary(row(state, now - boundary), now);
    assert.equal(result.stalled, true); assert.equal(result.needsReview, true);
  }
  assert.equal(fulfillmentSummary(row("preparing", now), now).needsReview, false);
  assert.equal(fulfillmentSummary(row("pending", 0), now).stalled, false);
  assert.equal(fulfillmentSummary(row("manual_review", now), now).needsReview, true);
  assert.equal(fulfillmentSummary(row("unexpected-provider-state", now), now).needsReview, true);
  assert.match(fulfillmentSummary(row("draft_ready", now), now).label, /Produktionsfreigabe manuell prüfen/);
  assert.equal(fulfillmentSummary(row("draft_ready", now), now).needsReview, true);
});

test("known review reasons are human-readable and unknown provider messages are not reflected", () => {
  for (const code of ["order_changed", "snapshot_already_consumed", "preparation_failed", "shipping_unapproved"])
    assert.ok(!fulfillmentSummary(row("manual_review", 0, code)).reason.includes(code));
  assert.equal(fulfillmentSummary(row("manual_review", 0, "private-error-payload")).reason, "Weitere Prüfung erforderlich.");
  assert.equal(fulfillmentSummary(row("pending", 0)).reason, null);
});
