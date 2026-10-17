import { pngSize } from "./cappatex-artwork";
import { MAX_ARTWORK_BYTES, MAX_ARTWORK_PIXELS, MAX_ARTWORK_SIDE } from "./cappatex-preview";

/** Enforce a limit while reading, including requests without Content-Length. */
export async function boundedBody(request: Request, limit = MAX_ARTWORK_BYTES) {
  if (Number(request.headers.get("content-length") || 0) > limit) throw new Error("upload_too_large");
  if (!request.body) throw new Error("empty_upload");
  const reader = request.body.getReader();
  let buffer = new Uint8Array(Math.min(limit, 65_536));
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const nextLength = length + value.length;
      if (nextLength > limit) { await reader.cancel(); throw new Error("upload_too_large"); }
      if (nextLength > buffer.length) {
        const next = new Uint8Array(Math.min(limit, Math.max(nextLength, buffer.length * 2)));
        next.set(buffer.subarray(0, length)); buffer = next;
      }
      buffer.set(value, length); length = nextLength;
    }
  } finally { reader.releaseLock(); }
  return buffer.slice(0, length);
}

/** Browser-normalized PNG only. Reject animation, metadata and decompression bombs before decoding. */
export async function validateUploadPng(bytes: Uint8Array, options: { generatedContentCredentials?: boolean } = {}) {
  if (bytes.length > MAX_ARTWORK_BYTES) throw new Error("upload_too_large");
  const size = pngSize(bytes);
  if (size.width > MAX_ARTWORK_SIDE || size.height > MAX_ARTWORK_SIDE || size.width * size.height > MAX_ARTWORK_PIXELS
    || bytes[24] !== 8 || ![2, 6].includes(bytes[25]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) throw new Error("unsupported_upload");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const compressed: Uint8Array[] = [];
  let offset = 8, ended = false, hadData = false, dataClosed = false, chunks = 0;
  while (offset + 12 <= bytes.length) {
    if (++chunks > 1024) throw new Error("unsupported_upload");
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (offset + length + 12 > bytes.length || length > MAX_ARTWORK_BYTES) throw new Error("invalid_png");
    if (type === "IHDR") { if (offset !== 8 || length !== 13) throw new Error("invalid_png"); }
    else if (type === "IDAT") {
      if (dataClosed) throw new Error("invalid_png");
      hadData = true;
      if (length) compressed.push(bytes.subarray(offset + 8, offset + 8 + length));
    } else {
      if (hadData) dataClosed = true;
      if (type === "IEND") {
        if (length || !hadData || offset + 12 !== bytes.length) throw new Error("invalid_png");
        ended = true;
      } else if (type === "caBX" && options.generatedContentCredentials) {
        // Existing generated originals carry provenance, not pixel/colour instructions.
        // Keep their original bytes; the decoder verifies CRC and ignores this metadata.
      } else if (!({ sRGB: 1, gAMA: 4, cHRM: 32, pHYs: 9 } as Record<string, number>)[type]
        || length !== ({ sRGB: 1, gAMA: 4, cHRM: 32, pHYs: 9 } as Record<string, number>)[type]) throw new Error("unsupported_upload");
      if (type === "gAMA" && view.getUint32(offset + 8) !== 45455) throw new Error("unsupported_upload");
      if (type === "sRGB" && bytes[offset + 8] !== 0) throw new Error("unsupported_upload");
      if (type === "cHRM" && [31270,32900,64000,33000,30000,60000,15000,6000].some((value, i) => view.getUint32(offset + 8 + i * 4) !== value)) throw new Error("unsupported_upload");
    }
    offset += length + 12;
  }
  if (!ended || offset !== bytes.length) throw new Error("invalid_png");
  const expected = (size.width * (bytes[25] === 6 ? 4 : 3) + 1) * size.height;
  // Count streamed scanline bytes without retaining the decompressed image twice.
  const stream = new ReadableStream<BufferSource>({ start(controller) { for (const chunk of compressed) controller.enqueue(chunk as Uint8Array<ArrayBuffer>); controller.close(); } });
  const reader = stream.pipeThrough(new DecompressionStream("deflate")).getReader();
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > expected) { await reader.cancel(); throw new Error("invalid_png_data"); }
    }
  } finally { reader.releaseLock(); }
  if (total !== expected) throw new Error("invalid_png_data");
  return size;
}

export const RESERVE_UPLOAD = `INSERT INTO cappatex_designs
  (id,email,prompt,production_prompt,style,product_key,preview_base64,preview_format,status,created_at,updated_at)
  SELECT ?,?,'Eigenes Bild','Vom Kunden hochgeladene PNG-Druckdatei','Upload','original','','png','uploading',?,?
  WHERE (SELECT COUNT(*) FROM cappatex_designs WHERE email = ? AND style = 'Upload' AND created_at >= ?) < 10`;
