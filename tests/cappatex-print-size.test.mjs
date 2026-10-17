import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(specifier, context);
} });
const { maximumPrintSizeCm, printSizeHelp } = await import("../app/cappatex-print-size.ts");
const area = (widthPx, heightPx, minDpi = 300) => ({ position: "front", decorationMethod: "dtg", widthPx, heightPx,
  widthMm: widthPx * 25.4 / 300, heightMm: heightPx * 25.4 / 300, minDpi, minScale: .1, maxScale: 1 });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);

test("maximum physical dimensions use original image pixels and the selected minimum DPI", () => {
  const original = maximumPrintSizeCm({ width: 2048, height: 3072 }, 300);
  close(original.maxWidthCm, 17.3397333333333); close(original.maxHeightCm, 26.0096);
  const lowerDpi = maximumPrintSizeCm({ width: 2048, height: 3072 }, 150);
  close(lowerDpi.maxWidthCm, original.maxWidthCm * 2); close(lowerDpi.maxHeightCm, original.maxHeightCm * 2);
});

test("current A3 and A4 poster areas need a partial-area warning for a supported portrait image", () => {
  for (const [width, height] of [[3510, 4950], [2490, 3510]]) {
    const result = printSizeHelp({ width: 2048, height: 3072 }, area(width, height));
    assert.equal(result.insufficientResolutionForFullArea, true);
    assert.equal(result.canPlaceAtMinimumDpi, true);
    assert.equal(result.aspectMatches, false);
    assert.ok(result.fullAreaDpi < 300);
  }
});

test("exact minimum resolution is sufficient, while a single missing pixel is not", () => {
  const exact = printSizeHelp({ width: 300, height: 450 }, area(300, 450));
  assert.equal(exact.insufficientResolutionForFullArea, false); assert.equal(exact.aspectMatches, true);
  close(exact.fullAreaDpi, 300);
  assert.equal(printSizeHelp({ width: 299, height: 450 }, area(300, 450)).insufficientResolutionForFullArea, true);
});

test("a wide image with plenty of horizontal pixels still lacks resolution along its short axis", () => {
  const result = printSizeHelp({ width: 1200, height: 200 }, area(600, 600));
  close(result.fullAreaDpi, 100);
  assert.equal(result.insufficientResolutionForFullArea, true);
  assert.equal(result.canPlaceAtMinimumDpi, true); assert.equal(result.aspectMatches, false);
});

test("aspect mismatch alone does not falsely report a resolution shortage", () => {
  const result = printSizeHelp({ width: 1200, height: 600 }, area(600, 600));
  assert.equal(result.aspectMatches, false); assert.equal(result.insufficientResolutionForFullArea, false);
  assert.equal(result.canPlaceAtMinimumDpi, true); close(result.fullAreaDpi, 300);
});

test("tiny images are not described as usable partial prints when minimum placement size still fails DPI", () => {
  const result = printSizeHelp({ width: 10, height: 10 }, area(600, 600));
  assert.equal(result.insufficientResolutionForFullArea, true); assert.equal(result.canPlaceAtMinimumDpi, false);
});

test("switching to a different rear print area recalculates the physical coverage requirement", () => {
  const image = { width: 600, height: 600 };
  assert.equal(printSizeHelp(image, area(600, 600)).insufficientResolutionForFullArea, false);
  assert.equal(printSizeHelp(image, { ...area(1200, 1500), position: "back" }).insufficientResolutionForFullArea, true);
});

test("invalid image, DPI and placeholder dimensions cannot produce reassuring size guidance", () => {
  for (const image of [{ width: 0, height: 30 }, { width: 3.5, height: 30 }, { width: Infinity, height: 30 }])
    assert.equal(printSizeHelp(image, area(600, 600)), null);
  for (const minDpi of [0, -1, NaN, Infinity]) assert.equal(maximumPrintSizeCm({ width: 300, height: 450 }, minDpi), null);
  assert.equal(printSizeHelp({ width: 300, height: 450 }, { ...area(600, 600), widthMm: 0 }), null);
});
