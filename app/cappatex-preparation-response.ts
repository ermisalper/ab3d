import type { PreparationListItem, PreparationListResponse } from "./cappatex-preparation-list";
import { preparationInput, type PreparationInput, type PreparationSummary, type PrintSide } from "./cappatex-preparation";
import { assertPreparedRaster, printProofDimensions } from "./cappatex-print-raster";

const CPP_ID = /^CPP-[a-f0-9]{32}$/;
const CPX_ID = /^CPX-[A-Z0-9]{12}$/;
const MAX_DATE = 8_640_000_000_000_000;
const invalid = (): never => { throw new Error("invalid_preparation_response"); };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) return invalid();
  return value;
}
function number(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) return invalid();
  return value;
}
function integer(value: unknown, minimum: number, maximum: number): number {
  const result = number(value, minimum, maximum);
  return Number.isSafeInteger(result) ? result : invalid();
}
function id(value: unknown, pattern: RegExp): string {
  const result = text(value, 100);
  return pattern.test(result) ? result : invalid();
}
function position(value: unknown): PrintSide {
  return value === "front" || value === "back" ? value : invalid();
}
function country(value: unknown): "CH" | "LI" {
  return value === "CH" || value === "LI" ? value : invalid();
}
function dimensions(value: unknown, maximum = 10000) {
  const item = object(value);
  return { width: integer(item.width, 1, maximum), height: integer(item.height, 1, maximum) };
}
function sides(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return invalid();
  const result = value.map(object), positions = result.map(item => position(item.position));
  return new Set(positions).size === result.length ? result : invalid();
}
function previewUrl(value: unknown, designId: string) {
  return value === `/api/cappatex/artwork/${designId}` ? value : invalid();
}
function listItem(value: unknown): PreparationListItem {
  const item = object(value), base = { id: id(item.id, CPP_ID), createdAt: integer(item.createdAt, 0, MAX_DATE) };
  if (item.integrity === "unavailable") return { ...base, integrity: "unavailable" };
  if (item.integrity !== "verified") return invalid();
  const variant = object(item.variant);
  return { ...base, integrity: "verified", name: text(item.name, 200), profileId: text(item.profileId, 160),
    profileVersion: text(item.profileVersion, 160), variant: { color: text(variant.color, 100), size: text(variant.size, 100) },
    quantity: integer(item.quantity, 1, 5), country: country(item.country), sides: sides(item.sides).map(side => {
      const designId = id(side.designId, CPX_ID);
      return { position: position(side.position), designId, previewUrl: previewUrl(side.previewUrl, designId),
        file: dimensions(side.file), dpi: number(side.dpi, Number.MIN_VALUE, 1_000_000) };
    }) };
}

/** Validate a successful private API response, without trusting its extra fields. */
export function parsePreparationListResponse(value: unknown): PreparationListResponse {
  try {
    const response = object(value);
    if (!Array.isArray(response.items) || response.items.length > 12) return invalid();
    const items = response.items.map(listItem);
    if (new Set(items.map(item => item.id)).size !== items.length) return invalid();
    const cursor = response.nextCursor;
    // The server owns cursor versions and filter binding. Keep this opaque.
    if (cursor !== null && (typeof cursor !== "string" || cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor))) return invalid();
    return { items, nextCursor: cursor };
  } catch { throw new Error("Deine gespeicherten Gestaltungen konnten nicht sicher geladen werden. Bitte versuche es erneut."); }
}

