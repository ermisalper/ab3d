import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { sha256 } from "../../../../cappatex-artwork";
import { readPreparation, preparationDownloadAllowed } from "../../../../cappatex-preparation-storage";
import { preparationSummary } from "../../../../cappatex-preparation";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Anmeldung erforderlich" }, { status: 401, headers });
  const { id } = await context.params;
  if (!/^CPP-[a-f0-9]{32}$/.test(id)) return Response.json({ error: "Nicht gefunden" }, { status: 404, headers });
  try {
    const saved = await readPreparation(id, user.email);
    if (!saved) return Response.json({ error: "Nicht gefunden" }, { status: 404, headers });
    const canDownload = await preparationDownloadAllowed(saved, user.email);
    const side = new URL(request.url).searchParams.get("side");
    if (side === null) return Response.json(preparationSummary(saved, canDownload), { headers });
    if (!canDownload) return Response.json({ error: "Für diese Druckdatei fehlt die Original-Downloadfreigabe." }, { status: 403, headers });
    const selected = saved.sides.find(s => s.position === side);
    if (!selected) return Response.json({ error: "Nicht gefunden" }, { status: 404, headers });
    const object = await env.BUCKET.get(selected.file.key);
    if (!object) return Response.json({ error: "Datei nicht verfügbar" }, { status: 409, headers });
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (await sha256(bytes) !== selected.file.sha256) return Response.json({ error: "Datei konnte nicht bestätigt werden" }, { status: 409, headers });
    return new Response(bytes, { headers: { ...headers, "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${id}-${side}.png"` } });
  } catch { return Response.json({ error: "Druckvorbereitung vorübergehend nicht verfügbar" }, { status: 503, headers }); }
}
