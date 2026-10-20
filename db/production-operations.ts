import { env } from "cloudflare:workers";
import {
  AB3D_OPERATION_ID, AB3D_ORDER_STATUS_LABELS, AB3D_INSPECTION_NOTICE, isAb3dReviewState, readProductionRequestDetails,
  type Ab3dOperationDetail, type Ab3dOperationSummary, type Ab3dReview, type Ab3dReviewState,
} from "../app/ab3d-operations";

type Row = Omit<Ab3dOperationSummary, "review"> & {
  reviewState: Ab3dReviewState | null; reviewVersion: number | null; reviewUpdatedAt: number | null;
  reviewNotes: string | null; reviewUpdatedBy: string | null; requestDetailsJson: string | null;
  previewTaskId: string | null;
};
const SELECT = `SELECT o.id,o.email,o.status,o.source_task_id AS sourceTaskId,o.source_task_type AS sourceTaskType,
  o.template_name AS templateName,o.height_mm AS heightMm,o.material,o.finish,o.quantity,
  o.estimated_total_cents AS estimatedTotalCents,o.currency,o.created_at AS createdAt,o.updated_at AS updatedAt,
  o.request_details_json AS requestDetailsJson,t.status AS sourceTaskStatus,p.task_id AS previewTaskId,
  r.state AS reviewState,r.version AS reviewVersion,r.updated_at AS reviewUpdatedAt,r.notes AS reviewNotes,r.updated_by AS reviewUpdatedBy
  FROM production_orders o LEFT JOIN production_reviews r ON r.order_id=o.id
  LEFT JOIN generation_tasks t ON t.task_id=o.source_task_id AND t.email=o.email AND t.kind='convert'
  LEFT JOIN generation_tasks p ON p.task_id=t.parent_task_id AND p.email=o.email AND p.status='SUCCEEDED' AND p.kind IN ('resize','print-repair')`;

