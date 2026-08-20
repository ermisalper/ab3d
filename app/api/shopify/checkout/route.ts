import { env } from "cloudflare:workers";
import { ensureAccount } from "../../../../db/account";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { LEGAL_VERSION } from "../../../legal-version";
import {
  fetchShopifyCollection,
  SHOPIFY_COLLECTIONS,
  shopifyStorefrontConfig,
  shopifyStorefrontRequest,
} from "../../../shopify-catalog";

const CART_CREATE = `#graphql
  mutation Ab3dCartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { id checkoutUrl }
      userErrors { field message code }
      warnings { message code }
    }
  }
`;

type CartCreatePayload = {
  data?: {
    cartCreate?: {
      cart?: { id?: string; checkoutUrl?: string };
      userErrors?: Array<{ message?: string }>;
    };
  };
  errors?: unknown[];
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return request.headers.get("sec-fetch-site") === "same-origin";
  try { return new URL(origin).host === host; } catch { return false; }
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: message, code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error(403, "invalid_origin", "Unzulässige Anfrage.");
  if (Number(request.headers.get("content-length") || 0) > 20_000) return error(413, "request_too_large", "Der Warenkorb ist zu gross.");

  const body = await request.json().catch(() => null) as {
    termsAccepted?: unknown;
    items?: Array<{ productHandle?: unknown; variantId?: unknown; quantity?: unknown }>;
  } | null;
  if (body?.termsAccepted !== true) return error(400, "terms_required", "Bitte bestätige die AGB und Datenschutzerklärung.");
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
    return error(400, "invalid_cart", "Der Warenkorb ist leer oder zu gross.");
  }

  const requested = body.items.map((item) => ({
    productHandle: typeof item.productHandle === "string" ? item.productHandle : "",
    variantId: typeof item.variantId === "string" ? item.variantId : "",
    quantity: Number(item.quantity),
  }));
  if (requested.some((item) => !/^[a-z0-9][a-z0-9-]*$/.test(item.productHandle)
    || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(item.variantId)
    || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
    return error(400, "invalid_item", "Ein Warenkorb-Artikel ist ungültig.");
  }

  try {
    const [user, catalog] = await Promise.all([
      getChatGPTUser(),
      fetchShopifyCollection(SHOPIFY_COLLECTIONS.ab3d),
    ]);
    if (user) await ensureAccount(user.email, user.fullName);

    const variants = new Map(catalog.products.flatMap((product) => product.variants.map((variant) => [
      variant.id,
      { product, variant },
    ] as const)));
    let subtotalCents = 0;
    const normalized = [];
    for (const item of requested) {
      const catalogItem = variants.get(item.variantId);
      if (!catalogItem || catalogItem.product.handle !== item.productHandle) {
        return error(400, "invalid_item", "Ein Artikel gehört nicht zur AB3D-Kollektion.");
      }
      if (!catalogItem.variant.available) {
        return error(409, "variant_unavailable", `${catalogItem.product.name} in ${catalogItem.variant.size} / ${catalogItem.variant.color} ist nicht verfügbar.`);
      }
      const unitPriceCents = Math.round(catalogItem.variant.price * 100);
      subtotalCents += unitPriceCents * item.quantity;
      normalized.push({ ...item, ...catalogItem, unitPriceCents });
    }

    const sessionId = `CHK-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
    const payload = await shopifyStorefrontRequest<CartCreatePayload>(CART_CREATE, {
      input: {
        lines: normalized.map((item) => ({
          merchandiseId: item.variant.id,
          quantity: item.quantity,
          attributes: [
            { key: "AB3D_PRODUCT", value: item.product.name },
            { key: "AB3D_SIZE", value: item.variant.size },
            { key: "AB3D_COLOR", value: item.variant.color },
          ],
        })),
        ...(user ? { buyerIdentity: { email: user.email, countryCode: "CH" } } : {}),
        attributes: [
          { key: "AB3D_STOREFRONT", value: "true" },
          { key: "AB3D_CHECKOUT_SESSION", value: sessionId },
          { key: "LEGAL_TERMS_VERSION", value: LEGAL_VERSION },
        ],
      },
    }, 20_000);
    const cart = payload.data?.cartCreate?.cart;
    if (payload.errors || payload.data?.cartCreate?.userErrors?.length || !cart?.id || !cart.checkoutUrl) {
      console.error("AB3D Shopify cart creation failed", {
        userErrors: payload.data?.cartCreate?.userErrors?.map((entry) => entry.message),
      });
      return error(502, "checkout_failed", "Der sichere Checkout konnte nicht vorbereitet werden.");
    }

    const checkoutUrl = new URL(cart.checkoutUrl);
    const { domain } = shopifyStorefrontConfig();
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname.toLowerCase() !== domain) {
      return error(502, "invalid_checkout_url", "Der sichere Checkout konnte nicht geöffnet werden.");
    }

    const now = Date.now();
    const shippingCents = subtotalCents >= 8_000 ? 0 : 900;
    await env.DB.prepare(
      `INSERT INTO checkout_sessions
        (id, account_email, shopify_cart_id, channel, status, items_json,
         estimated_total_cents, currency, legal_version, created_at, updated_at)
       VALUES (?, ?, ?, 'ab3d', 'checkout_created', ?, ?, 'CHF', ?, ?, ?)`,
    ).bind(
      sessionId,
      user?.email || null,
      cart.id,
      JSON.stringify(normalized.map((item) => ({
        productHandle: item.product.handle,
        productId: item.product.shopifyId,
        name: item.product.name,
        variantId: item.variant.id,
        sku: item.variant.sku,
        quantity: item.quantity,
        size: item.variant.size,
        color: item.variant.color,
        unitPriceCents: item.unitPriceCents,
      }))),
      subtotalCents + shippingCents,
      LEGAL_VERSION,
      now,
      now,
    ).run();
    return Response.json({ checkoutUrl: checkoutUrl.toString(), sessionId }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    console.error("AB3D Shopify checkout exception", { type: caught instanceof Error ? caught.name : "unknown" });
    return error(502, "checkout_failed", "Der Checkout ist gerade nicht erreichbar.");
  }
}
