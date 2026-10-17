import { CAPPATEX_SHIPPING_RELEASES } from "./cappatex-shipping-releases";
import { sha256 } from "./cappatex-artwork";
import { moneyCents, type CheckoutSnapshot } from "./cappatex-snapshot";

export type ShippingBasketItem = { profileId: string; profileVersion: string; shopifyVariantId: string; quantity: number };
export type ShippingRelease = {
  id: string; version: string; evidence: string[]; reviewedAt: string; validUntil: string;
  shopifyStoreDomain: string; printifyShopId: string;
  country: "CH" | "LI"; currency: "CHF"; printifyMethod: 1;
  service: { source: string | null; code: string | null; title: string }; amountCents: number;
  basket: ShippingBasketItem[];
};
export type ShippingReleaseBinding = { id: string; version: string; sha256: string };
type MoneyBag = { shop_money?: { amount?: string; currency_code?: string }; presentment_money?: { amount?: string; currency_code?: string } };
export type ShippingPaidOrder = {
  currency?: string; presentment_currency?: string;
  shipping_address?: { country_code?: string };
  shipping_lines?: Array<{ source?: string | null; code?: string | null; title?: string; is_removed?: boolean;
    price?: string; price_set?: MoneyBag; discounted_price?: string; discounted_price_set?: MoneyBag;
    current_discounted_price_set?: MoneyBag; discount_allocations?: Array<{ amount?: string; amount_set?: MoneyBag }> }>;
  total_shipping_price_set?: MoneyBag; current_shipping_price_set?: MoneyBag;
};

const text = (value: unknown, max = 160): value is string => typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= max;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Combine only identical identities, never calculate a shipping price or combine provider rates. */
export function normalizedShippingBasket(items: ShippingBasketItem[]) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error("invalid_shipping_basket");
  const grouped = new Map<string, ShippingBasketItem>();
  for (const item of items) {
    if (!item || !text(item.profileId) || !text(item.profileVersion) || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(item.shopifyVariantId)
      || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) throw new Error("invalid_shipping_basket");
    const key = JSON.stringify([item.profileId, item.profileVersion, item.shopifyVariantId]);
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      if (existing.quantity > 100) throw new Error("invalid_shipping_basket");
    } else grouped.set(key, { profileId: item.profileId, profileVersion: item.profileVersion, shopifyVariantId: item.shopifyVariantId, quantity: item.quantity });
  }
  return [...grouped.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, item]) => item);
}

export function snapshotShippingBasket(snapshot: Pick<CheckoutSnapshot, "profile" | "variant" | "quantity">): ShippingBasketItem {
  return { profileId: snapshot.profile.id, profileVersion: snapshot.profile.version,
    shopifyVariantId: snapshot.variant.shopifyVariantId, quantity: snapshot.quantity };
}

export function shippingReleaseIsCurrent(release: ShippingRelease, now = Date.now()) {
  try {
    return Boolean(text(release.id) && text(release.version) && Array.isArray(release.evidence) && release.evidence.length > 0
      && release.evidence.length <= 20 && release.evidence.every(ref => text(ref, 500))
      && Number.isFinite(Date.parse(release.reviewedAt)) && Date.parse(release.reviewedAt) <= now
      && Number.isFinite(Date.parse(release.validUntil)) && Date.parse(release.validUntil) > now
      && Date.parse(release.validUntil) > Date.parse(release.reviewedAt)
      && text(release.shopifyStoreDomain) && text(release.printifyShopId)
      && Boolean(process.env.SHOPIFY_STORE_DOMAIN?.trim()) && Boolean(process.env.PRINTIFY_SHOP_ID?.trim())
      && release.shopifyStoreDomain === process.env.SHOPIFY_STORE_DOMAIN?.trim().toLowerCase()
      && release.printifyShopId === process.env.PRINTIFY_SHOP_ID?.trim()
      && ["CH", "LI"].includes(release.country) && release.currency === "CHF" && release.printifyMethod === 1
      && Number.isSafeInteger(release.amountCents) && release.amountCents >= 0
      && release.service && (release.service.source === null || typeof release.service.source === "string")
      && (release.service.code === null || typeof release.service.code === "string") && text(release.service.title, 255)
      && same(release.basket, normalizedShippingBasket(release.basket)));
  } catch { return false; }
}

