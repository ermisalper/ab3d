import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { LEGAL_VERSION } from "../../../legal-version";

const CART_CREATE = `#graphql
  mutation CappatexCartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { id checkoutUrl }
      userErrors { field message code }
      warnings { message code }
    }
  }
`;

const VARIANT_QUERY = `#graphql
  query CappatexVariant($id: ID!) {
    node(id: $id) {
      ... on ProductVariant { id sku availableForSale }
    }
  }
`;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return request.headers.get("sec-fetch-site") === "same-origin";
  try { return new URL(origin).host === host; } catch { return false; }
}

function shopifyEndpoint() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.trim().toLowerCase();
  if (!domain || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) return null;
  const version = /^20\d{2}-(01|04|07|10)$/.test(process.env.SHOPIFY_API_VERSION || "")
    ? process.env.SHOPIFY_API_VERSION
    : "2026-07";
  return { domain, url: `https://${domain}/api/${version}/graphql.json` };
}

function shopifyHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim();
  if (token) headers["X-Shopify-Storefront-Access-Token"] = token;
  return headers;
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: message, code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error(403, "invalid_origin", "Unzulässige Anfrage.");
  if (Number(request.headers.get("content-length") || 0) > 8_000) return error(413, "request_too_large", "Die Anfrage ist zu gross.");
  const user = await getChatGPTUser();
  if (!user) return error(401, "sign_in_required", "Bitte melde dich für den Checkout an.");

  const body = await request.json().catch(() => null) as {
    designId?: unknown;
    printifyProductId?: unknown;
    printifyVariantId?: unknown;
    shopifyVariantId?: unknown;
    quantity?: unknown;
    termsAccepted?: unknown;
    placement?: { scale?: unknown; y?: unknown };
  } | null;
  const designId = typeof body?.designId === "string" && /^CPX-[A-Z0-9]{12}$/.test(body.designId) ? body.designId : "";
  const printifyProductId = typeof body?.printifyProductId === "string" && /^[a-zA-Z0-9_-]{6,80}$/.test(body.printifyProductId) ? body.printifyProductId : "";
  const printifyVariantId = Number(body?.printifyVariantId);
  const shopifyVariantId = typeof body?.shopifyVariantId === "string" && /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(body.shopifyVariantId) ? body.shopifyVariantId : "";
  const quantity = Number(body?.quantity);
  const scale = Number(body?.placement?.scale);
  const y = Number(body?.placement?.y);
  if (body?.termsAccepted !== true) {
    return error(400, "terms_required", "Bitte bestätige die AGB und Datenschutzerklärung.");
  }
  if (!designId || !printifyProductId || !Number.isInteger(printifyVariantId) || !shopifyVariantId || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
    return error(400, "invalid_checkout", "Produkt, Variante oder Design ist ungültig.");
  }
  if (!Number.isFinite(scale) || scale < 35 || scale > 110 || !Number.isFinite(y) || y < 28 || y > 72) {
    return error(400, "invalid_placement", "Die Motivplatzierung ist ungültig.");
  }

  const printifyToken = process.env.PRINTIFY_API_TOKEN?.trim();
  const printifyShopId = process.env.PRINTIFY_SHOP_ID?.trim();
  const shopify = shopifyEndpoint();
  if (!printifyToken || !printifyShopId || !shopify) {
    return error(503, "commerce_not_configured", "Der sichere Checkout wird noch eingerichtet.");
  }

  const design = await env.DB.prepare(
    "SELECT id, email, status FROM cappatex_designs WHERE id = ? AND email = ? LIMIT 1",
  ).bind(designId, user.email).first<{ id: string; email: string; status: string }>();
  if (!design) return error(404, "design_not_found", "Das Design wurde nicht gefunden. Bitte generiere die Vorschau erneut.");

  try {
    const productResponse = await fetch(`https://api.printify.com/v1/shops/${encodeURIComponent(printifyShopId)}/products/${encodeURIComponent(printifyProductId)}.json`, {
      headers: { Authorization: `Bearer ${printifyToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const product = await productResponse.json().catch(() => null) as {
      blueprint_id?: number;
      print_provider_id?: number;
      variants?: Array<{ id?: number; sku?: string; is_enabled?: boolean; is_available?: boolean }>;
    } | null;
    const printifyVariant = product?.variants?.find((variant) => variant.id === printifyVariantId && variant.is_enabled !== false && variant.is_available !== false);
    if (!productResponse.ok || !product?.blueprint_id || !product.print_provider_id || !printifyVariant) {
      return error(409, "variant_unavailable", "Diese Variante ist nicht mehr verfügbar. Bitte aktualisiere den Katalog.");
    }

    const variantResponse = await fetch(shopify.url, {
      method: "POST",
      headers: shopifyHeaders(),
      body: JSON.stringify({ query: VARIANT_QUERY, variables: { id: shopifyVariantId } }),
      signal: AbortSignal.timeout(20_000),
    });
    const variantPayload = await variantResponse.json().catch(() => null) as {
      data?: { node?: { id?: string; sku?: string; availableForSale?: boolean } };
      errors?: unknown[];
    } | null;
    const shopifyVariant = variantPayload?.data?.node;
    if (!variantResponse.ok || variantPayload?.errors || !shopifyVariant?.availableForSale || !printifyVariant.sku || shopifyVariant.sku !== printifyVariant.sku) {
      return error(409, "catalog_mismatch", "Die gewählte Variante konnte nicht bestätigt werden. Bitte aktualisiere den Katalog.");
    }

    const cartResponse = await fetch(shopify.url, {
      method: "POST",
      headers: shopifyHeaders(),
      body: JSON.stringify({
        query: CART_CREATE,
        variables: {
          input: {
            lines: [{
              merchandiseId: shopifyVariantId,
              quantity,
              attributes: [
                { key: "CAPPATEX_DESIGN_ID", value: designId },
                { key: "CAPPATEX_PLACEMENT", value: `scale:${Math.round(scale)};y:${Math.round(y)}` },
              ],
            }],
            buyerIdentity: { email: user.email, countryCode: "CH" },
            attributes: [
              { key: "CAPPATEX_ORDER", value: "true" },
              { key: "LEGAL_TERMS_VERSION", value: LEGAL_VERSION },
            ],
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await cartResponse.json().catch(() => null) as {
      data?: { cartCreate?: { cart?: { id?: string; checkoutUrl?: string }; userErrors?: Array<{ message?: string }> } };
      errors?: unknown[];
    } | null;
    const cart = payload?.data?.cartCreate?.cart;
    if (!cartResponse.ok || payload?.errors || payload?.data?.cartCreate?.userErrors?.length || !cart?.id || !cart.checkoutUrl) {
      console.error("CAPPATEX Shopify cart creation failed", {
        status: cartResponse.status,
        graphQLErrors: Boolean(payload?.errors?.length),
        userErrors: payload?.data?.cartCreate?.userErrors?.map((entry) => entry.message),
      });
      return error(502, "checkout_failed", "Der sichere Checkout konnte nicht vorbereitet werden.");
    }
    const checkoutUrl = new URL(cart.checkoutUrl);
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim().toLowerCase();
    if (checkoutUrl.protocol !== "https:" || !storeDomain || checkoutUrl.hostname.toLowerCase() !== storeDomain) {
      return error(502, "invalid_checkout_url", "Der sichere Checkout konnte nicht geöffnet werden.");
    }

    const acceptedAt = Date.now();
    const placementJson = JSON.stringify({
      scale: Math.round(scale),
      y: Math.round(y),
      legalConsent: { acceptedAt, version: LEGAL_VERSION },
    });
    await env.DB.prepare(
      `UPDATE cappatex_designs SET
        printify_product_id = ?, printify_variant_id = ?, printify_blueprint_id = ?,
        printify_provider_id = ?, shopify_variant_id = ?, shopify_cart_id = ?,
        placement_json = ?, status = 'checkout_created', updated_at = ?
       WHERE id = ? AND email = ?`,
    ).bind(
      printifyProductId, printifyVariantId, product.blueprint_id, product.print_provider_id,
      shopifyVariantId, cart.id, placementJson, acceptedAt, designId, user.email,
    ).run();

    return Response.json({ checkoutUrl: checkoutUrl.toString(), designId }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    console.error("CAPPATEX checkout exception", { type: caught instanceof Error ? caught.name : "unknown" });
    return error(502, "checkout_failed", "Der Checkout konnte gerade nicht vorbereitet werden.");
  }
}
