import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, test } from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { decode, encode } from "fast-png";

// All identities, credentials, profiles and orders in this file are local fixtures.
// The real routes run, but fetch never delegates to the network or a live account.
const APP_ORIGIN = "https://app.example.test";
const STORE_DOMAIN = "cappatex-route-fixture.myshopify.com";
const EMAIL = "owner@example.test";
const WEBHOOK_SECRET = "local-fixture-not-a-real-shopify-secret";
const NOW = Date.parse("2026-10-09T12:00:00Z");
const area = { position: "front", decorationMethod: "dtg", widthPx: 600, heightPx: 800,
  widthMm: 50.8, heightMm: 50.8 * 800 / 600, minDpi: 300, minScale: .1, maxScale: 1 };
const variant = { printifyVariantId: 101, shopifyVariantId: "gid://shopify/ProductVariant/202",
  sku: "LOCAL-ONLY-BLANK-M", color: "White", size: "M", area,
  mockup: { url: "https://example.test/blank.png", width: 1000, height: 1000,
    left: 300, top: 250, printWidth: 300, printHeight: 400 },
  shipping: ["CH", "LI"].map(country => ({ country, method: 1, currency: "USD", firstCents: 100, additionalCents: 50 })) };
const profile = { id: "local-route-fixture", version: "fixture-v1", verifiedAt: "2026-10-01T00:00:00Z",
  validUntil: "2026-11-01T00:00:00Z", shopId: "local-route-shop", printifyProductId: "local-blank-template",
  blueprintId: 301, providerId: 401, shopifyProductId: "gid://shopify/Product/303", kind: "tshirt",
  name: "Local test fixture — never publish", evidence: ["Synthetic offline test only"],
  fulfillment: { route: "ab3d-api", nativeImportUnlinked: true, manualApproval: true }, variants: [variant] };

const runtimeKey = "__cappatexOfflineRouteTest";
const runtime = { env: {}, profiles: [profile], designProfiles: [], actor: EMAIL };
globalThis[runtimeKey] = runtime;
const virtualSources = new Map([
  ["cloudflare:workers", `export const env = globalThis.${runtimeKey}.env;`],
  ["next/headers", `export async function headers() { const actor = globalThis.${runtimeKey}.actor; return new Headers(actor ? { "oai-authenticated-user-email": actor } : {}); }`],
  ["next/navigation", "export function redirect() { throw new Error('Unexpected redirect in route test'); }"],
  ["fixture:profiles", `export const CAPPATEX_PRINT_PROFILES = globalThis.${runtimeKey}.profiles;`],
  ["fixture:design-profiles", `export const CAPPATEX_DESIGN_PROFILES = globalThis.${runtimeKey}.designProfiles;`],
]);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const key = /(?:^|\/)cappatex-profiles(?:\.ts)?$/.test(specifier) ? "fixture:profiles"
      : /(?:^|\/)cappatex-design-profiles(?:\.ts)?$/.test(specifier) ? "fixture:design-profiles" : specifier;
    if (virtualSources.has(key)) return { url: `offline-cappatex:${key}`, shortCircuit: true };
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("offline-cappatex:")) return { format: "module", source: virtualSources.get(url.slice("offline-cappatex:".length)), shortCircuit: true };
    return nextLoad(url, context);
  },
});

// These are production entry points, not replacements for their business logic.
const { POST: checkout } = await import("../app/api/cappatex/checkout/route.ts");
const { POST: webhook } = await import("../app/api/cappatex/webhooks/shopify/route.ts");
const { POST: uploadArtwork } = await import("../app/api/cappatex/upload/route.ts");
const { POST: generateArtwork } = await import("../app/api/cappatex/route.ts");
const { GET: getArtwork } = await import("../app/api/cappatex/artwork/[id]/route.ts");
const { GET: getDesignMetadata } = await import("../app/api/cappatex/designs/[id]/route.ts");
const { GET: getDesignCatalog } = await import("../app/api/cappatex/catalog/route.ts");
const { sha256 } = await import("../app/cappatex-artwork.ts");

class MemoryD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("PRAGMA foreign_keys = ON");
    const migrations = new URL("../drizzle/", import.meta.url);
    for (const name of readdirSync(migrations).filter(name => name.endsWith(".sql")).sort()) {
      this.sqlite.exec(readFileSync(new URL(name, migrations), "utf8"));
    }
  }
  prepare(sql) {
    const sqlite = this.sqlite;
    function statement(args = []) {
      return {
        bind: (...values) => statement(values),
        first: async column => {
          const row = sqlite.prepare(sql).get(...args);
          return row ? column ? row[column] : { ...row } : null;
        },
        all: async () => ({ success: true, results: sqlite.prepare(sql).all(...args).map(row => ({ ...row })) }),
        runSync() {
          const result = sqlite.prepare(sql).run(...args);
          return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
        },
        async run() { return this.runSync(); },
      };
    }
    return statement();
  }
  async batch(statements) {
    this.sqlite.exec("BEGIN");
    try {
      const results = statements.map(statement => statement.runSync());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

class MemoryR2 {
  objects = new Map();
  async put(key, bytes, options = {}) {
    this.objects.set(key, { bytes: new Uint8Array(bytes).slice(), httpMetadata: { ...options.httpMetadata } });
  }
  async get(key) {
    const object = this.objects.get(key);
    return object ? { ...object, arrayBuffer: async () => object.bytes.slice().buffer } : null;
  }
  async delete(key) { this.objects.delete(key); }
}

function imageBytes(red) {
  const width = 240, height = 320, data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data.set([red, (index / 4) % 251, 91, index % 12 ? 255 : 128], index);
  }
  return encode({ width, height, data, channels: 4, depth: 8 });
}

function templateProduct() {
  return { id: profile.printifyProductId, blueprint_id: profile.blueprintId, print_provider_id: profile.providerId,
    visible: false, images: [{ src: variant.mockup.url, position: "front", variant_ids: [variant.printifyVariantId] }],
    variants: [{ id: variant.printifyVariantId, sku: variant.sku, price: 1750, is_enabled: true, is_available: true }] };
}

function storefrontCollection() {
  return { data: { collection: { id: "gid://shopify/Collection/404", handle: "cappatex-selbst-gestalten", title: "Offline blanks",
    products: { pageInfo: { hasNextPage: false }, nodes: [{ id: profile.shopifyProductId, handle: "local-blank",
      title: profile.name, vendor: "Offline", featuredImage: { url: variant.mockup.url },
      variants: { pageInfo: { hasNextPage: false }, nodes: [{ id: variant.shopifyVariantId, title: "White / M",
        sku: variant.sku, availableForSale: true, price: { amount: "30.00", currencyCode: "CHF" },
        selectedOptions: [{ name: "Color", value: "White" }, { name: "Size", value: "M" }] }] } }] } } } };
}

function offlineFetch(fixture) {
  return async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init.method || (input instanceof Request ? input.method : "GET");
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
    if (url.origin === "https://api.printify.com") {
      assert.equal(new Headers(init.headers).get("User-Agent"), "AB3D-CAPPATEX/1.0",
        "Printify requires an explicit application User-Agent, including on Worker fetch");
    }
    fixture.requests.push({ method, url: url.href, body });
    const intercepted = fixture.interceptFetch?.(url, method);
    if (intercepted !== undefined) return await intercepted;
    const json = payload => Response.json(payload);
    if (url.href === "https://api.openai.com/v1/images/generations" && method === "POST" && fixture.generationError) {
      return Response.json({ error: { code: fixture.generationError.code, param: fixture.generationError.param,
        message: "Synthetic provider error; never show this raw message" } },
        { status: fixture.generationError.status });
    }
    if (url.href === "https://api.openai.com/v1/images/generations" && method === "POST" && fixture.generatedImage) {
      return json({ data: [{ b64_json: Buffer.from(fixture.generatedImage).toString("base64") }] });
    }
    if (url.href === `https://${STORE_DOMAIN}/api/2026-07/graphql.json` && method === "POST") {
      if (body.query.includes("query Ab3dCollection")) return json(storefrontCollection());
      if (body.query.includes("mutation CappatexCartCreate")) {
        fixture.carts.push(structuredClone(body.variables.input));
        const inputLine = body.variables.input.lines[0];
        const cart = { id: `gid://shopify/Cart/local-${fixture.carts.length}`,
          checkoutUrl: `https://${STORE_DOMAIN}/checkouts/local-${fixture.carts.length}`, totalQuantity: inputLine.quantity,
          lines: { pageInfo: { hasNextPage: false }, nodes: [{ quantity: inputLine.quantity, attributes: inputLine.attributes,
            merchandise: { id: inputLine.merchandiseId }, cost: {
              amountPerQuantity: { amount: "30.00", currencyCode: "CHF" },
              subtotalAmount: { amount: (30 * inputLine.quantity).toFixed(2), currencyCode: "CHF" },
              totalAmount: { amount: (30 * inputLine.quantity).toFixed(2), currencyCode: "CHF" },
            } }] } };
        fixture.changeCart?.(cart);
        return json({ data: { cartCreate: { cart, userErrors: [], warnings: fixture.cartWarnings || [] } } });
      }
    }
    if (url.origin === "https://api.printify.com") {
      const root = `/v1/shops/${profile.shopId}`;
      const catalog = `/v1/catalog/blueprints/${profile.blueprintId}/print_providers/${profile.providerId}`;
      if (method === "GET" && url.pathname === `${root}/products.json` && url.search === "?limit=50&page=1") {
        return json({ data: [templateProduct(), ...fixture.drafts], last_page: 1 });
      }
      if (method === "GET" && url.pathname === `${catalog}/variants.json`) {
        const provider = { variants: [{ id: variant.printifyVariantId,
        options: { color: variant.color, size: variant.size }, placeholders: [{ position: area.position,
          decoration_method: area.decorationMethod, width: area.widthPx, height: area.heightPx }] }] };
        fixture.changeProvider?.(provider);
        return json(provider);
      }
      if (method === "GET" && url.pathname === `${catalog}/shipping.json`) return json({ profiles: [{
        variant_ids: [variant.printifyVariantId], countries: ["CH", "LI"],
        first_item: { cost: 100, currency: "USD" }, additional_items: { cost: 50, currency: "USD" } }] });
      if (method === "GET" && url.pathname === `${root}/products/${profile.printifyProductId}.json`) {
        const product = templateProduct(); fixture.changeTemplate?.(product); return json(product);
      }
      if (method === "POST" && url.pathname === "/v1/uploads/images.json") {
        const bytes = Uint8Array.from(Buffer.from(body.contents, "base64"));
        const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const uploaded = { id: `local-upload-${fixture.uploads.length + 1}`, width: header.getUint32(16), height: header.getUint32(20),
          preview_url: "https://example.test/low-resolution-preview-must-not-be-used.png" };
        fixture.uploads.push({ ...uploaded, bytes, fileName: body.file_name });
        return json(uploaded);
      }
      if (method === "POST" && url.pathname === `${root}/products.json`) {
        const id = `local-draft-${fixture.drafts.length + 1}`;
        const draft = { ...structuredClone(body), id, visible: false,
          variants: body.variants.map(value => ({ ...value, sku: `${id}-unique-sku`, is_available: true })),
          print_areas: body.print_areas.map(printArea => ({ ...printArea,
            placeholders: printArea.placeholders.map(placeholder => ({ ...placeholder, decoration_method: area.decorationMethod })) })) };
        fixture.changeDraft?.(draft);
        fixture.drafts.push(draft);
        return json(draft);
      }
      if (method === "POST" && url.pathname === `${root}/orders.json`) {
        fixture.orders.push(structuredClone(body));
        if (fixture.orderTimeout) throw new Error("Synthetic timeout after remote acceptance");
        return json({ id: `local-order-${fixture.orders.length}` });
      }
    }
    fixture.unexpected.push(`${method} ${url.href}`);
    throw new Error(`Network prohibited in offline test: ${method} ${url.href}`);
  };
}

