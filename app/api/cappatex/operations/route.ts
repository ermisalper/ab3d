import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { generationAccess } from "../../../cappatex-generation-access";
import { CAPPATEX_PRINT_PROFILES } from "../../../cappatex-profiles";
import { CAPPATEX_SHIPPING_RELEASES } from "../../../cappatex-shipping-releases";
import { CAPPATEX_DESIGN_PROFILES } from "../../../cappatex-design-profiles";
import { TOKEN_PACK_RELEASES } from "../../../token-pack-releases";
import { cappatexReadiness } from "../../../cappatex-readiness";
import { fulfillmentSummary, type FulfillmentRow } from "../../../cappatex-operations";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

/** Read-only: uncertain orders must be reconciled by a person, never retried here. */
export async function GET() {
  const user = await getChatGPTUser();
  if (!user || !generationAccess(user.email, "owner", process.env.CAPPATEX_GENERATION_ALLOWED_EMAILS).allowed)
    return Response.json({ error: "Keine Berechtigung." }, { status: 403, headers });
  try {
    const rows = await env.DB.prepare("SELECT id,external_id,state,printify_order_id,error_code,created_at,updated_at FROM cappatex_fulfillments ORDER BY updated_at DESC,id DESC LIMIT 50")
      .all<FulfillmentRow>();
    const counts = await env.DB.prepare("SELECT state,COUNT(*) AS total FROM cappatex_fulfillments GROUP BY state").all<{ state: string; total: number }>();
    const checkedAt = Date.now();
    return Response.json({ checkedAt, configuration: {
      checkoutEnabled: process.env.CAPPATEX_CHECKOUT_ENABLED === "true",
      fulfillmentEnabled: process.env.CAPPATEX_FULFILLMENT_ENABLED === "true",
      automaticProductionRequested: process.env.CAPPATEX_AUTO_PRODUCTION_ENABLED === "true",
      registeredProfiles: CAPPATEX_PRINT_PROFILES.length,
      registeredShippingReleases: CAPPATEX_SHIPPING_RELEASES.length,
      tokenPurchasesRequested: process.env.TOKEN_PURCHASES_ENABLED === "true",
      registeredTokenPackReleases: TOKEN_PACK_RELEASES.length,
      webhookConfigured: Boolean(process.env.SHOPIFY_WEBHOOK_SECRET?.trim() && process.env.SHOPIFY_STORE_DOMAIN?.trim()),
      productionWritePermissions: "unverified",
    }, readiness: cappatexReadiness({ designProfiles: CAPPATEX_DESIGN_PROFILES, salesProfiles: CAPPATEX_PRINT_PROFILES,
      shippingReleases: CAPPATEX_SHIPPING_RELEASES, tokenReleases: TOKEN_PACK_RELEASES }, checkedAt),
    counts: counts.results, orders: rows.results.map(row => fulfillmentSummary(row, checkedAt)), limit: 50 }, { headers });
  } catch {
    return Response.json({ error: "Die Betreiberübersicht ist vorübergehend nicht verfügbar." }, { status: 503, headers });
  }
}
