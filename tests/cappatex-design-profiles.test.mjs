import assert from "node:assert/strict";
import test from "node:test";
import { CAPPATEX_DESIGN_PROFILES } from "../app/cappatex-design-profiles.ts";
import { CAPPATEX_PRINT_PROFILES } from "../app/cappatex-profiles.ts";
import { initialPlacement, placementGeometry, profileGeometryIsVerified } from "../app/cappatex-print-profile.ts";

test("actual private profiles have complete geometry and resolution-safe initial placement on every variant", () => {
  for (const [id, count] of [["gildan-64000-opt-front", 10], ["bc-king-hoodie-opt-front", 10], ["bella-3480-tde-front", 7], ["bc-wui23-tde-front", 15], ["gildan-2400-opt-front", 14], ["poster-eu-opt-front", 4]]) {
    const profiles = CAPPATEX_DESIGN_PROFILES.filter(profile => profile.id === id);
    assert.equal(profiles.length, 1);
    const profile = profiles[0];
    assert.equal(profileGeometryIsVerified(profile, "23104859", Date.parse(profile.verifiedAt) + 1), true, id);
    assert.equal(profile.variants.length, count);
    assert.equal(profile.mockupReferenceSize, id === "poster-eu-opt-front" ? undefined : "L");
    for (const variant of profile.variants) {
      const image = { width: 2048, height: 2048 };
      assert.equal(placementGeometry(variant.area, image, initialPlacement(variant.area, image)).ok, true, `${id}: ${variant.color}/${variant.size}`);
    }
    assert.equal(CAPPATEX_PRINT_PROFILES.some(item => item.id === id || item.printifyProductId === profile.printifyProductId), false,
      "Private design approval must not grant fulfillment or checkout access");
  }
});

test("actual hoodie uses its distinct smaller front area and exact Black Pure catalog option", () => {
  const profile = CAPPATEX_DESIGN_PROFILES.find(item => item.id === "bc-king-hoodie-opt-front");
  assert.equal(profile.printifyProductId, "6ac9455655a9ebcaa50bc346");
  assert.equal(profile.shopifyProductId, "gid://shopify/Product/15926043509110");
  assert.deepEqual([...new Set(profile.variants.map(item => item.color))], ["White", "Black Pure"]);
  const dimensions = { S: [3543, 2591], M: [3898, 2850], L: [4200, 3071], XL: [4200, 3071], "2XL": [4200, 3071] };
  for (const variant of profile.variants) {
    assert.deepEqual([variant.area.widthPx, variant.area.heightPx], dimensions[variant.size]);
    assert.equal(variant.area.widthMm, variant.area.widthPx * 25.4 / 300);
    assert.equal(variant.area.heightMm, variant.area.heightPx * 25.4 / 300);
    assert.equal(variant.area.position, "front");
    assert.equal(variant.area.decorationMethod, "dtg");
    assert.match(variant.mockup.url, /\?camera_label=front$/);
    assert.deepEqual(variant.shipping, ["CH", "LI"].map(country => ({ country, method: 1, currency: "USD", firstCents: 1089, additionalCents: 239 })));
  }
  const blackLarge = profile.variants.find(variant => variant.color === "Black Pure" && variant.size === "L");
  assert.equal(blackLarge.printifyVariantId, 69090);
  assert.equal(blackLarge.shopifyVariantId, "gid://shopify/ProductVariant/58949378572662");
  assert.equal(blackLarge.sku, "15087323398869215439");
});

test("sweatshirt with an unsupported curved photographic projection is not registered", () => {
  assert.equal(CAPPATEX_DESIGN_PROFILES.some(profile => profile.printifyProductId === "6ac946e23b3a3e64620a6ea2"), false);
  assert.equal(CAPPATEX_PRINT_PROFILES.some(profile => profile.printifyProductId === "6ac946e23b3a3e64620a6ea2"), false);
});

