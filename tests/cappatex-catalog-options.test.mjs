import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

// All profiles and catalog responses here are synthetic. No production approval or live API call is made.
const fixture = { profiles: [] };
globalThis.__catalogOptionsOffline = fixture;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (/(?:^|\/)cappatex-profiles(?:\.ts)?$/.test(specifier)) return { url: "option-fixture:profiles", shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    return url === "option-fixture:profiles" ? { format: "module", source: "export const CAPPATEX_PRINT_PROFILES=globalThis.__catalogOptionsOffline.profiles;", shortCircuit: true } : next(url, context);
  },
});
const { verifiedCatalog } = await import("../app/cappatex-verified-catalog.ts");
const { fetchShopifyCollection, shopifyVariantOption } = await import("../app/shopify-catalog.ts");
const oldFetch = globalThis.fetch, oldEnv = { ...process.env };
const envNames = ["PRINTIFY_SHOP_ID", "PRINTIFY_API_TOKEN", "PRINTIFY_CATALOG_API_TOKEN", "SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_ACCESS_TOKEN"];
const productId = "gid://shopify/Product/303", variantId = "gid://shopify/ProductVariant/202";
let selectedOptions, providerOptions, requests, priceAmount, currencyCode;
const makeProfile = (optionKey = "paper", value = "Matte") => ({
  id: "offline-options-only", version: "fixture-v1", verifiedAt: "2020-01-01T00:00:00Z", validUntil: "2100-01-01T00:00:00Z",
  shopId: "fixture-shop", printifyProductId: "fixture-blank", blueprintId: 301, providerId: 401, shopifyProductId: productId,
  kind: "accessory", optionKey, name: "Synthetic catalog fixture — never publish", evidence: ["Offline fixture only"],
  fulfillment: { route: "ab3d-api", nativeImportUnlinked: true, manualApproval: true },
  variants: [{ printifyVariantId: 101, shopifyVariantId: variantId, sku: "OFFLINE-PAPER-A4", color: value, size: "A4",
    area: { position: "front", decorationMethod: "digital-printing", widthPx: 600, heightPx: 800, widthMm: 50.8, heightMm: 50.8 * 800 / 600, minDpi: 300, minScale: .1, maxScale: 1 },
    mockup: { url: "https://fixture.example.test/blank.jpg", width: 1000, height: 1000, left: 100, top: 100, printWidth: 300, printHeight: 400 },
    shipping: ["CH", "LI"].map(country => ({ country, method: 1, currency: "USD", firstCents: 849, additionalCents: 199 })),
  }],
});
function storefront() {
  return { data: { collection: { id: "gid://shopify/Collection/1", handle: "cappatex-selbst-gestalten", title: "Offline catalog",
    products: { pageInfo: { hasNextPage: false }, nodes: [{ id: productId, handle: "offline-poster", title: "Offline poster",
      variants: { pageInfo: { hasNextPage: false }, nodes: [{ id: variantId, sku: "OFFLINE-PAPER-A4", title: "Matte / A4", availableForSale: true,
        price: { amount: priceAmount, currencyCode }, ...(selectedOptions === undefined ? {} : { selectedOptions }) }] } }] } } } };
}
beforeEach(() => {
  fixture.profiles.splice(0, fixture.profiles.length, makeProfile());
  selectedOptions = [{ name: "Paper", value: "Matte" }, { name: "Size", value: "A4" }];
  providerOptions = { paper: "Matte", size: "A4" }; requests = [];
  priceAmount = "30.00";
  currencyCode = "CHF";
  Object.assign(process.env, { PRINTIFY_SHOP_ID: "fixture-shop", PRINTIFY_API_TOKEN: "offline-placeholder", PRINTIFY_CATALOG_API_TOKEN: "", SHOPIFY_STORE_DOMAIN: "option-fixture.myshopify.com", SHOPIFY_STOREFRONT_ACCESS_TOKEN: "" });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input); requests.push({ url: url.href, method: init.method || "GET" });
    if (url.origin === "https://option-fixture.myshopify.com") {
      assert.equal(init.method, "POST");
      assert.match(JSON.parse(init.body).query, /query Ab3dCollectionCatalog/);
      return Response.json(storefront());
    }
    assert.equal(url.origin, "https://api.printify.com", "No live network is allowed"); assert.equal(init.method || "GET", "GET");
    if (url.pathname === "/v1/shops/fixture-shop/products.json") return Response.json({ last_page: 1, data: [{ id: "fixture-blank", blueprint_id: 301, print_provider_id: 401,
      variants: [{ id: 101, sku: "OFFLINE-PAPER-A4", is_enabled: true, is_available: true }] }] });
    if (url.pathname.endsWith("/variants.json")) return Response.json({ variants: [{ id: 101, options: providerOptions,
      placeholders: [{ position: "front", decoration_method: "digital-printing", width: 600, height: 800 }] }] });
    if (url.pathname.endsWith("/shipping.json")) return Response.json({ profiles: [{ variant_ids: [101], countries: ["CH", "LI"],
      first_item: { currency: "USD", cost: 849 }, additional_items: { currency: "USD", cost: 199 } }] });
    throw new Error(`Unexpected offline catalog endpoint: ${url.pathname}`);
  };
});
afterEach(() => {
  globalThis.fetch = oldFetch;
  for (const name of envNames) { if (oldEnv[name] === undefined) delete process.env[name]; else process.env[name] = oldEnv[name]; }
});
after(() => { hooks.deregister(); delete globalThis.__catalogOptionsOffline; });

