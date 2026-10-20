"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import ModelViewer from "../model-viewer";
import OfferPanel from "./offer-panel";
import {
  AB3D_ORDER_STATUS_LABELS, AB3D_REVIEW_LABELS, AB3D_REVIEW_STATES,
  type Ab3dOperationDetail, type Ab3dOperationSummary, type Ab3dReview, type Ab3dReviewState,
} from "../ab3d-operations";
import { isDirtyReviewDraft as dirty, mergeRecoveredReviewDrafts, parseReviewDrafts, reconcileReviewDraft, reviewDraft as draftFromReview, serializeReviewDrafts, type ReviewDraft as Draft, type ReviewDrafts } from "./draft-storage";

type List = { orders: Ab3dOperationSummary[]; nextCursor: string | null };
type Filters = { q: string; status: string; review: string };
const emptyFilters: Filters = { q: "", status: "all", review: "all" };
const date = (value: number | null) => value ? new Date(value).toLocaleString("de-CH") : "Noch nicht geprüft";
const money = (cents: number, currency: string) => new Intl.NumberFormat("de-CH", { style: "currency", currency }).format(cents / 100);
const taskLabel = (status: string | null) => status === "SUCCEEDED" ? "Dateiumwandlung abgeschlossen" : status === "FAILED" ? "Dateiumwandlung fehlgeschlagen" : status ? `Dateiumwandlung: ${status}` : "Keine erfolgreiche Dateiumwandlung nachgewiesen";

async function readJson(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Daten konnten nicht geladen werden. Bitte erneut versuchen.");
  if (!body || typeof body !== "object") throw new Error("Die Antwort ist unvollständig. Bitte erneut laden.");
  return body;
}

function inspectionLink(detail: Ab3dOperationDetail, format: "glb" | "stl" | "threeMf") {
  const value = detail.files[format], parameter = format === "threeMf" ? "3mf" : format;
  const expected = `/api/ab3d/operations/${encodeURIComponent(detail.order.id)}/file?format=${parameter}`;
  return value === expected ? expected : null;
}

