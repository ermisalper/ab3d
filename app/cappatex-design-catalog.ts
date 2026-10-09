import { CAPPATEX_DESIGN_PROFILES } from "./cappatex-design-profiles";
import { generationAccess } from "./cappatex-generation-access";
import { profileGeometryIsVerified, type PrintProfile, type ProfileVariant } from "./cappatex-print-profile";

export type DesignProfile = Omit<PrintProfile, "fulfillment"> & { mockupReferenceSize?: string };
export type CappatexDesignProduct = {
  id: string; name: string; kind: PrintProfile["kind"]; profileVersion: string;
  purchaseReady: boolean; blockedReason: string | null;
  mockupReferenceSize?: string;
  variants: Array<ProfileVariant & { title: string; available: boolean; price: { amount: string; currencyCode: string } | null }>;
};

type ProviderVariant = { id: number; options?: { color?: string; size?: string };
  placeholders?: Array<{ position: string; decoration_method?: string; width: number; height: number }> };
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
  const result: CappatexDesignProduct[] = [];
  for (const profile of profiles) {
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const [productResponse, providerResponse] = await Promise.all([
      fetch(`https://api.printify.com/v1/shops/${encodeURIComponent(shopId)}/products/${encodeURIComponent(profile.printifyProductId)}.json`,
        { headers, signal: AbortSignal.timeout(20_000) }),
      fetch(`https://api.printify.com/v1/catalog/blueprints/${profile.blueprintId}/print_providers/${profile.providerId}/variants.json`,
        { headers, signal: AbortSignal.timeout(20_000) }),
    ]);
    if (!productResponse.ok || !providerResponse.ok) continue;
    const product = await productResponse.json() as ProviderProduct;
    const provider = await providerResponse.json() as { variants?: ProviderVariant[] };
    if (product.id !== profile.printifyProductId || product.blueprint_id !== profile.blueprintId
      || product.print_provider_id !== profile.providerId || product.visible !== false) continue;
    const variants = profile.variants.flatMap(variant => {
      const matches = product.variants?.filter(item => item.id === variant.printifyVariantId || item.sku === variant.sku) || [];
      const options = provider.variants?.filter(item => item.id === variant.printifyVariantId) || [];
      const areas = options[0]?.placeholders?.filter(area => area.position === variant.area.position
        && area.decoration_method === variant.area.decorationMethod) || [];
      if (matches.length !== 1 || matches[0].id !== variant.printifyVariantId || matches[0].sku !== variant.sku
        || matches[0].is_enabled !== true || matches[0].is_available !== true
        || options.length !== 1 || options[0].options?.color !== variant.color || options[0].options?.size !== variant.size
        || areas.length !== 1 || areas[0].width !== variant.area.widthPx || areas[0].height !== variant.area.heightPx
        || !product.images?.some(image => image.src === variant.mockup.url && image.position === variant.area.position
          && image.variant_ids.includes(variant.printifyVariantId))) return [];
      return [{ ...variant, title: `${variant.color} / ${variant.size}`, available: true, price: null }];
    });
    if (variants.length) result.push({ id: profile.id, name: profile.name, kind: profile.kind, profileVersion: profile.version,
      purchaseReady: false, blockedReason: "Für deine Gestaltung freigegeben. Verkaufspreis, Versand und Bestellablauf werden noch geprüft.",
      mockupReferenceSize: profile.mockupReferenceSize, variants });
  }
  return result;
}
