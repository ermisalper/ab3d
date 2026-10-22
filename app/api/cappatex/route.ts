import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountCapabilities, ensureAccount, getTokenBalance, hasUnlimitedTokens } from "../../../db/account";
import { generationAccess } from "../../cappatex-generation-access";
import { decodeBase64, pngSize, sha256 } from "../../cappatex-artwork";
import { createArtworkPreview } from "../../cappatex-preview";
import { RESERVE_DESIGN, DEBIT_DESIGN, LOG_DESIGN, REFUND_DESIGN, LOG_REFUND, FINISH_FAILURE } from "../../../db/cappatex-generation";
import { parseGalleryChoice } from "../../gallery-policy";
import { reserveCreation, readyArtworkCreation, failCreation } from "../../gallery-storage";
import { reserveAiUsage } from "../../../db/ai-usage";

const CANVASES: Record<string, string> = { square: "2048x2048", portrait: "2048x3072", landscape: "3072x2048" };
const STYLES = new Set(["Minimal", "Illustrativ", "Retro", "Streetwear"]);
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const MAX_REQUEST_BYTES = 4_000;
const MAX_IMAGE_BYTES = 12_000_000;
const OPENAI_TIMEOUT_MS = 150_000;
const OPENAI_LOGGABLE_PARAMETERS = new Set(["model", "n", "size", "quality", "output_format", "background", "moderation"]);
const OPENAI_BILLING_ERRORS = new Map([
  ["credit_balance_exhausted", "Das OpenAI-API-Guthaben ist aufgebraucht. Bitte prüfe die API-Abrechnung des verbundenen OpenAI-Projekts."],
  ["insufficient_quota", "Das OpenAI-Projekt hat kein verfügbares API-Guthaben oder sein Nutzungslimit erreicht. Bitte prüfe API-Abrechnung und Projektlimits."],
  ["billing_hard_limit_reached", "Das Ausgabenlimit für die OpenAI-API ist erreicht. Bitte prüfe die API-Abrechnung und die Limits des verbundenen OpenAI-Projekts."],
]);

type OpenAIError = {
  error?: {
    code?: string;
    type?: string;
    param?: string;
    message?: string;
    moderation_details?: {
      moderation_stage?: "input" | "output" | "unknown";
      categories?: string[];
    };
  };
};

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string }>;
  output_format?: string;
  quality?: string;
  size?: string;
  usage?: { total_tokens?: number };
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function buildProductionPrompt(canvas: string, style: string, prompt: string) {
  return [
    "Create exactly one original, professional, print-on-demand artwork.",
    `Artwork format: ${canvas}. Visual direction: ${style}.`,
    `Customer brief: ${prompt}`,
    "Return only the isolated flat artwork, centered and completely visible.",
    "Do not show garments, products, people wearing the product, mockups, rooms, hands, frames, watermarks, signatures, UI, borders, or presentation scenes.",
    "Use a transparent or visually plain background, clean edges, strong readable shapes, balanced negative space, and print-safe contrast.",
    "Avoid tiny details and hairline strokes that disappear in production. Do not add text unless the customer explicitly requested the exact words.",
    "The result must be suitable as source artwork for professional print-on-demand production.",
  ].join(" ");
}

function moderationMessage(stage?: string) {
  if (stage === "input") return "Deine Beschreibung wurde vom Sicherheitsfilter abgelehnt. Bitte formuliere sie neutraler und versuche es erneut.";
  if (stage === "output") return "Das erzeugte Ergebnis wurde vom Sicherheitsfilter abgelehnt. Bitte ändere Motiv oder Stil leicht.";
  return "Dieses Motiv konnte aus Sicherheitsgründen nicht erstellt werden. Bitte passe die Beschreibung an.";
}

