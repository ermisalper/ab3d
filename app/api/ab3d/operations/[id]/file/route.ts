import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { isOwnerEmail } from "../../../../../../db/account";
import { AB3D_OPERATION_ID, AB3D_PRIVATE_HEADERS as headers } from "../../../../../ab3d-operations";

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_TASK_BYTES = 256 * 1024;
const error = (status: number, code: string, message: string) => Response.json({ error: message, code }, { status, headers });
type Format = "glb" | "stl" | "3mf";
const types: Record<Format, string> = { glb: "model/gltf-binary", stl: "model/stl", "3mf": "model/3mf" };

async function boundedBody(response: Response, max: number) {
  const contentLength = response.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > max)) throw new Error("FILE_TOO_LARGE");
  if (!response.body) throw new Error("EMPTY_FILE");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > max) throw new Error("FILE_TOO_LARGE");
      chunks.push(part.value);
    }
  } catch (failure) { await reader.cancel().catch(() => {}); throw failure; }
  finally { reader.releaseLock(); }
  const encoding = response.headers.get("content-encoding")?.toLowerCase().trim();
  // Fetch can decode a compressed body while retaining the compressed Content-Length header.
  if (contentLength && (!encoding || encoding === "identity") && length !== Number(contentLength)) throw new Error("INCOMPLETE_FILE");
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
function trustedAsset(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 8192) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "assets.meshy.ai" && !url.port && !url.username && !url.password && !url.hash;
  } catch { return false; }
}
function validFile(bytes: Uint8Array, format: Format) {
  if (format === "glb") return bytes.length >= 12 && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) === 0x46546c67
    && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) === 2
    && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true) === bytes.length;
  if (format === "3mf") return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4;
  if (bytes.length >= 84) {
    const count = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true);
    if (count > 0 && 84 + count * 50 === bytes.length) return true;
  }
  const start = new TextDecoder().decode(bytes.subarray(0, 512));
  return bytes.length >= 20 && /^\s*solid\b/.test(start) && /\bfacet\s+normal\b/.test(start)
    && /\bendsolid\b/.test(new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 512))));
}

