/** Existing workshop estimate, shared by the studio and the server. This is no offer or checkout price. */
const templates = {
  "free-design": { name: "Eigene Idee", complexity: 1.2, minHeight: 5, maxHeight: 50 },
  chibi: { name: "Chibi-Figur", complexity: 1.4, minHeight: 8, maxHeight: 28 },
  vinyl: { name: "Vinyl-Figur", complexity: 1.45, minHeight: 10, maxHeight: 32 },
  brick: { name: "Brick-Figur", complexity: 1.2, minHeight: 7, maxHeight: 24 },
  pet: { name: "Haustier-Figur", complexity: 1.35, minHeight: 8, maxHeight: 26 },
  keychain: { name: "3D-Schlüsselanhänger", complexity: .75, minHeight: 4, maxHeight: 10 },
  magnet: { name: "3D-Kühlschrankmagnet", complexity: .7, minHeight: 5, maxHeight: 14 },
  lamp: { name: "Skulpturale LED-Lampe", complexity: 1.25, minHeight: 12, maxHeight: 45 },
  "twist-egg": { name: "Twist Egg", complexity: 1.1, minHeight: 7, maxHeight: 20 },
  planter: { name: "Blumentopf", complexity: 1.05, minHeight: 9, maxHeight: 38 },
  keycap: { name: "Individuelle Keycap", complexity: .8, minHeight: 2, maxHeight: 4 },
  "fold-fidget": { name: "Einklapp-Fidget", complexity: 1.2, minHeight: 5, maxHeight: 14 },
  "pixel-fidget": { name: "Pixel-Fidget", complexity: 1, minHeight: 5, maxHeight: 14 },
  terrain: { name: "Tabletop-Terrain", complexity: 1.45, minHeight: 3, maxHeight: 15 },
  "photo-frame": { name: "3D-Fotolicht", complexity: 1.15, minHeight: 10, maxHeight: 35 },
} as const;

export function productionQuote(input: {
  templateId?: unknown; heightCm?: unknown; material?: unknown; finish?: unknown; quantity?: unknown;
} | null) {
  if (!input || typeof input.templateId !== "string" || !Object.hasOwn(templates, input.templateId)) return null;
  const template = templates[input.templateId as keyof typeof templates];
  const { heightCm, quantity, material, finish } = input;
  if (typeof heightCm !== "number" || !Number.isFinite(heightCm)
    || heightCm < template.minHeight || heightCm > template.maxHeight
    || Math.abs(heightCm * 10 - Math.round(heightCm * 10)) > 1e-8
    || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 20
    || (material !== "PLA" && material !== "PETG") || (finish !== "Roh" && finish !== "Premium")) return null;

  const scale = Math.pow(heightCm / 20, 2.25);
  const materialFactor = material === "PETG" ? 1.16 : 1;
  const finishing = finish === "Premium" ? 24 + heightCm * .65 : 0;
  const unit = Math.max(24, 14 + 24 * scale * template.complexity * materialFactor + finishing);
  const discount = quantity >= 5 ? .86 : quantity >= 3 ? .92 : 1;
  return {
    templateId: input.templateId, templateName: template.name, heightMm: Math.round(heightCm * 10),
    material, finish, quantity, currency: "CHF" as const,
    estimatedTotalCents: Math.ceil(unit * quantity * discount / 5) * 500,
  };
}
