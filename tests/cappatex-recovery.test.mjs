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

const { accountDraftKey, assertDiscardTarget, conflictsWithLocalMotif, inspectLocalDraft, recoveryUrl } = await import("../app/cappatex-recovery.ts");
const FRONT = "CPX-AAAAAAAAAAAA", BACK = "CPX-BBBBBBBBBBBB", OTHER = "CPX-CCCCCCCCCCCC";
const REQUEST = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function reference() {
  const side = (position, designId) => ({ position, designId, placement: { x: .43, y: .51, scale: .23 }, width: 2048, height: 1536 });
  return { version: 1, profileId: "verified-tee", profileVersion: "version-one", variantId: "gid://shopify/ProductVariant/123",
    calibration: "exact-profile-geometry", quantity: 2, country: "CH", side: "back",
    working: [side("front", FRONT), side("back", BACK)], selections: [side("front", FRONT), side("back", BACK)],
    requestId: REQUEST, pendingSignature: "exact ambiguous save payload", savedSignature: null };
}

test("missing local data is distinct from damaged, blank, oversized or old-schema local data", () => {
  assert.deepEqual(inspectLocalDraft(null), { kind: "empty", reference: null });
  for (const raw of ["", "{", "null", "{}", "x".repeat(30001), JSON.stringify({ ...reference(), version: 0 })])
    assert.deepEqual(inspectLocalDraft(raw), { kind: "invalid", reference: null });
  const original = JSON.stringify(reference());
  assert.deepEqual(inspectLocalDraft(original), { kind: "valid", reference: reference() });
  assert.equal(original, JSON.stringify(reference()), "Inspection must never repair or replace the browser's original bytes.");
});

test("a different gallery motif requires a decision while each correct front/back source stays distinct", () => {
  const local = reference(), original = structuredClone(local);
  assert.equal(conflictsWithLocalMotif(local, FRONT, "front"), false);
  assert.equal(conflictsWithLocalMotif(local, BACK, "back"), false);
  assert.equal(conflictsWithLocalMotif(local, OTHER, "back"), true);
  assert.equal(conflictsWithLocalMotif(local, BACK, "front"), true);
  assert.equal(conflictsWithLocalMotif(local, "", "back"), false);
  local.working = local.working.filter(side => side.position !== "back");
  assert.equal(conflictsWithLocalMotif(local, BACK, "back"), true);
  assert.deepEqual(original.working.map(side => side.designId), [FRONT, BACK]);
});

test("retry keeps the exact saved reference and ambiguous request id; opening local only clears URL intent", () => {
  const raw = JSON.stringify(reference());
  const current = `https://shop.example.test/cappatex?designId=${BACK}&profileId=verified-tee&variantId=gid%3A%2F%2Fshopify%2FProductVariant%2F123&side=back&preparationId=CPP-${"a".repeat(32)}&quantity=2&country=CH&x=0.43&y=0.51&scale=0.23&products=%5B%5D&utm_source=gallery#studio`;
  assert.equal(recoveryUrl(current, "retry"), current);
  assert.equal(recoveryUrl(current, "retry", BACK), current);
  const local = new URL(recoveryUrl(current, "local", OTHER));
  assert.equal(local.origin, new URL(current).origin); assert.equal(local.pathname, "/cappatex");
  assert.equal(local.search, "?utm_source=gallery"); assert.equal(local.hash, "#studio");
  const inspected = inspectLocalDraft(raw);
  assert.equal(inspected.reference.requestId, REQUEST);
  assert.equal(inspected.reference.pendingSignature, "exact ambiguous save payload");
  assert.equal(raw, JSON.stringify(reference()));
});

test("an owned motif created during a catalog outage survives retry without stale placement or CPP substitution", () => {
  const current = `https://shop.example.test/cappatex?designId=${FRONT}&preparationId=CPP-${"a".repeat(32)}&resume=1&profileId=old-profile&variantId=old-variant&side=back&x=.1&y=.3&scale=.7&quantity=4&country=LI&products=old&utm_source=test`;
  const retry = new URL(recoveryUrl(current, "retry", OTHER));
  assert.equal(retry.origin, "https://shop.example.test");
  assert.equal(retry.searchParams.get("designId"), OTHER);
  assert.deepEqual([...retry.searchParams.keys()].sort(), ["designId", "utm_source"]);
  assert.equal(retry.hash, "#studio");
  const invalid = new URL(recoveryUrl(current, "retry", "unverified"));
  assert.equal(invalid.searchParams.get("preparationId"), `CPP-${"a".repeat(32)}`);
});

test("the local key is account-scoped and no unconfirmed account can authorize discarding", async () => {
  const a = await accountDraftKey("  Owner@Example.test  "), b = await accountDraftKey("other@example.test");
  assert.match(a, /^cappatex-draft-v1:[a-f0-9]{64}$/);
  assert.equal(a, await accountDraftKey("owner@example.test")); assert.notEqual(a, b);
  assert.equal(a.includes("owner"), false);
  for (const email of [null, undefined, "", " ", {}, 7]) await assert.rejects(accountDraftKey(email), /Konto konnte nicht bestätigt/);
  const raw = JSON.stringify(reference());
  assert.doesNotThrow(() => assertDiscardTarget(a, a, raw, raw));
  assert.doesNotThrow(() => assertDiscardTarget(a, a, "", ""), "A damaged blank value can be discarded explicitly.");
  assert.throws(() => assertDiscardTarget(a, b, raw, raw), /Konto hat sich geändert/);
  assert.throws(() => assertDiscardTarget("other-key", "other-key", raw, raw), /Konto hat sich geändert/);
  assert.throws(() => assertDiscardTarget(a, a, raw, raw + " "), /Entwurf hat sich inzwischen geändert/);
  assert.throws(() => assertDiscardTarget(a, a, raw, null), /Entwurf hat sich inzwischen geändert/);
  assert.throws(() => assertDiscardTarget(a, a, undefined, null), /Entwurf hat sich inzwischen geändert/);
});
