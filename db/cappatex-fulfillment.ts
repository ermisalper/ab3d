// Persist each transition before its external side effect. No automatic lease reclaim.
export const CLAIM_FULFILLMENT = "UPDATE cappatex_fulfillments SET state = 'preparing', updated_at = ? WHERE id = ? AND state = 'pending' RETURNING id";
export const BEGIN_CREATE = "UPDATE cappatex_fulfillments SET state = 'creating', request_sha256 = ?, updated_at = ? WHERE id = ? AND state = 'preparing' RETURNING id";
export const FINISH_CREATE = "UPDATE cappatex_fulfillments SET state = 'draft_ready', printify_order_id = ?, updated_at = ? WHERE id = ? AND state = 'creating'";

export async function createDraftOnce<T>(adapter: {
  claim: () => Promise<boolean>;
  prepare: () => Promise<T>;
  beginCreate: (request: T) => Promise<boolean>;
  create: (request: T) => Promise<string>;
  finish: (id: string) => Promise<void>;
  hold: () => Promise<void>;
}) {
  if (!await adapter.claim()) return "already_claimed";
  let request: T;
  try { request = await adapter.prepare(); }
  catch { await adapter.hold(); return "manual_review"; }
  if (!await adapter.beginCreate(request)) return "already_claimed";
  try {
    const id = await adapter.create(request);
    await adapter.finish(id);
    return "draft_ready";
  } catch {
    // The remote order may exist even if the response/DB write failed.
    // Leave 'creating' locked until a human reconciles Printify external_id.
    return "creation_uncertain";
  }
}