function area(value: unknown, side: PrintSide) {
  const item = object(value);
  if (item.position !== side) return invalid();
  const result = { position: side, decorationMethod: text(item.decorationMethod, 64),
    widthPx: integer(item.widthPx, 1, 10000), heightPx: integer(item.heightPx, 1, 10000),
    widthMm: number(item.widthMm, Number.MIN_VALUE, 10000), heightMm: number(item.heightMm, Number.MIN_VALUE, 10000),
    minDpi: number(item.minDpi, Number.MIN_VALUE, 10000),
    minScale: number(item.minScale, Number.MIN_VALUE, 1), maxScale: number(item.maxScale, Number.MIN_VALUE, 1) };
  if (result.widthPx * result.heightPx > 40_000_000 || result.minScale > result.maxScale) return invalid();
  if (Math.abs((result.widthMm / result.heightMm) / (result.widthPx / result.heightPx) - 1) >= .001) return invalid();
  return result;
}
function mockup(value: unknown) {
  const item = object(value), size = dimensions(item);
  const url = text(item.url, 4096), parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.href !== url || size.width * size.height > 40_000_000) return invalid();
  const result = { url, ...size, left: number(item.left, 0, size.width), top: number(item.top, 0, size.height),
    printWidth: number(item.printWidth, Number.MIN_VALUE, size.width), printHeight: number(item.printHeight, Number.MIN_VALUE, size.height) };
  if (result.left + result.printWidth > size.width || result.top + result.printHeight > size.height) return invalid();
  if (item.foreground === undefined) return result;
  if (!Array.isArray(item.foreground) || item.foreground.length > 8) return invalid();
  const foreground: Array<Array<[number, number]>> = item.foreground.map(polygon => {
    if (!Array.isArray(polygon) || polygon.length < 3 || polygon.length > 64) return invalid();
    return polygon.map(point => {
      if (!Array.isArray(point) || point.length !== 2) return invalid();
      return [number(point[0], 0, size.width), number(point[1], 0, size.height)];
    });
  });
  return { ...result, foreground };
}
function detailSide(value: Record<string, unknown>, preparationId: string): PreparationSummary["sides"][number] {
  const side = position(value.position), designId = id(value.designId, CPX_ID), printArea = area(value.area, side);
  const artwork = dimensions(value.artwork, 6144), file = { ...dimensions(value.file), sha256: id(object(value.file).sha256, /^[a-f0-9]{64}$/) };
  if (artwork.width * artwork.height > 6_291_456 || file.width !== printArea.widthPx || file.height !== printArea.heightPx) return invalid();
  const p = object(value.placement), placement = { x: number(p.x, 0, 1), y: number(p.y, 0, 1), scale: number(p.scale, Number.MIN_VALUE, 1) };
  const photo = mockup(value.mockup);
  if (Math.abs(photo.printWidth / photo.printHeight - printArea.widthPx / printArea.heightPx) >= .01) return invalid();
  const r = object(value.raster), raster = { left: integer(r.left, 0, file.width), top: integer(r.top, 0, file.height),
    width: integer(r.width, 1, file.width), height: integer(r.height, 1, file.height) };
  if (raster.left + raster.width > file.width || raster.top + raster.height > file.height) return invalid();
  const downloadUrl = value.downloadUrl;
  if (downloadUrl !== null && downloadUrl !== `/api/cappatex/preparations/${preparationId}?side=${side}`) return invalid();
  let printPreview: PreparationSummary["sides"][number]["printPreview"] = null;
  if (value.printPreview !== null && value.printPreview !== undefined) {
    const proof = object(value.printPreview), size = printProofDimensions(file.width, file.height);
    const url = `/api/cappatex/preparations/${preparationId}?preview=${side}`;
    if (proof.url !== url || proof.width !== size.width || proof.height !== size.height || proof.sha256 !== file.sha256) return invalid();
    printPreview = { url, ...size, sha256: file.sha256 };
  }
  const result = { position: side, designId, area: printArea, mockup: photo, placement, artwork,
    dpi: number(value.dpi, printArea.minDpi, 1_000_000), raster, file, printPreview, previewUrl: previewUrl(value.previewUrl, designId), downloadUrl };
  assertPreparedRaster(result);
  return result;
}

/** Shape validation grants no ownership, image, price, checkout or production approval. */
export function parsePreparationResponse(value: unknown, expectedId?: string): PreparationSummary {
  try {
    const item = object(value), preparationId = id(item.id, CPP_ID);
    if ((expectedId !== undefined && preparationId !== id(expectedId, CPP_ID)) || item.schemaVersion !== 2) return invalid();
    const variant = object(item.variant), quantity = integer(item.quantity, 1, 5), checkout = object(item.checkout);
    if (typeof checkout.enabled !== "boolean" || typeof item.purchaseReady !== "boolean" || item.purchaseReady !== checkout.enabled) return invalid();
    const status: PreparationSummary["checkout"] = { enabled: checkout.enabled, reason: text(checkout.reason, 1000) };
    if (checkout.unitPriceCents !== undefined || checkout.currency !== undefined || checkout.enabled) {
      const cents = integer(checkout.unitPriceCents, 1, Number.MAX_SAFE_INTEGER);
      if (checkout.currency !== "CHF" || !Number.isSafeInteger(cents * quantity)) return invalid();
      status.unitPriceCents = cents; status.currency = "CHF";
    }
    return { id: preparationId, schemaVersion: 2, createdAt: integer(item.createdAt, 0, MAX_DATE), name: text(item.name, 200),
      profileId: text(item.profileId, 160), profileVersion: text(item.profileVersion, 160),
      variant: { shopifyVariantId: id(variant.shopifyVariantId, /^gid:\/\/shopify\/ProductVariant\/\d+$/),
        printifyVariantId: integer(variant.printifyVariantId, 1, Number.MAX_SAFE_INTEGER), sku: text(variant.sku, 200),
        color: text(variant.color, 100), size: text(variant.size, 100) },
      quantity, country: country(item.country), purchaseReady: item.purchaseReady, checkout: status,
      sides: sides(item.sides).map(side => detailSide(side, preparationId)) };
  } catch { throw new Error("Dein gespeicherter Gestaltungsstand konnte nicht sicher geladen werden. Bitte lade ihn erneut."); }
}

/** A successful save must confirm the submitted composition before its retry ID can be retired. */
export function parseSavedPreparationResponse(value: unknown, input: PreparationInput): PreparationSummary {
  try {
    const saved = parsePreparationResponse(value), expected = preparationInput(input);
    if (saved.profileId !== expected.profileId || saved.profileVersion !== expected.profileVersion
      || saved.variant.shopifyVariantId !== expected.shopifyVariantId || saved.quantity !== expected.quantity
      || saved.country !== expected.country || saved.sides.length !== expected.sides.length) return invalid();
    for (const side of saved.sides) {
      const submitted = expected.sides.find(candidate => candidate.position === side.position);
      if (!submitted || side.designId !== submitted.designId || side.placement.x !== submitted.placement.x
        || side.placement.y !== submitted.placement.y || side.placement.scale !== submitted.placement.scale) return invalid();
    }
    return saved;
  } catch { throw new Error("Die Speicherbestätigung passt nicht zu deiner Auswahl. Bitte prüfe dieselbe Speicherung erneut."); }
}
