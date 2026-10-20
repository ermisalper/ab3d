import { productionInquiryDetails } from "./production-inquiry-details";

export const AB3D_REVIEW_STATES = ["new", "reviewing", "needs_information", "reviewed", "closed"] as const;
export type Ab3dReviewState = typeof AB3D_REVIEW_STATES[number];
export const AB3D_REVIEW_LABELS: Record<Ab3dReviewState, string> = {
  new: "Neu", reviewing: "In Prüfung", needs_information: "Rückfrage nötig", reviewed: "Geprüft", closed: "Abgeschlossen",
};
export const AB3D_ORDER_STATUS_LABELS: Record<string, string> = {
  inquiry: "Unverbindliche Anfrage", awaiting_payment: "Zahlung ausstehend", paid: "Zahlung bestätigt",
  production: "In Fertigung", shipped: "Versandt", cancelled: "Storniert",
};
export type ProductionRequestDetails = {
  name?: string; phone?: string; country?: "CH" | "LI"; postalCode?: string; city?: string; customerNote?: string;
};
export type Ab3dReviewSummary = { state: Ab3dReviewState; version: number; updatedAt: number | null };
export type Ab3dReview = Ab3dReviewSummary & { notes: string; updatedBy: string | null };
export type Ab3dOperationSummary = {
  id: string; email: string; status: string; sourceTaskId: string; sourceTaskType: string; sourceTaskStatus: string | null;
  templateName: string; heightMm: number; material: string; finish: string; quantity: number;
  estimatedTotalCents: number; currency: string; createdAt: number; updatedAt: number; review: Ab3dReviewSummary;
};
export type Ab3dOperationDetail = {
  order: Omit<Ab3dOperationSummary, "review"> & {
    requestDetails: ProductionRequestDetails | null; review: Ab3dReview;
    events: { version: number; state: Ab3dReviewState; actorEmail: string; createdAt: number }[];
  };
  files: { glb: string | null; stl: string | null; threeMf: string | null };
  inspectionNotice: string;
};

export const AB3D_OPERATION_ID = /^PRINT-[A-Z0-9]{10}$/;
export const AB3D_PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export const AB3D_INSPECTION_NOTICE = "Interne Datei zur Prüfung. Der Aufgabenstatus bestätigt weder Herstellbarkeit noch eine Zahlung. Vor einer Fertigung müssen Geometrie, Masse und Material geprüft werden.";

export function isAb3dReviewState(value: unknown): value is Ab3dReviewState {
  return typeof value === "string" && AB3D_REVIEW_STATES.includes(value as Ab3dReviewState);
}

/** Old inquiries deliberately have no contact snapshot. Ignore unknown or malformed stored fields. */
export function readProductionRequestDetails(value: string | null): ProductionRequestDetails | null {
  if (!value) return null;
  let data: unknown;
  try { data = JSON.parse(value); } catch { return null; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const result = productionInquiryDetails(data);
  return result && Object.keys(result).length ? result : null;
}