const configured = { CAPPATEX_CHECKOUT_ENABLED: "true", CAPPATEX_FULFILLMENT_ENABLED: "true",
  CAPPATEX_GENERATION_ENABLED: "false", OPENAI_API_KEY: "local-fixture-not-a-real-openai-key",
  CAPPATEX_UPLOAD_ENABLED: "true", CAPPATEX_GENERATION_AUDIENCE: "owner", CAPPATEX_GENERATION_ALLOWED_EMAILS: EMAIL,
  CAPPATEX_AUTO_PRODUCTION_ENABLED: "false", PRINTIFY_SHOP_ID: profile.shopId,
  PRINTIFY_API_TOKEN: "local-fixture-not-a-real-token", SHOPIFY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  SHOPIFY_STORE_DOMAIN: STORE_DOMAIN, SHOPIFY_API_VERSION: "2026-07", SHOPIFY_STOREFRONT_ACCESS_TOKEN: "local-fixture-only",
  AB3D_OWNER_EMAILS: "", AB3D_UNLIMITED_EMAILS: "" };
const previousEnv = Object.fromEntries(Object.keys(configured).map(key => [key, process.env[key]]));
const previousFetch = globalThis.fetch, previousNow = Date.now;
let fixture;

beforeEach(() => {
  Object.assign(process.env, configured);
  Date.now = () => NOW;
  fixture = { db: new MemoryD1(), bucket: new MemoryR2(), requests: [], unexpected: [], carts: [], uploads: [], drafts: [], orders: [] };
  Object.assign(runtime.env, { DB: fixture.db, BUCKET: fixture.bucket });
  runtime.actor = EMAIL;
  runtime.profiles.splice(0, runtime.profiles.length, profile);
  runtime.designProfiles.splice(0);
  globalThis.fetch = offlineFetch(fixture);
  fixture.db.sqlite.prepare("INSERT INTO accounts(email,token_balance,created_at,updated_at) VALUES(?,4,?,?)").run(EMAIL, NOW, NOW);
});

afterEach(() => {
  const unexpected = [...fixture.unexpected];
  fixture.db.sqlite.close();
  globalThis.fetch = previousFetch;
  Date.now = previousNow;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  assert.deepEqual(unexpected, [], "An unexpected endpoint was attempted (the mock blocked it)");
});
after(() => { hooks.deregister(); delete globalThis[runtimeKey]; });

async function seedDesign(suffix = "A", red = 31) {
  const id = `CPX-${suffix.repeat(12)}`, bytes = imageBytes(red), hash = await sha256(bytes);
  const key = `cappatex/${id}/${hash}.png`;
  await fixture.bucket.put(key, bytes, { httpMetadata: { contentType: "image/png" } });
  fixture.db.sqlite.prepare(`INSERT INTO cappatex_designs
    (id,email,prompt,production_prompt,style,product_key,preview_base64,status,artwork_key,artwork_sha256,artwork_width,artwork_height,created_at,updated_at)
    VALUES(?,?,'','','','','','preview_ready',?,?,240,320,?,?)`).run(id, EMAIL, key, hash, NOW, NOW);
  return { id, bytes, key, hash };
}

function checkoutBody(design, overrides = {}) {
  return { designId: design.id, profileId: profile.id, profileVersion: profile.version,
    shopifyVariantId: variant.shopifyVariantId, quantity: 1, country: "CH", termsAccepted: true,
    placement: { x: .4, y: .6, scale: .2 }, ...overrides };
}

async function callCheckout(design, overrides = {}, origin = APP_ORIGIN) {
  return checkout(new Request(`${APP_ORIGIN}/api/cappatex/checkout`, { method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(checkoutBody(design, overrides)) }));
}

async function checkedSnapshot(design, overrides = {}) {
  const response = await callCheckout(design, overrides), body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  const row = fixture.db.sqlite.prepare("SELECT * FROM cappatex_snapshots WHERE id = ?").get(body.snapshotId);
  assert.equal(row.state, "checkout_created");
  assert.equal(row.payload_sha256, await sha256(row.payload_json));
  return JSON.parse(row.payload_json);
}

