import { CAPPATEX_DESIGN_PROFILES } from "./cappatex-design-profiles";
import { generationAccess } from "./cappatex-generation-access";
import { profileGeometryIsVerified, type PrintProfile, type ProfileVariant } from "./cappatex-print-profile";

export type DesignProfile = Omit<PrintProfile, "fulfillment"> & {
  mockupReferenceSize?: string;
  optionKey?: "paper" | "surface";
  // Some measured front-camera photos are tagged "other" by Printify's product API.
  mockupPosition?: "other";
};
export type CappatexDesignProduct = {
  id: string; name: string; kind: PrintProfile["kind"]; profileVersion: string;
  purchaseReady: boolean; blockedReason: string | null;
  mockupReferenceSize?: string;
  optionLabel?: string;
  variants: Array<ProfileVariant & { title: string; available: boolean; price: { amount: string; currencyCode: string } | null }>;
};

type ProviderVariant = { id: number; options?: { color?: string; size?: string; paper?: string; surface?: string };
  placeholders?: Array<{ position: string; decoration_method?: string; width: number; height: number }> };
type ProviderVariants = { variants?: ProviderVariant[] };
type ProviderProduct = { id: string; blueprint_id: number; print_provider_id: number; visible: boolean;
  variants?: Array<{ id: number; sku: string; is_enabled: boolean; is_available: boolean }>;
  images?: Array<{ src: string; position: string; variant_ids: number[] }> };

/** A private, read-only design catalog; never used by the checkout validator. */
export async function designCatalog(email: string): Promise<CappatexDesignProduct[]> {
  if (!generationAccess(email, "owner", process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS).allowed) return [];
  const shopId = process.env.PRINTIFY_SHOP_ID?.trim() || "";
  const token = process.env.PRINTIFY_API_TOKEN?.trim();
  const profiles = CAPPATEX_DESIGN_PROFILES.filter(profile => profileGeometryIsVerified(profile, shopId));
  if (!token || !profiles.length) return [];
  // Required by https://developers.printify.com/#authentication, also on Worker fetch.
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "AB3D-CAPPATEX/1.0" };
  async function readJson<T>(url: string): Promise<T | null> {
    // Retry only transient read failures, never accept stale or mismatched product data.
    for (let attempt = 0; attempt < 2; attempt++) {
      let status = "network";
      try {
        const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
        status = String(response.status);
        if (response.ok) {
          try { return await response.json() as T; }
          catch { console.warn("cappatex_catalog_read", { endpoint: new URL(url).pathname, issue: "invalid_json" }); return null; }
        }
        await response.body?.cancel();
        if (response.status !== 429 && response.status < 500) {
          console.warn("cappatex_catalog_read", { endpoint: new URL(url).pathname, issue: status }); return null;
        }
      } catch { /* Network failures are safe to retry for these GET-only endpoints. */ }
      if (attempt === 1) console.warn("cappatex_catalog_read", { endpoint: new URL(url).pathname, issue: status });
      else await new Promise(resolve => setTimeout(resolve, 300));
    }
    return null;
  }
  // Share one provider read only within this request; availability is always read afresh.
  const providers = new Map<string, Promise<ProviderVariants | null>>();
  function providerVariants(profile: DesignProfile) {
    const url = `https://api.printify.com/v1/catalog/blueprints/${profile.blueprintId}/print_providers/${profile.providerId}/variants.json`;
    let pending = providers.get(url);
    if (!pending) { pending = readJson<ProviderVariants>(url); providers.set(url, pending); }
    return pending;
  }
  async function inspectProduct(profile: DesignProfile): Promise<CappatexDesignProduct | null> {
    try {
      // Both reads settle before this worker takes another profile, including on failure.
      const [product, provider] = await Promise.all([
        readJson<ProviderProduct>(`https://api.printify.com/v1/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(profile.printifyProductId)}.json`),
        providerVariants(profile),
      ]);
      if (!product || !provider || product.id !== profile.printifyProductId || product.blueprint_id !== profile.blueprintId
        || product.print_provider_id !== profile.providerId || product.visible !== false) {
        console.warn("cappatex_catalog_product", { profile: profile.id, issue: !product || !provider ? "read_unavailable" : "identity_or_visibility" });
        return null;
      }
      const rejected: Record<string, number> = {};
      const variants = profile.variants.flatMap(variant => {
        const matches = product.variants?.filter(item => item.id === variant.printifyVariantId || item.sku === variant.sku) || [];
        const options = provider.variants?.filter(item => item.id === variant.printifyVariantId) || [];
        const areas = options[0]?.placeholders?.filter(area => area.position === variant.area.position
          && area.decoration_method === variant.area.decorationMethod) || [];
        const issue = matches.length !== 1 || matches[0].id !== variant.printifyVariantId || matches[0].sku !== variant.sku
          || matches[0].is_enabled !== true || matches[0].is_available !== true
          ? "variant_or_stock"
          : options.length !== 1 || options[0].options?.[profile.optionKey || "color"] !== variant.color || options[0].options?.size !== variant.size ? "options"
          : areas.length !== 1 || areas[0].width !== variant.area.widthPx || areas[0].height !== variant.area.heightPx ? "print_area"
          : !product.images?.some(image => image.src === variant.mockup.url && image.position === (profile.mockupPosition || variant.area.position)
            && image.variant_ids.includes(variant.printifyVariantId)) ? "photo" : null;
        if (issue) { rejected[issue] = (rejected[issue] || 0) + 1; return []; }
        return [{ ...variant, title: `${variant.color} / ${variant.size}`, available: true, price: null }];
      });
      if (!variants.length) console.warn("cappatex_catalog_product", { profile: profile.id, issue: "no_verified_variants", rejected });
      return variants.length ? { id: profile.id, name: profile.name, kind: profile.kind, profileVersion: profile.version,
        purchaseReady: false, blockedReason: "Für deine Gestaltung freigegeben. Verkaufspreis, Versand und Bestellablauf werden noch geprüft.",
        mockupReferenceSize: profile.mockupReferenceSize,
        optionLabel: profile.optionKey === "paper" ? "Papier" : profile.optionKey === "surface" ? "Oberfläche" : "Farbe", variants } : null;
    } catch { console.warn("cappatex_catalog_product", { profile: profile.id, issue: "invalid_product_data" }); return null; }
  }
  const result: Array<CappatexDesignProduct | null> = new Array(profiles.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, profiles.length) }, async () => {
    while (next < profiles.length) {
      const index = next++;
      result[index] = await inspectProduct(profiles[index]);
    }
  }));
  return result.filter((product): product is CappatexDesignProduct => product !== null);
}
