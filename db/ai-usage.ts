import { env } from "cloudflare:workers";

export type AiUsageService = "meshy" | "cappatex" | "assistant" | "planner";
export type AiUsageAdmission = { allowed: true; id: string } | {
  allowed: false; status: 429 | 503; code: string; error: string; retryAfterSeconds?: number;
};

const TEN_MINUTES = 600_000, DAY = 86_400_000;
const SERVICES = new Set<AiUsageService>(["meshy", "cappatex", "assistant", "planner"]);
const unavailable = (): AiUsageAdmission => ({ allowed: false, status: 503, code: "ai_usage_unavailable",
  error: "Die KI-Nutzung kann momentan nicht sicher geprüft werden. Bitte versuche es später erneut." });

function configuredLimit(name: string, fallback: number): number | null {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^(0|[1-9]\d{0,5})$/.test(value)) return null;
  const parsed = Number(value);
  return parsed <= 100_000 ? parsed : null;
}

type UsageCounts = { accountBurst: number; accountDaily: number; providerDaily: number; oldestBurst: number | null };

/** All provider attempts share these limits, including operator and unlimited-token accounts.
 * The admission is deliberately retained after provider errors or unknown outcomes. It is
 * a request-count ceiling, not a currency budget, and does not replace the token balance check.
 */
export async function reserveAiUsage(email: string, service: AiUsageService, now = Date.now()): Promise<AiUsageAdmission> {
  const burstLimit = configuredLimit("AI_ACCOUNT_10_MINUTE_LIMIT", 12);
  const accountLimit = configuredLimit("AI_ACCOUNT_DAILY_LIMIT", 30);
  const providerLimit = configuredLimit("AI_PROVIDER_DAILY_LIMIT", 100);
  if (burstLimit === null || accountLimit === null || providerLimit === null
    || typeof email !== "string" || !email.trim() || email.length > 320 || !SERVICES.has(service)
    || !Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - DAY) return unavailable();

  try {
    const normalized = email.trim().toLowerCase();
    const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
    const accountHash = Array.from(new Uint8Array(hashBytes), byte => byte.toString(16).padStart(2, "0")).join("");
    const dayStart = Math.floor(now / DAY) * DAY, dayEnd = dayStart + DAY, burstStart = now - TEN_MINUTES;
    const id = crypto.randomUUID();
    // D1 serializes this single SQLite write. Never split the checks from the INSERT:
    // independently checked requests could both consume the last available admission.
    const result = await env.DB.prepare(`INSERT INTO ai_usage_admissions(id,account_hash,service,created_at)
      SELECT ?,?,?,? WHERE
        (SELECT COUNT(*) FROM ai_usage_admissions WHERE account_hash=? AND created_at>?) < ?
        AND (SELECT COUNT(*) FROM ai_usage_admissions WHERE account_hash=? AND created_at>=? AND created_at<?) < ?
        AND (SELECT COUNT(*) FROM ai_usage_admissions WHERE created_at>=? AND created_at<?) < ?`)
      .bind(id, accountHash, service, now, accountHash, burstStart, burstLimit,
        accountHash, dayStart, dayEnd, accountLimit, dayStart, dayEnd, providerLimit).run();
    if (result.success !== true) return unavailable();
    if (result.meta.changes === 1) return { allowed: true, id };
    if (result.meta.changes !== 0) return unavailable();

    // This read only explains a denial. It cannot grant access or remove a reservation.
    const counts = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM ai_usage_admissions WHERE account_hash=? AND created_at>?) AS accountBurst,
      (SELECT COUNT(*) FROM ai_usage_admissions WHERE account_hash=? AND created_at>=? AND created_at<?) AS accountDaily,
      (SELECT COUNT(*) FROM ai_usage_admissions WHERE created_at>=? AND created_at<?) AS providerDaily,
      (SELECT MIN(created_at) FROM ai_usage_admissions WHERE account_hash=? AND created_at>?) AS oldestBurst`)
      .bind(accountHash, burstStart, accountHash, dayStart, dayEnd, dayStart, dayEnd, accountHash, burstStart)
      .first<UsageCounts>();
    if (!counts || ![counts.accountBurst, counts.accountDaily, counts.providerDaily].every(value => Number.isSafeInteger(value) && value >= 0)
      || (counts.oldestBurst !== null && (!Number.isSafeInteger(counts.oldestBurst) || counts.oldestBurst < 0))) return unavailable();

    const nextDay = Math.max(1, Math.ceil((dayEnd - now) / 1_000));
    if (counts.providerDaily >= providerLimit) return { allowed: false, status: 429, code: "ai_usage_provider_daily_limit",
      error: "Das gemeinsame Tageslimit für KI-Anfragen ist erreicht. Bitte versuche es später erneut.", retryAfterSeconds: nextDay };
    if (counts.accountDaily >= accountLimit) return { allowed: false, status: 429, code: "ai_usage_account_daily_limit",
      error: "Dein tägliches KI-Limit ist erreicht. Bitte versuche es später erneut.", retryAfterSeconds: nextDay };
    const retryAfterSeconds = counts.oldestBurst === null ? 600
      : Math.max(1, Math.min(600, Math.ceil((counts.oldestBurst + TEN_MINUTES - now) / 1_000)));
    return { allowed: false, status: 429, code: "ai_usage_account_rate_limit",
      error: "Zu viele KI-Anfragen in kurzer Zeit. Bitte warte kurz und versuche es erneut.", retryAfterSeconds };
  } catch {
    // Missing migration, unavailable binding, or an uncertain write must fail closed.
    // Database errors can contain internal details; do not expose or log them here.
    return unavailable();
  }
}