function paidOrder(snapshots, id = 501) {
  const list = Array.isArray(snapshots) ? snapshots : [snapshots];
  return { id, name: `#LOCAL-${id}`, test: false, email: EMAIL, currency: "CHF", financial_status: "paid", cancelled_at: null,
    subtotal_price: String(list.reduce((sum, snapshot) => sum + snapshot.quantity * 30, 0)),
    total_price: "35.00", created_at: new Date(NOW).toISOString(),
    shipping_address: { first_name: "Local", last_name: "Fixture", address1: "Teststrasse 1", city: "Zürich", zip: "8000", country_code: list[0].country },
    line_items: list.map((snapshot, index) => ({ id: 601 + index, title: profile.name, product_id: 303, variant_id: 202,
      sku: variant.sku, quantity: snapshot.quantity, price: "30.00", properties: [
        { name: "CAPPATEX_SNAPSHOT_ID", value: snapshot.id }, { name: "CAPPATEX_DESIGN_ID", value: snapshot.designId },
      ] })) };
}

async function callWebhook(order, event = "local-event-0001", signatureOverride) {
  const raw = new TextEncoder().encode(JSON.stringify(order));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, raw)).toString("base64");
  return webhook(new Request(`${APP_ORIGIN}/api/cappatex/webhooks/shopify`, { method: "POST", body: raw,
    headers: { "Content-Type": "application/json", "x-shopify-topic": "orders/paid", "x-shopify-webhook-id": event,
      "x-shopify-shop-domain": STORE_DOMAIN, "x-shopify-hmac-sha256": signatureOverride ?? signature } }));
}

function fulfillment(orderId = 501) {
  return fixture.db.sqlite.prepare("SELECT * FROM cappatex_fulfillments WHERE id = ?").get(`${STORE_DOMAIN}:${orderId}`);
}

function oddImageBytes(alpha = 255) {
  const width = 9, height = 5, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    data.set([x * 27, y * 50, 70, alpha], (y * width + x) * 4);
  }
  return encode({ width, height, data, depth: 8, channels: 4 });
}

function callUpload(body, overrides = {}) {
  const headers = new Headers({ Origin: APP_ORIGIN, "Content-Type": "image/png", "X-Cappatex-Image-Rights": "confirmed" });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) headers.delete(key); else headers.set(key, value);
  }
  return uploadArtwork(new Request(`${APP_ORIGIN}/api/cappatex/upload`, { method: "POST", headers, body,
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}) }));
}

function callArtwork(id, download = false) {
  return getArtwork(new Request(`${APP_ORIGIN}/api/cappatex/artwork/${id}${download ? "?download=1" : ""}`),
    { params: Promise.resolve({ id }) });
}

function callDesignMetadata(id) {
  return getDesignMetadata(new Request(`${APP_ORIGIN}/api/cappatex/designs/${id}`),
    { params: Promise.resolve({ id }) });
}

function uploadRows() {
  return fixture.db.sqlite.prepare("SELECT * FROM cappatex_designs WHERE style = 'Upload' ORDER BY id").all();
}

function assertNoTokensOrNetwork() {
  assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n, 0);
  assert.equal(fixture.db.sqlite.prepare("SELECT token_balance FROM accounts WHERE email = ?").get(EMAIL).token_balance, 4);
  assert.equal(fixture.requests.length, 0);
}

