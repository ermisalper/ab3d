import assert from "node:assert/strict";
import test from "node:test";
import { duplicateShopifySkus, matchShopifyProduct, uniquePrintifySkuIndex } from "../app/printify-catalog.ts";

function shopifyProduct(skus) {
  return { variants: skus.map((sku, index) => ({ id: `variant-${index}`, sku, available: true })) };
}

function printifyProduct(id, skus) {
  return {
    id,
    blueprint_id: 1,
    print_provider_id: 2,
    variants: skus.map((sku, index) => ({ id: index + 1, sku, is_enabled: true, is_available: true })),
  };
}

test("a unique SKU links one Shopify product to one Printify product", () => {
  const shopify = shopifyProduct(["TEE-S", "TEE-M"]);
  const index = uniquePrintifySkuIndex([printifyProduct("printify-1", ["TEE-S", "TEE-M"])]);
  const matched = matchShopifyProduct(shopify, index, duplicateShopifySkus([shopify]));
  assert.equal(matched.product?.id, "printify-1");
  assert.deepEqual(matched.matches.map(({ printify }) => printify?.variant.id), [1, 2]);
});

test("duplicate Printify SKU never picks an arbitrary product", () => {
  const index = uniquePrintifySkuIndex([
    printifyProduct("printify-1", ["SAME"]),
    printifyProduct("printify-2", ["SAME"]),
  ]);
  assert.equal(index.has("SAME"), false);
});

test("duplicate Shopify SKU and mixed Printify products are rejected", () => {
  const first = shopifyProduct(["SAME"]);
  const second = shopifyProduct(["SAME"]);
  const index = uniquePrintifySkuIndex([printifyProduct("printify-1", ["SAME"])]);
  assert.equal(matchShopifyProduct(first, index, duplicateShopifySkus([first, second])).product, undefined);

  const mixed = shopifyProduct(["A", "B"]);
  const mixedIndex = uniquePrintifySkuIndex([
    printifyProduct("printify-1", ["A"]),
    printifyProduct("printify-2", ["B"]),
  ]);
  assert.equal(matchShopifyProduct(mixed, mixedIndex, duplicateShopifySkus([mixed])).product, undefined);
});
