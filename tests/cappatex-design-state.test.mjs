import assert from "node:assert/strict";
import test from "node:test";
import { readDesignState, designStateUrl, retainedPlacement, verifiedDesignSelection, rememberConfiguration, rememberedConfiguration, reconcileConfigurations } from "../app/cappatex-design-state.ts";
import { initialPlacement, placementGeometry } from "../app/cappatex-print-profile.ts";

test("reload preserves the owned design reference and exact product configuration without another generation", () => {
  const state = { designId: "CPX-A3EBF595EF42", profileId: "gildan-preview", variantId: "gid://shopify/ProductVariant/123",
    quantity: 3, country: "LI", placement: { x: .42, y: .39, scale: .487619047 } };
  const url = designStateUrl("https://app.example.test/cappatex#studio", state);
  assert.deepEqual(readDesignState(new URL(url).search), state);
  assert.equal(new URL(url).hash, "#studio");
  assert.equal(url.includes("prompt"), false);
});

test("malformed restored quantity and geometry never become trusted configuration", () => {
  const state = readDesignState("?designId=other&variantId=99&quantity=999&country=US&x=Infinity&y=0.5&scale=-1");
  assert.equal(state.designId, ""); assert.equal(state.variantId, "");
  assert.equal(state.quantity, 1); assert.equal(state.country, "CH"); assert.equal(state.placement, undefined);
});

test("color and size changes retain exact normalized placement within one product", () => {
  const position = { x: .43, y: .38, scale: .57 };
  const area = { widthPx: 3461, heightPx: 3955, widthMm: 3461 * 25.4 / 300, heightMm: 3955 * 25.4 / 300,
    minDpi: 300, minScale: .1, maxScale: 1 };
  const original = { width: 2048, height: 2048 };
  const unchanged = retainedPlacement("gildan", "gildan", position);
  assert.deepEqual(unchanged, position);
  assert.equal(placementGeometry(area, original, unchanged).ok, true);
  const large = { ...area, widthPx: 4200, heightPx: 4800, widthMm: 4200 * 25.4 / 300, heightMm: 4800 * 25.4 / 300 };
  assert.equal(placementGeometry(large, original, unchanged).resolutionOk, false, "A larger garment warns instead of silently shrinking the motif");
  assert.deepEqual(unchanged, position);
});

test("another product uses its resolution-limited initial placement", () => {
  assert.equal(retainedPlacement("gildan", "hoodie", { x: .1, y: .2, scale: .8 }), null);
  const area = { widthPx: 4200, heightPx: 4800, widthMm: 355.6, heightMm: 406.4, minDpi: 300, minScale: .1, maxScale: 1 };
  const original = { width: 2048, height: 2048 };
  const position = initialPlacement(area, original);
  assert.equal(position.x, .5); assert.equal(position.y, .5);
  assert.equal(placementGeometry(area, original, position).ok, true);
});

