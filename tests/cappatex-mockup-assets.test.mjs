import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { CAPPATEX_DESIGN_PROFILES } from "../app/cappatex-design-profiles.ts";
import { CAPPATEX_LEGACY_MOCKUPS, CAPPATEX_MOCKUP_ASSETS, knownLegacyMockup, resolveMockupAsset } from "../app/cappatex-mockup-assets.ts";
import { customerImageSize } from "../app/cappatex-upload-client.ts";

const root = new URL("../", import.meta.url);
const assets = Object.values(CAPPATEX_MOCKUP_ASSETS);
const legacy = Object.values(CAPPATEX_LEGACY_MOCKUPS);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const evidence = JSON.parse(readFileSync(new URL("docs/evidence/cappatex-mockup-assets.json", root), "utf8"));
const profileMockups = new Map(CAPPATEX_DESIGN_PROFILES.flatMap(profile => [...profile.variants, ...(profile.backVariants || [])]
  .map(variant => [variant.mockup.url, { profileId: profile.id, position: variant.area.position, mockup: variant.mockup }])));
const mockup = asset => ({ url: asset.sourceUrl, width: asset.width, height: asset.height });

test("every frozen reference has the exact committed JPEG bytes, content address and measured dimensions", () => {
  assert.equal(assets.length, 26);
  assert.equal(new Set(assets.map(asset => asset.sha256)).size, 26);
  assert.deepEqual(new Set(readdirSync(new URL("public/cappatex/mockups/", root))), new Set(assets.map(asset => `${asset.sha256}.jpg`)));
  for (const asset of assets) {
    const bytes = readFileSync(new URL(`public${asset.src}`, root));
    assert.equal(digest(bytes), asset.sha256, asset.sourceUrl);
    assert.match(asset.src, /^\/cappatex\/mockups\/[a-f0-9]{64}\.jpg$/);
    assert.equal(asset.src, `/cappatex/mockups/${asset.sha256}.jpg`);
    assert.deepEqual(customerImageSize(bytes, "image/jpeg"), { width: asset.width, height: asset.height });
    assert.deepEqual([asset.width, asset.height], [1200, 1200]);
    const source = new URL(asset.sourceUrl);
    assert.equal(source.origin, "https://images.printify.com");
    assert.equal(source.username, ""); assert.equal(source.password, "");
    assert.ok(["front", "back"].includes(source.searchParams.get("camera_label")));
  }
});

test("all six actual families keep their existing profile URLs while 26 exact photo references resolve locally", () => {
  assert.equal(CAPPATEX_DESIGN_PROFILES.length, 6);
  assert.equal(profileMockups.size, 28);
  let pinned = 0, exceptions = 0;
  for (const [sourceUrl, reference] of profileMockups) {
    const before = structuredClone(reference.mockup), result = resolveMockupAsset(reference.mockup);
    assert.deepEqual(reference.mockup, before, "Resolving a photo must not rewrite CPP/session/profile identity.");
    if (result.verified) {
      pinned++;
      assert.equal(result.sourceUrl, sourceUrl);
      assert.ok(result.src.startsWith("/cappatex/mockups/"));
      assert.notEqual(result.src, sourceUrl);
      assert.equal(knownLegacyMockup(reference.mockup), false);
    } else {
      exceptions++;
      assert.equal(result.reason, "missing_evidence");
      assert.equal(reference.profileId, "gildan-64000-opt-front");
      assert.equal(reference.position, "back");
      assert.equal(knownLegacyMockup(reference.mockup), true);
      assert.equal("src" in result, false, "An unresolved photo must never silently return a remote source.");
    }
  }
  assert.equal(pinned, 26); assert.equal(exceptions, 2);
  for (const asset of assets) assert.ok(profileMockups.has(asset.sourceUrl), "No unsupported product/photo gains a registration.");
});

test("the two legacy rear references are exact compatibility exceptions without invented hashes or local sources", () => {
  assert.equal(legacy.length, 2);
  assert.deepEqual(legacy.map(asset => new URL(asset.sourceUrl).pathname.split("/")[3]).sort(), ["38191", "38192"]);
  for (const asset of legacy) {
    assert.equal(new URL(asset.sourceUrl).pathname.split("/")[2], "6ac927b73b3a3e64620a53a3");
    assert.equal(new URL(asset.sourceUrl).searchParams.get("camera_label"), "back");
    assert.equal(asset.reason, "historical_source_bytes_unavailable");
    assert.equal("sha256" in asset, false); assert.equal("src" in asset, false);
    assert.equal(knownLegacyMockup(mockup(asset)), true);
    for (const changed of [
      { ...mockup(asset), width: 1199 }, { ...mockup(asset), height: 1201 }, { ...mockup(asset), width: "1200" },
      { ...mockup(asset), url: asset.sourceUrl + "&changed=1" },
      { ...mockup(asset), url: asset.sourceUrl.replace("camera_label=back", "camera_label=front") },
    ]) assert.equal(knownLegacyMockup(changed), false);
  }
});

