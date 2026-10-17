import type { Placement, ProfileVariant } from "./cappatex-print-profile";
import type { PreparedCheckoutStatus } from "./cappatex-prepared-checkout";

export type PrintSide = "front" | "back";
export type PreparationInput = { requestId: string; profileId: string; profileVersion: string; shopifyVariantId: string;
  quantity: number; country: "CH" | "LI"; sides: Array<{ position: PrintSide; designId: string; placement: Placement }> };
export type PreparedDesign = {
  schemaVersion: 2; rendererVersion: string; id: string; createdAt: number;
  profileId: string; profileVersion: string; name: string; shopId: string; printifyProductId: string;
  blueprintId: number; providerId: number;
  variant: Pick<ProfileVariant, "shopifyVariantId" | "printifyVariantId" | "sku" | "color" | "size">;
  quantity: number; country: "CH" | "LI";
  sides: Array<{ position: PrintSide; designId: string; source: "upload" | "generated";
    artwork: { key: string; sha256: string; width: number; height: number };
    area: ProfileVariant["area"]; mockup: ProfileVariant["mockup"]; placement: Placement;
    file: { key: string; sha256: string; width: number; height: number };
    raster: { left: number; top: number; width: number; height: number }; dpi: number;
  }>;
};

export function preparationInput(body: unknown): PreparationInput {
  if (!body || typeof body !== "object") throw new Error("invalid_input");
  const b = body as PreparationInput;
  if (!/^[a-f0-9-]{36}$/.test(b.requestId) || typeof b.profileId !== "string" || !b.profileId || b.profileId.length > 160
    || typeof b.profileVersion !== "string" || !b.profileVersion || b.profileVersion.length > 160
    || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(b.shopifyVariantId)
    || !Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > 5 || !["CH", "LI"].includes(b.country)
    || !Array.isArray(b.sides) || b.sides.length < 1 || b.sides.length > 2) throw new Error("invalid_input");
  const seen = new Set<string>();
  const sides = b.sides.map(s => {
    if (!s || !["front", "back"].includes(s.position) || seen.has(s.position) || !/^CPX-[A-Z0-9]{12}$/.test(s.designId)
      || !s.placement || ![s.placement.x, s.placement.y, s.placement.scale].every(n => typeof n === "number" && Number.isFinite(n))
      || s.placement.x < 0 || s.placement.x > 1 || s.placement.y < 0 || s.placement.y > 1 || s.placement.scale <= 0 || s.placement.scale > 1) throw new Error("invalid_input");
    seen.add(s.position);
    return { position: s.position, designId: s.designId, placement: { x: s.placement.x, y: s.placement.y, scale: s.placement.scale } };
  }).sort((a, b) => a.position === b.position ? 0 : a.position === "front" ? -1 : 1);
  return { requestId: b.requestId, profileId: b.profileId, profileVersion: b.profileVersion, shopifyVariantId: b.shopifyVariantId,
    quantity: b.quantity, country: b.country, sides };
}

/** No storage paths or account identifiers are exposed by the review API. */
export function preparationSummary(saved: PreparedDesign, canDownload: boolean, checkout: PreparedCheckoutStatus = {
  enabled: false, reason: "Preis, Versand und der Bestellablauf sind für diese Druckseiten noch nicht freigegeben.",
}) {
  return { id: saved.id, schemaVersion: saved.schemaVersion, createdAt: saved.createdAt, name: saved.name,
    profileId: saved.profileId, profileVersion: saved.profileVersion, variant: saved.variant, quantity: saved.quantity, country: saved.country,
    purchaseReady: checkout.enabled, checkout, sides: saved.sides.map(s => ({ position: s.position, designId: s.designId, area: s.area, mockup: s.mockup,
      placement: s.placement, artwork: { width: s.artwork.width, height: s.artwork.height }, dpi: s.dpi, raster: s.raster,
      file: { width: s.file.width, height: s.file.height, sha256: s.file.sha256 },
      previewUrl: `/api/cappatex/artwork/${s.designId}`,
      downloadUrl: canDownload ? `/api/cappatex/preparations/${saved.id}?side=${s.position}` : null })) };
}
export type PreparationSummary = ReturnType<typeof preparationSummary>;
