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
  let visible = false;
  for (let y = 0; y < previewHeight; y++) for (let x = 0; x < previewWidth; x++) {
    let a = 0, r = 0, g = 0, b = 0, samples = 0;
    for (let dy = 0; dy < 4 && y * 4 + dy < height; dy++) for (let dx = 0; dx < 4 && x * 4 + dx < width; dx++) {
      const index = ((y * 4 + dy) * width + x * 4 + dx) * source.channels;
      const alpha = source.channels === 4 ? source.data[index + 3] : 255;
      a += alpha; r += source.data[index] * alpha; g += source.data[index + 1] * alpha; b += source.data[index + 2] * alpha;
      samples++;
    }
    const target = (y * previewWidth + x) * 4;
    if (a) visible = true;
    pixels[target] = a ? Math.round(r / a) : 0;
    pixels[target + 1] = a ? Math.round(g / a) : 0;
    pixels[target + 2] = a ? Math.round(b / a) : 0;
    pixels[target + 3] = Math.round(a / samples);
  }
  return { width: previewWidth, height: previewHeight, visible,
    bytes: encode({ width: previewWidth, height: previewHeight, data: pixels, depth: 8, channels: 4 }, { zlib: { level: 3 } }) };
}