test("same dimensions alone cannot approve an unknown, redirected or altered photo URL", () => {
  const asset = assets[0];
  for (const url of [
    "https://images.printify.com/mockup/unverified/38191/photo.jpg?camera_label=front",
    asset.sourceUrl + "&t=new-content", asset.sourceUrl.replace("images.printify.com", "images.printify.com.evil.test"),
    asset.sourceUrl.replace("https:", "http:"), "/cappatex/mockups/unknown.jpg", "__proto__", "constructor",
  ]) {
    assert.deepEqual(resolveMockupAsset({ url, width: 1200, height: 1200 }), { verified: false, reason: "missing_evidence", sourceUrl: url });
    assert.equal(knownLegacyMockup({ url, width: 1200, height: 1200 }), false);
  }
});

test("known URLs with changed dimensions or malformed metadata remain unverified", () => {
  const asset = assets[0];
  for (const candidate of [{ ...mockup(asset), width: 1199 }, { ...mockup(asset), height: 1201 }])
    assert.deepEqual(resolveMockupAsset(candidate), { verified: false, reason: "dimensions_mismatch", sourceUrl: asset.sourceUrl });
  for (const candidate of [null, undefined, [], 1200, "photo", {}, { url: asset.sourceUrl },
    { ...mockup(asset), width: "1200" }, { ...mockup(asset), height: Infinity }, { ...mockup(asset), width: 0 },
    { ...mockup(asset), width: 1200.5 }]) {
    assert.deepEqual(resolveMockupAsset(candidate), { verified: false, reason: "invalid_mockup" });
    assert.equal(knownLegacyMockup(candidate), false);
  }
});

test("an unchanged photo URL or JPEG size is not a substitute for its byte fingerprint", () => {
  const asset = assets[0], original = readFileSync(new URL(`public${asset.src}`, root));
  const changed = new Uint8Array(original); changed[changed.length - 3] ^= 1;
  assert.deepEqual(customerImageSize(changed, "image/jpeg"), { width: 1200, height: 1200 });
  assert.notEqual(digest(changed), asset.sha256);
  // The UI source is the frozen content address rather than another read of the mutable URL.
  assert.equal(resolveMockupAsset(mockup(asset)).src, `/cappatex/mockups/${digest(original)}.jpg`);
});

test("the public asset registry cannot be mutated through exports or a resolved result", () => {
  assert.equal(Object.isFrozen(CAPPATEX_MOCKUP_ASSETS), true);
  assert.equal(Object.isFrozen(CAPPATEX_LEGACY_MOCKUPS), true);
  for (const row of [...assets, ...legacy]) assert.equal(Object.isFrozen(row), true);
  const asset = assets[0], result = resolveMockupAsset(mockup(asset));
  result.src = "/changed.jpg";
  assert.equal(resolveMockupAsset(mockup(asset)).src, asset.src);
  assert.throws(() => { CAPPATEX_MOCKUP_ASSETS[asset.sourceUrl].src = "/changed.jpg"; });
});

test("committed evidence inventories the exact assets and honestly records both unresolved historical references", () => {
  assert.equal(evidence.schemaVersion, 1); assert.equal(evidence.profileSourceCommit, "73ef274");
  assert.equal(evidence.assets.length, 26); assert.equal(evidence.unresolved.length, 2);
  for (const asset of assets) {
    const matches = evidence.assets.filter(row => row.sourceUrl === asset.sourceUrl);
    assert.equal(matches.length, 1);
    const row = matches[0];
    for (const key of ["src", "sha256", "width", "height"]) assert.equal(row[key], asset[key]);
    assert.equal(row.bytes, readFileSync(new URL(`public${asset.src}`, root)).length);
    assert.equal(row.profileId, profileMockups.get(asset.sourceUrl).profileId);
    assert.ok(row.calibrationEvidence.every(file => file.startsWith("docs/") && readFileSync(new URL(file, root)).length > 0));
  }
  for (const unresolved of evidence.unresolved) {
    assert.equal(unresolved.sha256, null);
    assert.equal(knownLegacyMockup({ url: unresolved.sourceUrl, width: unresolved.width, height: unresolved.height }), true);
  }
});
