import type { Placement, PrintProfile, ProfileVariant } from "./cappatex-print-profile";

export type CheckoutSnapshot = {
  id: string;
  email: string;
  designId: string;
  artwork: { key: string; sha256: string; width: number; height: number; format: "png" };
  profile: PrintProfile;
  variant: ProfileVariant;
  placement: Placement;
  quantity: number;
  country: "CH" | "LI";
  unitPriceCents: number;
  currency: string;
  legalVersion: string;
  consentAt: number;
};

export type PaidLine = { id?: number | string; variant_id?: number | string; product_id?: number | string;
  quantity?: number; sku?: string; price?: string; properties?: Array<{ name: string; value: string }> };

export function snapshotId(line: PaidLine) {
  const matches = line.properties?.filter(item => item.name === "CAPPATEX_SNAPSHOT_ID") || [];
  return matches.length === 1 && /^CPS-[a-f0-9]{32}$/.test(matches[0].value) ? matches[0].value : null;
}

export function validatePaidLine(snapshot: CheckoutSnapshot, line: PaidLine, order: { currency?: string; email?: string; country?: string }) {
  return snapshotId(line) === snapshot.id && Boolean(line.id)
    && `gid://shopify/ProductVariant/${line.variant_id}` === snapshot.variant.shopifyVariantId
    && `gid://shopify/Product/${line.product_id}` === snapshot.profile.shopifyProductId
    && line.sku === snapshot.variant.sku && line.quantity === snapshot.quantity
    && Math.round(Number(line.price) * 100) === snapshot.unitPriceCents
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
