"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PreparationListItem, PreparationListResponse } from "../../cappatex-preparation-list";
import type { PreparationSummary } from "../../cappatex-preparation";
import { PreparedReceipt } from "../cappatex-preparation-panel";

const sideName = (position: "front" | "back") => position === "front" ? "Vorderseite" : "Rückseite";
const date = (timestamp: number) => new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(timestamp);
const loadError = (caught: unknown) => caught instanceof Error && caught.name === "TimeoutError"
  ? "Das Laden dauert zu lange. Bitte versuche es erneut."
  : caught instanceof TypeError ? "Die Verbindung ist unterbrochen. Bitte versuche es erneut."
  : caught instanceof Error ? caught.message : "Der gespeicherte Stand konnte nicht geladen werden.";

async function read<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Der gespeicherte Stand konnte nicht geladen werden.");
  return data as T;
}

function ComparedStand({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<PreparationSummary | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cappatex/preparations/${id}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) })
      .then(read<PreparationSummary>).then(result => {
        if (!result || result.id !== id) throw new Error("Der gespeicherte Stand konnte nicht eindeutig bestätigt werden.");
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

export default function Preparations() {
  const [items, setItems] = useState<PreparationListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  async function load(next: string | null, append: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = new AbortController(); controller.current = request;
    setLoading(true); setError("");
    try {
      const result = await read<PreparationListResponse>(await fetch(`/api/cappatex/preparations${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]) }));
      if (request.signal.aborted) return;
      setItems(current => append ? [...current, ...result.items.filter(item => !current.some(known => known.id === item.id))] : result.items);
      setCursor(result.nextCursor);
      if (!append) setSelected([]);
    } catch (caught) {
      if (!request.signal.aborted) setError(loadError(caught));
    } finally {
      if (controller.current === request) { inFlight.current = false; if (!request.signal.aborted) setLoading(false); }
    }
  }
  useEffect(() => {
    const request = new AbortController(); controller.current = request; inFlight.current = true;
    fetch("/api/cappatex/preparations", { cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]) }).then(read<PreparationListResponse>).then(result => {
      if (!request.signal.aborted) { setItems(result.items); setCursor(result.nextCursor); }
    }).catch(caught => {
      if (!request.signal.aborted) setError(loadError(caught));
    }).finally(() => {
      if (controller.current === request) { inFlight.current = false; if (!request.signal.aborted) setLoading(false); }
    });
    return () => { request.abort(); controller.current?.abort(); inFlight.current = false; };
  }, []);

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
      <button type="button" className="button secondary" disabled={loading} onClick={() => void load(null, false)}>Übersicht aktualisieren</button>
      {selected.length > 0 && <a className="text-link" href="#saved-comparison">Vergleich ansehen ({selected.length}/2) ↓</a>}</div>
    {error && <p role="alert" className="gallery-error">{error}</p>}
    {loading && <p role="status">Deine Gestaltungen werden geladen …</p>}
    {!loading && !error && items.length === 0 && <div className="gallery-empty"><h2>Dein erstes Produkt wartet auf dein Motiv.</h2><p>Wähle im Studio ein Produkt, übernimm die gewünschten Druckseiten und speichere die Zusammenstellung. Sie erscheint danach hier.</p><Link className="button primary" href="/cappatex#studio">Zum CAPPATEX Studio</Link></div>}
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
    {cursor && <div className="gallery-pagination"><button type="button" disabled={loading} onClick={() => void load(cursor, true)}>{loading ? "Weitere Gestaltungen werden geladen …" : "Weitere Gestaltungen laden"}</button></div>}
  </>;
}
