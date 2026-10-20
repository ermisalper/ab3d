import assert from "node:assert/strict";
import { after, test } from "node:test";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(specifier, context);
} });
after(() => hooks.deregister());
const { isDirtyReviewDraft, mergeRecoveredReviewDrafts, parseReviewDrafts, reconcileReviewDraft, reviewDraft, serializeReviewDrafts } = await import("../app/betrieb/draft-storage.ts");
const id = "PRINT-ABCDE00001", second = "PRINT-ABCDE00002";
const saved = { state: "reviewing", notes: "Material prüfen", version: 2, updatedAt: 5, updatedBy: "owner@example.test" };
const unsaved = { ...reviewDraft(saved), notes: "Wandstärke zusätzlich prüfen" };

test("only unsaved work is cached and a successful matching save removes it", () => {
  assert.equal(serializeReviewDrafts({ [id]: reviewDraft(saved) }), null);
  const raw = serializeReviewDrafts({ [id]: unsaved, [second]: reviewDraft(saved) });
  assert.deepEqual(parseReviewDrafts(raw), { [id]: unsaved });
  assert.equal(raw.includes("owner@example.test"), false);
  assert.equal(raw.includes("updatedAt"), false);
  assert.equal(serializeReviewDrafts({ [id]: reviewDraft({ ...saved, notes: unsaved.notes, version: 3 }) }), null);
});
test("tab recovery retains drafts for multiple request selections", () => {
  const drafts = { [id]: unsaved, [second]: { ...unsaved, state: "needs_information", notes: "Rückfrage zur Höhe" } };
  assert.deepEqual(parseReviewDrafts(serializeReviewDrafts(drafts)), drafts);
  assert.equal(parseReviewDrafts(serializeReviewDrafts(drafts))[second].state, "needs_information");
});
test("a recovered dirty draft wins over a clean detail GET regardless of load ordering", () => {
  assert.deepEqual(mergeRecoveredReviewDrafts({ [id]: reviewDraft(saved) }, { [id]: unsaved }), { [id]: unsaved });
  assert.equal(reconcileReviewDraft(unsaved, { ...saved, version: 5, notes: "Anderer Prüfstand" }, false), unsaved);
});
test("new edits made in this mount win over an older recovered draft", () => {
  const current = { ...unsaved, notes: "Aktuelle Eingabe" };
  assert.equal(mergeRecoveredReviewDrafts({ [id]: current }, { [id]: unsaved })[id], current);
});
test("clean draft adopts newer server review but stale GET never rolls back confirmed revision", () => {
  const existing = reviewDraft(saved), incoming = { ...saved, version: 3, notes: "Neu gespeichert" };
  assert.deepEqual(reconcileReviewDraft(existing, incoming, false), reviewDraft(incoming));
  const newer = reviewDraft(incoming);
  assert.equal(reconcileReviewDraft(newer, saved, false), newer);
});
test("detail GET during an in-flight save does not replace the draft", () => {
  const existing = reviewDraft(saved);
  assert.equal(reconcileReviewDraft(existing, { ...saved, version: 9 }, true), existing);
});
test("state-only changes are dirty and recoverable", () => {
  const changed = { ...reviewDraft(saved), state: "reviewed" };
  assert.equal(isDirtyReviewDraft(changed), true);
  assert.deepEqual(parseReviewDrafts(serializeReviewDrafts({ [id]: changed })), { [id]: changed });
});
test("corrupt or oversized caches fail visibly instead of replacing local work", () => {
  for (const raw of ["invalid", "null", "[]", "x".repeat(800001), JSON.stringify({ [id]: { ...unsaved, notes: "x".repeat(3001) } })]) {
    assert.throws(() => parseReviewDrafts(raw));
  }
  assert.deepEqual(parseReviewDrafts(null), {});
});
test("unknown identifiers, states, revisions and extra data cannot enter draft recovery", () => {
  for (const payload of [
    { "__proto__": unsaved, invalid: unsaved }, { [id]: { ...unsaved, state: "production" } },
    { [id]: { ...unsaved, savedState: "paid" } }, { [id]: { ...unsaved, version: -1 } },
    { [id]: { ...unsaved, version: 0.1 } }, { [id]: { ...unsaved, version: 1000001 } },
    { [id]: { ...unsaved, savedNotes: "x".repeat(3001) } }, { [id]: { ...unsaved, email: "customer@example.test" } },
  ]) assert.throws(() => parseReviewDrafts(JSON.stringify(payload)));
});
test("draft count is bounded without silently dropping an unsaved request", () => {
  const tooMany = Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`PRINT-${String(index).padStart(10, "0")}`, unsaved]));
  assert.throws(() => serializeReviewDrafts(tooMany));
});
