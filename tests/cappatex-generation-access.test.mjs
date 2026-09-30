import test from "node:test";
import assert from "node:assert/strict";
import { generationAccess } from "../app/cappatex-generation-access.ts";

test("owner pilot fails closed without an allowlist", () => {
  assert.deepEqual(generationAccess("owner@example.com", undefined, undefined), {
    allowed: false,
    reason: "owner_not_configured",
  });
});

test("owner pilot accepts only matching account emails", () => {
  assert.deepEqual(generationAccess(" BERK@example.com ", "owner", "other@example.com,berk@example.com"), {
    allowed: true,
    pilotOwner: true,
  });
  assert.deepEqual(generationAccess("customer@example.com", "owner", "berk@example.com"), {
    allowed: false,
    reason: "owner_only",
  });
});

test("subscriber access requires an explicit audience change", () => {
  assert.deepEqual(generationAccess("customer@example.com", "subscribers", undefined), {
    allowed: true,
    pilotOwner: false,
  });
  assert.deepEqual(generationAccess("customer@example.com", "everyone", "berk@example.com"), {
    allowed: false,
    reason: "invalid_audience",
  });
});
