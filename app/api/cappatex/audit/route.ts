import { getChatGPTUser } from "../../../chatgpt-auth";
import { generationAccess } from "../../../cappatex-generation-access";
import { fetchPrintifyProducts } from "../../../printify-catalog";
import { fetchShopifyCollection, SHOPIFY_COLLECTIONS } from "../../../shopify-catalog";

// Owner-only, read-only account verification. No credentials, customer data or order actions.
export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const access = generationAccess(user?.email || "", "owner", process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS);
  if (!user || !access.allowed) return new Response("Forbidden", { status: 403 });
  const catalogToken = process.env.PRINTIFY_CATALOG_API_TOKEN?.trim();
  const token = catalogToken || process.env.PRINTIFY_API_TOKEN?.trim();
  const shopId = process.env.PRINTIFY_SHOP_ID?.trim();
  if (!token || !shopId) return Response.json({ error: "printify_not_configured" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const blueprint = params.get("blueprint"), provider = params.get("provider");
  if ((blueprint || provider) && (!/^\d{1,6}$/.test(blueprint || "") || !/^\d{1,6}$/.test(provider || ""))) return new Response("Invalid catalog IDs", { status: 400 });
  try {
    const get = async (path: string) => {
      const response = await fetch(`https://api.printify.com/v1/${path}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "AB3D-CAPPATEX/1.0", Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) return { status: response.status };
      return response.json();
    };
    const products = await fetchPrintifyProducts(token, shopId);
    const catalog = await fetchShopifyCollection(SHOPIFY_COLLECTIONS.cappatex);
    const blanks = await fetchShopifyCollection(SHOPIFY_COLLECTIONS.cappatexBlanks).catch(() => null);
    const details = blueprint && provider ? await Promise.all([
      get(`catalog/blueprints/${blueprint}/print_providers/${provider}/variants.json`),
      get(`catalog/blueprints/${blueprint}/print_providers/${provider}/shipping.json`),
    ]) : null;
    return Response.json({ checkedAt: new Date().toISOString(), shopId, shops: await get("shops.json"), products,
      catalogCredential: catalogToken ? "catalog_read_token" : "production_token_fallback",
      productionWritePermissions: { status: "unverified", requiredScopes: ["products.write", "uploads.write", "orders.write"],
        message: "Produktions-Schreibrechte sind ungeprüft. Erfolgreiche Leseabfragen bestätigen keine Schreibberechtigung." },
      finishedCatalog: catalog, blankCatalog: blanks, providerVariants: details?.[0], providerShipping: details?.[1],
      flags: { generation: process.env.CAPPATEX_GENERATION_ENABLED === "true", checkout: process.env.CAPPATEX_CHECKOUT_ENABLED === "true", fulfillment: process.env.CAPPATEX_FULFILLMENT_ENABLED === "true" } },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "audit_unavailable" }, { status: 503 }); }
}