describe("offline private design catalog without sales approval", { concurrency: false }, () => {
  function previewOnly() {
    const candidate = structuredClone(profile);
    candidate.id = "local-preview-only";
    delete candidate.fulfillment;
    runtime.profiles.splice(0);
    runtime.designProfiles.push(candidate);
    return candidate;
  }

  function anotherPreview(index) {
    const candidate = previewOnly();
    candidate.id += `-${index}`;
    candidate.printifyProductId += `-${index}`;
    candidate.shopifyProductId = `gid://shopify/Product/${1000 + index}`;
    candidate.variants[0].shopifyVariantId = `gid://shopify/ProductVariant/${2000 + index}`;
    candidate.variants[0].sku += `-${index}`;
    candidate.variants[0].mockup.url = `https://example.test/blank-${index}.png`;
    return candidate;
  }

  function candidateProduct(candidate) {
    return { id: candidate.printifyProductId, blueprint_id: candidate.blueprintId, print_provider_id: candidate.providerId,
      visible: false, images: candidate.variants.map(item => ({ src: item.mockup.url, position: item.area.position,
        variant_ids: [item.printifyVariantId] })),
      variants: candidate.variants.map(item => ({ id: item.printifyVariantId, sku: item.sku, is_enabled: true, is_available: true })) };
  }

  const candidatePath = candidate => `/v1/shops/${candidate.shopId}/products/${candidate.printifyProductId}.json`;

  test("the owner's real candidate is selectable without Shopify publication or a placeholder price", async () => {
    const candidate = previewOnly();
    const response = await getDesignCatalog(), body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.checkoutEnabled, false, "Even an enabled global flag cannot sell a design-only candidate");
    assert.equal(body.products.length, 1);
    assert.equal(body.products[0].id, candidate.id);
    assert.equal(body.products[0].purchaseReady, false);
    assert.match(body.products[0].blockedReason, /noch geprüft/);
    assert.equal(body.products[0].variants[0].price, null);
    assert.equal(body.products[0].variants[0].shopifyVariantId, variant.shopifyVariantId);
    assert.equal(fixture.requests.length, 2);
    assert.ok(fixture.requests.every(request => request.method === "GET" && request.url.startsWith("https://api.printify.com/")));
  });

  for (const [optionKey, optionLabel] of [["paper", "Papier"], ["surface", "Oberfläche"]]) {
    test(`a real ${optionKey} option is verified without inventing a garment color`, async () => {
      const candidate = previewOnly();
      candidate.optionKey = optionKey;
      candidate.variants[0].color = "Matte";
      fixture.changeProvider = provider => {
        delete provider.variants[0].options.color;
        provider.variants[0].options[optionKey] = "Matte";
      };
      const body = await (await getDesignCatalog()).json();
      assert.equal(body.products.length, 1);
      assert.equal(body.products[0].optionLabel, optionLabel);
      assert.equal(body.products[0].variants[0].color, "Matte");
      assert.equal(body.products[0].purchaseReady, false);
      fixture.changeProvider = provider => {
        delete provider.variants[0].options.color;
        provider.variants[0].options[optionKey] = "Glossy";
      };
      assert.deepEqual((await (await getDesignCatalog()).json()).products, []);
    });
  }

  test("a calibrated front camera tagged other needs explicit profile approval and the exact photo URL", async () => {
    const candidate = previewOnly();
    fixture.changeTemplate = product => { product.images[0].position = "other"; };
    assert.deepEqual((await (await getDesignCatalog()).json()).products, []);
    candidate.mockupPosition = "other";
    assert.equal((await (await getDesignCatalog()).json()).products.length, 1);
    fixture.changeTemplate = product => { product.images[0].position = "other"; product.images[0].src += "-unverified"; };
    assert.deepEqual((await (await getDesignCatalog()).json()).products, []);
  });

  for (const actor of [null, "customer@example.test"]) {
    test(`the unpublished candidate is hidden from ${actor || "anonymous users"} before provider access`, async () => {
      previewOnly(); runtime.actor = actor;
      process.env.CAPPATEX_GENERATION_AUDIENCE = "subscribers";
      const response = await getDesignCatalog(), body = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(body.products, []);
      assertNoTokensOrNetwork();
    });
  }

  for (const failure of ["network", "http", "invalid-json", "invalid-product"]) {
    test(`one product's ${failure} failure does not hide a working design candidate`, async () => {
      const working = previewOnly(), failing = anotherPreview(1);
      fixture.interceptFetch = (url, method) => {
        if (method !== "GET" || url.pathname !== candidatePath(failing)) return undefined;
        if (failure === "network") throw new TypeError("Synthetic product connection failure");
        if (failure === "http") return new Response("Unavailable", { status: 503 });
        if (failure === "invalid-json") return new Response("{", { headers: { "Content-Type": "application/json" } });
        return Response.json({ ...candidateProduct(failing), variants: "invalid provider payload" });
      };
      const response = await getDesignCatalog(), body = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(body.products.map(product => product.id), [working.id]);
      assert.equal(body.products[0].purchaseReady, false);
      assert.equal(body.products[0].variants[0].price, null);
      assert.equal(body.checkoutEnabled, false);
      assert.equal(fixture.requests.filter(request => request.url.includes("/print_providers/")).length, 1);
      assert.ok(fixture.requests.every(request => request.method === "GET"));
    });
  }

  test("one provider failure leaves products from another provider available", async () => {
    const working = previewOnly(), failing = anotherPreview(1);
    failing.providerId++;
    fixture.interceptFetch = (url, method) => {
      if (method !== "GET") return undefined;
      if (url.pathname === candidatePath(failing)) return Response.json(candidateProduct(failing));
      if (url.pathname === `/v1/catalog/blueprints/${failing.blueprintId}/print_providers/${failing.providerId}/variants.json`) {
        throw new TypeError("Synthetic provider connection failure");
      }
    };
    const response = await getDesignCatalog(), body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.products.map(product => product.id), [working.id]);
    assert.equal(body.checkoutEnabled, false);
    assert.ok(fixture.requests.every(request => request.method === "GET"));
  });

  for (const failure of ["network", 503, 429]) {
    test(`a transient ${failure} product read is retried once and revalidated`, async () => {
      const candidate = previewOnly();
      let attempts = 0;
      fixture.interceptFetch = (url, method) => {
        if (method !== "GET" || url.pathname !== candidatePath(candidate)) return undefined;
        if (++attempts === 1) {
          if (failure === "network") throw new TypeError("Temporary fixture network error");
          return new Response("Temporary fixture failure", { status: failure });
        }
        return undefined;
      };
      const body = await (await getDesignCatalog()).json();
      assert.equal(attempts, 2);
      assert.equal(body.products.length, 1);
      assert.equal(body.products[0].purchaseReady, false);
      assert.equal(body.checkoutEnabled, false);
    });
  }

  test("an unauthorized product read is not retried or replaced with an old variant", async () => {
    const candidate = previewOnly(); let attempts = 0;
    fixture.interceptFetch = (url, method) => {
      if (method === "GET" && url.pathname === candidatePath(candidate)) {
        attempts++; return new Response("Unauthorized fixture", { status: 401 });
      }
    };
    assert.deepEqual((await (await getDesignCatalog()).json()).products, []);
    assert.equal(attempts, 1);
  });

  test("at most three profiles run together, results stay ordered and provider reads are shared only per request", { timeout: 2000 }, async () => {
    const candidates = Array.from({ length: 6 }, (_, index) => anotherPreview(index + 1));
    const started = [], releases = new Map(), waiters = new Map();
    let active = 0, peak = 0, releaseImmediately = false;
    const waitForStarted = count => started.length >= count ? Promise.resolve()
      : new Promise(resolve => waiters.set(count, resolve));
    fixture.interceptFetch = (url, method) => {
      const candidate = candidates.find(item => candidatePath(item) === url.pathname);
      if (method !== "GET" || !candidate) return undefined;
      if (releaseImmediately) return Response.json(candidateProduct(candidate));
      active++; peak = Math.max(peak, active); started.push(candidate.id);
      const pending = new Promise(resolve => releases.set(candidate.id, () => {
        active--; releases.delete(candidate.id); resolve(Response.json(candidateProduct(candidate)));
      }));
      waiters.get(started.length)?.();
      return pending;
    };
    const pending = getDesignCatalog();
    await waitForStarted(3);
    assert.deepEqual(started, candidates.slice(0, 3).map(candidate => candidate.id));
    assert.equal(active, 3);
    const fourthStarted = waitForStarted(4);
    releases.get(candidates[2].id)();
    await fourthStarted;
    assert.equal(active, 3);
    releaseImmediately = true;
    for (const release of [...releases.values()]) release();
    const response = await pending, body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(peak, 3);
    assert.deepEqual(body.products.map(product => product.id), candidates.map(candidate => candidate.id));
    assert.ok(body.products.every(product => product.purchaseReady === false && product.variants[0].price === null));
    assert.equal(body.checkoutEnabled, false);
    assert.equal(fixture.requests.filter(request => request.url.includes("/print_providers/")).length, 1);

    fixture.changeProvider = provider => { provider.variants[0].placeholders[0].width++; };
    const refreshed = await (await getDesignCatalog()).json();
    assert.deepEqual(refreshed.products, [], "A new request rechecks provider geometry instead of retaining availability");
    assert.equal(fixture.requests.filter(request => request.url.includes("/print_providers/")).length, 2);
    assert.equal(fixture.requests.filter(request => request.url.includes("/products/")).length, 12);
    assert.ok(fixture.requests.every(request => request.method === "GET"));
  });

  for (const mismatch of ["unavailable", "geometry", "photo", "provider"]) {
    test(`a ${mismatch} mismatch removes the candidate from the design catalog`, async () => {
      previewOnly();
      if (mismatch === "geometry") fixture.changeProvider = provider => { provider.variants[0].placeholders[0].width++; };
      else fixture.changeTemplate = product => {
        if (mismatch === "unavailable") product.variants[0].is_available = false;
        if (mismatch === "photo") product.images[0].src = "https://example.test/changed.png";
        if (mismatch === "provider") product.print_provider_id++;
      };
      const response = await getDesignCatalog(), body = await response.json();
      assert.deepEqual(body.products, []);
      assert.equal(body.checkoutEnabled, false);
    });
  }

  test("a crafted checkout cannot promote the preview candidate into a paid snapshot", async () => {
    const candidate = previewOnly(), design = await seedDesign();
    const response = await callCheckout(design, { profileId: candidate.id, profileVersion: candidate.version });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "catalog_mismatch");
    assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS n FROM cappatex_snapshots").get().n, 0);
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.carts.length, 0);
  });
});

function callGeneration(canvas = "square") {
  return generateArtwork(new Request(`${APP_ORIGIN}/api/cappatex`, {
    method: "POST", headers: { Origin: APP_ORIGIN, Host: new URL(APP_ORIGIN).host, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "An alpine flower in warm colors", style: "Minimal", canvas, confirmGeneration: true }),
  }));
}

function assertImageRequest(canvas = "square") {
  const { prompt, ...configuration } = fixture.requests[0].body;
  assert.equal(typeof prompt, "string");
  assert.deepEqual(configuration, { model: "gpt-image-2.5-flare", n: 1,
    size: { square: "2048x2048", portrait: "2048x3072", landscape: "3072x2048" }[canvas],
    quality: "high", output_format: "png", background: "transparent", moderation: "auto" });
}

let generatedImage;
function allowOfflineGeneration() {
  process.env.CAPPATEX_GENERATION_ENABLED = "true";
  generatedImage ??= encode({ width: 2048, height: 2048, channels: 4, depth: 8,
    data: new Uint8Array(2048 * 2048 * 4).fill(127) });
  fixture.generatedImage = generatedImage;
}

