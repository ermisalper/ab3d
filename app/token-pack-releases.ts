import type { TokenPackId } from "./token-packs";

/** An operator adds a binding only after both countries' paid-checkout and receipt tests succeed.
 * No product/variant IDs are inferred from names, browser input, existing physical products or SKUs.
 * These are review records, never a runtime override or a substitute for Shopify's current product check. */
export type TokenPackRelease = {
  packId: TokenPackId;
  version: string;
  shopDomain: string;
  variantId: string;
  sku: string;
  countries: Array<"CH" | "LI">;
  digital: true;
  taxInclusive: true;
  checkoutVerifiedAt: string;
  webhookReceiptVerifiedAt: string;
};

// Intentionally empty: no digital token products, payment checkout or webhook have been verified yet.
export const TOKEN_PACK_RELEASES: readonly TokenPackRelease[] = [];
