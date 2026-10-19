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
const { parsePreparationListResponse, parsePreparationResponse, parseSavedPreparationResponse } = await import("../app/cappatex-preparation-response.ts");
const { preparationSummary } = await import("../app/cappatex-preparation.ts");
const { placementGeometry } = await import("../app/cappatex-print-profile.ts");
const { CAPPATEX_DESIGN_PROFILES } = await import("../app/cappatex-design-profiles.ts");

const CPP = "CPP-" + "a".repeat(32), FRONT = "CPX-AAAAAAAAAAAA", BACK = "CPX-BBBBBBBBBBBB";
function summary(profileId = "gildan-64000-opt-front", positions = ["front", "back"], canDownload = true) {
  const profile = CAPPATEX_DESIGN_PROFILES.find(p => p.id === profileId), variant = profile.variants[0];
  const saved = { schemaVersion: 2, rendererVersion: "rgba-area-v1", id: CPP, createdAt: 1792240000000,
    profileId, profileVersion: profile.version, name: profile.name, shopId: profile.shopId,
    printifyProductId: profile.printifyProductId, blueprintId: profile.blueprintId, providerId: profile.providerId,
    variant: Object.fromEntries(["shopifyVariantId", "printifyVariantId", "sku", "color", "size"].map(key => [key, variant[key]])),
    quantity: 2, country: "LI", sides: positions.map(position => {
      const v = position === "front" ? variant : profile.backVariants.find(b => b.printifyVariantId === variant.printifyVariantId);
      const artwork = { width: 2048, height: 1536 }, placement = { x: .42, y: .47, scale: .2 };
      const geometry = placementGeometry(v.area, artwork, placement);
      assert.equal(geometry.ok, true);
      const width = Math.round(v.area.widthPx * placement.scale), height = Math.round(width * artwork.height / artwork.width);
      return { position, designId: position === "front" ? FRONT : BACK, source: "upload",
        artwork: { key: "private/original.png", sha256: "a".repeat(64), ...artwork }, area: structuredClone(v.area),
        mockup: structuredClone(v.mockup), placement, file: { key: `private/${position}.png`, sha256: "b".repeat(64), width: v.area.widthPx, height: v.area.heightPx },
        raster: { left: Math.round(placement.x * v.area.widthPx - width / 2), top: Math.round(placement.y * v.area.heightPx - height / 2), width, height }, dpi: geometry.dpi };
    }) };
  return preparationSummary(saved, canDownload);
}
function listItem(receipt = summary()) {
  return { id: receipt.id, createdAt: receipt.createdAt, integrity: "verified", name: receipt.name,
    profileId: receipt.profileId, profileVersion: receipt.profileVersion, variant: { color: receipt.variant.color, size: receipt.variant.size },
    quantity: receipt.quantity, country: receipt.country, sides: receipt.sides.map(s => ({ position: s.position, designId: s.designId,
      previewUrl: s.previewUrl, file: { width: s.file.width, height: s.file.height }, dpi: s.dpi })) };
}
function submittedInput(receipt = summary()) {
  return { requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", profileId: receipt.profileId, profileVersion: receipt.profileVersion,
    shopifyVariantId: receipt.variant.shopifyVariantId, quantity: receipt.quantity, country: receipt.country,
    sides: receipt.sides.map(side => ({ position: side.position, designId: side.designId, placement: { ...side.placement } })) };
}
const badList = value => assert.throws(() => parsePreparationListResponse(value), { message: "Deine gespeicherten Gestaltungen konnten nicht sicher geladen werden. Bitte versuche es erneut." });
const badDetail = (value, expectedId = CPP) => assert.throws(() => parsePreparationResponse(value, expectedId), { message: "Dein gespeicherter Gestaltungsstand konnte nicht sicher geladen werden. Bitte lade ihn erneut." });

