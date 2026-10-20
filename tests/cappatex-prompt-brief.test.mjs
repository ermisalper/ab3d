import assert from "node:assert/strict";
import test from "node:test";
import { composePromptBrief, newPromptBrief } from "../app/cappatex-prompt-brief.ts";

test("blank optional wishes leave the manual description intact and cannot be applied", () => {
  const brief = { colors: "  ", lettering: "\n", details: "\t", avoid: "" };
  const result = composePromptBrief("  Eine alpine Blume  ", brief);
  assert.equal(result.prompt, "Eine alpine Blume");
  assert.equal(result.hasOptions, false);
  assert.equal(result.canApply, false);
  assert.equal(composePromptBrief("", newPromptBrief()).prompt, "");
});

test("wishes are trimmed and composed in a predictable visible order, with exact quoted lettering", () => {
  const result = composePromptBrief("  Eine alpine Blume  ", {
    colors: " Terracotta und Creme ", lettering: " Grüezi, Zürich! ", details: " Feine Linien, viel freier Raum ", avoid: " Rahmen ",
  });
  assert.equal(result.prompt, "Eine alpine Blume\nFarben: Terracotta und Creme\nSchriftzug (genau): „Grüezi, Zürich!“\nDetails und Bildaufbau: Feine Linien, viel freier Raum\nVermeiden: Rahmen");
  assert.equal(result.length, result.prompt.length);
  assert.equal(result.canApply, true);
});

test("exactly 500 characters can be applied, while 501 remain visible and cannot be applied", () => {
  const brief = { ...newPromptBrief(), colors: "Rot" };
  const suffix = "\nFarben: Rot";
  const exact = composePromptBrief("x".repeat(500 - suffix.length), brief);
  assert.equal(exact.length, 500); assert.equal(exact.canApply, true);
  const tooLong = composePromptBrief("x".repeat(501 - suffix.length), brief);
  assert.equal(tooLong.length, 501); assert.equal(tooLong.canApply, false);
  assert.equal(tooLong.prompt, "x".repeat(501 - suffix.length) + suffix, "Never truncate a customer's instructions");
});

test("short descriptions remain unusable until the composed brief meets the generation minimum", () => {
  const short = composePromptBrief("", { ...newPromptBrief(), colors: "R" });
  assert.equal(short.length, 9); assert.equal(short.canApply, false);
  const exact = composePromptBrief("", { ...newPromptBrief(), colors: "Rosa" });
  assert.equal(exact.length, 12); assert.equal(exact.canApply, true);
});

test("composition always uses the current manual value and never mutates helper fields", () => {
  const brief = Object.freeze({ colors: " Blau ", lettering: " Keep  two  spaces ", details: "", avoid: "" });
  const before = structuredClone(brief);
  const first = composePromptBrief("Ein Schmetterling", brief);
  const updated = composePromptBrief("Eine Berglandschaft", brief);
  assert.ok(first.prompt.startsWith("Ein Schmetterling\n"));
  assert.ok(updated.prompt.startsWith("Eine Berglandschaft\n"));
  assert.ok(!updated.prompt.includes("Schmetterling"));
  assert.ok(updated.prompt.includes("„Keep  two  spaces“"));
  assert.deepEqual(brief, before);
  const fresh = newPromptBrief(); fresh.colors = "Rot";
  assert.equal(newPromptBrief().colors, "", "Helper instances must not share mutable state");
});
