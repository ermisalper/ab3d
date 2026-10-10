import type { Placement } from "./cappatex-print-profile";

export type ProductConfiguration = { profileVersion: string; variantId: string; placement: Placement };
export type ProductConfigurations = Record<string, ProductConfiguration>;
export type DesignState = { designId: string; profileId: string; variantId: string; quantity: number; country: "CH" | "LI"; side?: "front" | "back"; placement?: Placement; configurations?: ProductConfigurations };
type ProductSelection = { id: string; profileVersion?: string; variants: Array<{ shopifyVariantId: string; back?: unknown }> };
type VersionedSelection = ProductSelection & { profileVersion: string };

function validPlacement(placement: Placement) {
  return [placement.x, placement.y, placement.scale].every(Number.isFinite)
    && placement.x >= 0 && placement.x <= 1 && placement.y >= 0 && placement.y <= 1 && placement.scale > 0 && placement.scale <= 1;
}

export function rememberedConfiguration(product: VersionedSelection, configurations: ProductConfigurations) {
  const saved = configurations[product.id];
  return saved && saved.profileVersion === product.profileVersion && saved.placement && validPlacement(saved.placement)
    && product.variants.some(variant => variant.shopifyVariantId === saved.variantId)
    ? { ...saved, placement: { ...saved.placement } } : undefined;
}

export function rememberConfiguration(configurations: ProductConfigurations, product: VersionedSelection, variantId: string, placement: Placement): ProductConfigurations {
  if (!validPlacement(placement) || !product.variants.some(variant => variant.shopifyVariantId === variantId)) return configurations;
  return { ...configurations, [product.id]: { profileVersion: product.profileVersion, variantId, placement: { ...placement } } };
}

/** Missing catalog entries may be temporary. Retain their choices without making them selectable. */
export function reconcileConfigurations(products: VersionedSelection[], configurations: ProductConfigurations): ProductConfigurations {
  const result = { ...configurations };
  for (const product of products) {
    const saved = rememberedConfiguration(product, configurations);
    if (saved) result[product.id] = saved;
    else delete result[product.id];
    const backProduct = { ...product, id: `${product.id}:back`, variants: product.variants.filter(variant => variant.back) };
    const back = rememberedConfiguration(backProduct, configurations);
    if (back) result[backProduct.id] = back;
    else delete result[backProduct.id];
  }
  return result;
}

function readConfigurations(value: string | null): ProductConfigurations | undefined {
  if (!value || value.length > 10_000) return undefined;
  try {
    const entries: unknown = JSON.parse(value);
    if (!Array.isArray(entries) || entries.length > 20) return undefined;
    const configurations: Array<[string, ProductConfiguration]> = [];
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 6) continue;
      const [id, profileVersion, variantId, x, y, scale] = entry;
      if (typeof id !== "string" || !id || id.length > 160 || typeof profileVersion !== "string" || !profileVersion || profileVersion.length > 160
        || typeof variantId !== "string" || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variantId) || !validPlacement({ x, y, scale })) continue;
      configurations.push([id, { profileVersion, variantId, placement: { x, y, scale } }]);
    }
    return configurations.length ? Object.fromEntries(configurations) : undefined;
  } catch { return undefined; }
}

export function retainedPlacement(currentProductId: string | undefined, nextProductId: string, placement: Placement): Placement | null {
  return currentProductId === nextProductId ? { ...placement } : null;
}

export function verifiedDesignSelection(state: DesignState, products: ProductSelection[]) {
  const product = products.find(item => item.id === state.profileId);
  const savedVersion = state.configurations?.[state.side === "back" ? `${state.profileId}:back` : state.profileId]?.profileVersion;
  const variant = (!savedVersion || savedVersion === product?.profileVersion)
    ? product?.variants.find(item => item.shopifyVariantId === state.variantId) : undefined;
  const sideAvailable = state.side !== "back" || Boolean(variant?.back);
  return { profileId: product?.id || "", variantId: variant?.shopifyVariantId || "", placement: variant && sideAvailable ? state.placement : undefined,
    side: sideAvailable && state.side === "back" ? "back" as const : "front" as const,
    requiresSelection: Boolean(state.profileId) && (!variant || !sideAvailable) };
}

export function readDesignState(search: string): DesignState {
  const query = new URLSearchParams(search);
  const id = query.get("designId") || "";
  const quantity = Number(query.get("quantity") || 1);
  const coordinates = ["x", "y", "scale"].map(key => query.has(key) ? Number(query.get(key)) : NaN);
  const placement = coordinates.every(Number.isFinite) && coordinates[0] >= 0 && coordinates[0] <= 1
    && coordinates[1] >= 0 && coordinates[1] <= 1 && coordinates[2] > 0 && coordinates[2] <= 1
    ? { x: coordinates[0], y: coordinates[1], scale: coordinates[2] } : undefined;
  const configurations = readConfigurations(query.get("products"));
  return { designId: /^CPX-[A-Z0-9]{12}$/.test(id) ? id : "", profileId: (query.get("profileId") || "").slice(0, 160),
    variantId: /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(query.get("variantId") || "") ? query.get("variantId")! : "",
    quantity: Number.isInteger(quantity) && quantity >= 1 && quantity <= 5 ? quantity : 1,
    country: query.get("country") === "LI" ? "LI" : "CH", ...(query.get("side") === "back" ? { side: "back" as const } : {}), placement, ...(configurations ? { configurations } : {}) };
}

export function designStateUrl(currentUrl: string, state: DesignState) {
  const url = new URL(currentUrl);
  if (state.side === "back") url.searchParams.set("side", "back"); else url.searchParams.delete("side");
  for (const [key, value] of Object.entries({ designId: state.designId, profileId: state.profileId, variantId: state.variantId,
    quantity: state.quantity, country: state.country, ...state.placement })) {
    if (value === "") url.searchParams.delete(key); else url.searchParams.set(key, String(value));
  }
  const configurations = Object.entries(state.configurations || {}).slice(-20)
    .map(([id, saved]) => [id, saved.profileVersion, saved.variantId, saved.placement.x, saved.placement.y, saved.placement.scale]);
  if (configurations.length) url.searchParams.set("products", JSON.stringify(configurations)); else url.searchParams.delete("products");
  return url.toString();
}
