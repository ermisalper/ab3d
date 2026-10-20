import { TOKEN_ATTRIBUTES, TOKEN_PURCHASE_ID, tokenMoneyCents, type TokenPurchaseSnapshot } from "./token-purchase";

type Property = { name?: unknown; value?: unknown };
export type TokenPaidLine = {
  id?: unknown; variant_id?: unknown; quantity?: unknown; current_quantity?: unknown; sku?: unknown; price?: unknown;
  total_discount?: unknown; discount_allocations?: unknown; properties?: unknown; requires_shipping?: unknown;
  gift_card?: unknown; selling_plan_allocation?: unknown; selling_plan?: unknown; price_set?: unknown;
};
export type TokenPaidOrder = {
  id?: unknown; admin_graphql_api_id?: unknown; email?: unknown; contact_email?: unknown;
  financial_status?: unknown; cancelled_at?: unknown; test?: unknown; currency?: unknown; presentment_currency?: unknown;
  taxes_included?: unknown; total_price?: unknown; current_total_price?: unknown; subtotal_price?: unknown; current_subtotal_price?: unknown;
  total_discounts?: unknown; current_total_discounts?: unknown; total_outstanding?: unknown; refunds?: unknown;
  shipping_lines?: unknown; total_shipping_price_set?: unknown; billing_address?: { country_code?: unknown };
  shipping_address?: { country_code?: unknown } | null; line_items?: unknown; note_attributes?: unknown;
  total_price_set?: unknown; current_total_price_set?: unknown;
};

function idString(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value)
    : typeof value === "string" && /^[1-9]\d{0,24}$/.test(value) ? value : null;
}
function exactProperty(properties: unknown, name: string, value?: string) {
  if (!Array.isArray(properties)) return null;
  const matches = properties.filter((property: Property | null) => property && property.name === name);
  return matches.length === 1 && typeof matches[0].value === "string" && (value === undefined || matches[0].value === value)
    ? matches[0].value as string : null;
}
export function tokenOrderPurchaseId(order: TokenPaidOrder) {
  if (!Array.isArray(order.line_items) || order.line_items.length !== 1) return null;
  const line = order.line_items[0] as TokenPaidLine | null;
  const id = exactProperty(line?.properties, TOKEN_ATTRIBUTES[0]);
  return id && TOKEN_PURCHASE_ID.test(id) ? id : null;
}
export function tokenOrderId(order: TokenPaidOrder) { return idString(order.id); }

/** Marker detection is deliberately broader than validation: a broken token purchase must
 * remain a review case, never get acknowledged as an unrelated physical order. */
export function hasTokenPurchaseMarker(order: TokenPaidOrder) {
  const marked = (properties: unknown) => Array.isArray(properties) && properties.some((property: Property | null) =>
    property && typeof property.name === "string" && /^_?AB3D_TOKEN_/i.test(property.name));
  return marked(order.note_attributes) || (Array.isArray(order.line_items) && order.line_items.some(line =>
    line && typeof line === "object" && marked((line as TokenPaidLine).properties)));
}

export function isUnrelatedPhysicalPaidOrder(order: TokenPaidOrder) {
  return Boolean(tokenOrderId(order)) && order.financial_status === "paid" && !order.cancelled_at && !order.test
    && !hasTokenPurchaseMarker(order) && Boolean(order.shipping_address)
    && Array.isArray(order.line_items) && order.line_items.length > 0
    && order.line_items.every(line => line && typeof line === "object" && (line as TokenPaidLine).requires_shipping === true);
}

function moneySet(value: unknown, cents: number) {
  if (!value || typeof value !== "object") return false;
  const set = value as { shop_money?: { amount?: unknown; currency_code?: unknown }; presentment_money?: { amount?: unknown; currency_code?: unknown } };
  return [set.shop_money, set.presentment_money].every(money => money && money.currency_code === "CHF" && tokenMoneyCents(money.amount) === cents);
}