export default function Operations({ ownerEmail }: { ownerEmail: string }) {
  const [filters, setFilters] = useState(emptyFilters), [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [list, setList] = useState<List | null>(null), [listBusy, setListBusy] = useState(true), [listError, setListError] = useState("");
  const [revision, setRevision] = useState(0), [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState<Record<string, Ab3dOperationDetail>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [draftStorageReady, setDraftStorageReady] = useState(false), [draftStorageError, setDraftStorageError] = useState("");
  const [draftStorageRevision, setDraftStorageRevision] = useState(0);
  const [detailBusy, setDetailBusy] = useState(false), [detailError, setDetailError] = useState("");
  const [detailRevision, setDetailRevision] = useState(0), [saving, setSaving] = useState("");
  const [notice, setNotice] = useState(""), [conflicts, setConflicts] = useState<Record<string, boolean>>({});
  const [previewId, setPreviewId] = useState(""), [previewBusy, setPreviewBusy] = useState(false), [previewError, setPreviewError] = useState("");
  const [autoRotate, setAutoRotate] = useState(false);
  const listRequest = useRef<AbortController | null>(null);
  const savingId = useRef("");
  const storageKey = useRef(""), draftsRef = useRef<ReviewDrafts>({});
  const storageWritable = useRef(false);
  const previewRequest = useRef(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const hasDrafts = Object.values(drafts).some(dirty);
  const detail = details[selectedId], draft = drafts[selectedId];

  const changeDrafts = useCallback((update: (current: ReviewDrafts) => ReviewDrafts) => {
    const next = update(draftsRef.current);
    draftsRef.current = next; setDrafts(next);
    if (!storageKey.current || !storageWritable.current) return;
    try {
      const raw = serializeReviewDrafts(next);
      if (raw === null) sessionStorage.removeItem(storageKey.current); else sessionStorage.setItem(storageKey.current, raw);
    } catch {
      storageWritable.current = false;
      setDraftStorageReady(false);
      setDraftStorageError("Die lokale Sicherung deiner Eingabe ist fehlgeschlagen. Speichere offene Prüfungen, bevor du navigierst. Deine Eingabe bleibt in dieser Ansicht erhalten.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(ownerEmail.trim().toLowerCase())).then(bytes => {
      if (!active) return;
      const key = `ab3d-review-drafts-v1:${Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("")}`;
      storageKey.current = key;
      storageWritable.current = false;
      const recovered = parseReviewDrafts(sessionStorage.getItem(key));
      storageWritable.current = true;
      setDraftStorageReady(true); setDraftStorageError("");
      changeDrafts(current => mergeRecoveredReviewDrafts(current, recovered));
      if (Object.keys(recovered).length) setNotice("Ungespeicherte Prüfnotizen aus diesem Tab wiederhergestellt. Wähle die betreffende Anfrage und prüfe den aktuellen Stand vor dem Speichern.");
    }).catch(() => {
      if (active) {
        storageWritable.current = false; setDraftStorageReady(false);
        setDraftStorageError("Prüfnotizen können in diesem Tab nicht sicher zwischengespeichert werden. Die Bearbeitung bleibt gesperrt. Erlaube den Sitzungsspeicher und versuche es erneut. Einen beschädigten Zwischenspeicher kannst du ausdrücklich verwerfen.");
      }
    });
    return () => { active = false; };
  }, [ownerEmail, draftStorageRevision, changeDrafts]);

  useEffect(() => {
    if (!hasDrafts) return;
    const protectDrafts = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protectDrafts);
    return () => window.removeEventListener("beforeunload", protectDrafts);
  }, [hasDrafts]);

  useEffect(() => {
    const controller = new AbortController();
    listRequest.current?.abort(); listRequest.current = controller;
    const query = new URLSearchParams({ ...appliedFilters, limit: "20" });
    fetch(`/api/ab3d/operations?${query}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) })
      .then(readJson).then(body => {
        if (!Array.isArray(body.orders)) throw new Error("Die Anfrageliste ist unvollständig.");
        if (controller.signal.aborted) return;
        setList(body as List);
      }).catch(error => { if (!controller.signal.aborted) setListError(error instanceof Error ? error.message : "Anfragen konnten nicht geladen werden."); })
      .finally(() => { if (!controller.signal.aborted) setListBusy(false); });
    return () => { controller.abort(); listRequest.current?.abort(); };
  }, [appliedFilters, revision]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetch(`/api/ab3d/operations/${encodeURIComponent(selectedId)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) })
      .then(readJson).then(body => {
        const incoming = body as Ab3dOperationDetail;
        if (incoming.order?.id !== selectedId || !incoming.order.review || !incoming.files) throw new Error("Die Detailansicht ist unvollständig.");
        if (controller.signal.aborted) return;
        setDetails(current => current[selectedId]?.order.review.version > incoming.order.review.version
          ? current : { ...current, [selectedId]: incoming });
        const saveInProgress = savingId.current === selectedId;
        changeDrafts(current => ({ ...current, [selectedId]: reconcileReviewDraft(current[selectedId], incoming.order.review, saveInProgress) }));
      }).catch(error => { if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : "Details konnten nicht geladen werden."); })
      .finally(() => { if (!controller.signal.aborted) setDetailBusy(false); });
    return () => controller.abort();
  }, [selectedId, detailRevision, changeDrafts]);

  function selectOrder(id: string) {
    if (savingId.current || id === selectedId) return;
    previewRequest.current++; setPreviewBusy(false); setAutoRotate(false);
    setDetailBusy(true); setDetailError(""); setPreviewError("");
    setSelectedId(id); setNotice("");
    requestAnimationFrame(() => detailHeading.current?.focus());
  }

  function refreshList() { setListBusy(true); setListError(""); setRevision(current => current + 1); }
  function refreshDetail() { setDetailBusy(true); setDetailError(""); setDetailRevision(current => current + 1); }

  function guardNavigation(event: MouseEvent<HTMLAnchorElement>) {
    if (!hasDrafts) return;
    event.preventDefault();
    setNotice("Du hast ungespeicherte Prüfnotizen. Speichere sie zuerst oder verwirf sie ausdrücklich, bevor du diese Seite verlässt.");
  }

  async function loadMore() {
    if (!list?.nextCursor || listBusy) return;
    const controller = new AbortController(); listRequest.current?.abort(); listRequest.current = controller;
    const query = new URLSearchParams({ ...appliedFilters, limit: "20", cursor: list.nextCursor });
    setListBusy(true); setListError("");
    try {
      const body = await readJson(await fetch(`/api/ab3d/operations?${query}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) }));
      if (!Array.isArray(body.orders)) throw new Error("Die Anfrageliste ist unvollständig.");
      if (!controller.signal.aborted) setList(current => ({ orders: [...(current?.orders || []), ...body.orders.filter((order: Ab3dOperationSummary) => !current?.orders.some(previous => previous.id === order.id))], nextCursor: body.nextCursor || null }));
    } catch (error) { if (!controller.signal.aborted) setListError(error instanceof Error ? error.message : "Weitere Anfragen konnten nicht geladen werden."); }
    finally { if (!controller.signal.aborted) setListBusy(false); }
  }

  function updateDraft(change: Partial<Pick<Draft, "state" | "notes">>) {
    changeDrafts(current => current[selectedId] ? { ...current, [selectedId]: { ...current[selectedId], ...change } } : current);
    setNotice("");
  }

  function discardDraft(id: string) {
    const saved = details[id]?.order.review;
    if (!saved) return;
    changeDrafts(current => ({ ...current, [id]: draftFromReview(saved) }));
    setConflicts(current => ({ ...current, [id]: false }));
    setNotice("Lokale Änderungen an dieser Prüfung verworfen. Der zuletzt geladene Stand ist übernommen.");
  }

  async function saveReview() {
    if (!detail || !draft || savingId.current || !dirty(draft) || draft.notes.length > 3000 || conflicts[selectedId]) return;
    const id = selectedId, submitted = { ...draft };
    savingId.current = id; setSaving(id); setDetailError(""); setNotice("");
    try {
      const response = await fetch(`/api/ab3d/operations/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: submitted.state, notes: submitted.notes, version: submitted.version }), signal: AbortSignal.timeout(30_000) });
      const body = await response.json().catch(() => null);
      if (response.status === 409 && body?.code === "review_conflict") {
        setConflicts(current => ({ ...current, [id]: true }));
        refreshDetail();
        throw new Error("Diese Prüfung wurde zwischenzeitlich geändert. Deine Eingabe bleibt erhalten. Vergleiche sie mit dem neu geladenen Stand.");
      }
      if (!response.ok || !body?.review) throw new Error(body?.error || "Prüfung konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten.");
      const review = body.review as Ab3dReview;
      if (review.version !== submitted.version + 1 || review.state !== submitted.state || review.notes !== submitted.notes) {
        throw new Error("Die Speicherbestätigung passt nicht zu deiner Eingabe. Deine Notiz bleibt erhalten. Lade den gespeicherten Stand zum Vergleich neu.");
      }
      setDetails(current => current[id] ? { ...current, [id]: { ...current[id], order: { ...current[id].order, review } } } : current);
      changeDrafts(current => {
        const present = current[id];
        if (!present) return current;
        return { ...current, [id]: { ...present, version: review.version, savedState: review.state, savedNotes: review.notes } };
      });
      setList(current => current ? { ...current, orders: current.orders.map(order => order.id === id ? { ...order, review } : order) } : current);
      setNotice(`Prüfung für ${id} gespeichert. Zahlungs- und Fertigungsstatus wurden nicht geändert.`);
      if (selectedId === id) refreshDetail();
    } catch (error) { setDetailError(error instanceof Error ? error.message : "Prüfung konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten."); }
    finally { savingId.current = ""; setSaving(""); }
  }

  async function openPreview() {
    if (!detail || !inspectionLink(detail, "glb") || previewBusy) return;
    const id = selectedId, request = ++previewRequest.current; setPreviewBusy(true); setPreviewError("");
    try { await import("@google/model-viewer"); if (previewRequest.current === request) setPreviewId(id); }
    catch { if (previewRequest.current === request) setPreviewError("Die 3D-Ansicht konnte nicht geladen werden. Die Datei kannst du weiterhin separat zur Prüfung öffnen."); }
    finally { if (previewRequest.current === request) setPreviewBusy(false); }
  }

  const loaded = list?.orders || [], unsaved = Object.entries(drafts).filter(([, item]) => dirty(item));
  return <>
    <nav className="ab3d-ops-nav" aria-label="Betreiberbereich">
      <Link href="/konto" onClick={guardNavigation}>← Mein Konto</Link>
      <Link href="/cappatex/betrieb" onClick={guardNavigation}>CAPPATEX Bestellungen</Link>
    </nav>
    {draftStorageError && <div className="ab3d-ops-error" role="alert"><p>{draftStorageError}</p><button type="button" className="ab3d-ops-secondary" onClick={() => setDraftStorageRevision(current => current + 1)}>Sitzungsspeicher erneut prüfen</button><button type="button" className="ab3d-ops-secondary" disabled={Boolean(saving)} onClick={() => {
      try { if (storageKey.current) sessionStorage.removeItem(storageKey.current); setDraftStorageRevision(current => current + 1); }
      catch { setDraftStorageError("Der Sitzungsspeicher ist weiterhin blockiert. Deine Eingabe in dieser Ansicht bleibt erhalten."); }
    }}>Zwischenspeicher verwerfen und neu aufbauen</button></div>}
    {!draftStorageReady && !draftStorageError && <p role="status">Prüfnotizen aus diesem Tab werden geprüft …</p>}
    {notice && <p className="ab3d-ops-message" role="status">{notice}</p>}
    {unsaved.length > 0 && <aside className="ab3d-ops-drafts" aria-label="Ungespeicherte Prüfungen">
      <span><strong>{unsaved.length} {unsaved.length === 1 ? "Prüfung mit ungespeicherten Änderungen" : "Prüfungen mit ungespeicherten Änderungen"}</strong> · {draftStorageReady ? "nur in diesem Tab zwischengespeichert; noch nicht auf dem Server gespeichert" : "lokale Sicherung nicht bestätigt"}</span>
      <div>{unsaved.map(([id]) => <button type="button" key={id} onClick={() => selectOrder(id)} disabled={Boolean(saving)}>{id} öffnen</button>)}</div>
      <button type="button" onClick={() => {
        changeDrafts(current => Object.fromEntries(Object.entries(current).filter(([id]) => Boolean(details[id])).map(([id]) => [id, draftFromReview(details[id].order.review)])));
        setConflicts({}); setNotice("Alle lokalen Prüfnotizen verworfen. Du kannst die Seite jetzt verlassen.");
      }} disabled={Boolean(saving)}>Alle lokalen Änderungen verwerfen</button>
    </aside>}
    <section className="ab3d-ops-summary" aria-label="Geladene Anfragen nach Prüfstatus">
      <div><strong>{loaded.length}</strong><span>Geladene Anfragen</span></div>
      {AB3D_REVIEW_STATES.filter(state => state !== "closed").map(state => <div key={state}><strong>{loaded.filter(order => order.review.state === state).length}</strong><span>{AB3D_REVIEW_LABELS[state]}</span></div>)}
    </section>
    <form className="ab3d-ops-filters" onSubmit={event => { event.preventDefault(); setAppliedFilters({ ...filters, q: filters.q.trim() }); refreshList(); }}>
      <label className="ab3d-ops-search">Anfrage suchen<input type="search" value={filters.q} maxLength={100} placeholder="Referenz, E-Mail oder Modell" onChange={event => setFilters({ ...filters, q: event.target.value })} /></label>
      <label>Prüfung<select value={filters.review} onChange={event => setFilters({ ...filters, review: event.target.value })}><option value="all">Alle Prüfungen</option>{AB3D_REVIEW_STATES.map(state => <option key={state} value={state}>{AB3D_REVIEW_LABELS[state]}</option>)}</select></label>
      <label>Auftragsstatus<select value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="all">Alle Auftragsstatus</option>{Object.entries(AB3D_ORDER_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
      <button type="submit" disabled={listBusy}>Filtern</button><button type="button" className="ab3d-ops-secondary" onClick={refreshList} disabled={listBusy}>Aktualisieren</button>
    </form>
    {listError && <p className="ab3d-ops-error" role="alert">{listError} Bereits geladene Daten bleiben sichtbar.</p>}
    <div className="ab3d-ops-workbench">
      <section className="ab3d-ops-list" aria-label="Anfrageliste" aria-busy={listBusy}>
        <header><h2>Anfragen</h2><span>{loaded.length} geladen{list?.nextCursor ? " · weitere verfügbar" : ""}</span></header>
        {listBusy && !list && <p role="status">Anfragen werden geladen …</p>}
        {list && !loaded.length && <p className="ab3d-ops-empty">{appliedFilters.q || appliedFilters.review !== "all" || appliedFilters.status !== "all" ? "Keine Anfrage passt zu diesen Filtern. Passe die Suche an." : "Noch keine 3D-Anfragen eingegangen. Neue Anfragen erscheinen hier mit den gespeicherten Kundendaten."}</p>}
        <ul>{loaded.map(order => <li key={order.id}><button type="button" className={selectedId === order.id ? "selected" : ""} aria-pressed={selectedId === order.id} disabled={Boolean(saving)} onClick={() => selectOrder(order.id)}>
          <span className="ab3d-ops-row-top"><strong>{order.id}</strong><span className={`ab3d-ops-badge is-${order.review.state}`}>{AB3D_REVIEW_LABELS[order.review.state]}</span></span>
          <b>{order.templateName}</b><span>{order.email}</span><small>{order.quantity} Stück · {order.heightMm} mm · {date(order.createdAt)}</small>
          {drafts[order.id] && dirty(drafts[order.id]) && <em>Ungespeicherte Änderungen</em>}
        </button></li>)}</ul>
        {list?.nextCursor && <button type="button" className="ab3d-ops-load-more" onClick={loadMore} disabled={listBusy}>{listBusy ? "Wird geladen …" : "Weitere Anfragen laden"}</button>}
      </section>
      <section className="ab3d-ops-detail" aria-label="Anfragedetails" aria-busy={detailBusy}>
        {!selectedId && <p className="ab3d-ops-empty">Wähle eine Anfrage aus, um Modell, Kundendaten und Prüfnotizen anzusehen.</p>}
        {selectedId && <>
          <header className="ab3d-ops-detail-heading"><div><p className="eyebrow">Anfragedetails</p><h2 tabIndex={-1} ref={detailHeading}>{selectedId}</h2></div><button type="button" className="ab3d-ops-secondary" onClick={refreshDetail} disabled={detailBusy || Boolean(saving)}>Details neu laden</button></header>
          {detailBusy && <p role="status">Details werden geladen … Deine Eingaben bleiben erhalten.</p>}
          {detailError && <p className="ab3d-ops-error" role="alert">{detailError}</p>}
          {detail && draft && <>
            <div className="ab3d-ops-order-state"><strong>{AB3D_ORDER_STATUS_LABELS[detail.order.status] || detail.order.status}</strong><span>Gespeicherter Auftragsstatus · diese Ansicht bestätigt keine neue Zahlung.</span></div>
            <section className="ab3d-ops-detail-section"><h3>Kunde & Anfrage</h3><dl className="ab3d-ops-data">
              <div><dt>E-Mail</dt><dd><a href={`mailto:${encodeURIComponent(detail.order.email)}`}>{detail.order.email}</a></dd></div>
              <div><dt>Name</dt><dd>{detail.order.requestDetails?.name || "Nicht hinterlegt"}</dd></div>
              <div><dt>Telefon</dt><dd>{detail.order.requestDetails?.phone || "Nicht hinterlegt"}</dd></div>
              <div><dt>Ort / Land</dt><dd>{[detail.order.requestDetails?.postalCode, detail.order.requestDetails?.city, detail.order.requestDetails?.country].filter(Boolean).join(" ") || "Nicht hinterlegt"}</dd></div>
              <div><dt>Eingegangen</dt><dd>{date(detail.order.createdAt)}</dd></div>
              <div><dt>Richtpreis</dt><dd>{money(detail.order.estimatedTotalCents, detail.order.currency)}<small>Gespeicherte Schätzung · kein Zahlungsnachweis</small></dd></div>
            </dl>{detail.order.requestDetails?.customerNote && <div className="ab3d-ops-customer-note"><strong>Kundenwunsch</strong><p>{detail.order.requestDetails.customerNote}</p></div>}
              {!detail.order.requestDetails && <p className="ab3d-ops-note">Bei dieser Anfrage wurden noch keine zusätzlichen Kontaktdaten gespeichert.</p>}
            </section>
            <section className="ab3d-ops-detail-section"><h3>Modell & Druckwunsch</h3><dl className="ab3d-ops-data">
              <div><dt>Modellvorlage</dt><dd>{detail.order.templateName}</dd></div><div><dt>Gewünschte Höhe</dt><dd>{detail.order.heightMm} mm</dd></div>
              <div><dt>Material / Finish</dt><dd>{detail.order.material} · {detail.order.finish}</dd></div><div><dt>Menge</dt><dd>{detail.order.quantity} Stück</dd></div>
              <div className="ab3d-ops-data-wide"><dt>Dateistatus</dt><dd>{taskLabel(detail.order.sourceTaskStatus)}<small>Aufgabe: {detail.order.sourceTaskId}</small></dd></div>
            </dl>
              <p className="ab3d-ops-note">{detail.inspectionNotice}</p>
              <div className="ab3d-ops-file-actions">
                {inspectionLink(detail, "glb") && <button type="button" onClick={openPreview} disabled={previewBusy || previewId === selectedId}>{previewBusy ? "3D-Ansicht wird vorbereitet …" : previewId === selectedId ? "3D-Ansicht geöffnet" : "3D-Modell zur Prüfung ansehen"}</button>}
                {([ ["glb", "GLB"], ["stl", "STL"], ["threeMf", "3MF"] ] as const).map(([format, label]) => inspectionLink(detail, format) && <a key={format} href={inspectionLink(detail, format)!} target="_blank" rel="noopener noreferrer">{label} öffnen ↗<span className="ab3d-ops-file-tab"> (neuer Tab)</span></a>)}
                {!Object.values(detail.files).some(Boolean) && <p>Für diese Anfrage ist keine geprüfte Quelldatei abrufbar.</p>}
              </div>
              {previewError && <p className="ab3d-ops-error" role="alert">{previewError}</p>}
              {previewId === selectedId && inspectionLink(detail, "glb") && <><div className="ab3d-ops-preview"><ModelViewer src={inspectionLink(detail, "glb")!} autoRotate={autoRotate} setAutoRotate={setAutoRotate} /></div><button type="button" className="ab3d-ops-secondary ab3d-ops-close-preview" onClick={() => { setPreviewId(""); setAutoRotate(false); }}>3D-Ansicht schliessen / erneut laden</button></>}
            </section>
            <section className="ab3d-ops-checklist"><h3>Vor einer Fertigung prüfen</h3><ul><li>Geometrie, Wandstärke, Masse und Material im Slicer persönlich prüfen.</li><li>Endpreis und Zahlung separat bestätigen; der Richtpreis reicht dafür nicht aus.</li><li>Vollständige Lieferadresse und Versand mit dem Kunden klären. Die Ortsangabe ist keine Lieferadresse.</li></ul><p>Der Prüfstatus unten dokumentiert deine interne Arbeit. Er gibt keine Zahlung, Produktion oder Lieferung frei.</p></section>
            <form className="ab3d-ops-review" onSubmit={event => { event.preventDefault(); saveReview(); }}>
              <header><h3>Interne Prüfung</h3><span>Version {draft.version} · {date(detail.order.review.updatedAt)}</span></header>
              <label htmlFor="ab3d-review-state">Prüfstatus<select id="ab3d-review-state" value={draft.state} disabled={saving === selectedId || !draftStorageReady} onChange={event => updateDraft({ state: event.target.value as Ab3dReviewState })}>{AB3D_REVIEW_STATES.map(state => <option key={state} value={state}>{AB3D_REVIEW_LABELS[state]}</option>)}</select></label>
              <label htmlFor="ab3d-review-notes">Prüfnotizen<textarea id="ab3d-review-notes" rows={6} maxLength={3000} value={draft.notes} disabled={saving === selectedId || !draftStorageReady} onChange={event => updateDraft({ notes: event.target.value })} placeholder="Zum Beispiel: Wandstärke prüfen, Rückfrage zur Grösse, vereinbarter nächster Schritt." aria-describedby="ab3d-review-notes-help" /></label>
              <p id="ab3d-review-notes-help" className="ab3d-ops-note">Nur für den Betreiber sichtbar · {draft.notes.length} / 3000 Zeichen</p>
              {(conflicts[selectedId] || detail.order.review.version !== draft.version) && <div className="ab3d-ops-conflict" role="alert"><strong>Ein anderer Stand wurde gespeichert.</strong><p>Deine Eingabe bleibt oben erhalten. Kopiere wichtige Ergänzungen, bevor du den gespeicherten Stand übernimmst.</p><details><summary>Zuletzt geladenen Prüfstand vergleichen</summary><p>{AB3D_REVIEW_LABELS[detail.order.review.state]} · Version {detail.order.review.version}</p><p className="ab3d-ops-saved-notes">{detail.order.review.notes || "Keine Notiz gespeichert."}</p></details><button type="button" onClick={() => discardDraft(selectedId)} disabled={detailBusy || Boolean(saving)}>Meine Eingabe verwerfen und Stand übernehmen</button></div>}
              <div className="ab3d-ops-review-actions"><button type="submit" disabled={Boolean(saving) || !dirty(draft) || Boolean(conflicts[selectedId]) || detail.order.review.version !== draft.version}>{saving === selectedId ? "Wird gespeichert …" : "Prüfung speichern"}</button><button type="button" className="ab3d-ops-secondary" onClick={() => discardDraft(selectedId)} disabled={Boolean(saving) || !dirty(draft)}>Änderungen verwerfen</button></div>
              {detail.order.review.updatedBy && <p className="ab3d-ops-note">Zuletzt gespeichert von {detail.order.review.updatedBy}.</p>}
            </form>
            <details className="ab3d-ops-history"><summary>Prüfverlauf ({detail.order.events.length})</summary>{detail.order.events.length ? <ol>{detail.order.events.map(event => <li key={event.version}><strong>{AB3D_REVIEW_LABELS[event.state]}</strong><span>Version {event.version} · {date(event.createdAt)} · {event.actorEmail}</span></li>)}</ol> : <p>Noch keine interne Prüfung gespeichert.</p>}</details>
          </>}
          <OfferPanel orderId={selectedId} ownerEmail={ownerEmail} />
        </>}
      </section>
    </div>
  </>;
}
