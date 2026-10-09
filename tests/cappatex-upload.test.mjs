import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { encode, decode } from "fast-png";
import { createArtworkPreview } from "../app/cappatex-preview.ts";
import { customerImageSize } from "../app/cappatex-upload-client.ts";

const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(specifier, context);
} });
const { boundedBody, validateUploadPng } = await import("../app/cappatex-upload.ts");
after(() => hook.deregister());

function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); result.write(type, 4); result.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
const original = encode({ width: 9, height: 5, depth: 8, channels: 4, data: new Uint8Array(9 * 5 * 4).fill(255) });
const insert = block => Buffer.concat([original.subarray(0, 33), block, original.subarray(33)]);

test("an odd-sized uploaded motif preserves edges, opacity, bytes and exact source dimensions", async () => {
  assert.deepEqual(await validateUploadPng(original), { width: 9, height: 5 });
  assert.deepEqual(customerImageSize(original, "image/png"), { width: 9, height: 5 });
  const before = original.slice();
  const preview = createArtworkPreview(original);
  assert.deepEqual([preview.width, preview.height, preview.visible], [3, 2, true]);
  assert.equal([...decode(preview.bytes).data].every(value => value === 255), true);
  assert.deepEqual(original, before);
});

test("uploads reject animation, unexpected color interpretation, trailing bytes and corrupt pixels", async () => {
  const gamma = Buffer.alloc(4); gamma.writeUInt32BE(100000);
  for (const bytes of [insert(chunk("acTL", Buffer.alloc(8))), insert(chunk("gAMA", gamma)), insert(chunk("sRGB", Buffer.from([1]))), Buffer.concat([original, Buffer.from([0])])]) {
    await assert.rejects(validateUploadPng(bytes));
  }
  const srgbGamma = Buffer.alloc(4); srgbGamma.writeUInt32BE(45455);
  await validateUploadPng(insert(chunk("gAMA", srgbGamma)));
  const broken = original.slice(); broken[broken.length - 5] ^= 1;
  assert.throws(() => createArtworkPreview(broken));
  const invisible = encode({ width: 4, height: 4, depth: 8, channels: 4, data: new Uint8Array(64) });
  assert.equal(createArtworkPreview(invisible).visible, false);
});

test("PNG preflight caps chunk count and inflated scanline data before the image decoder", async () => {
  const chunkFlood = Buffer.concat([original.subarray(0, 33), ...Array.from({ length: 1025 }, () => chunk("IDAT", Buffer.alloc(0))), original.subarray(33)]);
  await assert.rejects(validateUploadPng(chunkFlood), /unsupported/);
  const tooMuchData = Buffer.concat([original.subarray(0, 33), chunk("IDAT", deflateSync(Buffer.alloc(1_000_000))), chunk("IEND", Buffer.alloc(0))]);
  await assert.rejects(validateUploadPng(tooMuchData), /invalid_png_data/);
});

test("streamed uploads enforce the byte limit even without Content-Length and across tiny reads", async () => {
  function streamed(count) {
    let i = 0;
    return new Request("https://example.test", { method: "POST", duplex: "half", body: new ReadableStream({
      pull(controller) { if (i === count) controller.close(); else controller.enqueue(new Uint8Array([i++ % 256])); },
    }) });
  }
  const result = await boundedBody(streamed(10000), 10000);
  assert.equal(result.length, 10000); assert.equal(result[9999], 9999 % 256);
  await assert.rejects(boundedBody(streamed(10001), 10000), /upload_too_large/);
  await assert.rejects(boundedBody(new Request("https://example.test", { method: "POST", headers: { "content-length": "10001" }, body: "x" }), 10000));
});

test("client preflight refuses oversized files before decoding and recognizes JPEG SOF dimensions", () => {
  const huge = original.slice(); new DataView(huge.buffer).setUint32(16, 30000);
  assert.throws(() => customerImageSize(huge, "image/png"), /Megapixel/);
  assert.throws(() => customerImageSize(insert(chunk("acTL", Buffer.alloc(8))), "image/png"), /Animation/);
  const jpeg = Buffer.from([255,216,255,192,0,11,8,0,5,0,9,1,1,17,0,255,217]);
  assert.deepEqual(customerImageSize(jpeg, "image/jpeg"), { width: 9, height: 5 });
  assert.throws(() => customerImageSize(Buffer.from("fake jpeg"), "image/jpeg"));
});
