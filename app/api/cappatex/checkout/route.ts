import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { LEGAL_VERSION } from "../../../legal-version";
import { verifiedCatalog } from "../../../cappatex-verified-catalog";
import { placementGeometry } from "../../../cappatex-print-profile";
import { sha256 } from "../../../cappatex-artwork";
import { boundedBody } from "../../../cappatex-upload";
import type { CheckoutSnapshot } from "../../../cappatex-snapshot";
import { cartMatchesSnapshot, type CappatexCheckoutCart } from "../../../cappatex-checkout-cart";
import { shopifyStorefrontConfig, shopifyStorefrontRequest } from "../../../shopify-catalog";
import { readPreparation } from "../../../cappatex-preparation-storage";
import { validatePreparedCheckout } from "../../../cappatex-prepared-checkout";

const CART_CREATE = `mutation CappatexCartCreate($input: CartInput!) {
  cartCreate(input: $input) {
    cart {
      id checkoutUrl totalQuantity
      lines(first: 10) {
        pageInfo { hasNextPage }
        nodes {
          quantity attributes { key value }
          merchandise { ... on ProductVariant { id } }
          cost {
            amountPerQuantity { amount currencyCode }
            subtotalAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
        }
      }
    }
    userErrors { message }
    warnings { code }
  }
}`;

