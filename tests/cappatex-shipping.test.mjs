import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";

const runtimeKey = "__cappatexShippingOffline";
const runtime = { releases: [] };
globalThis[runtimeKey] = runtime;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/(?:^|\/)cappatex-shipping-releases(?:\.ts)?$/.test(specifier)) return { url: "shipping-offline:registry", shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const file = new URL(`${specifier}.ts`, context.parentURL); if (existsSync(file)) return nextResolve(file.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "shipping-offline:registry") return { format: "module", source: `export const CAPPATEX_SHIPPING_RELEASES=globalThis.${runtimeKey}.releases;`, shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { normalizedShippingBasket, shippingReleaseIsCurrent, shippingReleaseForBasket, shippingReleaseBinding,
  snapshotShippingReleaseIsCurrent, paidShippingMatchesRelease } = await import("../app/cappatex-shipping.ts");
const NOW = Date.parse("2026-10-17T12:00:00Z");
const DOMAIN = "shipping-offline.myshopify.com";
const shopId = "shipping-offline-shop";
const item = { profileId: "offline-profile", profileVersion: "offline-v1", shopifyVariantId: "gid://shopify/ProductVariant/1", quantity: 1 };
const originalNow = Date.now, originalFetch = globalThis.fetch;
const oldEnv = { SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN, PRINTIFY_SHOP_ID: process.env.PRINTIFY_SHOP_ID };
function release() {
  return { id: "OFFLINE-SHIPPING-1", version: "offline-v1", reviewedAt: "2026-10-17T11:00:00Z", validUntil: "2026-11-01T00:00:00Z",
    evidence: ["Synthetic offline evidence only; never publish as an actual tariff"], shopifyStoreDomain: DOMAIN, printifyShopId: shopId,
    country: "CH", currency: "CHF", printifyMethod: 1, service: { source: "shopify", code: "OFFLINE-STANDARD", title: "Offline Standard" },
    amountCents: 1990, basket: [{ ...item }] };
}
const money = amount => ({ shop_money: { amount, currency_code: "CHF" }, presentment_money: { amount, currency_code: "CHF" } });
function paid() {
  return { currency: "CHF", presentment_currency: "CHF", shipping_address: { country_code: "CH" },
    total_shipping_price_set: money("19.90"), current_shipping_price_set: money("19.90"),
    shipping_lines: [{ source: "shopify", code: "OFFLINE-STANDARD", title: "Offline Standard", is_removed: false,
      price: "19.90", discounted_price: "19.90", price_set: money("19.90"), discounted_price_set: money("19.90"),
      current_discounted_price_set: money("19.90"), discount_allocations: [] }] };
}
beforeEach(() => {
  runtime.releases.splice(0); Date.now = () => NOW;
  process.env.SHOPIFY_STORE_DOMAIN = DOMAIN; process.env.PRINTIFY_SHOP_ID = shopId;
  globalThis.fetch = async () => { throw Error("Network is prohibited in shipping release tests"); };
});
afterEach(() => {
  Date.now = originalNow; globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});
after(() => { hooks.deregister(); delete globalThis[runtimeKey]; });

test("production shipping registry remains empty and no missing release can authorize a basket", () => {
  assert.match(readFileSync(new URL("../app/cappatex-shipping-releases.ts", import.meta.url), "utf8"), /CAPPATEX_SHIPPING_RELEASES:\s*ShippingRelease\[\]\s*=\s*\[\]/);
  assert.equal(shippingReleaseForBasket([item], "CH"), null);
});

test("normalization merges identical identities only and preserves each profile/version/variant", () => {
  const other = { ...item, profileId: "other", shopifyVariantId: "gid://shopify/ProductVariant/2", quantity: 2 };
  const normalized = normalizedShippingBasket([other, item, { ...item, quantity: 3 }]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized.find(v => v.profileId === item.profileId).quantity, 4);
  assert.deepEqual(normalized, normalizedShippingBasket([{ ...item, quantity: 4 }, other]));
  assert.equal(normalizedShippingBasket([item, { ...item, profileVersion: "another" }]).length, 2);
  for (const invalid of [[], [null], [{ ...item, quantity: "1" }], [{ ...item, quantity: 0 }], [{ ...item, quantity: 1.5 }], [{ ...item, quantity: 101 }], [{ ...item, profileId: " " }], [{ ...item, shopifyVariantId: "wrong" }]])
    assert.throws(() => normalizedShippingBasket(invalid));
});

test("country, quantity and full basket require one exact current release, never summed component tariffs", () => {
  const approved = release(); runtime.releases.push(approved);
  assert.equal(shippingReleaseForBasket([item], "CH"), approved);
  assert.equal(shippingReleaseForBasket([item], "LI"), null);
  assert.equal(shippingReleaseForBasket([{ ...item, quantity: 2 }], "CH"), null);
  const other = { ...item, profileId: "another-provider", shopifyVariantId: "gid://shopify/ProductVariant/2" };
  runtime.releases.push({ ...structuredClone(approved), id: "OFFLINE-OTHER", basket: [other] });
  assert.equal(shippingReleaseForBasket([item, other], "CH"), null);
});

test("duplicate matching releases or reused ID/version never choose an arbitrary tariff", () => {
  const approved = release(); runtime.releases.push(approved, { ...structuredClone(approved), id: "OFFLINE-SECOND" });
  assert.equal(shippingReleaseForBasket([item], "CH"), null);
  runtime.releases[1].country = "LI"; runtime.releases[1].id = approved.id;
  assert.equal(shippingReleaseForBasket([item], "CH"), null);
});

test("incomplete, expired, future, mismatched-store and non-CHF releases fail closed", () => {
  assert.equal(shippingReleaseIsCurrent(release()), true);
  for (const mutate of [
    r => { r.evidence = []; }, r => { r.evidence = [""]; }, r => { r.id = ""; }, r => { r.version = ""; },
    r => { r.reviewedAt = "2026-10-18T00:00:00Z"; }, r => { r.validUntil = "2026-10-17T12:00:00Z"; },
    r => { r.validUntil = "invalid"; }, r => { r.shopifyStoreDomain = "other.myshopify.com"; }, r => { r.printifyShopId = "other"; },
    r => { delete r.shopifyStoreDomain; }, r => { delete r.printifyShopId; }, r => { r.currency = "USD"; },
    r => { r.country = "US"; }, r => { r.printifyMethod = 2; }, r => { r.amountCents = 1.5; }, r => { r.amountCents = -1; },
    r => { r.service = null; }, r => { delete r.service.code; }, r => { r.service.title = ""; }, r => { r.basket.push({ ...item }); },
  ]) { const changed = release(); mutate(changed); assert.equal(shippingReleaseIsCurrent(changed), false); }
  const absent = release(); delete absent.shopifyStoreDomain; delete absent.printifyShopId;
  delete process.env.SHOPIFY_STORE_DOMAIN; delete process.env.PRINTIFY_SHOP_ID;
  assert.equal(shippingReleaseIsCurrent(absent), false, "Two missing identities must never compare as verified");
});

test("snapshot binding fingerprints evidence, service, price, basket and validity without mutating historical data", async () => {
  const approved = release(); runtime.releases.push(approved); const binding = await shippingReleaseBinding(approved);
  const snapshot = { profile: { id: item.profileId, version: item.profileVersion }, variant: { shopifyVariantId: item.shopifyVariantId }, quantity: 1, country: "CH", shippingRelease: binding };
  assert.equal(await snapshotShippingReleaseIsCurrent(snapshot), true);
  const historical = { ...snapshot }; delete historical.shippingRelease;
  assert.equal(await snapshotShippingReleaseIsCurrent(historical), false); assert.equal(historical.shippingRelease, undefined);
  for (const mutate of [r => { r.evidence.push("revised proof"); }, r => { r.service.title += " revised"; }, r => { r.amountCents++; },
    r => { r.validUntil = "2026-11-02T00:00:00Z"; }, r => { r.basket[0].quantity++; }]) {
    const changed = release(); mutate(changed);
    assert.notEqual((await shippingReleaseBinding(changed)).sha256, binding.sha256);
    runtime.releases.splice(0, runtime.releases.length, changed);
    assert.equal(await snapshotShippingReleaseIsCurrent(snapshot), false);
  }
});

test("one exact active CHF service accepts decimal text, explicit null codes and an explicitly approved zero tariff", () => {
  assert.equal(paidShippingMatchesRelease(paid(), release()), true);
  const nullable = release(), nullableOrder = paid(); nullable.service.code = null; nullableOrder.shipping_lines[0].code = null;
  assert.equal(paidShippingMatchesRelease(nullableOrder, nullable), true);
  const zero = release(), zeroOrder = paid(); zero.amountCents = 0;
  zeroOrder.total_shipping_price_set = money("0.00"); zeroOrder.current_shipping_price_set = money("0.00");
  Object.assign(zeroOrder.shipping_lines[0], { price: "0.00", discounted_price: "0.00", price_set: money("0.00"), discounted_price_set: money("0.00"), current_discounted_price_set: money("0.00") });
  assert.equal(paidShippingMatchesRelease(zeroOrder, zero), true);
});

test("missing, removed, malformed or duplicate shipping services cannot become a production order", () => {
  for (const mutate of [
    o => { delete o.shipping_lines; }, o => { o.shipping_lines = []; }, o => { o.shipping_lines.push(structuredClone(o.shipping_lines[0])); },
    o => { o.shipping_lines[0] = null; }, o => { o.shipping_lines[0].discount_allocations = [null]; },
    o => { o.shipping_lines[0].is_removed = true; }, o => { delete o.shipping_lines[0].is_removed; },
    o => { o.shipping_lines[0].code = "EXPRESS"; }, o => { o.shipping_lines[0].source = "other"; }, o => { o.shipping_lines[0].title = "Express"; },
    o => { o.presentment_currency = "EUR"; }, o => { delete o.presentment_currency; }, o => { o.currency = "USD"; },
    o => { o.shipping_address.country_code = "LI"; }, o => { o.shipping_lines[0].discount_allocations = [{ amount: "0.01" }]; },
    o => { o.shipping_lines[0].discount_allocations = null; }, o => { o.shipping_lines[0].price = "19.901"; },
    o => { o.shipping_lines[0].discounted_price = "0.00"; },
  ]) { const changed = paid(); mutate(changed); assert.equal(paidShippingMatchesRelease(changed, release()), false); }
});

test("every original, discounted, current and order-level money bag must match in both currencies", () => {
  for (const field of ["price_set", "discounted_price_set", "current_discounted_price_set", "total_shipping_price_set", "current_shipping_price_set"]) {
    for (const branch of ["shop_money", "presentment_money"]) for (const changedValue of ["amount", "currency_code", "missing bag", "missing branch"]) {
      const changed = paid(), owner = field.endsWith("shipping_price_set") ? changed : changed.shipping_lines[0];
      if (changedValue === "amount") owner[field][branch].amount = "19.89";
      if (changedValue === "currency_code") owner[field][branch].currency_code = "USD";
      if (changedValue === "missing bag") delete owner[field];
      if (changedValue === "missing branch") delete owner[field][branch];
      assert.equal(paidShippingMatchesRelease(changed, release()), false, `${field}/${branch}/${changedValue}`);
    }
  }
});
