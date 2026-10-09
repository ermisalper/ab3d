import type { CheckoutSnapshot } from "./cappatex-snapshot";

type CartMoney = { amount: string; currencyCode: string };

export type CappatexCheckoutCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity?: number;
  lines?: {
    pageInfo?: { hasNextPage: boolean };
    nodes?: Array<{
      quantity?: number;
      attributes?: Array<{ key: string; value: string }>;
      merchandise?: { id?: string };
      cost?: { amountPerQuantity?: CartMoney; subtotalAmount?: CartMoney; totalAmount?: CartMoney };
    }>;
  };
};

function moneyCents(amount: string | undefined) {
  // MoneyV2 is decimal text. Reject fractional cents instead of rounding a changed price.
  if (typeof amount !== "string" || !/^\d+(?:\.\d{1,2}0*)?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.split(".");
  const value = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, "0"));
  return Number.isSafeInteger(value) ? value : null;
}

export function cartMatchesSnapshot(cart: CappatexCheckoutCart, snapshot: CheckoutSnapshot) {
  const lines = cart.lines?.nodes;
  if (!cart.id || cart.totalQuantity !== snapshot.quantity || cart.lines?.pageInfo?.hasNextPage !== false
    || !Array.isArray(lines) || lines.length !== 1) return false;
  const line = lines[0];
  const attributes = line.attributes;
  if (!Array.isArray(attributes)) return false;
  const matchesAttribute = (key: string, value: string) => {
    const matches = attributes.filter(attribute => attribute.key === key);
    return matches.length === 1 && matches[0].value === value;
  };
  const totalCents = snapshot.unitPriceCents * snapshot.quantity;
  return line.quantity === snapshot.quantity
    && line.merchandise?.id === snapshot.variant.shopifyVariantId
    && Number.isSafeInteger(snapshot.unitPriceCents) && snapshot.unitPriceCents >= 0
    && moneyCents(line.cost?.amountPerQuantity?.amount) === snapshot.unitPriceCents
    && line.cost?.amountPerQuantity?.currencyCode === snapshot.currency
    && Number.isSafeInteger(totalCents)
    && moneyCents(line.cost?.subtotalAmount?.amount) === totalCents
    && line.cost?.subtotalAmount?.currencyCode === snapshot.currency
    // Pilot discounts require manual approval; do not accept a reduced final line total.
    && moneyCents(line.cost?.totalAmount?.amount) === totalCents
    && line.cost?.totalAmount?.currencyCode === snapshot.currency
    && matchesAttribute("CAPPATEX_SNAPSHOT_ID", snapshot.id)
    && matchesAttribute("CAPPATEX_DESIGN_ID", snapshot.designId);
}
