import { decode, encode } from "fast-png";

export const MAX_ARTWORK_BYTES = 12_000_000;
export const MAX_ARTWORK_PIXELS = 6_291_456;
export const MAX_ARTWORK_SIDE = 6144;

/** A deterministic thumbnail of the approved source; never another AI-generated image. */
export function createArtworkPreview(bytes: Uint8Array) {
  if (bytes.length < 33 || bytes.length > MAX_ARTWORK_BYTES) throw new Error("invalid_png_size");
  if ([137,80,78,71,13,10,26,10].some((value, index) => bytes[index] !== value)
    || String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") throw new Error("invalid_png");
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = header.getUint32(16), height = header.getUint32(20);
  if (!width || !height || width > MAX_ARTWORK_SIDE || height > MAX_ARTWORK_SIDE
    || width * height > MAX_ARTWORK_PIXELS || bytes[24] !== 8 || ![2, 6].includes(bytes[25])) throw new Error("unsupported_preview_source");
  const source = decode(bytes, { checkCrc: true });
  if (source.depth !== 8 || ![3, 4].includes(source.channels) || source.palette || source.transparency?.length
    || source.iccEmbeddedProfile || source.width !== width || source.height !== height) throw new Error("unsupported_preview_source");
  const previewWidth = Math.ceil(width / 4), previewHeight = Math.ceil(height / 4);
  const pixels = new Uint8Array(previewWidth * previewHeight * 4);
  const stepX = width / previewWidth, stepY = height / previewHeight;
  let visible = false;
  for (let y = 0; y < previewHeight; y++) for (let x = 0; x < previewWidth; x++) {
    const x0 = x * stepX, x1 = Math.min(width, (x + 1) * stepX);
    const y0 = y * stepY, y1 = Math.min(height, (y + 1) * stepY);
    let a = 0, r = 0, g = 0, b = 0;
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
      const weight = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * (Math.min(y1, sy + 1) - Math.max(y0, sy));
      const index = (sy * width + sx) * source.channels;
      const alpha = (source.channels === 4 ? source.data[index + 3] : 255) * weight;
      a += alpha; r += source.data[index] * alpha; g += source.data[index + 1] * alpha; b += source.data[index + 2] * alpha;
    }
    const target = (y * previewWidth + x) * 4;
    const alpha = Math.round(a / ((x1 - x0) * (y1 - y0)));
    if (alpha) visible = true;
    pixels[target] = alpha ? Math.round(r / a) : 0;
    pixels[target + 1] = alpha ? Math.round(g / a) : 0;
    pixels[target + 2] = alpha ? Math.round(b / a) : 0;
    pixels[target + 3] = alpha;
  }
  return { width: previewWidth, height: previewHeight, visible,
    bytes: encode({ width: previewWidth, height: previewHeight, data: pixels, depth: 8, channels: 4 }, { zlib: { level: 3 } }) };
}
