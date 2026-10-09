import assert from "node:assert/strict";
import test from "node:test";
import { initialPlacement, placementGeometry, profileIsVerified } from "../app/cappatex-print-profile.ts";
import { draftProductPayload, draftMatchesSnapshot } from "../app/cappatex-printify-draft.ts";

// Pixel dimensions reproduce the read-only provider audit. All identities, approval
// fields and mockups below are synthetic. Millimetres are calculated at 300 DPI for
// these geometry regressions, not asserted as production approval/evidence.
const dimensions = [["S", 3461, 3955], ["M", 3839, 4387], ["L", 4200, 4800],
  ["XL", 4200, 4800], ["2XL", 4200, 4800]];
const variants = dimensions.map(([size, widthPx, heightPx], index) => ({
  printifyVariantId: 100 + index, shopifyVariantId: `gid://shopify/ProductVariant/${200 + index}`,
  sku: `GEOMETRY-FIXTURE-${size}`, color: "White", size,
  area: { position: "front", decorationMethod: "dtg", widthPx, heightPx,
    widthMm: widthPx * 25.4 / 300, heightMm: heightPx * 25.4 / 300, minDpi: 300, minScale: .1, maxScale: 1 },
  mockup: { url: `https://example.test/geometry-${size}.png`, width: 1200, height: 1600,
    left: 300, top: 200, printWidth: 300, printHeight: 300 * heightPx / widthPx },
  shipping: ["CH", "LI"].map(country => ({ country, method: 1, currency: "USD", firstCents: 100, additionalCents: 50 })),
}));
const profile = { id: "geometry-fixture", version: "test-only", shopId: "offline-geometry-shop",
  printifyProductId: "offline-template", blueprintId: 1, providerId: 2, shopifyProductId: "gid://shopify/Product/3",
  kind: "tshirt", name: "Synthetic geometry fixture", verifiedAt: "2026-10-01T00:00:00Z", validUntil: "2026-11-01T00:00:00Z",
  evidence: ["Offline regression fixture, never register"],
  fulfillment: { route: "ab3d-api", nativeImportUnlinked: true, manualApproval: true }, variants };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("one profile supports distinct S, M and L+ print rectangles", () => {
  assert.equal(profileIsVerified(profile, profile.shopId, Date.parse("2026-10-09T00:00:00Z")), true);
  assert.deepEqual(profile.variants.map(variant => [variant.area.widthPx, variant.area.heightPx]),
    [[3461, 3955], [3839, 4387], [4200, 4800], [4200, 4800], [4200, 4800]]);
});

test("the same original at the same relative scale can pass S and fail larger sizes at 300 DPI", () => {
  const artwork = { width: 2048, height: 2048 };
  const placement = { x: .5, y: .5, scale: .55 };
  const results = variants.map(variant => placementGeometry(variant.area, artwork, placement));
  assert.deepEqual(results.map(result => result.boundsOk), [true, true, true, true, true]);
  assert.deepEqual(results.map(result => result.resolutionOk), [true, false, false, false, false]);
  near(results[0].widthMm, 161.16723333333334);
  near(results[1].widthMm, 178.76943333333335);
  near(results[2].widthMm, 195.58);
  for (const result of results) near(result.widthMm, result.heightMm);
});

test("a fixed physical print width uses each selected size's scale and preserves original-file DPI", () => {
  const artwork = { width: 2048, height: 1024 };
  const scales = [];
  for (const variant of variants) {
    const placement = { x: .5, y: .5, scale: 160 / variant.area.widthMm };
    scales.push(placement.scale);
    const result = placementGeometry(variant.area, artwork, placement);
    assert.equal(result.ok, true);
    near(result.widthMm, 160); near(result.heightMm, 80); near(result.dpi, 325.12);
  }
  assert.ok(scales[0] > scales[1] && scales[1] > scales[2]);
  assert.equal(scales[2], scales[3]); assert.equal(scales[3], scales[4]);
});

test("initial portrait placement fits each selected placeholder's aspect ratio", () => {
  const artwork = { width: 2048, height: 3072 };
  for (const variant of variants) {
    const placement = initialPlacement(variant.area, artwork);
    const result = placementGeometry(variant.area, artwork, placement);
    assert.equal(result.boundsOk, true);
    near(result.height, .7);
    near(result.heightMm / result.widthMm, 1.5);
  }
});

test("snapshots and product drafts retain the selected size instead of the reference-size variant", () => {
  const artwork = { key: "offline/original.png", sha256: "fixture-hash", width: 2048, height: 1024, format: "png" };
  for (const variant of variants) {
    const placement = { x: .5, y: .5, scale: 160 / variant.area.widthMm };
    const snapshot = JSON.parse(JSON.stringify({ id: `CPS-${"a".repeat(32)}`, profile, variant, placement, artwork }));
    const payload = draftProductPayload(snapshot, "offline-original-upload", 2500);
    assert.deepEqual(snapshot.variant.area, variant.area);
    assert.deepEqual(snapshot.artwork, artwork);
    assert.deepEqual(payload.variants.map(item => item.id), [variant.printifyVariantId]);
    assert.deepEqual(payload.print_areas[0].variant_ids, [variant.printifyVariantId]);
    assert.deepEqual(payload.print_areas[0].placeholders[0].images,
      [{ id: "offline-original-upload", ...placement, angle: 0 }]);
    const returnedDraft = { ...payload, id: "offline-draft", visible: false,
      print_areas: payload.print_areas.map(area => ({ ...area,
        placeholders: area.placeholders.map(placeholder => ({ ...placeholder, decoration_method: "dtg" })) })) };
    assert.equal(draftMatchesSnapshot(returnedDraft, snapshot, "offline-original-upload"), true);
    const wrongVariant = variants.find(other => other.printifyVariantId !== variant.printifyVariantId);
    assert.equal(draftMatchesSnapshot(returnedDraft, { ...snapshot, variant: wrongVariant }, "offline-original-upload"), false);
  }
});
