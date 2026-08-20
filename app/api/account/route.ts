import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { accountCapabilities, ensureAccount, hasUnlimitedTokens, isOwnerEmail } from "../../../db/account";

const PLANS = new Set(["3d-studio", "cappatex", "complete"]);

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Bitte zuerst anmelden." }, { status: 401 });

  try {
    const account = await ensureAccount(user.email, user.fullName);
    return Response.json({
      account: {
        ...account,
        displayName: account.displayName || user.displayName,
        unlimited: hasUnlimitedTokens(user.email),
        capabilities: accountCapabilities(account),
        isOwner: isOwnerEmail(user.email),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Das Token-Konto ist momentan nicht erreichbar." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Bitte zuerst anmelden." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { plan?: string };
  if (!body.plan || !PLANS.has(body.plan)) {
    return Response.json({ error: "Ungültiges Abonnement." }, { status: 400 });
  }

  try {
    await ensureAccount(user.email, user.fullName);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE accounts SET requested_plan = ?, subscription_status = 'pending', updated_at = ? WHERE email = ?",
      ).bind(body.plan, now, user.email),
      env.DB.prepare(
        "INSERT INTO subscription_requests (email, plan, status, created_at) VALUES (?, ?, 'pending', ?)",
      ).bind(user.email, body.plan, now),
    ]);
    return Response.json({
      ok: true,
      message: "Deine Abo-Anfrage wurde gespeichert. AB3D meldet sich für die Zahlungsfreigabe.",
    });
  } catch {
    return Response.json({ error: "Die Abo-Anfrage konnte nicht gespeichert werden." }, { status: 500 });
  }
}
