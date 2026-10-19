import { encode } from "fast-png";
import { printProofDimensions } from "./cappatex-print-raster";

const MAX_PRINT_BYTES = 16_000_000;
const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const invalid = (): never => { throw new Error("invalid_print_proof"); };
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  for (let bit = 0; bit < 8; bit++) index = index & 1 ? 0xedb88320 ^ (index >>> 1) : index >>> 1;
  return index;
});

function printChunks(bytes: Uint8Array) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 57 || bytes.length > MAX_PRINT_BYTES
    || signature.some((value, index) => bytes[index] !== value)) return invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const compressed: Uint8Array[] = [];
  let offset = 8, chunks = 0, width = 0, height = 0, density = false, hadData = false, ended = false;
  while (offset + 12 <= bytes.length) {
    if (++chunks > 1024) return invalid();
    const length = view.getUint32(offset), end = offset + 12 + length;
    if (end > bytes.length) return invalid();
    let crc = 0xffffffff;
    for (let index = offset + 4; index < end - 4; index++) crc = crcTable[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
    if (((crc ^ 0xffffffff) >>> 0) !== view.getUint32(end - 4)) return invalid();
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === "IHDR") {
      if (offset !== 8 || length !== 13 || bytes[offset + 16] !== 8 || bytes[offset + 17] !== 6
        || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] !== 0) return invalid();
      width = view.getUint32(offset + 8); height = view.getUint32(offset + 12);
      printProofDimensions(width, height);
    } else if (!width || !height) return invalid();
    else if (type === "pHYs") {
      if (density || hadData || length !== 9 || !view.getUint32(offset + 8) || !view.getUint32(offset + 12)
        || bytes[offset + 16] !== 1) return invalid();
      density = true;
    } else if (type === "IDAT") {
      hadData = true;
      if (length) compressed.push(bytes.subarray(offset + 8, end - 4));
    } else if (type === "IEND") {
      if (length !== 0 || !hadData || compressed.length === 0 || end !== bytes.length) return invalid();
      ended = true;
    } else return invalid();
    offset = end;
  }
  if (!ended || offset !== bytes.length) return invalid();
  return { width, height, compressed };
}

/** Read only the known rgba-area-v1 full-canvas PNG, retaining one scanline and a small proof. */
export async function printFileProof(bytes: Uint8Array): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  try {
    const source = printChunks(bytes), target = printProofDimensions(source.width, source.height);
    const pixels = new Uint8Array(target.width * target.height * 4);
    const row = new Uint8Array(source.width * 4 + 1);
    const sampleColumns = Uint32Array.from({ length: target.width }, (_, x) => Math.min(source.width - 1,
      Math.floor((x + .5) * source.width / target.width)));
    const sampleRow = (y: number) => Math.min(source.height - 1, Math.floor((y + .5) * source.height / target.height));
    let chunk = 0;
    const input = new ReadableStream<BufferSource>({
      pull(controller) {
        if (chunk === source.compressed.length) controller.close();
        else controller.enqueue(source.compressed[chunk++] as Uint8Array<ArrayBuffer>);
      },
    });
    const reader = input.pipeThrough(new DecompressionStream("deflate")).getReader();
    let filled = 0, decodedRows = 0, outputRows = 0, total = 0, visible = false;
    const expectedBytes = row.length * source.height;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > expectedBytes) return invalid();
        let offset = 0;
        while (offset < value.length) {
          const take = Math.min(row.length - filled, value.length - offset);
          row.set(value.subarray(offset, offset + take), filled); filled += take; offset += take;
          if (filled !== row.length) continue;
          if (row[0] !== 0 || decodedRows >= source.height) return invalid();
          if (outputRows < target.height && decodedRows === sampleRow(outputRows)) {
            for (let x = 0; x < target.width; x++) {
              const from = 1 + sampleColumns[x] * 4, to = (outputRows * target.width + x) * 4;
              pixels[to] = row[from]; pixels[to + 1] = row[from + 1];
              pixels[to + 2] = row[from + 2]; pixels[to + 3] = row[from + 3];
              if (row[from + 3] > 0) visible = true;
            }
            outputRows++;
          }
          decodedRows++; filled = 0;
        }
      }
      if (total !== expectedBytes || filled !== 0 || decodedRows !== source.height || outputRows !== target.height || !visible) return invalid();
    } catch {
      await reader.cancel().catch(() => {});
      return invalid();
    } finally { reader.releaseLock(); }
    return { bytes: encode({ width: target.width, height: target.height, data: pixels, depth: 8, channels: 4 }), ...target };
  } catch { return invalid(); }
}