test("real summaries for all six families retain every preview field, including legacy backs and poster foreground", () => {
  for (const profile of CAPPATEX_DESIGN_PROFILES) {
    const receipt = summary(profile.id, profile.backVariants ? ["front", "back"] : ["front"]);
    const before = structuredClone(receipt), parsed = parsePreparationResponse(receipt, receipt.id);
    assert.deepEqual(parsed, receipt, profile.id); assert.deepEqual(receipt, before);
    assert.deepEqual(parsePreparationResponse(JSON.parse(JSON.stringify(receipt))), receipt, "POST responses can validate a new server-generated ID.");
  }
  const rearOnly = summary("gildan-64000-opt-front", ["back"], false);
  assert.deepEqual(parsePreparationResponse(rearOnly, CPP), rearOnly);
  assert.equal(parsePreparationResponse(rearOnly).sides[0].downloadUrl, null);
});

test("empty, verified and integrity-unavailable list rows validate without introducing private or approval fields", () => {
  assert.deepEqual(parsePreparationListResponse({ items: [], nextCursor: null }), { items: [], nextCursor: null });
  const verified = listItem(), unavailable = { id: "CPP-" + "b".repeat(32), createdAt: 1700000000000, integrity: "unavailable" };
  const input = { items: [{ ...verified, email: "private@example.test", payload_json: "private/storage" },
    { ...unavailable, variant: null, checkout: { enabled: true } }], nextCursor: null, checkoutEnabled: true };
  assert.deepEqual(parsePreparationListResponse(input), { items: [verified, unavailable], nextCursor: null });
});

test("list cursors remain opaque across legacy and filter-bound versions, with a strict size and character bound", () => {
  for (const cursor of [btoa(JSON.stringify({ v: 1, createdAt: 1, id: CPP })).replace(/=+$/, ""),
    btoa(JSON.stringify({ v: 2, createdAt: 1, id: CPP, filter: "shirt" })).replace(/=+$/, ""), "A".repeat(1024)])
    assert.equal(parsePreparationListResponse({ items: [], nextCursor: cursor }).nextCursor, cursor);
  for (const nextCursor of [undefined, "", "a".repeat(1025), "/path", "bad cursor", {}, 1]) badList({ items: [], nextCursor });
});

test("malformed lists reject before rendering items, variant labels or side cards", () => {
  for (const input of [null, [], {}, { items: {}, nextCursor: null }, { items: [null], nextCursor: null },
    { items: Array(13).fill(listItem()), nextCursor: null }, { items: [listItem(), listItem()], nextCursor: null }]) badList(input);
  for (const mutate of [
    r => { r.integrity = "unknown"; }, r => { r.id = "CPP-wrong"; }, r => { r.createdAt = Infinity; },
    r => { r.name = ""; }, r => { r.profileVersion = null; }, r => { r.variant = null; },
    r => { r.variant.color = {}; }, r => { delete r.variant.size; }, r => { r.quantity = "2"; }, r => { r.country = "US"; },
    r => { r.sides = null; }, r => { r.sides = []; }, r => { r.sides.push(r.sides[0]); },
    r => { r.sides[0] = null; }, r => { r.sides[0].previewUrl = "https://other.example/asset"; },
    r => { r.sides[0].designId = BACK; }, r => { r.sides[0].file = null; }, r => { r.sides[0].file.width = 10001; },
    r => { r.sides[0].dpi = NaN; },
  ]) { const row = listItem(); mutate(row); badList({ items: [row], nextCursor: null }); }
});

test("missing, mismatched or malformed detail identities never become a receipt", () => {
  for (const value of [null, [], {}, "response"]) badDetail(value);
  badDetail(summary(), "CPP-" + "f".repeat(32)); badDetail(summary(), "wrong-id");
  for (const mutate of [
    r => { r.id = "CPP-wrong"; }, r => { r.schemaVersion = 1; }, r => { r.createdAt = "today"; },
    r => { r.name = null; }, r => { r.profileId = ""; }, r => { r.profileVersion = "x".repeat(161); },
    r => { r.variant = null; }, r => { r.variant.shopifyVariantId = "gid://shopify/Product/1"; },
    r => { r.variant.printifyVariantId = .5; }, r => { r.variant.sku = ""; }, r => { r.variant.color = {}; },
    r => { delete r.variant.size; }, r => { r.quantity = 6; }, r => { r.country = "DE"; },
    r => { r.sides = null; }, r => { r.sides = []; }, r => { r.sides[1].position = "front"; },
    r => { r.sides[0] = null; }, r => { r.sides[0].designId = "foreign"; },
  ]) { const receipt = summary(); mutate(receipt); badDetail(receipt); }
});

