import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountCapabilities, ensureAccount, getOwnedTask, isOwnerEmail } from "../../../db/account";

const TASK_ID = /^[a-zA-Z0-9-]{8,80}$/;

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
  if (!user) return Response.json({ error: "Bitte melde dich für den Fertigungsauftrag an." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 12_000) return Response.json({ error: "Der Auftrag ist zu gross." }, { status: 413 });

  const body = await request.json().catch(() => null) as {
    sourceTaskId?: unknown;
    templateName?: unknown;
    heightCm?: unknown;
    material?: unknown;
    finish?: unknown;
    quantity?: unknown;
    estimatedTotal?: unknown;
  } | null;
  const sourceTaskId = typeof body?.sourceTaskId === "string" ? body.sourceTaskId : "";
  const templateName = typeof body?.templateName === "string" ? body.templateName.trim().slice(0, 100) : "";
  const heightCm = Number(body?.heightCm);
  const material = body?.material === "PETG" ? "PETG" : "PLA";
  const finish = body?.finish === "Premium" ? "Premium" : "Roh";
  const quantity = Number(body?.quantity);
  const estimatedTotal = Number(body?.estimatedTotal);
  if (!TASK_ID.test(sourceTaskId) || templateName.length < 2 || !Number.isFinite(heightCm) || heightCm < 5 || heightCm > 80 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !Number.isFinite(estimatedTotal) || estimatedTotal < 1 || estimatedTotal > 100_000) {
    return Response.json({ error: "Bitte prüfe Modell, Grösse, Menge und Richtpreis." }, { status: 400 });
  }

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
       material, finish, quantity, estimated_total_cents, currency, created_at, updated_at)
     VALUES (?, ?, 'awaiting_payment', ?, 'convert', ?, ?, ?, ?, ?, ?, 'CHF', ?, ?)`,
  ).bind(id, user.email, sourceTaskId, templateName, Math.round(heightCm * 10), material, finish, quantity, Math.round(estimatedTotal * 100), now, now).run();

  return Response.json({
    ok: true,
    order: { id, status: "awaiting_payment" },
    message: "Fertigungsauftrag gespeichert. Nach bestätigter Zahlung wird die STL automatisch für AB3D zur Produktion bereitgestellt.",
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

  const result = await env.DB.prepare(
    "UPDATE production_orders SET status = ?, updated_at = ? WHERE id = ?",
  ).bind(status, Date.now(), id).run();
  if (!result.meta.changes) return Response.json({ error: "Fertigungsauftrag nicht gefunden." }, { status: 404 });

  return Response.json({
    ok: true,
    message: status === "paid"
      ? "Zahlung bestätigt. Die Produktions-STL ist jetzt für AB3D freigeschaltet."
      : "Produktionsstatus aktualisiert.",
  });
}
