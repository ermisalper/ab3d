import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(specifier, context);
} });
const { CAPPATEX_DESIGN_PROFILES } = await import("../app/cappatex-design-profiles.ts");
const { serializeSessionDraft, parseSessionDraft, sessionDraftDesignIds, hydrateSessionDraft } = await import("../app/cappatex-session-draft.ts");
const { preparationRequestId, compositionKey } = await import("../app/cappatex-resume.ts");
const ID_A = "CPX-AAAAAAAAAAAA", ID_B = "CPX-BBBBBBBBBBBB", CPP = "CPP-" + "c".repeat(32);
const REQUEST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", REQUEST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function fixture() {
  const profile = structuredClone(CAPPATEX_DESIGN_PROFILES[0]), v = profile.variants[0];
  const back = profile.backVariants.find(b => b.shopifyVariantId === v.shopifyVariantId);
  const variant = { ...v, title: "Offline fixture", available: true, price: null, back: { area: back.area, mockup: back.mockup } };
  const product = { id: profile.id, profileVersion: profile.version, name: profile.name, kind: profile.kind,
    purchaseReady: false, blockedReason: "Private fixture", variants: [variant] };
  const metadata = (designId, width, height) => ({ designId, previewUrl: `/api/cappatex/artwork/${designId}`, width, height,
    previewWidth: Math.ceil(width / 4), previewHeight: Math.ceil(height / 4), source: "upload", canDownloadOriginal: true });
  const motifs = { [ID_A]: metadata(ID_A, 2048, 3072), [ID_B]: metadata(ID_B, 1024, 1024) };
  const working = { front: { designId: ID_A, placement: { x: .5, y: .5, scale: .3 } }, back: { designId: ID_B, placement: { x: .4, y: .6, scale: .15 } } };
  const selections = ["front", "back"].map(position => {
    const current = position === "front" ? variant : variant.back, m = motifs[working[position].designId];
    return { ...structuredClone(working[position]), position, artwork: { width: m.width, height: m.height }, area: current.area, mockup: current.mockup };
  });
  const signature = JSON.stringify({ profileId: product.id, profileVersion: product.profileVersion, shopifyVariantId: variant.shopifyVariantId,
    quantity: 2, country: "LI", sides: selections.map(s => ({ position: s.position, designId: s.designId, placement: s.placement })) });
  const draft = { working, selections, requestId: REQUEST_A, pendingSignature: signature, savedSignature: null, copyOf: CPP };
  return { product, variant, motifs, draft, signature };
}
const serialize = f => serializeSessionDraft(f.product, f.variant, f.draft, f.motifs, 2, "LI", "back");

test("session roundtrip keeps independent source IDs, exact positions, active side and order configuration", () => {
  const f = fixture(), before = structuredClone(f), reference = parseSessionDraft(serialize(f));
  assert.equal(reference.quantity, 2); assert.equal(reference.country, "LI"); assert.equal(reference.side, "back");
  assert.deepEqual(sessionDraftDesignIds(reference), [ID_A, ID_B]);
  const result = hydrateSessionDraft(reference, [f.product], f.motifs);
  assert.equal(result.key, compositionKey(f.product.id, f.product.profileVersion, f.variant.shopifyVariantId));
  assert.deepEqual(result.draft.selections, f.draft.selections); assert.deepEqual(result.draft.working, f.draft.working);
  assert.deepEqual(f, before, "Session persistence may not mutate original sides or metadata");
});

test("unknown save outcome retains the same request ID after reload; changed intent uses a fresh ID", () => {
  const f = fixture(), reference = parseSessionDraft(serialize(f));
  const restored = hydrateSessionDraft(reference, [f.product], f.motifs).draft;
  assert.equal(preparationRequestId(restored, f.signature, REQUEST_B), REQUEST_A);
  assert.equal(preparationRequestId(restored, f.signature.replace('"quantity":2', '"quantity":3'), REQUEST_B), REQUEST_B);
  assert.equal(preparationRequestId({ ...restored, pendingSignature: null }, f.signature, REQUEST_B), REQUEST_A, "A new explicit CPP copy uses its fresh initial UUID");
});

