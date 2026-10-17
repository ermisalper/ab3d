import { decode } from "fast-png";
import { validateUploadPng } from "./cappatex-upload";
import { placementGeometry, type Placement, type ProfileVariant } from "./cappatex-print-profile";

export const PRINT_RENDERER_VERSION = "rgba-area-v1";
const MAX_PRINT_BYTES = 16_000_000;
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type: string, data: Uint8Array) {
  const result = new Uint8Array(data.length + 12), view = new DataView(result.buffer);
  view.setUint32(0, data.length); result.set(new TextEncoder().encode(type), 4); result.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < result.length - 4; i++) crc = crcTable[(crc ^ result[i]) & 255] ^ (crc >>> 8);
  view.setUint32(result.length - 4, (crc ^ 0xffffffff) >>> 0);
  return result;
}

/** Row-streamed full-placeholder PNG. No full-sized target RGBA allocation. */
export async function renderPrintFile(bytes: Uint8Array, area: ProfileVariant["area"], placement: Placement, sourceType: "upload" | "generated" = "upload") {
  const size = await validateUploadPng(bytes, { generatedContentCredentials: sourceType === "generated" }), geometry = placementGeometry(area, size, placement);
  if (!geometry.ok) throw new Error("invalid_placement");
  const width = area.widthPx, height = area.heightPx;
  if (![width, height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 10000) || width * height > 40_000_000)
    throw new Error("print_area_too_large");
  const source = decode(bytes, { checkCrc: true });
  if (source.depth !== 8 || ![3, 4].includes(source.channels) || source.palette || source.transparency?.length || source.iccEmbeddedProfile)
    throw new Error("unsupported_print_source");
  const printWidth = Math.max(1, Math.round(geometry.width! * width));
  const printHeight = Math.max(1, Math.round(geometry.height! * height));
  const left = Math.max(0, Math.min(width - printWidth, Math.round(placement.x * width - printWidth / 2)));
  const top = Math.max(0, Math.min(height - printHeight, Math.round(placement.y * height - printHeight / 2)));
  if (printWidth > width || printHeight > height || printWidth > size.width || printHeight > size.height) throw new Error("invalid_raster_bounds");
  const sx = size.width / printWidth, sy = size.height / printHeight;
  let rowIndex = 0;
  const rows = new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      if (rowIndex === height) { controller.close(); return; }
      const row = new Uint8Array(1 + width * 4); // PNG filter 0, transparent outside the motif.
      const dy = rowIndex++ - top;
      if (dy >= 0 && dy < printHeight) {
        const y0 = dy * sy, y1 = Math.min(size.height, (dy + 1) * sy);
        for (let dx = 0; dx < printWidth; dx++) {
          const x0 = dx * sx, x1 = Math.min(size.width, (dx + 1) * sx);
          let alpha = 0, r = 0, g = 0, b = 0;
          for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
            const wy = Math.min(y1, y + 1) - Math.max(y0, y);
            for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
              const weight = wy * (Math.min(x1, x + 1) - Math.max(x0, x));
              const i = (y * size.width + x) * source.channels;
              const a = (source.channels === 4 ? source.data[i + 3] : 255) * weight;
              alpha += a; r += source.data[i] * a; g += source.data[i + 1] * a; b += source.data[i + 2] * a;
            }
          }
          const i = 1 + (left + dx) * 4;
          row[i] = alpha ? Math.round(r / alpha) : 0; row[i + 1] = alpha ? Math.round(g / alpha) : 0;
          row[i + 2] = alpha ? Math.round(b / alpha) : 0; row[i + 3] = Math.round(alpha / ((x1 - x0) * (y1 - y0)));
        }
      }
      controller.enqueue(row);
    },
  });
  const header = new Uint8Array(13), hv = new DataView(header.buffer);
  hv.setUint32(0, width); hv.setUint32(4, height); header[8] = 8; header[9] = 6;
  const density = new Uint8Array(9), dv = new DataView(density.buffer);
  dv.setUint32(0, Math.round(width / (area.widthMm / 1000))); dv.setUint32(4, Math.round(height / (area.heightMm / 1000))); density[8] = 1;
  const parts = [Uint8Array.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("pHYs", density)];
  const reader = rows.pipeThrough(new CompressionStream("deflate")).getReader();
  let length = parts.reduce((n, p) => n + p.length, 0);
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      const part = chunk("IDAT", value); length += part.length;
      if (length > MAX_PRINT_BYTES - 12) { await reader.cancel(); throw new Error("print_file_too_large"); }
      parts.push(part);
    }
  } finally { reader.releaseLock(); }
  parts.push(chunk("IEND", new Uint8Array())); length += 12;
  const output = new Uint8Array(length); let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return { bytes: output, width, height, raster: { left, top, width: printWidth, height: printHeight }, dpi: geometry.dpi! };
}
