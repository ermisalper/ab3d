import { sha256 } from "./cappatex-artwork";

export const PREPARATION_LIST_SIZE = 12;
export const PREPARATION_LIST_MAX_QUERY_LENGTH = 80;
const CPP_ID = /^CPP-[a-f0-9]{32}$/;
const MAX_DATE = 8_640_000_000_000_000;
type ListBase = { id: string; createdAt: number };
export type PreparationListItem = ListBase & ({ integrity: "unavailable" } | {
  integrity: "verified"; name: string; profileId: string; profileVersion: string;
  variant: { color: string; size: string }; quantity: number; country: "CH" | "LI";
  sides: Array<{ position: "front" | "back"; designId: string; previewUrl: string;
    file: { width: number; height: number }; dpi: number }>;
});
export type PreparationListResponse = { items: PreparationListItem[]; nextCursor: string | null };
export type PreparationListRow = { id: string; created_at: number; payload_json: string | null; payload_sha256: string | null };
export type PreparationListCursor = { createdAt: number; id: string };
export type PreparationListFilters = { q: string; sides: "front" | "back" | "both" | null };

export function preparationListFilters(q: string | null = null, sides: string | null = null): PreparationListFilters {
  const term = q === null ? "" : q.trim();
  if (term.length > PREPARATION_LIST_MAX_QUERY_LENGTH || (sides !== null && !["front", "back", "both"].includes(sides)))
    throw new Error("invalid_preparation_filters");
  return { q: term, sides: sides as PreparationListFilters["sides"] };
}

function validDate(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_DATE;
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function dimension(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 10000;
}

function encodeCursor(value: Record<string, unknown>) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function preparationListCursor(value: PreparationListCursor, filters: PreparationListFilters = { q: "", sides: null }) {
  if (!validDate(value.createdAt) || !CPP_ID.test(value.id)) throw new Error("invalid_preparation_cursor");
  const normalized = preparationListFilters(filters.q, filters.sides);
  return encodeCursor({ v: 2, createdAt: value.createdAt, id: value.id, q: normalized.q, sides: normalized.sides });
}

export function parsePreparationListCursor(value: string | null, filters: PreparationListFilters = { q: "", sides: null }): PreparationListCursor | null {
  if (value === null) return null;
  if (!value || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_preparation_cursor");
  try {
    const decoded: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), character => character.charCodeAt(0))));
    if (!record(decoded) || !validDate(decoded.createdAt)
      || typeof decoded.id !== "string" || !CPP_ID.test(decoded.id)) throw new Error("invalid_preparation_cursor");
    const cursor = { createdAt: decoded.createdAt, id: decoded.id };
    const expected = preparationListFilters(filters.q, filters.sides);
    if (decoded.v === 1) {
      if (Object.keys(decoded).length !== 3 || expected.q || expected.sides
        || encodeCursor({ v: 1, ...cursor }) !== value) throw new Error("invalid_preparation_cursor");
    } else if (decoded.v === 2) {
      if (Object.keys(decoded).length !== 5 || decoded.q !== expected.q || decoded.sides !== expected.sides
        || preparationListCursor(cursor, expected) !== value) throw new Error("invalid_preparation_cursor");
    } else throw new Error("invalid_preparation_cursor");
    return cursor;
  } catch { throw new Error("invalid_preparation_cursor"); }
}

/** Recheck only the SHA-verified DTO, never search private payload fields or a corrupt candidate. */
export function preparationListMatchesFilters(item: PreparationListItem, filters: PreparationListFilters): boolean {
  if (!filters.q && !filters.sides) return true;
  if (item.integrity !== "verified") return false;
  if (filters.sides === "both" ? item.sides.length !== 2
    : filters.sides !== null && (item.sides.length !== 1 || item.sides[0].position !== filters.sides)) return false;
  // Match SQLite's default lower() semantics; no ICU/Unicode case-folding is assumed.
  const fold = (value: string) => value.replace(/[A-Z]/g, character => character.toLowerCase());
  return !filters.q || [item.name, item.variant.color, item.variant.size, ...item.sides.map(side => side.designId)]
    .some(value => fold(value).includes(fold(filters.q)));
}

/** List integrity confirms the stored metadata, not current availability or a sales/production approval. */
export async function preparationListItem(row: PreparationListRow): Promise<PreparationListItem> {
  const unavailable: PreparationListItem = { id: row.id, createdAt: row.created_at, integrity: "unavailable" };
  try {
    if (!row.payload_json || row.payload_json.length > 256_000 || !row.payload_sha256 || !/^[a-f0-9]{64}$/.test(row.payload_sha256)
      || await sha256(row.payload_json) !== row.payload_sha256) return unavailable;
    const saved: unknown = JSON.parse(row.payload_json);
    if (!record(saved) || saved.schemaVersion !== 2 || saved.id !== row.id || saved.createdAt !== row.created_at
      || !text(saved.name, 200) || !text(saved.profileId, 160) || !text(saved.profileVersion, 160)
      || !record(saved.variant) || !text(saved.variant.color, 100) || !text(saved.variant.size, 100)
      || typeof saved.quantity !== "number" || !Number.isInteger(saved.quantity) || saved.quantity < 1 || saved.quantity > 5
      || (saved.country !== "CH" && saved.country !== "LI") || !Array.isArray(saved.sides) || saved.sides.length < 1 || saved.sides.length > 2) return unavailable;
    const sides: Extract<PreparationListItem, { integrity: "verified" }>["sides"] = [];
    const positions = new Set<string>();
    for (const side of saved.sides) {
      if (!record(side) || (side.position !== "front" && side.position !== "back") || positions.has(side.position)
        || typeof side.designId !== "string" || !/^CPX-[A-Z0-9]{12}$/.test(side.designId)
        || !record(side.file) || !dimension(side.file.width) || !dimension(side.file.height)
        || typeof side.dpi !== "number" || !Number.isFinite(side.dpi) || side.dpi <= 0) return unavailable;
      positions.add(side.position);
      sides.push({ position: side.position, designId: side.designId, previewUrl: `/api/cappatex/artwork/${side.designId}`,
        file: { width: side.file.width, height: side.file.height }, dpi: side.dpi });
    }
    return { id: row.id, createdAt: row.created_at, integrity: "verified", name: saved.name, profileId: saved.profileId,
      profileVersion: saved.profileVersion, variant: { color: saved.variant.color, size: saved.variant.size },
      quantity: saved.quantity, country: saved.country, sides };
  } catch { return unavailable; }
}
