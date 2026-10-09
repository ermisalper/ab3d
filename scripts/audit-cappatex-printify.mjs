import { execFileSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Deliberately fixed read-only targets. No order, upload, product mutation or token-management endpoint.
const WORKSPACE = "C:/Users/berk1/OneDrive/Desktop/ab3d";
const SHOP_ID = 23104859;
const PRODUCT_ID = "6ac927b73b3a3e64620a53a3";
const BLUEPRINT_ID = 145;
const PROVIDER_ID = 30;
const OUTPUT = "outputs/cappatex-first-blank-api-audit.json";
const ENDPOINTS = Object.freeze({
  shops: "https://api.printify.com/v1/shops.json",
  product: `https://api.printify.com/v1/shops/${SHOP_ID}/products/${PRODUCT_ID}.json`,
  providerVariants: `https://api.printify.com/v1/catalog/blueprints/${BLUEPRINT_ID}/print_providers/${PROVIDER_ID}/variants.json`,
  providerShipping: `https://api.printify.com/v1/catalog/blueprints/${BLUEPRINT_ID}/print_providers/${PROVIDER_ID}/shipping.json`,
});

class AuditError extends Error {}
const normalized = value => path.resolve(value).replaceAll("\\", "/").toLowerCase();
const number = value => typeof value === "number" && Number.isFinite(value) ? value : null;
const text = value => typeof value === "string" ? value : null;
const bool = value => typeof value === "boolean" ? value : null;
const list = value => Array.isArray(value) ? value : [];
const numbers = value => list(value).filter(item => typeof item === "number" && Number.isFinite(item));
const strings = value => list(value).filter(item => typeof item === "string");

function safeUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.username = ""; url.password = ""; url.search = ""; url.hash = "";
    return url.toString();
  } catch { return null; }
}

async function workspaceRoot() {
  if (process.platform !== "win32") throw new AuditError("wrong_workspace");
  const root = await realpath(process.cwd());
  const scriptRoot = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  if (normalized(root) !== normalized(WORKSPACE) || normalized(scriptRoot) !== normalized(WORKSPACE))
    throw new AuditError("wrong_workspace");
  return root;
}