test("all renderer fields have bounded, finite and mutually consistent geometry", () => {
  for (const mutate of [
    s => { s.area = null; }, s => { s.area.position = "back"; }, s => { s.area.widthPx = 10001; },
    s => { s.area.heightPx = .5; }, s => { s.area.widthMm = 0; }, s => { s.area.heightMm = Infinity; },
    s => { s.area.widthMm *= 2; }, s => { s.area.minScale = 0; }, s => { s.area.maxScale = .05; },
    s => { s.area.minDpi = 0; }, s => { s.mockup = null; }, s => { s.mockup.width = 0; },
    s => { s.mockup.url = "javascript:alert(1)"; }, s => { s.mockup.url = "https://user:password@example.test/photo.jpg"; },
    s => { s.mockup.left = -1; }, s => { s.mockup.printWidth = 10001; }, s => { s.mockup.printHeight = 1; },
    s => { s.mockup.foreground = "polygon"; }, s => { s.mockup.foreground = Array(9).fill([[0, 0], [1, 0], [1, 1]]); },
    s => { s.mockup.foreground = [[[0, 0], [1, 0]]]; }, s => { s.mockup.foreground = [[[0, 0], [1201, 0], [1, 1]]]; },
    s => { s.mockup.foreground = [[[0, 0, 1], [1, 0], [1, 1]]]; },
    s => { s.placement = null; }, s => { s.placement.scale = "0.2"; }, s => { s.placement.x = .01; },
    s => { s.placement.scale = 1; }, s => { s.artwork = null; }, s => { s.artwork.width = 6145; },
    s => { s.artwork.width = 6144; s.artwork.height = 6144; }, s => { s.raster = null; }, s => { s.raster.left = -1; },
    s => { s.raster.width = s.file.width; }, s => { s.file = null; }, s => { s.file.width += 1; },
    s => { s.file.sha256 = "not-a-hash"; }, s => { s.dpi = Infinity; }, s => { s.dpi = 1; },
  ]) { const receipt = summary(); mutate(receipt.sides[0]); badDetail(receipt); }
});

test("private previews and print downloads bind exactly to the receipt and print side", () => {
  for (const mutate of [
    s => { s.previewUrl += "?download=1"; }, s => { s.previewUrl = `/api/cappatex/artwork/${BACK}`; },
    s => { s.downloadUrl = `/api/cappatex/preparations/${CPP}?side=back`; }, s => { s.downloadUrl += "&extra=1"; },
    s => { s.downloadUrl = `/api/cappatex/preparations/CPP-${"f".repeat(32)}?side=front`; },
    s => { s.downloadUrl = "https://other.example/print.png"; }, s => { delete s.downloadUrl; },
  ]) { const receipt = summary(); mutate(receipt.sides[0]); badDetail(receipt); }
});

