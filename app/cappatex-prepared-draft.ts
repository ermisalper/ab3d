import type { PreparedDesign, PrintSide } from "./cappatex-preparation";

type Uploads = Partial<Record<PrintSide, { id: string; width: number; height: number }>>;
/** Future fulfillment adapter only. No network call or sales approval is made here. */
export function preparedDraftPayload(saved: PreparedDesign, uploads: Uploads, templatePrice: number) {
  if (saved.schemaVersion !== 2 || !Number.isSafeInteger(templatePrice) || templatePrice <= 0
    || saved.sides.length < 1 || saved.sides.length > 2 || new Set(saved.sides.map(s => s.position)).size !== saved.sides.length
    || Object.keys(uploads).length !== saved.sides.length) throw new Error("invalid_prepared_draft");
  const placeholders = saved.sides.map(s => {
    const image = uploads[s.position];
    if (!image?.id || !["front", "back"].includes(s.position) || s.area.position !== s.position
      || s.file.width !== s.area.widthPx || s.file.height !== s.area.heightPx
      || image.width !== s.file.width || image.height !== s.file.height) throw new Error("prepared_upload_mismatch");
    return { position: s.position, images: [{ id: image.id, x: .5, y: .5, scale: 1, angle: 0 }] };
  });
  return { title: `CAPPATEX ${saved.id}`, description: "Gespeicherte Druckseiten. Nicht veröffentlichen.",
    blueprint_id: saved.blueprintId, print_provider_id: saved.providerId,
    variants: [{ id: saved.variant.printifyVariantId, price: templatePrice, is_enabled: true }],
    print_areas: [{ variant_ids: [saved.variant.printifyVariantId], placeholders }] };
}

export function preparedDraftMatches(draft: unknown, saved: PreparedDesign, uploads: Uploads) {
  try {
    preparedDraftPayload(saved, uploads, 1);
    type Draft = ReturnType<typeof preparedDraftPayload>;
    const d = draft as Draft & { id: string; visible: boolean; print_areas: Array<{ background?: string | null } & Draft["print_areas"][number]> };
    if (!d.id || d.visible !== false || d.blueprint_id !== saved.blueprintId || d.print_provider_id !== saved.providerId
      || d.variants.filter(v => v.is_enabled).length !== 1 || !d.variants.some(v => v.id === saved.variant.printifyVariantId && v.is_enabled)
      || d.print_areas.length !== 1) return false;
    const area = d.print_areas[0];
    if (area.variant_ids.length !== 1 || area.variant_ids[0] !== saved.variant.printifyVariantId
      || ![undefined, null, "transparent"].includes(area.background) || area.placeholders.length !== saved.sides.length) return false;
    return saved.sides.every(s => {
      const matches = area.placeholders.filter(p => p.position === s.position);
      const p = matches[0] as typeof matches[number] & { decoration_method?: string };
      return matches.length === 1 && p.decoration_method === s.area.decorationMethod && p.images.length === 1
        && p.images[0].id === uploads[s.position]!.id && p.images[0].x === .5 && p.images[0].y === .5
        && p.images[0].scale === 1 && p.images[0].angle === 0;
    });
  } catch { return false; }
}
