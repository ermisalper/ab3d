import { verifiedCatalog } from "../../../cappatex-verified-catalog";

export async function GET() {
  try {
    const products = (await verifiedCatalog()).map(({ id, name, kind, profileVersion, variants }) => ({ id, name, kind, profileVersion, variants }));
    return Response.json({ products, checkoutEnabled: process.env.CAPPATEX_CHECKOUT_ENABLED === "true",
      message: products.length ? `${products.length} geprüfte Blanko-Produkte. Versand in die Schweiz und nach Liechtenstein.`
        : "Die Blanko-Produkte werden noch geprüft. Selbst gestaltete Artikel sind derzeit nicht bestellbar. Die fertige Kollektion findest du im normalen Katalog." },
    { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ products: [], checkoutEnabled: false, message: "Die Verfügbarkeit der Blanko-Produkte konnte gerade nicht bestätigt werden." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