test("checkout approval is preserved only when explicit and consistent, with no invented price or currency", () => {
  const blocked = parsePreparationResponse(summary());
  assert.equal(blocked.purchaseReady, false); assert.equal(blocked.checkout.enabled, false);
  assert.equal(blocked.checkout.unitPriceCents, undefined); assert.equal(blocked.checkout.currency, undefined);
  const enabled = summary(); enabled.purchaseReady = true;
  enabled.checkout = { enabled: true, reason: "Synthetic offline DTO; never a real sales approval.", unitPriceCents: 1990, currency: "CHF" };
  assert.deepEqual(parsePreparationResponse(enabled).checkout, enabled.checkout);
  for (const mutate of [
    r => { delete r.checkout; }, r => { r.checkout = null; }, r => { r.checkout.enabled = "true"; },
    r => { delete r.purchaseReady; }, r => { r.purchaseReady = false; }, r => { delete r.checkout.reason; },
    r => { delete r.checkout.unitPriceCents; }, r => { r.checkout.unitPriceCents = 19.9; },
    r => { r.checkout.unitPriceCents = NaN; }, r => { r.checkout.unitPriceCents = 0; },
    r => { r.checkout.unitPriceCents = Number.MAX_SAFE_INTEGER; }, r => { delete r.checkout.currency; }, r => { r.checkout.currency = "EUR"; },
  ]) { const receipt = structuredClone(enabled); mutate(receipt); badDetail(receipt); }
});

test("successful DTOs are reconstructed without extra internals and malformed responses expose only a fixed German error", () => {
  const receipt = summary(), raw = structuredClone(receipt);
  raw.email = "private@example.test"; raw.payload_json = "private/source.png"; raw.sides[0].file.key = "private/file.png";
  raw.sides[0].artwork.key = "private/original.png"; raw.checkout.secret = "server-only";
  assert.deepEqual(parsePreparationResponse(raw), receipt);
  const hostile = Object.defineProperty({}, "id", { get() { throw new Error("private database secret"); } });
  badDetail(hostile); badList(Object.defineProperty({}, "items", { get() { throw new Error("private database secret"); } }));
});

test("save confirmation binds the actual submitted composition for all families and accepts reordered front/back sides", () => {
  for (const profile of CAPPATEX_DESIGN_PROFILES) {
    const receipt = summary(profile.id, profile.backVariants ? ["front", "back"] : ["front"]), input = submittedInput(receipt);
    const before = structuredClone({ receipt, input });
    assert.deepEqual(parseSavedPreparationResponse(receipt, input), receipt);
    input.sides.reverse(); receipt.sides.reverse();
    assert.deepEqual(parseSavedPreparationResponse(receipt, input), receipt);
    receipt.sides.reverse();
    assert.deepEqual(parseSavedPreparationResponse(receipt, input), receipt, "The response may order sides differently from the request.");
    assert.equal(input.requestId, before.input.requestId, "Validation must neither generate nor replace a retry ID.");
    assert.deepEqual(receipt, before.receipt);
    assert.equal(parseSavedPreparationResponse(receipt, input).checkout.unitPriceCents, undefined);
  }
});

test("another otherwise valid receipt never confirms a different submitted profile, variant, quantity, country, motif or placement", () => {
  const mutations = [
    input => { input.profileId = "another-profile"; }, input => { input.profileVersion += "-other"; },
    input => { input.shopifyVariantId = "gid://shopify/ProductVariant/999"; }, input => { input.quantity = 3; },
    input => { input.country = "CH"; }, input => { input.sides.pop(); },
    input => { input.sides[0].designId = BACK; }, input => { input.sides[1].designId = FRONT; },
    input => { input.sides[0].placement.x += .01; }, input => { input.sides[0].placement.y += .01; },
    input => { input.sides[0].placement.scale += .01; }, input => { input.sides[1].placement.x += .01; },
    input => { input.sides[1].placement.y += .01; }, input => { input.sides[1].placement.scale += .01; },
    input => { input.sides[0].position = "back"; }, input => { input.requestId = "invalid-request"; },
  ];
  for (const mutate of mutations) {
    const receipt = summary(), input = submittedInput(receipt); mutate(input);
    assert.throws(() => parseSavedPreparationResponse(receipt, input), {
      message: "Die Speicherbestätigung passt nicht zu deiner Auswahl. Bitte prüfe dieselbe Speicherung erneut.",
    });
  }
  assert.throws(() => parseSavedPreparationResponse({ variant: null }, submittedInput()), /Bitte prüfe dieselbe Speicherung erneut/);
});
