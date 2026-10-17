import { placementGeometry, type ArtworkSize, type ProfileVariant } from "./cappatex-print-profile";

/** Resolution limits refer to the original pixels, never the smaller browser preview. */
export function maximumPrintSizeCm(artwork: ArtworkSize, minDpi: number) {
  if (![artwork.width, artwork.height].every(value => Number.isSafeInteger(value) && value > 0)
    || !Number.isFinite(minDpi) || minDpi <= 0) return null;
  return { maxWidthCm: artwork.width * 2.54 / minDpi, maxHeightCm: artwork.height * 2.54 / minDpi };
}

export function printSizeHelp(artwork: ArtworkSize, area: ProfileVariant["area"]) {
  const maximum = maximumPrintSizeCm(artwork, area.minDpi);
  if (!maximum || ![area.widthPx, area.heightPx, area.widthMm, area.heightMm, area.minScale, area.maxScale]
    .every(value => Number.isFinite(value) && value > 0) || area.minScale > area.maxScale || area.maxScale > 1) return null;
  // Covering the whole rectangle requires enough pixels along BOTH physical axes.
  // A different aspect ratio additionally leaves margins in this uncropped workflow.
  const fullAreaDpi = Math.min(artwork.width * 25.4 / area.widthMm, artwork.height * 25.4 / area.heightMm);
  const imageRatio = artwork.width / artwork.height, areaRatio = area.widthPx / area.heightPx;
  return { ...maximum, minDpi: area.minDpi, fullAreaDpi,
    insufficientResolutionForFullArea: fullAreaDpi < area.minDpi * (1 - 1e-9),
    aspectMatches: Math.abs(imageRatio / areaRatio - 1) <= 1e-9,
    canPlaceAtMinimumDpi: placementGeometry(area, artwork, { x: .5, y: .5, scale: area.minScale }).ok };
}
