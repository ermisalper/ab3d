/** Owner dashboard summaries deliberately omit customers, addresses and artwork. */
export type FulfillmentRow = { id: string; external_id: string; state: string; printify_order_id: string | null;
  error_code: string | null; created_at: number; updated_at: number };

const states: Record<string, string> = {
  pending: "Eingegangen – noch nicht verarbeitet",
  preparing: "Druckauftrag wird vorbereitet",
  creating: "Auftragsanlage unbestätigt – in Printify abgleichen",
  draft_ready: "Printify-Auftrag angelegt – Produktionsfreigabe manuell prüfen",
  manual_review: "Manuelle Prüfung erforderlich",
};
const reasons: Record<string, string> = {
  order_changed: "Die Bestelldaten haben sich geändert.",
  snapshot_already_consumed: "Dieser gespeicherte Stand wurde bereits einem anderen Auftrag zugeordnet.",
  preparation_failed: "Druckdatei, Variante oder Freigabe konnte nicht bestätigt werden.",
};

export function fulfillmentSummary(row: FulfillmentRow, now = Date.now()) {
  const stalled = ["preparing", "creating"].includes(row.state) && now - row.updated_at >= 15 * 60_000;
  return { id: row.id, reference: row.external_id, state: row.state, label: states[row.state] || "Unbekannter Zustand – manuell prüfen",
    printifyOrderId: row.printify_order_id, createdAt: row.created_at, updatedAt: row.updated_at,
    reason: row.error_code ? reasons[row.error_code] || "Weitere Prüfung erforderlich." : null,
    needsReview: ["manual_review", "creating", "draft_ready"].includes(row.state) || stalled || !states[row.state], stalled };
}
