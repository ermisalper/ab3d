import { decode, encode } from "fast-png";

/** A deterministic thumbnail of the approved source; never another AI-generated image. */
export function createArtworkPreview(bytes: Uint8Array) {
  if (bytes.length < 33 || bytes.length > 12_000_000) throw new Error("invalid_png_size");
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = header.getUint32(16), height = header.getUint32(20);
  if (!width || !height || width % 4 || height % 4 || width > 3072 || height > 3072
    || width * height > 6_291_456 || bytes[24] !== 8 || ![2, 6].includes(bytes[25])) throw new Error("unsupported_preview_source");
  const source = decode(bytes, { checkCrc: true });
  if (source.depth !== 8 || ![3, 4].includes(source.channels) || source.palette || source.transparency?.length
    || source.iccEmbeddedProfile || source.width !== width || source.height !== height) throw new Error("unsupported_preview_source");
  const previewWidth = width / 4, previewHeight = height / 4;
  const pixels = new Uint8Array(previewWidth * previewHeight * 4);
  for (let y = 0; y < previewHeight; y++) for (let x = 0; x < previewWidth; x++) {
    let a = 0, r = 0, g = 0, b = 0;
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
      const index = ((y * 4 + dy) * width + x * 4 + dx) * source.channels;
      const alpha = source.channels === 4 ? source.data[index + 3] : 255;
      a += alpha; r += source.data[index] * alpha; g += source.data[index + 1] * alpha; b += source.data[index + 2] * alpha;
    }
    const target = (y * previewWidth + x) * 4;
    pixels[target] = a ? Math.round(r / a) : 0;
    pixels[target + 1] = a ? Math.round(g / a) : 0;
    pixels[target + 2] = a ? Math.round(b / a) : 0;
    pixels[target + 3] = Math.round(a / 16);
  }
  return { width: previewWidth, height: previewHeight,
    bytes: encode({ width: previewWidth, height: previewHeight, data: pixels, depth: 8, channels: 4 }, { zlib: { level: 3 } }) };
}
