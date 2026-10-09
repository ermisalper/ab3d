/** All dimensions refer to the provider's exact print placeholder, not the garment. */
export type PrintProfile = {
  id: string;
  version: string;
  verifiedAt: string;
  validUntil: string;
  shopId: string;
  printifyProductId: string;
  blueprintId: number;
  providerId: number;
  shopifyProductId: string;
  kind: "tshirt" | "tanktop" | "hoodie" | "sweatshirt" | "accessory";
  name: string;
  evidence: string[];
  fulfillment: { route: "ab3d-api"; nativeImportUnlinked: true; manualApproval: true };
  variants: Array<{
    printifyVariantId: number;
    shopifyVariantId: string;
    sku: string;
    color: string;
    size: string;
    area: {
      position: string;
      decorationMethod: string;
      widthPx: number;
      heightPx: number;
      widthMm: number;
      heightMm: number;
      minDpi: number;
      minScale: number;
      maxScale: number;
    };
    mockup: {
      url: string;
      width: number;
      height: number;
      // Verified print rectangle in the unmodified blank photograph, in pixels.
      left: number;
      top: number;
      printWidth: number;
      printHeight: number;
    };
    shipping: Array<{ country: "CH" | "LI"; method: 1; currency: string; firstCents: number; additionalCents: number }>;
  }>;
};

export type ProfileVariant = PrintProfile["variants"][number];
export type Placement = { x: number; y: number; scale: number };
export type ArtworkSize = { width: number; height: number };

/** Geometry approval alone grants no checkout or fulfillment access. */
export function profileGeometryIsVerified(profile: Omit<PrintProfile, "fulfillment">, shopId: string, now = Date.now()) {
  if (profile.shopId !== shopId || !profile.id || !profile.version || !profile.evidence.length
    || !profile.printifyProductId || !Number.isInteger(profile.blueprintId) || profile.blueprintId <= 0
    || !Number.isInteger(profile.providerId) || profile.providerId <= 0
    || !/^gid:\/\/shopify\/Product\/\d+$/.test(profile.shopifyProductId)
    || !Number.isFinite(Date.parse(profile.verifiedAt)) || Date.parse(profile.verifiedAt) > now
    || !Number.isFinite(Date.parse(profile.validUntil)) || Date.parse(profile.validUntil) <= now
    || !profile.variants.length) return false;
  const skus = new Set<string>(), shopifyIds = new Set<string>(), printifyIds = new Set<number>();
  return profile.variants.every((variant) => {
    const { area, mockup } = variant;
    if (!variant.sku || !variant.color || !variant.size || skus.has(variant.sku)
      || shopifyIds.has(variant.shopifyVariantId) || printifyIds.has(variant.printifyVariantId)) return false;
    skus.add(variant.sku); shopifyIds.add(variant.shopifyVariantId); printifyIds.add(variant.printifyVariantId);
    return /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variant.shopifyVariantId)
      && Number.isInteger(variant.printifyVariantId) && variant.printifyVariantId > 0
      && Boolean(area.position && area.decorationMethod)
      && [area.widthPx, area.heightPx, area.widthMm, area.heightMm, area.minDpi, mockup.width, mockup.height, mockup.printWidth, mockup.printHeight].every(n => Number.isFinite(n) && n > 0)
      && area.minScale > 0 && area.maxScale <= 1 && area.minScale <= area.maxScale
      && mockup.url.startsWith("https://") && mockup.left >= 0 && mockup.top >= 0
      && mockup.left + mockup.printWidth <= mockup.width && mockup.top + mockup.printHeight <= mockup.height
      && Math.abs(mockup.printWidth / mockup.printHeight - area.widthPx / area.heightPx) < 0.01
      && Math.abs((area.widthMm / area.heightMm) / (area.widthPx / area.heightPx) - 1) < 0.001;
  });
}

export function profileIsVerified(profile: PrintProfile, shopId: string, now = Date.now()) {
  return profileGeometryIsVerified(profile, shopId, now)
    && profile.fulfillment?.route === "ab3d-api" && profile.fulfillment.nativeImportUnlinked === true
    && profile.fulfillment.manualApproval === true
    && profile.variants.every(variant => ["CH", "LI"].every(country => variant.shipping.some(rate => rate.country === country && rate.method === 1
      && /^[A-Z]{3}$/.test(rate.currency) && Number.isInteger(rate.firstCents) && rate.firstCents >= 0
      && Number.isInteger(rate.additionalCents) && rate.additionalCents >= 0)));
}

/** Printify defines scale as artwork width / placeholder width and x/y as its centre. */
export function placementGeometry(area: ProfileVariant["area"], image: ArtworkSize, placement: Placement) {
  const finite = [image.width, image.height, placement.x, placement.y, placement.scale].every(Number.isFinite);
  if (!finite || image.width <= 0 || image.height <= 0) return { ok: false as const, reason: "Ungültige Bildabmessungen oder Platzierung." };
  const width = placement.scale;
  const height = width * area.widthPx / area.heightPx * image.height / image.width;
  const left = placement.x - width / 2;
  const top = placement.y - height / 2;
  const widthMm = width * area.widthMm;
  const heightMm = height * area.heightMm;
  const dpi = Math.min(image.width * 25.4 / widthMm, image.height * 25.4 / heightMm);
  const boundsOk = width >= area.minScale && width <= area.maxScale
    && left >= -1e-9 && top >= -1e-9 && left + width <= 1 + 1e-9 && top + height <= 1 + 1e-9;
  const resolutionOk = Number.isFinite(dpi) && dpi >= area.minDpi;
  return { ok: boundsOk && resolutionOk, boundsOk, resolutionOk, left, top, width, height, widthMm, heightMm, dpi,
    reason: !boundsOk ? "Das Motiv liegt ausserhalb der geprüften Druckfläche. Verkleinere oder verschiebe es."
      : !resolutionOk ? `Auflösung zu niedrig: ${Math.floor(dpi)} dpi, mindestens ${area.minDpi} dpi nötig. Verkleinere das Motiv.` : "Druckfläche und Auflösung passen." };
}

export function initialPlacement(area: ProfileVariant["area"], image: ArtworkSize): Placement {
  const resolutionScale = Math.min(image.width * 25.4 / (area.widthMm * area.minDpi),
    image.width * 25.4 * area.heightPx / (area.widthPx * area.heightMm * area.minDpi));
  return { x: 0.5, y: 0.5, scale: Math.max(area.minScale, Math.min(area.maxScale, 0.7,
    area.heightPx / area.widthPx * image.width / image.height * 0.7, resolutionScale * (1 - 1e-9))) };
}