function clientError(status: number, code: string, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, code, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

async function callOpenAI(apiKey: string, prompt: string, size: string) {
  // One explicit request only. An ambiguous timeout must never trigger another paid request.
  return fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ model: "gpt-image-2.5-flare", prompt, n: 1, size, quality: "high", output_format: "png", background: "transparent", moderation: "auto" }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return clientError(403, "invalid_origin", "Unzulässige Anfrage.");
  if (Number(request.headers.get("content-length") || 0) > MAX_REQUEST_BYTES) {
    return clientError(413, "request_too_large", "Die Anfrage ist zu gross.");
  }

  const user = await getChatGPTUser();
  if (!user) return clientError(401, "sign_in_required", "Bitte melde dich an, bevor du ein Motiv generierst.");

  const body = await request.json().catch(() => null) as {
    prompt?: unknown;
    canvas?: unknown;
    style?: unknown;
    confirmGeneration?: unknown;
    galleryChoice?: unknown;
  } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const canvas = typeof body?.canvas === "string" ? body.canvas : "";
  const style = typeof body?.style === "string" ? body.style : "";

  if (prompt.length < 12 || prompt.length > 500) {
    return clientError(400, "invalid_prompt", "Bitte beschreibe dein Motiv mit 12 bis 500 Zeichen.");
  }
  if (!Object.hasOwn(CANVASES, canvas) || !STYLES.has(style)) {
    return clientError(400, "invalid_configuration", "Bitte wähle ein gültiges Bildformat und einen Bildstil.");
  }
  if (body?.confirmGeneration !== true) {
    return clientError(409, "confirmation_required", "Bitte bestätige die kostenpflichtige KI-Generierung.");
  }
  let galleryChoice;
  try { galleryChoice = parseGalleryChoice(body.galleryChoice,"cappatex"); }
  catch { return clientError(409,"gallery_choice_required","Bitte wähle vor der Erstellung, ob dein Motiv privat bleiben oder in der Galerie erscheinen soll."); }
  if (process.env.CAPPATEX_GENERATION_ENABLED !== "true") {
    return clientError(503, "generation_disabled", "Der Bildgenerator wartet noch auf die Freigabe des Shopbetreibers.");
  }
  const access = generationAccess(
    user.email,
    process.env.CAPPATEX_GENERATION_AUDIENCE,
    process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS,
  );
  if (!access.allowed) {
    if (access.reason === "owner_only") {
      return clientError(403, "owner_only", "Die Bildgenerierung ist während der Testphase nur für den Betreiberaccount freigeschaltet.");
    }
    return clientError(503, "generation_access_not_configured", "Die Zugriffsfreigabe für den Bildgenerator ist noch nicht vollständig eingerichtet.");
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return clientError(503, "openai_not_configured", "Der Bildgenerator ist noch nicht vollständig eingerichtet.");
  }

  const productionPrompt = buildProductionPrompt(canvas, style, prompt);
  const designId = `CPX-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const createdAt = Date.now();
  const creation=await reserveCreation(user.email,"cappatex",galleryChoice,designId);
  try {
    if (!env.BUCKET) throw new Error("artwork_storage_missing");
    // Validate the complete persistence schema before making a paid image request.
    await env.DB.prepare(
      "SELECT artwork_key, artwork_sha256, artwork_width, artwork_height, preview_key, preview_sha256 FROM cappatex_designs LIMIT 0",
    ).first();
    const account = await ensureAccount(user.email, user.fullName);
    if (!access.pilotOwner && !accountCapabilities(account).canUseCappatex) {
      return clientError(403, "plan_required", "CAPPATEX ist im CAPPATEX- oder Complete-Abo enthalten.");
    }
    if (!access.pilotOwner && !hasUnlimitedTokens(user.email) && account.tokenBalance < 1) {
      return clientError(402, "insufficient_tokens", "Für eine CAPPATEX Motivvorschau brauchst du 1 Design-Token.");
    }
    const admission = await reserveAiUsage(user.email, "cappatex");
    if (!admission.allowed) return Response.json({ code: admission.code, error: admission.error }, {
      status: admission.status, headers: { "Cache-Control": "no-store",
        ...(admission.retryAfterSeconds ? { "Retry-After": String(admission.retryAfterSeconds) } : {}) },
    });
    const exempt = access.pilotOwner || hasUnlimitedTokens(user.email);
    const results = await env.DB.batch([
      env.DB.prepare(RESERVE_DESIGN)
        .bind(designId,user.email,prompt,productionPrompt,style,canvas,createdAt,createdAt,exempt ? 0 : 1,user.email,exempt ? 1 : 0),
      env.DB.prepare(DEBIT_DESIGN)
        .bind(createdAt,user.email,designId),
      env.DB.prepare(LOG_DESIGN)
        .bind(user.email,designId,createdAt,designId),
      creation.statement,
    ]);
    if (!results[0].meta.changes) { await failCreation(creation.id,user.email); return clientError(402, "insufficient_tokens", "Für ein Motiv brauchst du 1 Design-Token."); }

  } catch {
    return clientError(503, "design_storage_unavailable", "Der Designspeicher ist nicht bereit oder eine vorherige Generierung wird noch geprüft. Es wurde keine weitere kostenpflichtige Generierung gestartet.");
  }

  let completed = false;
  let outcomeKnown = false;
  try {
    const response = await callOpenAI(apiKey, productionPrompt, CANVASES[canvas]);
    outcomeKnown = true;
    const requestId = response.headers.get("x-request-id") || undefined;
    const responseLength = Number(response.headers.get("content-length") || 0);
    if (responseLength > MAX_IMAGE_BYTES * 1.4) {
      console.error("CAPPATEX OpenAI response too large", { requestId, responseLength });
      return clientError(502, "invalid_image", "Der Bilddienst hat eine zu grosse Datei geliefert.");
    }

    const data = await response.json().catch(() => null) as (OpenAIError & OpenAIImageResponse) | null;
    if (!response.ok) {
      const code = data?.error?.code || `openai_${response.status}`;
      const moderationStage = data?.error?.moderation_details?.moderation_stage;
      const parameter = data?.error?.param;
      console.error("CAPPATEX OpenAI image request failed", {
        requestId,
        status: response.status,
        code,
        param: typeof parameter === "string" && OPENAI_LOGGABLE_PARAMETERS.has(parameter) ? parameter : undefined,
        moderationStage,
        categories: data?.error?.moderation_details?.categories,
      });
      if (code === "moderation_blocked") return clientError(400, code, moderationMessage(moderationStage), { moderationStage });
      if (response.status === 401) return clientError(503, "openai_auth_error", "Der Bildgenerator ist serverseitig nicht korrekt autorisiert.");
      const billingError = OPENAI_BILLING_ERRORS.get(code);
      if (billingError) return clientError(503, "openai_billing_unavailable", access.pilotOwner
        ? `${billingError} Es wurde kein automatischer weiterer Versuch gestartet.`
        : "Der Bildgenerator ist derzeit nicht verfügbar. Bitte wende dich bei Bedarf an den Shopbetreiber.");
      if (code === "invalid_value") return clientError(503, "openai_configuration_error", access.pilotOwner
        ? "Der Bilddienst hat die serverseitige Bildkonfiguration abgelehnt. Bitte prüfe Modell und Bildparameter. Es wurde kein automatischer weiterer Versuch gestartet."
        : "Der Bildgenerator ist derzeit nicht verfügbar. Bitte wende dich bei Bedarf an den Shopbetreiber.");
      if (response.status === 429) return clientError(429, "rate_limited", "Der Bildgenerator ist gerade ausgelastet. Bitte warte kurz und versuche es erneut.");
      return clientError(502, "image_service_error", "Der Bilddienst ist gerade nicht erreichbar. Bitte versuche es später erneut.");
    }

    const encoded = data?.data?.[0]?.b64_json;
    if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded) || encoded.length > MAX_IMAGE_BYTES * 1.4) {
      console.error("CAPPATEX OpenAI response contained no valid image", { requestId });
      return clientError(502, "invalid_image", "Der Bilddienst hat kein gültiges Motiv geliefert.");
    }

    const bytes = decodeBase64(encoded);
    const size = pngSize(bytes);
    const [expectedWidth, expectedHeight] = CANVASES[canvas].split("x").map(Number);
    if (size.width !== expectedWidth || size.height !== expectedHeight) throw new Error("unexpected_image_size");
    const hash = await sha256(bytes);
    const artworkKey = `cappatex/${designId}/${hash}.png`;
    await env.BUCKET.put(artworkKey, bytes, { httpMetadata: { contentType: "image/png" } });
    const preview = createArtworkPreview(bytes);
    const previewHash = await sha256(preview.bytes);
    const previewKey = `cappatex/${designId}/${hash}.preview-v1.png`;
    await env.BUCKET.put(previewKey, preview.bytes, { httpMetadata: { contentType: "image/png" } });
    const saved = await env.DB.prepare(
      "UPDATE cappatex_designs SET artwork_key = ?, artwork_sha256 = ?, artwork_width = ?, artwork_height = ?, preview_key = ?, preview_sha256 = ?, preview_format = 'png', status = 'preview_ready', updated_at = ? WHERE id = ? AND email = ? AND status = 'generating'",
    ).bind(artworkKey, hash, size.width, size.height, previewKey, previewHash, Date.now(), designId, user.email).run();
    if (saved.meta?.changes !== 1) throw new Error("artwork_save_not_confirmed");
    completed = true;
    await readyArtworkCreation(creation.id,user.email,previewKey).catch(()=>{});
    const tokenBalance = await getTokenBalance(user.email).catch(() => null);

    return Response.json({
      image: `/api/cappatex/artwork/${designId}`,
      width: size.width, height: size.height, sha256: hash,
      previewWidth: preview.width, previewHeight: preview.height,
      designId,
      creationId:creation.id,
      format: "png",
      quality: "high",
      tokenBalance,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("CAPPATEX image generation exception", { type: error instanceof Error ? error.name : "unknown" });
    return clientError(timedOut ? 504 : 500, timedOut ? "generation_timeout" : "generation_failed", timedOut
      ? "Die Generierung dauert länger als erwartet. Es wurde kein automatischer weiterer Versuch gestartet."
      : "Das Motiv konnte nicht vollständig gespeichert werden. Bitte prüfe den Vorgang vor einem weiteren Versuch.");
  } finally {
    if (!completed) {
      await failCreation(creation.id,user.email).catch(()=>{});
      try {
        await env.DB.batch([
          env.DB.prepare(REFUND_DESIGN)
            .bind(user.email, designId),
          env.DB.prepare(LOG_REFUND)
            .bind(user.email, designId, Date.now(), designId),
          env.DB.prepare(FINISH_FAILURE)
            .bind(outcomeKnown ? "generation_failed" : "generation_uncertain", Date.now(), designId),
        ]);
      } catch { /* A pending row keeps further paid calls blocked until storage is recovered. */ }
    }
  }
}
