import { placementGeometry, type Placement, type ArtworkSize, type ProfileVariant } from "./cappatex-print-profile";
import type { CappatexDesignProduct } from "./cappatex-design-catalog";
import type { PreparationSummary, PrintSide } from "./cappatex-preparation";

export type OwnedMotif = { designId: string; previewUrl: string; width: number; height: number; previewWidth: number;
  previewHeight: number; source: "upload" | "generated"; canDownloadOriginal: boolean };
export type WorkingSide = { designId: string; placement: Placement };
export type DraftSelection = WorkingSide & { position: PrintSide; artwork: ArtworkSize;
  area: ProfileVariant["area"]; mockup: ProfileVariant["mockup"] };
export type CompositionDraft = { selections: DraftSelection[]; working: Partial<Record<PrintSide, WorkingSide>>;
  requestId: string; pendingSignature: string | null; savedSignature: string | null; copyOf?: string; receipt?: PreparationSummary };
export const emptyCompositionDraft = (): CompositionDraft => ({ selections: [], working: {}, requestId: "", pendingSignature: null, savedSignature: null });
export const compositionKey = (profileId: string, profileVersion: string, variantId: string) => JSON.stringify([profileId, profileVersion, variantId]);
const designIdValid = (id: unknown): id is string => typeof id === "string" && /^CPX-[A-Z0-9]{12}$/.test(id);
const requestIdValid = (id: unknown): id is string => typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b);

export function preparationRequestId(draft: CompositionDraft, signature: string, freshId: string) {
  if (requestIdValid(draft.requestId) && (draft.pendingSignature === null || draft.pendingSignature === signature)) return draft.requestId;
  if (!requestIdValid(freshId)) throw new Error("Ungültige Speicheranfrage.");
  return freshId;
}

/** Call only with the authenticated GET /designs/:id response, never a local ownership claim. */
export function ownedMotif(value: unknown, expectedId: string): OwnedMotif {
  const m = value as OwnedMotif | null;
  if (!m || !designIdValid(expectedId) || m.designId !== expectedId || m.previewUrl !== `/api/cappatex/artwork/${expectedId}`
    || ![m.width, m.height, m.previewWidth, m.previewHeight].every(n => Number.isSafeInteger(n) && n > 0)
    || m.previewWidth !== Math.ceil(m.width / 4) || m.previewHeight !== Math.ceil(m.height / 4)
    || !["upload", "generated"].includes(m.source) || typeof m.canDownloadOriginal !== "boolean") throw new Error("Ein eigenes Motiv konnte nicht eindeutig bestätigt werden.");
  return { designId: m.designId, previewUrl: m.previewUrl, width: m.width, height: m.height, previewWidth: m.previewWidth,
    previewHeight: m.previewHeight, source: m.source, canDownloadOriginal: m.canDownloadOriginal };
}

export function preparationDesignIds(value: unknown): string[] {
  const p = value as PreparationSummary | null;
  if (!p || p.schemaVersion !== 2 || !Array.isArray(p.sides) || p.sides.length < 1 || p.sides.length > 2
    || !p.sides.every(s => designIdValid(s?.designId))) throw new Error("Die gespeicherten Druckseiten sind unvollständig.");
  return [...new Set(p.sides.map(s => s.designId))];
}

/** A copy never carries the original request ID, price, consent or checkout approval. */
export function resumePreparation(preparation: PreparationSummary, products: CappatexDesignProduct[], motifsById: Record<string, OwnedMotif>, freshRequestId: string) {
  preparationDesignIds(preparation);
  if (!/^CPP-[a-f0-9]{32}$/.test(preparation.id) || !requestIdValid(freshRequestId)
    || !Number.isInteger(preparation.quantity) || preparation.quantity < 1 || preparation.quantity > 5 || !["CH", "LI"].includes(preparation.country))
    throw new Error("Dieser Gestaltungsstand kann nicht sicher als neue Kopie geladen werden.");
  const matches = products.filter(p => p.id === preparation.profileId && p.profileVersion === preparation.profileVersion);
  const product = matches[0];
  const variants = product?.variants.filter(v => v.shopifyVariantId === preparation.variant?.shopifyVariantId) || [];
  const variant = variants[0];
  if (matches.length !== 1 || variants.length !== 1 || !variant || variant.available !== true || !["shopifyVariantId", "printifyVariantId", "sku", "color", "size"]
    .every(key => variant[key as keyof typeof variant] === preparation.variant[key as keyof typeof preparation.variant]))
    throw new Error("Profilversion oder Produktvariante ist nicht mehr bestätigt. Der ursprüngliche Stand bleibt erhalten.");
  const seen = new Set<string>(), selections: DraftSelection[] = [], working: CompositionDraft["working"] = {};
  for (const saved of preparation.sides) {
    if (!["front", "back"].includes(saved.position) || seen.has(saved.position)) throw new Error("Die gespeicherten Druckseiten sind nicht eindeutig.");
    seen.add(saved.position);
    const current = saved.position === "front" ? variant : variant.back;
    const motif = motifsById[saved.designId];
    if (!motif || motif.designId !== saved.designId) throw new Error("Ein Motiv ist für dein Konto nicht mehr verfügbar.");
    ownedMotif(motif, saved.designId);
    if (!current || current.area.position !== saved.position || !equal(current.area, saved.area) || !equal(current.mockup, saved.mockup)
      || motif.width !== saved.artwork?.width || motif.height !== saved.artwork?.height
      || saved.file?.width !== current.area.widthPx || saved.file?.height !== current.area.heightPx
      || !saved.placement || !placementGeometry(current.area, motif, saved.placement).ok)
      throw new Error("Druckfläche, Produktansicht oder Motivplatzierung hat sich geändert. Die Kopie bleibt gesperrt.");
    const selection: DraftSelection = { position: saved.position, designId: saved.designId, placement: { ...saved.placement },
      artwork: { width: motif.width, height: motif.height }, area: structuredClone(current.area), mockup: structuredClone(current.mockup) };
    selections.push(selection); working[saved.position] = { designId: saved.designId, placement: { ...saved.placement } };
  }
  selections.sort((a, b) => a.position === b.position ? 0 : a.position === "front" ? -1 : 1);
  const draft: CompositionDraft = { selections, working, requestId: freshRequestId, pendingSignature: null, savedSignature: null, copyOf: preparation.id };
  return { profileId: product.id, profileVersion: product.profileVersion, variantId: variant.shopifyVariantId,
    quantity: preparation.quantity, country: preparation.country, side: selections[0].position, draft };
}
