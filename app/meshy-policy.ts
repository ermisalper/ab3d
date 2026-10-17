/** Verified against Meshy's public API contract on 2026-10-17. No implicit `latest` upgrades. */
export const MESHY_STANDARD_MODEL = "meshy-7.1";
export const MESHY_PREVIEW_MODEL = "meshy-t2.5";

export function meshGeometry(quality: "fast" | "quality", multiImage = false) {
  if (quality === "fast" && !multiImage) return {
    ai_model: MESHY_PREVIEW_MODEL, model_type: "smart-topology", topology: "triangle", target_polycount: 15_000,
  };
  return { ai_model: MESHY_STANDARD_MODEL, ...(multiImage ? {} : { model_type: "standard" }),
    geometry_resolution: "standard", should_remesh: false };
}

export function printSize(heightCm: unknown) {
  if (typeof heightCm !== "number" || !Number.isFinite(heightCm) || heightCm < 2 || heightCm > 80)
    throw new Error("invalid_print_height");
  return { printer_type: "fdm" as const, intended_print_height_mm: Math.round(heightCm * 10) };
}

export type Printability = {
  status: "healthy" | "warning" | "error" | "unknown";
  issue_count: number; error_count: number; warning_count: number;
  metrics: { is_watertight: boolean; volume: number; non_manifold_edges: number; degenerate_faces: number; holes: number };
  intended_print?: { printer_type: string; height_mm: number; wall_thickness_mm: number };
  thin_walls?: { status: "healthy" | "warning" | "error" | "unknown"; has_thin_walls: boolean | null };
};

/** A topology-only or inconclusive report cannot approve a size-dependent print package. */
export function printReportVerified(report: Printability | null | undefined, heightCm: number) {
  return Boolean(report && report.status === "healthy" && report.error_count === 0 && report.warning_count === 0
    && report.metrics?.is_watertight === true && report.metrics.holes === 0 && report.metrics.non_manifold_edges === 0
    && report.metrics.degenerate_faces === 0 && report.metrics.volume > 0
    && report.intended_print?.printer_type === "fdm" && report.intended_print.height_mm === printSize(heightCm).intended_print_height_mm
    && report.intended_print.wall_thickness_mm >= 1
    // Meshy can flag tiny corners while the overall wall verdict remains healthy.
    && report.thin_walls?.status === "healthy");
}