/** A signed paid notification is necessary but insufficient: every checkout invariant is rebound
 * to the immutable purchase. Mixed physical orders, edited quantities, gifts, subscriptions,
 * discounts, taxes added on top, changed buyer/country and partially refunded orders stop here. */
export function validTokenPaidOrder(order: TokenPaidOrder, snapshot: TokenPurchaseSnapshot, hash: string) {
  const orderId = tokenOrderId(order);
  if (!orderId || order.admin_graphql_api_id !== `gid://shopify/Order/${orderId}` || order.financial_status !== "paid"
    || order.cancelled_at !== null || order.test !== false || order.currency !== "CHF" || order.presentment_currency !== "CHF"
    || order.taxes_included !== true || typeof order.email !== "string" || order.email.trim().toLowerCase() !== snapshot.email.trim().toLowerCase()
    || (order.contact_email !== undefined && (typeof order.contact_email !== "string" || order.contact_email.trim().toLowerCase() !== snapshot.email.trim().toLowerCase()))
    || order.billing_address?.country_code !== snapshot.country
    || (order.shipping_address && order.shipping_address.country_code !== snapshot.country)
    || tokenMoneyCents(order.total_price) !== snapshot.priceCents || tokenMoneyCents(order.current_total_price) !== snapshot.priceCents
    || tokenMoneyCents(order.subtotal_price) !== snapshot.priceCents
    || (order.current_subtotal_price !== undefined && tokenMoneyCents(order.current_subtotal_price) !== snapshot.priceCents)
    || tokenMoneyCents(order.total_discounts) !== 0 || tokenMoneyCents(order.current_total_discounts) !== 0
    || tokenMoneyCents(order.total_outstanding) !== 0 || !Array.isArray(order.refunds) || order.refunds.length
    || !Array.isArray(order.shipping_lines) || order.shipping_lines.length || !moneySet(order.total_shipping_price_set, 0)
    || (order.total_price_set !== undefined && !moneySet(order.total_price_set, snapshot.priceCents))
    || (order.current_total_price_set !== undefined && !moneySet(order.current_total_price_set, snapshot.priceCents))
    || !Array.isArray(order.line_items) || order.line_items.length !== 1) return false;
  const line = order.line_items[0] as TokenPaidLine | null;
  if (!line || !idString(line.id) || `gid://shopify/ProductVariant/${idString(line.variant_id)}` !== snapshot.release.variantId
    || line.sku !== snapshot.release.sku || line.quantity !== 1 || (line.current_quantity !== undefined && line.current_quantity !== 1)
    || line.requires_shipping !== false || line.gift_card !== false || line.selling_plan_allocation != null || line.selling_plan != null
    || tokenMoneyCents(line.price) !== snapshot.priceCents || tokenMoneyCents(line.total_discount) !== 0
    || !Array.isArray(line.discount_allocations) || line.discount_allocations.length
    || (line.price_set !== undefined && !moneySet(line.price_set, snapshot.priceCents))) return false;
  const attributes = [[TOKEN_ATTRIBUTES[0], snapshot.id], [TOKEN_ATTRIBUTES[1], hash], [TOKEN_ATTRIBUTES[2], snapshot.packId]];
  return attributes.every(([name, value]) => exactProperty(line.properties, name, value) && exactProperty(order.note_attributes, name, value))
    && Array.isArray(line.properties) && !line.properties.some((property: Property | null) => !property || typeof property.name !== "string"
      || (/^_?AB3D_TOKEN_/.test(property.name) && !TOKEN_ATTRIBUTES.includes(property.name as typeof TOKEN_ATTRIBUTES[number])));
}

export async function verifyTokenWebhookSignature(raw: Uint8Array, signature: string, secret: string) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(signature) || !secret) return false;
  try {
    const bytes = Uint8Array.from(atob(signature), value => value.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("HMAC", key, bytes, new Uint8Array(raw));
  } catch { return false; }
}
