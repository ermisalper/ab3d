import type { Placement, PrintProfile, ProfileVariant } from "./cappatex-print-profile";
import type { PreparedDesign } from "./cappatex-preparation";

type SnapshotBase = {
  id: string;
  email: string;
  designId: string;
  profile: PrintProfile;
  variant: ProfileVariant;
  quantity: number;
  country: "CH" | "LI";
  unitPriceCents: number;
  currency: string;
  legalVersion: string;
  consentAt: number;
};
export type LegacyCheckoutSnapshot = SnapshotBase & { schemaVersion?: 1;
  artwork: { key: string; sha256: string; width: number; height: number; format: "png" }; placement: Placement };
export type PreparedCheckoutSnapshot = SnapshotBase & { schemaVersion: 2; preparation: PreparedDesign; preparationSha256: string };
export type CheckoutSnapshot = LegacyCheckoutSnapshot | PreparedCheckoutSnapshot;

export type PaidLine = { id?: number | string; variant_id?: number | string; product_id?: number | string;
  quantity?: number; sku?: string; price?: string; total_discount?: string; discount_allocations?: Array<{ amount?: string }>;
  properties?: Array<{ name: string; value: string }> };

export function moneyCents(amount: string | undefined) {
  if (typeof amount !== "string" || !/^\d+(?:\.\d{1,2}0*)?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.split(".");
  const value = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, "0"));
  return Number.isSafeInteger(value) ? value : null;
}

export function snapshotId(line: PaidLine) {
  const matches = line.properties?.filter(item => item.name === "CAPPATEX_SNAPSHOT_ID") || [];
  return matches.length === 1 && /^CPS-[a-f0-9]{32}$/.test(matches[0].value) ? matches[0].value : null;
}

export function validatePaidLine(snapshot: CheckoutSnapshot, line: PaidLine, order: { currency?: string; email?: string; country?: string }) {
  const preparations = line.properties?.filter(item => item.name === "CAPPATEX_PREPARATION_ID") || [];
  const exactProperty = (name: string, value: string) => {
    const matches = line.properties?.filter(item => item.name === name) || [];
    return matches.length === 1 && matches[0].value === value;
  };
  return snapshotId(line) === snapshot.id && Boolean(line.id)
    && (snapshot.schemaVersion === 2 ? exactProperty("CAPPATEX_PREPARATION_ID", snapshot.preparation.id)
      && exactProperty("CAPPATEX_DESIGN_ID", snapshot.designId) && exactProperty("CAPPATEX_PREPARATION_SHA256", snapshot.preparationSha256)
      && !line.properties?.some(item => /^(CAPPATEX_|_CAPPATEX_)/.test(item.name)
        && !["CAPPATEX_SNAPSHOT_ID", "CAPPATEX_DESIGN_ID", "CAPPATEX_PREPARATION_ID", "CAPPATEX_PREPARATION_SHA256"].includes(item.name))
      : preparations.length === 0 && exactProperty("CAPPATEX_DESIGN_ID", snapshot.designId)
        && !line.properties?.some(item => /^(CAPPATEX_|_CAPPATEX_)/.test(item.name)
          && !["CAPPATEX_SNAPSHOT_ID", "CAPPATEX_DESIGN_ID"].includes(item.name)))
    && `gid://shopify/ProductVariant/${line.variant_id}` === snapshot.variant.shopifyVariantId
    && `gid://shopify/Product/${line.product_id}` === snapshot.profile.shopifyProductId
    && line.sku === snapshot.variant.sku && line.quantity === snapshot.quantity
    && Number.isSafeInteger(snapshot.unitPriceCents) && snapshot.unitPriceCents >= 0
    && moneyCents(line.price) === snapshot.unitPriceCents
    // A discount added in Shopify after cart creation must also enter manual review.
    && (line.total_discount === undefined || moneyCents(line.total_discount) === 0)
    && (line.discount_allocations === undefined || (Array.isArray(line.discount_allocations)
      && line.discount_allocations.every(discount => discount && moneyCents(discount.amount) === 0)))
    && order.currency === snapshot.currency && order.country === snapshot.country
    && order.email?.trim().toLowerCase() === snapshot.email.toLowerCase();
}

export async function verifyShopifyHmac(raw: ArrayBuffer, received: string, secret: string) {
  try {
    const signature = Uint8Array.from(atob(received), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("HMAC", key, signature, raw);
  } catch { return false; }
}
