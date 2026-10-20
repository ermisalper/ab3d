/** Internal estimates only. Amounts are integer CHF cents; null always means unknown. */
export const OFFER_COST_KEYS = ["material", "printing", "finishing", "packaging", "shipping", "external", "other"] as const;
export type OfferCostKey = typeof OFFER_COST_KEYS[number];
export const COST_LABELS: Record<OfferCostKey, string> = {
  material: "Materialkosten", printing: "Druckbetrieb / Maschine", finishing: "Nachbearbeitung",
  packaging: "Verpackung", shipping: "Versand", external: "Externe Fertigung", other: "Weitere Kosten",
};
export type OfferCost = { state: "open" | "included" | "excluded"; oneOffCents: number | null; perUnitCents: number | null };
export type ProductionOfferPayload = {
  schemaVersion: 1; fulfillment: "open" | "own" | "external"; supplierReference: string | null;
  material: string | null; color: string | null; dimensionsMm: { width: string | null; depth: string | null; height: string | null };
  quantity: number | null; printMinutesPerUnit: number | null; plannedSaleTotalCents: number | null;
  notes: string | null; costs: Record<OfferCostKey, OfferCost>;
};
export type OfferCalculation = {
  knownOneOffCents: number | null; knownPerUnitCents: number | null; knownTotalCents: number | null;
  totalCostCents: number | null; revenueCents: number | null; marginCents: number | null; marginBasisPoints: number | null;
  openCostItems: string[]; costsComplete: boolean;
};
export type ProductionOfferDto = {
  orderId: string; version: number; payload: ProductionOfferPayload; calculation: OfferCalculation;
  updatedAt: number | null; updatedBy: string | null;
  events: Array<{ version: number; actorEmail: string; createdAt: number }>;
  sheet: Array<{ label: string; value: string }>;
};
const MAX_CENTS = 100_000_000;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const hasOnly = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const optionalInteger = (value: unknown, min: number, max: number) => value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max);
function text(value: unknown, max: number, multiline = false): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/ : /[\u0000-\u001f\u007f-\u009f]/).test(value)) throw new Error("invalid_offer");
  return value.trim() || null;
}
function dimension(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{1,5}(?:\.\d{1,3})?$/.test(value)) throw new Error("invalid_offer");
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * BigInt(1000) + BigInt(fraction.padEnd(3, "0"));
  if (units < BigInt(1) || units > BigInt(10_000_000)) throw new Error("invalid_offer");
  const decimal = fraction.replace(/0+$/, "");
  return `${BigInt(whole)}${decimal ? `.${decimal}` : ""}`;
}
export function emptyProductionOffer(): ProductionOfferPayload {
  return { schemaVersion: 1, fulfillment: "open", supplierReference: null, material: null, color: null,
    dimensionsMm: { width: null, depth: null, height: null }, quantity: null, printMinutesPerUnit: null,
    plannedSaleTotalCents: null, notes: null,
    costs: Object.fromEntries(OFFER_COST_KEYS.map(key => [key, { state: "open", oneOffCents: null, perUnitCents: null }])) as ProductionOfferPayload["costs"] };
}
export function parseProductionOffer(value: unknown): ProductionOfferPayload {
  if (!isRecord(value) || !hasOnly(value, ["schemaVersion", "fulfillment", "supplierReference", "material", "color", "dimensionsMm", "quantity", "printMinutesPerUnit", "plannedSaleTotalCents", "notes", "costs"])
    || value.schemaVersion !== 1 || !["open", "own", "external"].includes(value.fulfillment as string)
    || !optionalInteger(value.quantity, 1, 1000) || !optionalInteger(value.printMinutesPerUnit, 0, 1_000_000)
    || !optionalInteger(value.plannedSaleTotalCents, 0, MAX_CENTS)
    || !isRecord(value.dimensionsMm) || !hasOnly(value.dimensionsMm, ["width", "depth", "height"])
    || !isRecord(value.costs) || !hasOnly(value.costs, OFFER_COST_KEYS)) throw new Error("invalid_offer");
  const costs = {} as ProductionOfferPayload["costs"];
  for (const key of OFFER_COST_KEYS) {
    const cost = value.costs[key];
    if (!isRecord(cost) || !hasOnly(cost, ["state", "oneOffCents", "perUnitCents"])
      || !["open", "included", "excluded"].includes(cost.state as string)
      || !optionalInteger(cost.oneOffCents, 0, MAX_CENTS) || !optionalInteger(cost.perUnitCents, 0, MAX_CENTS)) throw new Error("invalid_offer");
    costs[key] = { state: cost.state as OfferCost["state"], oneOffCents: cost.oneOffCents as number | null, perUnitCents: cost.perUnitCents as number | null };
  }
  return { schemaVersion: 1, fulfillment: value.fulfillment as ProductionOfferPayload["fulfillment"],
    supplierReference: text(value.supplierReference, 120), material: text(value.material, 80), color: text(value.color, 80),
    dimensionsMm: { width: dimension(value.dimensionsMm.width), depth: dimension(value.dimensionsMm.depth), height: dimension(value.dimensionsMm.height) },
    quantity: value.quantity as number | null, printMinutesPerUnit: value.printMinutesPerUnit as number | null,
    plannedSaleTotalCents: value.plannedSaleTotalCents as number | null, notes: text(value.notes, 2000, true), costs };
}
export function calculateProductionOffer(payload: ProductionOfferPayload): OfferCalculation {
  const p = parseProductionOffer(payload), openCostItems: string[] = [];
  let once = BigInt(0), perUnit = BigInt(0), knownOnce = false, knownUnit = false;
  for (const key of OFFER_COST_KEYS) {
    const row = p.costs[key];
    if (row.state === "excluded") { knownOnce = true; knownUnit = true; continue; }
    if (row.state === "open") { openCostItems.push(COST_LABELS[key]); continue; }
    if (row.oneOffCents === null || row.perUnitCents === null) openCostItems.push(`${COST_LABELS[key]}: einmalig / je Stück noch unvollständig`);
    if (row.oneOffCents !== null) { once += BigInt(row.oneOffCents); knownOnce = true; }
    if (row.perUnitCents !== null) { perUnit += BigInt(row.perUnitCents); knownUnit = true; }
  }
  if (p.quantity === null) openCostItems.push("Menge");
  const total = p.quantity === null ? null : once + perUnit * BigInt(p.quantity);
  const complete = openCostItems.length === 0;
  const margin = complete && p.plannedSaleTotalCents !== null && total !== null ? BigInt(p.plannedSaleTotalCents) - total : null;
  let basisPoints: number | null = null;
  if (margin !== null && p.plannedSaleTotalCents! > 0) {
    const denominator = BigInt(p.plannedSaleTotalCents!), absolute = margin < BigInt(0) ? -margin : margin;
    basisPoints = Number((margin < BigInt(0) ? -BigInt(1) : BigInt(1)) * ((absolute * BigInt(10_000) + denominator / BigInt(2)) / denominator));
  }
  return { knownOneOffCents: knownOnce ? Number(once) : null, knownPerUnitCents: knownUnit ? Number(perUnit) : null,
    knownTotalCents: (knownOnce || knownUnit) && total !== null ? Number(total) : null, totalCostCents: complete && total !== null ? Number(total) : null,
    revenueCents: p.plannedSaleTotalCents, marginCents: margin === null ? null : Number(margin), marginBasisPoints: basisPoints,
    openCostItems, costsComplete: complete };
}
/** Decimal input is parsed as text, never multiplied as a floating-point amount. */
export function parseOfferMoney(value: string): number | null {
  const trimmed = value.trim(); if (!trimmed) return null;
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(trimmed)) throw new Error("Bitte einen CHF-Betrag mit höchstens zwei Nachkommastellen eingeben.");
  const [whole, fraction = ""] = trimmed.replace(",", ".").split(".");
  const cents = Number(BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")));
  if (cents > MAX_CENTS) throw new Error("Der Betrag überschreitet die interne Eingabegrenze.");
  return cents;
}
export function formatOfferMoneyInput(cents: number | null): string {
  if (cents === null) return "";
  if (!optionalInteger(cents, 0, MAX_CENTS)) throw new Error("invalid_offer");
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
export function productionOfferSheet(orderId: string, payload: ProductionOfferPayload): ProductionOfferDto["sheet"] {
  const p = parseProductionOffer(payload), value = (entry: string | number | null) => entry === null ? "Offen" : String(entry);
  const money = (cents: number | null) => cents === null ? "Offen" : `CHF ${cents < 0 ? "−" : ""}${Math.trunc(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
  const calculation = calculateProductionOffer(p);
  return [
    { label: "Anfrage", value: orderId }, { label: "Dokument", value: "Interner Fertigungsblatt-Entwurf – keine Beauftragung" },
    { label: "Fertigungsweg", value: p.fulfillment === "own" ? "Eigene Fertigung" : p.fulfillment === "external" ? "Externer Fertigungsdienstleister" : "Offen" },
    { label: "Interne Lieferantenreferenz", value: value(p.supplierReference) }, { label: "Material", value: value(p.material) }, { label: "Farbe", value: value(p.color) },
    { label: "Breite / Tiefe / Höhe (mm)", value: [p.dimensionsMm.width, p.dimensionsMm.depth, p.dimensionsMm.height].map(value).join(" / ") },
    { label: "Menge", value: value(p.quantity) }, { label: "Druckzeit je Stück (Minuten)", value: value(p.printMinutesPerUnit) },
    ...OFFER_COST_KEYS.map(key => ({ label: COST_LABELS[key], value: p.costs[key].state === "open" ? "Offen"
      : p.costs[key].state === "excluded" ? "Ausdrücklich nicht zutreffend"
        : `${money(p.costs[key].oneOffCents)} einmalig + ${money(p.costs[key].perUnitCents)} je Stück` })),
    { label: "Geplanter Verkaufspreis für gesamte Menge", value: money(p.plannedSaleTotalCents) },
    { label: "Gesamtkosten", value: money(calculation.totalCostCents) },
    { label: "Kalkulatorische Marge (Verkaufspreis minus erfasste Gesamtkosten)", value: money(calculation.marginCents) },
    { label: "Kalkulationsgrundlage", value: "Nur erfasste Kosten; keine automatische Steuer-, Lohn- oder Lieferzeitannahme" },
    { label: "Interne Hinweise", value: value(p.notes) }, { label: "Zahlung / Produktionsfreigabe", value: "Nicht durch diesen Entwurf bestätigt" },
  ];
}
export async function productionOfferHash(json: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
