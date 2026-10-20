import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountCapabilities, ensureAccount, getOwnedTask, isOwnerEmail } from "../../../db/account";
import { productionQuote } from "../../production-quote";
import { productionInquiryDetails } from "../../production-inquiry-details";

const TASK_ID = /^[a-zA-Z0-9-]{8,80}$/;
const MAX_INQUIRY_BYTES = 12_000;

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
  const host = request.headers.get("host");
  if (!origin || !host) return request.headers.get("sec-fetch-site") === "same-origin";
  try { return new URL(origin).host === host; } catch { return false; }
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
  if (!sameOrigin(request)) return Response.json({ error: "Unzulässige Anfrage." }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Bitte melde dich für die unverbindliche Anfrage an." }, { status: 401 });
  let body: {
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
    return Response.json({ error: caught instanceof Error && caught.message === "inquiry_too_large"
      ? "Die Anfrage ist zu gross." : "Bitte sende eine gültige Anfrage." },
    { status: caught instanceof Error && caught.message === "inquiry_too_large" ? 413 : 400 });
  }
  const sourceTaskId = typeof body?.sourceTaskId === "string" ? body.sourceTaskId : "";
  // A browser-provided price, name or complexity never determines the stored estimate.
  const quote = productionQuote(body);
  if (!TASK_ID.test(sourceTaskId) || !quote) {
    return Response.json({ error: "Bitte prüfe Modellvorlage, Grösse, Material, Finish und Menge." }, { status: 400 });
  }
  const requestDetails = productionInquiryDetails(body?.requestDetails);
  if (!requestDetails) return Response.json({ error: "Bitte prüfe deine Kontaktangaben. Für Ort oder Postleitzahl bitte Schweiz oder Liechtenstein wählen; die Postleitzahl hat vier Ziffern." }, { status: 400 });

  await ensureAccount(user.email, user.fullName);
  const task = await getOwnedTask(sourceTaskId, user.email);
  if (!task || task.status !== "SUCCEEDED" || task.kind !== "convert") {
    return Response.json({ error: "Das geprüfte STL-Druckpaket ist noch nicht fertig." }, { status: 409 });
  }

  const id = `PRINT-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO production_orders
      (id, email, status, source_task_id, source_task_type, template_name, height_mm,
       material, finish, quantity, estimated_total_cents, currency, created_at, updated_at, request_details_json)
     VALUES (?, ?, 'inquiry', ?, 'convert', ?, ?, ?, ?, ?, ?, 'CHF', ?, ?, ?)`,
  ).bind(id, user.email, sourceTaskId, quote.templateName, quote.heightMm, quote.material, quote.finish, quote.quantity, quote.estimatedTotalCents, now, now,
    Object.keys(requestDetails).length ? JSON.stringify(requestDetails) : null).run();

  return Response.json({
    ok: true,
    order: { id, status: "inquiry", estimatedTotalCents: quote.estimatedTotalCents, currency: quote.currency },
    message: "Unverbindliche Anfrage gespeichert. AB3D prüft Modell, Herstellbarkeit und Richtpreis. Es wurde keine Zahlung und kein Fertigungsauftrag ausgelöst.",
  });
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
