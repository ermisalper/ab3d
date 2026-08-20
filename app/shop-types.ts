import type { Product, ProductSize } from "./products";

export type ProductSelection = {
  color: string;
  size: ProductSize;
};

export const formatChf = new Intl.NumberFormat("de-CH", {
  style: "currency",
  currency: "CHF",
});

export function defaultProductSelection(product: Product): ProductSelection {
  const variant = product.variants.find((entry) => entry.available && entry.size === "M")
    || product.variants.find((entry) => entry.available)
    || product.variants[0];
  return { color: variant?.color || product.colors[0]?.name || "Standard", size: variant?.size || product.sizes[0] || "Standard" };
}
