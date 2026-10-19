import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { crc32, deflateSync } from "node:zlib";
import { decode, encode } from "fast-png";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const file = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(file)) return next(file.href, context);
  }
  return next(specifier, context);
} });
const { printFileProof } = await import("../app/cappatex-print-proof.ts");
const { renderPrintFile } = await import("../app/cappatex-print-file.ts");
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const area = (widthPx, heightPx) => ({ position: "front", decorationMethod: "dtg", widthPx, heightPx,
  widthMm: widthPx * 25.4 / 300, heightMm: heightPx * 25.4 / 300, minDpi: 300, minScale: .01, maxScale: 1 });

function chunk(type, payload = new Uint8Array()) {
  const result = Buffer.alloc(payload.length + 12);
  result.writeUInt32BE(payload.length); result.write(type, 4); result.set(payload, 8);
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
  return result;
}
function header(width, height, { depth = 8, color = 6, compression = 0, filter = 0, interlace = 0 } = {}) {
  const payload = Buffer.alloc(13); payload.writeUInt32BE(width); payload.writeUInt32BE(height, 4);
  payload.set([depth, color, compression, filter, interlace], 8); return chunk("IHDR", payload);
}
const density = () => chunk("pHYs", Uint8Array.of(0, 0, 46, 35, 0, 0, 46, 35, 1));
function rgbaRows(width, height) {
  const data = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([12, 34, 56, 128], y * (width * 4 + 1) + 1 + x * 4);
  return data;
}
function fixture(width, height, { raw, compressed, metadata = [density()], fields, split = false } = {}) {
  const data = compressed || deflateSync(raw || rgbaRows(width, height));
  const idat = split ? [...data].map(byte => chunk("IDAT", Uint8Array.of(byte))) : [chunk("IDAT", data)];
  return Buffer.concat([signature, header(width, height, fields), ...metadata, ...idat, chunk("IEND")]);
}
function source(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data.set([(x * 19 + y) % 256, (y * 23 + x) % 256, (x + y * 3) % 256, (x + y) % 5 === 0 ? 0 : (x + y) % 3 ? 255 : 85], i);
  }
  return encode({ width, height, channels: 4, depth: 8, data });
}
function oracle(input, width, height) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(input.width - 1, Math.floor((x + .5) * input.width / width));
    const sy = Math.min(input.height - 1, Math.floor((y + .5) * input.height / height));
    const i = (sy * input.width + sx) * 4;
    pixels.set(input.data.subarray(i, i + 4), (y * width + x) * 4);
  }
  return pixels;
}

test("small real print files retain every final RGBA pixel and transparent margin without upscaling", async () => {
  const rendered = await renderPrintFile(source(17, 11), area(37, 29), { x: .55, y: .6, scale: .4 });
  const before = rendered.bytes.slice();
  const proof = await printFileProof(rendered.bytes), image = decode(proof.bytes, { checkCrc: true });
  assert.deepEqual([proof.width, proof.height, image.width, image.height], [37, 29, 37, 29]);
  assert.deepEqual(image.data, decode(rendered.bytes).data);
  assert.deepEqual(rendered.bytes, before, "Proof generation must not change the approved input");
  assert.ok(image.data.some((value, i) => i % 4 === 3 && value === 0));
  assert.ok(image.data.some((value, i) => i % 4 === 3 && value > 0 && value < 255));
});

test("noninteger final print edges use nearest pixel centres of the actual saved canvas", async () => {
  const rendered = await renderPrintFile(source(614, 420), area(1025, 701), { x: .503, y: .497, scale: .5 });
  const proof = await printFileProof(rendered.bytes), image = decode(proof.bytes);
  assert.deepEqual([proof.width, proof.height], [512, 350]);
  assert.deepEqual(image.data, oracle(decode(rendered.bytes), 512, 350));
  const twice = await printFileProof(rendered.bytes);
  assert.deepEqual(twice.bytes, proof.bytes);
});

test("one-pixel and very thin canvases keep their legal dimensions and alpha without upscaling", async () => {
  for (const [width, height, expectedWidth, expectedHeight] of [[1, 1, 1, 1], [4, 2, 4, 2], [1, 1025, 1, 512], [1025, 1, 512, 1]]) {
    const result = await printFileProof(fixture(width, height));
    assert.deepEqual([result.width, result.height], [expectedWidth, expectedHeight]);
    const pixels = decode(result.bytes).data;
    for (let n = 0; n < pixels.length; n += 4) assert.deepEqual([...pixels.subarray(n, n + 4)], [12, 34, 56, 128]);
  }
});

test("empty proofs and detail missed by bounded sampling reject instead of inventing visible pixels", async () => {
  await assert.rejects(printFileProof(fixture(1, 1, { raw: new Uint8Array(5) })), /invalid_print_proof/);
  const width = 1000, height = 1000, raw = new Uint8Array((width * 4 + 1) * height);
  raw.set([200, 40, 90, 255], (width * 4 + 1) + 1 + 4); // (1,1) is outside every sample centre.
  await assert.rejects(printFileProof(fixture(width, height, { raw })), /invalid_print_proof/);
});

test("split IDAT chunks, optional density and typed-array byte offsets are decoded without copying the input", async () => {
  const raw = Uint8Array.from([0, 12, 34, 56, 78, 90, 123, 45, 67, 0, 210, 211, 212, 213, 214, 215, 216, 217]);
  const original = fixture(2, 2, { raw, split: true, metadata: [] });
  const padded = Buffer.concat([Buffer.from([1, 2, 3]), original, Buffer.from([9, 8])]);
  const result = await printFileProof(padded.subarray(3, -2));
  assert.deepEqual([...decode(result.bytes).data], [...raw.slice(1, 9), ...raw.slice(10)]);
});

