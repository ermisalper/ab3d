/** Private contact context for an inquiry; the final delivery address is collected later. */
export type ProductionInquiryDetails = {
  name?: string;
  phone?: string;
  country?: "CH" | "LI";
  postalCode?: string;
  city?: string;
  customerNote?: string;
};

const limits = { name: 120, phone: 40, country: 2, postalCode: 12, city: 120, customerNote: 1000 } as const;
const singleLineControls = /[\u0000-\u001f\u007f-\u009f]/;
const noteControls = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;

/** Undefined and blank fields are compatible with older inquiries. Invalid input is never silently stored. */
export function productionInquiryDetails(input: unknown): ProductionInquiryDetails | null {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some(key => !Object.hasOwn(limits, key))) return null;
  const source = input as Record<string, unknown>;
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(limits) as Array<keyof typeof limits>) {
    const value = source[key];
    if (value === undefined) continue;
    if (typeof value !== "string") return null;
    const text = key === "customerNote" ? value.replaceAll("\r\n", "\n") : value;
    if ((key === "customerNote" ? noteControls : singleLineControls).test(text)) return null;
    const trimmed = text.trim();
    if (trimmed.length > limits[key]) return null;
    if (trimmed) normalized[key] = trimmed;
  }
  if (normalized.country && normalized.country !== "CH" && normalized.country !== "LI") return null;
  if ((normalized.postalCode || normalized.city) && !normalized.country) return null;
  if (normalized.postalCode && !/^\d{4}$/.test(normalized.postalCode)) return null;
  return normalized as ProductionInquiryDetails;
}
