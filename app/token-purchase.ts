import { LEGAL_VERSION } from "./legal-version";
import { TOKEN_PACK_RELEASES, type TokenPackRelease } from "./token-pack-releases";
import { TOKEN_TERMS_VERSION, tokenPack, type TokenPack, type TokenPackId } from "./token-packs";

export const TOKEN_PURCHASE_ID = /^TP-[a-f0-9]{32}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const TOKEN_ATTRIBUTES = ["AB3D_TOKEN_PURCHASE_ID", "AB3D_TOKEN_SNAPSHOT_SHA256", "AB3D_TOKEN_PACK_ID"] as const;
export type TokenPurchaseInput = { packId: TokenPackId; country: "CH" | "LI"; termsAccepted: true; requestId: string };
export type TokenPurchaseSnapshot = {
  schemaVersion: 1; id: string; email: string; packId: TokenPackId; tokens: number;
  priceCents: number; currency: "CHF"; country: "CH" | "LI"; legalVersion: string;
  tokenTermsVersion: string; consentAt: number; release: TokenPackRelease;
};

export function tokenPurchaseInput(body: unknown): TokenPurchaseInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_request");
  const value = body as Record<string, unknown>, pack = tokenPack(value.packId);
  if (!pack || !["CH", "LI"].includes(value.country as string) || value.termsAccepted !== true
    || typeof value.requestId !== "string" || !UUID.test(value.requestId)) throw new Error("invalid_request");
  // Ignore untrusted prices, email addresses and credit amounts. Never persist them.
  return { packId: pack.id, country: value.country as "CH" | "LI", termsAccepted: true, requestId: value.requestId.toLowerCase() };
}

export async function tokenPurchaseHash(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function validRelease(release: TokenPackRelease | undefined, packId: unknown, domain: string, country?: "CH" | "LI", verifiedBefore = Date.now()) {
  const verifiedDate = (value: unknown) => typeof value === "string" && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && Date.parse(value) <= verifiedBefore;
  return Boolean(release && typeof release === "object" && release.packId === packId && release.shopDomain === domain
    && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)
    && typeof release.variantId === "string" && /^gid:\/\/shopify\/ProductVariant\/[1-9]\d*$/.test(release.variantId)
    && typeof release.sku === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$/.test(release.sku)
    && typeof release.version === "string" && /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(release.version)
    && release.digital === true && release.taxInclusive === true
    && Array.isArray(release.countries) && release.countries.length > 0 && new Set(release.countries).size === release.countries.length
    && release.countries.every(value => ["CH", "LI"].includes(value))
    && (!country || release.countries.includes(country))
    && verifiedDate(release.checkoutVerifiedAt) && verifiedDate(release.webhookReceiptVerifiedAt));
}

export function tokenPurchaseRelease(packId: unknown, domain: string, country?: "CH" | "LI"): TokenPackRelease | null {
  if (!tokenPack(packId) || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) return null;
  const matches = TOKEN_PACK_RELEASES.filter(release => release.packId === packId && release.shopDomain === domain);
  if (matches.length !== 1) return null;
  const release = matches[0];
  if (!validRelease(release, packId, domain, country)) return null;
  // A digital variant/SKU cannot represent two packs or stores in the same deployment.
  if (TOKEN_PACK_RELEASES.some(other => other !== release && other.shopDomain === domain
    && (other.variantId === release.variantId || other.sku === release.sku))) return null;
  return release;
}

export function tokenPurchasesEnabled(domain: string) {
  return process.env.TOKEN_PURCHASES_ENABLED === "true" && Boolean(process.env.SHOPIFY_WEBHOOK_SECRET?.trim())
    && ["tokens-5", "tokens-15", "tokens-40"].some(id => tokenPurchaseRelease(id, domain));
}

export function tokenSnapshot(id: string, email: string, pack: TokenPack, input: TokenPurchaseInput, release: TokenPackRelease): TokenPurchaseSnapshot {
  return { schemaVersion: 1, id, email, packId: pack.id, tokens: pack.tokens, priceCents: pack.priceCents,
    currency: "CHF", country: input.country, legalVersion: LEGAL_VERSION, tokenTermsVersion: TOKEN_TERMS_VERSION,
    consentAt: Date.now(), release: JSON.parse(JSON.stringify(release)) };
}

export async function parseTokenSnapshot(json: string, hash: string, expected: { id: string; email: string; domain: string }) {
  if (typeof json !== "string" || json.length > 8000 || !/^[a-f0-9]{64}$/.test(hash) || await tokenPurchaseHash(json) !== hash) return null;
  try {
    const snapshot = JSON.parse(json) as TokenPurchaseSnapshot;
    if (snapshot.schemaVersion !== 1 || !TOKEN_PURCHASE_ID.test(snapshot.id) || snapshot.id !== expected.id || snapshot.email !== expected.email
      || !tokenPack(snapshot.packId) || !Number.isSafeInteger(snapshot.tokens) || snapshot.tokens < 1 || snapshot.tokens > 10_000
      || !Number.isSafeInteger(snapshot.priceCents) || snapshot.priceCents < 1 || snapshot.priceCents > 1_000_000 || snapshot.currency !== "CHF"
      || !["CH", "LI"].includes(snapshot.country) || typeof snapshot.legalVersion !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(snapshot.legalVersion)
      || typeof snapshot.tokenTermsVersion !== "string" || !/^tokens-20\d{2}-\d{2}-\d{2}-v[1-9]\d{0,3}$/.test(snapshot.tokenTermsVersion) || !Number.isSafeInteger(snapshot.consentAt)
      || snapshot.consentAt < 0 || snapshot.consentAt > Date.now()) return null;
    // This is a server-issued, immutable checkout. A later catalogue/price/legal change or
    // disabling NEW checkouts cannot alter what this customer already agreed to pay for.
    if (!validRelease(snapshot.release, snapshot.packId, expected.domain, snapshot.country, snapshot.consentAt)) return null;
    return snapshot;
  } catch { return null; }
}

export async function tokenRequestBytes(request: Request, limit: number) {
  if (!request.body || Number(request.headers.get("content-length") || 0) > limit) throw new Error("request_too_large");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new Error("request_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

/** Decimal parsing without floating point rounding. */
export function tokenMoneyCents(value: unknown) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2}0*)?$/.test(value) || value.length > 30) return null;
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}

export function tokenAttributes(snapshot: TokenPurchaseSnapshot, hash: string) {
  return [{ key: TOKEN_ATTRIBUTES[0], value: snapshot.id }, { key: TOKEN_ATTRIBUTES[1], value: hash }, { key: TOKEN_ATTRIBUTES[2], value: snapshot.packId }];
}
