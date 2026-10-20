import type { DesignProfile } from "./cappatex-design-catalog";
import { resolveMockupAsset } from "./cappatex-mockup-assets";
import { profileGeometryIsVerified, type PrintProfile } from "./cappatex-print-profile";
import type { ShippingRelease } from "./cappatex-shipping";
import type { TokenPackRelease } from "./token-pack-releases";
import type { EvidenceStatus } from "./cappatex-operations";

export type ReadinessEvidence = {
  id: string; area: "CAPPATEX" | "Tokenkäufe" | "Gemeinsam"; title: string; status: EvidenceStatus;
  scope: string; detail: string; basis: Array<{ reference: string; recordedAt: string | null; validUntil?: string }>; next: string;
};
type DatedRecord = { verifiedAt: string; validUntil: string };

/** Only an existing record's explicit validity can expire. Age alone is not an invented policy. */
export function recordedEvidenceStatus(records: readonly DatedRecord[], now: number): EvidenceStatus {
  if (!records.length || records.some(record => !Number.isFinite(Date.parse(record.verifiedAt))
    || !Number.isFinite(Date.parse(record.validUntil)) || Date.parse(record.verifiedAt) > now
    || Date.parse(record.validUntil) <= Date.parse(record.verifiedAt))) return "ungeprueft";
  return records.some(record => Date.parse(record.validUntil) <= now) ? "veraltet" : "belegt";
}

