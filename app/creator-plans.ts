export type CreatorPlan = {
  id: "free" | "3d-studio" | "cappatex" | "complete";
  name: string;
  price: string;
  cadence: string;
  tokens: string;
  audience: string;
  features: string[];
  popular?: boolean;
};

export const creatorPlans: CreatorPlan[] = [
  {
    id: "free",
    name: "Explorer",
    price: "CHF 0",
    cadence: "einmalig",
    tokens: "4 Start-Tokens",
    audience: "Beide Studios kennenlernen",
    features: ["3D- und Motivvorschauen testen", "Physische Produkte bestellen", "Kein STL- oder HD-Dateiexport"],
  },
  {
    id: "3d-studio",
    name: "3D Studio",
    price: "CHF 19",
    cadence: "/ Monat",
    tokens: "20 Tokens monatlich",
    audience: "Für eigene 3D-Modelle",
    features: ["AB3D 3D Design Studio", "STL-, 3MF- und GLB-Download", "Druckprüfung und exakte Skalierung"],
  },
  {
    id: "cappatex",
    name: "CAPPATEX",
    price: "CHF 15",
    cadence: "/ Monat",
    tokens: "20 Tokens monatlich",
    audience: "Für Motive auf Kleidung",
    features: ["CAPPATEX Motiv-Studio", "Druckfähige HD-Motivdateien", "Produkt-Mockups und Platzierung"],
  },
  {
    id: "complete",
    name: "Complete",
    price: "CHF 29",
    cadence: "/ Monat",
    tokens: "40 Tokens monatlich",
    audience: "Beide Studios in einem Abo",
    features: ["3D Studio und CAPPATEX", "Alle Datei- und Druckexporte", "Gemeinsames Token-Guthaben"],
    popular: true,
  },
];

export const tokenRules = [
  ["1 Token", "3D-Grundform oder CAPPATEX Motivvorschau"],
  ["2 Tokens", "3D-Modell mit Textur oder direktes Foto-zu-3D"],
  ["3 Tokens", "Kreative Fotointerpretation mit fertigem 3D-Modell"],
  ["2–3 Tokens", "Exakte Skalierung, Prüfung und STL-/3MF-Druckpaket"],
] as const;

export function planCapabilities(plan: string, subscriptionStatus: string, unlimited = false) {
  if (unlimited) return { canUse3d: true, canUseCappatex: true, canDownload3d: true, canDownloadHd: true };
  const active = ["active", "trialing"].includes(subscriptionStatus);
  const normalized = plan === "studio" ? "3d-studio" : plan === "pro" ? "complete" : plan;
  if (!active || normalized === "free") {
    return { canUse3d: true, canUseCappatex: true, canDownload3d: false, canDownloadHd: false };
  }
  return {
    canUse3d: normalized === "3d-studio" || normalized === "complete",
    canUseCappatex: normalized === "cappatex" || normalized === "complete",
    canDownload3d: normalized === "3d-studio" || normalized === "complete",
    canDownloadHd: normalized === "cappatex" || normalized === "complete",
  };
}

export function planName(plan: string) {
  const normalized = plan === "studio" ? "3d-studio" : plan === "pro" ? "complete" : plan;
  return creatorPlans.find((entry) => entry.id === normalized)?.name || "Explorer";
}
