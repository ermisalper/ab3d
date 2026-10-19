import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { sha256 } from "../../../../cappatex-artwork";
import { readPreparation, preparationDownloadAllowed } from "../../../../cappatex-preparation-storage";
import { preparationSummary } from "../../../../cappatex-preparation";
import { preparedCheckoutStatus, preparedPrintFile } from "../../../../cappatex-prepared-checkout";
import { PRINT_RENDERER_VERSION } from "../../../../cappatex-print-file";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Anmeldung erforderlich" }, { status: 401, headers });
  const { id } = await context.params;
  if (!/^CPP-[a-f0-9]{32}$/.test(id)) return Response.json({ error: "Nicht gefunden" }, { status: 404, headers });
  try {
    const saved = await readPreparation(id, user.email);
    if (!saved) return Response.json({ error: "Nicht gefunden" }, { status: 404, headers });
    const query = new URL(request.url).searchParams;
    if (query.has("preview")) {
      const position = query.get("preview");
      if (query.getAll("preview").length !== 1 || query.has("side") || !["front", "back"].includes(position || ""))
        return Response.json({ error: "Ungültige Druckansicht" }, { status: 400, headers });
      const selected = saved.sides.find(s => s.position === position);
      if (!selected) return Response.json({ error: "Nicht gefunden" }, { status: 404, headers });
      if (saved.rendererVersion !== PRINT_RENDERER_VERSION)
        return Response.json({ error: "Diese Druckdatei benötigt eine erneute technische Prüfung." }, { status: 409, headers });
      try {
        const original = await preparedPrintFile(selected);
        const proof = original.proof;
        return new Response(new Uint8Array(proof.bytes), { headers: { ...headers, "Content-Type": "image/png",
          "Content-Disposition": `inline; filename="${id}-${position}-vorschau.png"` } });
      } catch { return Response.json({ error: "Die gespeicherte Druckansicht konnte nicht bestätigt werden." }, { status: 409, headers }); }
    }
    const canDownload = await preparationDownloadAllowed(saved, user.email);
    const side = query.get("side");
    if (side === null) return Response.json(preparationSummary(saved, canDownload, await preparedCheckoutStatus(saved, user.email)), { headers });
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
