"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PreparationListItem } from "../../cappatex-preparation-list";
import type { PreparationSummary } from "../../cappatex-preparation";
import { parsePreparationListResponse, parsePreparationResponse } from "../../cappatex-preparation-response";
import { PreparedReceipt } from "../cappatex-preparation-panel";

export type PreparationHistoryFilters = { q: string; sides: "all" | "front" | "back" | "both" };
const emptyFilters: PreparationHistoryFilters = { q: "", sides: "all" };
function listAddress(filters: PreparationHistoryFilters, cursor?: string | null) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.sides !== "all") query.set("sides", filters.sides);
  if (cursor) query.set("cursor", cursor);
  return `/api/cappatex/preparations${query.size ? `?${query}` : ""}`;
}
function writeFilters(filters: PreparationHistoryFilters) {
  const url = new URL(window.location.href);
  if (filters.q) url.searchParams.set("q", filters.q); else url.searchParams.delete("q");
  if (filters.sides !== "all") url.searchParams.set("sides", filters.sides); else url.searchParams.delete("sides");
  url.hash = "";
  window.history.replaceState(window.history.state, "", url);
}

const sideName = (position: "front" | "back") => position === "front" ? "Vorderseite" : "Rückseite";
const date = (timestamp: number) => new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(timestamp);
const loadError = (caught: unknown) => caught instanceof Error && caught.name === "TimeoutError"
  ? "Das Laden dauert zu lange. Bitte versuche es erneut."
  : caught instanceof TypeError ? "Die Verbindung ist unterbrochen. Bitte versuche es erneut."
  : caught instanceof Error ? caught.message : "Der gespeicherte Stand konnte nicht geladen werden.";

async function read(response: Response): Promise<unknown> {
  const data = await response.json().catch(() => { throw new Error("Die Antwort konnte nicht gelesen werden. Bitte lade die Ansicht erneut."); });
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Der gespeicherte Stand konnte nicht geladen werden.");
  return data;
}

function ComparedStand({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<PreparationSummary | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cappatex/preparations/${id}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) })
      .then(read).then(value => {
        const result = parsePreparationResponse(value, id);
        if (!controller.signal.aborted) setReceipt(result);
      }).catch(caught => {
        if (!controller.signal.aborted) setError(loadError(caught));
      });
    return () => controller.abort();
  }, [id, refresh]);
  return <article className="cappatex-saved-compare-item">
    {error ? <><p role="alert" className="gallery-error">{error}</p><button type="button" className="button secondary" onClick={() => { setError(""); setRefresh(value => value + 1); }}>Ansicht erneut laden</button></> : receipt ? <>
      <h3>{receipt.name}</h3><p>Gespeichert am {date(receipt.createdAt)}</p>
      <PreparedReceipt receipt={receipt} />
      <Link className="button secondary" href={`/cappatex?preparationId=${id}&resume=1#studio`}>Als Kopie weitergestalten</Link>
    </> : <p role="status">Produktansichten werden geladen …</p>}
  </article>;
}

