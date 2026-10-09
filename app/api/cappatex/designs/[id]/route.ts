import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { accountCapabilities, type AccountSummary } from "../../../../../db/account";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const unavailable = (status: number, error: string) => Response.json({ error }, { status, headers });

/** Restore an owned, already saved design without generating or modifying anything. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return unavailable(401, "Anmeldung erforderlich");
  const { id } = await context.params;
  if (!/^CPX-[A-Z0-9]{12}$/.test(id)) return unavailable(404, "Nicht gefunden");
  try {
    const row = await env.DB.prepare(
      "SELECT artwork_key, artwork_sha256, artwork_width, artwork_height, preview_key, preview_sha256, style FROM cappatex_designs WHERE id = ? AND email = ? AND status = 'preview_ready'",
    ).bind(id, user.email).first<{
      artwork_key: string; artwork_sha256: string; artwork_width: number; artwork_height: number;
      preview_key: string; preview_sha256: string; style: string;
    }>();
    if (!row?.artwork_key || !row.artwork_sha256 || !row.preview_key || !row.preview_sha256
      || !Number.isSafeInteger(row.artwork_width) || row.artwork_width <= 0
      || !Number.isSafeInteger(row.artwork_height) || row.artwork_height <= 0) {
      return unavailable(404, "Nicht gefunden");
    }
    const source = row.style === "Upload" ? "upload" : "generated";
    let canDownloadOriginal = source === "upload";
    if (!canDownloadOriginal) {
      // Read the same plan policy as the artwork route without ensureAccount's writes.
      const account = await env.DB.prepare(
        "SELECT email, plan, subscription_status AS subscriptionStatus FROM accounts WHERE email = ?",
      ).bind(user.email).first<Pick<AccountSummary, "email" | "plan" | "subscriptionStatus">>();
      canDownloadOriginal = accountCapabilities(account || {
        email: user.email, plan: "free", subscriptionStatus: "inactive",
      }).canDownloadHd;
    }
    return Response.json({
      designId: id, previewUrl: `/api/cappatex/artwork/${id}`,
      width: row.artwork_width, height: row.artwork_height,
      // Both existing upload/generation paths persist this deterministic preview format.
      previewWidth: Math.ceil(row.artwork_width / 4), previewHeight: Math.ceil(row.artwork_height / 4),
      source, canDownloadOriginal,
    }, { headers });
  } catch {
    return unavailable(503, "Motiv vorübergehend nicht verfügbar");
  }
}
