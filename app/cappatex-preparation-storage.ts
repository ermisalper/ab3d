import { env } from "cloudflare:workers";
import { sha256 } from "./cappatex-artwork";
import { accountCapabilities, type AccountSummary } from "../db/account";
import type { PreparedDesign } from "./cappatex-preparation";

export async function readPreparation(id: string, email: string) {
  const row = await env.DB.prepare("SELECT payload_json,payload_sha256 FROM cappatex_preparations WHERE id = ? AND email = ? AND state = 'ready'")
    .bind(id, email).first<{ payload_json: string; payload_sha256: string }>();
  if (!row || await sha256(row.payload_json) !== row.payload_sha256) return null;
  const payload = JSON.parse(row.payload_json) as PreparedDesign;
  return payload.schemaVersion === 2 && payload.id === id ? payload : null;
}
export async function preparationDownloadAllowed(saved: PreparedDesign, email: string) {
  if (saved.sides.every(s => s.source === "upload")) return true;
  const account = await env.DB.prepare("SELECT email, plan, subscription_status AS subscriptionStatus FROM accounts WHERE email = ?")
    .bind(email).first<AccountSummary>();
  return Boolean(account && accountCapabilities(account).canDownloadHd);
}
