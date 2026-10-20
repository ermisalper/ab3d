import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { isOwnerEmail } from "../../../../../../db/account";
import { getProductionOffer, saveProductionOffer } from "../../../../../../db/production-offers";
import { AB3D_OPERATION_ID, AB3D_PRIVATE_HEADERS as headers } from "../../../../../ab3d-operations";
import { parseProductionOffer } from "../../../../../production-offer";

type Context = { params: Promise<{ id: string }> };
const error = (status: number, code: string, message: string) => Response.json({ error: message, code }, { status, headers });

export async function GET(_request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return error(401, "unauthenticated", "Bitte zuerst anmelden.");
  if (!isOwnerEmail(user.email)) return error(403, "forbidden", "Nur für AB3D freigegeben.");
  const { id } = await context.params;
  if (!AB3D_OPERATION_ID.test(id)) return error(400, "invalid_request", "Ungültige Anfrage-ID.");
  try {
    const offer = await getProductionOffer(id);
    return offer ? Response.json(offer, { headers }) : error(404, "not_found", "Diese Anfrage wurde nicht gefunden.");
  } catch { return error(503, "unavailable", "Der Angebotsentwurf ist vorübergehend nicht verfügbar. Deine lokalen Eingaben bleiben erhalten."); }
}

export async function PUT(request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return error(401, "unauthenticated", "Bitte zuerst anmelden.");
  if (!isOwnerEmail(user.email)) return error(403, "forbidden", "Nur für AB3D freigegeben.");
  if (request.headers.get("origin") !== new URL(request.url).origin) return error(403, "invalid_origin", "Unzulässige Anfrage.");
  const { id } = await context.params;
  if (!AB3D_OPERATION_ID.test(id) || !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || ""))
    return error(400, "invalid_request", "Ungültiger Angebotsentwurf.");
  let body: unknown;
  try {
    const declared = request.headers.get("content-length");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > 20_000)) return error(413, "too_large", "Der Angebotsentwurf ist zu gross.");
    const reader = request.body?.getReader();
    if (!reader) return error(400, "invalid_request", "Die Angebotsangaben fehlen.");
    const parts: Uint8Array[] = []; let length = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > 20_000) { await reader.cancel(); return error(413, "too_large", "Der Angebotsentwurf ist zu gross."); }
      parts.push(part.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return error(400, "invalid_request", "Die Angebotsangaben sind nicht lesbar."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return error(400, "invalid_request", "Ungültige Angebotsangaben.");
  const input = body as Record<string, unknown>, keys = Object.keys(input);
  let payload;
  try { payload = parseProductionOffer(input.payload); }
  catch { return error(400, "invalid_request", "Bitte prüfe Kosten und Mengen. Unbekannte Werte dürfen offen bleiben."); }
  if (keys.length !== 2 || !keys.includes("version") || !keys.includes("payload")
    || !Number.isSafeInteger(input.version) || Number(input.version) < 0 || Number(input.version) >= 1_000_000)
    return error(400, "invalid_request", "Bitte prüfe Kosten, Mengen und gespeicherte Version. Unbekannte Werte dürfen offen bleiben.");
  try {
    if (!await getProductionOffer(id)) return error(404, "not_found", "Diese Anfrage wurde nicht gefunden.");
    const offer = await saveProductionOffer(id, payload, Number(input.version), user.email);
    return offer ? Response.json(offer, { headers })
      : error(409, "offer_conflict", "Der Entwurf wurde inzwischen geändert. Lade den gespeicherten Stand zum Vergleich; deine Eingabe bleibt erhalten.");
  } catch { return error(503, "unavailable", "Die Speicherung konnte nicht bestätigt werden. Lade den gespeicherten Stand zum Vergleich; deine Eingabe bleibt erhalten."); }
}
