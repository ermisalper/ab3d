import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { ensureAccount } from "../../../../db/account";
import { generationAccess } from "../../../cappatex-generation-access";
import { sha256 } from "../../../cappatex-artwork";
import { createArtworkPreview } from "../../../cappatex-preview";
import { boundedBody, validateUploadPng, RESERVE_UPLOAD } from "../../../cappatex-upload";

const error = (status: number, code: string, message: string) => Response.json({ error: message, code }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return error(403, "invalid_origin", "Unzulässige Anfrage.");
  const user = await getChatGPTUser();
  if (!user) return error(401, "sign_in_required", "Bitte melde dich an, um ein eigenes Bild zu verwenden.");
  if (process.env.CAPPATEX_UPLOAD_ENABLED !== "true") return error(503, "upload_disabled", "Der Bildupload wartet auf die Testfreigabe des Shopbetreibers.");
  if (!generationAccess(user.email, process.env.CAPPATEX_GENERATION_AUDIENCE, process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS).allowed)
    return error(403, "upload_not_allowed", "Der Bildupload ist derzeit nur für das freigegebene Testkonto verfügbar.");
  if (request.headers.get("content-type")?.split(";")[0] !== "image/png") return error(415, "png_required", "Bitte lade das Bild über die PNG/JPG-Dateiauswahl hoch.");
  if (request.headers.get("x-cappatex-image-rights") !== "confirmed") return error(400, "rights_required", "Bitte bestätige, dass du das Bild verwenden darfst.");

  const id = `CPX-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  try {
    await ensureAccount(user.email, user.fullName);
    const now = Date.now();
    const reserved = await env.DB.prepare(RESERVE_UPLOAD).bind(id, user.email, now, now, user.email, now - 86_400_000).run();
    if (!reserved.meta.changes) return error(429, "upload_limit", "Du kannst innerhalb von 24 Stunden höchstens zehn Upload-Versuche starten.");
  } catch { return error(503, "upload_unavailable", "Der Bildspeicher ist noch nicht bereit."); }
  const failUpload = () => env.DB.prepare("UPDATE cappatex_designs SET status = 'upload_failed', updated_at = ? WHERE id = ? AND email = ? AND status = 'uploading'")
    .bind(Date.now(), id, user.email).run().catch(() => {});

  let bytes: Uint8Array, size, preview;
  try {
    bytes = await boundedBody(request);
    size = await validateUploadPng(bytes);
    preview = createArtworkPreview(bytes);
    if (!preview.visible) throw new Error("empty_artwork");
  } catch (caught) {
    await failUpload();
    const tooLarge = caught instanceof Error && caught.message === "upload_too_large";
    return error(tooLarge ? 413 : 400, tooLarge ? "upload_too_large" : "invalid_image", tooLarge
      ? "Die Druckdatei darf höchstens 12 MB gross sein."
      : "Das Bild ist leer, beschädigt oder nicht unterstützt. Bitte wähle ein sichtbares PNG- oder JPG-Motiv mit höchstens 6,29 Megapixeln und 6144 Pixeln je Seite.");
  }

  try {
    const hash = await sha256(bytes);
    const artworkKey = `cappatex/${id}/${hash}.png`;
    const previewHash = await sha256(preview.bytes);
    const previewKey = `cappatex/${id}/${hash}.preview-v1.png`;
    await env.BUCKET.put(artworkKey, bytes, { httpMetadata: { contentType: "image/png" } });
    await env.BUCKET.put(previewKey, preview.bytes, { httpMetadata: { contentType: "image/png" } });
    const saved = await env.DB.prepare("UPDATE cappatex_designs SET artwork_key = ?, artwork_sha256 = ?, artwork_width = ?, artwork_height = ?, preview_key = ?, preview_sha256 = ?, status = 'preview_ready', updated_at = ? WHERE id = ? AND email = ? AND status = 'uploading'")
      .bind(artworkKey, hash, size.width, size.height, previewKey, previewHash, Date.now(), id, user.email).run();
    if (!saved.meta.changes) throw new Error("upload_not_saved");
    return Response.json({ image: `/api/cappatex/artwork/${id}`, designId: id, width: size.width, height: size.height,
      previewWidth: preview.width, previewHeight: preview.height, sha256: hash, format: "png", source: "upload" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Do not delete potentially committed files after an uncertain database result.
    await failUpload();
    return error(503, "upload_failed", "Das Bild konnte nicht sicher gespeichert werden. Es wurde kein Design-Token verbraucht.");
  }
}
