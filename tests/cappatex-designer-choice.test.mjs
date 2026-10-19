import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return nextResolve(candidate.href, context);
  }
  return nextResolve(specifier, context);
} });

const { chooseColor, productFrontChoice } = await import("../app/cappatex-designer-choice.ts");
const { CAPPATEX_DESIGN_PROFILES } = await import("../app/cappatex-design-profiles.ts");
const { compositionKey, emptyCompositionDraft } = await import("../app/cappatex-resume.ts");
const { initialPlacement } = await import("../app/cappatex-print-profile.ts");

function product(id) {
  const profile = CAPPATEX_DESIGN_PROFILES.find(p => p.id === id);
  assert.ok(profile);
  return { id: profile.id, profileVersion: profile.version, name: profile.name,
    variants: profile.variants.map(v => ({ ...structuredClone(v), available: true, price: null })) };
}
const motifA = { designId: "CPX-AAAAAAAAAAAA", previewUrl: "/api/cappatex/artwork/CPX-AAAAAAAAAAAA",
  width: 3072, height: 2048, previewWidth: 768, previewHeight: 512, source: "upload", canDownloadOriginal: true };
const motifB = { designId: "CPX-BBBBBBBBBBBB", previewUrl: "/api/cappatex/artwork/CPX-BBBBBBBBBBBB",
  width: 1536, height: 2048, previewWidth: 384, previewHeight: 512, source: "generated", canDownloadOriginal: false };
const placementA = { x: .43, y: .37, scale: .26 }, placementB = { x: .56, y: .52, scale: .33 };
const fallback = { motif: motifB, artwork: { width: motifB.width, height: motifB.height } };

for (const [id, fromColor, size, toColor, expectedSizes] of [
  ["bella-3480-tde-front", "White", "L", "Black", ["S", "M"]],
  ["bc-king-hoodie-opt-front", "Navy", "4XL", "White", ["S", "M", "L", "XL", "2XL"]],
  ["gildan-2400-opt-front", "Black", "5XL", "White", ["S", "M", "L", "XL", "2XL", "3XL"]],
]) {
  test(`unavailable ${toColor}/${size} retains the existing ${fromColor}/${size} choice: ${id}`, () => {
    const p = product(id), before = structuredClone(p);
    const selected = p.variants.find(v => v.color === fromColor && v.size === size);
    assert.ok(selected);
    const choice = chooseColor(p, toColor, selected.size);
    assert.equal(choice.ok, false);
    assert.deepEqual(choice.options.map(v => v.size), expectedSizes);
    assert.match(choice.reason, /bisherige Auswahl bleibt erhalten/);
    for (const option of choice.options) {
      const exact = p.variants.filter(v => v.shopifyVariantId === option.variantId);
      assert.equal(exact.length, 1);
      assert.equal(exact[0].color, toColor); assert.equal(exact[0].size, option.size);
    }
    assert.deepEqual(p, before, "A rejected colour choice must not edit the catalog or current selection.");
  });
}

test("available colour preserves exact size and rejects unavailable or ambiguous exact combinations", () => {
  const p = product("gildan-64000-opt-front");
  const expected = p.variants.find(v => v.color === "Black" && v.size === "L");
  assert.ok(expected);
  assert.deepEqual(chooseColor(p, "Black", "L"), { ok: true, variant: expected });
  expected.available = false;
  assert.equal(chooseColor(p, "Black", "L").ok, false);
  expected.available = true; p.variants.push(structuredClone(expected));
  const duplicate = chooseColor(p, "Black", "L");
  assert.equal(duplicate.ok, false); assert.equal(duplicate.options.some(v => v.size === "L"), false);
  assert.equal(chooseColor(p, "Unknown", "L").ok, false);
});

test("comparison cards and selection restore each product's own front motif, exact variant and position", () => {
  const tee = product("gildan-64000-opt-front"), hoodie = product("bc-king-hoodie-opt-front");
  const teeVariant = tee.variants.find(v => v.color === "Black" && v.size === "2XL");
  const hoodieVariant = hoodie.variants.find(v => v.color === "Navy" && v.size === "4XL");
  assert.ok(teeVariant); assert.ok(hoodieVariant);
  const teeDraft = { ...emptyCompositionDraft(), working: {
    front: { designId: motifA.designId, placement: placementA },
    back: { designId: motifB.designId, placement: placementB },
  } };
  const hoodieDraft = { ...emptyCompositionDraft(), working: { front: { designId: motifB.designId, placement: placementB } } };
  const drafts = { [compositionKey(tee.id, tee.profileVersion, teeVariant.shopifyVariantId)]: teeDraft,
    [compositionKey(hoodie.id, hoodie.profileVersion, hoodieVariant.shopifyVariantId)]: hoodieDraft };
  const motifs = { [motifA.designId]: motifA, [motifB.designId]: motifB }, before = structuredClone(drafts);
  const a = productFrontChoice(tee, teeVariant.shopifyVariantId, drafts, motifs, fallback);
  const b = productFrontChoice(hoodie, hoodieVariant.shopifyVariantId, drafts, motifs, { motif: motifA, artwork: motifA });
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.equal(a.variant.shopifyVariantId, teeVariant.shopifyVariantId); assert.equal(a.variant.size, "2XL");
  assert.deepEqual(a.motif, motifA); assert.deepEqual(a.placement, placementA); assert.equal(a.remembered, true);
  assert.deepEqual(b.motif, motifB); assert.deepEqual(b.placement, placementB);
  a.placement.x = .2; b.placement.scale = .1;
  assert.deepEqual(drafts, before, "Rendering or changing one card must not edit the saved front/back working drafts.");
});

test("a missing remembered motif or invalid preferred variant cannot display a different global image", () => {
  const p = product("gildan-64000-opt-front"), v = p.variants[1];
  const drafts = { [compositionKey(p.id, p.profileVersion, v.shopifyVariantId)]: {
    ...emptyCompositionDraft(), working: { front: { designId: motifA.designId, placement: placementA } },
  } };
  assert.equal(productFrontChoice(p, v.shopifyVariantId, drafts, {}, fallback).ok, false);
  assert.equal(productFrontChoice(p, "gid://shopify/ProductVariant/999", drafts, {}, fallback).ok, false);
  v.available = false;
  assert.equal(productFrontChoice(p, v.shopifyVariantId, drafts, { [motifA.designId]: motifA }, fallback).ok, false);
  v.available = true; p.variants.push(structuredClone(v));
  assert.equal(productFrontChoice(p, v.shopifyVariantId, drafts, { [motifA.designId]: motifA }, fallback).ok, false);
});

test("a new product uses the current motif with its own initial geometry, without inventing a remembered draft", () => {
  const p = product("poster-eu-opt-front");
  const next = productFrontChoice(p, undefined, {}, {}, fallback);
  assert.equal(next.ok, true); assert.equal(next.remembered, false);
  assert.equal(next.variant.shopifyVariantId, p.variants[0].shopifyVariantId);
  assert.deepEqual(next.motif, motifB); assert.deepEqual(next.placement, initialPlacement(next.variant.area, motifB));
  assert.deepEqual(productFrontChoice(p, undefined, {}, {}, { ...fallback, placement: placementA }).placement, placementA);
});
