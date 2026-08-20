import { env } from "cloudflare:workers";
import { ensureAccount } from "./account";

export type ShopifyOrderPayload = {
  id?: number;
  name?: string;
  email?: string;
  contact_email?: string;
  phone?: string;
  created_at?: string;
  currency?: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  subtotal_price?: string;
  total_price?: string;
  total_shipping_price_set?: { shop_money?: { amount?: string; currency_code?: string } };
  note_attributes?: Array<{ name?: string; value?: string }>;
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    province_code?: string;
    zip?: string;
    country_code?: string;
    phone?: string;
  };
  line_items?: Array<{
    title?: string;
    sku?: string;
    quantity?: number;
    price?: string;
    properties?: Array<{ name?: string; value?: string }>;
  }>;
};

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

function cents(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : 0;
}

function note(order: ShopifyOrderPayload, name: string) {
  return order.note_attributes?.find((entry) => entry.name === name)?.value || "";
}

function lineProperty(line: NonNullable<ShopifyOrderPayload["line_items"]>[number], name: string) {
  return line.properties?.find((entry) => entry.name === name)?.value || "";
}

export async function recordPaidShopifyOrder(order: ShopifyOrderPayload) {
  if (!order.id || order.financial_status !== "paid" || !order.shipping_address || !Array.isArray(order.line_items) || !order.line_items.length) {
    throw new Error("invalid_paid_order");
  }

  const address = order.shipping_address;
  const firstName = text(address.first_name, 80);
  const lastName = text(address.last_name, 80);
  const customerName = `${firstName} ${lastName}`.trim();
  const address1 = text(address.address1, 160);
  const postalCode = text(address.zip, 24);
  const city = text(address.city, 100);
  const country = text(address.country_code, 2).toUpperCase();
  if (!customerName || !address1 || !postalCode || !city || !country) throw new Error("incomplete_shipping_address");

  const email = text(order.email || order.contact_email, 254).toLowerCase();
  const hasCappatex = order.line_items.some((line) => /^CPX-[A-Z0-9]{12}$/.test(lineProperty(line, "CAPPATEX_DESIGN_ID")));
  const hasAb3d = order.line_items.some((line) => Boolean(lineProperty(line, "AB3D_PRODUCT")));
  const channel = hasCappatex && hasAb3d ? "mixed" : hasCappatex ? "cappatex" : "ab3d";
  const items = order.line_items.slice(0, 50).map((line) => ({
    name: text(line.title, 160),
    sku: text(line.sku, 100),
    quantity: Math.min(Math.max(Number(line.quantity) || 1, 1), 100),
    unitPriceCents: cents(line.price),
    product: text(lineProperty(line, "AB3D_PRODUCT"), 120) || undefined,
    size: text(lineProperty(line, "AB3D_SIZE"), 30) || undefined,
    color: text(lineProperty(line, "AB3D_COLOR"), 60) || undefined,
    designId: text(lineProperty(line, "CAPPATEX_DESIGN_ID"), 40) || undefined,
  }));
  const currency = text(order.currency || order.total_shipping_price_set?.shop_money?.currency_code, 3).toUpperCase() || "CHF";
  const subtotalCents = cents(order.subtotal_price);
  const shippingCents = cents(order.total_shipping_price_set?.shop_money?.amount);
  const totalCents = cents(order.total_price);
  const now = Date.now();
  const createdAt = order.created_at && Number.isFinite(Date.parse(order.created_at)) ? Date.parse(order.created_at) : now;
  const sessionId = text(note(order, "AB3D_CHECKOUT_SESSION"), 80);
  const legalVersion = text(note(order, "LEGAL_TERMS_VERSION"), 40);

  if (email) await ensureAccount(email, customerName);

  const statements = [env.DB.prepare(
    `INSERT INTO shopify_orders
      (order_id, order_name, customer_email, customer_name, phone, address1, address2,
       postal_code, city, region, country, financial_status, fulfillment_status, channel,
       subtotal_cents, shipping_cents, total_cents, currency, items_json, legal_version,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(order_id) DO UPDATE SET
       order_name = excluded.order_name, customer_email = excluded.customer_email,
       customer_name = excluded.customer_name, phone = excluded.phone,
       address1 = excluded.address1, address2 = excluded.address2, postal_code = excluded.postal_code,
       city = excluded.city, region = excluded.region, country = excluded.country,
       financial_status = excluded.financial_status, fulfillment_status = excluded.fulfillment_status,
       channel = excluded.channel, subtotal_cents = excluded.subtotal_cents,
       shipping_cents = excluded.shipping_cents, total_cents = excluded.total_cents,
       currency = excluded.currency, items_json = excluded.items_json,
       legal_version = excluded.legal_version, updated_at = excluded.updated_at`,
  ).bind(
    String(order.id), text(order.name, 80) || null, email || null, customerName,
    text(address.phone || order.phone, 40) || null, address1, text(address.address2, 160) || null,
    postalCode, city, text(address.province_code, 40) || null, country,
    "paid", text(order.fulfillment_status, 40) || null, channel,
    subtotalCents, shippingCents, totalCents, currency, JSON.stringify(items), legalVersion || null,
    createdAt, now,
  )];

  if (sessionId && /^CHK-[A-Z0-9]{16}$/.test(sessionId)) {
    statements.push(env.DB.prepare(
      "UPDATE checkout_sessions SET status = 'paid', shopify_order_id = ?, updated_at = ? WHERE id = ?",
    ).bind(String(order.id), now, sessionId));
  }
  await env.DB.batch(statements);
  return { channel, sessionId, email };
}
