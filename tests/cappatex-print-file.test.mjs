import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { encode, decode } from "fast-png";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(specifier, context);
} });
const { renderPrintFile } = await import("../app/cappatex-print-file.ts");
const area = (w, h) => ({ position: "front", decorationMethod: "dtg", widthPx: w, heightPx: h,
  widthMm: w * 25.4 / 300, heightMm: h * 25.4 / 300, minDpi: 300, minScale: .01, maxScale: 1 });
const image = (w, h, color) => encode({ width: w, height: h, channels: 4, depth: 8,
  data: Uint8Array.from({ length: w*h*4 }, (_, i) => color[i%4]) });
const pixel = (png, x, y) => [...png.data.slice((y*png.width+x)*4, (y*png.width+x)*4+4)];

test("print raster keeps exact placement, alpha and colours; repeat is byte-identical", async () => {
  const input = image(4, 2, [13, 61, 245, 128]);
  const placement = { x: .75, y: .25, scale: .5 };
  const result = await renderPrintFile(input, area(8,8), placement);
  assert.deepEqual(result.raster, { left: 4, top: 1, width: 4, height: 2 });
  const png = decode(result.bytes, { checkCrc: true });
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++)
    assert.deepEqual(pixel(png,x,y), x >= 4 && y >= 1 && y < 3 ? [13,61,245,128] : [0,0,0,0]);
  assert.deepEqual((await renderPrintFile(input, area(8,8), placement)).bytes, result.bytes);
});

test("downsampling weights colour by alpha without a dark transparent fringe", async () => {
  const bytes = encode({ width: 2, height: 2, channels: 4, depth: 8,
    data: Uint8Array.from([255,0,0,255, 0,0,0,0, 0,0,255,255, 0,255,0,0]) });
  const result = await renderPrintFile(bytes, area(2,2), { x:.25, y:.25, scale:.5 });
  assert.deepEqual(pixel(decode(result.bytes),0,0), [128,0,128,128]);
  assert.deepEqual(pixel(decode(result.bytes),1,0), [0,0,0,0]);
});

test("generated original provenance is accepted without changing pixels; uploads remain strict", async () => {
  const original = image(4,2,[25,75,125,255]);
  const block = Buffer.alloc(18); block.writeUInt32BE(6); block.write("caBX",4); block.write("source",8);
  let crc = 0xffffffff;
  for (const byte of block.subarray(4,-4)) { crc ^= byte; for (let b=0;b<8;b++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  block.writeUInt32BE((crc ^ 0xffffffff) >>> 0,block.length-4);
  const generated = Buffer.concat([original.subarray(0,33),block,original.subarray(33)]);
  const placement = {x:.5,y:.5,scale:1};
  await assert.rejects(renderPrintFile(generated,area(4,2),placement),/unsupported_upload/);
  const result = await renderPrintFile(generated,area(4,2),placement,"generated");
  assert.deepEqual(result.bytes,(await renderPrintFile(original,area(4,2),placement)).bytes);
  const damaged = generated.slice(); damaged[42] ^= 1;
  await assert.rejects(renderPrintFile(damaged,area(4,2),placement,"generated"));
});

test("non-integer resize preserves coverage and rejects out of bounds / insufficient DPI", async () => {
  const input = image(5,3,[200,30,10,255]);
  const result = await renderPrintFile(input, area(10,10), { x:.85, y:.9, scale:.3 });
  assert.deepEqual(result.raster,{left:7,top:8,width:3,height:2});
  assert.deepEqual(pixel(decode(result.bytes),9,9),[200,30,10,255]);
  await assert.rejects(renderPrintFile(input, area(10,10), {x:1,y:.5,scale:.5}), /invalid_placement/);
  await assert.rejects(renderPrintFile(input, area(100,100), {x:.5,y:.5,scale:.5}), /invalid_placement/);
  await assert.rejects(renderPrintFile(input, area(11000,100), {x:.5,y:.5,scale:.01}));
});

test("large provider print area is streamed at its original dimensions", async () => {
  const started = performance.now();
  const result = await renderPrintFile(image(2048,2048,[35,190,80,255]), area(4606,5787), {x:.5,y:.4,scale:.4});
  assert.equal(result.width,4606); assert.equal(result.height,5787);
  assert.deepEqual(result.raster,{left:1382,top:1394,width:1842,height:1842});
  // Parse header without allocating the 106 MB decoded print canvas in the test.
  const view = new DataView(result.bytes.buffer,result.bytes.byteOffset);
  assert.equal(view.getUint32(16),4606); assert.equal(view.getUint32(20),5787);
  assert.ok(result.bytes.length < 1_000_000);
  console.log(`Large print raster: ${Math.round(performance.now()-started)} ms, ${result.bytes.length} bytes`);
});
