import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { sha256 } from "../../../../cappatex-artwork";
import { accountCapabilities, ensureAccount } from "../../../../../db/account";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Anmeldung erforderlich", { status: 401 });
  const { id } = await context.params;
  if (!/^CPX-[A-Z0-9]{12}$/.test(id)) return new Response("Nicht gefunden", { status: 404 });
  try {
    const download = new URL(request.url).searchParams.get("download") === "1";
    if (download && !accountCapabilities(await ensureAccount(user.email, user.fullName)).canDownloadHd) {
      return new Response("HD-Dateiexport erfordert ein CAPPATEX- oder Complete-Abo.", { status: 403 });
    }
    const row = await env.DB.prepare("SELECT artwork_key, artwork_sha256, preview_key, preview_sha256 FROM cappatex_designs WHERE id = ? AND email = ? AND status = 'preview_ready'")
      .bind(id, user.email).first<{ artwork_key: string; artwork_sha256: string; preview_key: string; preview_sha256: string }>();
    if (!row?.artwork_key) return new Response("Nicht gefunden", { status: 404 });
    const key = download ? row.artwork_key : row.preview_key;
    if (!key) return new Response("Vorschau nicht verfügbar", { status: 503 });
    const object = await env.BUCKET.get(key);
    if (!object) return new Response("Nicht verfügbar", { status: 503 });
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (await sha256(bytes) !== (download ? row.artwork_sha256 : row.preview_sha256)) return new Response("Dateiprüfung fehlgeschlagen", { status: 503 });
    return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      ...(download ? { "Content-Disposition": `attachment; filename="${id}.png"` } : {}) } });
  } catch { return new Response("Datei vorübergehend nicht verfügbar", { status: 503 }); }
}
