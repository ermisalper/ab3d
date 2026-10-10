import { CAPPATEX_PRINT_PROFILES } from "./cappatex-profiles";
import { profileIsVerified, type PrintProfile } from "./cappatex-print-profile";
import { duplicateShopifySkus, fetchPrintifyProducts, uniquePrintifySkuIndex } from "./printify-catalog";
import { fetchShopifyCollection, SHOPIFY_COLLECTIONS } from "./shopify-catalog";

export async function verifiedCatalog() {
  const shopId = process.env.PRINTIFY_SHOP_ID?.trim() || "";
  const token = process.env.PRINTIFY_API_TOKEN?.trim();
  const profiles = CAPPATEX_PRINT_PROFILES.filter(profile => profileIsVerified(profile, shopId));
  if (!token || !profiles.length) return [];
  const [catalog, products] = await Promise.all([
    fetchShopifyCollection(SHOPIFY_COLLECTIONS.cappatexBlanks), fetchPrintifyProducts(token, shopId),
  ]);
  const duplicates = duplicateShopifySkus(catalog.products);
  const index = uniquePrintifySkuIndex(products);
  const result = [];
  for (const profile of profiles) {
    const product = catalog.products.find(item => item.shopifyId === profile.shopifyProductId);
    if (!product) continue;
    // Check today's provider geometry and shipping instead of trusting an old saved SKU.
    const root = `https://api.printify.com/v1/catalog/blueprints/${profile.blueprintId}/print_providers/${profile.providerId}`;
    const headers = { Authorization: `Bearer ${token}`, "User-Agent": "AB3D-CAPPATEX/1.0", Accept: "application/json" };
    const [variantResponse, shippingResponse] = await Promise.all([
      fetch(`${root}/variants.json`, { headers, signal: AbortSignal.timeout(20_000) }),
      fetch(`${root}/shipping.json`, { headers, signal: AbortSignal.timeout(20_000) }),
    ]);
    if (!variantResponse.ok || !shippingResponse.ok) continue;
    const variantData = await variantResponse.json() as { variants?: Array<{ id: number; options?: { color?: string; size?: string }; placeholders?: Array<{ position: string; width: number; height: number; decoration_method?: string }> }> };
    const shippingData = await shippingResponse.json() as { profiles?: Array<{ variant_ids: number[]; countries: string[]; first_item: { cost: number; currency: string }; additional_items: { cost: number; currency: string } }> };
    const variants = profile.variants.flatMap(verified => {
      const shopify = product.variants.find(item => item.id === verified.shopifyVariantId && item.sku === verified.sku);
      const printify = index.get(verified.sku);
      const providerVariant = variantData.variants?.find(item => item.id === verified.printifyVariantId);
      const area = providerVariant?.placeholders?.find(item => item.position === verified.area.position
        && item.decoration_method === verified.area.decorationMethod);
      const shippingMatches = verified.shipping.every(rate => shippingData.profiles?.some(live =>
        live.variant_ids.includes(verified.printifyVariantId) && live.countries.includes(rate.country)
        && live.first_item.currency === rate.currency && live.first_item.cost === rate.firstCents
        && live.additional_items.currency === rate.currency && live.additional_items.cost === rate.additionalCents));
      if (!shopify?.available || !printify || duplicates.has(verified.sku) || !shippingMatches
        || shopify.color !== verified.color || shopify.size !== verified.size
        || providerVariant?.options?.color !== verified.color || providerVariant?.options?.size !== verified.size
        || printify.product.id !== profile.printifyProductId || printify.product.blueprint_id !== profile.blueprintId
        || printify.product.print_provider_id !== profile.providerId || printify.variant.id !== verified.printifyVariantId
        || printify.variant.is_enabled !== true || printify.variant.is_available !== true
        || area?.width !== verified.area.widthPx || area?.height !== verified.area.heightPx) return [];
      return [{ ...verified, title: shopify.title, available: true, price: { amount: shopify.price.toFixed(2), currencyCode: shopify.currency } }];
    });
    if (variants.length) result.push({ id: profile.id, name: profile.name, kind: profile.kind,
      profileVersion: profile.version, profile, variants });
  }
  return result;
}

export type VerifiedCatalogProduct = {
  id: string; name: string; kind: PrintProfile["kind"]; profileVersion: string;
  variants: Array<PrintProfile["variants"][number] & { title: string; available: boolean; price: { amount: string; currencyCode: string } }>;
};
