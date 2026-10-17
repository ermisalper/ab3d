export const GALLERY_CONSENT_VERSION = "gallery-2026-10-17-v1";
export type GalleryStudio = "ab3d" | "cappatex";
export const GALLERY_CATEGORIES = {
  ab3d: { wohnen: "Wohnen & Deko", figuren: "Figuren & Tiere", personalisiert: "Persönliche Objekte", hobby: "Spiel & Hobby", sonstiges: "Weitere Modelle" },
  cappatex: { natur: "Natur & Tiere", schrift: "Schrift & Botschaften", kunst: "Kunst & Abstrakt", streetwear: "Retro & Streetwear", anlaesse: "Anlässe", sonstiges: "Weitere Motive" },
} as const;
export type GalleryChoice = { version: string; visibility: "private" | "public"; category: string; title: string; rightsConfirmed: boolean };
export type GalleryDraft = Omit<GalleryChoice,"visibility"> & { visibility: "" | "private" | "public" };
export const newGalleryDraft = (): GalleryDraft => ({version:GALLERY_CONSENT_VERSION,visibility:"",category:"sonstiges",title:"",rightsConfirmed:false});
export function parseGalleryChoice(value: unknown, studio: GalleryStudio): GalleryChoice {
  if (!value || typeof value !== "object") throw new Error("gallery_choice_required");
  const b = value as GalleryChoice;
  if (b.version !== GALLERY_CONSENT_VERSION || !["private","public"].includes(b.visibility)
    || !Object.hasOwn(GALLERY_CATEGORIES[studio],b.category) || typeof b.title !== "string" || b.title.trim().length > 80
    || typeof b.rightsConfirmed !== "boolean" || (b.visibility === "public" && b.rightsConfirmed !== true)) throw new Error("gallery_choice_required");
  return {version:b.version,visibility:b.visibility,category:b.category,title:b.title.trim() || (studio === "ab3d" ? "Meine 3D-Kreation" : "Mein Motiv"),rightsConfirmed:b.visibility === "public" && b.rightsConfirmed};
}
export function galleryChoiceValid(value: unknown, studio: GalleryStudio) {
  try { parseGalleryChoice(value,studio);return true; } catch { return false; }
}
