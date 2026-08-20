import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Bitte zuerst anmelden." }, { status: 401 });
  const [legacy, paid, openCheckouts] = await Promise.all([
    env.DB.prepare(
      `SELECT id, status, total_cents AS totalCents, currency, items_json AS itemsJson,
              created_at AS createdAt, 'legacy' AS source
       FROM orders WHERE email = ? ORDER BY created_at DESC LIMIT 10`,
    ).bind(user.email).all(),
    env.DB.prepare(
      `SELECT order_id AS id, financial_status AS status, total_cents AS totalCents,
              currency, items_json AS itemsJson, created_at AS createdAt, 'shopify' AS source
       FROM shopify_orders WHERE customer_email = ? ORDER BY created_at DESC LIMIT 20`,
    ).bind(user.email.toLowerCase()).all(),
    env.DB.prepare(
      `SELECT id, status, estimated_total_cents AS totalCents, currency,
              items_json AS itemsJson, created_at AS createdAt, 'checkout' AS source
       FROM checkout_sessions
       WHERE account_email = ? AND status != 'paid'
       ORDER BY created_at DESC LIMIT 10`,
    ).bind(user.email).all(),
  ]);
  const orders = [...legacy.results, ...paid.results, ...openCheckouts.results]
    .sort((left, right) => Number((right as { createdAt?: number }).createdAt || 0) - Number((left as { createdAt?: number }).createdAt || 0))
    .slice(0, 25);
  return Response.json({ orders }, { headers: { "Cache-Control": "private, no-store" } });
}
