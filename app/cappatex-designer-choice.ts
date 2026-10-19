import type { CappatexDesignProduct } from "./cappatex-design-catalog";
import { initialPlacement, type ArtworkSize, type Placement } from "./cappatex-print-profile";
import { compositionKey, type CompositionDraft, type OwnedMotif } from "./cappatex-resume";

type Variant = CappatexDesignProduct["variants"][number];
export type MissingColorChoice = { ok: false; color: string; requestedSize: string; reason: string; options: Array<{ size: string; variantId: string }> };

/** A colour choice never grants permission to silently substitute another size. */
export function chooseColor(product: CappatexDesignProduct, color: string, size: string): { ok: true; variant: Variant } | MissingColorChoice {
  const candidates = product.variants.filter(v => v.color === color && v.available === true);
  const exact = candidates.filter(v => v.size === size);
  if (exact.length === 1) return { ok: true, variant: exact[0] };
  const options = candidates.filter(v => candidates.filter(other => other.size === v.size).length === 1)
    .map(v => ({ size: v.size, variantId: v.shopifyVariantId }));
  return { ok: false, color, requestedSize: size, options,
    reason: exact.length > 1 ? "Diese Farb- und Grössenkombination ist nicht eindeutig bestätigt. Deine bisherige Auswahl bleibt erhalten."
      : `${color} ist in ${size} nicht verfügbar.${options.length ? ` Verfügbare Grössen: ${options.map(v => v.size).join(", ")}.` : ""} Deine bisherige Auswahl bleibt erhalten.` };
}

/** Cards and product selection share one resolution rule, including independent front motifs. */
export function productFrontChoice(product: CappatexDesignProduct, preferredVariantId: string | undefined,
  drafts: Record<string, CompositionDraft>, motifs: Record<string, OwnedMotif>, fallback: { motif: OwnedMotif | null; artwork: ArtworkSize; placement?: Placement }) {
  const matches = preferredVariantId ? product.variants.filter(v => v.shopifyVariantId === preferredVariantId) : product.variants.slice(0, 1);
  const variant = matches[0];
  if (matches.length !== 1 || !variant || variant.available !== true)
    return { ok: false as const, reason: "Diese Produktvariante ist nicht mehr eindeutig verfügbar. Bitte prüfe Farbe und Grösse." };
  const draft = drafts[compositionKey(product.id, product.profileVersion, variant.shopifyVariantId)];
  const working = draft?.working.front;
  if (working) {
    const motif = motifs[working.designId];
    if (!motif || motif.designId !== working.designId)
      return { ok: false as const, reason: "Das gespeicherte Motiv dieser Variante muss erneut für dein Konto geladen werden." };
    return { ok: true as const, variant, motif, placement: { ...working.placement }, remembered: true };
  }
  return { ok: true as const, variant, motif: fallback.motif,
    placement: fallback.placement ? { ...fallback.placement } : initialPlacement(variant.area, fallback.motif || fallback.artwork), remembered: false };
}
