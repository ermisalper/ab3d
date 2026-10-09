import assert from "node:assert/strict";
import test from "node:test";
import { readDesignState, designStateUrl, retainedPlacement, verifiedDesignSelection } from "../app/cappatex-design-state.ts";
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
  assert.deepEqual(verifiedDesignSelection(state, products), { profileId: "gildan", variantId: state.variantId, placement: state.placement, requiresSelection: false });
  for (const variantId of ["gid://shopify/ProductVariant/999", "gid://shopify/ProductVariant/2"]) {
    assert.deepEqual(verifiedDesignSelection({ ...state, variantId }, products), { profileId: "gildan", variantId: "", placement: undefined, requiresSelection: true });
  }
  assert.deepEqual(verifiedDesignSelection({ ...state, profileId: "removed" }, products), { profileId: "", variantId: "", placement: undefined, requiresSelection: true });
});
