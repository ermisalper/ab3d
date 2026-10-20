import { getChatGPTUser } from "../../../chatgpt-auth";
import { ensureAccount } from "../../../../db/account";
import { ownedTokenPurchase, unresolvedTokenPurchase, reserveTokenPurchase, completeTokenCheckout, uncertainTokenCheckout, type TokenPurchaseRow } from "../../../../db/token-purchases";
import { shopifyStorefrontConfig } from "../../../shopify-catalog";
import { TOKEN_PURCHASE_UNAVAILABLE, tokenPack } from "../../../token-packs";
import { tokenPurchaseInput, tokenRequestBytes, tokenPurchasesEnabled, tokenPurchaseRelease, tokenPurchaseHash, tokenSnapshot } from "../../../token-purchase";
import { verifyTokenVariant, createTokenCart, safeTokenCheckoutUrl } from "../../../token-purchase-shopify";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const fail = (status: number, code: string, error: string) => Response.json({ code, error }, { status, headers });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail(403, "invalid_origin", "Unzulässige Anfrage.");
  const user = await getChatGPTUser();
  if (!user) return fail(401, "sign_in_required", "Bitte melde dich an.");
  let input: ReturnType<typeof tokenPurchaseInput>;
  try { input = tokenPurchaseInput(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await tokenRequestBytes(request, 4096)))); }
  catch (error) { return fail(error instanceof Error && error.message === "request_too_large" ? 413 : 400, "invalid_request", "Bitte wähle ein Tokenpaket, dein Land und bestätige die Bedingungen."); }
  let reservedId: string | null = null;
  try {
    const { domain } = shopifyStorefrontConfig(), release = tokenPurchaseRelease(input.packId, domain, input.country), pack = tokenPack(input.packId)!;
    // Deliberately precedes every database mutation and every Shopify request.
    if (!tokenPurchasesEnabled(domain) || !release) return fail(503, "not_ready", TOKEN_PURCHASE_UNAVAILABLE);
    const requestHash = await tokenPurchaseHash(JSON.stringify(input));
    const repeated = (row: TokenPurchaseRow | null) => {
      if (!row) return null;
      if (row.request_sha256 !== requestHash) return fail(409, "request_conflict", "Diese Kaufanfrage gehört zu einer anderen Auswahl.");
      const url = safeTokenCheckoutUrl(row.checkout_url, domain);
      if (row.status === "checkout_created" && url) return Response.json({ purchaseId: row.id, checkoutUrl: url }, { headers });
      if (row.status === "credited") return fail(409, "already_credited", "Die Tokens für diese Zahlung wurden bereits gutgeschrieben.");
      return fail(409, "checkout_uncertain", "Dieser Checkout wird noch geprüft. Bitte starte keine zweite Zahlung; der bestehende Kauf bleibt erhalten.");
    };
    const existing = repeated(await ownedTokenPurchase(user.email, input.requestId));
    if (existing) return existing;
    if (await unresolvedTokenPurchase(user.email)) return fail(409, "checkout_uncertain", "Eine frühere Kaufanfrage wird noch geprüft. Bitte starte keine zweite Zahlung und kontaktiere uns.");
    const id = `TP-${crypto.randomUUID().replaceAll("-", "")}`, snapshot = tokenSnapshot(id, user.email, pack, input, release);
    // A read-only query verifies exact SKU, CHF price and digital single-purchase capability.
    await verifyTokenVariant(snapshot);
    const json = JSON.stringify(snapshot), hash = await tokenPurchaseHash(json);
    await ensureAccount(user.email, user.fullName);
    if (!await reserveTokenPurchase(snapshot, json, hash, input.requestId, requestHash)) {
      return repeated(await ownedTokenPurchase(user.email, input.requestId)) || fail(409, "checkout_uncertain", "Bitte prüfe den bestehenden Kauf erneut.");
    }
    reservedId = id;
    const cart = await createTokenCart(snapshot, hash);
    await completeTokenCheckout(id, cart.cartId, cart.checkoutUrl);
    return Response.json({ purchaseId: id, checkoutUrl: cart.checkoutUrl }, { headers });
  } catch {
    if (reservedId) {
      // Never retry cartCreate after a timeout, unknown provider result or failed local commit.
      try { await uncertainTokenCheckout(reservedId); } catch { /* Reservation itself still blocks replay. */ }
      return fail(409, "checkout_uncertain", "Der Checkout konnte nicht sicher bestätigt werden. Bitte starte keine zweite Zahlung und kontaktiere uns.");
    }
    return fail(503, "not_ready", "Das Tokenpaket konnte gerade nicht sicher geprüft werden. Es wurde kein Checkout gestartet.");
  }
}
