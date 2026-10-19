import { env } from "cloudflare:workers";
import { CAPPATEX_PRINT_PROFILES } from "./cappatex-profiles";
import { designCatalog } from "./cappatex-design-catalog";
import { verifiedCatalog } from "./cappatex-verified-catalog";
import { placementGeometry, profileIsVerified, type PrintProfile, type ProfileVariant } from "./cappatex-print-profile";
import { PRINT_RENDERER_VERSION } from "./cappatex-print-file";
import { pngSize, sha256 } from "./cappatex-artwork";
import { readPreparation } from "./cappatex-preparation-storage";
import { assertPreparedRaster } from "./cappatex-print-raster";
import { printFileProof } from "./cappatex-print-proof";
import type { PreparedDesign, PrintSide } from "./cappatex-preparation";
import { moneyCents, type PreparedCheckoutSnapshot } from "./cappatex-snapshot";
import { shippingReleaseForBasket, shippingReleaseBinding, type ShippingReleaseBinding } from "./cappatex-shipping";

export type PreparedCheckoutStatus = { enabled: boolean; reason: string; unitPriceCents?: number; currency?: "CHF" };
type Rejected = { ok: false; code: string; reason: string };
const rejected = (code: string, reason: string): Rejected => ({ ok: false, code, reason });
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sideKey = (sides: PrintSide[]) => [...sides].sort().join("+");
const identity = (variant: PreparedDesign["variant"]) => ({ shopifyVariantId: variant.shopifyVariantId,
  printifyVariantId: variant.printifyVariantId, sku: variant.sku, color: variant.color, size: variant.size });
const currentCatalogs = (email: string) => Promise.all([verifiedCatalog(), designCatalog(email)]);
/** A single request may check multiple line items; never retain this context across HTTP requests. */
export type PreparedCheckoutContext = { email?: string; catalogs?: ReturnType<typeof currentCatalogs> };

/** The approved full-canvas bytes are the only files sent to Printify; never re-render after payment. */
export async function preparedPrintFile(side: PreparedDesign["sides"][number]) {
    assertPreparedRaster(side);
    if (!/^[a-f0-9]{64}$/.test(side.file.sha256) || side.file.width !== side.area.widthPx || side.file.height !== side.area.heightPx)
      throw new Error("prepared_file_changed");
    const object = await env.BUCKET.get(side.file.key);
    if (!object) throw new Error("prepared_file_missing");
    if (object.size !== undefined && object.size > 16_000_000) throw new Error("prepared_file_changed");
    const bytes = new Uint8Array(await object.arrayBuffer());
    const dimensions = pngSize(bytes);
    if (bytes.length > 16_000_000 || await sha256(bytes) !== side.file.sha256 || dimensions.width !== side.file.width
      || dimensions.height !== side.file.height || bytes[24] !== 8 || bytes[25] !== 6) throw new Error("prepared_file_changed");
    const proof = await printFileProof(bytes);
    return { position: side.position, bytes, width: dimensions.width, height: dimensions.height, proof };
}

/** At most one full-canvas PNG is retained while uploading; never collect both sides into an array. */
export async function* preparedPrintFiles(saved: PreparedDesign) {
  for (const side of saved.sides) yield await preparedPrintFile(side);
}

