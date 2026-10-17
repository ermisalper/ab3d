import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { generationAccess } from "../../../cappatex-generation-access";
import { designCatalog } from "../../../cappatex-design-catalog";
import { CAPPATEX_DESIGN_PROFILES } from "../../../cappatex-design-profiles";
import { placementGeometry } from "../../../cappatex-print-profile";
import { boundedBody } from "../../../cappatex-upload";
import { sha256 } from "../../../cappatex-artwork";
import { renderPrintFile, PRINT_RENDERER_VERSION } from "../../../cappatex-print-file";
import { preparationInput, preparationSummary, type PreparedDesign } from "../../../cappatex-preparation";
import { readPreparation, preparationDownloadAllowed } from "../../../cappatex-preparation-storage";
import { PREPARATION_LIST_SIZE, parsePreparationListCursor, preparationListCursor, preparationListItem,
  type PreparationListRow, type PreparationListCursor, type PreparationListResponse } from "../../../cappatex-preparation-list";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status, headers });

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return fail(401, "sign_in_required", "Bitte melde dich an, um deine gespeicherten Gestaltungen anzusehen.");
  let cursor: PreparationListCursor | null;
  try {
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(key => key !== "cursor") || query.getAll("cursor").length > 1) throw new Error("invalid_preparation_cursor");
    cursor = parsePreparationListCursor(query.get("cursor"));
  } catch { return fail(400, "invalid_list_request", "Die gespeicherte Listenseite ist ungültig. Bitte öffne deine Gestaltungen erneut."); }
  try {
    const rows = await env.DB.prepare(`SELECT id,created_at,payload_json,payload_sha256 FROM cappatex_preparations
      WHERE email = ? AND state = 'ready'
        AND length(id) = 36 AND substr(id,1,4) = 'CPP-' AND substr(id,5) NOT GLOB '*[^a-f0-9]*'
        AND typeof(created_at) = 'integer' AND created_at >= 0 AND created_at <= 8640000000000000
        ${cursor ? "AND (created_at < ? OR (created_at = ? AND id < ?))" : ""}
      ORDER BY created_at DESC,id DESC LIMIT ?`)
      .bind(user.email, ...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : []), PREPARATION_LIST_SIZE + 1).all<PreparationListRow>();
    const page = rows.results.slice(0, PREPARATION_LIST_SIZE);
    const items = await Promise.all(page.map(preparationListItem));
    const last = page.at(-1);
    const result: PreparationListResponse = { items, nextCursor: rows.results.length > PREPARATION_LIST_SIZE && last
      ? preparationListCursor({ createdAt: last.created_at, id: last.id }) : null };
    return Response.json(result, { headers });
  } catch { return fail(503, "preparation_list_unavailable", "Deine gespeicherten Gestaltungen konnten gerade nicht geladen werden. Bitte versuche es erneut."); }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail(403, "invalid_origin", "Unzulässige Anfrage.");
  const user = await getChatGPTUser();
  if (!user) return fail(401, "sign_in_required", "Bitte melde dich an.");
  if (!generationAccess(user.email, "owner", process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS).allowed)
    return fail(403, "preparation_not_allowed", "Die Druckvorbereitung ist derzeit für das Testkonto freigegeben.");
  let input: ReturnType<typeof preparationInput>;
  try { input = preparationInput(JSON.parse(new TextDecoder().decode(await boundedBody(request, 8000)))); }
  catch { return fail(400, "invalid_preparation", "Bitte wähle eine Variante und eine oder zwei gültige Druckseiten."); }
  const requestHash = await sha256(JSON.stringify(input));
  async function repeated() {
    const row = await env.DB.prepare("SELECT id,request_sha256,state FROM cappatex_preparations WHERE email = ? AND request_id = ?")
      .bind(user!.email, input.requestId).first<{ id: string; request_sha256: string; state: string }>();
    if (!row) return null;
    if (row.request_sha256 !== requestHash) return fail(409, "request_changed", "Diese Speicheranfrage gehört zu einer anderen Gestaltung.");
    if (row.state === "ready") {
      const saved = await readPreparation(row.id, user!.email);
      return saved ? Response.json(preparationSummary(saved, await preparationDownloadAllowed(saved, user!.email)), { headers })
        : fail(409, "preparation_changed", "Der gespeicherte Stand konnte nicht bestätigt werden.");
    }
    return fail(row.state === "preparing" ? 202 : 409, row.state, row.state === "preparing"
      ? "Die Dateien werden noch vorbereitet. Bitte prüfe den Speicherstatus erneut." : "Dieser Speicherversuch ist fehlgeschlagen. Bitte starte eine neue Speicherung.");
  }
  let reservedId: string | null = null;
  let phase = "idempotency";
  try {
    const duplicate = await repeated(); if (duplicate) return duplicate;
    phase = "catalog";
    const products = await designCatalog(user.email);
    const product = products.find(p => p.id === input.profileId && p.profileVersion === input.profileVersion);
    const variant = product?.variants.find(v => v.shopifyVariantId === input.shopifyVariantId);
    const profile = CAPPATEX_DESIGN_PROFILES.find(p => p.id === product?.id && p.version === product.profileVersion);
    if (!product || !variant || !profile) return fail(409, "catalog_mismatch", "Die Variante oder das Druckprofil ist nicht mehr bestätigt. Bitte lade den Katalog neu.");
    const selected = [];
    phase = "source_metadata";
    for (const side of input.sides) {
      const geometryProfile = side.position === "front" ? variant : variant.back;
      if (!geometryProfile || geometryProfile.area.position !== side.position) return fail(409, "side_unavailable", "Diese Druckseite ist für die gewählte Variante nicht geprüft.");
      const design = await env.DB.prepare("SELECT artwork_key,artwork_sha256,artwork_width,artwork_height,style FROM cappatex_designs WHERE id = ? AND email = ? AND status = 'preview_ready'")
        .bind(side.designId, user.email).first<{ artwork_key: string; artwork_sha256: string; artwork_width: number; artwork_height: number; style: string }>();
      if (!design?.artwork_key || !design.artwork_sha256) return fail(409, "design_not_ready", "Ein ausgewähltes Motiv ist nicht verfügbar oder gehört nicht zu deinem Konto.");
      const artwork = { key: design.artwork_key, sha256: design.artwork_sha256, width: design.artwork_width, height: design.artwork_height };
      const geometry = placementGeometry(geometryProfile.area, artwork, side.placement);
      if (!geometry.ok) return fail(400, "invalid_placement", `${side.position === "front" ? "Vorderseite" : "Rückseite"}: ${geometry.reason}`);
      selected.push({ ...side, artwork, source: design.style === "Upload" ? "upload" as const : "generated" as const,
        area: geometryProfile.area, mockup: geometryProfile.mockup });
    }
    const id = `CPP-${crypto.randomUUID().replaceAll("-", "")}`, now = Date.now();
    try {
      const reserved = await env.DB.prepare("INSERT INTO cappatex_preparations (id,email,request_id,request_sha256,state,created_at) SELECT ?,?,?,?,'preparing',? WHERE (SELECT COUNT(*) FROM cappatex_preparations WHERE email = ? AND created_at >= ?) < 20")
        .bind(id, user.email, input.requestId, requestHash, now, user.email, now - 86_400_000).run();
      if (!reserved.meta.changes) return fail(429, "preparation_limit", "Für heute sind zwanzig Speicherversuche erreicht.");
      reservedId = id;
    } catch {
      return await repeated() || fail(409, "preparation_busy", "Eine Druckvorbereitung läuft bereits. Bitte warte auf deren Abschluss.");
    }
    const sides: PreparedDesign["sides"] = [];
    for (const s of selected) {
      phase = "source_read";
      const object = await env.BUCKET.get(s.artwork.key);
      if (!object) throw new Error("artwork_missing");
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (await sha256(bytes) !== s.artwork.sha256) throw new Error("artwork_changed");
      phase = "render";
      const rendered = await renderPrintFile(bytes, s.area, s.placement, s.source);
      // Reject altered metadata even if the stored source hash is otherwise valid.
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (view.getUint32(16) !== s.artwork.width || view.getUint32(20) !== s.artwork.height) throw new Error("artwork_dimensions_changed");
      const hash = await sha256(rendered.bytes), key = `cappatex/preparations/${id}/${s.position}-${hash}.png`;
      phase = "file_store";
      await env.BUCKET.put(key, rendered.bytes, { httpMetadata: { contentType: "image/png" } });
      sides.push({ ...s, file: { key, sha256: hash, width: rendered.width, height: rendered.height }, raster: rendered.raster, dpi: rendered.dpi });
    }
    const saved: PreparedDesign = { schemaVersion: 2, rendererVersion: PRINT_RENDERER_VERSION, id, createdAt: now,
      profileId: profile.id, profileVersion: profile.version, name: profile.name, shopId: profile.shopId,
      printifyProductId: profile.printifyProductId, blueprintId: profile.blueprintId, providerId: profile.providerId,
      variant: { shopifyVariantId: variant.shopifyVariantId, printifyVariantId: variant.printifyVariantId, sku: variant.sku, color: variant.color, size: variant.size },
      quantity: input.quantity, country: input.country, sides };
    const json = JSON.stringify(saved);
    phase = "commit";
    const complete = await env.DB.prepare("UPDATE cappatex_preparations SET payload_json = ?, payload_sha256 = ?, state = 'ready' WHERE id = ? AND email = ? AND state = 'preparing'")
      .bind(json, await sha256(json), id, user.email).run();
    if (!complete.meta.changes) throw new Error("preparation_not_saved");
    phase = "summary";
    return Response.json(preparationSummary(saved, await preparationDownloadAllowed(saved, user.email)), { status: 201, headers });
  } catch (error) {
    const known = ["unsupported_upload", "invalid_png", "invalid_png_data", "unsupported_print_source", "invalid_placement",
      "invalid_raster_bounds", "print_file_too_large", "print_area_too_large", "artwork_missing", "artwork_changed", "artwork_dimensions_changed", "preparation_not_saved"];
    console.error("cappatex_preparation_failed", { phase, reason: error instanceof Error && known.includes(error.message) ? error.message : "unclassified" });
    if (reservedId) await env.DB.prepare("UPDATE cappatex_preparations SET state = 'failed' WHERE id = ? AND email = ? AND state = 'preparing'")
      .bind(reservedId, user.email).run().catch(() => {});
    return fail(503, "preparation_failed", "Die Druckdateien konnten nicht vollständig bestätigt werden. Es wurde keine Bestellung ausgelöst.");
  }
}
