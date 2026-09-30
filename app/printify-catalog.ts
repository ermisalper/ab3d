import type { ShopifyCatalogProduct } from "./shopify-catalog";

export type PrintifyVariant = {
  id?: number;
  sku?: string;
  is_enabled?: boolean;
  is_available?: boolean;
};

export type PrintifyProduct = {
  id?: string;
  blueprint_id?: number;
  print_provider_id?: number;
  variants?: PrintifyVariant[];
  visible?: boolean;
};

export type PrintifyMatch = { product: PrintifyProduct; variant: PrintifyVariant };

export async function fetchPrintifyProducts(token: string, shopId: string) {
  const products: PrintifyProduct[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${encodeURIComponent(shopId)}/products.json?limit=50&page=${page}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      },
    );
    const payload = await response.json().catch(() => null) as {
      data?: PrintifyProduct[];
      last_page?: number;
    } | null;
    if (!response.ok || !Array.isArray(payload?.data)) throw new Error(`printify_http_${response.status}`);
    products.push(...payload.data.filter((product) => product.visible !== false));
    if (page >= (payload.last_page || 1)) return products;
  }
  throw new Error("printify_catalog_too_large");
}

export function uniquePrintifySkuIndex(products: PrintifyProduct[]) {
  const matches = new Map<string, PrintifyMatch>();
  const ambiguous = new Set<string>();
  for (const product of products) {
    if (!product.id || !product.blueprint_id || !product.print_provider_id) continue;
    for (const variant of product.variants || []) {
      const sku = variant.sku?.trim();
      if (!sku || !variant.id || variant.is_enabled === false || variant.is_available === false) continue;
      if (matches.has(sku)) {
        ambiguous.add(sku);
        matches.delete(sku);
      } else if (!ambiguous.has(sku)) {
        matches.set(sku, { product, variant });
      }
    }
  }
  return matches;
}

export function matchShopifyProduct(product: ShopifyCatalogProduct, skuIndex: Map<string, PrintifyMatch>, duplicateShopifySkus: Set<string>) {
  const matches = product.variants.map((variant) => ({
    shopify: variant,
    printify: variant.sku && !duplicateShopifySkus.has(variant.sku) ? skuIndex.get(variant.sku) : undefined,
  }));
  const productIds = new Set(matches.flatMap(({ printify }) => printify?.product.id ? [printify.product.id] : []));
  if (productIds.size !== 1) return { product: undefined, matches: matches.map(({ shopify }) => ({ shopify, printify: undefined })) };
  return { product: matches.find(({ printify }) => printify)?.printify?.product, matches };
}

export function duplicateShopifySkus(products: ShopifyCatalogProduct[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const product of products) for (const variant of product.variants) {
    if (!variant.sku) continue;
    if (seen.has(variant.sku)) duplicates.add(variant.sku);
    seen.add(variant.sku);
  }
  return duplicates;
}