/** Existing conversion files only: GET inspection never generates, repairs, charges or starts production. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return error(401, "unauthenticated", "Bitte zuerst anmelden.");
  if (!isOwnerEmail(user.email)) return error(403, "forbidden", "Nur für die interne AB3D-Prüfung freigegeben.");
  const { id } = await context.params, params = new URL(request.url).searchParams, format = params.get("format");
  if (!AB3D_OPERATION_ID.test(id) || params.size !== 1 || !["glb", "stl", "3mf"].includes(format || ""))
    return error(400, "invalid_request", "Bitte wähle GLB, STL oder 3MF für diese Anfrage.");
  try {
    const order = await env.DB.prepare(`SELECT o.status,o.source_task_id AS sourceTaskId,o.source_task_type AS sourceTaskType,
      t.status AS taskStatus,t.kind AS taskKind,p.task_id AS previewTaskId,p.kind AS previewTaskKind FROM production_orders o
      LEFT JOIN generation_tasks t ON t.task_id=o.source_task_id AND t.email=o.email
      LEFT JOIN generation_tasks p ON p.task_id=t.parent_task_id AND p.email=o.email AND p.status='SUCCEEDED' AND p.kind IN ('resize','print-repair') WHERE o.id=?`).bind(id)
      .first<{ status: string; sourceTaskId: string; sourceTaskType: string; taskStatus: string | null; taskKind: string | null; previewTaskId: string | null; previewTaskKind: string | null }>();
    if (!order) return error(404, "not_found", "Diese Anfrage wurde nicht gefunden.");
    if (!["inquiry", "awaiting_payment", "paid", "production", "shipped"].includes(order.status))
      return error(409, "inspection_blocked", "Diese Anfrage ist für die Dateiprüfung gesperrt.");
    if (order.sourceTaskType !== "convert" || order.taskKind !== "convert" || order.taskStatus !== "SUCCEEDED"
      || !/^[a-zA-Z0-9-]{8,80}$/.test(order.sourceTaskId))
      return error(409, "source_not_ready", "Eine abgeschlossene Konvertierung dieses Kunden ist noch nicht verfügbar.");
    // Conversion is requested only as STL/3MF. Its owned, successful resize/repair input is the matching GLB preview.
    if (format === "glb" && (!order.previewTaskId || !/^[a-zA-Z0-9-]{8,80}$/.test(order.previewTaskId)))
      return error(410, "preview_unavailable", "Für diese Konvertierung ist keine bestätigte GLB-Vorschau gespeichert.");
    const selectedTaskId = format === "glb" ? order.previewTaskId! : order.sourceTaskId;
    const taskPath = format === "glb" ? (order.previewTaskKind === "resize" ? "resize" : "print/repair") : "convert";
    const key = process.env.MESHY_API_KEY?.trim();
    if (!key) return error(503, "engine_unconfigured", "Die interne Modellprüfung ist noch nicht konfiguriert.");
    const task = await fetch(`https://api.meshy.ai/openapi/v1/${taskPath}/${selectedTaskId}`, {
      method: "GET", headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "Accept-Encoding": "identity" },
      redirect: "manual", signal: AbortSignal.timeout(15_000),
    });
    if (task.status === 404 || task.status === 410) return error(410, "source_expired", "Die Quelldatei ist beim Anbieter nicht mehr verfügbar. Bitte keine neue Generierung starten; zunächst die gespeicherten Unterlagen prüfen.");
    if (!task.ok || !/^application\/json(?:\s*;|$)/i.test(task.headers.get("content-type") || ""))
      return error(502, "provider_unavailable", "Der Dateistatus konnte nicht bestätigt werden.");
    const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await boundedBody(task, MAX_TASK_BYTES)));
    const result = data && typeof data === "object" ? data as { id?: unknown; status?: unknown; model_urls?: Record<string, unknown> } : null;
    if (result && result.id !== undefined && result.id !== selectedTaskId)
      return error(502, "source_mismatch", "Der Anbieter hat eine andere Quelldatei zurückgegeben.");
    if (result?.status !== "SUCCEEDED") return error(409, "source_not_ready", "Der Anbieter bestätigt die fertige Quelldatei derzeit nicht.");
    const assetUrl = result.model_urls?.[format!];
    if (!assetUrl) return error(410, "file_unavailable", "Dieses Dateiformat ist beim Anbieter nicht mehr verfügbar.");
    if (!trustedAsset(assetUrl)) return error(502, "untrusted_file", "Die Dateiquelle konnte nicht sicher bestätigt werden.");
    const asset = await fetch(assetUrl, { method: "GET", headers: { "Accept-Encoding": "identity" }, redirect: "manual", signal: AbortSignal.timeout(25_000) });
    if (asset.status === 403 || asset.status === 404 || asset.status === 410) return error(410, "file_expired", "Der Dateilink ist abgelaufen oder die Datei nicht mehr verfügbar. Bitte die gespeicherten Unterlagen prüfen.");
    const contentType = (asset.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const allowed: Record<Format, string[]> = {
      glb: ["model/gltf-binary", "application/octet-stream"],
      stl: ["model/stl", "application/sla", "application/vnd.ms-pki.stl", "application/octet-stream", "text/plain"],
      "3mf": ["model/3mf", "application/vnd.ms-package.3dmanufacturing-3dmodel+xml", "application/zip", "application/octet-stream"],
    };
    if (!asset.ok || !allowed[format as Format].includes(contentType)) return error(502, "invalid_file", "Der Anbieter lieferte keine bestätigte Modelldatei.");
    const bytes = await boundedBody(asset, MAX_FILE_BYTES);
    if (!validFile(bytes, format as Format)) return error(502, "invalid_file", "Die Dateistruktur konnte nicht bestätigt werden.");
    return new Response(bytes, { headers: { ...headers, "Content-Type": types[format as Format], "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="ab3d-pruefung-${id}.${format}"`, "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (failure) {
    if (failure instanceof Error && failure.message === "FILE_TOO_LARGE") return error(413, "file_too_large", "Die Datei überschreitet die interne Prüfgrenze von 32 MiB.");
    return error(502, "file_unavailable", "Die Modelldatei konnte nicht sicher geladen werden. Bitte später erneut versuchen.");
  }
}
