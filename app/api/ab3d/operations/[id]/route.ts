import { getChatGPTUser } from "../../../../chatgpt-auth";
import { isOwnerEmail } from "../../../../../db/account";
import { getProductionOperation, saveProductionReview } from "../../../../../db/production-operations";
import { AB3D_OPERATION_ID, AB3D_PRIVATE_HEADERS as headers, isAb3dReviewState } from "../../../../ab3d-operations";

type Context = { params: Promise<{ id: string }> };
const error = (status: number, code: string, message: string) => Response.json({ error: message, code }, { status, headers });

export async function GET(_request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return error(401, "unauthenticated", "Bitte zuerst anmelden.");
  if (!isOwnerEmail(user.email)) return error(403, "forbidden", "Nur für AB3D freigegeben.");
  const { id } = await context.params;
  if (!AB3D_OPERATION_ID.test(id)) return error(400, "invalid_request", "Ungültige Anfrage-ID.");
  try {
    const detail = await getProductionOperation(id);
    return detail ? Response.json(detail, { headers }) : error(404, "not_found", "Diese Anfrage wurde nicht gefunden.");
  } catch { return error(503, "unavailable", "Die Anfrage ist vorübergehend nicht verfügbar."); }
}

export async function PATCH(request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return error(401, "unauthenticated", "Bitte zuerst anmelden.");
  if (!isOwnerEmail(user.email)) return error(403, "forbidden", "Nur für AB3D freigegeben.");
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return error(403, "invalid_origin", "Unzulässige Anfrage.");
  const { id } = await context.params;
  if (!AB3D_OPERATION_ID.test(id) || !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || ""))
    return error(400, "invalid_request", "Ungültige Prüfanfrage.");
  try {
    const declared = request.headers.get("content-length");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > 16_000)) return error(413, "too_large", "Die Notiz ist zu lang.");
    const reader = request.body?.getReader();
    if (!reader) return error(400, "invalid_request", "Die Prüfangaben fehlen.");
    const parts: Uint8Array[] = []; let length = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > 16_000) { await reader.cancel(); return error(413, "too_large", "Die Notiz ist zu lang."); }
      parts.push(part.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return error(400, "invalid_request", "Ungültige Prüfangaben.");
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some(key => !["state", "notes", "version"].includes(key)) || !isAb3dReviewState(input.state)
      || typeof input.notes !== "string" || input.notes.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.notes)
      || !Number.isSafeInteger(input.version) || Number(input.version) < 0 || Number(input.version) > 1_000_000)
      return error(400, "invalid_request", "Bitte prüfe Status, Notiz und gespeicherte Version.");
    if (!await getProductionOperation(id)) return error(404, "not_found", "Diese Anfrage wurde nicht gefunden.");
    const result = await saveProductionReview(id, input.state, input.notes, Number(input.version), user.email);
    return result ? Response.json({ ok: true, review: result }, { headers })
      : error(409, "review_conflict", "Die Prüfung wurde inzwischen geändert. Bitte neu laden; deine Notiz wurde nicht überschrieben.");
  } catch (failure) {
    if (failure instanceof SyntaxError || failure instanceof TypeError) return error(400, "invalid_request", "Die Prüfangaben sind nicht lesbar.");
    return error(503, "unavailable", "Die Prüfung konnte nicht gespeichert werden. Bitte neu laden und den gespeicherten Stand prüfen.");
  }
}
