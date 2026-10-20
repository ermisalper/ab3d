import { shopifyStorefrontRequest } from "./shopify-catalog";
import { tokenAttributes, tokenMoneyCents, type TokenPurchaseSnapshot } from "./token-purchase";

const VARIANT_QUERY = `#graphql
  query TokenPackVariant($id: ID!, $country: CountryCode!) @inContext(country: $country) {
    node(id: $id) { ... on ProductVariant {
      id sku availableForSale requiresShipping requiresComponents
      price { amount currencyCode } quantityRule { minimum maximum increment }
      sellingPlanAllocations(first: 1) { nodes { sellingPlan { id } } }
      product { requiresSellingPlan }
    } }
  }
`;
const CART_CREATE = `#graphql
  mutation TokenPackCartCreate($input: CartInput!, $country: CountryCode!) @inContext(country: $country) {
    cartCreate(input: $input) {
      cart {
        id checkoutUrl totalQuantity attributes { key value }
        buyerIdentity { email countryCode }
        cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
        discountCodes { code applicable } appliedGiftCards { id }
        deliveryGroups(first: 1) { nodes { id } }
        lines(first: 2) { nodes {
          quantity attributes { key value } sellingPlanAllocation { sellingPlan { id } }
          discountAllocations { discountedAmount { amount currencyCode } }
          cost { totalAmount { amount currencyCode } amountPerQuantity { amount currencyCode } }
          merchandise { ... on ProductVariant { id sku requiresShipping requiresComponents } }
        } }
      }
      userErrors { field code message } warnings { code message }
    }
  }
`;

type Variant = { id?: string; sku?: string; availableForSale?: boolean; requiresShipping?: boolean; requiresComponents?: boolean;
  price?: { amount?: string; currencyCode?: string }; quantityRule?: { minimum?: number; maximum?: number | null; increment?: number };
  sellingPlanAllocations?: { nodes?: unknown[] }; product?: { requiresSellingPlan?: boolean } };

export async function verifyTokenVariant(snapshot: TokenPurchaseSnapshot) {
  const result = await shopifyStorefrontRequest<{ errors?: unknown[]; data?: { node?: Variant } }>(VARIANT_QUERY,
    { id: snapshot.release.variantId, country: snapshot.country });
  const variant = result.data?.node;
  if (result.errors?.length || variant?.id !== snapshot.release.variantId || variant.sku !== snapshot.release.sku
    || variant.availableForSale !== true || variant.requiresShipping !== false || variant.requiresComponents !== false
    || variant.product?.requiresSellingPlan !== false || !Array.isArray(variant.sellingPlanAllocations?.nodes)
    || variant.sellingPlanAllocations.nodes.length !== 0 || variant.price?.currencyCode !== "CHF"
    || tokenMoneyCents(variant.price.amount) !== snapshot.priceCents || variant.quantityRule?.minimum !== 1
    || variant.quantityRule.increment !== 1 || (variant.quantityRule.maximum !== null && (typeof variant.quantityRule.maximum !== "number" || variant.quantityRule.maximum < 1)))
    throw new Error("variant_not_verified");
}

type Money = { amount?: string; currencyCode?: string };
type Cart = { id?: string; checkoutUrl?: string; totalQuantity?: number; attributes?: Array<{ key: string; value: string }>;
  buyerIdentity?: { email?: string; countryCode?: string }; cost?: { totalAmount?: Money; subtotalAmount?: Money };
  discountCodes?: unknown[]; appliedGiftCards?: unknown[]; deliveryGroups?: { nodes?: unknown[] };
  lines?: { nodes?: Array<{ quantity?: number; attributes?: Array<{ key: string; value: string }>; sellingPlanAllocation?: unknown;
    discountAllocations?: unknown[]; cost?: { totalAmount?: Money; amountPerQuantity?: Money };
    merchandise?: { id?: string; sku?: string; requiresShipping?: boolean; requiresComponents?: boolean } }> } };

export function safeTokenCheckoutUrl(value: unknown, domain: string) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === domain && !url.username && !url.password && !url.port
      && /^\/(?:cart|checkouts)(?:\/|$)/.test(url.pathname) && !url.hash ? url.toString() : null;
  } catch { return null; }
}

export async function createTokenCart(snapshot: TokenPurchaseSnapshot, hash: string) {
  const attributes = tokenAttributes(snapshot, hash);
  const result = await shopifyStorefrontRequest<{ errors?: unknown[]; data?: { cartCreate?: { cart?: Cart; userErrors?: unknown[]; warnings?: unknown[] } } }>(CART_CREATE,
    { country: snapshot.country, input: {
      buyerIdentity: { email: snapshot.email, countryCode: snapshot.country },
      lines: [{ merchandiseId: snapshot.release.variantId, quantity: 1, attributes }],
      attributes: [...attributes, { key: "LEGAL_TERMS_VERSION", value: snapshot.legalVersion }, { key: "TOKEN_TERMS_VERSION", value: snapshot.tokenTermsVersion }],
    } }, 20_000);
  const created = result.data?.cartCreate, cart = created?.cart;
  const url = safeTokenCheckoutUrl(cart?.checkoutUrl, snapshot.release.shopDomain), line = cart?.lines?.nodes?.[0];
  const exactMoney = (money?: Money) => money?.currencyCode === "CHF" && tokenMoneyCents(money.amount) === snapshot.priceCents;
  const hasAttributes = (items: unknown) => Array.isArray(items) && attributes.every(expected => {
    const matches = items.filter(item => item && item.key === expected.key);
    return matches.length === 1 && matches[0].value === expected.value;
  });
  const empty = (items: unknown) => Array.isArray(items) && items.length === 0;
  if (result.errors?.length || created?.userErrors?.length || created?.warnings?.length || !cart?.id?.startsWith("gid://shopify/Cart/") || !url
    || cart.totalQuantity !== 1 || cart.lines?.nodes?.length !== 1 || line?.quantity !== 1
    || line.sellingPlanAllocation !== null || !empty(line.discountAllocations)
    || !empty(cart.discountCodes) || !empty(cart.appliedGiftCards) || !empty(cart.deliveryGroups?.nodes)
    || !hasAttributes(cart.attributes) || !hasAttributes(line.attributes)
    || cart.buyerIdentity?.email?.trim().toLowerCase() !== snapshot.email.trim().toLowerCase() || cart.buyerIdentity.countryCode !== snapshot.country
    || line.merchandise?.id !== snapshot.release.variantId || line.merchandise.sku !== snapshot.release.sku
    || line.merchandise.requiresShipping !== false || line.merchandise.requiresComponents !== false
    || !exactMoney(cart.cost?.totalAmount) || !exactMoney(cart.cost?.subtotalAmount)
    || !exactMoney(line.cost?.totalAmount) || !exactMoney(line.cost?.amountPerQuantity)) throw new Error("checkout_result_uncertain");
  return { cartId: cart.id, checkoutUrl: url };
}