function error(status: number, code: string, message: string) {
  return Response.json({ error: message, code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return error(403, "invalid_origin", "Unzulässige Anfrage.");
  if (process.env.CAPPATEX_CHECKOUT_ENABLED !== "true") return error(503, "checkout_disabled", "Der Checkout wartet auf den abgeschlossenen Produkt- und Versandtest.");
  const user = await getChatGPTUser();
  if (!user) return error(401, "sign_in_required", "Bitte melde dich für den Checkout an.");
  let body;
  try { body = JSON.parse(new TextDecoder().decode(await boundedBody(request, 8000))); }
  catch (caught) {
    return caught instanceof Error && caught.message === "upload_too_large"
      ? error(413, "request_too_large", "Die Anfrage ist zu gross.")
      : error(400, "invalid_json", "Ungültige Anfrage.");
  }
  if (body?.termsAccepted !== true) return error(400, "terms_required", "Bitte bestätige AGB und Datenschutz.");

  try {
    let snapshot: CheckoutSnapshot;
    let motifLabel: string;
    if (body.preparationId !== undefined) {
      // The saved server document is authoritative; never merge price, side or placement overrides from the browser.
      if (Object.keys(body).some(key => !["preparationId", "termsAccepted"].includes(key)))
        return error(409, "mixed_checkout_input", "Bitte bestelle ausschliesslich den gespeicherten Gestaltungsstand.");
      if (typeof body.preparationId !== "string" || !/^CPP-[a-f0-9]{32}$/.test(body.preparationId))
        return error(400, "invalid_preparation", "Der gespeicherte Gestaltungsstand ist ungültig.");
      const saved = await readPreparation(body.preparationId, user.email);
      if (!saved) return error(409, "preparation_not_ready", "Der Gestaltungsstand ist nicht verfügbar oder gehört nicht zu deinem Konto.");
      const checked = await validatePreparedCheckout(saved, user.email);
      if (!checked.ok) return error(409, checked.code, checked.reason);
      snapshot = { schemaVersion: 2, id: `CPS-${crypto.randomUUID().replaceAll("-", "")}`, email: user.email,
        designId: saved.sides[0].designId, preparation: saved, preparationSha256: await sha256(JSON.stringify(saved)),
        profile: checked.profile, variant: checked.variant, quantity: saved.quantity, country: saved.country,
        unitPriceCents: checked.unitPriceCents, currency: checked.currency, legalVersion: LEGAL_VERSION, consentAt: Date.now() };
      motifLabel = saved.sides.map(side => side.position === "front" ? "Vorderseite" : "Rückseite").join(" + ");
    } else {
    if (body?.sides !== undefined || body?.schemaVersion === 2 || body?.side === "back")
      return error(409, "multiside_checkout_pending", "Druckseiten können nur als vollständig gespeicherter Gestaltungsstand bestellt werden.");
    if (!/^CPX-[A-Z0-9]{12}$/.test(body.designId || "") || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 5
      || !["CH", "LI"].includes(body.country)) return error(400, "invalid_checkout", "Design, Menge oder Lieferland ist ungültig.");
    const design = await env.DB.prepare(
      "SELECT artwork_key, artwork_sha256, artwork_width, artwork_height FROM cappatex_designs WHERE id = ? AND email = ? AND status = 'preview_ready'",
    ).bind(body.designId, user.email).first<{ artwork_key: string; artwork_sha256: string; artwork_width: number; artwork_height: number }>();
    if (!design?.artwork_key || !design.artwork_sha256) return error(409, "design_not_ready", "Für dieses Motiv fehlt eine geprüfte Druckdatei.");
    const products = await verifiedCatalog();
    const product = products.find(p => p.id === body.profileId && p.profileVersion === body.profileVersion);
    const variant = product?.variants.find(v => v.shopifyVariantId === body.shopifyVariantId);
    if (!product || !variant) return error(409, "catalog_mismatch", "Diese Variante ist derzeit nicht für die Produktion freigegeben.");
    if (product.profile.preparedCheckout) return error(409, "prepared_checkout_required", "Bitte bestelle dieses Produkt über den gespeicherten Gestaltungsstand mit allen Druckseiten.");
    const artwork = { key: design.artwork_key, sha256: design.artwork_sha256, width: design.artwork_width, height: design.artwork_height, format: "png" as const };
    const placement = { x: Number(body.placement?.x), y: Number(body.placement?.y), scale: Number(body.placement?.scale) };
    const geometry = placementGeometry(variant.area, artwork, placement);
    if (!geometry.ok) return error(400, "invalid_placement", geometry.reason);
    const object = await env.BUCKET.get(artwork.key);
    if (!object || await sha256(new Uint8Array(await object.arrayBuffer())) !== artwork.sha256) return error(409, "artwork_changed", "Die Druckdatei konnte nicht bestätigt werden.");
    snapshot = { id: `CPS-${crypto.randomUUID().replaceAll("-", "")}`, email: user.email,
      designId: body.designId, artwork, profile: product.profile, variant, placement, quantity: body.quantity, country: body.country,
      unitPriceCents: Math.round(Number(variant.price.amount) * 100), currency: variant.price.currencyCode,
      legalVersion: LEGAL_VERSION, consentAt: Date.now() };
    motifLabel = `${Math.round(geometry.widthMm!)} × ${Math.round(geometry.heightMm!)} mm · ${variant.area.position}`;
    }
    const payloadJson = JSON.stringify(snapshot);
    await env.DB.prepare("INSERT INTO cappatex_snapshots (id,email,design_id,payload_json,payload_sha256,created_at) VALUES (?,?,?,?,?,?)")
      .bind(snapshot.id, user.email, snapshot.designId, payloadJson, await sha256(payloadJson), snapshot.consentAt).run();
    const response = await shopifyStorefrontRequest<{
      data?: { cartCreate?: { cart?: CappatexCheckoutCart; userErrors?: unknown[]; warnings?: unknown[] } }; errors?: unknown[];
    }>(CART_CREATE, { input: {
      lines: [{ merchandiseId: snapshot.variant.shopifyVariantId, quantity: snapshot.quantity, attributes: [
        { key: "CAPPATEX_SNAPSHOT_ID", value: snapshot.id }, { key: "CAPPATEX_DESIGN_ID", value: snapshot.designId },
        ...(snapshot.schemaVersion === 2 ? [{ key: "CAPPATEX_PREPARATION_ID", value: snapshot.preparation.id },
          { key: "CAPPATEX_PREPARATION_SHA256", value: snapshot.preparationSha256 }] : []),
        { key: "Motiv", value: motifLabel },
      ] }],
      buyerIdentity: { email: user.email, countryCode: snapshot.country },
      attributes: [{ key: "CAPPATEX_ORDER", value: "true" }, { key: "LEGAL_TERMS_VERSION", value: LEGAL_VERSION }],
    } });
    const cart = response.data?.cartCreate?.cart;
    if (response.errors?.length || response.data?.cartCreate?.userErrors?.length || !cart) throw new Error("cart_failed");
    if (response.data?.cartCreate?.warnings?.length || !cartMatchesSnapshot(cart, snapshot)) {
      return error(409, "cart_changed", "Shopify hat Warenkorb, Preis oder Verfügbarkeit geändert. Bitte starte den Checkout erneut.");
    }
    const checkoutUrl = new URL(cart.checkoutUrl);
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== shopifyStorefrontConfig().domain
      || checkoutUrl.username || checkoutUrl.password || checkoutUrl.port || checkoutUrl.hash) throw new Error("checkout_url_invalid");
    const committed = await env.DB.prepare("UPDATE cappatex_snapshots SET cart_id = ?, state = 'checkout_created' WHERE id = ? AND state = 'prepared'")
      .bind(cart.id, snapshot.id).run();
    if (!committed.meta.changes) throw new Error("checkout_not_saved");
    return Response.json({ checkoutUrl: checkoutUrl.toString(), snapshotId: snapshot.id }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error(502, "checkout_failed", "Der Checkout konnte nicht sicher vorbereitet werden. Bitte versuche es später erneut.");
  }
}