/** Both catalog reads are required: the sales price/route and each current photographic print side. */
export async function validatePreparedCheckout(saved: PreparedDesign, email: string, context: PreparedCheckoutContext = {}): Promise<Rejected | {
  ok: true; profile: PrintProfile; variant: ProfileVariant; unitPriceCents: number; currency: "CHF";
  shippingRelease: ShippingReleaseBinding;
}> {
  if (process.env.CAPPATEX_CHECKOUT_ENABLED !== "true") return rejected("checkout_disabled", "Bestellungen bleiben bis zur Preis-, Versand- und Checkout-Abnahme gesperrt.");
  try {
    if (saved.schemaVersion !== 2 || saved.rendererVersion !== PRINT_RENDERER_VERSION)
      return rejected("renderer_changed", "Die gespeicherten Druckdateien benötigen eine erneute technische Freigabe.");
    const profile = CAPPATEX_PRINT_PROFILES.find(p => p.id === saved.profileId && p.version === saved.profileVersion);
    if (!profile || !profileIsVerified(profile, process.env.PRINTIFY_SHOP_ID?.trim() || ""))
      return rejected("profile_unapproved", "Verkauf, Versand und der eindeutige Bestellweg sind für dieses Produkt noch nicht freigegeben.");
    const variant = profile.variants.find(v => v.shopifyVariantId === saved.variant.shopifyVariantId);
    if (!variant || !equal(identity(variant), saved.variant) || saved.shopId !== profile.shopId
      || saved.printifyProductId !== profile.printifyProductId || saved.blueprintId !== profile.blueprintId || saved.providerId !== profile.providerId
      || !Number.isInteger(saved.quantity) || saved.quantity < 1 || saved.quantity > 5 || !["CH", "LI"].includes(saved.country))
      return rejected("preparation_changed", "Die gespeicherte Variante ist nicht mehr bestätigt.");
    if (!Array.isArray(saved.sides) || saved.sides.length < 1 || saved.sides.length > 2
      || new Set(saved.sides.map(s => s.position)).size !== saved.sides.length || saved.sides.some(s => !["front", "back"].includes(s.position)))
      return rejected("sides_unapproved", "Die gespeicherten Druckseiten sind nicht freigegeben.");
    const approval = profile.preparedCheckout;
    const offers = approval?.offers.filter(offer => offer.shopifyVariantId === variant.shopifyVariantId) || [];
    const offer = offers[0];
    const permittedSets = offer?.sideSets?.map(set => Array.isArray(set) && set.length >= 1 && set.length <= 2
      && new Set(set).size === set.length && set.every(side => side === "front" || side === "back") ? sideKey(set) : null);
    if (approval?.rendererVersion !== PRINT_RENDERER_VERSION || offers.length !== 1 || !Number.isSafeInteger(offer.unitPriceCents)
      || offer.unitPriceCents <= 0 || offer.currency !== "CHF" || !permittedSets?.length || permittedSets.some(set => set === null)
      || new Set(permittedSets).size !== permittedSets.length || !permittedSets.includes(sideKey(saved.sides.map(s => s.position))))
      return rejected("side_price_unapproved", "Für diese Druckseiten fehlt ein ausdrücklich genehmigter Verkaufspreis.");
    const shipping = shippingReleaseForBasket([{ profileId: profile.id, profileVersion: profile.version,
      shopifyVariantId: variant.shopifyVariantId, quantity: saved.quantity }], saved.country);
    if (!shipping) return rejected("shipping_unapproved", "Für diese Variante, Menge und dieses Lieferland fehlt eine bestätigte Shopify-Versandfreigabe.");
    if (context.email !== undefined && context.email !== email) return rejected("account_changed", "Das Konto stimmt nicht mit dem Gestaltungsstand überein.");
    context.email = email;
    context.catalogs ||= currentCatalogs(email);
    const [sales, designs] = await context.catalogs;
    const salesVariant = sales.find(p => p.id === profile.id && p.profileVersion === profile.version)?.variants
      .find(v => v.shopifyVariantId === variant.shopifyVariantId);
    const designVariant = designs.find(p => p.id === profile.id && p.profileVersion === profile.version)?.variants
      .find(v => v.shopifyVariantId === variant.shopifyVariantId);
    if (!salesVariant || !designVariant || salesVariant.price.currencyCode !== offer.currency
      || moneyCents(salesVariant.price.amount) !== offer.unitPriceCents)
      return rejected("price_or_stock_changed", "Preis oder Verfügbarkeit haben sich geändert. Bitte lasse die Zusammenstellung erneut prüfen.");
    for (const side of saved.sides) {
      const approved = side.position === "front" ? variant : profile.backVariants?.find(v => v.shopifyVariantId === variant.shopifyVariantId);
      const live = side.position === "front" ? designVariant : designVariant.back;
      if (!approved || !live || !equal(identity(approved), saved.variant) || approved.area.position !== side.position
        || !equal(approved.area, side.area) || !equal(approved.mockup, side.mockup) || !equal(live.area, side.area) || !equal(live.mockup, side.mockup)
        || !placementGeometry(side.area, side.artwork, side.placement).ok)
        return rejected("side_changed", "Eine Druckfläche, Platzierung oder Produktansicht ist nicht mehr bestätigt.");
      const source = await env.DB.prepare("SELECT artwork_key,artwork_sha256,artwork_width,artwork_height,style FROM cappatex_designs WHERE id = ? AND email = ? AND status = 'preview_ready'")
        .bind(side.designId, email).first<{ artwork_key: string; artwork_sha256: string; artwork_width: number; artwork_height: number; style: string }>();
      if (!source || source.artwork_key !== side.artwork.key || source.artwork_sha256 !== side.artwork.sha256
        || source.artwork_width !== side.artwork.width || source.artwork_height !== side.artwork.height
        || (source.style === "Upload" ? "upload" : "generated") !== side.source)
        return rejected("source_changed", "Ein gespeichertes Motiv ist nicht mehr für dein Konto bestätigt.");
    }
    // Validate all sides before the first upload, discarding each buffer before reading the next.
    for (const side of saved.sides) await preparedPrintFile(side);
    return { ok: true, profile, variant, unitPriceCents: offer.unitPriceCents, currency: offer.currency,
      shippingRelease: await shippingReleaseBinding(shipping) };
  } catch { return rejected("preparation_unavailable", "Preis, Varianten und Druckdateien konnten gerade nicht vollständig bestätigt werden."); }
}

export async function preparedCheckoutStatus(saved: PreparedDesign, email: string): Promise<PreparedCheckoutStatus> {
  const result = await validatePreparedCheckout(saved, email);
  return result.ok ? { enabled: true, reason: "Die gespeicherten Druckseiten und der genehmigte Artikelpreis sind bestätigt. Versand und Gesamtpreis folgen im Shopify-Checkout.",
    unitPriceCents: result.unitPriceCents, currency: result.currency } : { enabled: false, reason: result.reason };
}

/** Recheck the immutable preparation, every current approval and the exact price before any upload. */
export async function validatePreparedSnapshot(snapshot: PreparedCheckoutSnapshot, context?: PreparedCheckoutContext) {
  const saved = await readPreparation(snapshot.preparation.id, snapshot.email);
  if (!saved || !equal(saved, snapshot.preparation) || await sha256(JSON.stringify(saved)) !== snapshot.preparationSha256
    || snapshot.designId !== saved.sides[0]?.designId || snapshot.quantity !== saved.quantity || snapshot.country !== saved.country)
    return rejected("preparation_changed", "Der bezahlte Gestaltungsstand stimmt nicht mehr überein.");
  const checked = await validatePreparedCheckout(saved, snapshot.email, context);
  if (!checked.ok) return checked;
  if (!equal(checked.profile, snapshot.profile) || !equal(checked.variant, snapshot.variant) || checked.currency !== snapshot.currency
    || checked.unitPriceCents !== snapshot.unitPriceCents || !equal(checked.shippingRelease, snapshot.shippingRelease))
    return rejected("approval_changed", "Die Freigabe, der Preis oder der Versand hat sich geändert.");
  return checked;
}
