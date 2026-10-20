"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TOKEN_PACKS } from "../token-packs";

type Purchase = { id: string; requestId: string; packId: string; tokens: number; priceCents: number; currency: string; status: string; createdAt: number };
type Catalog = { enabled: boolean; message: string; packs: Array<{ id: string; available: boolean }>; purchases: Purchase[] };
type Selection = { packId: string; country: "CH" | "LI"; requestId: string };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const HISTORY_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const unavailable = "Die Tokenpakete konnten nicht geprüft werden. Bitte den Status erneut laden.";
const uncertain = "Der Checkout konnte nicht bestätigt werden. Bitte den Status prüfen. Erneutes Öffnen verwendet dieselbe Anfrage.";
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
function catalogue(value: unknown): Catalog {
  if (!record(value) || typeof value.enabled !== "boolean" || typeof value.message !== "string" || value.message.length > 1000
    || !Array.isArray(value.packs) || value.packs.length > TOKEN_PACKS.length || !Array.isArray(value.purchases) || value.purchases.length > 100
    || !value.packs.every(pack => record(pack) && TOKEN_PACKS.some(known => known.id === pack.id) && typeof pack.available === "boolean")
    || new Set(value.packs.map(pack => pack.id)).size !== value.packs.length
    || !value.purchases.every(purchase => record(purchase) && typeof purchase.id === "string" && /^TP-[a-f0-9]{32}$/.test(purchase.id)
      && typeof purchase.requestId === "string" && HISTORY_UUID.test(purchase.requestId) && TOKEN_PACKS.some(pack => pack.id === purchase.packId)
      && Number.isSafeInteger(purchase.tokens) && Number(purchase.tokens) > 0 && Number.isSafeInteger(purchase.priceCents) && Number(purchase.priceCents) > 0
      && purchase.currency === "CHF" && typeof purchase.status === "string" && purchase.status.length > 0 && purchase.status.length <= 40
      && Number.isSafeInteger(purchase.createdAt) && Number(purchase.createdAt) >= 0)
    || new Set(value.purchases.map(purchase => purchase.id)).size !== value.purchases.length
    || new Set(value.purchases.map(purchase => purchase.requestId.toLowerCase())).size !== value.purchases.length) throw new Error(unavailable);
  if (!value.packs.every(pack => TOKEN_PACKS.some(known => known.id === pack.id
    && known.tokens === pack.tokens && known.priceCents === pack.priceCents && known.currency === pack.currency)))
    throw new Error("Das Tokenangebot hat sich geändert. Bitte lade die Seite neu, bevor du einen Kauf beginnst.");
  return value as Catalog;
}
const failureMessage = (caught: unknown, fallback: string) => caught instanceof Error && !(caught instanceof TypeError)
  && !(caught instanceof SyntaxError) && caught.name !== "TimeoutError" && caught.name !== "AbortError" ? caught.message : fallback;
const money = (cents: number) => new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }).format(cents / 100);
const names: Record<string, string> = { credited: "Tokens gutgeschrieben", checkout_created: "Zahlung noch offen", creating_checkout: "Checkout wird geprüft", checkout_uncertain: "Checkout wird geprüft", manual_review: "Wird persönlich geprüft", failed: "Nicht abgeschlossen" };

export default function TokenShop({ email, onRefreshBalance }: { email: string; onRefreshBalance: () => Promise<void | boolean> }) {
  const normalizedEmail = email.trim().toLowerCase();
  return <OwnedTokenShop key={normalizedEmail} email={normalizedEmail} onRefreshBalance={onRefreshBalance} />;
}