function summary(row: Row): Ab3dOperationSummary {
  return {
    id: row.id, email: row.email, status: row.status, sourceTaskId: row.sourceTaskId, sourceTaskType: row.sourceTaskType,
    sourceTaskStatus: row.sourceTaskStatus, templateName: row.templateName, heightMm: row.heightMm, material: row.material,
    finish: row.finish, quantity: row.quantity, estimatedTotalCents: row.estimatedTotalCents, currency: row.currency,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    review: { state: row.reviewState || "new", version: row.reviewVersion || 0, updatedAt: row.reviewUpdatedAt },
  };
}
function review(row: Row): Ab3dReview {
  return { ...summary(row).review, notes: row.reviewNotes || "", updatedBy: row.reviewUpdatedBy };
}
type Cursor = { at: number; id: string };
function decodeCursor(value: string): Cursor | null {
  try {
    if (value.length > 200 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const parsed = JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/")));
    return parsed && Number.isSafeInteger(parsed.at) && parsed.at >= 0 && typeof parsed.id === "string" && AB3D_OPERATION_ID.test(parsed.id)
      ? { at: parsed.at, id: parsed.id } : null;
  } catch { return null; }
}
function encodeCursor(row: Ab3dOperationSummary) {
  return btoa(JSON.stringify({ at: row.createdAt, id: row.id })).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export async function listProductionOperations(params: URLSearchParams) {
  const allowed = ["q", "status", "review", "cursor", "limit"];
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) return null;
  const q = (params.get("q") || "").trim(), status = params.get("status") || "all", state = params.get("review") || "all";
  const limitValue = params.get("limit") || "20";
  if (q.length > 100 || /[\u0000-\u001f]/.test(q) || !/^[1-9][0-9]?$/.test(limitValue)) return null;
  const limit = Number(limitValue);
  if (limit > 50 || (status !== "all" && !Object.hasOwn(AB3D_ORDER_STATUS_LABELS, status)) || (state !== "all" && !isAb3dReviewState(state))) return null;
  const cursorValue = params.get("cursor"), cursor = cursorValue ? decodeCursor(cursorValue) : null;
  if (cursorValue !== null && !cursor) return null;
  const where: string[] = [], values: unknown[] = [];
  if (q) {
    where.push("(o.id LIKE ? ESCAPE '\\' OR o.email LIKE ? ESCAPE '\\' OR o.template_name LIKE ? ESCAPE '\\')");
    const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`; values.push(term, term, term);
  }
  if (status !== "all") { where.push("o.status=?"); values.push(status); }
  if (state !== "all") { where.push("COALESCE(r.state,'new')=?"); values.push(state); }
  if (cursor) { where.push("(o.created_at<? OR (o.created_at=? AND o.id<?))"); values.push(cursor.at, cursor.at, cursor.id); }
  const rows = await env.DB.prepare(`${SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY o.created_at DESC,o.id DESC LIMIT ?`)
    .bind(...values, limit + 1).all<Row>();
  const orders = rows.results.slice(0, limit).map(summary);
  const counts = await env.DB.prepare("SELECT COALESCE(r.state,'new') AS state,COUNT(*) AS total FROM production_orders o LEFT JOIN production_reviews r ON r.order_id=o.id GROUP BY COALESCE(r.state,'new')")
    .all<{ state: Ab3dReviewState; total: number }>();
  return { orders, nextCursor: rows.results.length > limit ? encodeCursor(orders[orders.length - 1]) : null, counts: counts.results };
}

export async function getProductionOperation(id: string): Promise<Ab3dOperationDetail | null> {
  const row = await env.DB.prepare(`${SELECT} WHERE o.id=?`).bind(id).first<Row>();
  if (!row) return null;
  const events = await env.DB.prepare("SELECT version,state,actor_email AS actorEmail,created_at AS createdAt FROM production_review_events WHERE order_id=? ORDER BY version DESC LIMIT 50")
    .bind(id).all<{ version: number; state: Ab3dReviewState; actorEmail: string; createdAt: number }>();
  const inspectable = row.sourceTaskType === "convert" && row.sourceTaskStatus === "SUCCEEDED"
    && ["inquiry", "awaiting_payment", "paid", "production", "shipped"].includes(row.status);
  const file = (format: string) => inspectable ? `/api/ab3d/operations/${id}/file?format=${format}` : null;
  return {
    order: { ...summary(row), requestDetails: readProductionRequestDetails(row.requestDetailsJson), review: review(row), events: events.results },
    files: { glb: row.previewTaskId ? file("glb") : null, stl: file("stl"), threeMf: file("3mf") }, inspectionNotice: AB3D_INSPECTION_NOTICE,
  };
}

/** D1 batch is transactional. The nonce binds the audit INSERT to exactly this successful compare-and-swap. */
export async function saveProductionReview(id: string, state: Ab3dReviewState, notes: string, expectedVersion: number, actorEmail: string) {
  const nonce = crypto.randomUUID(), now = Date.now();
  const write = expectedVersion === 0
    ? env.DB.prepare(`INSERT INTO production_reviews(order_id,state,notes,version,write_nonce,updated_by,updated_at)
        SELECT id,?,?,1,?,?,? FROM production_orders WHERE id=? ON CONFLICT(order_id) DO NOTHING`)
      .bind(state, notes, nonce, actorEmail, now, id)
    : env.DB.prepare(`UPDATE production_reviews SET state=?,notes=?,version=version+1,write_nonce=?,updated_by=?,updated_at=?
        WHERE order_id=? AND version=?`).bind(state, notes, nonce, actorEmail, now, id, expectedVersion);
  const results = await env.DB.batch([
    write,
    env.DB.prepare(`INSERT INTO production_review_events(id,order_id,version,state,actor_email,created_at)
      SELECT ?,order_id,version,state,updated_by,updated_at FROM production_reviews WHERE order_id=? AND write_nonce=?`)
      .bind(nonce, id, nonce),
  ]);
  if (!results[0].meta.changes) return null;
  return { state, notes, version: expectedVersion + 1, updatedBy: actorEmail, updatedAt: now } satisfies Ab3dReview;
}