describe("offline real CAPPATEX generation storage gates", { concurrency: false }, () => {
  for (const column of ["artwork_width", "preview_key"]) {
    test(`missing ${column} prevents an image request before a reservation or debit`, async () => {
      process.env.CAPPATEX_GENERATION_ENABLED = "true";
      fixture.db.sqlite.exec(`ALTER TABLE cappatex_designs DROP COLUMN ${column}`);
      const response = await callGeneration(), result = await response.json();
      assert.equal(response.status, 503);
      assert.equal(result.code, "design_storage_unavailable");
      assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS n FROM cappatex_designs").get().n, 0);
      assert.equal(fixture.bucket.objects.size, 0);
      assertNoTokensOrNetwork();
    });
  }

  test("a pilot owner saves one original and preview without spending a design token", async () => {
    allowOfflineGeneration();
    const response = await callGeneration(), result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    const row = fixture.db.sqlite.prepare("SELECT * FROM cappatex_designs WHERE id = ?").get(result.designId);
    assert.equal(row.status, "preview_ready");
    assert.equal(row.token_reserved, 0);
    assert.equal(row.artwork_sha256, await sha256(generatedImage));
    assert.equal(fixture.bucket.objects.size, 2);
    assert.equal(fixture.requests.length, 1);
    assertImageRequest();
    assert.equal((await callArtwork(result.designId)).status, 200);
    assert.equal(fixture.db.sqlite.prepare("SELECT token_balance FROM accounts WHERE email = ?").get(EMAIL).token_balance, 4);
    assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n, 0);
  });

  test("an ignored final update cannot return a successful preview", async () => {
    allowOfflineGeneration();
    fixture.db.sqlite.exec("CREATE TRIGGER ignore_artwork_save BEFORE UPDATE OF artwork_key ON cappatex_designs BEGIN SELECT RAISE(IGNORE); END");
    const response = await callGeneration(), result = await response.json();
    assert.equal(response.status, 500);
    assert.equal(result.code, "generation_failed");
    assert.equal(result.image, undefined);
    assert.equal(fixture.db.sqlite.prepare("SELECT status FROM cappatex_designs").get().status, "generation_failed");
    assert.equal(fixture.requests.length, 1);
  });

  test("an unknown update result fails closed without refunding a persisted successful image", async () => {
    allowOfflineGeneration();
    const prepare = fixture.db.prepare.bind(fixture.db);
    fixture.db.prepare = sql => {
      const statement = prepare(sql);
      if (!sql.startsWith("UPDATE cappatex_designs SET artwork_key")) return statement;
      return { bind: (...args) => ({ run: async () => {
        await statement.bind(...args).run();
        return { success: true, meta: {} };
      } }) };
    };
    const response = await callGeneration(), result = await response.json();
    assert.equal(response.status, 500);
    assert.equal(result.image, undefined);
    const row = fixture.db.sqlite.prepare("SELECT * FROM cappatex_designs").get();
    assert.equal(row.status, "preview_ready");
    assert.equal(row.token_refunded, 0);
    assert.equal((await callArtwork(row.id)).status, 200);
    assert.equal(fixture.requests.length, 1);
  });
});

describe("offline real CAPPATEX generation failure classification", { concurrency: false }, () => {
  function configureFailure(code, pilotOwner) {
    process.env.CAPPATEX_GENERATION_ENABLED = "true";
    process.env.CAPPATEX_GENERATION_AUDIENCE = pilotOwner ? "owner" : "subscribers";
    fixture.db.sqlite.prepare("UPDATE accounts SET plan = 'cappatex', subscription_status = 'active' WHERE email = ?").run(EMAIL);
    fixture.generationError = { status: 429, code };
  }

  function assertSingleFailedAttempt(pilotOwner, canvas = "square") {
    assert.equal(fixture.requests.length, 1, "No automatic image retry or billing request");
    assert.equal(fixture.requests[0].url, "https://api.openai.com/v1/images/generations");
    assertImageRequest(canvas);
    assert.equal(fixture.bucket.objects.size, 0);
    const rows = fixture.db.sqlite.prepare("SELECT status, token_reserved, token_refunded FROM cappatex_designs").all();
    assert.deepEqual(rows.map(row => ({ ...row })), [{ status: "generation_failed", token_reserved: pilotOwner ? 0 : 1, token_refunded: 1 }]);
    assert.equal(fixture.db.sqlite.prepare("SELECT token_balance FROM accounts WHERE email = ?").get(EMAIL).token_balance, 4);
    assert.deepEqual(fixture.db.sqlite.prepare("SELECT delta FROM token_ledger ORDER BY id").all().map(row => row.delta), pilotOwner ? [] : [-1, 1]);
  }

  for (const code of ["credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached"]) {
    for (const pilotOwner of [true, false]) {
      test(`${code} gives ${pilotOwner ? "the owner an API billing explanation" : "customers a generic service error and token refund"}`, async () => {
        configureFailure(code, pilotOwner);
        const response = await callGeneration(), result = await response.json();
        assert.equal(response.status, 503);
        assert.equal(result.code, "openai_billing_unavailable");
        if (pilotOwner) {
          assert.match(result.error, /API-Abrechnung/);
          assert.match(result.error, /kein automatischer weiterer Versuch/);
          assert.match(result.error, code === "credit_balance_exhausted" ? /Guthaben ist aufgebraucht/ : /limit/i);
        } else {
          assert.match(result.error, /nicht verfügbar/);
          assert.doesNotMatch(result.error, /OpenAI|Guthaben|Abrechnung|bezahlen|erneut|Synthetic/);
        }
        assert.equal(result.image, undefined);
        assertSingleFailedAttempt(pilotOwner);
      });
    }
  }

  test("a transient rate limit stays distinct and refunds exactly once without retrying", async () => {
    configureFailure("rate_limit_exceeded", false);
    const response = await callGeneration(), result = await response.json();
    assert.equal(response.status, 429);
    assert.equal(result.code, "rate_limited");
    assert.match(result.error, /ausgelastet/);
    assert.doesNotMatch(result.error, /Guthaben|Abrechnung|Synthetic/);
    assertSingleFailedAttempt(false);
  });

  for (const canvas of ["square", "portrait", "landscape"]) {
    for (const pilotOwner of [true, false]) {
      test(`a rejected transparent ${canvas} request gives ${pilotOwner ? "the owner a configuration hint" : "customers a neutral error and refund"}`, async t => {
        configureFailure("invalid_value", pilotOwner);
        fixture.generationError = { status: 400, code: "invalid_value", param: "background" };
        const log = t.mock.method(console, "error", () => {});
        const response = await callGeneration(canvas), result = await response.json();
        assert.equal(response.status, 503);
        assert.equal(result.code, "openai_configuration_error");
        if (pilotOwner) {
          assert.match(result.error, /serverseitige Bildkonfiguration/);
          assert.match(result.error, /kein automatischer weiterer Versuch/);
        } else {
          assert.match(result.error, /nicht verfügbar/);
          assert.doesNotMatch(result.error, /Modell|Bildparameter|Guthaben|erneut/);
        }
        assert.equal(log.mock.calls.length, 1);
        assert.equal(log.mock.calls[0].arguments[1].param, "background");
        assert.doesNotMatch(JSON.stringify(log.mock.calls[0].arguments), /Synthetic|Customer brief|alpine flower/);
        assert.doesNotMatch(result.error, /Synthetic|alpine flower/);
        assertSingleFailedAttempt(pilotOwner, canvas);
      });
    }
  }

  test("an unrecognized provider parameter is neither logged nor returned", async t => {
    configureFailure("invalid_value", true);
    fixture.generationError = { status: 400, code: "invalid_value", param: "private-prompt-marker" };
    const log = t.mock.method(console, "error", () => {});
    const response = await callGeneration(), result = await response.json();
    assert.equal(response.status, 503);
    assert.equal(result.code, "openai_configuration_error");
    assert.equal(log.mock.calls[0].arguments[1].param, undefined);
    assert.doesNotMatch(JSON.stringify(log.mock.calls[0].arguments), /private-prompt-marker|Synthetic/);
    assert.doesNotMatch(result.error, /private-prompt-marker|Synthetic/);
    assertSingleFailedAttempt(true);
  });
});

