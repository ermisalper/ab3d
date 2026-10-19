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
const { printRaster, assertPreparedRaster, printProofDimensions } = await import("../app/cappatex-print-raster.ts");
const { CAPPATEX_DESIGN_PROFILES } = await import("../app/cappatex-design-profiles.ts");
const area = (width, height) => ({ position: "front", decorationMethod: "dtg", widthPx: width, heightPx: height,
  widthMm: width * 25.4 / 300, heightMm: height * 25.4 / 300, minDpi: 300, minScale: .01, maxScale: 1 });

test("independent width and height rounding preserves the existing actual hoodie pixels", () => {
  const hoodie = CAPPATEX_DESIGN_PROFILES.find(profile => profile.id === "bc-king-hoodie-opt-front");
  const front = hoodie.variants.find(v => v.size === "S" && v.color === "White");
  assert.deepEqual([front.area.widthPx, front.area.heightPx], [3543, 2591]);
  const result = printRaster(front.area, { width: 2048, height: 1536 }, { x: .42, y: .47, scale: .2 });
  assert.deepEqual({ ...result, dpi: undefined }, { left: 1134, top: 952, width: 709, height: 531, dpi: undefined });
  assert.equal(Math.round(result.width * 1536 / 2048), 532, "Recomputing height from rounded width would change an existing print.");
  assert.ok(Math.abs(result.dpi - 867.0618120237085) < 1e-9);
});

test("edge quantization and actual poster placement match established rgba-area-v1 coordinates", () => {
  const edge = printRaster(area(10, 10), { width: 5, height: 3 }, { x: .85, y: .9, scale: .3 });
  assert.deepEqual({ ...edge, dpi: undefined }, { left: 7, top: 8, width: 3, height: 2, dpi: undefined });
  const poster = CAPPATEX_DESIGN_PROFILES.find(p => p.id === "poster-eu-opt-front").variants.find(v => v.area.widthPx === 2490);
  const raster = printRaster(poster.area, { width: 1025, height: 1025 }, { x: .5, y: .5, scale: 257 / 2490 });
  assert.deepEqual({ ...raster, dpi: undefined }, { left: 1117, top: 1627, width: 257, height: 257, dpi: undefined });
  assert.ok(raster.dpi > 1196);
});

test("saved metadata must match every pixel coordinate and source DPI, not just fit inside the canvas", () => {
  const printArea = area(8, 8), artwork = { width: 4, height: 2 }, placement = { x: .75, y: .25, scale: .5 };
  const valid = { area: printArea, artwork, placement, raster: { left: 4, top: 1, width: 4, height: 2 }, dpi: 300 };
  assert.doesNotThrow(() => assertPreparedRaster(valid));
  for (const key of ["left", "top", "width", "height"]) {
    const wrong = structuredClone(valid); wrong.raster[key] += 1;
    assert.throws(() => assertPreparedRaster(wrong), /prepared_raster_changed/);
  }
  for (const dpi of [299, 301, NaN, Infinity, "300"]) assert.throws(() => assertPreparedRaster({ ...valid, dpi }), /prepared_raster_changed/);
  assert.throws(() => assertPreparedRaster({ ...valid, raster: { left: 0, top: 0, width: 1, height: 1 } }), /prepared_raster_changed/);
  assert.throws(() => assertPreparedRaster({ ...valid, raster: null }), /prepared_raster_changed/);
});

test("invalid placement, insufficient source resolution, fractional source sizes and oversized canvases fail closed", () => {
  for (const placement of [{ x: .01, y: .01, scale: .5 }, { x: .5, y: .5, scale: 0 },
    { x: .5, y: .5, scale: NaN }, { x: Infinity, y: .5, scale: .5 }])
    assert.throws(() => printRaster(area(100, 100), { width: 200, height: 200 }, placement));
  assert.throws(() => printRaster(area(100, 100), { width: 10, height: 10 }, { x: .5, y: .5, scale: .5 }), /invalid_placement/);
  assert.throws(() => printRaster(area(100, 100), { width: 200.5, height: 200 }, { x: .5, y: .5, scale: .5 }), /invalid_raster_bounds/);
  for (const [width, height] of [[10001, 100], [100, 10001], [10000, 10000], [10.5, 10]])
    assert.throws(() => printRaster(area(width, height), { width: width * 2, height: height * 2 }, { x: .5, y: .5, scale: .1 }), /print_area_too_large/);
});

test("proof dimensions use the final canvas orientation, remain bounded and never enlarge small prints", () => {
  for (const [width, height, expected] of [[2490, 3510, { width: 363, height: 512 }], [3510, 4950, { width: 363, height: 512 }],
    [4200, 3071, { width: 512, height: 374 }], [4200, 4800, { width: 448, height: 512 }],
    [4606, 5787, { width: 408, height: 512 }], [12, 5, { width: 12, height: 5 }],
    [1, 10000, { width: 1, height: 512 }], [10000, 4000, { width: 512, height: 205 }]])
    assert.deepEqual(printProofDimensions(width, height), expected);
  for (const [width, height] of [[0, 1], [1, -1], [1.5, 3], [Infinity, 1], [10001, 1], [10000, 10000], ["100", 100]])
    assert.throws(() => printProofDimensions(width, height), /print_area_too_large/);
});
