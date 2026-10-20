import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountCapabilities, ensureAccount, getOwnedTask, isOwnerEmail } from "../../../db/account";
import { productionQuote } from "../../production-quote";
import { productionInquiryDetails } from "../../production-inquiry-details";

const TASK_ID = /^[a-zA-Z0-9-]{8,80}$/;
const REQUEST_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_INQUIRY_BYTES = 12_000;
const inquiryHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const inquiryReply = (body: unknown, status = 200) => Response.json(body, { status, headers: inquiryHeaders });
type SavedInquiry = { id: string; status: string; estimatedTotalCents: number; currency: string; requestSha256: string | null };
function savedInquiry(row: SavedInquiry) {
  return inquiryReply({ ok: true, order: { id: row.id, status: row.status, estimatedTotalCents: row.estimatedTotalCents, currency: row.currency },
    message: "Unverbindliche Anfrage gespeichert. AB3D prüft Modell, Herstellbarkeit und Richtpreis. Es wurde keine Zahlung und kein Fertigungsauftrag ausgelöst." });
}

async function inquiryBody(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_INQUIRY_BYTES) throw new Error("inquiry_too_large");
  if (!request.body) throw new Error("invalid_inquiry");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_INQUIRY_BYTES) { await reader.cancel(); throw new Error("inquiry_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Bitte zuerst anmelden." }, { status: 401 });
  const owner = isOwnerEmail(user.email);
  const account = await ensureAccount(user.email, user.fullName);
  const capabilities = accountCapabilities(account);
  const queryAll = owner && new URL(request.url).searchParams.get("scope") === "production";
  const statement = queryAll
    ? env.DB.prepare(
      `SELECT id, email, status, source_task_id AS sourceTaskId, source_task_type AS sourceTaskType,
              template_name AS templateName, height_mm AS heightMm, material, finish, quantity,
              estimated_total_cents AS estimatedTotalCents, currency, created_at AS createdAt
       FROM production_orders ORDER BY created_at DESC LIMIT 50`,
    )
    : env.DB.prepare(
      `SELECT id, email, status, source_task_id AS sourceTaskId, source_task_type AS sourceTaskType,
              template_name AS templateName, height_mm AS heightMm, material, finish, quantity,
              estimated_total_cents AS estimatedTotalCents, currency, created_at AS createdAt
       FROM production_orders WHERE email = ? ORDER BY created_at DESC LIMIT 20`,
    ).bind(user.email);
  const rows = await statement.all();
  return Response.json({
    orders: rows.results,
    isOwner: owner,
    canDownload3d: capabilities.canDownload3d,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return inquiryReply({ error: "Unzulässige Anfrage." }, 403);
  const user = await getChatGPTUser();
  if (!user) return inquiryReply({ error: "Bitte melde dich für die unverbindliche Anfrage an." }, 401);
  let body: {
    requestId?: unknown;
    sourceTaskId?: unknown;
    templateId?: unknown;
    heightCm?: unknown;
    material?: unknown;
    finish?: unknown;
    quantity?: unknown;
    requestDetails?: unknown;
  } | null;
  try {
    const parsed: unknown = await inquiryBody(request);
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (caught) {
    return inquiryReply({ error: caught instanceof Error && caught.message === "inquiry_too_large"
      ? "Die Anfrage ist zu gross." : "Bitte sende eine gültige Anfrage." },
    caught instanceof Error && caught.message === "inquiry_too_large" ? 413 : 400);
  }
  const sourceTaskId = typeof body?.sourceTaskId === "string" ? body.sourceTaskId : "";
  // A browser-provided price, name or complexity never determines the stored estimate.
  const quote = productionQuote(body);
  if (!TASK_ID.test(sourceTaskId) || !quote) {
    return inquiryReply({ error: "Bitte prüfe Modellvorlage, Grösse, Material, Finish und Menge." }, 400);
  }
  const requestDetails = productionInquiryDetails(body?.requestDetails);
  if (!requestDetails) return inquiryReply({ error: "Bitte prüfe deine Kontaktangaben. Für Ort oder Postleitzahl bitte Schweiz oder Liechtenstein wählen; die Postleitzahl hat vier Ziffern." }, 400);
  let requestId: string | null = null;
  if (body && Object.hasOwn(body, "requestId")) {
    if (typeof body.requestId !== "string" || !REQUEST_ID.test(body.requestId))
      return inquiryReply({ error: "Die Anfrage-ID ist ungültig. Bitte prüfe deinen Entwurf." }, 400);
    requestId = body.requestId.toLowerCase();
  }
  try {
    // Hash the normalized request, never a browser price or today's estimate. A retry
    // returns the saved estimate even after a later pricing or operational change.
    const semantic = JSON.stringify({ schemaVersion: 1, sourceTaskId, templateId: body!.templateId,
      heightMm: quote.heightMm, material: quote.material, finish: quote.finish, quantity: quote.quantity, requestDetails });
    const hashBytes = requestId ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(semantic)) : null;
    const requestSha256 = hashBytes ? Array.from(new Uint8Array(hashBytes), byte => byte.toString(16).padStart(2, "0")).join("") : null;
    const existing = async () => requestId ? env.DB.prepare(
      `SELECT id,status,estimated_total_cents AS estimatedTotalCents,currency,inquiry_request_sha256 AS requestSha256
       FROM production_orders WHERE email=? AND inquiry_request_id=?`,
    ).bind(user.email, requestId).first<SavedInquiry>() : null;
    const replay = (row: SavedInquiry) => row.requestSha256 === requestSha256 ? savedInquiry(row)
      : inquiryReply({ code: "inquiry_conflict", error: "Diese Anfrage-ID gehört zu einer anderen Zusammenstellung. Deine Änderungen bleiben erhalten; bitte bereite sie als neue Anfrage vor." }, 409);
    const prior = await existing();
    if (prior) return replay(prior);
    await ensureAccount(user.email, user.fullName);
    const task = await getOwnedTask(sourceTaskId, user.email);
    if (!task || task.status !== "SUCCEEDED" || task.kind !== "convert")
      return inquiryReply({ error: "Das geprüfte STL-Druckpaket ist noch nicht fertig." }, 409);
    const id = `PRINT-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`, now = Date.now();
    await env.DB.prepare(
      `INSERT INTO production_orders
        (id,email,status,source_task_id,source_task_type,template_name,height_mm,material,finish,quantity,
         estimated_total_cents,currency,created_at,updated_at,request_details_json,inquiry_request_id,inquiry_request_sha256)
       VALUES (?,?,'inquiry',?,'convert',?,?,?,?,?,?,'CHF',?,?,?,?,?)
       ON CONFLICT(email,inquiry_request_id) WHERE inquiry_request_id IS NOT NULL DO NOTHING`,
    ).bind(id, user.email, sourceTaskId, quote.templateName, quote.heightMm, quote.material, quote.finish, quote.quantity,
      quote.estimatedTotalCents, now, now, Object.keys(requestDetails).length ? JSON.stringify(requestDetails) : null, requestId, requestSha256).run();
    if (requestId) {
      const stored = await existing();
      if (!stored) throw new Error("Inquiry outcome unavailable");
      return replay(stored);
    }
    return savedInquiry({ id, status: "inquiry", estimatedTotalCents: quote.estimatedTotalCents, currency: quote.currency, requestSha256: null });
  } catch {
    return inquiryReply({ code: "inquiry_unavailable", error: requestId
      ? "Die Speicherung der Anfrage konnte nicht bestätigt werden. Deine Eingaben bleiben erhalten. Wiederhole denselben Versuch, damit keine zweite Anfrage entsteht."
      : "Die Speicherung der Anfrage konnte nicht bestätigt werden. Deine Eingaben bleiben erhalten. Prüfe zuerst dein Konto, bevor du erneut anfragst." }, 503);
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Unzulässige Anfrage." }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Bitte zuerst anmelden." }, { status: 401 });
  if (!isOwnerEmail(user.email)) return Response.json({ error: "Nur AB3D darf den Produktionsstatus ändern." }, { status: 403 });

  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";
  if (!/^PRINT-[A-Z0-9]{10}$/.test(id) || !["paid", "production", "shipped", "cancelled"].includes(status)) {
    return Response.json({ error: "Ungültiger Produktionsstatus." }, { status: 400 });
  }

  const existing = await env.DB.prepare("SELECT status FROM production_orders WHERE id = ?").bind(id).first<{ status: string }>();
  if (!existing) return Response.json({ error: "Anfrage oder Fertigungsauftrag nicht gefunden." }, { status: 404 });
  // New inquiries cannot be promoted into payment or production through this legacy endpoint.
  // Existing historical orders retain their manually managed, sequential status flow.
  const transitions: Record<string, string[]> = {
    inquiry: ["cancelled"], awaiting_payment: ["paid", "cancelled"],
    paid: ["production", "cancelled"], production: ["shipped", "cancelled"],
  };
  if (!transitions[existing.status]?.includes(status)) return Response.json({ error: "Diese Statusänderung ist nicht freigegeben. Unverbindliche Anfragen lösen weder Zahlung noch Produktion aus." }, { status: 409 });
  const result = await env.DB.prepare(
    "UPDATE production_orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?",
  ).bind(status, Date.now(), id, existing.status).run();
  if (!result.meta.changes) return Response.json({ error: "Der Status wurde inzwischen geändert. Bitte neu laden." }, { status: 409 });

  return Response.json({
    ok: true,
    message: status === "paid"
      ? "Zahlung bestätigt. Die Produktions-STL ist jetzt für AB3D freigeschaltet."
      : "Produktionsstatus aktualisiert.",
  });
}
