import { shopifyStorefrontConfig } from "../../../../shopify-catalog";
import { tokenRequestBytes, tokenPurchaseHash, parseTokenSnapshot } from "../../../../token-purchase";
import { tokenOrderPurchaseId, tokenOrderId, isUnrelatedPhysicalPaidOrder, validTokenPaidOrder, verifyTokenWebhookSignature, type TokenPaidOrder } from "../../../../token-purchase-receipt";
import { tokenPurchaseById, creditTokenPurchase } from "../../../../../db/token-purchases";
import { safeTokenCheckoutUrl } from "../../../../token-purchase-shopify";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (status: number, code: string) => Response.json({ code }, { status, headers });

export async function POST(request: Request) {
  let domain: string;
  try { domain = shopifyStorefrontConfig().domain; }
  catch { return fail(503, "not_ready"); }
  // No authentication cookie is consulted: Shopify proves origin with the raw-body HMAC.
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim();
  // Closing new sales must not strand an already paid server-issued checkout.
  if (!secret) return fail(503, "not_ready");
  const eventId = request.headers.get("x-shopify-event-id") || "";
  if (request.headers.get("x-shopify-shop-domain") !== domain || request.headers.get("x-shopify-topic") !== "orders/paid"
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(eventId)) return fail(400, "invalid_delivery");
  let raw: Uint8Array;
  try { raw = await tokenRequestBytes(request, 256_000); }
  catch { return fail(413, "request_too_large"); }
  if (!await verifyTokenWebhookSignature(raw, request.headers.get("x-shopify-hmac-sha256") || "", secret)) return fail(401, "invalid_signature");
  let order: TokenPaidOrder;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail(400, "invalid_payload");
    order = parsed as TokenPaidOrder;
  } catch { return fail(400, "invalid_payload"); }
  // Both subscriptions can receive orders/paid. Physical goods stay exclusively with their
  // existing handler; only a verified signed envelope can take this no-op path.
  if (isUnrelatedPhysicalPaidOrder(order)) return Response.json({ status: "ignored_physical_order" }, { headers });
  const purchaseId = tokenOrderPurchaseId(order), orderId = tokenOrderId(order);
  if (!purchaseId || !orderId || request.headers.get("x-shopify-test") === "true") return fail(409, "manual_review_required");
  try {
    const row = await tokenPurchaseById(purchaseId);
    if (!row || row.shop_domain !== domain || !["checkout_created", "credited"].includes(row.status)
      || !row.cart_id?.startsWith("gid://shopify/Cart/") || !safeTokenCheckoutUrl(row.checkout_url, domain)) return fail(409, "manual_review_required");
    const snapshot = await parseTokenSnapshot(row.snapshot_json, row.snapshot_sha256, { id: row.id, email: row.email, domain });
    if (!snapshot || snapshot.packId !== row.pack_id || snapshot.tokens !== row.tokens || snapshot.priceCents !== row.price_cents
      || snapshot.currency !== row.currency || snapshot.country !== row.country || !Number.isSafeInteger(row.created_at)
      || row.created_at < snapshot.consentAt || row.created_at > Date.now() || !validTokenPaidOrder(order, snapshot, row.snapshot_sha256)) return fail(409, "manual_review_required");
    const credited = await creditTokenPurchase(snapshot, row.snapshot_sha256, {
      orderKey: `${domain}:${orderId}`, eventKey: `${domain}:${eventId.toLowerCase()}`, bodyHash: await tokenPurchaseHash(raw),
    });
    if (credited === "conflict") return fail(409, "manual_review_required");
    return Response.json({ status: credited }, { headers });
  } catch {
    // SQLite batch failure is all-or-nothing. Shopify may safely redeliver this signed payment.
    return fail(503, "receipt_unavailable");
  }
}
