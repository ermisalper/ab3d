"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PreparedReceipt } from "../../cappatex-preparation-panel";
import type { PreparationSummary } from "../../../cappatex-preparation";
import { parsePreparationResponse } from "../../../cappatex-preparation-response";

type ReviewReceipt = PreparationSummary & {
  checkout?: { enabled: boolean; reason: string; unitPriceCents?: number; currency?: string };
};
const money = (cents: number) => new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(cents / 100);

export default function PreparedReview({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<ReviewReceipt | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState<"loading" | "checkout" | "">("loading");
  const [error, setError] = useState("");
  const [terms, setTerms] = useState(false);
  const [preview, setPreview] = useState({ id: "", ready: false });
  const previewReady = preview.id === id && preview.ready;
  const reportPreview = useCallback((ready: boolean) => {
    setPreview(current => current.id === id && current.ready === ready ? current : { id, ready });
    if (!ready) setTerms(false);
  }, [id]);
  useEffect(() => {
    let active = true;
    fetch(`/api/cappatex/preparations/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data?.error || "Stand nicht verfügbar.");
      const receipt = parsePreparationResponse(data, id);
      if (active) { setReceipt(receipt); setTerms(false); setBusy(""); }
    }).catch(caught => {
      if (active) { setError(caught instanceof Error ? caught.message : "Stand nicht verfügbar."); setBusy(""); }
    });
    return () => { active = false; };
  }, [id, refresh]);
  const current = receipt?.id === id ? receipt : null;
  const cents = current?.checkout?.unitPriceCents;
  const validPrice = typeof cents === "number" && Number.isSafeInteger(cents) && cents >= 1
    && current?.checkout?.currency === "CHF" && Number.isSafeInteger(current.quantity) && current.quantity >= 1 && current.quantity <= 5
    && Number.isSafeInteger(cents * current.quantity) && ["CH", "LI"].includes(current.country);
  const checkoutReady = current?.checkout?.enabled === true && validPrice;
  const blockedReason = current?.checkout?.enabled === true && !validPrice
    ? "Der freigegebene Preis konnte nicht bestätigt werden. Bitte prüfe den Stand erneut."
    : typeof current?.checkout?.reason === "string" && current.checkout.reason.trim()
      ? current.checkout.reason : "Checkout und Produktion warten auf die Produkt-, Preis- und Versandfreigabe.";
  function reload() {
    if (busy) return;
    setReceipt(null); setTerms(false); setPreview({ id: "", ready: false }); setError(""); setBusy("loading"); setRefresh(value => value + 1);
  }
  async function checkout() {
    if (!checkoutReady || !previewReady || !terms || busy) return;
    setBusy("checkout"); setError("");
    try {
      const response = await fetch("/api/cappatex/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preparationId: id, termsAccepted: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Der Shopify-Checkout konnte nicht vorbereitet werden.");
      if (typeof data.checkoutUrl !== "string") throw new Error("Der Shopify-Checkout hat keine gültige Adresse zurückgegeben.");
      const url = new URL(data.checkoutUrl);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Die Checkout-Adresse konnte nicht sicher bestätigt werden.");
      window.location.assign(url.toString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Der Shopify-Checkout ist gerade nicht erreichbar."); setBusy("");
    }
  }
  return <>
    <p role="status" aria-live="polite">{busy === "loading" ? "Gespeicherte Druckseiten und Checkout-Freigabe werden geprüft …"
      : busy === "checkout" ? "Dein gespeicherter Stand wird für Shopify geprüft …" : ""}</p>
    {error && <p className="cappatex-action-error" role="alert">{error}</p>}
    {current && <>
      <PreparedReceipt receipt={current} onPreviewReady={reportPreview} />
      <p><Link className="button secondary" href={`/cappatex?preparationId=${current.id}&resume=1#studio`}>Als Kopie weitergestalten</Link></p>
      <section className="cappatex-preparation-receipt" aria-labelledby="prepared-checkout-heading" aria-busy={Boolean(busy)}>
        <h2 id="prepared-checkout-heading">{checkoutReady ? "Bestellung vorbereiten" : "Preise und Versand werden noch geprüft"}</h2>
        {checkoutReady && typeof cents === "number" ? <>
          <p>{current.quantity} Stück · Lieferland: {current.country === "LI" ? "Liechtenstein" : "Schweiz"}</p>
          <p>Stückpreis: <strong>{money(cents)}</strong> · Artikel gesamt: <strong>{money(cents * current.quantity)}</strong></p>
          <p>Versand und endgültigen Gesamtpreis prüfst du im Shopify-Checkout. Deine gespeicherten Motive und Positionen werden gemeinsam übernommen.</p>
          {!previewReady && <p className="cappatex-preparation-warning" role="status">Bitte lade und prüfe zuerst alle gespeicherten Produktansichten. Eine unvollständige oder nicht bestätigte Bildansicht kann noch nicht für die Bestellung bestätigt werden.</p>}
          <label className="legal-consent cappatex-consent"><input type="checkbox" checked={terms} disabled={Boolean(busy) || !previewReady} onChange={event => setTerms(event.target.checked)} />
            <span>Ich habe die gespeicherten Druckseiten geprüft und akzeptiere die <Link href="/recht/agb" target="_blank" rel="noopener noreferrer">AGB</Link>.
              Die <Link href="/recht/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutzerklärung</Link> habe ich gelesen.</span></label>
          <button type="button" className="button primary" disabled={!terms || !previewReady || Boolean(busy)} onClick={checkout}>Weiter zu Shopify</button>
        </> : <p>{blockedReason}</p>}
      </section>
    </>}
    <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={reload}>Stand erneut prüfen</button>
  </>;
}
