import { verifiedCatalog } from "../../../cappatex-verified-catalog";
import { designCatalog, type CappatexDesignProduct } from "../../../cappatex-design-catalog";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function GET() {
  try {
    const user = await getChatGPTUser();
    const [sales, designs] = await Promise.allSettled([verifiedCatalog(), user ? designCatalog(user.email) : Promise.resolve([])]);
    const products: CappatexDesignProduct[] = sales.status === "fulfilled" ? sales.value.map(({ id, name, kind, profileVersion, variants }) => {
      const design = designs.status === "fulfilled" ? designs.value.find(p => p.id === id && p.profileVersion === profileVersion) : undefined;
      return { id, name, kind, profileVersion, purchaseReady: true, blockedReason: null,
        mockupReferenceSize: design?.mockupReferenceSize, optionLabel: design?.optionLabel,
        // Only enrich an existing sales variant. A design-only SKU must never inherit a sales approval.
        variants: variants.map(variant => {
          const candidate = design?.variants.find(v => v.shopifyVariantId === variant.shopifyVariantId && v.printifyVariantId === variant.printifyVariantId
            && v.sku === variant.sku && v.color === variant.color && v.size === variant.size
            && JSON.stringify(v.area) === JSON.stringify(variant.area) && JSON.stringify(v.mockup) === JSON.stringify(variant.mockup));
          return { ...variant, ...(candidate ? { back: candidate.back, photos: candidate.photos } : {}) };
        }) };
    }) : [];
    if (designs.status === "fulfilled") products.push(...designs.value.filter(item => !products.some(product => product.id === item.id)));
    if (!products.length && (sales.status === "rejected" || designs.status === "rejected")) throw new Error("catalog_unavailable");
    return Response.json({ products, checkoutEnabled: process.env.CAPPATEX_CHECKOUT_ENABLED === "true" && products.some(product => product.purchaseReady),
      message: products.some(product => !product.purchaseReady) ? "Echtes Blanko für deine Gestaltung: Farbe, Grösse und Platzierung sind wählbar. Bestellungen sind noch gesperrt."
        : products.length ? `${products.length} geprüfte Blanko-Produkte. Versand in die Schweiz und nach Liechtenstein.`
        : "Die Blanko-Produkte werden noch geprüft. Selbst gestaltete Artikel sind derzeit nicht bestellbar. Die fertige Kollektion findest du im normalen Katalog." },
    { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ products: [], checkoutEnabled: false, message: "Die Verfügbarkeit der Blanko-Produkte konnte gerade nicht bestätigt werden." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