test("every critical or density chunk CRC is checked, including the final IEND", async () => {
  const original = fixture(2, 2);
  for (const type of ["IHDR", "pHYs", "IDAT", "IEND"]) {
    const bad = original.slice(); const at = bad.indexOf(type); assert.ok(at > 0);
    const size = bad.readUInt32BE(at - 4); bad[at + 4 + size] ^= 1;
    await assert.rejects(printFileProof(bad), /invalid_print_proof/, type);
  }
});

test("bad signature, unsupported headers, oversized dimensions and chunk-length overflow fail closed", async () => {
  const badSignature = fixture(1, 1).slice(); badSignature[0] ^= 1;
  const overflow = fixture(1, 1).slice(); overflow.writeUInt32BE(0xffffffff, 8);
  const inputs = [new Uint8Array(), new Uint8Array(16_000_001), badSignature, overflow,
    ...[{ depth: 16 }, { color: 2 }, { compression: 1 }, { filter: 1 }, { interlace: 1 }].map(fields => fixture(1, 1, { fields })),
    ...[[0, 1], [1, 0], [10001, 1], [10000, 4001], [0xffffffff, 0xffffffff]].map(([w, h]) => fixture(w, h, { raw: Uint8Array.of(0) }))];
  for (const input of inputs) await assert.rejects(printFileProof(input), /invalid_print_proof/);
});

test("unknown, repeated, misplaced or incomplete chunks cannot be treated as a known print file", async () => {
  const compressed = deflateSync(new Uint8Array(5));
  const make = parts => Buffer.concat([signature, ...parts]);
  for (const input of [
    make([header(1, 1), chunk("sRGB", Uint8Array.of(0)), chunk("IDAT", compressed), chunk("IEND")]),
    make([header(1, 1), header(1, 1), chunk("IDAT", compressed), chunk("IEND")]),
    fixture(1, 1, { metadata: [density(), density()] }),
    make([header(1, 1), chunk("IDAT", compressed), density(), chunk("IEND")]),
    make([header(1, 1), chunk("IDAT", compressed.subarray(0, 2)), density(), chunk("IDAT", compressed.subarray(2)), chunk("IEND")]),
    make([header(1, 1), chunk("IEND")]), make([header(1, 1), chunk("IDAT"), chunk("IEND")]),
    fixture(1, 1).subarray(0, -1), fixture(1, 1).subarray(0, -12),
    Buffer.concat([fixture(1, 1), Uint8Array.of(0)]),
    make([header(1, 1), ...Array.from({ length: 1024 }, () => chunk("IDAT")), chunk("IDAT", compressed), chunk("IEND")]),
  ]) await assert.rejects(printFileProof(input), /invalid_print_proof/);
});

test("decoded filter bytes, exact scanline count, zlib errors and trailing compressed data are mandatory", async () => {
  const valid = new Uint8Array(18), firstFilter = valid.slice(), secondFilter = valid.slice();
  firstFilter[0] = 1; secondFilter[9] = 4;
  const compressed = deflateSync(valid), brokenAdler = compressed.slice(); brokenAdler[brokenAdler.length - 1] ^= 1;
  for (const input of [fixture(2, 2, { raw: firstFilter }), fixture(2, 2, { raw: secondFilter }),
    fixture(2, 2, { raw: valid.subarray(0, -1) }), fixture(2, 2, { raw: new Uint8Array(19) }),
    fixture(2, 2, { raw: new Uint8Array(27) }), fixture(2, 2, { compressed: brokenAdler }),
    fixture(2, 2, { compressed: Uint8Array.of(1, 2, 3) }),
    fixture(2, 2, { compressed: Buffer.concat([compressed, Uint8Array.of(0)]) }),
    fixture(2, 2, { compressed: Buffer.concat([compressed, compressed]) }),
  ]) await assert.rejects(printFileProof(input), /invalid_print_proof/);
});

test("large provider file produces a bounded proof without decoding its 106 MB full canvas", async () => {
  const size = 1024, data = new Uint8Array(size * size * 4);
  for (let n = 0; n < data.length; n += 4) data.set([17, 145, 231, 128], n);
  const original = encode({ width: size, height: size, channels: 4, depth: 8, data });
  const rendered = await renderPrintFile(original, area(4606, 5787), { x: .63, y: .39, scale: .1 });
  const proof = await printFileProof(rendered.bytes), small = decode(proof.bytes);
  assert.deepEqual([proof.width, proof.height], [408, 512]);
  assert.equal(small.data.length, 408 * 512 * 4); assert.ok(proof.bytes.length < 1_000_000);
  for (let y = 0; y < proof.height; y++) for (let x = 0; x < proof.width; x++) {
    const sx = Math.floor((x + .5) * rendered.width / proof.width), sy = Math.floor((y + .5) * rendered.height / proof.height);
    const r = rendered.raster, inside = sx >= r.left && sx < r.left + r.width && sy >= r.top && sy < r.top + r.height;
    const index = (y * proof.width + x) * 4;
    assert.deepEqual([...small.data.subarray(index, index + 4)], inside ? [17, 145, 231, 128] : [0, 0, 0, 0]);
  }
});