test("restore keeps placement only for a variant still belonging to the saved product", () => {
  const products = [{ id: "gildan", variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/1" }] },
    { id: "hoodie", variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/2" }] }];
  const state = { designId: "CPX-A3EBF595EF42", profileId: "gildan", variantId: "gid://shopify/ProductVariant/1",
    quantity: 2, country: "CH", placement: { x: .41, y: .37, scale: .45 } };
  assert.deepEqual(verifiedDesignSelection(state, products), { profileId: "gildan", variantId: state.variantId, placement: state.placement, requiresSelection: false, side: "front" });
  for (const variantId of ["gid://shopify/ProductVariant/999", "gid://shopify/ProductVariant/2"]) {
    assert.deepEqual(verifiedDesignSelection({ ...state, variantId }, products), { profileId: "gildan", variantId: "", placement: undefined, requiresSelection: true, side: "front" });
  }
  assert.deepEqual(verifiedDesignSelection({ ...state, profileId: "removed" }, products), { profileId: "", variantId: "", placement: undefined, requiresSelection: true, side: "front" });
});

const comparisonProducts = [
  { id: "tee", profileVersion: "tee-v1", variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/11" }, { shopifyVariantId: "gid://shopify/ProductVariant/12" }] },
  { id: "hoodie", profileVersion: "hoodie-v1", variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/21" }] },
];

test("returning to each product restores its own variant and placement without changing the other product", () => {
  const [tee, hoodie] = comparisonProducts;
  const teePlacement = { x: .43, y: .38, scale: .47 };
  const hoodiePlacement = { x: .52, y: .48, scale: .36 };
  const teeOnly = rememberConfiguration({}, tee, tee.variants[1].shopifyVariantId, teePlacement);
  const both = rememberConfiguration(teeOnly, hoodie, hoodie.variants[0].shopifyVariantId, hoodiePlacement);
  assert.equal(rememberedConfiguration(hoodie, teeOnly), undefined, "A never visited blank starts with its own initial placement");
  assert.deepEqual(rememberedConfiguration(tee, both), { profileVersion: "tee-v1", variantId: tee.variants[1].shopifyVariantId, placement: teePlacement });
  assert.deepEqual(rememberedConfiguration(hoodie, both)?.placement, hoodiePlacement);
  const selected = rememberedConfiguration(tee, both);
  selected.placement.x = .6;
  const updated = rememberConfiguration(both, tee, tee.variants[0].shopifyVariantId, selected.placement);
  assert.deepEqual(rememberedConfiguration(hoodie, updated), rememberedConfiguration(hoodie, both));
  assert.equal(rememberedConfiguration(tee, both)?.placement.x, .43, "Editing a returned selection cannot mutate saved configurations");
  assert.equal(rememberedConfiguration(tee, updated)?.placement.x, .6);
  assert.equal(rememberedConfiguration(tee, updated)?.variantId, tee.variants[0].shopifyVariantId);
});

test("reload restores several product configurations with the same owned artwork reference", () => {
  const [tee, hoodie] = comparisonProducts;
  let configurations = rememberConfiguration({}, tee, tee.variants[1].shopifyVariantId, { x: .42, y: .35, scale: .41 });
  configurations = rememberConfiguration(configurations, hoodie, hoodie.variants[0].shopifyVariantId, { x: .55, y: .44, scale: .34 });
  const state = { designId: "CPX-A3EBF595EF42", profileId: hoodie.id, variantId: hoodie.variants[0].shopifyVariantId,
    quantity: 2, country: "CH", placement: configurations.hoodie.placement, configurations };
  const restored = readDesignState(new URL(designStateUrl("https://app.example.test/cappatex#studio", state)).search);
  assert.deepEqual(restored, state);
  for (const product of comparisonProducts) assert.deepEqual(rememberedConfiguration(product, restored.configurations), configurations[product.id]);
});

test("changed profiles, removed variants and cross-product variants cannot reuse a saved placement", () => {
  const [tee, hoodie] = comparisonProducts;
  const configurations = rememberConfiguration({}, tee, tee.variants[1].shopifyVariantId, { x: .43, y: .38, scale: .47 });
  assert.equal(rememberedConfiguration({ ...tee, profileVersion: "tee-v2" }, configurations), undefined);
  assert.equal(rememberedConfiguration({ ...tee, variants: [tee.variants[0]] }, configurations), undefined);
  assert.equal(rememberedConfiguration(hoodie, configurations), undefined);
  assert.deepEqual(rememberConfiguration(configurations, hoodie, tee.variants[1].shopifyVariantId, { x: .5, y: .5, scale: .4 }), configurations);
  const restored = { designId: "CPX-A3EBF595EF42", profileId: tee.id, variantId: tee.variants[1].shopifyVariantId,
    quantity: 1, country: "CH", placement: configurations.tee.placement, configurations };
  assert.deepEqual(verifiedDesignSelection(restored, [{ ...tee, profileVersion: "tee-v2" }]), {
    profileId: tee.id, variantId: "", placement: undefined, side: "front", requiresSelection: true,
  }, "The active URL selection also requires review when its calibrated profile changes");
});

test("malformed, oversized and invalid stored configurations are ignored", () => {
  const query = value => `?products=${encodeURIComponent(value)}`;
  for (const value of ["{", "{}", "x".repeat(10_001), JSON.stringify(Array(21).fill(["tee", "v1", "gid://shopify/ProductVariant/11", .5, .5, .4]))]) {
    assert.equal(readDesignState(query(value)).configurations, undefined);
  }
  const configurations = readDesignState(query(JSON.stringify([
    ["tee", "tee-v1", "gid://shopify/ProductVariant/11", .4, .5, .3],
    ["negative", "v1", "gid://shopify/ProductVariant/12", .5, .5, -.1],
    ["outside", "v1", "gid://shopify/ProductVariant/13", 2, .5, .3],
    ["wrong-type", "v1", "gid://shopify/ProductVariant/14", "0.5", .5, .3],
    ["wrong-variant", "v1", "14", .5, .5, .3],
  ]))).configurations;
  assert.deepEqual(Object.keys(configurations), ["tee"]);
  assert.deepEqual(rememberedConfiguration(comparisonProducts[0], configurations)?.placement, { x: .4, y: .5, scale: .3 });
});

test("temporary catalog failure retains saved choices without authorizing an unavailable product", () => {
  const [tee, hoodie] = comparisonProducts;
  let saved = rememberConfiguration({}, tee, tee.variants[1].shopifyVariantId, { x: .4, y: .4, scale: .4 });
  saved = rememberConfiguration(saved, hoodie, hoodie.variants[0].shopifyVariantId, { x: .55, y: .42, scale: .46 });
  const partial = reconcileConfigurations([tee], saved);
  assert.deepEqual(partial, saved);
  const state = { designId: "CPX-A3EBF595EF42", profileId: hoodie.id, variantId: hoodie.variants[0].shopifyVariantId,
    quantity: 1, country: "CH", placement: saved.hoodie.placement, configurations: partial };
  assert.equal(verifiedDesignSelection(state, [tee]).requiresSelection, true);
  const restored = readDesignState(new URL(designStateUrl("https://app.example.test/cappatex", state)).search);
  assert.deepEqual(reconcileConfigurations(comparisonProducts, restored.configurations), saved);
  assert.deepEqual(rememberedConfiguration(hoodie, restored.configurations).placement, saved.hoodie.placement);
  const changed = reconcileConfigurations([{ ...hoodie, profileVersion: "hoodie-v2" }], saved);
  assert.equal(changed.hoodie, undefined);
  assert.deepEqual(changed.tee, saved.tee);
});


test("backside URLs restore only when the exact variant has an approved back", () => {
  const state = { designId: "CPX-A3EBF595EF42", profileId: "hoodie", variantId: "gid://shopify/ProductVariant/2", quantity: 1, country: "CH", side: "back", placement: { x: .4, y: .3, scale: .2 } };
  const restored = readDesignState(new URL(designStateUrl("https://app.test/cappatex", state)).search);
  assert.deepEqual(restored, state);
  const product = { id: "hoodie", variants: [{ shopifyVariantId: state.variantId, back: { area: {} } }] };
  assert.equal(verifiedDesignSelection(restored, [product]).side, "back");
  delete product.variants[0].back;
  const invalid = verifiedDesignSelection(restored, [product]);
  assert.equal(invalid.requiresSelection, true);
  assert.equal(invalid.placement, undefined, "Back geometry must never silently become front geometry");
});

test("independent front and back placements survive URL serialization", () => {
  const front = comparisonProducts[1], back = { ...front, id: front.id + ":back" };
  const frontPlacement = { x: .5, y: .25, scale: .3 }, backPlacement = { x: .4, y: .6, scale: .5 };
  const configs = rememberConfiguration(rememberConfiguration({}, front, front.variants[0].shopifyVariantId, frontPlacement), back, back.variants[0].shopifyVariantId, backPlacement);
  const state = readDesignState(new URL(designStateUrl("https://app.test/cappatex", { designId: "CPX-A3EBF595EF42", profileId: front.id, variantId: front.variants[0].shopifyVariantId, side: "back", quantity: 1, country: "CH", configurations: configs })).search);
  assert.deepEqual(rememberedConfiguration(front, state.configurations).placement, frontPlacement);
  assert.deepEqual(rememberedConfiguration(back, state.configurations).placement, backPlacement);
});


test("back configurations are invalidated when their profile or supported side changes", () => {
  const product = { id: "tee", profileVersion: "v2", variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/11", back: {} }] };
  const saved = { "tee:back": { profileVersion: "v1", variantId: product.variants[0].shopifyVariantId, placement: { x: .4, y: .3, scale: .2 } } };
  assert.deepEqual(reconcileConfigurations([product], saved), {});
  assert.equal(verifiedDesignSelection({ profileId: "tee", variantId: product.variants[0].shopifyVariantId, side: "back", configurations: saved }, [product]).requiresSelection, true);
  saved["tee:back"].profileVersion = "v2";
  assert.deepEqual(reconcileConfigurations([{ ...product, variants: [{ shopifyVariantId: product.variants[0].shopifyVariantId }] }], saved), {});
});