test("session references omit original file paths, previews, prompts, consent, price and checkout approval", () => {
  const f = fixture();
  Object.assign(f.draft, { prompt: "private-fixture-prompt", termsAccepted: true, galleryChoice: "private-choice", OPENAI_API_KEY: "not-a-real-secret",
    receipt: { id: CPP, email: "hidden@example.test", checkout: { enabled: true, unitPriceCents: 9999 }, sides: [{ artwork: { key: "private/artwork.png" } }] } });
  const text = serialize(f), reference = parseSessionDraft(text);
  for (const hidden of ["private-fixture", "termsAccepted", "galleryChoice", "OPENAI_API_KEY", "not-a-real-secret", "hidden@example.test", "unitPriceCents", "private/artwork.png", "previewUrl", "base64"])
    assert.ok(!text.includes(hidden), `Session leaked ${hidden}`);
  assert.equal(reference.receiptId, CPP);
  reference.savedSignature = f.signature;
  const restored = hydrateSessionDraft(reference, [f.product], f.motifs).draft;
  assert.equal(restored.receipt, undefined); assert.equal(restored.savedSignature, null, "Client flags cannot prove a durable server save");
});

test("removing a captured side survives reload without silently re-adding its print file", () => {
  const f = fixture(); f.draft.selections = f.draft.selections.filter(s => s.position !== "back");
  const result = hydrateSessionDraft(parseSessionDraft(serialize(f)), [f.product], f.motifs).draft;
  assert.deepEqual(result.selections.map(s => s.position), ["front"]);
  assert.equal(result.working.back.designId, ID_B, "An editable rear motif is distinct from an approved captured print side");
});

test("unsubmitted working edits stay exact while captured placement remains unchanged", () => {
  const f = fixture(); f.draft.working.back.placement.x = 1;
  const result = hydrateSessionDraft(parseSessionDraft(serialize(f)), [f.product], f.motifs).draft;
  assert.equal(result.working.back.placement.x, 1, "Do not silently repair an out-of-bounds working placement");
  assert.equal(result.selections.find(s => s.position === "back").placement.x, .4);
});

test("changed profile identity, SKU, colour, size, calibration, stock and unsupported rear area all block restore", () => {
  const f = fixture(), reference = parseSessionDraft(serialize(f));
  for (const mutate of [p => { p.profileVersion += "-new"; }, p => { p.variants[0].sku += "-new"; },
    p => { p.variants[0].printifyVariantId++; }, p => { p.variants[0].color = "Red"; }, p => { p.variants[0].size = "Other"; },
    p => { p.variants[0].mockup.left++; }, p => { p.variants[0].back.area.widthPx++; },
    p => { p.variants[0].available = false; }, p => { delete p.variants[0].back; }]) {
    const product = structuredClone(f.product); mutate(product);
    assert.throws(() => hydrateSessionDraft(reference, [product], f.motifs));
  }
  assert.throws(() => hydrateSessionDraft(reference, [f.product, f.product], f.motifs));
  const duplicate = structuredClone(f.product); duplicate.variants.push(duplicate.variants[0]);
  assert.throws(() => hydrateSessionDraft(reference, [duplicate], f.motifs));
  const ambiguous = structuredClone(f.product); ambiguous.variants.push({ ...ambiguous.variants[0], available: false });
  assert.throws(() => hydrateSessionDraft(reference, [ambiguous], f.motifs));
});

test("a missing, foreign, resized or unvalidated source cannot restore either side", () => {
  const f = fixture(), reference = parseSessionDraft(serialize(f));
  for (const change of [m => { delete m[ID_B]; }, m => { m[ID_B].designId = ID_A; }, m => { m[ID_B].width++; },
    m => { m[ID_B].previewUrl = "https://untrusted.example.test/image.png"; }]) {
    const motifs = structuredClone(f.motifs); change(motifs);
    assert.throws(() => hydrateSessionDraft(reference, [f.product], motifs));
  }
});

test("malformed, oversized or ambiguous references are ignored before any source request", () => {
  const f = fixture(), reference = parseSessionDraft(serialize(f));
  for (const value of ["{", "{}", "x".repeat(30_001), "null"]) assert.equal(parseSessionDraft(value), null);
  for (const mutate of [r => { r.requestId = "wrong"; }, r => { r.working.push(r.working[0]); },
    r => { r.working[0].placement.scale = -1; }, r => { r.country = "US"; }, r => { r.working = []; },
    r => { r.selections[0].designId = "invalid"; }]) {
    const changed = structuredClone(reference); mutate(changed); assert.equal(parseSessionDraft(JSON.stringify(changed)), null);
  }
});