/** Summarises checked-in evidence only. Never fetch providers, inspect private artwork or grant a release here. */
export function cappatexReadiness(input: {
  designProfiles: readonly DesignProfile[]; salesProfiles: readonly PrintProfile[];
  shippingReleases: readonly ShippingRelease[]; tokenReleases: readonly TokenPackRelease[];
}, now = Date.now()) {
  const { designProfiles, salesProfiles, shippingReleases, tokenReleases } = input;
  const allSides = designProfiles.flatMap(profile => [...profile.variants, ...(profile.backVariants || [])]);
  const unpinned = new Set(allSides.filter(variant => !resolveMockupAsset(variant.mockup).verified).map(variant => variant.mockup.url));
  const frontCount = designProfiles.reduce((sum, profile) => sum + profile.variants.length, 0);
  const backCount = designProfiles.reduce((sum, profile) => sum + (profile.backVariants?.length || 0), 0);
  const designDates = designProfiles.map(profile => ({ reference: `${profile.id} · ${profile.version}`, recordedAt: profile.verifiedAt, validUntil: profile.validUntil }));
  const salesDates = salesProfiles.map(profile => ({ reference: `${profile.id} · ${profile.version}`, recordedAt: profile.verifiedAt, validUntil: profile.validUntil }));
  const shippingDates = shippingReleases.map(release => ({ reference: `${release.id} · ${release.version}`, recordedAt: release.reviewedAt, validUntil: release.validUntil }));
  const source = (reference: string, recordedAt: string | null) => ({ reference, recordedAt });
  const shippingState = recordedEvidenceStatus(shippingReleases.map(release => ({ verifiedAt: release.reviewedAt, validUntil: release.validUntil })), now);
  const datedProfileState = recordedEvidenceStatus(designProfiles, now);
  const geometryConsistent = designProfiles.every(profile => profileGeometryIsVerified(profile, profile.shopId, now)
    && profile.variants.every(variant => variant.area.position === "front")
    && (!profile.backVariants?.length || profileGeometryIsVerified({ ...profile, variants: profile.backVariants }, profile.shopId, now)
      && profile.backVariants.every(back => back.area.position === "back" && profile.variants.some(front => front.sku === back.sku
        && front.printifyVariantId === back.printifyVariantId && front.shopifyVariantId === back.shopifyVariantId))));
  const rows: ReadinessEvidence[] = [
    { id: "variant-mapping", area: "CAPPATEX", title: "Produkt- und Variantenzuordnung", status: designProfiles.length ? "belegt" : "blockiert",
      scope: "Historischer Katalogabgleich",
      detail: "Der dokumentierte Abgleich vom 17.10.2026 bestätigt SKU-/Shopify-/Printify-Zuordnungen und damalige Verfügbarkeit. Das ist kein heutiger Bestands- oder Schreibrechtetest.",
      basis: [source("docs/SHOP-LAUNCH-READINESS.md · Frisch nachgewiesen", "2026-10-17")],
      next: "Vor Verkauf die konkrete Variante im richtigen Shop erneut prüfen; unbekannte oder nicht verfügbare Varianten bleiben gesperrt." },
    { id: "print-sides", area: "CAPPATEX", title: "Vorderseite und Rückseite", status: datedProfileState === "belegt" && !geometryConsistent ? "blockiert" : datedProfileState,
      scope: "Datierte Gestaltungsprofile",
      detail: `${designProfiles.length} Profile mit ${frontCount} Vorderseiten- und ${backCount} Rückseitenzuordnungen. Gültigkeit stammt ausschliesslich aus den Profilen; Geometriebelege sind keine Verkaufsfreigabe.`,
      basis: designDates.length ? designDates : [source("app/cappatex-design-profiles.ts", null)],
      next: "Abgelaufene oder geänderte Profile und jede zusätzliche Druckfläche müssen neu belegt werden. Nicht alle Produkte unterstützen beide Seiten." },
    { id: "mockup-geometry", area: "CAPPATEX", title: "Fotogeometrie und unveränderte Blankobilder", status: unpinned.size || !allSides.length ? "blockiert" : "belegt",
      scope: "Lokale Foto-Evidenz",
      detail: `${unpinned.size} unterschiedliche registrierte Fotoansichten ohne bestätigte lokale Originalbytes. Insbesondere die dokumentierten T-Shirt-Rückseiten sind keine bestätigte Bestellansicht.`,
      basis: [source("docs/evidence/cappatex-mockup-assets.json", "2026-10-19"), source("docs/CAPPATEX-SAVED-GESTALTUNGEN.md · Stabile Produktansichten", "2026-10-19")],
      next: "Fehlende Originalbilder und ihre Kalibrierung nachweisen. Eine Legacy-Ausnahme oder ein Anbieterfoto allein darf die Bestellsperre nicht aufheben." },
    { id: "print-files", area: "CAPPATEX", title: "Druckdateien und Platzierung", status: "belegt", scope: "Dokumentierter Offline-Prüfstand",
      detail: "Lokale Regressionen belegen getrennte Front-/Back-PNGs, Originalpixel, Hashes, Druckflächen und unveränderte Wiederaufnahme. Hier werden keine konkreten Kundendateien gelesen und kein physischer Druck bestätigt.",
      basis: [source("docs/CAPPATEX-SAVED-GESTALTUNGEN.md · Nachgewiesene Regressionen / Ansicht der tatsächlichen Druckdatei", "2026-10-19")],
      next: "Jeder spätere Checkout muss die gespeicherten Druckdateien erneut prüfen. Physische Druckqualität bleibt separat abzunehmen." },
    { id: "sales-prices", area: "CAPPATEX", title: "Genehmigte Preise und Seitenangebote", status: salesProfiles.length ? "ungeprueft" : "blockiert",
      scope: "Lokales Verkaufsregister",
      detail: `${salesProfiles.length} Verkaufsprofile hinterlegt. Ein Shopify-Preis oder vorhandener Checkout-Code bestätigt keine vollständige Kalkulation für Vorderseite, Rückseite oder beide Seiten.`,
      basis: salesDates.length ? salesDates : [source("app/cappatex-profiles.ts", null)],
      next: "Kostenwährungen, zweite Druckseite, Pflichtetiketten, Gebühren und verbindliche CHF-Verkaufspreise je Variante und Seitenkombination bestätigen." },
    { id: "customer-shipping", area: "CAPPATEX", title: "Bezahlter Shopify-Versand nach CH / LI", status: !shippingReleases.length ? "blockiert" : shippingState === "belegt" ? "ungeprueft" : shippingState,
      scope: "Datierte Versandfreigaben",
      detail: `${shippingReleases.length} Versandfreigaben hinterlegt. Printify-Anbieterraten sind kein Nachweis des tatsächlich bezahlten Shopify-Tarifs. Jede Freigabe gilt nur für ihre Länder-, Mengen- und Warenkorbzusammensetzung.`,
      basis: shippingDates.length ? shippingDates : [source("app/cappatex-shipping-releases.ts", null)],
      next: "Konkrete CH-/LI-Checkout-Tarife und vollständige Warenkörbe belegen. Abgelaufene, geänderte oder fehlende Nachweise bleiben gesperrt." },
    { id: "required-labels", area: "CAPPATEX", title: "Pflichtetiketten und zusätzliche Ebenen", status: "blockiert", scope: "Offener Anbieterbeleg",
      detail: "Die T-Shirt-Nackenebene ist nur als Layout belegt; der Inhalts-Hash fehlt. Keine beobachtete Zusatzebene bei anderen Produkten beweist allgemeine Etikettenfreiheit.",
      basis: [source("docs/CAPPATEX-SALES-AND-SHIPPING-ACCEPTANCE.md · Aktueller Printify-Etikettennachweis", "2026-10-17")],
      next: "Unveränderten Inhalt, Layout und tatsächlich erforderliche Ebenen je Verkaufsprodukt nachweisen. Bild-ID oder Metadatenhash reichen nicht." },
    { id: "fulfillment-route", area: "CAPPATEX", title: "Ein Bestellweg und Produktionsrechte", status: "ungeprueft", scope: "Externe Abnahme fehlt",
      detail: "Vorgesehen ist ausschliesslich AB3D → Printify API mit manueller Produktion. Native Importtrennung, manuelle Auftragsfreigabe und notwendige API-Schreibrechte sind nicht extern abgenommen.",
      basis: [source("docs/SHOP-LAUNCH-READINESS.md · Noch vor Verkauf nötig", "2026-10-17")],
      next: "Im richtigen Printify-Shop die Trennung vom nativen Shopify-Import und die Rechte belegen. Keine automatische Wiederholung unklarer Aufträge." },
    { id: "webhook-delivery", area: "Gemeinsam", title: "Signierte Zahlungsbenachrichtigungen", status: "ungeprueft", scope: "Externe Zustellung fehlt",
      detail: "Ein hinterlegtes Webhook-Secret wäre nur Konfiguration. Erfolgreiche HMAC-geprüfte Zustellung an die private Site und getrennte physische / digitale Handler sind damit nicht live nachgewiesen.",
      basis: [source("docs/SHOP-LAUNCH-READINESS.md · Einmalige Tokenpakete", "2026-10-20")],
      next: "Beide orders/paid-Ziele und unterstützten Zugang zur privaten Site prüfen. Weder öffentliche Zugriffsrechte erweitern noch einen Kauf aus dieser Übersicht auslösen." },
    { id: "token-variants", area: "Tokenkäufe", title: "Digitale Paketvarianten und Zahlungsabnahme", status: tokenReleases.length ? "ungeprueft" : "blockiert", scope: "Lokales Token-Freigaberegister",
      detail: `${tokenReleases.length} Paketzuordnungen hinterlegt. Preise und Paketkarten allein belegen weder digitale Shopify-Varianten noch erfolgreiche Zahlung und einmalige Gutschrift. Bestehende Kauf-Snapshots werden durch diese Anzeige nicht verändert.`,
      basis: tokenReleases.length ? tokenReleases.flatMap(release => [source(`${release.packId} · Checkout`, release.checkoutVerifiedAt), source(`${release.packId} · Webhook`, release.webhookReceiptVerifiedAt)]) : [source("app/token-pack-releases.ts", null)],
      next: "Echte digitale SKU-/Varianten-IDs, CH-/LI-Checkout, Steuern und signierte Gutschrift bestätigen; Erstattungs- und Rückbuchungsregeln gesondert entscheiden." },
    { id: "payment-separation", area: "Gemeinsam", title: "Tokenzahlung und Produktbestellung getrennt", status: "belegt", scope: "Dokumentierter Offline-Prüfstand",
      detail: "Die bestehenden Routentests prüfen fachfremde signierte Bestellungen: Tokenkäufe erzeugen keinen Printify-Auftrag, physische Produktbestellungen keine Tokengutschrift. Eine Live-Zahlung ist damit nicht bestätigt.",
      basis: [source("docs/SHOP-LAUNCH-READINESS.md · Einmalige Tokenpakete / Prüfung dieses Quellstands", "2026-10-20")],
      next: "Vor Verkaufsfreigabe den kontrollierten Ende-zu-Ende-Test gesondert genehmigen; keine automatische Erstattungsregel aus diesem Prüfstand ableiten." },
  ];
  return { checkedAt: now, externalChecksPerformed: false as const, rows };
}