async function loadToken(root) {
  // Refuse tracked/unignored or redirected env files. Never load a token from command arguments.
  try { execFileSync("git", ["check-ignore", "--quiet", "--", ".env.local"], { cwd: root, stdio: "ignore" }); }
  catch { throw new AuditError("env_file_not_ignored"); }
  const envPath = path.join(root, ".env.local");
  if (normalized(await realpath(envPath)) !== normalized(envPath)) throw new AuditError("env_path_redirected");
  const content = (await readFile(envPath, "utf8")).replace(/^\uFEFF/, "");
  const entries = content.split(/\r?\n/).filter(line => /^(?:export\s+)?PRINTIFY_API_TOKEN\s*=/.test(line.trim()));
  if (entries.length !== 1) throw new AuditError("missing_or_ambiguous_printify_token");
  let token = entries[0].trim().replace(/^(?:export\s+)?PRINTIFY_API_TOKEN\s*=\s*/, "").trim();
  if (token.startsWith('"') || token.startsWith("'")) {
    const quoted = token.match(/^(['"])(.*?)\1(?:\s+#.*)?$/);
    if (!quoted) throw new AuditError("invalid_printify_token_entry");
    token = quoted[2];
  } else token = token.split(/\s+#/, 1)[0].trim();
  if (!token || [...token].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127))
    throw new AuditError("invalid_printify_token_entry");
  return token;
}

async function getEndpoint(name, token) {
  const url = ENDPOINTS[name];
  if (!url || new URL(url).origin !== "https://api.printify.com") throw new AuditError("endpoint_not_allowed");
  try {
    const response = await fetch(url, {
      method: "GET", redirect: "error", signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "AB3D-CAPPATEX-ReadOnlyAudit/1.0" },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { status: response.status, error: "http_error" };
    }
    try { return { status: response.status, data: await response.json() }; }
    catch { return { status: response.status, error: "invalid_json" }; }
  } catch { return { status: null, error: "request_failed" }; }
}

function placeholder(item) {
  return {
    position: text(item?.position), width: number(item?.width), height: number(item?.height),
    decoration_method: text(item?.decoration_method), decoration_methods: strings(item?.decoration_methods),
  };
}

function image(item) {
  return {
    id: text(item?.id), name: text(item?.name), type: text(item?.type),
    width: number(item?.width), height: number(item?.height),
    x: number(item?.x), y: number(item?.y), scale: number(item?.scale), angle: number(item?.angle),
    src: safeUrl(item?.src), preview_url: safeUrl(item?.preview_url),
  };
}

function selectedVariant(item, options) {
  const optionIds = numbers(item?.options);
  return {
    id: number(item?.id), sku: text(item?.sku), title: text(item?.title), options: optionIds,
    selected_options: options.flatMap(option => option.values.filter(value => optionIds.includes(value.id))
      .map(value => ({ name: option.name, type: option.type, id: value.id, title: value.title }))),
    cost: number(item?.cost), price: number(item?.price), grams: number(item?.grams),
    is_enabled: bool(item?.is_enabled), is_available: bool(item?.is_available), is_default: bool(item?.is_default),
  };
}

function sanitizeProduct(product) {
  if (!product || typeof product !== "object") return null;
  const options = list(product.options).map(option => ({
    name: text(option?.name), type: text(option?.type),
    values: list(option?.values).map(value => ({ id: number(value?.id), title: text(value?.title), colors: strings(value?.colors) })),
  }));
  const enabled = list(product.variants).filter(variant => variant?.is_enabled === true);
  const ids = enabled.map(variant => variant.id);
  return {
    id: text(product.id), title: text(product.title), blueprint_id: number(product.blueprint_id),
    print_provider_id: number(product.print_provider_id), visible: bool(product.visible), is_locked: bool(product.is_locked),
    created_at: text(product.created_at), updated_at: text(product.updated_at),
    external: product.external ? { id: text(product.external.id), handle: safeUrl(product.external.handle) } : null,
    variant_count: list(product.variants).length, enabled_variant_count: enabled.length, options,
    enabled_variants: enabled.map(variant => selectedVariant(variant, options)),
    images: list(product.images).filter(item => !list(item?.variant_ids).length || list(item.variant_ids).some(id => ids.includes(id)))
      .map(item => ({ src: safeUrl(item?.src), variant_ids: numbers(item?.variant_ids), position: text(item?.position),
        is_default: bool(item?.is_default), is_selected_for_publishing: bool(item?.is_selected_for_publishing) })),
    print_areas: list(product.print_areas).filter(area => list(area?.variant_ids).some(id => ids.includes(id)))
      .map(area => ({ variant_ids: numbers(area?.variant_ids), background: text(area?.background),
        placeholders: list(area?.placeholders).map(item => ({ ...placeholder(item), images: list(item?.images).map(image) })) })),
  };
}

function sanitizeProvider(data, selectedIds) {
  if (!data || typeof data !== "object") return null;
  return {
    id: number(data.id), title: text(data.title), variant_count: list(data.variants).length,
    selected_variants: list(data.variants).filter(variant => selectedIds.includes(variant?.id)).map(variant => ({
      id: number(variant.id), title: text(variant.title),
      options: { color: text(variant.options?.color), size: text(variant.options?.size) },
      cost: number(variant.cost), is_available: bool(variant.is_available),
      placeholders: list(variant.placeholders).map(placeholder),
    })),
  };
}

function sanitizeShipping(data) {
  if (!data || typeof data !== "object") return null;
  const money = value => ({ cost: number(value?.cost), currency: text(value?.currency) });
  return {
    handling_time: data.handling_time ? { value: number(data.handling_time.value), unit: text(data.handling_time.unit) } : null,
    profiles: list(data.profiles).map(profile => ({ variant_ids: numbers(profile?.variant_ids), countries: strings(profile?.countries),
      first_item: money(profile?.first_item), additional_items: money(profile?.additional_items) })),
  };
}

async function main() {
  const root = await workspaceRoot();
  const token = await loadToken(root);
  const results = {};
  // Sequential, single GET per target; no automatic retry and no writes to Printify.
  for (const name of Object.keys(ENDPOINTS)) results[name] = await getEndpoint(name, token);
  const product = sanitizeProduct(results.product.data);
  const selectedIds = product?.enabled_variants.map(variant => variant.id).filter(id => id !== null) || [];
  const provider = sanitizeProvider(results.providerVariants.data, selectedIds);
  const shipping = sanitizeShipping(results.providerShipping.data);
  const shops = list(results.shops.data).map(shop => ({ id: number(shop?.id), title: text(shop?.title), sales_channel: text(shop?.sales_channel) }));
  const identityMatches = product?.id === PRODUCT_ID && product.blueprint_id === BLUEPRINT_ID && product.print_provider_id === PROVIDER_ID;
  const evidence = {
    checked_at: new Date().toISOString(), method: "GET", required_read_scopes: ["shops.read", "products.read", "catalog.read"],
    target: { shop_id: SHOP_ID, product_id: PRODUCT_ID, blueprint_id: BLUEPRINT_ID, provider_id: PROVIDER_ID },
    endpoints: Object.fromEntries(Object.entries(results).map(([name, result]) => [name, {
      url: ENDPOINTS[name], status: result.status, error: result.error || null,
    }])),
    checks: { target_shop_listed: shops.some(shop => shop.id === SHOP_ID), product_identity_matches: identityMatches,
      selected_variant_ids: selectedIds, provider_selected_variant_count: provider?.selected_variants.length || 0 },
    shops, product, provider_variants: provider, provider_shipping: shipping,
    limits: ["No order, upload or mutation request was made.", "Read success does not prove write permissions.",
      "URLs have credentials, query strings and fragments removed.", "Native unlink, manual approval, physical geometry and Shopify mapping are not verified by this audit."],
  };
  const outputDir = path.join(root, "outputs");
  await mkdir(outputDir, { recursive: true });
  if (normalized(await realpath(outputDir)) !== normalized(outputDir)) throw new AuditError("output_path_redirected");
  const outputPath = path.join(root, OUTPUT);
  const existing = await lstat(outputPath).catch(error => { if (error.code === "ENOENT") return null; throw error; });
  if (existing?.isSymbolicLink()) throw new AuditError("output_path_redirected");
  // Defense in depth: never persist the exact bearer token even if a remote field unexpectedly echoed it.
  const json = JSON.stringify(evidence, null, 2).replaceAll(token, "[redacted]");
  await writeFile(outputPath, `${json}\n`, "utf8");
  for (const [name, result] of Object.entries(results)) {
    const count = name === "shops" ? shops.length : name === "product" ? selectedIds.length
      : name === "providerVariants" ? provider?.selected_variants.length || 0 : shipping?.profiles.length || 0;
    console.log(`${name}: HTTP ${result.status ?? "unavailable"}; count=${count}; ${result.error || "ok"}`);
  }
  console.log(`Product identity: ${identityMatches ? "matched" : "not confirmed"}; evidence: ${OUTPUT}`);
  if (Object.values(results).some(result => result.error) || !identityMatches || !shops.some(shop => shop.id === SHOP_ID)) process.exitCode = 1;
}

main().catch(error => {
  console.error(`Audit failed: ${error instanceof AuditError ? error.message : "local_operation_failed"}`);
  process.exitCode = 1;
});
