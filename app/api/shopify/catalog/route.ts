import { fetchShopifyCollection, SHOPIFY_COLLECTIONS } from "../../../shopify-catalog";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("collection") || "all";
  if (!new Set(["all", "ab3d", "cappatex"]).has(requested)) {
    return Response.json({ error: "Unbekannte Produktkollektion." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const entries = await Promise.all(
      (requested === "all" ? ["ab3d", "cappatex"] : [requested]).map(async (key) => [
        key,
        await fetchShopifyCollection(SHOPIFY_COLLECTIONS[key as "ab3d" | "cappatex"]),
      ] as const),
    );
    return Response.json({ configured: true, collections: Object.fromEntries(entries) }, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (caught) {
    console.error("Shopify catalog unavailable", { type: caught instanceof Error ? caught.message : "unknown" });
    return Response.json({ configured: false, collections: {}, error: "Der Shopify-Produktkatalog ist momentan nicht erreichbar." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

