import { getChatGPTUser } from "../../chatgpt-auth";
import { shopifyStorefrontConfig } from "../../shopify-catalog";
import { TOKEN_PACKS, TOKEN_PURCHASE_UNAVAILABLE, type TokenPurchaseCatalogue } from "../../token-packs";
import { tokenPurchaseRelease, tokenPurchasesEnabled } from "../../token-purchase";
import { tokenPurchaseHistory } from "../../../db/token-purchases";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ code: "sign_in_required", error: "Bitte melde dich an." }, { status: 401, headers });
  try {
    const { domain } = shopifyStorefrontConfig(), enabled = tokenPurchasesEnabled(domain);
    const result: TokenPurchaseCatalogue = {
      packs: TOKEN_PACKS.map(pack => ({ ...pack, available: enabled && Boolean(tokenPurchaseRelease(pack.id, domain)) })),
      enabled, message: enabled ? "Einmal kaufen. Nach bestätigter Zahlung werden die Tokens deinem Konto gutgeschrieben." : TOKEN_PURCHASE_UNAVAILABLE,
      purchases: await tokenPurchaseHistory(user.email),
    };
    return Response.json(result, { headers });
  } catch {
    return Response.json({ code: "purchase_history_unavailable", error: "Deine Tokenkäufe konnten gerade nicht geladen werden." }, { status: 503, headers });
  }
}
