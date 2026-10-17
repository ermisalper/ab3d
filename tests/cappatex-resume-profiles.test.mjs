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

const { CAPPATEX_DESIGN_PROFILES } = await import("../app/cappatex-design-profiles.ts");
const { ownedMotif, preparationDesignIds, resumePreparation } = await import("../app/cappatex-resume.ts");

// Real registry geometry, not a claim about live stock, prices or sales approval.
// Each selected variant is deliberately different from its product's first option.
const cases = [
  ["gildan-64000-opt-front", "58948948427126", "Black", "2XL", [4200, 4800], [4200, 4800]],
  ["bc-king-hoodie-opt-front", "58955526832502", "Red", "4XL", [4200, 3071], [4200, 4800]],
  ["bella-3480-tde-front", "58949386994038", "White", "2XL", [3071, 3780], [2362, 2953]],
  ["bc-wui23-tde-front", "58954577576310", "White", "4XL", [4606, 5787], [4606, 5787]],
  ["gildan-2400-opt-front", "58954603102582", "Black", "5XL", [4200, 4800], [4200, 4800]],
  ["poster-eu-opt-front", "58954622173558", "Matte", '8.3" x 11.7"', [2490, 3510], null],
];
const FRONT_ID = "CPX-AAAAAAAAAAAA", BACK_ID = "CPX-BBBBBBBBBBBB";
const REQUEST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", REQUEST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FRONT_PLACEMENT = { x: .37, y: .42, scale: .22 };
const BACK_PLACEMENT = { x: .68, y: .61, scale: .19 };

function catalog() {
  return CAPPATEX_DESIGN_PROFILES.map(profile => ({
    id: profile.id, name: profile.name, kind: profile.kind, profileVersion: profile.version,
    purchaseReady: false, blockedReason: "Private geometry fixture; no sales approval.",
    variants: profile.variants.map(variant => {
      const back = profile.backVariants?.find(candidate => candidate.shopifyVariantId === variant.shopifyVariantId);
      return { ...structuredClone(variant), title: `${variant.color} / ${variant.size}`, available: true, price: null,
        ...(back ? { back: { area: structuredClone(back.area), mockup: structuredClone(back.mockup) } } : {}) };
    }),
  }));
}

function metadata(designId, width, height) {
  return { designId, previewUrl: `/api/cappatex/artwork/${designId}`, width, height,
    previewWidth: Math.ceil(width / 4), previewHeight: Math.ceil(height / 4), source: "upload", canDownloadOriginal: true };
}

function fixture(spec = cases[0], { sameMotif = false, backOnly = false } = {}) {
  const products = catalog(), product = products.find(p => p.id === spec[0]);
  const variant = product.variants.find(v => v.shopifyVariantId === `gid://shopify/ProductVariant/${spec[1]}`);
  assert.ok(variant); assert.notEqual(product.variants[0].shopifyVariantId, variant.shopifyVariantId);
  const motifs = { [FRONT_ID]: metadata(FRONT_ID, 2048, 1536), [BACK_ID]: metadata(BACK_ID, 1024, 2048) };
  const sides = [];
  function side(position) {
    const current = position === "front" ? variant : variant.back;
    const designId = position === "front" || sameMotif ? FRONT_ID : BACK_ID;
    const motif = motifs[designId];
    return { position, designId, area: structuredClone(current.area), mockup: structuredClone(current.mockup),
      placement: structuredClone(position === "front" ? FRONT_PLACEMENT : BACK_PLACEMENT),
      artwork: { width: motif.width, height: motif.height }, dpi: 400,
      raster: { left: 1, top: 1, width: 1, height: 1 },
      file: { width: current.area.widthPx, height: current.area.heightPx, sha256: "a".repeat(64) },
      previewUrl: motif.previewUrl, downloadUrl: null };
  }
  if (!backOnly) sides.push(side("front"));
  if (variant.back) sides.push(side("back"));
  const preparation = { id: "CPP-" + "c".repeat(32), schemaVersion: 2, createdAt: 1792240000000,
    name: product.name, profileId: product.id, profileVersion: product.profileVersion,
    variant: Object.fromEntries(["shopifyVariantId", "printifyVariantId", "sku", "color", "size"].map(k => [k, variant[k]])),
    quantity: 3, country: "LI", purchaseReady: true, checkout: { enabled: true }, sides };
  return { products, product, variant, preparation, motifs };
}

