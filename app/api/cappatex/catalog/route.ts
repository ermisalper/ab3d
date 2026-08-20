import { fetchShopifyCollection, SHOPIFY_COLLECTIONS } from "../../../shopify-catalog";

type PrintifyVariant = {
  id?: number;
  sku?: string;
  is_enabled?: boolean;
  is_available?: boolean;
};

type PrintifyProduct = {
  id?: string;
  blueprint_id?: number;
  print_provider_id?: number;
  variants?: PrintifyVariant[];
  visible?: boolean;
};

function productKind(title = "", category = "") {
  const value = `${title} ${category}`.toLowerCase();
  if (/phone|case|hülle/.test(value)) return "case";
  if (/cap|hat|mütze/.test(value)) return "cap";
  if (/swim|bade|bikini/.test(value)) return "swimwear";
  if (/hoodie|sweat/.test(value)) return "hoodie";
  if (/sock|socken/.test(value)) return "socks";
  if (/poster|canvas|leinwand/.test(value)) return "poster";
  if (/notebook|notiz/.test(value)) return "notebook";
  if (/underwear|brief|boxer|unterwäsche/.test(value)) return "underwear";
  return "tshirt";
}

async function fetchPrintifyProducts(token: string, shopId: string) {
  const response = await fetch(`https://api.printify.com/v1/shops/${encodeURIComponent(shopId)}/products.json?limit=50`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null) as { data?: PrintifyProduct[] } | null;
  if (!response.ok) throw new Error(`printify_http_${response.status}`);
  return (payload?.data || []).filter((product) => product.visible !== false);
}

export async function GET() {
  try {
    const catalog = await fetchShopifyCollection(SHOPIFY_COLLECTIONS.cappatex);
    const printifyToken = process.env.PRINTIFY_API_TOKEN?.trim();
    const printifyShopId = process.env.PRINTIFY_SHOP_ID?.trim();
    let printifyProducts: PrintifyProduct[] = [];
    let printifyConnected = false;

    if (printifyToken && printifyShopId) {
      try {
        printifyProducts = await fetchPrintifyProducts(printifyToken, printifyShopId);
        printifyConnected = true;
      } catch (error) {
        console.error("CAPPATEX Printify catalog unavailable", { type: error instanceof Error ? error.message : "unknown" });
      }
    }

    const printifyVariantBySku = new Map<string, { product: PrintifyProduct; variant: PrintifyVariant }>();
    for (const product of printifyProducts) {
      for (const variant of product.variants || []) {
        const sku = variant.sku?.trim();
        if (sku && variant.id && variant.is_enabled !== false && variant.is_available !== false) {
          printifyVariantBySku.set(sku, { product, variant });
        }
      }
    }

    const products = catalog.products.map((product) => {
      const matches = product.variants.map((variant) => ({
        shopify: variant,
        printify: variant.sku ? printifyVariantBySku.get(variant.sku) : undefined,
      }));
      const printifyProduct = matches.find((match) => match.printify)?.printify?.product;
      return {
        id: product.handle,
        shopifyProductId: product.shopifyId,
        printifyProductId: printifyProduct?.id || null,
        kind: productKind(product.name, product.category),
        name: product.name,
        category: product.category,
        description: product.description,
        image: product.image,
        price: product.price,
        currency: product.currency,
        source: "shopify" as const,
        blueprintId: printifyProduct?.blueprint_id || null,
        printProviderId: printifyProduct?.print_provider_id || null,
        variants: matches.map(({ shopify, printify }) => ({
          printifyVariantId: printify?.variant.id || null,
          shopifyVariantId: shopify.id,
          sku: shopify.sku,
          title: shopify.title,
          available: shopify.available,
          fulfillmentReady: Boolean(printify?.variant.id && printifyProduct?.id),
          price: { amount: shopify.price.toFixed(2), currencyCode: shopify.currency },
        })),
      };
    });
    const fulfillmentConfigured = printifyConnected
      && products.some((product) => product.variants.some((variant) => variant.fulfillmentReady));

    return Response.json({
      configured: true,
      fulfillmentConfigured,
      products,
      message: fulfillmentConfigured
        ? `${products.length} Shopify-Produkte sind live und mit Printify abgeglichen.`
        : `${products.length} Shopify-Produkte sind live. Die Printify-Varianten werden noch verknüpft.`,
    }, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("CAPPATEX Shopify catalog exception", { type: error instanceof Error ? error.message : "unknown" });
    return Response.json({
      configured: false,
      products: [],
      message: "Der Shopify-Produktkatalog ist momentan nicht erreichbar.",
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
