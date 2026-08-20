import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountCapabilities, chargeTokens, ensureAccount, hasUnlimitedTokens } from "../../../db/account";

const PRODUCTS = new Set(["tshirt", "socks", "poster", "notebook", "underwear"]);
const STYLES = new Set(["Minimal", "Illustrativ", "Retro", "Streetwear"]);
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const MAX_REQUEST_BYTES = 4_000;
const MAX_IMAGE_BYTES = 12_000_000;
const OPENAI_TIMEOUT_MS = 150_000;

type OpenAIError = {
  error?: {
    code?: string;
    type?: string;
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

function buildProductionPrompt(product: string, style: string, prompt: string) {
  return [
    "Create exactly one original, professional, print-on-demand artwork.",
    `Product context: ${product}. Visual direction: ${style}.`,
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

async function callOpenAI(apiKey: string, prompt: string) {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "low",
        output_format: "webp",
        output_compression: 82,
        moderation: "low",
      }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
    lastResponse = response;
    if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 1) return response;

    const retryAfter = Number(response.headers.get("retry-after") || 0);
    const waitMs = Math.min(Math.max(retryAfter * 1_000, 750), 5_000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return lastResponse!;
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
    product?: unknown;
    style?: unknown;
    confirmGeneration?: unknown;
  } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const product = typeof body?.product === "string" ? body.product : "";
  const style = typeof body?.style === "string" ? body.style : "";

  if (prompt.length < 12 || prompt.length > 500) {
    return clientError(400, "invalid_prompt", "Bitte beschreibe dein Motiv mit 12 bis 500 Zeichen.");
  }
  if (!PRODUCTS.has(product) || !STYLES.has(style)) {
    return clientError(400, "invalid_configuration", "Bitte wähle ein gültiges Produkt und einen Bildstil.");
  }
  if (body?.confirmGeneration !== true) {
    return clientError(409, "confirmation_required", "Bitte bestätige die kostenpflichtige KI-Generierung.");
  }
  if (process.env.CAPPATEX_GENERATION_ENABLED !== "true") {
    return clientError(503, "generation_disabled", "Der Bildgenerator wartet noch auf die Freigabe des Shopbetreibers.");
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return clientError(503, "openai_not_configured", "Der Bildgenerator ist noch nicht vollständig eingerichtet.");
  }

  const productionPrompt = buildProductionPrompt(product, style, prompt);
  const designId = `CPX-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const createdAt = Date.now();
  try {
    const account = await ensureAccount(user.email, user.fullName);
    if (!accountCapabilities(account).canUseCappatex) {
      return clientError(403, "plan_required", "CAPPATEX ist im CAPPATEX- oder Complete-Abo enthalten.");
    }
    if (!hasUnlimitedTokens(user.email) && account.tokenBalance < 1) {
      return clientError(402, "insufficient_tokens", "Für eine CAPPATEX Motivvorschau brauchst du 1 Design-Token.");
    }
    await env.DB.prepare(
      `INSERT INTO cappatex_designs
        (id, email, prompt, production_prompt, style, product_key, preview_base64,
         preview_format, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', 'webp', 'generating', ?, ?)`,
    ).bind(designId, user.email, prompt, productionPrompt, style, product, createdAt, createdAt).run();
  } catch {
    return clientError(503, "design_storage_unavailable", "Der sichere Designspeicher ist noch nicht verfügbar. Es wurde keine kostenpflichtige Generierung gestartet.");
  }

  try {
    const response = await callOpenAI(apiKey, productionPrompt);
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
      console.error("CAPPATEX OpenAI image request failed", {
        requestId,
        status: response.status,
        code,
        moderationStage,
        categories: data?.error?.moderation_details?.categories,
      });
      if (code === "moderation_blocked") return clientError(400, code, moderationMessage(moderationStage), { moderationStage });
      if (response.status === 401) return clientError(503, "openai_auth_error", "Der Bildgenerator ist serverseitig nicht korrekt autorisiert.");
      if (response.status === 429) return clientError(429, "rate_limited", "Der Bildgenerator ist gerade ausgelastet. Bitte warte kurz und versuche es erneut.");
      return clientError(502, "image_service_error", "Der Bilddienst ist gerade nicht erreichbar. Bitte versuche es später erneut.");
    }

    const encoded = data?.data?.[0]?.b64_json;
    if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded) || encoded.length > MAX_IMAGE_BYTES * 1.4) {
      console.error("CAPPATEX OpenAI response contained no valid image", { requestId });
      return clientError(502, "invalid_image", "Der Bilddienst hat kein gültiges Motiv geliefert.");
    }

    await env.DB.prepare(
      "UPDATE cappatex_designs SET preview_base64 = ?, status = 'preview_ready', updated_at = ? WHERE id = ? AND email = ?",
    ).bind(encoded, Date.now(), designId, user.email).run();
    const tokenBalance = await chargeTokens(user.email, 1, "CAPPATEX Motivvorschau");

    return Response.json({
      image: `data:image/webp;base64,${encoded}`,
      designId,
      format: "webp",
      quality: "low",
      tokenBalance,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("CAPPATEX image generation exception", { type: error instanceof Error ? error.name : "unknown" });
    return clientError(timedOut ? 504 : 500, timedOut ? "generation_timeout" : "generation_failed", timedOut
      ? "Die Generierung dauert länger als erwartet. Es wurde kein automatischer weiterer Versuch gestartet."
      : "Die Generierung konnte nicht gestartet werden.");
  }
}