for (const spec of cases) {
  test(`resume keeps exact variant, independent motifs, placement and per-side geometry: ${spec[0]}`, () => {
    const f = fixture(spec);
    // An unrelated first product/variant must never act as a resume fallback.
    f.products.reverse(); f.product.variants.reverse();
    const before = structuredClone(f);
    const result = resumePreparation(f.preparation, f.products, f.motifs, REQUEST_A);
    assert.equal(result.profileId, spec[0]);
    assert.equal(result.profileVersion, f.preparation.profileVersion);
    assert.equal(result.variantId, `gid://shopify/ProductVariant/${spec[1]}`);
    assert.equal(f.preparation.variant.color, spec[2]); assert.equal(f.preparation.variant.size, spec[3]);
    assert.equal(result.quantity, 3); assert.equal(result.country, "LI"); assert.equal(result.side, "front");
    assert.deepEqual(result.draft.working.front, { designId: FRONT_ID, placement: FRONT_PLACEMENT });
    assert.deepEqual(result.draft.selections.map(s => [s.position, s.designId, s.area.widthPx, s.area.heightPx]), [
      ["front", FRONT_ID, ...spec[4]], ...(spec[5] ? [["back", BACK_ID, ...spec[5]]] : []),
    ]);
    if (spec[5]) assert.deepEqual(result.draft.working.back, { designId: BACK_ID, placement: BACK_PLACEMENT });
    else assert.equal(result.draft.working.back, undefined);
    assert.deepEqual(f, before, "Loading a copy must not mutate immutable receipt or current catalog.");
    assert.equal(result.draft.requestId, REQUEST_A); assert.equal(result.draft.copyOf, f.preparation.id);
    assert.equal(result.draft.pendingSignature, null); assert.equal(result.draft.savedSignature, null);
    assert.equal(result.draft.receipt, undefined); assert.equal(result.draft.purchaseReady, undefined);
    assert.equal(result.draft.checkout, undefined, "The original checkout approval must never carry into a copy.");
    // Edits in the new editor may never alter the stored original or another copy.
    result.draft.working.front.placement.x = .9;
    result.draft.selections[0].placement.scale = .6;
    result.draft.selections[0].area.widthPx = 1;
    result.draft.selections[0].mockup.left = 0;
    assert.deepEqual(f, before);
    const independent = resumePreparation(f.preparation, f.products, f.motifs, REQUEST_B);
    assert.deepEqual(independent.draft.working.front.placement, FRONT_PLACEMENT);
    assert.equal(independent.draft.requestId, REQUEST_B);
  });
}

for (const spec of cases.filter(s => s[5])) {
  test(`same motif front/back and back-only survive reopening: ${spec[0]}`, () => {
    const same = fixture(spec, { sameMotif: true });
    assert.deepEqual(preparationDesignIds(same.preparation), [FRONT_ID]);
    same.preparation.sides.reverse();
    const a = resumePreparation(same.preparation, same.products, same.motifs, REQUEST_A);
    assert.deepEqual(a.draft.selections.map(s => [s.position, s.designId, s.placement]), [
      ["front", FRONT_ID, FRONT_PLACEMENT], ["back", FRONT_ID, BACK_PLACEMENT],
    ]);
    const back = fixture(spec, { backOnly: true });
    const b = resumePreparation(back.preparation, back.products, back.motifs, REQUEST_B);
    assert.equal(b.side, "back"); assert.equal(b.draft.working.front, undefined);
    assert.deepEqual(b.draft.working.back, { designId: BACK_ID, placement: BACK_PLACEMENT });
    assert.deepEqual(b.draft.selections.map(s => [s.position, s.area.widthPx, s.area.heightPx]), [["back", ...spec[5]]]);
  });
}

