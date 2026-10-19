import { placementGeometry, type ArtworkSize, type Placement, type ProfileVariant } from "./cappatex-print-profile";

export type PrintRaster = { left: number; top: number; width: number; height: number; dpi: number };
type RasterReference = { area: ProfileVariant["area"]; artwork: ArtworkSize; placement: Placement;
  raster: Omit<PrintRaster, "dpi">; dpi: number };

function validCanvas(width: number, height: number) {
  return [width, height].every(value => Number.isSafeInteger(value) && value >= 1 && value <= 10000)
    && width * height <= 40_000_000;
}

/** Preserve rgba-area-v1's independent axis rounding; do not derive height from rounded width. */
export function printRaster(area: ProfileVariant["area"], artwork: ArtworkSize, placement: Placement): PrintRaster {
  const geometry = placementGeometry(area, artwork, placement);
  if (!geometry.ok) throw new Error("invalid_placement");
  if (!validCanvas(area.widthPx, area.heightPx)) throw new Error("print_area_too_large");
  if (![artwork.width, artwork.height].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error("invalid_raster_bounds");
  const width = Math.max(1, Math.round(geometry.width * area.widthPx));
  const height = Math.max(1, Math.round(geometry.height * area.heightPx));
  const left = Math.max(0, Math.min(area.widthPx - width, Math.round(placement.x * area.widthPx - width / 2)));
  const top = Math.max(0, Math.min(area.heightPx - height, Math.round(placement.y * area.heightPx - height / 2)));
  if (width > area.widthPx || height > area.heightPx || width > artwork.width || height > artwork.height)
    throw new Error("invalid_raster_bounds");
  return { left, top, width, height, dpi: geometry.dpi };
}

/** A bounded thumbnail of the final canvas, without enlarging small print files. */
export function printProofDimensions(width: number, height: number) {
  if (!validCanvas(width, height)) throw new Error("print_area_too_large");
  const scale = Math.min(1, 512 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Saved pixel coordinates and source DPI must describe the same approved placement. */
export function assertPreparedRaster(side: RasterReference): void {
  const expected = printRaster(side.area, side.artwork, side.placement);
  if (!side.raster || side.raster.left !== expected.left || side.raster.top !== expected.top
    || side.raster.width !== expected.width || side.raster.height !== expected.height || side.dpi !== expected.dpi)
    throw new Error("prepared_raster_changed");
}