export default function Preparations({ initialFilters = emptyFilters, initialError = "" }: {
  initialFilters?: PreparationHistoryFilters; initialError?: string;
}) {
  const [items, setItems] = useState<PreparationListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialError);
  const [error, setError] = useState(initialError);
  const [query, setQuery] = useState(initialFilters.q);
  const [sideFilter, setSideFilter] = useState(initialFilters.sides);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  async function load(filters: PreparationHistoryFilters, next: string | null, append: boolean) {
    if (append && inFlight.current) return;
    controller.current?.abort();
    inFlight.current = true;
    const request = new AbortController(); controller.current = request;
    setLoading(true); setError("");
    if (!append) { setItems([]); setCursor(null); setSelected([]); setAppliedFilters(filters); }
    try {
      const result = parsePreparationListResponse(await read(await fetch(listAddress(filters, next), { cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]) })));
      if (request.signal.aborted || controller.current !== request) return;
      setItems(current => append ? [...current, ...result.items.filter(item => !current.some(known => known.id === item.id))] : result.items);
      setCursor(result.nextCursor);
    } catch (caught) {
      if (!request.signal.aborted && controller.current === request) setError(loadError(caught));
    } finally {
      if (controller.current === request) { inFlight.current = false; if (!request.signal.aborted) setLoading(false); }
    }
  }
  useEffect(() => {
    if (initialError) return;
    const request = new AbortController(); controller.current = request; inFlight.current = true;
    fetch(listAddress(initialFilters), { cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]) }).then(read).then(parsePreparationListResponse).then(result => {
      if (!request.signal.aborted && controller.current === request) { setItems(result.items); setCursor(result.nextCursor); }
    }).catch(caught => {
      if (!request.signal.aborted) setError(loadError(caught));
    }).finally(() => {
      if (controller.current === request) { inFlight.current = false; if (!request.signal.aborted) setLoading(false); }
    });
    return () => { request.abort(); controller.current?.abort(); inFlight.current = false; };
  }, [initialFilters, initialError]);

  function apply(filters: PreparationHistoryFilters) {
    setQuery(filters.q); setSideFilter(filters.sides); writeFilters(filters);
    void load(filters, null, false);
  }
  const filtered = Boolean(appliedFilters.q || appliedFilters.sides !== "all");

  function compare(id: string) {
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 2 ? [...current, id] : current);
  }
  return <>
    <header className="gallery-intro">
      <p className="eyebrow">CAPPATEX · Nur für dein Konto</p>
      <h1>Deine Gestaltungen.</h1>
      <p>Hier findest du deine gespeicherten Produkte mit Motiven und Druckseiten. Öffne einen Stand oder gestalte ihn als neue Kopie weiter.</p>
      <nav className="gallery-shortcuts" aria-label="Deine CAPPATEX Sammlung"><Link href="/cappatex#studio">Produkt gestalten</Link><Link href="/cappatex/sammlung">Meine Motive</Link><Link href="/cappatex/designs">Designgalerie</Link></nav>
    </header>
    <div className="cappatex-saved-toolbar"><p>Die Originale bleiben unverändert. Preis, Verfügbarkeit und Versand werden vor einer Bestellung erneut geprüft.</p>
      <button type="button" className="button secondary" disabled={loading} onClick={() => void load(appliedFilters, null, false)}>Übersicht aktualisieren</button>
      {selected.length > 0 && <a className="text-link" href="#saved-comparison">Vergleich ansehen ({selected.length}/2) ↓</a>}</div>
    <form className="cappatex-saved-search" role="search" aria-label="Eigene Gestaltungen durchsuchen" onSubmit={event => {
      event.preventDefault(); apply({ q: query.trim(), sides: sideFilter });
    }}>
      <label>Produkt, Farbe, Grösse oder Motiv-ID<input type="search" name="q" maxLength={80} value={query} onChange={event => setQuery(event.target.value)} placeholder="Zum Beispiel Hoodie oder CPX-…" /></label>
      <label>Druckseiten<select name="sides" value={sideFilter} onChange={event => setSideFilter(event.target.value as PreparationHistoryFilters["sides"])}>
        <option value="all">Alle Druckseiten</option><option value="front">Nur Vorderseite</option><option value="back">Nur Rückseite</option><option value="both">Vorder- und Rückseite</option>
      </select></label>
      <button type="submit" className="button primary">Suchen & filtern</button>
      {(filtered || query || sideFilter !== "all" || initialError) && <button type="button" className="button secondary" onClick={() => apply(emptyFilters)}>Filter zurücksetzen</button>}
    </form>
    <p className="cappatex-saved-help" role="status" aria-live="polite">{loading ? "Gespeicherte Gestaltungen werden geprüft …" : error ? "Die Ansicht konnte noch nicht geladen werden. Deine gespeicherten Gestaltungen bleiben erhalten."
      : `${items.length} ${filtered ? "passende " : ""}Gestaltung${items.length === 1 ? "" : "en"} geladen${cursor ? " · Weitere Ergebnisse verfügbar" : ""}.`}</p>
    {error && <p role="alert" className="gallery-error">{error}</p>}
    {!loading && !error && items.length === 0 && <div className="gallery-empty"><h2>{cursor ? "In diesem Abschnitt fehlen lesbare Treffer." : filtered ? "Keine passende Gestaltung gefunden." : "Dein erstes Produkt wartet auf dein Motiv."}</h2>
      <p>{cursor ? "Weitere gespeicherte Stände können noch passen. Lade die nächsten Ergebnisse oder ändere deine Suche."
        : filtered ? "Versuche einen kürzeren Suchbegriff oder wähle andere Druckseiten. Du kannst auch alle Filter zurücksetzen."
        : "Wähle im Studio ein Produkt, übernimm die gewünschten Druckseiten und speichere die Zusammenstellung. Sie erscheint danach hier."}</p>
      {filtered ? <button type="button" className="button secondary" onClick={() => apply(emptyFilters)}>Alle Gestaltungen anzeigen</button> : <Link className="button primary" href="/cappatex#studio">Zum CAPPATEX Studio</Link>}</div>}
    {items.length > 0 && <>
      <p className="cappatex-saved-help" id="saved-compare-help">Wähle bis zu zwei Stände zum Vergleichen. Die kleinen Bilder zeigen deine Motive; im Vergleich siehst du sie auf den gespeicherten Produkten.</p>
      <div className="cappatex-saved-grid">{items.map(item => <article key={item.id} className="cappatex-saved-card">
        <p className="cappatex-saved-date"><time dateTime={new Date(item.createdAt).toISOString()}>{date(item.createdAt)}</time></p>
        {item.integrity === "unavailable" ? <><h2>Gespeicherter Stand nicht lesbar</h2><p>Die gespeicherten Daten konnten nicht bestätigt werden. Dieser Stand kann nicht weiterbearbeitet oder bestellt werden.</p><code>{item.id}</code></> : <>
          <div className="cappatex-saved-motifs">{item.sides.map(side => <figure key={side.position}><div><img src={side.previewUrl} alt={`Motiv für die ${sideName(side.position)}`} loading="lazy" /></div><figcaption>{sideName(side.position)}</figcaption></figure>)}</div>
          <h2>{item.name}</h2><p>{item.variant.color} / {item.variant.size} · {item.quantity} Stück · {item.country === "LI" ? "Liechtenstein" : "Schweiz"}</p>
          <p>{item.sides.map(side => `${sideName(side.position)}: ${side.file.width} × ${side.file.height} px`).join(" · ")}</p>
          <div className="cappatex-saved-actions"><Link className="text-link" href={`/cappatex/vorbereitung/${item.id}`}>Stand prüfen →</Link><Link className="button secondary" href={`/cappatex?preparationId=${item.id}&resume=1#studio`}>Als Kopie weitergestalten</Link></div>
          <label className="cappatex-saved-select"><input type="checkbox" checked={selected.includes(item.id)} disabled={!selected.includes(item.id) && selected.length >= 2} onChange={() => compare(item.id)} aria-describedby="saved-compare-help" />Zum Vergleich auswählen<span className="cappatex-saved-accessible">: {item.name}, {date(item.createdAt)}, {item.variant.color}, {item.variant.size}</span></label>
        </>}
      </article>)}</div>
      <section className="cappatex-saved-comparison" id="saved-comparison" aria-labelledby="saved-comparison-heading">
        <div className="cappatex-saved-toolbar"><h2 id="saved-comparison-heading">Produktvergleich <span>({selected.length}/2)</span></h2>{selected.length > 0 && <button type="button" className="button secondary" onClick={() => setSelected([])}>Vergleich leeren</button>}</div>
        {selected.length === 0 ? <p>Wähle oben einen oder zwei gespeicherte Stände aus.</p> : <div className="cappatex-saved-compare-grid">{selected.map(id => <ComparedStand key={id} id={id} />)}</div>}
      </section>
    </>}
    {cursor && <div className="gallery-pagination"><button type="button" disabled={loading} onClick={() => void load(appliedFilters, cursor, true)}>{loading ? "Weitere Gestaltungen werden geladen …" : "Weitere Gestaltungen laden"}</button></div>}
  </>;
}
