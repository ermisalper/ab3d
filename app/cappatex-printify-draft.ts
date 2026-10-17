import type { LegacyCheckoutSnapshot } from "./cappatex-snapshot";

export function draftProductPayload(snapshot: LegacyCheckoutSnapshot, imageId: string, templatePrice: number) {
  if (!imageId || !Number.isInteger(templatePrice) || templatePrice <= 0) throw new Error("invalid_printify_template");
  return { title: `CAPPATEX ${snapshot.id}`, description: "Individuelles Kundendesign. Nicht veröffentlichen.",
    blueprint_id: snapshot.profile.blueprintId, print_provider_id: snapshot.profile.providerId,
    variants: [{ id: snapshot.variant.printifyVariantId, price: templatePrice, is_enabled: true }],
    print_areas: [{ variant_ids: [snapshot.variant.printifyVariantId], placeholders: [{ position: snapshot.variant.area.position,
      images: [{ id: imageId, ...snapshot.placement, angle: 0 }] }] }] };
}

type Draft = { id?: string; visible?: boolean; blueprint_id?: number; print_provider_id?: number;
  variants?: Array<{ id: number; is_enabled: boolean }>;
  print_areas?: Array<{ variant_ids: number[]; background?: string | null; placeholders: Array<{ position: string; decoration_method?: string; images: Array<{ id: string; x: number; y: number; scale: number; angle: number }> }> }> };

export function draftMatchesSnapshot(draft: Draft, snapshot: LegacyCheckoutSnapshot, imageId: string) {
  const areas = draft.print_areas?.filter(area => area.variant_ids.includes(snapshot.variant.printifyVariantId));
  const positions = areas?.flatMap(area => area.placeholders);
  const images = positions?.[0]?.images;
  const image = images?.[0];
  return Boolean(draft.id && draft.visible === false && draft.blueprint_id === snapshot.profile.blueprintId
    && draft.print_provider_id === snapshot.profile.providerId
    && draft.variants?.filter(variant => variant.is_enabled).length === 1
    && draft.variants?.some(variant => variant.id === snapshot.variant.printifyVariantId && variant.is_enabled)
    // The audited provider response uses exactly "transparent" for no fill; any other string changes the approved print.
    && areas?.length === 1 && (areas[0].background === undefined || areas[0].background === null || areas[0].background === "transparent")
    // Do not admit additional care-label layers until they can be preserved and verified exactly.
    && positions?.length === 1 && positions[0].position === snapshot.variant.area.position
    // Printify selects the method from the placeholder; it is read-only, so verify the response.
    && positions[0].decoration_method === snapshot.variant.area.decorationMethod
    && images?.length === 1 && image?.id === imageId && image.angle === 0
    && ["x","y","scale"].every(key => Math.abs(image[key as "x" | "y" | "scale"] - snapshot.placement[key as "x" | "y" | "scale"]) < 1e-8));
}
