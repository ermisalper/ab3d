import type { CappatexDesignProduct } from "./cappatex-design-catalog";
import { placementGeometry, type Placement } from "./cappatex-print-profile";
import type { PrintSide } from "./cappatex-preparation";
import { compositionKey, ownedMotif, type CompositionDraft, type OwnedMotif } from "./cappatex-resume";

type SideReference = { position: PrintSide; designId: string; placement: Placement; width: number; height: number };
export type SessionDraft = { version: 1; profileId: string; profileVersion: string; variantId: string; calibration: string;
  quantity: number; country: "CH" | "LI"; side: PrintSide; working: SideReference[]; selections: SideReference[];
  requestId: string; pendingSignature: string | null; savedSignature: string | null; copyOf?: string; receiptId?: string };
const uuid = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
const cpp = (id: unknown): id is string => typeof id === "string" && /^CPP-[a-f0-9]{32}$/.test(id);
const variantCalibration = (variant: CappatexDesignProduct["variants"][number]) => JSON.stringify({ shopifyVariantId: variant.shopifyVariantId,
  printifyVariantId: variant.printifyVariantId, sku: variant.sku, color: variant.color, size: variant.size, area: variant.area, mockup: variant.mockup,
  back: variant.back ? { area: variant.back.area, mockup: variant.back.mockup } : null });

/** Only IDs, geometry references and retry bookkeeping. Never include artwork bytes or approvals. */
export function serializeSessionDraft(product: CappatexDesignProduct, variant: CappatexDesignProduct["variants"][number], draft: CompositionDraft,
  motifs: Record<string, OwnedMotif>, quantity: number, country: "CH" | "LI", side: PrintSide) {
  const reference = (position: PrintSide, designId: string, placement: Placement): SideReference => {
    const motif = motifs[designId];
    if (!motif) throw new Error("Unbestätigtes Motiv.");
    return { position, designId, placement: { ...placement }, width: motif.width, height: motif.height };
  };
  const result: SessionDraft = { version: 1, profileId: product.id, profileVersion: product.profileVersion, variantId: variant.shopifyVariantId,
    calibration: variantCalibration(variant), quantity, country, side,
    working: Object.entries(draft.working).filter(([, value]) => value).map(([position, value]) => reference(position as PrintSide, value!.designId, value!.placement)),
    selections: draft.selections.map(value => reference(value.position, value.designId, value.placement)),
    requestId: draft.requestId, pendingSignature: draft.pendingSignature, savedSignature: draft.savedSignature,
    ...(draft.copyOf ? { copyOf: draft.copyOf } : {}), ...(draft.receipt ? { receiptId: draft.receipt.id } : {}) };
  const text = JSON.stringify(result);
  if (!parseSessionDraft(text)) throw new Error("Der Sitzungsentwurf ist unvollständig.");
  return text;
}

export function parseSessionDraft(text: string | null): SessionDraft | null {
  if (!text || text.length > 30_000) return null;
  try {
    const value = JSON.parse(text) as SessionDraft;
    const referencesValid = (refs: SideReference[]) => Array.isArray(refs) && refs.length <= 2
      && new Set(refs.map(r => r.position)).size === refs.length && refs.every(r => r && ["front", "back"].includes(r.position)
        && /^CPX-[A-Z0-9]{12}$/.test(r.designId) && Number.isSafeInteger(r.width) && r.width > 0 && Number.isSafeInteger(r.height) && r.height > 0
        && r.placement && [r.placement.x, r.placement.y, r.placement.scale].every(n => typeof n === "number" && Number.isFinite(n))
        && r.placement.x >= 0 && r.placement.x <= 1 && r.placement.y >= 0 && r.placement.y <= 1 && r.placement.scale > 0 && r.placement.scale <= 1);
    if (!value || value.version !== 1 || ![value.profileId, value.profileVersion, value.calibration].every(v => typeof v === "string" && v.length > 0 && v.length < 12_000)
      || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(value.variantId) || !Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 5
      || !["CH", "LI"].includes(value.country) || !["front", "back"].includes(value.side) || !referencesValid(value.working) || !referencesValid(value.selections)
      || !value.working.some(r => r.position === value.side) || typeof value.requestId !== "string" || (value.requestId !== "" && !uuid(value.requestId))
      || ![value.pendingSignature, value.savedSignature].every(v => v === null || typeof v === "string" && v.length < 8000)
      || (value.copyOf !== undefined && !cpp(value.copyOf)) || (value.receiptId !== undefined && !cpp(value.receiptId))) return null;
    return value;
  } catch { return null; }
}

export const sessionDraftDesignIds = (reference: SessionDraft) => [...new Set([...reference.working, ...reference.selections].map(r => r.designId))];

/** Every referenced motif must first be fetched again through its authenticated ownership endpoint. */
export function hydrateSessionDraft(reference: SessionDraft, products: CappatexDesignProduct[], motifs: Record<string, OwnedMotif>) {
  const matches = products.filter(p => p.id === reference.profileId && p.profileVersion === reference.profileVersion), product = matches[0];
  const variants = product?.variants.filter(v => v.shopifyVariantId === reference.variantId) || [], variant = variants[0];
  if (matches.length !== 1 || variants.length !== 1 || !product || !variant || variant.available !== true || variantCalibration(variant) !== reference.calibration)
    throw new Error("Der Sitzungsentwurf passt nicht mehr zum aktuellen Druckprofil.");
  const currentSide = (r: SideReference) => {
    const motif = motifs[r.designId], geometry = r.position === "front" ? variant : variant.back;
    if (!motif || motif.designId !== r.designId || motif.width !== r.width || motif.height !== r.height || !geometry || geometry.area.position !== r.position)
      throw new Error("Ein Motiv oder eine Druckseite des Sitzungsentwurfs ist nicht mehr bestätigt.");
    ownedMotif(motif, r.designId);
    return { motif, geometry };
  };
  const working: CompositionDraft["working"] = {};
  for (const r of reference.working) { currentSide(r); working[r.position] = { designId: r.designId, placement: { ...r.placement } }; }
  const selections = reference.selections.map(r => {
    const { motif, geometry } = currentSide(r);
    if (!placementGeometry(geometry.area, motif, r.placement).ok) throw new Error("Eine übernommene Druckseite muss erneut geprüft werden.");
    return { position: r.position, designId: r.designId, placement: { ...r.placement }, artwork: { width: motif.width, height: motif.height },
      area: structuredClone(geometry.area), mockup: structuredClone(geometry.mockup) };
  });
  const draft: CompositionDraft = { selections, working, requestId: reference.requestId, pendingSignature: reference.pendingSignature,
    savedSignature: null, ...(reference.copyOf ? { copyOf: reference.copyOf } : {}) };
  return { product, variant, key: compositionKey(product.id, product.profileVersion, variant.shopifyVariantId), draft };
}
