import assert from "node:assert/strict";
import test from "node:test";
import { cartMatchesSnapshot } from "../app/cappatex-checkout-cart.ts";

const snapshot = { id: "CPS-" + "a".repeat(32), designId: "CPX-AAAAAAAAAAAA", quantity: 2,
  unitPriceCents: 3010, currency: "CHF", variant: { shopifyVariantId: "gid://shopify/ProductVariant/2" } };

function cart() {
  return { id: "gid://shopify/Cart/test", checkoutUrl: "https://example.myshopify.com/checkouts/test", totalQuantity: 2,
    lines: { pageInfo: { hasNextPage: false }, nodes: [{ quantity: 2,
      attributes: [{ key: "CAPPATEX_SNAPSHOT_ID", value: snapshot.id }, { key: "CAPPATEX_DESIGN_ID", value: snapshot.designId }],
      merchandise: { id: snapshot.variant.shopifyVariantId }, cost: { amountPerQuantity: { amount: "30.10", currencyCode: "CHF" },
        subtotalAmount: { amount: "60.20", currencyCode: "CHF" }, totalAmount: { amount: "60.20", currencyCode: "CHF" } },
    }] } };
}

test("Shopify's actual cart must retain the complete checkout snapshot", () => {
  assert.equal(cartMatchesSnapshot(cart(), snapshot), true);
  const unchanged = cart();
  unchanged.lines.nodes[0].cost.amountPerQuantity.amount = "30.1000";
  assert.equal(cartMatchesSnapshot(unchanged, snapshot), true);
});

test("Shopify stock adjustments, dropped lines and partial responses cannot redirect to payment", () => {
  for (const mutate of [
    value => { value.totalQuantity = 1; },
    value => { value.lines.nodes[0].quantity = 1; },
    value => { value.lines.nodes = []; },
    value => { value.lines.nodes.push(structuredClone(value.lines.nodes[0])); },
    value => { value.lines.pageInfo.hasNextPage = true; },
    value => { delete value.lines.pageInfo; },
    value => { delete value.lines; },
    value => { delete value.totalQuantity; },
    value => { value.lines.nodes[0].merchandise.id = "gid://shopify/ProductVariant/3"; },
  ]) {
    const changed = cart(); mutate(changed);
    assert.equal(cartMatchesSnapshot(changed, snapshot), false);
  }
});

test("a changed market currency or actual unit price fails before payment", () => {
  for (const amount of ["29.10", "31.10", "30.099", "30.101", "", "NaN", "Infinity", "3.01e1", "9007199254740991"]) {
    const changed = cart(); changed.lines.nodes[0].cost.amountPerQuantity.amount = amount;
    assert.equal(cartMatchesSnapshot(changed, snapshot), false, amount);
  }
  const changed = cart(); changed.lines.nodes[0].cost.amountPerQuantity.currencyCode = "EUR";
  assert.equal(cartMatchesSnapshot(changed, snapshot), false);
  delete changed.lines.nodes[0].cost;
  assert.equal(cartMatchesSnapshot(changed, snapshot), false);
});

test("discounts, changed line totals and inconsistent total currencies fail before payment", () => {
  for (const field of ["subtotalAmount", "totalAmount"]) {
    for (const amount of ["60.19", "60.21", "30.10", "0.00", "60.199", "", "NaN"]) {
      const changed = cart(); changed.lines.nodes[0].cost[field].amount = amount;
      assert.equal(cartMatchesSnapshot(changed, snapshot), false, `${field}: ${amount}`);
    }
    const currencyChanged = cart(); currencyChanged.lines.nodes[0].cost[field].currencyCode = "EUR";
    assert.equal(cartMatchesSnapshot(currencyChanged, snapshot), false, `${field}: currency`);
    const missing = cart(); delete missing.lines.nodes[0].cost[field];
    assert.equal(cartMatchesSnapshot(missing, snapshot), false, `${field}: missing`);
  }
  const discounted = cart(); discounted.lines.nodes[0].cost.totalAmount.amount = "54.18";
  assert.equal(cartMatchesSnapshot(discounted, snapshot), false);
});

test("snapshot and artwork references cannot be removed, replaced or duplicated by Shopify", () => {
  for (const key of ["CAPPATEX_SNAPSHOT_ID", "CAPPATEX_DESIGN_ID"]) {
    for (const mode of ["removed", "replaced", "duplicated"]) {
      const changed = cart();
      const attributes = changed.lines.nodes[0].attributes;
      const index = attributes.findIndex(attribute => attribute.key === key);
      if (mode === "removed") attributes.splice(index, 1);
      if (mode === "replaced") attributes[index].value = "different";
      if (mode === "duplicated") attributes.push({ ...attributes[index] });
      assert.equal(cartMatchesSnapshot(changed, snapshot), false, `${key}: ${mode}`);
    }
  }
});
