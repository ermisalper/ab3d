import type { Placement } from "./cappatex-print-profile";

export type DesignState = { designId: string; profileId: string; variantId: string; quantity: number; country: "CH" | "LI"; placement?: Placement };
type ProductSelection = { id: string; variants: Array<{ shopifyVariantId: string }> };

export function retainedPlacement(currentProductId: string | undefined, nextProductId: string, placement: Placement): Placement | null {
  return currentProductId === nextProductId ? { ...placement } : null;
}

export function verifiedDesignSelection(state: DesignState, products: ProductSelection[]) {
  const product = products.find(item => item.id === state.profileId);
  const variant = product?.variants.find(item => item.shopifyVariantId === state.variantId);
  return { profileId: product?.id || "", variantId: variant?.shopifyVariantId || "", placement: variant ? state.placement : undefined,
    requiresSelection: Boolean(state.profileId) && !variant };
}

export function readDesignState(search: string): DesignState {
  const query = new URLSearchParams(search);
  const id = query.get("designId") || "";
  const quantity = Number(query.get("quantity") || 1);
  const coordinates = ["x", "y", "scale"].map(key => query.has(key) ? Number(query.get(key)) : NaN);
  const placement = coordinates.every(Number.isFinite) && coordinates[0] >= 0 && coordinates[0] <= 1
    && coordinates[1] >= 0 && coordinates[1] <= 1 && coordinates[2] > 0 && coordinates[2] <= 1
    ? { x: coordinates[0], y: coordinates[1], scale: coordinates[2] } : undefined;
  return { designId: /^CPX-[A-Z0-9]{12}$/.test(id) ? id : "", profileId: (query.get("profileId") || "").slice(0, 160),
    variantId: /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(query.get("variantId") || "") ? query.get("variantId")! : "",
    quantity: Number.isInteger(quantity) && quantity >= 1 && quantity <= 5 ? quantity : 1,
    country: query.get("country") === "LI" ? "LI" : "CH", placement };
}

export function designStateUrl(currentUrl: string, state: DesignState) {
  const url = new URL(currentUrl);
  for (const [key, value] of Object.entries({ designId: state.designId, profileId: state.profileId, variantId: state.variantId,
    quantity: state.quantity, country: state.country, ...state.placement })) {
    if (value === "") url.searchParams.delete(key); else url.searchParams.set(key, String(value));
  }
  return url.toString();
}
