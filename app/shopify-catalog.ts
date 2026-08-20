export const SHOPIFY_COLLECTIONS = {
  ab3d: "ab3d-3d-produkte",
  cappatex: "cappatex",
} as const;

export type ShopifyMoney = {
  amount: string;
  currencyCode: string;
};

export type ShopifyCatalogVariant = {
  id: string;
  title: string;
  sku: string;
  available: boolean;
  price: number;
  currency: string;
  size: string;
  color: string;
  image: string | null;
  imageAlt: string | null;
};

export type ShopifyCatalogProduct = {
  id: string;
  shopifyId: string;
  handle: string;
  name: string;
  category: string;
  vendor: string;
  price: number;
  currency: string;
  image: string | null;
  imageAlt: string;
  description: string;
  leadTime: string;
  badge?: string;
  colors: Array<{ name: string; value: string }>;
  sizes: string[];
  variants: ShopifyCatalogVariant[];
};

export type ShopifyCollectionCatalog = {
  id: string;
  handle: string;
  title: string;
  updatedAt: string;
  products: ShopifyCatalogProduct[];
};

type StorefrontVariant = {
  id?: string;
  title?: string;
  sku?: string | null;
  availableForSale?: boolean;
  price?: ShopifyMoney;
  selectedOptions?: Array<{ name?: string; value?: string }>;
  image?: { url?: string; altText?: string | null } | null;
};

type StorefrontProduct = {
  id?: string;
  handle?: string;
  title?: string;
  vendor?: string;
  productType?: string;
  description?: string;
  featuredImage?: { url?: string; altText?: string | null } | null;
  variants?: { nodes?: StorefrontVariant[] };
};

type StorefrontCollectionPayload = {
  data?: {
    collection?: {
      id?: string;
      handle?: string;
      title?: string;
      updatedAt?: string;
      products?: { nodes?: StorefrontProduct[] };
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

const COLLECTION_QUERY = `#graphql
  query Ab3dCollectionCatalog($handle: String!) {
    collection(handle: $handle) {
      id
      handle
      title
      updatedAt
      products(first: 100) {
        nodes {
          id
          handle
          title
          vendor
          productType
          description
          featuredImage { url altText }
          variants(first: 100) {
            nodes {
              id
              title
              sku
              availableForSale
              price { amount currencyCode }
              selectedOptions { name value }
              image { url altText }
            }
          }
        }
      }
    }
  }
`;

const colorPalette: Record<string, string> = {
  black: "#232523",
  schwarz: "#232523",
  noir: "#232523",
  graphit: "#3c403d",
  white: "#f5f3ed",
  weiss: "#f5f3ed",
  creme: "#eee7dc",
  elfenbein: "#ebe5d8",
  natur: "#c9bda8",
  natural: "#c9bda8",
  sand: "#d7c8b4",
  salbei: "#9dab92",
  wald: "#798d69",
  rose: "#d8b0b8",
  flame: "#d23b2f",
  red: "#c64b3d",
  stone: "#a9a092",
};

function normalizedKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function colorValue(name: string) {
  return colorPalette[normalizedKey(name)] || "#d8d0c3";
}

function optionValue(variant: StorefrontVariant, pattern: RegExp, fallback: string) {
  return variant.selectedOptions?.find((option) => pattern.test(option.name || ""))?.value?.trim() || fallback;
}

function cleanDescription(description = "") {
  const [summary] = description.split(/Fertigung\s*:/i);
  return summary.replace(/\s+/g, " ").trim() || "Auf Bestellung gefertigtes Designprodukt.";
}

function leadTime(description = "") {
  return description.match(/Fertigung\s*:\s*([^.]*)/i)?.[1]?.trim() || "Angabe im Checkout";
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function shopifyStorefrontConfig() {
  const configuredDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim().toLowerCase();
  const domain = configuredDomain || "1hagfh-b0.myshopify.com";
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) throw new Error("invalid_shopify_domain");
  const configuredVersion = process.env.SHOPIFY_API_VERSION?.trim();
  const version = configuredVersion && /^20\d{2}-(01|04|07|10)$/.test(configuredVersion) ? configuredVersion : "2026-07";
  return { domain, version, endpoint: `https://${domain}/api/${version}/graphql.json` };
}

export function shopifyStorefrontHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim();
  if (token) headers["X-Shopify-Storefront-Access-Token"] = token;
  return headers;
}

export async function shopifyStorefrontRequest<T>(query: string, variables: Record<string, unknown>, timeoutMs = 15_000) {
  const { endpoint } = shopifyStorefrontConfig();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: shopifyStorefrontHeaders(),
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok || !payload) throw new Error(`shopify_http_${response.status}`);
  return payload;
}

function normalizeProduct(product: StorefrontProduct): ShopifyCatalogProduct | null {
  if (!product.id || !product.handle || !product.title) return null;
  const variants = (product.variants?.nodes || []).flatMap((variant): ShopifyCatalogVariant[] => {
    if (!variant.id || !variant.price) return [];
    const size = optionValue(variant, /^(gr[oö]sse|größe|size)$/i, "Standard");
    const color = optionValue(variant, /^(farbe|color|colour)$/i, "Standard");
    return [{
      id: variant.id,
      title: variant.title || `${size} / ${color}`,
      sku: variant.sku?.trim() || "",
      available: Boolean(variant.availableForSale),
      price: Number(variant.price.amount),
      currency: variant.price.currencyCode || "CHF",
      size,
      color,
      image: variant.image?.url || product.featuredImage?.url || null,
      imageAlt: variant.image?.altText || product.featuredImage?.altText || null,
    }];
  });
  if (!variants.length) return null;
  const availableVariants = variants.filter((variant) => variant.available);
  const pricedVariants = availableVariants.length ? availableVariants : variants;
  const minPrice = Math.min(...pricedVariants.map((variant) => variant.price));
  const currency = pricedVariants[0]?.currency || "CHF";
  const colorNames = unique(variants.map((variant) => variant.color));
  return {
    id: product.handle,
    shopifyId: product.id,
    handle: product.handle,
    name: product.title,
    category: product.productType?.trim() || "3D Design",
    vendor: product.vendor?.trim() || "AB3D",
    price: minPrice,
    currency,
    image: product.featuredImage?.url || variants.find((variant) => variant.image)?.image || null,
    imageAlt: product.featuredImage?.altText || `${product.title} Produktansicht`,
    description: cleanDescription(product.description),
    leadTime: leadTime(product.description),
    colors: colorNames.map((name) => ({ name, value: colorValue(name) })),
    sizes: unique(variants.map((variant) => variant.size)),
    variants,
  };
}

export async function fetchShopifyCollection(handle: string): Promise<ShopifyCollectionCatalog> {
  const payload = await shopifyStorefrontRequest<StorefrontCollectionPayload>(COLLECTION_QUERY, { handle });
  if (payload.errors?.length) throw new Error("shopify_graphql_error");
  const collection = payload.data?.collection;
  if (!collection?.id || !collection.handle || !collection.title) throw new Error("shopify_collection_missing");
  return {
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
    updatedAt: collection.updatedAt || new Date(0).toISOString(),
    products: (collection.products?.nodes || []).map(normalizeProduct).filter((product): product is ShopifyCatalogProduct => Boolean(product)),
  };
}
