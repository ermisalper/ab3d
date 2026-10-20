"use client";
import { useEffect, useState } from "react";
import { EVIDENCE_STATUS_LABELS, type fulfillmentSummary } from "../../cappatex-operations";
import type { cappatexReadiness } from "../../cappatex-readiness";

type State = { checkedAt: number; configuration: { checkoutEnabled: boolean; fulfillmentEnabled: boolean;
  automaticProductionRequested: boolean; registeredProfiles: number; registeredShippingReleases: number; webhookConfigured: boolean; productionWritePermissions: string;
  tokenPurchasesRequested: boolean; registeredTokenPackReleases: number };
  readiness: ReturnType<typeof cappatexReadiness>;
  counts: Array<{ state: string; total: number }>; orders: Array<ReturnType<typeof fulfillmentSummary>>; limit: number };
const date = (value: number) => new Date(value).toLocaleString("de-CH");
export default function Operations() {
  const [data, setData] = useState<State | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/cappatex/operations", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Prüfung nicht verfügbar.");
      return body;
    }).then(body => { if (!controller.signal.aborted) setData(body); })
      .catch(error => { if (!controller.signal.aborted) { setData(null); setMessage(error instanceof Error && error.name === "TimeoutError"
        ? "Die Prüfung hat zu lange gedauert. Bitte versuche es erneut." : error instanceof Error ? error.message : "Prüfung nicht verfügbar."); } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [revision]);
  function reload() { setBusy(true); setMessage(""); setData(null); setRevision(value => value + 1); }
  const config = data?.configuration;
  return <section aria-busy={busy}>
    <button className="button secondary" onClick={reload} disabled={busy}>{busy ? "Wird geprüft …" : "Status aktualisieren"}</button>
    {message && <p role="status">{message}</p>}
    {data && config && <>
      <p>Übersicht geladen: {date(data.checkedAt)}. Die Belegstände stehen bei den einzelnen Prüfgrundlagen.</p>
      <h2>Konfiguration</h2>
      <ul>
        <li>Shopify-Checkout: {config.checkoutEnabled ? "Konfigurationsschalter aktiv – zusätzliche Produktfreigaben erforderlich" : "gesperrt"}.</li>
        <li>Printify-Auftragsanlage: {config.fulfillmentEnabled ? "Konfigurationsschalter aktiv – weitere Prüfungen gelten" : "gesperrt"}.</li>
        <li>Verkaufsprofile im Register: {config.registeredProfiles}.</li>
        <li>Shopify-Versandfreigaben im Register: {config.registeredShippingReleases}. Jede Freigabe gilt nur für die belegte Kombination aus Artikeln, Menge und Lieferland.</li>
        <li>Webhook-Konfiguration: {config.webhookConfigured ? "hinterlegt; erfolgreiche Zustellung separat nachweisen" : "unvollständig"}.</li>
        <li>Produktions-Schreibrechte: noch nicht nachgewiesen.</li>
        <li>Neue Tokenkäufe: {config.tokenPurchasesRequested ? "Konfigurationsschalter aktiv – Paket- und Zahlungsabnahme weiterhin erforderlich" : "gesperrt"}. Paketzuordnungen: {config.registeredTokenPackReleases}.</li>
      </ul>
      {config.automaticProductionRequested && <p role="alert">Automatische Produktion ist in der Konfiguration angefordert. Der Bestellweg blockiert diese Einstellung. Vor einer Freigabe korrigieren.</p>}
      <p>Eine Verkaufsfreigabe setzt bestätigte Preise, Shopify-Versand nach CH/LI und die Trennung vom nativen Printify-Import voraus. Die Schalter allein bestätigen keinen funktionierenden Verkauf.</p>
      <p>Der Gestaltungsablauf ist derzeit ein privater Betreibertest. Ein Shopify-Upgrade allein öffnet weder den Kundenbereich noch die Produktion.</p>
      <section aria-labelledby="readiness-heading">
        <h2 id="readiness-heading">Freigabeprüfung</h2>
        <p>Rein lesender Stand der dokumentierten Belege und lokalen Register. Beim Aktualisieren werden keine Anbieter abgefragt, Dateien erzeugt oder Freigaben erteilt.</p>
        <p><strong>Belegt</strong> gilt nur für die genannte Prüfgrundlage. <strong>Ungeprüft</strong> bedeutet fehlende Abnahme, <strong>veraltet</strong> eine ausdrücklich abgelaufene Gültigkeit und <strong>blockiert</strong> einen bekannten offenen Sperrgrund. Keine dieser Angaben ersetzt eine erfolgreiche Live-Abnahme.</p>
        {data.readiness.rows.map(item => <article key={item.id} className="cappatex-preparation" style={{ margin: "16px 0", minWidth: 0, overflowWrap: "anywhere" }}>
          <p className="eyebrow">{item.area} · {item.scope}</p>
          <h3>{item.title}</h3><p><strong>{EVIDENCE_STATUS_LABELS[item.status]}</strong></p>
          <p>{item.detail}</p>
          <details><summary>Prüfgrundlage und nächster Nachweis</summary>
            <ul>{item.basis.map((basis, index) => <li key={`${basis.reference}-${index}`}>
              <span>{basis.reference}</span> · {basis.recordedAt ? `Belegstand: ${new Date(basis.recordedAt).toLocaleDateString("de-CH")}` : "Kein Prüfdatum hinterlegt"}
              {basis.validUntil && ` · Gültig bis: ${new Date(basis.validUntil).toLocaleDateString("de-CH")}`}
            </li>)}</ul>
            <p>{item.next}</p>
          </details>
        </article>)}
      </section>
      <h2>Aufträge</h2>
      <p>{data.counts.reduce((sum, count) => sum + count.total, 0)} gespeicherte Aufträge. Angezeigt werden höchstens die {data.limit} zuletzt geänderten Aufträge.</p>
      {!data.orders.length && <p>Es sind noch keine CAPPATEX-Aufträge eingegangen.</p>}
      {data.orders.map(order => <article key={order.id} className="cappatex-preparation" style={{ margin: "16px 0", overflowWrap: "anywhere" }}>
        <h3>{order.reference}</h3><p><strong>{order.label}</strong></p>
        {order.needsReview && <p>Vor weiteren Schritten manuell prüfen. Bei unklarer Anlage zuerst die Referenz in Printify abgleichen; keinen zweiten Auftrag anlegen.</p>}
        {order.stalled && <p>Seit mindestens 15 Minuten ohne bestätigten Fortschritt.</p>}
        {order.reason && <p>{order.reason}</p>}
        {order.printifyOrderId && <p>Printify-ID: {order.printifyOrderId}</p>}
        <p>Letzte Änderung: {date(order.updatedAt)}</p>
      </article>)}
    </>}
  </section>;
}