describe("offline real CAPPATEX upload and owned artwork routes", { concurrency: false }, () => {
  test("a colored odd-sized PNG keeps original bytes and hash, a deterministic ceil preview and free own-file download", async () => {
    const bytes = oddImageBytes(), response = await callUpload(bytes), uploaded = await response.json();
    assert.equal(response.status, 200, JSON.stringify(uploaded));
    assert.equal(uploaded.width, 9);
    assert.equal(uploaded.height, 5);
    assert.equal(uploaded.previewWidth, 3);
    assert.equal(uploaded.previewHeight, 2);
    assert.equal(uploaded.source, "upload");
    assert.equal(uploaded.format, "png");
    assert.equal(uploaded.sha256, await sha256(bytes));
    assert.equal(uploaded.image, `/api/cappatex/artwork/${uploaded.designId}`);
    assert.equal(Object.keys(uploaded).some(key => /key|base64/i.test(key)), false);
    const row = uploadRows()[0];
    assert.equal(row.id, uploaded.designId);
    assert.equal(row.email, EMAIL);
    assert.equal(row.status, "preview_ready");
    assert.equal(row.artwork_sha256, uploaded.sha256);
    assert.equal(row.artwork_width, 9);
    assert.equal(row.artwork_height, 5);
    assert.equal(row.token_reserved, 0);
    assert.equal(row.token_refunded, 0);
    assert.equal(fixture.bucket.objects.size, 2);
    assert.deepEqual(fixture.bucket.objects.get(row.artwork_key).bytes, bytes);
    const previewBytes = fixture.bucket.objects.get(row.preview_key).bytes;
    assert.equal(await sha256(previewBytes), row.preview_sha256);
    const preview = decode(previewBytes, { checkCrc: true });
    assert.equal(preview.width, 3);
    assert.equal(preview.height, 2);
    assert.deepEqual(Array.from(preview.data.slice(-4)), [216, 200, 70, 255]);
    const repeated = await callUpload(bytes), repeatedBody = await repeated.json();
    assert.equal(repeated.status, 200);
    const repeatedRow = uploadRows().find(value => value.id === repeatedBody.designId);
    assert.deepEqual(fixture.bucket.objects.get(repeatedRow.preview_key).bytes, previewBytes);
    assert.notEqual(repeatedRow.artwork_key, row.artwork_key, "Each design owns its storage key");
    const previewResponse = await callArtwork(uploaded.designId);
    assert.equal(previewResponse.status, 200);
    assert.equal(previewResponse.headers.get("Content-Type"), "image/png");
    assert.equal(previewResponse.headers.get("Cache-Control"), "private, no-store");
    assert.equal(previewResponse.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(new Uint8Array(await previewResponse.arrayBuffer()), previewBytes);
    const downloaded = await callArtwork(uploaded.designId, true);
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get("Content-Disposition"), `attachment; filename="${uploaded.designId}.png"`);
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), bytes);
    const account = fixture.db.sqlite.prepare("SELECT plan,subscription_status FROM accounts WHERE email = ?").get(EMAIL);
    assert.equal(account.plan, "free");
    assert.equal(account.subscription_status, "inactive");
    assertNoTokensOrNetwork();
  });

  test("upload is default-off and rejects wrong origin, no identity, unapproved owner, absent rights and wrong type before storage", async () => {
    const bytes = oddImageBytes();
    delete process.env.CAPPATEX_UPLOAD_ENABLED;
    let response = await callUpload(bytes);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "upload_disabled");
    process.env.CAPPATEX_UPLOAD_ENABLED = "true";
    response = await callUpload(bytes, { Origin: "https://foreign.example.test" });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "invalid_origin");
    runtime.actor = null;
    response = await callUpload(bytes);
    assert.equal(response.status, 401);
    runtime.actor = "another@example.test";
    response = await callUpload(bytes);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "upload_not_allowed");
    runtime.actor = EMAIL;
    response = await callUpload(bytes, { "X-Cappatex-Image-Rights": null });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "rights_required");
    response = await callUpload(bytes, { "Content-Type": "image/jpeg" });
    assert.equal(response.status, 415);
    assert.equal((await response.json()).code, "png_required");
    assert.equal(uploadRows().length, 0);
    assert.equal(fixture.bucket.objects.size, 0);
    assertNoTokensOrNetwork();
  });

  test("both declared and streamed actual body size are bounded, including missing or dishonest Content-Length", async () => {
    let response = await callUpload(oddImageBytes(), { "Content-Length": "12000001" });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, "upload_too_large");
    for (const contentLength of [null, "1"]) {
      let chunks = 0, cancelled = false;
      const stream = new ReadableStream({
        pull(controller) {
          chunks++;
          controller.enqueue(new Uint8Array(1_000_000));
          if (chunks === 20) controller.close();
        },
        cancel() { cancelled = true; },
      }, { highWaterMark: 0 });
      response = await callUpload(stream, { "Content-Length": contentLength });
      assert.equal(response.status, 413);
      assert.equal((await response.json()).code, "upload_too_large");
      assert.equal(cancelled, true);
      assert.equal(chunks, 13, "Read stops at the first over-limit chunk");
    }
    assert.equal(uploadRows().length, 3);
    assert.ok(uploadRows().every(row => row.status === "upload_failed"));
    assert.equal(fixture.bucket.objects.size, 0);
    assertNoTokensOrNetwork();
  });

  test("invalid PNG, excessive dimensions and transparent artwork are failed attempts with no R2 object", async () => {
    const oversized = oddImageBytes().slice();
    new DataView(oversized.buffer, oversized.byteOffset, oversized.byteLength).setUint32(16, 6145);
    for (const bytes of [new TextEncoder().encode("Not a PNG"), oversized, oddImageBytes(0)]) {
      const response = await callUpload(bytes);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, "invalid_image");
    }
    assert.equal(uploadRows().length, 3);
    assert.ok(uploadRows().every(row => row.status === "upload_failed" && row.artwork_key === null));
    assert.equal(fixture.bucket.objects.size, 0);
    assertNoTokensOrNetwork();
  });

  test("ten failed attempts consume the 24-hour quota and the eleventh does not read or store an image", async () => {
    for (let index = 0; index < 10; index++) assert.equal((await callUpload(new Uint8Array([0]))).status, 400);
    let reads = 0;
    const unread = new ReadableStream({ pull(controller) { reads++; controller.enqueue(oddImageBytes()); controller.close(); } }, { highWaterMark: 0 });
    const response = await callUpload(unread);
    assert.equal(response.status, 429);
    assert.equal((await response.json()).code, "upload_limit");
    assert.equal(reads, 0, "Quota is reserved before reading and decoding the body");
    assert.equal(uploadRows().length, 10);
    assert.equal(fixture.bucket.objects.size, 0);
    assertNoTokensOrNetwork();
  });

  test("concurrent failed attempts cannot exceed ten atomic upload reservations", async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, () => callUpload(new Uint8Array([0]))));
    assert.equal(responses.filter(response => response.status === 400).length, 10);
    assert.equal(responses.filter(response => response.status === 429).length, 10);
    assert.equal(uploadRows().length, 10);
    assert.ok(uploadRows().every(row => row.status === "upload_failed"));
    assert.equal(fixture.bucket.objects.size, 0);
    assertNoTokensOrNetwork();
  });

  test("storage failure keeps the upload failed, inaccessible and unavailable to checkout", async () => {
    let writes = 0;
    const put = fixture.bucket.put.bind(fixture.bucket);
    fixture.bucket.put = async (...args) => {
      writes++;
      if (writes === 2) throw new Error("Synthetic preview storage failure");
      return put(...args);
    };
    const response = await callUpload(imageBytes(31));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "upload_failed");
    const row = uploadRows()[0];
    assert.equal(row.status, "upload_failed");
    assert.equal(row.artwork_key, null);
    assert.equal(row.preview_key, null);
    assert.equal((await callArtwork(row.id)).status, 404);
    assert.equal((await callArtwork(row.id, true)).status, 404);
    const rejectedCheckout = await callCheckout({ id: row.id });
    assert.equal(rejectedCheckout.status, 409);
    assert.equal((await rejectedCheckout.json()).code, "design_not_ready");
    assert.equal(fixture.carts.length, 0);
    assert.equal(fixture.orders.length, 0);
    assertNoTokensOrNetwork();
  });

  test("artwork access hides storage keys from other owners and keeps generated HD files behind the existing plan", async () => {
    const uploaded = await (await callUpload(oddImageBytes())).json();
    const row = uploadRows()[0], originalGet = fixture.bucket.get.bind(fixture.bucket);
    let reads = 0;
    fixture.bucket.get = async (...args) => { reads++; return originalGet(...args); };
    runtime.actor = "another@example.test";
    for (const download of [false, true]) {
      const response = await callArtwork(uploaded.designId, download);
      assert.equal(response.status, 404);
      const body = await response.text();
      assert.equal(body.includes(row.artwork_key), false);
      assert.equal(body.includes(row.preview_key), false);
    }
    assert.equal(reads, 0);
    runtime.actor = null;
    assert.equal((await callArtwork(uploaded.designId)).status, 401);
    runtime.actor = EMAIL;
    const generated = await seedDesign();
    assert.equal((await callArtwork(generated.id, true)).status, 403);
    assert.equal(reads, 0);
    assertNoTokensOrNetwork();
  });

  test("altered stored original or preview cannot be returned through the owned artwork route", async () => {
    const uploaded = await (await callUpload(oddImageBytes())).json(), row = uploadRows()[0];
    await fixture.bucket.put(row.preview_key, oddImageBytes(128));
    assert.equal((await callArtwork(uploaded.designId)).status, 503);
    await fixture.bucket.put(row.artwork_key, oddImageBytes(128));
    assert.equal((await callArtwork(uploaded.designId, true)).status, 503);
    assertNoTokensOrNetwork();
  });

  test("own upload passes through real checkout, signed paid webhook and exactly one original-image Printify draft", async () => {
    const bytes = imageBytes(177), response = await callUpload(bytes), uploaded = await response.json();
    assert.equal(response.status, 200, JSON.stringify(uploaded));
    assertNoTokensOrNetwork();
    const snapshot = await checkedSnapshot({ id: uploaded.designId }, { country: "LI" });
    assert.equal(snapshot.artwork.sha256, await sha256(bytes));
    const order = paidOrder(snapshot), paid = await callWebhook(order);
    assert.equal(paid.status, 200);
    assert.equal((await paid.json()).status, "draft_ready");
    assert.equal(fixture.uploads.length, 1);
    assert.deepEqual(fixture.uploads[0].bytes, bytes);
    assert.equal(fixture.drafts.length, 1);
    assert.equal(fixture.orders.length, 1);
    assert.equal(fixture.orders[0].address_to.country, "LI");
    assert.equal(fixture.orders[0].line_items[0].external_id, snapshot.id);
    assert.equal(fixture.orders[0].line_items[0].product_id, fixture.drafts[0].id);
    await callWebhook(order, "local-upload-repeated-event");
    assert.equal(fixture.orders.length, 1);
    assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n, 0);
    assert.equal(fixture.db.sqlite.prepare("SELECT token_balance FROM accounts WHERE email = ?").get(EMAIL).token_balance, 4);
  });
});

