/** Shared display catalogue. Purchase prices and credit amounts always come from this server-owned list. */
export const TOKEN_PACKS = [
  { id: "tokens-5", name: "Starter", tokens: 5, priceCents: 500, currency: "CHF" },
  { id: "tokens-15", name: "Creator", tokens: 15, priceCents: 1200, currency: "CHF" },
  { id: "tokens-40", name: "Studio", tokens: 40, priceCents: 2800, currency: "CHF" },
] as const;

export type TokenPack = typeof TOKEN_PACKS[number];
export type TokenPackId = TokenPack["id"];
export const TOKEN_TERMS_VERSION = "tokens-2026-10-20-v1";
export const TOKEN_PURCHASE_UNAVAILABLE = "Der Tokenkauf ist vorbereitet. Die Bezahlung wird nach der Shopify-Freigabe verfügbar.";

export function tokenPack(id: unknown): TokenPack | null {
  return TOKEN_PACKS.find(pack => pack.id === id) || null;
}

export type TokenPurchaseHistoryItem = {
  id: string; requestId: string; packId: TokenPackId; tokens: number; priceCents: number; currency: "CHF";
  status: "creating_checkout" | "checkout_created" | "checkout_uncertain" | "credited";
  createdAt: number;
};

export type TokenPurchaseCatalogue = {
  packs: Array<TokenPack & { available: boolean }>;
  enabled: boolean;
  message: string;
  purchases: TokenPurchaseHistoryItem[];
};
