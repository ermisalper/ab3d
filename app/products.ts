import type { ShopifyCatalogProduct, ShopifyCatalogVariant } from "./shopify-catalog";

export type Product = ShopifyCatalogProduct;
export type ProductSize = string;

export function productVariant(product: Product, size: string, color: string): ShopifyCatalogVariant | null {
  return product.variants.find((variant) => variant.size === size && variant.color === color)
    || product.variants.find((variant) => variant.available)
    || product.variants[0]
    || null;
}

export function productPrice(product: Product, size: string, color: string) {
  return productVariant(product, size, color)?.price ?? product.price;
}