for (const name of ["Paper", "Papier"]) test(`poster maps its explicit ${name} option to provider.paper`, async () => {
  selectedOptions[0].name = name;
  const catalog = await verifiedCatalog(); assert.equal(catalog.length, 1); assert.equal(catalog[0].variants.length, 1);
  assert.equal(catalog[0].variants[0].color, "Matte"); assert.equal(catalog[0].variants[0].shopifyVariantId, variantId);
});

for (const name of ["Surface", "Oberfläche"]) test(`surface product maps its explicit ${name} option to provider.surface`, async () => {
  fixture.profiles[0] = makeProfile("surface", "Glossy");
  selectedOptions[0] = { name, value: "Glossy" }; providerOptions = { surface: "Glossy", size: "A4" };
  assert.equal((await verifiedCatalog()).length, 1);
});

test("the raw Shopify option names and values survive normalization exactly", async () => {
  selectedOptions.push({ name: "Color", value: "  White  " });
  const catalog = await fetchShopifyCollection("cappatex-selbst-gestalten");
  assert.deepEqual(catalog.products[0].variants[0].selectedOptions, selectedOptions);
  assert.equal(shopifyVariantOption(catalog.products[0].variants[0], "color"), "  White  ");
  assert.equal(shopifyVariantOption(catalog.products[0].variants[0], "paper"), "Matte");
});

for (const issue of ["missing Shopify paper", "wrong Shopify paper", "color masquerading as paper", "duplicate paper", "duplicate translated paper", "missing provider paper", "wrong provider paper", "provider color masquerading as paper", "missing size", "duplicate size"]) test(`sales mapping rejects ${issue} without choosing a fallback`, async () => {
  if (issue === "missing Shopify paper") selectedOptions.shift();
  if (issue === "wrong Shopify paper") selectedOptions[0].value = "Glossy";
  if (issue === "color masquerading as paper") selectedOptions[0].name = "Color";
  if (issue === "duplicate paper") selectedOptions.push({ name: "Paper", value: "Matte" });
  if (issue === "duplicate translated paper") selectedOptions.push({ name: "Papier", value: "Matte" });
  if (issue === "missing provider paper") delete providerOptions.paper;
  if (issue === "wrong provider paper") providerOptions.paper = "Glossy";
  if (issue === "provider color masquerading as paper") providerOptions = { color: "Matte", size: "A4" };
  if (issue === "missing size") selectedOptions.pop();
  if (issue === "duplicate size") selectedOptions.push({ name: "Size", value: "A4" });
  assert.deepEqual(await verifiedCatalog(), []);
});

test("standard clothing still requires its exact color and size options", async () => {
  fixture.profiles[0] = makeProfile(undefined, "White"); delete fixture.profiles[0].optionKey;
  selectedOptions[0] = { name: "Color", value: "White" }; providerOptions = { color: "White", size: "A4" };
  assert.equal((await verifiedCatalog()).length, 1);
  selectedOptions[0] = { name: "Paper", value: "White" };
  assert.deepEqual(await verifiedCatalog(), []);
});

test("absent or malformed Shopify selectedOptions never approve a Standard display fallback", async () => {
  for (const options of [undefined, [], [{ name: "Paper", value: null }], [{ name: "Paper", value: "" }], [{ name: "Paper", value: "Matte " }, { name: "Size", value: "A4" }]]) {
    selectedOptions = options; assert.deepEqual(await verifiedCatalog(), []);
  }
});

test("paper support grants no native-import, production or sales approval", async () => {
  fixture.profiles[0].fulfillment.nativeImportUnlinked = false;
  assert.deepEqual(await verifiedCatalog(), []); assert.equal(requests.length, 0);
  fixture.profiles.length = 0;
  assert.deepEqual(await verifiedCatalog(), []); assert.equal(requests.length, 0);
});

for (const amount of ["19.90", "19.9000", "19.9", "19", "0.01"]) test(`Shopify MoneyV2 preserves the exact valid amount ${amount} through sales validation`, async () => {
  priceAmount = amount;
  const normalized = (await fetchShopifyCollection("cappatex-selbst-gestalten")).products[0].variants[0];
  assert.equal(normalized.priceAmount, amount);
  assert.equal(normalized.price, Number(amount), "Existing display-price consumers remain compatible");
  const sales = await verifiedCatalog(); assert.equal(sales.length, 1);
  assert.deepEqual(sales[0].variants[0].price, { amount, currencyCode: "CHF" });
});

for (const amount of ["19.901", "19.9001", "NaN", "Infinity", "-Infinity", "1e2", " 19.90 ", "", "-1.00", "19.", "19,90", "9007199254740992", 19.9, null, undefined]) test(`invalid or fractional-cent MoneyV2 amount cannot become a rounded sales approval: ${String(amount)}`, async () => {
  priceAmount = amount;
  assert.deepEqual(await verifiedCatalog(), []);
});

for (const code of [undefined, null, "", "chf", "CH", "CHFF", " CHF", "CHF ", 756]) test(`missing or malformed MoneyV2 currency cannot become an invented CHF approval: ${String(code)}`, async () => {
  currencyCode = code;
  assert.deepEqual((await fetchShopifyCollection("cappatex-selbst-gestalten")).products, []);
  assert.deepEqual(await verifiedCatalog(), []);
});

for (const code of ["CHF", "EUR", "USD", "JPY"]) test(`normalization preserves the original valid MoneyV2 currency ${code}`, async () => {
  currencyCode = code;
  const normalized = (await fetchShopifyCollection("cappatex-selbst-gestalten")).products[0];
  assert.equal(normalized.currency, code); assert.equal(normalized.variants[0].currency, code);
  assert.equal((await verifiedCatalog())[0].variants[0].price.currencyCode, code);
});