for (const spec of cases) {
  test(`missing/changed profile, version, variant and stock never select a default: ${spec[0]}`, () => {
    const checks = [
      f => { f.preparation.profileId = "foreign-profile"; },
      f => { f.preparation.profileVersion += "-superseded"; },
      f => { f.preparation.variant.shopifyVariantId = f.products.find(p => p.id !== spec[0]).variants[0].shopifyVariantId; },
      f => { f.product.variants = f.product.variants.filter(v => v !== f.variant); },
      f => { f.variant.available = false; },
      f => { f.preparation.variant.sku += "-different"; },
      f => { f.preparation.variant.printifyVariantId += 1; },
      f => { f.preparation.variant.color = "Unverified color"; },
      f => { f.preparation.variant.size = "Unverified size"; },
      f => { f.products.push(structuredClone(f.product)); },
      f => { f.product.variants.push(structuredClone(f.variant)); },
    ];
    for (const [index, change] of checks.entries()) {
      const f = fixture(spec); change(f);
      assert.throws(() => resumePreparation(f.preparation, f.products, f.motifs, REQUEST_A), `rejection ${index}`);
    }
  });
}

test("unsupported poster back and a removed clothing back remain blocked", () => {
  const poster = fixture(cases.at(-1));
  const inventedBack = structuredClone(poster.preparation.sides[0]); inventedBack.position = "back"; inventedBack.area.position = "back";
  poster.preparation.sides = [inventedBack];
  assert.throws(() => resumePreparation(poster.preparation, poster.products, poster.motifs, REQUEST_A));
  const tee = fixture(cases[0], { backOnly: true }); delete tee.variant.back;
  assert.throws(() => resumePreparation(tee.preparation, tee.products, tee.motifs, REQUEST_A));
});

test("copy refuses changed source, print canvas, photograph or placement instead of repairing the design", () => {
  const checks = [
    f => { delete f.motifs[BACK_ID]; },
    f => { f.motifs[BACK_ID] = metadata(FRONT_ID, 1024, 2048); },
    f => { f.motifs[BACK_ID].width += 4; f.motifs[BACK_ID].previewWidth += 1; },
    f => { f.motifs[FRONT_ID].previewUrl = "https://untrusted.example/image.png"; },
    f => { f.preparation.sides[1].file.height += 1; },
    f => { f.preparation.sides[1].area.heightPx += 1; },
    f => { f.preparation.sides[1].mockup.url += "&changed=true"; },
    f => { f.preparation.sides[1].mockup.left += 1; },
    f => { f.preparation.sides[1].placement = { x: .01, y: .01, scale: .8 }; },
    f => { f.preparation.sides[1].placement = { x: .5, y: .5, scale: .8 }; },
    f => { f.preparation.sides[1].placement.scale = Number.NaN; },
    f => { f.preparation.sides[1].position = "front"; },
  ];
  for (const [index, change] of checks.entries()) {
    const f = fixture(); change(f);
    assert.throws(() => resumePreparation(f.preparation, f.products, f.motifs, REQUEST_A), `rejection ${index}`);
  }
});

test("owned motif validation checks the authenticated response identity and exact preview dimensions", () => {
  const raw = metadata(FRONT_ID, 2049, 1537);
  assert.deepEqual(ownedMotif({ ...raw, email: "not-exported@example.test", key: "private/object" }, FRONT_ID), raw);
  for (const change of [
    m => { m.designId = BACK_ID; }, m => { m.previewWidth -= 1; }, m => { m.height = Infinity; },
    m => { m.source = "external"; }, m => { delete m.canDownloadOriginal; },
  ]) {
    const candidate = structuredClone(raw); change(candidate);
    assert.throws(() => ownedMotif(candidate, FRONT_ID));
  }
});
