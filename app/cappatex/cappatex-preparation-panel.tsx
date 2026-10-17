"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import type { CappatexDesignProduct } from "../cappatex-design-catalog";
import type { ArtworkSize, Placement, ProfileVariant } from "../cappatex-print-profile";
import type { PreparationInput, PreparationSummary, PrintSide } from "../cappatex-preparation";

type Selection = { position: PrintSide; designId: string; placement: Placement; artwork: ArtworkSize;
  area: ProfileVariant["area"]; mockup: ProfileVariant["mockup"] };
const sideName = (side: PrintSide) => side === "front" ? "Vorderseite" : "Rückseite";

function SidePreview({ selection }: { selection: Selection }) {
  const { mockup: m, area, placement: p, artwork } = selection;
  return <div className="cappatex-preparation-photo" style={{ aspectRatio: `${m.width}/${m.height}` }}>
    <img src={m.url} alt={`${sideName(selection.position)} – übernommene Gestaltung`} />
    <span style={{ position: "absolute", left: `${m.left / m.width * 100}%`, top: `${m.top / m.height * 100}%`, width: `${m.printWidth / m.width * 100}%`, height: `${m.printHeight / m.height * 100}%` }}>
      <img src={`/api/cappatex/artwork/${selection.designId}`} alt="Übernommenes Motiv" style={{ position: "absolute", maxWidth: "none",
        left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.scale * 100}%`,
        height: `${p.scale * area.widthPx / area.heightPx * artwork.height / artwork.width * 100}%`, transform: "translate(-50%, -50%)" }} />
    </span>
    {m.foreground?.map((polygon, i) => <img key={i} src={m.url} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0,
      clipPath: `polygon(${polygon.map(([x,y]) => `${100*x/m.width}% ${100*y/m.height}%`).join(",")})` }} />)}
  </div>;
}

export function PreparedReceipt({ receipt }: { receipt: PreparationSummary }) {
  return <div className="cappatex-preparation-receipt"><h4>Gespeicherter Stand</h4>
    <p>{receipt.name} · {receipt.variant.color} / {receipt.variant.size} · {receipt.quantity} Stück · {receipt.country}</p>
    <p>Dieser Stand bleibt unverändert, auch wenn du im Designer weiterarbeitest.</p>
    <div className="cappatex-preparation-sides">{receipt.sides.map(s => <article key={s.position}><h4>{sideName(s.position)}</h4>
      <SidePreview selection={s} /><p>{s.file.width} × {s.file.height} px · Motiv: {Math.floor(s.dpi)} dpi</p>
      {s.downloadUrl ? <a className="text-link" href={s.downloadUrl}>{sideName(s.position)} als Druck-PNG herunterladen</a> : <p>Original-Download für dein Konto noch nicht freigegeben.</p>}
    </article>)}</div>
    <a className="text-link" href={`/cappatex/vorbereitung/${receipt.id}`}>Gespeicherten Stand öffnen →</a>
    <p>Nur für dein Konto sichtbar. Preis, Checkout und Produktion sind noch nicht freigegeben.</p>
  </div>;
}

export default function CappatexPreparationPanel({ product, variant, side, designId, artwork, placement, ready, quantity, country, onSaving }: {
  product: CappatexDesignProduct; variant: CappatexDesignProduct["variants"][number]; side: PrintSide; designId: string;
  artwork: ArtworkSize; placement: Placement; ready: boolean; quantity: number; country: "CH" | "LI"; onSaving: (saving: boolean) => void;
}) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const [receipt, setReceipt] = useState<PreparationSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const retry = useRef<{ body: PreparationInput; signature: string } | null>(null);
  const availableSides: PrintSide[] = variant.back ? ["front", "back"] : ["front"];
  const activeSelection = selections.find(selection => selection.position === side);
  const activeSelectionChanged = Boolean(activeSelection && (activeSelection.designId !== designId
    || activeSelection.placement.x !== placement.x || activeSelection.placement.y !== placement.y
    || activeSelection.placement.scale !== placement.scale));
  const currentSignature = JSON.stringify({ profileId: product.id, profileVersion: product.profileVersion,
    shopifyVariantId: variant.shopifyVariantId, quantity, country,
    sides: selections.map(selection => ({ position: selection.position, designId: selection.designId, placement: selection.placement })) });
  const hasUnsavedSelections = selections.length > 0 && currentSignature !== savedSignature;
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("preparationId");
    if (!id || !/^CPP-[a-f0-9]{32}$/.test(id)) return;
    let active = true;
    fetch(`/api/cappatex/preparations/${id}`, { cache: "no-store" }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Gespeicherter Stand nicht verfügbar.");
      if (active) setReceipt(data);
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  function capture() {
    if (!ready || !designId || saving) return;
    const selected = { position: side, designId, placement: { ...placement }, artwork: { ...artwork }, area: variant.area, mockup: variant.mockup };
    setSelections(current => [...current.filter(s => s.position !== side), selected].sort((a,b) => a.position === b.position ? 0 : a.position === "front" ? -1 : 1));
    setMessage(`${sideName(side)} übernommen. Änderungen im Designer werden erst durch erneutes Übernehmen eingetragen.`);
  }
  async function save() {
    if (!selections.length || saving) return;
    const data = { profileId: product.id, profileVersion: product.profileVersion, shopifyVariantId: variant.shopifyVariantId, quantity, country,
      sides: selections.map(s => ({ position: s.position, designId: s.designId, placement: s.placement })) };
    const signature = JSON.stringify(data);
    if (!retry.current || retry.current.signature !== signature) retry.current = { signature, body: { ...data, requestId: crypto.randomUUID() } };
    setSaving(true); onSaving(true); setMessage("Druckdateien werden erstellt und gemeinsam gespeichert …");
    try {
      const response = await fetch("/api/cappatex/preparations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(retry.current.body) });
      const result = await response.json();
      if (response.status === 202) { setMessage(result.error); return; }
      // Keep the request ID after an ambiguous server/network failure; only a confirmed
      // failed reservation permits a new attempt. A completed save must never be duplicated.
      if (!response.ok) { if (result.code === "failed") retry.current = null; throw new Error(result.error || "Speichern fehlgeschlagen."); }
      setReceipt(result);
      setSavedSignature(signature);
      const url = new URL(window.location.href); url.searchParams.set("preparationId", result.id); url.hash = "order-preparation";
      window.history.replaceState(window.history.state, "", url);
      setMessage("Alle ausgewählten Druckseiten sind unveränderlich gespeichert. Es wurde keine Bestellung ausgelöst.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Speicherstatus unklar. Bitte mit derselben Auswahl erneut prüfen."); }
    finally { setSaving(false); onSaving(false); }
  }
  return <section className="cappatex-preparation" id="order-preparation" aria-labelledby="preparation-heading">
    <h3 id="preparation-heading">Druckseiten zusammenstellen</h3>
    <p>Übernimm zuerst jede gewünschte Druckseite aus der Vorschau. Speichere danach die gesamte Zusammenstellung. Du kannst vorne und hinten unterschiedliche Motive verwenden.</p>
    <p className="cappatex-preparation-note">Beim Wechsel von Produkt, Farbe oder Grösse beginnt eine neue Zusammenstellung. Ein bereits gespeicherter Stand bleibt erhalten.</p>
    <ul className="cappatex-side-status" aria-label="Übernommene Druckseiten">{availableSides.map(position => {
      const selected = selections.some(selection => selection.position === position);
      return <li key={position} data-state={selected ? position === side && activeSelectionChanged ? "changed" : "captured" : "empty"}>
        <b>{sideName(position)}</b><span>{selected ? position === side && activeSelectionChanged ? "Übernommen · neue Änderungen noch offen" : "Übernommen" : "Noch nicht übernommen"}</span>
      </li>;
    })}</ul>
    {activeSelectionChanged && <p className="cappatex-preparation-warning" role="status">Die aktuelle {sideName(side)} wurde seit dem Übernehmen geändert. Übernimm sie erneut, damit das neue Motiv oder die neue Platzierung mitgespeichert wird.</p>}
    {!ready && !saving && <p className="cappatex-action-hint">{!designId ? "Erstelle oder lade zuerst dein Motiv und prüfe es auf dem Produkt." : "Prüfe die Produktvorschau, Druckfläche und Auflösung, bevor du diese Seite übernimmst."}</p>}
    <button type="button" className="button secondary" disabled={!ready || saving} onClick={capture}>Aktuelle {sideName(side)} {activeSelection ? "erneut übernehmen" : "übernehmen"}</button>
    <div className="cappatex-preparation-sides">{selections.map(s => <article key={s.position}>
      <h4>{sideName(s.position)}</h4><SidePreview selection={s} /><p>{s.designId} · {Math.round(s.placement.scale * 100)} % Breite</p>
      <button type="button" disabled={saving} onClick={() => setSelections(current => current.filter(item => item.position !== s.position))}>{sideName(s.position)} entfernen</button>
    </article>)}</div>
    {!!selections.length && <p>{product.name} · {variant.color} / {variant.size} · {quantity} Stück · {country} · {selections.length} Druckseite{selections.length === 1 ? "" : "n"}</p>}
    <p className="cappatex-preparation-save-state" data-state={hasUnsavedSelections ? "unsaved" : selections.length ? "saved" : "empty"} role="status">
      {saving ? "Die übernommenen Druckseiten werden gespeichert …" : hasUnsavedSelections ? "Diese Zusammenstellung ist noch nicht gespeichert."
        : selections.length ? "Diese Zusammenstellung ist gespeichert. Weitere Änderungen erzeugen beim Speichern einen neuen Stand."
        : receipt ? "Deinen gespeicherten Stand siehst du unten. Für eine neue Zusammenstellung übernimm zuerst eine Druckseite." : "Übernimm mindestens eine Druckseite, um deine Zusammenstellung zu speichern."}
    </p>
    <button type="button" className="button primary" disabled={!selections.length || saving} onClick={save}>{saving ? "Dateien werden vorbereitet …" : "Druckseiten & Dateien speichern"}</button>
    {message && <p role="status">{message}</p>}
    {receipt && <PreparedReceipt receipt={receipt} />}
  </section>;
}