function OwnedTokenShop({ email, onRefreshBalance }: { email: string; onRefreshBalance: () => Promise<void | boolean> }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [verified, setVerified] = useState(false);
  const [selected, setSelected] = useState("");
  const [country, setCountry] = useState<"CH" | "LI">("CH");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingSelection, setPendingSelection] = useState<Selection | null>(null);
  const key = useRef("");
  const pending = useRef<Selection | null>(null);
  const busyRef = useRef(false), revision = useRef(0);
  const initialRead = useRef<AbortController | null>(null), action = useRef<AbortController | null>(null);

  async function readCatalog(signal?: AbortSignal) {
    const response = await fetch("/api/token-purchases", { cache: "no-store", signal });
    if (response.status !== 200) throw new Error("Tokenpakete können gerade nicht geladen werden. Bitte erneut prüfen.");
    const data = await response.json().catch(() => { throw new Error(unavailable); });
    return catalogue(data);
  }

  async function restoreSelection(signal: AbortSignal) {
    try {
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.trim().toLowerCase()));
      const storageKey = `ab3d-token-checkout-v1:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")}`;
      if (signal.aborted) return;
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const value = JSON.parse(saved) as Selection;
        if (!value || !TOKEN_PACKS.some(pack => pack.id === value.packId) || !["CH", "LI"].includes(value.country)
          || typeof value.requestId !== "string" || !UUID.test(value.requestId)) throw new Error("invalid_local_checkout");
        pending.current = value; setPendingSelection(value); setSelected(value.packId); setCountry(value.country); setAccepted(false);
        setNotice("Eine begonnene Checkout-Anfrage ist noch gespeichert. Erneutes Öffnen verwendet dieselbe Anfrage und erstellt keine neue Auswahl.");
      }
      key.current = storageKey;
    } catch {
      if (signal.aborted) return;
      key.current = "";
      setNotice("Die lokale Checkout-Sicherung ist nicht verfügbar. Bitte nutze einen Browser mit Sitzungsspeicher, bevor du einen Kauf beginnst.");
    }
  }
  function clearCredited(data: Catalog) {
    const current = pending.current;
    if (!current || !data.purchases.some(purchase => purchase.requestId.toLowerCase() === current.requestId.toLowerCase()
      && purchase.packId === current.packId && purchase.status === "credited")) return;
    sessionStorage.removeItem(key.current); pending.current = null; setPendingSelection(null); setSelected(""); setAccepted(false);
  }

  useEffect(() => {
    const abort = new AbortController(), requestRevision = ++revision.current; initialRead.current = abort;
    async function load() {
      await restoreSelection(abort.signal);
      if (abort.signal.aborted) return;
      const data = await readCatalog(abort.signal);
      if (abort.signal.aborted || requestRevision !== revision.current) return;
      clearCredited(data); setCatalog(data); setVerified(true);
    }
    load().catch(caught => { if (!abort.signal.aborted && requestRevision === revision.current) { setVerified(false); setError(failureMessage(caught, unavailable)); } });
    return () => { abort.abort(); action.current?.abort(); };
  // The account key remounts this component; all requests are scoped to this lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function refresh() {
    if (busyRef.current) return;
    busyRef.current = true; const abort = new AbortController(); action.current = abort;
    const requestRevision = ++revision.current; initialRead.current?.abort();
    setBusy(true); setError(""); setNotice(""); setVerified(false);
    try {
      if (!key.current) await restoreSelection(abort.signal);
      if (abort.signal.aborted) return;
      const data = await readCatalog(AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]));
      if (abort.signal.aborted || requestRevision !== revision.current) return;
      clearCredited(data); setCatalog(data); setVerified(true);
      if (await onRefreshBalance() === false) throw new Error("Der Kaufstatus ist geladen; das Guthaben konnte gerade nicht aktualisiert werden.");
      if (abort.signal.aborted) return;
      setNotice("Kaufstatus und Guthaben wurden neu geladen. Eine Gutschrift erfolgt ausschliesslich nach bestätigter Zahlung.");
    }
    catch (caught) { if (!abort.signal.aborted) setError(failureMessage(caught, unavailable)); }
    finally { busyRef.current = false; if (!abort.signal.aborted) setBusy(false); }
  }

  async function checkout() {
    const available = verified && catalog?.enabled && catalog.packs.some(pack => pack.id === selected && pack.available);
    if (!available || !accepted || busyRef.current) return;
    setError("");
    if (!key.current) { setError("Für einen sicheren Kauf muss die Checkout-Anfrage in diesem Tab gesichert werden können."); return; }
    const selection = pending.current || { packId: selected, country, requestId: crypto.randomUUID() };
    if (selection.packId !== selected || selection.country !== country) { setError("Bitte prüfe zuerst die begonnene Checkout-Anfrage mit ihrer bisherigen Auswahl."); return; }
    try { sessionStorage.setItem(key.current, JSON.stringify(selection)); }
    catch { setError("Die Checkout-Anfrage konnte nicht im Tab gesichert werden. Es wurde kein Kauf gestartet."); return; }
    pending.current = selection; setPendingSelection(selection); busyRef.current = true; setBusy(true);
    const abort = new AbortController(); action.current = abort;
    try {
      const response = await fetch("/api/token-purchases/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30_000)]), body: JSON.stringify({ ...selection, termsAccepted: true }) });
      const data = await response.json();
      if (abort.signal.aborted) return;
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Checkout noch nicht verfügbar. Bitte den Status prüfen.");
      }
      if (response.status !== 200 || !record(data) || typeof data.purchaseId !== "string" || !/^TP-[a-f0-9]{32}$/.test(data.purchaseId)
        || typeof data.checkoutUrl !== "string") throw new Error("Kein bestätigter Checkout-Link verfügbar. Bitte den Status prüfen.");
      const url = new URL(data.checkoutUrl);
      if (url.protocol !== "https:" || !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(url.hostname) || url.username || url.password) throw new Error("Der Checkout-Link konnte nicht bestätigt werden.");
      window.location.assign(url.toString());
    } catch (caught) { if (!abort.signal.aborted) setError(failureMessage(caught, uncertain)); }
    finally { busyRef.current = false; if (!abort.signal.aborted) setBusy(false); }
  }

  const pack = TOKEN_PACKS.find(value => value.id === selected);
  return <section className="token-shop" id="tokens-kaufen" aria-labelledby="token-shop-heading">
    <div className="section-heading"><div><p className="eyebrow">Einmal kaufen · ohne Abo</p><h2 id="token-shop-heading">Mehr Raum für deine Ideen.</h2></div><p>Wähle ein Tokenpaket für weitere KI-Aktionen. Dateidownloads und verfügbare Studios richten sich weiterhin nach deinem Plan und den Freigaben.</p></div>
    <div className="token-pack-grid">{TOKEN_PACKS.map(item => {
      const available = verified && catalog?.enabled && catalog.packs.some(value => value.id === item.id && value.available);
      return <article className={selected === item.id ? "token-pack selected" : "token-pack"} key={item.id}>
        <p>{item.name}</p><h3>{item.tokens}<small>Design-Tokens</small></h3><strong>{money(item.priceCents)}</strong>
        <span>{money(item.priceCents / item.tokens)} pro Token · einmalig</span>
        <button type="button" disabled={!available || busy || Boolean(pendingSelection && pendingSelection.packId !== item.id)} onClick={() => { setSelected(item.id); setAccepted(false); setError(""); }}>
          {selected === item.id ? "Ausgewählt ✓" : available ? "Paket auswählen" : "Kauf noch nicht verfügbar"}
        </button>
      </article>;
    })}</div>
    <p className="token-shop-status" role="status">{verified && catalog ? catalog.message : error ? "Die Kaufverfügbarkeit ist momentan ungeprüft." : "Tokenpakete werden geprüft …"}</p>
    {pack && <div className="token-purchase-review" aria-label="Tokenkauf prüfen">
      <h3>{pack.tokens} Tokens · {money(pack.priceCents)}</h3><p>Einmalige Zahlung. Kein Abo und keine automatische Verlängerung.</p>
      <label>Rechnungsland<select value={country} disabled={busy || Boolean(pendingSelection)} onChange={event => { setCountry(event.target.value === "LI" ? "LI" : "CH"); setAccepted(false); }}><option value="CH">Schweiz</option><option value="LI">Liechtenstein</option></select></label>
      <label className="legal-consent"><input type="checkbox" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} /><span>Ich habe die <Link href="/recht/agb" target="_blank" rel="noopener noreferrer">AGB</Link>, <Link href="/recht/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutzhinweise</Link> und <Link href="/recht/tokenpakete" target="_blank" rel="noopener noreferrer">Bedingungen für Tokenpakete</Link> gelesen und akzeptiere sie.</span></label>
      <button className="button primary" type="button" disabled={!accepted || busy || !verified || !catalog?.enabled || !catalog.packs.some(value => value.id === selected && value.available)} onClick={checkout}>{busy ? "Wird geprüft …" : pendingSelection ? "Denselben Checkout öffnen →" : "Weiter zur Zahlung bei Shopify →"}</button>
      <p>Der Kauf wird erst bei Shopify bezahlt. Nach der bestätigten Zahlung wird das Guthaben deinem angemeldeten Konto gutgeschrieben.</p>
    </div>}
    {notice && <p className="token-shop-notice" role="status">{notice}</p>}
    {error && <p className="account-message" role="alert">{error}</p>}
    <button className="token-refresh" type="button" disabled={busy} onClick={refresh}>Kaufstatus & Guthaben aktualisieren</button>
    {!!catalog?.purchases.length && <div className="token-purchase-history"><h3>Deine Tokenkäufe</h3><ul>{catalog.purchases.map(purchase => <li key={purchase.id}><span><strong>{purchase.tokens} Tokens</strong><small>{new Date(purchase.createdAt).toLocaleDateString("de-CH")}</small></span><span>{names[purchase.status] || "In Prüfung"}<small>{money(purchase.priceCents)}</small></span></li>)}</ul></div>}
  </section>;
}