describe("offline owned design metadata restoration", { concurrency: false }, () => {
  test("an owner restores the saved original dimensions and deterministic preview without storage writes or requests", async () => {
    const uploaded = await (await callUpload(oddImageBytes())).json();
    const before = fixture.db.sqlite.prepare("SELECT * FROM cappatex_designs").all();
    const accounts = fixture.db.sqlite.prepare("SELECT * FROM accounts").all();
    fixture.bucket.get = async () => { throw new Error("Metadata must not read image bytes"); };
    fixture.bucket.put = async () => { throw new Error("Metadata must not write image bytes"); };
    const response = await callDesignMetadata(uploaded.designId);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      designId: uploaded.designId, previewUrl: `/api/cappatex/artwork/${uploaded.designId}`,
      width: 9, height: 5, previewWidth: 3, previewHeight: 2, source: "upload", canDownloadOriginal: true,
    });
    assert.deepEqual(fixture.db.sqlite.prepare("SELECT * FROM cappatex_designs").all(), before);
    assert.deepEqual(fixture.db.sqlite.prepare("SELECT * FROM accounts").all(), accounts);
    assertNoTokensOrNetwork();
  });

  test("metadata hides foreign, absent, invalid and unfinished designs and requires identity", async () => {
    const uploaded = await (await callUpload(oddImageBytes())).json();
    const row = uploadRows()[0];
    runtime.actor = "another@example.test";
    for (const id of [uploaded.designId, "CPX-ZZZZZZZZZZZZ", "invalid-id"]) {
      const response = await callDesignMetadata(id);
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.deepEqual(await response.json(), { error: "Nicht gefunden" });
    }
    runtime.actor = null;
    assert.equal((await callDesignMetadata(uploaded.designId)).status, 401);
    runtime.actor = EMAIL;
    fixture.db.sqlite.prepare("UPDATE cappatex_designs SET status = 'upload_failed' WHERE id = ?").run(row.id);
    assert.equal((await callDesignMetadata(uploaded.designId)).status, 404);
    fixture.db.sqlite.prepare("UPDATE cappatex_designs SET status = 'preview_ready', preview_key = NULL WHERE id = ?").run(row.id);
    assert.equal((await callDesignMetadata(uploaded.designId)).status, 404);
    assertNoTokensOrNetwork();
  });

  test("restored generated artwork preserves the existing HD download entitlement without account mutation", async () => {
    const uploaded = await (await callUpload(oddImageBytes())).json();
    fixture.db.sqlite.prepare("UPDATE cappatex_designs SET style = 'Minimal' WHERE id = ?").run(uploaded.designId);
    const accountBefore = fixture.db.sqlite.prepare("SELECT * FROM accounts").get();
    let result = await (await callDesignMetadata(uploaded.designId)).json();
    assert.equal(result.source, "generated");
    assert.equal(result.canDownloadOriginal, false);
    assert.deepEqual(fixture.db.sqlite.prepare("SELECT * FROM accounts").get(), accountBefore);
    fixture.db.sqlite.prepare("UPDATE accounts SET plan = 'cappatex', subscription_status = 'active' WHERE email = ?").run(EMAIL);
    result = await (await callDesignMetadata(uploaded.designId)).json();
    assert.equal(result.canDownloadOriginal, true);
    fixture.db.sqlite.prepare("UPDATE accounts SET subscription_status = 'inactive' WHERE email = ?").run(EMAIL);
    assert.equal((await (await callDesignMetadata(uploaded.designId)).json()).canDownloadOriginal, false);
    process.env.AB3D_UNLIMITED_EMAILS = EMAIL;
    assert.equal((await (await callDesignMetadata(uploaded.designId)).json()).canDownloadOriginal, true);
    assertNoTokensOrNetwork();
  });
});

