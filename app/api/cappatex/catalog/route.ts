import { fetchShopifyCollection, SHOPIFY_COLLECTIONS } from "../../../shopify-catalog";
import { duplicateShopifySkus, fetchPrintifyProducts, matchShopifyProduct, uniquePrintifySkuIndex, type PrintifyProduct } from "../../../printify-catalog";

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

    const printifyVariantBySku = uniquePrintifySkuIndex(printifyProducts);
    const duplicateSkus = duplicateShopifySkus(catalog.products);

    const products = catalog.products.map((product) => {
      const { matches, product: printifyProduct } = matchShopifyProduct(product, printifyVariantBySku, duplicateSkus);
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
          fulfillmentReady: Boolean(shopify.available && printify?.variant.id && printifyProduct?.id),
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
        ? `${products.length} Shopify-Produkte sind live. Verfügbare Varianten wurden per eindeutiger SKU mit Printify abgeglichen.`
        : printifyConnected && printifyProducts.length === 0
          ? `${products.length} Shopify-Produkte sind live. Im verbundenen Printify-Shop sind noch keine Produkte vorhanden.`
          : `${products.length} Shopify-Produkte sind live. Es gibt noch keine eindeutige SKU-Zuordnung zu Printify.`,
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
