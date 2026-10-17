import type { GalleryStudio } from "./gallery-policy";

export const collectionPath = (studio: GalleryStudio) => studio === "cappatex" ? "/cappatex/sammlung" : "/sammlung";
export const publicGalleryPath = (studio: GalleryStudio) => studio === "cappatex" ? "/cappatex/designs" : "/modelle";
export const galleryReviewPath = (studio: GalleryStudio) => studio === "cappatex" ? "/cappatex/galerie/pruefung" : "/galerie/pruefung";
export const galleryWorkPath = (studio: GalleryStudio, id: string) => `${studio === "cappatex" ? "/cappatex" : ""}/werke/${encodeURIComponent(id)}`;
