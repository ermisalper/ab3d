import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountCapabilities, ensureAccount, hasUnlimitedTokens, isOwnerEmail } from "../../../db/account";
import { generationAccess } from "../../cappatex-generation-access";
import { readRequestJson, RequestJsonError } from "../../request-json";

const PLANS = new Set(["3d-studio", "cappatex", "complete"]);
const requestHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const requestReply = (body: unknown, status = 200) => Response.json(body, { status, headers: requestHeaders });

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Bitte zuerst anmelden." }, { status: 401 });

  try {
    const account = await ensureAccount(user.email, user.fullName);
    const generation = generationAccess(
      user.email,
      process.env.CAPPATEX_GENERATION_AUDIENCE,
      process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS,
    );
    return Response.json({
      account: {
        ...account,
        displayName: account.displayName || user.displayName,
        unlimited: hasUnlimitedTokens(user.email),
        capabilities: accountCapabilities(account),
        isOwner: isOwnerEmail(user.email),
        cappatexGeneration: {
          enabled: generation.allowed
            && process.env.CAPPATEX_GENERATION_ENABLED === "true"
            && Boolean(process.env.OPENAI_API_KEY?.trim()),
          pilotOwner: generation.allowed && generation.pilotOwner,
        },
        cappatexUpload: { enabled: generation.allowed && process.env.CAPPATEX_UPLOAD_ENABLED === "true" },
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Das Token-Konto ist momentan nicht erreichbar." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return requestReply({ error: "Unzulässige Anfrage." }, 403);
  }
  const user = await getChatGPTUser();
  if (!user) return requestReply({ error: "Bitte zuerst anmelden." }, 401);

  let body: unknown;
  try { body = await readRequestJson(request, 1_000); }
  catch (error) {
    return requestReply({ error: error instanceof RequestJsonError && error.status === 413
      ? "Die Abo-Anfrage ist zu gross." : "Bitte sende eine gültige Abo-Anfrage." }, error instanceof RequestJsonError ? error.status : 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).some(key => key !== "plan") || !("plan" in body)
    || typeof body.plan !== "string" || !PLANS.has(body.plan)) {
    return requestReply({ error: "Ungültiges Abonnement." }, 400);
  }
  const plan = body.plan;

  try {
    await ensureAccount(user.email, user.fullName);
    const now = Date.now();
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE accounts SET requested_plan = ?,
         subscription_status = CASE WHEN subscription_status IN ('inactive', 'pending') THEN 'pending' ELSE subscription_status END,
         updated_at = ? WHERE email = ?`,
      ).bind(plan, now, user.email),
      env.DB.prepare(
        `INSERT INTO subscription_requests (email, plan, status, created_at)
         SELECT ?, ?, 'pending', ? WHERE NOT EXISTS
         (SELECT 1 FROM subscription_requests WHERE email = ? AND plan = ? AND status = 'pending')`,
      ).bind(user.email, plan, now, user.email, plan),
    ]);
    if (!Array.isArray(results) || results.length !== 2 || results.some(result => result.success !== true)
      || results[0].meta?.changes !== 1 || ![0, 1].includes(results[1].meta?.changes)) {
      return requestReply({ error: "Die Speicherung ist noch nicht bestätigt. Bitte prüfe deinen Kontostand vor einer erneuten Anfrage." }, 503);
    }
    return requestReply({
      ok: true,
      request: { plan, status: "pending" },
      message: "Deine Abo-Anfrage wurde gespeichert. AB3D meldet sich für die Zahlungsfreigabe.",
    });
  } catch {
    return requestReply({ error: "Die Abo-Anfrage konnte nicht bestätigt werden. Bitte prüfe deinen Kontostand; es wird nichts automatisch erneut gesendet." }, 503);
  }
}
