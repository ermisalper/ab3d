import { env } from "cloudflare:workers";
import {
  emptyProductionOffer, parseProductionOffer, calculateProductionOffer, productionOfferSheet, productionOfferHash,
  type ProductionOfferDto, type ProductionOfferPayload,
} from "../app/production-offer";

type OfferRow = { version: number; payloadJson: string; payloadSha256: string; updatedAt: number; updatedBy: string };

function dto(orderId: string, payload: ProductionOfferPayload, row?: Omit<OfferRow, "payloadJson" | "payloadSha256">): ProductionOfferDto {
  return { orderId, version: row?.version ?? 0, payload, calculation: calculateProductionOffer(payload),
    updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null, events: [], sheet: productionOfferSheet(orderId, payload) };
}

/** An absent draft is empty; a corrupt saved draft must never masquerade as an empty one. */
export async function getProductionOffer(orderId: string): Promise<ProductionOfferDto | null> {
  if (!await env.DB.prepare("SELECT id FROM production_orders WHERE id=?").bind(orderId).first()) return null;
  const row = await env.DB.prepare(`SELECT version,payload_json AS payloadJson,payload_sha256 AS payloadSha256,
    updated_at AS updatedAt,updated_by AS updatedBy FROM production_offer_drafts WHERE order_id=?`).bind(orderId).first<OfferRow>();
  if (!row) return dto(orderId, emptyProductionOffer());
  if (row.payloadSha256 !== await productionOfferHash(row.payloadJson)) throw new Error("Invalid offer integrity");
  const payload = parseProductionOffer(JSON.parse(row.payloadJson));
  if (!payload || !Number.isSafeInteger(row.version) || row.version < 1) throw new Error("Invalid offer record");
  const result = dto(orderId, payload, row);
  const events = await env.DB.prepare(`SELECT version,actor_email AS actorEmail,created_at AS createdAt
    FROM production_offer_events WHERE order_id=? ORDER BY version DESC LIMIT 50`).bind(orderId)
    .all<{ version: number; actorEmail: string; createdAt: number }>();
  result.events = events.results;
  return result;
}

/** Transactional compare-and-swap; it never changes the request, payment or production record. */
export async function saveProductionOffer(orderId: string, input: ProductionOfferPayload, version: number, actorEmail: string): Promise<ProductionOfferDto | null> {
  const payload = parseProductionOffer(input);
  if (!payload) throw new Error("Invalid offer input");
  const json = JSON.stringify(payload), hash = await productionOfferHash(json), nonce = crypto.randomUUID(), now = Date.now();
  const write = version === 0
    ? env.DB.prepare(`INSERT INTO production_offer_drafts(order_id,version,payload_json,payload_sha256,write_nonce,updated_by,updated_at)
        SELECT id,1,?,?,?,?,? FROM production_orders WHERE id=? ON CONFLICT(order_id) DO NOTHING`)
      .bind(json, hash, nonce, actorEmail, now, orderId)
    : env.DB.prepare(`UPDATE production_offer_drafts SET version=version+1,payload_json=?,payload_sha256=?,write_nonce=?,updated_by=?,updated_at=?
        WHERE order_id=? AND version=?`).bind(json, hash, nonce, actorEmail, now, orderId, version);
  const results = await env.DB.batch([
    write,
    env.DB.prepare(`INSERT INTO production_offer_events(id,order_id,version,actor_email,created_at)
      SELECT ?,order_id,version,updated_by,updated_at FROM production_offer_drafts WHERE order_id=? AND write_nonce=?`).bind(nonce, orderId, nonce),
  ]);
  if (!results[0].meta.changes) return null;
  // Return this write, not a later editor's revision that might already have committed.
  const result = dto(orderId, payload, { version: version + 1, updatedAt: now, updatedBy: actorEmail });
  result.events = [{ version: version + 1, actorEmail, createdAt: now }];
  return result;
}
