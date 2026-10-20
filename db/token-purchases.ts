import { env } from "cloudflare:workers";
import type { TokenPurchaseHistoryItem } from "../app/token-packs";
import type { TokenPurchaseSnapshot } from "../app/token-purchase";

export type TokenPurchaseRow = {
  id: string; email: string; request_id: string; request_sha256: string; pack_id: string;
  tokens: number; price_cents: number; currency: string; country: string; shop_domain: string;
  snapshot_json: string; snapshot_sha256: string; status: TokenPurchaseHistoryItem["status"];
  cart_id: string | null; checkout_url: string | null; order_key: string | null; created_at: number; updated_at: number;
};

export function ownedTokenPurchase(email: string, requestId: string) {
  return env.DB.prepare("SELECT * FROM token_purchases WHERE email = ? AND request_id = ?")
    .bind(email, requestId).first<TokenPurchaseRow>();
}

export function tokenPurchaseById(id: string) {
  return env.DB.prepare("SELECT * FROM token_purchases WHERE id = ?").bind(id).first<TokenPurchaseRow>();
}

export function unresolvedTokenPurchase(email: string) {
  return env.DB.prepare("SELECT id FROM token_purchases WHERE email = ? AND status IN ('creating_checkout','checkout_uncertain') LIMIT 1")
    .bind(email).first<{ id: string }>();
}

export async function tokenPurchaseHistory(email: string): Promise<TokenPurchaseHistoryItem[]> {
  const rows = await env.DB.prepare(`SELECT id,request_id AS requestId,pack_id AS packId,tokens,price_cents AS priceCents,currency,status,created_at AS createdAt
    FROM token_purchases WHERE email = ? ORDER BY created_at DESC,id DESC LIMIT 30`).bind(email).all<TokenPurchaseHistoryItem>();
  return rows.results;
}

export async function reserveTokenPurchase(snapshot: TokenPurchaseSnapshot, snapshotJson: string, snapshotHash: string, requestId: string, requestHash: string) {
  const now = Date.now();
  const result = await env.DB.prepare(`INSERT INTO token_purchases
    (id,email,request_id,request_sha256,pack_id,tokens,price_cents,currency,country,shop_domain,snapshot_json,snapshot_sha256,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,'CHF',?,?,?,?,'creating_checkout',?,?) ON CONFLICT(email,request_id) DO NOTHING`)
    .bind(snapshot.id, snapshot.email, requestId, requestHash, snapshot.packId, snapshot.tokens, snapshot.priceCents,
      snapshot.country, snapshot.release.shopDomain, snapshotJson, snapshotHash, now, now).run();
  return Boolean(result.meta.changes);
}

export async function completeTokenCheckout(id: string, cartId: string, checkoutUrl: string) {
  const result = await env.DB.prepare(`UPDATE token_purchases SET status = 'checkout_created',cart_id = ?,checkout_url = ?,updated_at = ?
    WHERE id = ? AND status = 'creating_checkout' AND cart_id IS NULL AND checkout_url IS NULL`)
    .bind(cartId, checkoutUrl, Date.now(), id).run();
  if (result.meta.changes !== 1) throw new Error("checkout_commit_uncertain");
}

export async function uncertainTokenCheckout(id: string) {
  await env.DB.prepare("UPDATE token_purchases SET status = 'checkout_uncertain',updated_at = ? WHERE id = ? AND status = 'creating_checkout'")
    .bind(Date.now(), id).run();
}

/** D1.batch executes these statements in one SQLite transaction. A unique receipt is the only
 * minting authority. The random nonce fences all three credit effects to this batch's INSERT;
 * a duplicate event/order or a concurrently delivered event cannot repeat any of those effects.
 * No generic account credit helper is used, including for unlimited operator accounts. */
export async function creditTokenPurchase(snapshot: TokenPurchaseSnapshot, snapshotHash: string, receipt: {
  orderKey: string; eventKey: string; bodyHash: string;
}): Promise<"credited" | "already_credited" | "conflict"> {
  const now = Date.now(), nonce = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO token_purchase_events(id,body_sha256,purchase_id,order_key,created_at)
      VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
      .bind(receipt.eventKey, receipt.bodyHash, snapshot.id, receipt.orderKey, now),
    env.DB.prepare(`INSERT INTO token_purchase_receipts(order_key,purchase_id,event_id,credit_nonce,created_at)
      SELECT ?,p.id,?,?,? FROM token_purchases p JOIN accounts a ON a.email = p.email
      WHERE p.id = ? AND p.email = ? AND p.snapshot_sha256 = ? AND p.status = 'checkout_created' AND p.cart_id IS NOT NULL
        AND typeof(a.token_balance) = 'integer' AND a.token_balance >= 0 AND a.token_balance <= 2147483647 - ?
        AND EXISTS (SELECT 1 FROM token_purchase_events e WHERE e.id = ? AND e.body_sha256 = ? AND e.purchase_id = p.id AND e.order_key = ?)
      ON CONFLICT DO NOTHING`)
      .bind(receipt.orderKey, receipt.eventKey, nonce, now, snapshot.id, snapshot.email, snapshotHash, snapshot.tokens,
        receipt.eventKey, receipt.bodyHash, receipt.orderKey),
    env.DB.prepare(`UPDATE accounts SET token_balance = token_balance + ?,updated_at = ? WHERE email = ?
      AND EXISTS (SELECT 1 FROM token_purchase_receipts WHERE purchase_id = ? AND credit_nonce = ?)`)
      .bind(snapshot.tokens, now, snapshot.email, snapshot.id, nonce),
    env.DB.prepare(`INSERT INTO token_ledger(email,delta,reason,task_id,created_at)
      SELECT ?,?,'token_pack_purchase',?,? WHERE EXISTS
        (SELECT 1 FROM token_purchase_receipts WHERE purchase_id = ? AND credit_nonce = ?)`)
      .bind(snapshot.email, snapshot.tokens, snapshot.id, now, snapshot.id, nonce),
    env.DB.prepare(`UPDATE token_purchases SET status = 'credited',order_key = ?,updated_at = ? WHERE id = ? AND status = 'checkout_created'
      AND EXISTS (SELECT 1 FROM token_purchase_receipts WHERE purchase_id = ? AND credit_nonce = ?)`)
      .bind(receipt.orderKey, now, snapshot.id, snapshot.id, nonce),
  ]);
  const event = await env.DB.prepare("SELECT body_sha256,purchase_id,order_key FROM token_purchase_events WHERE id = ?")
    .bind(receipt.eventKey).first<{ body_sha256: string; purchase_id: string; order_key: string }>();
  const recorded = await env.DB.prepare("SELECT purchase_id,credit_nonce FROM token_purchase_receipts WHERE order_key = ?")
    .bind(receipt.orderKey).first<{ purchase_id: string; credit_nonce: string }>();
  if (event?.body_sha256 !== receipt.bodyHash || event.purchase_id !== snapshot.id || event.order_key !== receipt.orderKey
    || recorded?.purchase_id !== snapshot.id) return "conflict";
  return recorded.credit_nonce === nonce ? "credited" : "already_credited";
}