/** Ambiguous, expired or incomplete releases are never selected by best effort. */
export function shippingReleaseForBasket(items: ShippingBasketItem[], country: string | undefined) {
  try {
    const basket = normalizedShippingBasket(items);
    const matches = CAPPATEX_SHIPPING_RELEASES.filter(release => shippingReleaseIsCurrent(release) && release.country === country
      && same(release.basket, basket) && CAPPATEX_SHIPPING_RELEASES.filter(r => r.id === release.id && r.version === release.version).length === 1);
    return matches.length === 1 ? matches[0] : null;
  } catch { return null; }
}

/** Stable key order makes a change to service, evidence, amount or validity invalidate a saved snapshot. */
export async function shippingReleaseBinding(release: ShippingRelease): Promise<ShippingReleaseBinding> {
  const document = { id: release.id, version: release.version, evidence: release.evidence, reviewedAt: release.reviewedAt, validUntil: release.validUntil,
    shopifyStoreDomain: release.shopifyStoreDomain, printifyShopId: release.printifyShopId, country: release.country,
    currency: release.currency, printifyMethod: release.printifyMethod,
    service: { source: release.service.source, code: release.service.code, title: release.service.title }, amountCents: release.amountCents,
    basket: normalizedShippingBasket(release.basket) };
  return { id: release.id, version: release.version, sha256: await sha256(JSON.stringify(document)) };
}

export async function snapshotShippingReleaseIsCurrent(snapshot: CheckoutSnapshot) {
  if (!snapshot.shippingRelease) return false;
  const current = shippingReleaseForBasket([snapshotShippingBasket(snapshot)], snapshot.country);
  return Boolean(current && same(await shippingReleaseBinding(current), snapshot.shippingRelease));
}

function moneyBagMatches(bag: MoneyBag | undefined, amountCents: number) {
  return bag?.shop_money?.currency_code === "CHF" && moneyCents(bag.shop_money.amount) === amountCents
    && bag.presentment_money?.currency_code === "CHF" && moneyCents(bag.presentment_money.amount) === amountCents;
}

/** Strict no-discount pilot: original, discounted and current values must describe the same approved CHF service. */
export function paidShippingMatchesRelease(order: ShippingPaidOrder, release: ShippingRelease) {
  if (!order || typeof order !== "object" || !shippingReleaseIsCurrent(release) || order.currency !== "CHF" || order.presentment_currency !== "CHF"
    || order.shipping_address?.country_code !== release.country || !Array.isArray(order.shipping_lines) || order.shipping_lines.length !== 1) return false;
  const line = order.shipping_lines[0];
  if (!line || typeof line !== "object") return false;
  return line.is_removed === false && line.source === release.service.source && line.code === release.service.code && line.title === release.service.title
    && moneyCents(line.price) === release.amountCents && moneyCents(line.discounted_price) === release.amountCents
    && moneyBagMatches(line.price_set, release.amountCents) && moneyBagMatches(line.discounted_price_set, release.amountCents)
    && moneyBagMatches(line.current_discounted_price_set, release.amountCents)
    && moneyBagMatches(order.total_shipping_price_set, release.amountCents) && moneyBagMatches(order.current_shipping_price_set, release.amountCents)
    && Array.isArray(line.discount_allocations) && line.discount_allocations.every(allocation => allocation && typeof allocation === "object" && moneyCents(allocation.amount) === 0
      && (allocation.amount_set === undefined || moneyBagMatches(allocation.amount_set, 0)));
}