describe("offline real CAPPATEX checkout and paid-webhook routes", { concurrency: false }, () => {
  test("original bytes and immutable placement reach one unpublished draft; duplicate concurrent events create once", async () => {
    const design = await seedDesign(), snapshot = await checkedSnapshot(design, { quantity: 2 });
    assert.equal(snapshot.artwork.sha256, design.hash);
    assert.equal(snapshot.email, EMAIL);
    assert.equal(snapshot.artwork.key, design.key);
    const order = paidOrder(snapshot);
    const responses = await Promise.all([callWebhook(order), callWebhook(order), callWebhook(order, "local-event-0002")]);
    for (const response of responses) assert.equal(response.status, 200, await response.text());
    assert.equal((await callWebhook(order, "local-event-0003")).status, 200);
    assert.equal(fixture.uploads.length, 1);
    assert.deepEqual(fixture.uploads[0].bytes, design.bytes);
    assert.equal(fixture.uploads[0].fileName, `${design.id}.png`);
    assert.equal(fixture.drafts.length, 1);
    assert.deepEqual(fixture.drafts[0].print_areas[0].placeholders[0].images,
      [{ id: fixture.uploads[0].id, ...snapshot.placement, angle: 0 }]);
    assert.equal(fixture.orders.length, 1);
    assert.deepEqual(fixture.orders[0].line_items, [{ product_id: fixture.drafts[0].id, variant_id: 101, quantity: 2, external_id: snapshot.id }]);
    assert.equal(fixture.orders[0].external_id, "ab3d-501");
    assert.equal(fixture.orders[0].address_to.country, "CH");
    assert.equal(fulfillment().state, "draft_ready");
    assert.ok(fulfillment().request_sha256);
    assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS n FROM token_ledger").get().n, 0);
    assert.equal(fixture.db.sqlite.prepare("SELECT token_balance FROM accounts WHERE email = ?").get(EMAIL).token_balance, 4);
    assert.equal(fixture.requests.some(request => /send_to_production|publish|openai|meshy|preview-must-not/.test(request.url)), false);
  });

  test("two snapshots of the same blank keep different original images, placements and draft IDs", async () => {
    const firstDesign = await seedDesign("A", 31), secondDesign = await seedDesign("B", 211);
    const first = await checkedSnapshot(firstDesign);
    const second = await checkedSnapshot(secondDesign, { placement: { x: .65, y: .4, scale: .3 } });
    assert.notEqual(first.id, second.id);
    assert.notEqual(first.artwork.sha256, second.artwork.sha256);
    const response = await callWebhook(paidOrder([first, second]));
    assert.equal(response.status, 200, await response.text());
    assert.equal(fixture.orders.length, 1);
    assert.equal(fixture.uploads.length, 2);
    assert.equal(fixture.drafts.length, 2);
    assert.deepEqual(fixture.uploads.map(upload => upload.bytes), [firstDesign.bytes, secondDesign.bytes]);
    for (const [index, snapshot] of [first, second].entries()) {
      const row = fixture.db.sqlite.prepare("SELECT * FROM cappatex_fulfillment_lines WHERE snapshot_id = ?").get(snapshot.id);
      assert.equal(row.printify_image_id, fixture.uploads[index].id);
      assert.equal(row.printify_product_id, fixture.drafts[index].id);
      assert.deepEqual(fixture.drafts[index].print_areas[0].placeholders[0].images[0], { id: row.printify_image_id, ...snapshot.placement, angle: 0 });
      assert.equal(fixture.orders[0].line_items[index].product_id, row.printify_product_id);
    }
    assert.notEqual(fixture.orders[0].line_items[0].product_id, fixture.orders[0].line_items[1].product_id);
  });

  test("checkout rejects a foreign origin, missing identity, another owner and altered R2 artwork", async () => {
    const design = await seedDesign();
    assert.equal((await callCheckout(design, {}, "https://foreign.example.test")).status, 403);
    runtime.actor = null;
    assert.equal((await callCheckout(design)).status, 401);
    runtime.actor = "another@example.test";
    assert.equal((await callCheckout(design)).status, 409);
    runtime.actor = EMAIL;
    await fixture.bucket.put(design.key, imageBytes(222));
    const response = await callCheckout(design);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "artwork_changed");
    assert.equal(fixture.carts.length, 0);
    assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS n FROM cappatex_snapshots").get().n, 0);
  });

  test("Shopify repricing or warnings leave snapshots prepared and prevent the checkout redirect", async () => {
    const design = await seedDesign();
    fixture.changeCart = cart => { cart.lines.nodes[0].cost.amountPerQuantity.currencyCode = "EUR"; };
    let response = await callCheckout(design);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "cart_changed");
    fixture.changeCart = null;
    fixture.cartWarnings = [{ code: "MERCHANDISE_NOT_ENOUGH_STOCK" }];
    response = await callCheckout(design);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "cart_changed");
    assert.deepEqual(fixture.db.sqlite.prepare("SELECT state FROM cappatex_snapshots").all().map(row => row.state), ["prepared", "prepared"]);
    assert.equal(fixture.orders.length, 0);
  });

  test("Shopify changed line subtotals or discounts cannot advance the checkout snapshot", async () => {
    const design = await seedDesign();
    for (const field of ["subtotalAmount", "totalAmount"]) {
      fixture.changeCart = cart => { cart.lines.nodes[0].cost[field].amount = "59.00"; };
      const response = await callCheckout(design, { quantity: 2 });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, "cart_changed");
    }
    assert.deepEqual(fixture.db.sqlite.prepare("SELECT state FROM cappatex_snapshots").all().map(row => row.state), ["prepared", "prepared"]);
    assert.equal(fixture.orders.length, 0);
  });

  test("invalid signatures and unpaid events never record or fulfill an order", async () => {
    const snapshot = await checkedSnapshot(await seedDesign());
    const order = paidOrder(snapshot);
    assert.equal((await callWebhook(order, "local-event-bad-hmac", "invalid")).status, 401);
    assert.equal((await callWebhook({ ...order, financial_status: "pending" })).status, 400);
    assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS n FROM shopify_orders").get().n, 0);
    assert.equal(fixture.db.sqlite.prepare("SELECT COUNT(*) AS n FROM cappatex_fulfillments").get().n, 0);
    assert.equal(fixture.orders.length, 0);
  });

  test("changed paid lines are held and cannot become valid on a repeated delivery", async () => {
    const snapshot = await checkedSnapshot(await seedDesign()), original = paidOrder(snapshot);
    const changed = structuredClone(original);
    changed.line_items[0].price = "29.00";
    let response = await callWebhook(changed);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "manual_review");
    assert.equal(fulfillment().state, "manual_review");
    response = await callWebhook(original, "local-event-repriced");
    assert.equal((await response.json()).status, "order_changed_manual_review");
    assert.equal(fixture.orders.length, 0);
    assert.equal(fixture.uploads.length, 0);
  });

  test("discounts added after checkout require manual review without a Printify upload or order", async () => {
    const design = await seedDesign();
    let orderId = 510;
    for (const discount of [{ total_discount: "1.00" }, { discount_allocations: [{ amount: "1.00" }] }]) {
      const snapshot = await checkedSnapshot(design, { quantity: 2 });
      const order = paidOrder(snapshot, orderId++);
      Object.assign(order.line_items[0], discount);
      const response = await callWebhook(order, `local-discount-event-${order.id}`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, "manual_review");
      assert.equal(fulfillment(order.id).state, "manual_review");
    }
    assert.equal(fixture.uploads.length, 0);
    assert.equal(fixture.drafts.length, 0);
    assert.equal(fixture.orders.length, 0);
  });

  test("changed order after creation and reuse of a consumed snapshot never create another order", async () => {
    const snapshot = await checkedSnapshot(await seedDesign()), original = paidOrder(snapshot);
    assert.equal((await callWebhook(original)).status, 200);
    const changed = structuredClone(original);
    changed.line_items[0].quantity = 2;
    const response = await callWebhook(changed, "local-event-changed");
    assert.equal((await response.json()).status, "order_changed_manual_review");
    assert.equal(fulfillment().error_code, "order_changed");
    const reused = await callWebhook(paidOrder(snapshot, 502), "local-event-consumed");
    assert.equal((await reused.json()).status, "snapshot_already_consumed_manual_review");
    assert.equal(fulfillment(502).state, "manual_review");
    assert.equal(fixture.orders.length, 1);
    assert.equal(fixture.uploads.length, 1);
  });

  test("changed draft print method is held before order creation", async () => {
    const snapshot = await checkedSnapshot(await seedDesign());
    fixture.changeDraft = draft => { draft.print_areas[0].placeholders[0].decoration_method = "dtf"; };
    const order = paidOrder(snapshot), response = await callWebhook(order);
    assert.equal((await response.json()).status, "manual_review");
    assert.equal(fulfillment().state, "manual_review");
    assert.equal(fulfillment().error_code, "preparation_failed");
    await callWebhook(order, "local-event-held");
    assert.equal(fixture.drafts.length, 1);
    assert.equal(fixture.orders.length, 0);
  });

  test("company and address supplement remain separate; private addresses omit the company field", async () => {
    const design = await seedDesign();
    for (const [index, address] of [{ company: "Test AG", address2: "Tor 2" }, { address2: "Stock 3" }].entries()) {
      const snapshot = await checkedSnapshot(design), order = paidOrder(snapshot, 520 + index);
      Object.assign(order.shipping_address, address);
      const response = await callWebhook(order, `local-address-event-${order.id}`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, "draft_ready");
      const submitted = fixture.orders[index].address_to;
      assert.equal(submitted.address1, "Teststrasse 1");
      assert.equal(submitted.address2, address.address2);
      assert.equal(submitted.first_name, "Local");
      assert.equal(submitted.last_name, "Fixture");
      if (address.company) assert.equal(submitted.company, address.company);
      else assert.equal(Object.hasOwn(submitted, "company"), false);
    }
    assert.equal(fixture.orders.length, 2);
  });

  test("ambiguous order response stays locked and is not retried", async () => {
    const snapshot = await checkedSnapshot(await seedDesign()), order = paidOrder(snapshot);
    fixture.orderTimeout = true;
    const response = await callWebhook(order);
    assert.equal((await response.json()).status, "creation_uncertain");
    assert.equal(fulfillment().state, "creating");
    await Promise.all([callWebhook(order, "local-event-timeout-1"), callWebhook(order, "local-event-timeout-2")]);
    assert.equal(fixture.orders.length, 1);
    assert.equal(fixture.uploads.length, 1);
    assert.equal(fixture.drafts.length, 1);
  });
});
