export function customerImageSize(bytes: Uint8Array, type: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0;
  if (type === "image/png" && bytes.length >= 33 && [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)
    && String.fromCharCode(...bytes.subarray(12, 16)) === "IHDR") {
    width = view.getUint32(16); height = view.getUint32(20);
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset);
      if (offset + length + 12 > bytes.length) throw new Error("Die PNG-Datei ist beschädigt.");
      if (String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)) === "acTL") throw new Error("Bitte verwende ein einzelnes Bild statt einer Animation.");
      offset += length + 12;
    }
  } else if (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216) {
    for (let offset = 2; offset + 4 <= bytes.length;) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192,193,194].includes(marker) && length >= 8) {
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
      }
      offset += length;
    }
  }
  if (!width || !height) throw new Error("Das Bild ist beschädigt oder kein unterstütztes PNG/JPG.");
  if (width > 6144 || height > 6144 || width * height > 6_291_456)
    throw new Error("Das Bild darf höchstens 6,29 Megapixel und 6144 Pixel je Seite haben. Bitte exportiere eine passende Grösse; das Motiv wird nicht automatisch verkleinert.");
  return { width, height };
}

/** Normalize orientation and color in the browser once, before the customer approves the PNG for print. */
export async function prepareCustomerImage(file: File): Promise<Blob> {
  if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("Bitte wähle eine PNG- oder JPG-Datei.");
  if (file.size > 12_000_000) throw new Error("Die Datei darf höchstens 12 MB gross sein.");
  customerImageSize(new Uint8Array(await file.arrayBuffer()), file.type);
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > 6144 || bitmap.height > 6144 || bitmap.width * bitmap.height > 6_291_456)
      throw new Error("Das Bild darf höchstens 6,29 Megapixel und 6144 Pixel je Seite haben. Bitte exportiere eine passende Grösse; das Motiv wird nicht automatisch verkleinert.");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { colorSpace: "srgb" });
    if (!context) throw new Error("Dein Browser konnte das Bild nicht vorbereiten.");
    context.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG konnte nicht erstellt werden.")), "image/png"));
    canvas.width = 0; canvas.height = 0;
    if (png.size > 12_000_000) throw new Error("Die PNG-Druckdatei ist grösser als 12 MB. Bitte exportiere eine kleinere Datei.");
    return png;
  } finally { bitmap.close(); }
}