test("tanktop uses its own size-specific area and shipping and excludes unavailable Black L", () => {
  const profile = CAPPATEX_DESIGN_PROFILES.find(item => item.id === "bella-3480-tde-front");
  assert.equal(profile.printifyProductId, "6ac948494e4b21bea10a38d4");
  assert.equal(profile.shopifyProductId, "gid://shopify/Product/15926045540726");
  assert.deepEqual(profile.variants.filter(v => v.color === "Black").map(v => v.size), ["S", "M"]);
  const dimensions = { S: [2362, 2908], M: [2717, 3344], L: [3071, 3780], XL: [3071, 3780], "2XL": [3071, 3780] };
  for (const variant of profile.variants) {
    assert.deepEqual([variant.area.widthPx, variant.area.heightPx], dimensions[variant.size]);
    assert.deepEqual(variant.shipping, ["CH", "LI"].map(country => ({ country, method: 1, currency: "USD", firstCents: 729, additionalCents: 199 })));
  }
  const whiteLarge = profile.variants.find(v => v.color === "White" && v.size === "L");
  assert.equal(whiteLarge.printifyVariantId, 24828);
  assert.equal(whiteLarge.shopifyVariantId, "gid://shopify/ProductVariant/58949386928502");
  assert.equal(whiteLarge.sku, "20495463372002808285");
});

test("B&C pullover maps all verified sizes and excludes missing Black 2XL", () => {
  const profile = CAPPATEX_DESIGN_PROFILES.find(item => item.id === "bc-wui23-tde-front");
  assert.equal(profile.shopifyProductId, "gid://shopify/Product/15927108829558");
  assert.equal(profile.printifyProductId, "6aca555903e91232940b49e4");
  assert.equal(profile.variants.some(v => v.color === "Black" && v.size === "2XL"), false);
  const dimensions = { XS: [3366, 4230], S: [3780, 4749], M: [4193, 5268] };
  for (const variant of profile.variants) {
    assert.deepEqual([variant.area.widthPx, variant.area.heightPx], dimensions[variant.size] || [4606, 5787]);
    assert.equal(variant.mockup.printWidth, 429);
    assert.equal(variant.mockup.printHeight, 538);
    assert.equal(variant.area.widthMm, variant.area.widthPx * 25.4 / 300);
  }
});

test("poster uses actual paper options, per-size pixels, digital printing and verified photographic clips", () => {
  const profile = CAPPATEX_DESIGN_PROFILES.find(p => p.id === "poster-eu-opt-front");
  assert.equal(profile.optionKey, "paper");
  assert.equal(profile.mockupPosition, "other");
  assert.equal(profile.shopifyProductId, "gid://shopify/Product/15927121740150");
  for (const v of profile.variants) {
    assert.ok(["Glossy", "Matte"].includes(v.color));
    assert.equal(v.area.decorationMethod, "digital-printing");
    assert.deepEqual([v.area.widthPx, v.area.heightPx], v.size === '11.7" x 16.5"' ? [3510, 4950] : [2490, 3510]);
    assert.deepEqual([v.mockup.left, v.mockup.top, v.mockup.printWidth, v.mockup.printHeight], [251, 107, 698, 985]);
    assert.equal(v.mockup.foreground.length, 2);
    const without = structuredClone(v); delete without.mockup.foreground;
    const image = { width: 2048, height: 2048 }, placement = initialPlacement(v.area, image);
    assert.deepEqual(placementGeometry(v.area, image, placement), placementGeometry(without.area, image, placement),
      "Photo foreground must never alter printed geometry");
    assert.deepEqual(v.shipping, ["CH", "LI"].map(country => ({ country, method: 1, currency: "USD", firstCents: 849, additionalCents: 199 })));
  }
  for (const invalid of [[[[-1, 0], [2, 0], [1, 2]]], [[[0, 0], [2, 0], [1, NaN]]], [[[0, 0], [2, 0]]]]) {
    const candidate = structuredClone(profile);
    candidate.variants[0].mockup.foreground = invalid;
    assert.equal(profileGeometryIsVerified(candidate, "23104859", Date.parse(profile.verifiedAt) + 1), false);
  }
});

test("long sleeves map real sizes including Black 5XL to their distinct provider photos", () => {
  const profile = CAPPATEX_DESIGN_PROFILES.find(p => p.id === "gildan-2400-opt-front");
  assert.equal(profile.shopifyProductId, "gid://shopify/Product/15927119610230");
  assert.equal(profile.variants.some(v => v.color === "Black" && v.size === "5XL"), true);
  assert.equal(profile.variants.some(v => v.color === "White" && v.size === "5XL"), false);
  for (const v of profile.variants) {
    assert.deepEqual([v.area.widthPx, v.area.heightPx], v.size === "S" ? [3461, 3955] : v.size === "M" ? [3839, 4387] : [4200, 4800]);
    assert.match(v.mockup.url, /6aca580a7e00a6f93b0445b0/);
    assert.deepEqual(v.shipping, ["CH", "LI"].map(country => ({ country, method: 1, currency: "USD", firstCents: 849, additionalCents: 119 })));
  }
});
