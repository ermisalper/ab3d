import assert from "node:assert/strict";
import { after, test } from "node:test";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(specifier, context);
} });
const { cappatexReadiness, recordedEvidenceStatus } = await import("../app/cappatex-readiness.ts");
const { CAPPATEX_DESIGN_PROFILES } = await import("../app/cappatex-design-profiles.ts");
const { CAPPATEX_PRINT_PROFILES } = await import("../app/cappatex-profiles.ts");
const { CAPPATEX_SHIPPING_RELEASES } = await import("../app/cappatex-shipping-releases.ts");
const { TOKEN_PACK_RELEASES } = await import("../app/token-pack-releases.ts");
after(() => hook.deregister());
const now = Date.parse("2026-10-20T18:00:00Z");
const input = () => ({ designProfiles: structuredClone(CAPPATEX_DESIGN_PROFILES), salesProfiles: [], shippingReleases: [], tokenReleases: [] });
const row = (result, id) => result.rows.find(item => item.id === id);

test("read-only evidence preserves historical dates and never invents live approval or register entries", () => {
  const fixture = input(), before = JSON.stringify(fixture);
  const summary = cappatexReadiness(fixture, now);
  assert.equal(JSON.stringify(fixture), before);
  assert.equal(summary.checkedAt, now);
  assert.equal(summary.externalChecksPerformed, false);
  assert.equal(new Set(summary.rows.map(item => item.id)).size, summary.rows.length);
  assert.equal(row(summary, "variant-mapping").basis[0].recordedAt, "2026-10-17");
  assert.equal(row(summary, "print-files").scope, "Dokumentierter Offline-Prüfstand");
  assert.equal(row(summary, "payment-separation").scope, "Dokumentierter Offline-Prüfstand");
  assert.equal(row(summary, "webhook-delivery").status, "ungeprueft");
  for (const id of ["sales-prices", "customer-shipping", "required-labels", "token-variants"])
    assert.equal(row(summary, id).status, "blockiert");
  for (const registry of [CAPPATEX_PRINT_PROFILES, CAPPATEX_SHIPPING_RELEASES, TOKEN_PACK_RELEASES]) assert.equal(registry.length, 0);
});

test("expiry uses recorded validity boundaries; old, invalid and future evidence cannot gain invented freshness", () => {
  const longLived = { verifiedAt: "2020-01-01T00:00:00Z", validUntil: "2030-01-01T00:00:00Z" };
  assert.equal(recordedEvidenceStatus([longLived], now), "belegt", "No arbitrary age/TTL policy is introduced");
  const boundary = { verifiedAt: "2026-10-10T00:00:00Z", validUntil: "2026-10-20T18:00:00Z" };
  assert.equal(recordedEvidenceStatus([boundary], now - 1), "belegt");
  assert.equal(recordedEvidenceStatus([boundary], now), "veraltet");
  assert.equal(recordedEvidenceStatus([longLived, boundary], now), "veraltet");
  for (const records of [[], [{ ...longLived, verifiedAt: "not-a-date" }], [{ ...longLived, validUntil: "not-a-date" }],
    [{ ...longLived, verifiedAt: "2027-01-01T00:00:00Z" }], [{ verifiedAt: longLived.validUntil, validUntil: longLived.verifiedAt }]])
    assert.equal(recordedEvidenceStatus(records, now), "ungeprueft");
  const fixture = input(); fixture.designProfiles[0].validUntil = boundary.validUntil;
  assert.equal(row(cappatexReadiness(fixture, now), "print-sides").status, "veraltet");
  assert.equal(row(cappatexReadiness(fixture, now), "print-sides").basis[0].validUntil, boundary.validUntil);
});

test("missing photo contents, incorrect back binding and changed dimensions remain visible blockers", () => {
  let fixture = input();
  assert.equal(row(cappatexReadiness(fixture, now), "mockup-geometry").status, "blockiert", "Documented legacy T-shirt rear photos remain unresolved");
  assert.equal(row(cappatexReadiness(fixture, now), "print-sides").status, "belegt");
  fixture.designProfiles[0].backVariants[0].shopifyVariantId = "gid://shopify/ProductVariant/999999";
  assert.equal(row(cappatexReadiness(fixture, now), "print-sides").status, "blockiert");
  fixture = input(); fixture.designProfiles[0].variants[0].mockup.width = 1199;
  assert.equal(row(cappatexReadiness(fixture, now), "mockup-geometry").status, "blockiert");
  fixture = input(); fixture.designProfiles[0].variants[0].area.widthPx = -1;
  assert.equal(row(cappatexReadiness(fixture, now), "print-sides").status, "blockiert");
});

test("shipping entries expose actual expiry without fabricating tariffs or a live delivery check", () => {
  const fixture = input();
  // Only the documented fields are read; no invented tariff is supplied to a production registry.
  fixture.shippingReleases.push({ id: "offline-evidence", version: "offline-v1", reviewedAt: "2026-10-10T00:00:00Z", validUntil: "2026-10-21T00:00:00Z" });
  let summary = cappatexReadiness(fixture, now);
  assert.equal(row(summary, "customer-shipping").status, "ungeprueft");
  assert.equal(row(summary, "customer-shipping").basis[0].recordedAt, "2026-10-10T00:00:00Z");
  fixture.shippingReleases[0].validUntil = "2026-10-20T18:00:00Z";
  summary = cappatexReadiness(fixture, now);
  assert.equal(row(summary, "customer-shipping").status, "veraltet");
  assert.equal(summary.externalChecksPerformed, false);
});
