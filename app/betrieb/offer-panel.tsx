"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COST_LABELS, OFFER_COST_KEYS, formatOfferMoneyInput, parseOfferMoney, parseProductionOffer, type ProductionOfferPayload } from "../production-offer";

type CostKey = typeof OFFER_COST_KEYS[number];
type CostForm = { state: "open" | "included" | "excluded"; oneOff: string; perUnit: string };
type Form = {
  fulfillment: ProductionOfferPayload["fulfillment"]; supplierReference: string; material: string; color: string;
  width: string; depth: string; height: string; quantity: string; printMinutes: string; plannedSale: string; notes: string;
  costs: Record<CostKey, CostForm>;
};
type Calculation = {
  knownOneOffCents: number | null; knownPerUnitCents: number | null; knownTotalCents: number | null;
  totalCostCents: number | null; revenueCents: number | null; marginCents: number | null;
  marginBasisPoints: number | null; openCostItems: string[]; costsComplete: boolean;
};
type Offer = {
  orderId: string; version: number; payload: ProductionOfferPayload; calculation: Calculation;
  updatedAt: number | null; updatedBy: string | null; sheet: { label: string; value: string }[];
  events: { version?: number; createdAt?: number; updatedAt?: number; actor?: string }[];
};
type Draft = { version: number; form: Form; saved: Form };
const money = (value: number | null) => {
  if (value === null) return "Offen";
  if (!Number.isSafeInteger(value)) return "Berechnung nicht bestätigt";
  const absolute = Math.abs(value);
  return `CHF ${value < 0 ? "−" : ""}${new Intl.NumberFormat("de-CH").format(Math.trunc(absolute / 100))}.${String(absolute % 100).padStart(2, "0")}`;
};
const changed = (draft: Draft | undefined) => Boolean(draft && JSON.stringify(draft.form) !== JSON.stringify(draft.saved));
const text = (value: string | null) => value || "";

function toForm(payload: ProductionOfferPayload): Form {
  return {
    fulfillment: payload.fulfillment, supplierReference: text(payload.supplierReference), material: text(payload.material), color: text(payload.color),
    width: text(payload.dimensionsMm.width), depth: text(payload.dimensionsMm.depth), height: text(payload.dimensionsMm.height),
    quantity: payload.quantity === null ? "" : String(payload.quantity), printMinutes: payload.printMinutesPerUnit === null ? "" : String(payload.printMinutesPerUnit),
    plannedSale: payload.plannedSaleTotalCents === null ? "" : formatOfferMoneyInput(payload.plannedSaleTotalCents), notes: text(payload.notes),
    costs: Object.fromEntries(OFFER_COST_KEYS.map(key => [key, {
      state: payload.costs[key].state, oneOff: payload.costs[key].oneOffCents === null ? "" : formatOfferMoneyInput(payload.costs[key].oneOffCents),
      perUnit: payload.costs[key].perUnitCents === null ? "" : formatOfferMoneyInput(payload.costs[key].perUnitCents),
    }])) as Form["costs"],
  };
}

function optional(value: string) { return value.trim() || null; }
function whole(value: string, label: string, minimum: number, maximum: number) {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum || Number(value) > maximum) throw new Error(`${label}: Bitte eine ganze Zahl zwischen ${minimum} und ${maximum} eingeben.`);
  return Number(value);
}
function dimension(value: string) {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized) || Number(normalized) <= 0 || Number(normalized) > 10_000) throw new Error("Abmessungen: Bitte positive Millimeterwerte bis 10000 mit höchstens drei Nachkommastellen eingeben.");
  const [integer, decimal = ""] = normalized.split(".");
  const fraction = decimal.replace(/0+$/, "");
  return `${integer.replace(/^0+(?=\d)/, "")}${fraction ? `.${fraction}` : ""}`;
}
function toPayload(form: Form): ProductionOfferPayload {
  const cents = (value: string, label: string) => { try { return parseOfferMoney(value); } catch { throw new Error(`${label}: Bitte einen CHF-Betrag mit höchstens zwei Nachkommastellen eingeben. Leer bedeutet offen.`); } };
  const payload: ProductionOfferPayload = {
    schemaVersion: 1, fulfillment: form.fulfillment, supplierReference: optional(form.supplierReference), material: optional(form.material), color: optional(form.color),
    dimensionsMm: { width: dimension(form.width), depth: dimension(form.depth), height: dimension(form.height) },
    quantity: whole(form.quantity, "Menge", 1, 1000), printMinutesPerUnit: whole(form.printMinutes, "Druckzeit", 0, 1_000_000),
    plannedSaleTotalCents: cents(form.plannedSale, "Geplanter Verkaufspreis"), notes: optional(form.notes),
    costs: Object.fromEntries(OFFER_COST_KEYS.map(key => [key, {
      state: form.costs[key].state,
      oneOffCents: form.costs[key].state === "included" ? cents(form.costs[key].oneOff, `${COST_LABELS[key]}, einmalig`) : null,
      perUnitCents: form.costs[key].state === "included" ? cents(form.costs[key].perUnit, `${COST_LABELS[key]}, pro Stück`) : null,
    }])) as ProductionOfferPayload["costs"],
  };
  try { return parseProductionOffer(payload); } catch { throw new Error("Bitte Spezifikation und Notizen prüfen. Die Eingaben bleiben erhalten."); }
}

function validForm(value: unknown): value is Form {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const form = value as Record<string, unknown>;
  if (!["open", "own", "external"].includes(String(form.fulfillment))) return false;
  for (const key of ["supplierReference", "material", "color", "width", "depth", "height", "quantity", "printMinutes", "plannedSale", "notes"]) {
    if (typeof form[key] !== "string" || String(form[key]).length > (key === "notes" ? 2000 : 300)) return false;
  }
  if (!form.costs || typeof form.costs !== "object" || Array.isArray(form.costs)) return false;
  return OFFER_COST_KEYS.every(key => {
    const item = (form.costs as Record<string, unknown>)[key] as Record<string, unknown> | undefined;
    return item && ["open", "included", "excluded"].includes(String(item.state)) && typeof item.oneOff === "string" && item.oneOff.length <= 30 && typeof item.perUnit === "string" && item.perUnit.length <= 30;
  });
}
function readDraft(raw: string | null): Draft | null {
  if (raw === null) return null;
  if (raw.length > 40_000) throw new Error("storage");
  const parsed = JSON.parse(raw);
  if (!parsed || !Number.isSafeInteger(parsed.version) || parsed.version < 0 || !validForm(parsed.form) || !validForm(parsed.saved)) throw new Error("storage");
  return parsed;
}
function readOffer(body: unknown, id: string): Offer {
  const offer = body as Offer | null;
  if (!offer || offer.orderId !== id || !Number.isSafeInteger(offer.version) || offer.version < 0 || !offer.payload || !offer.calculation || !Array.isArray(offer.sheet) || !Array.isArray(offer.events)) throw new Error("Die Angebotsdaten sind unvollständig. Bitte erneut laden.");
  parseProductionOffer(offer.payload);
  const calculation = offer.calculation;
  if (!validForm(toForm(offer.payload)) || typeof calculation.costsComplete !== "boolean"
    || !Array.isArray(calculation.openCostItems) || !calculation.openCostItems.every(item => typeof item === "string" && item.length <= 300)
    || !["knownOneOffCents", "knownPerUnitCents", "knownTotalCents", "totalCostCents", "revenueCents", "marginCents", "marginBasisPoints"].every(key => calculation[key as keyof Calculation] === null || Number.isSafeInteger(calculation[key as keyof Calculation]))
    || !offer.sheet.every(row => row && typeof row.label === "string" && typeof row.value === "string")) throw new Error("Die Angebotsdaten sind unvollständig. Bitte erneut laden.");
  return offer;
}

export default function OfferPanel(props: { orderId: string; ownerEmail: string }) {
  return <OwnedOfferPanel key={props.ownerEmail.trim().toLowerCase()} {...props} />;
}

function OwnedOfferPanel({ orderId, ownerEmail }: { orderId: string; ownerEmail: string }) {
  const [offers, setOffers] = useState<Record<string, Offer>>({}), [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [conflicts, setConflicts] = useState<Record<string, boolean>>({}), [revision, setRevision] = useState(0);
  const [conflictFresh, setConflictFresh] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({}), [notices, setNotices] = useState<Record<string, string>>({});
  const [storageErrors, setStorageErrors] = useState<Record<string, string>>({});
  const draftRef = useRef<Record<string, Draft>>({}), offerRef = useRef<Record<string, Offer>>({});
  const savingRef = useRef(""), storageKeys = useRef<Record<string, string>>({}), storageWritable = useRef<Record<string, boolean>>({});
  const conflictEpoch = useRef<Record<string, number>>({}), conflictReadRequired = useRef<Record<string, boolean>>({});
  const conflictMinimumVersion = useRef<Record<string, number>>({});
  const selected = useRef(orderId);
  const draft = drafts[orderId], offer = offers[orderId], isDirty = changed(draft), hasDrafts = Object.values(drafts).some(changed);
  const conflict = conflicts[orderId] || Boolean(draft && offer && draft.version !== offer.version && isDirty);
  const needsFreshConflict = Boolean(conflicts[orderId] && !conflictFresh[orderId]);

  const persist = useCallback((id: string, next: Draft) => {
    draftRef.current = { ...draftRef.current, [id]: next }; setDrafts(draftRef.current);
    if (!storageKeys.current[id] || !storageWritable.current[id]) return;
    try {
      if (changed(next)) sessionStorage.setItem(storageKeys.current[id], JSON.stringify(next)); else sessionStorage.removeItem(storageKeys.current[id]);
    } catch {
      storageWritable.current[id] = false;
      setStorageErrors(current => ({ ...current, [id]: "Die Zwischensicherung ist blockiert. Deine Eingabe bleibt hier erhalten und kann auf dem Server gespeichert werden. Speichere vor dem Verlassen dieser Seite." }));
    }
  }, []);

  useEffect(() => {
    selected.current = orderId;
    if (!orderId) return;
    const controller = new AbortController();
    const readEpoch = conflictEpoch.current[orderId] ?? 0;
    let recovery: Draft | null = null;
    const stillActive = () => !controller.signal.aborted;
    async function load() {
      setBusy(true); setErrors(current => ({ ...current, [orderId]: "" }));
      try {
        if (!storageKeys.current[orderId]) {
          try {
            const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ownerEmail.trim().toLowerCase()}\n${orderId}`));
            if (!stillActive()) return;
            const key = `ab3d-offer-draft-v1:${Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("")}`;
            storageKeys.current[orderId] = key;
            recovery = readDraft(sessionStorage.getItem(key));
            storageWritable.current[orderId] = true;
            if (recovery && !changed(draftRef.current[orderId])) {
              persist(orderId, recovery);
              setNotices(current => ({ ...current, [orderId]: "Ungespeicherten Angebotsentwurf aus diesem Tab wiederhergestellt. Bitte mit dem Serverstand vergleichen." }));
            }
          } catch {
            storageWritable.current[orderId] = false;
            if (stillActive()) setStorageErrors(current => ({ ...current, [orderId]: "Der Sitzungsspeicher ist blockiert oder der Entwurf beschädigt. Deine Eingabe bleibt in dieser Ansicht erhalten und ist weiterhin speicherbar. Vor dem Verlassen auf dem Server speichern." }));
          }
        }
        const response = await fetch(`/api/ab3d/operations/${encodeURIComponent(orderId)}/offer`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Der Angebotsentwurf konnte nicht geladen werden. Bitte erneut versuchen.");
        const incoming = readOffer(body, orderId);
        if (!stillActive()) return;
        if ((offerRef.current[orderId]?.version ?? -1) > incoming.version) return;
        offerRef.current = { ...offerRef.current, [orderId]: incoming }; setOffers(offerRef.current);
        if (readEpoch > 0 && readEpoch === conflictEpoch.current[orderId]
          && incoming.version >= (conflictMinimumVersion.current[orderId] ?? Number.POSITIVE_INFINITY)) {
          conflictReadRequired.current[orderId] = false;
          setConflictFresh(current => ({ ...current, [orderId]: true }));
        }
        const existing = draftRef.current[orderId];
        const retained = existing && changed(existing) ? existing : recovery && changed(recovery) ? recovery : null;
        const saved = toForm(incoming.payload);
        if (retained && JSON.stringify(retained.form) !== JSON.stringify(saved)) {
          persist(orderId, retained);
          if (recovery && !existing) setNotices(current => ({ ...current, [orderId]: "Ungespeicherten Angebotsentwurf aus diesem Tab wiederhergestellt. Bitte mit dem Serverstand vergleichen." }));
        } else if (savingRef.current !== orderId) persist(orderId, { version: incoming.version, form: saved, saved });
      } catch {
        if (stillActive()) setErrors(current => ({ ...current, [orderId]: "Der Angebotsentwurf konnte nicht geladen werden. Vorhandene Eingaben bleiben erhalten. Bitte erneut laden." }));
      } finally { if (stillActive()) setBusy(false); }
    }
    void load();
    return () => controller.abort();
  }, [orderId, ownerEmail, revision, persist]);

  useEffect(() => {
    if (!hasDrafts) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target || target.getAttribute("target") === "_blank") return;
      const url = new URL(target.getAttribute("href") || "", window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault(); event.stopPropagation();
      setNotices(current => ({ ...current, [selected.current]: "Es gibt ungespeicherte Angebotsentwürfe. Speichere sie oder verwirf sie ausdrücklich, bevor du die Seite verlässt." }));
    };
    window.addEventListener("beforeunload", beforeUnload); document.addEventListener("click", navigation, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", navigation, true); };
  }, [hasDrafts]);

  function update(change: Partial<Form>) {
    const current = draftRef.current[orderId]; if (!current || savingRef.current) return;
    persist(orderId, { ...current, form: { ...current.form, ...change } });
    setErrors(current => ({ ...current, [orderId]: "" })); setNotices(current => ({ ...current, [orderId]: "" }));
  }
  function discard() {
    const current = offerRef.current[orderId]; if (!current || savingRef.current || conflictReadRequired.current[orderId]) return;
    const saved = toForm(current.payload); persist(orderId, { version: current.version, form: saved, saved });
    setConflicts(current => ({ ...current, [orderId]: false })); setErrors(current => ({ ...current, [orderId]: "" }));
    setNotices(current => ({ ...current, [orderId]: "Lokale Änderungen verworfen. Der zuletzt geladene Serverstand wurde übernommen." }));
  }
  async function save() {
    const id = orderId, current = draftRef.current[id];
    if (!current || !changed(current) || savingRef.current || conflict) return;
    let payload: ProductionOfferPayload;
    try { payload = toPayload(current.form); } catch (error) {
      setErrors(current => ({ ...current, [id]: error instanceof Error ? error.message : "Bitte die Eingaben prüfen." })); return;
    }
    savingRef.current = id; setSaving(id); setErrors(current => ({ ...current, [id]: "" })); setNotices(current => ({ ...current, [id]: "" }));
    try {
      const response = await fetch(`/api/ab3d/operations/${encodeURIComponent(id)}/offer`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: current.version, payload }), signal: AbortSignal.timeout(30_000),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 409) {
        conflictEpoch.current[id] = (conflictEpoch.current[id] ?? 0) + 1;
        conflictReadRequired.current[id] = true;
        conflictMinimumVersion.current[id] = current.version + 1;
        setConflictFresh(current => ({ ...current, [id]: false }));
        setConflicts(current => ({ ...current, [id]: true }));
        if (selected.current === id) setRevision(value => value + 1);
        throw new Error("Der Serverstand wurde zwischenzeitlich geändert. Deine Eingabe bleibt erhalten. Vergleiche beide Stände, bevor du erneut speicherst.");
      }
      if (!response.ok) throw new Error("Speichern konnte nicht bestätigt werden. Deine Eingaben bleiben erhalten. Bitte Eingaben prüfen oder den Serverstand neu laden.");
      const incoming = readOffer(body, id);
      if (incoming.version !== current.version + 1 || JSON.stringify(toForm(incoming.payload)) !== JSON.stringify(toForm(payload))) throw new Error("Die Speicherbestätigung passt nicht zu diesem Entwurf. Deine Eingaben bleiben erhalten. Bitte den Serverstand neu laden und vergleichen.");
      offerRef.current = { ...offerRef.current, [id]: incoming }; setOffers(offerRef.current);
      const saved = toForm(incoming.payload); persist(id, { version: incoming.version, form: saved, saved });
      setConflicts(current => ({ ...current, [id]: false }));
      setNotices(current => ({ ...current, [id]: "Interner Entwurf gespeichert. Kein Kundenangebot versandt, keine Zahlung und keine Produktion freigegeben." }));
    } catch (error) { setErrors(current => ({ ...current, [id]: error instanceof Error && !(error instanceof TypeError) && error.name !== "TimeoutError"
      ? error.message : "Speichern konnte nicht bestätigt werden. Deine Eingabe bleibt erhalten. Bitte den Serverstand neu laden und vergleichen." })); }
    finally { savingRef.current = ""; setSaving(""); }
  }

  if (!orderId) return null;
  const form = draft?.form, locked = Boolean(saving), calculation = offer?.calculation;
  return <details className="ab3d-offer-panel" open={isDirty || conflict || undefined}>
    <summary><span>Interner Angebotsentwurf</span><small>{isDirty ? "Ungespeicherte Änderungen" : offer?.version ? `Version ${offer.version}` : "Noch kein Entwurf gespeichert"}</small></summary>
    <div className="ab3d-offer-content">
      <p className="ab3d-ops-note">Nur interne Vorbereitung: Anfrage, Zahlung und Produktionsfreigabe bleiben getrennt. Keine automatische Bestellung oder Nachricht.</p>
      {Object.entries(drafts).some(([id, item]) => id !== orderId && changed(item)) && <p className="ab3d-ops-note">Weitere ungespeicherte Angebotsentwürfe: {Object.entries(drafts).filter(([id, item]) => id !== orderId && changed(item)).map(([id]) => id).join(", ")}. Wähle die jeweilige Anfrage in der Liste, um sie zu speichern oder zu verwerfen.</p>}
      {busy && <p role="status">Angebotsstand wird geladen …</p>}
      {storageErrors[orderId] && <div className="ab3d-ops-error" role="alert"><p>{storageErrors[orderId]}</p><button type="button" className="ab3d-ops-secondary" disabled={locked} onClick={() => {
        try {
          const key = storageKeys.current[orderId]; if (!key) throw new Error("storage");
          sessionStorage.removeItem(key); storageWritable.current[orderId] = true;
          if (draftRef.current[orderId]) persist(orderId, draftRef.current[orderId]);
          setStorageErrors(current => ({ ...current, [orderId]: "" }));
        } catch { setStorageErrors(current => ({ ...current, [orderId]: "Der Sitzungsspeicher ist weiterhin blockiert. Deine Eingabe bleibt hier erhalten und kann auf dem Server gespeichert werden." })); }
      }}>Beschädigte Zwischensicherung verwerfen und neu sichern</button></div>}
      {errors[orderId] && <p className="ab3d-ops-error" role="alert">{errors[orderId]}</p>}
      {notices[orderId] && <p className="ab3d-ops-message" role="status">{notices[orderId]}</p>}
      <button type="button" className="ab3d-ops-secondary" disabled={busy || locked} onClick={() => setRevision(value => value + 1)}>Serverstand neu laden</button>
      {form && <>
        <fieldset disabled={locked} className="ab3d-offer-fields">
          <legend>Fertigung und Spezifikation</legend>
          <div className="ab3d-offer-grid">
            <label>Fertigungsweg<select value={form.fulfillment} onChange={event => update({ fulfillment: event.target.value as Form["fulfillment"] })}><option value="open">Noch offen</option><option value="own">Eigene Fertigung</option><option value="external">Externer Fertigungsdienstleister</option></select></label>
            <label>Interne Lieferantenreferenz<input value={form.supplierReference} maxLength={120} placeholder="Noch offen" onChange={event => update({ supplierReference: event.target.value })} /></label>
            <label>Material<input value={form.material} maxLength={80} placeholder="Noch offen" onChange={event => update({ material: event.target.value })} /></label>
            <label>Farbe<input value={form.color} maxLength={80} placeholder="Noch offen" onChange={event => update({ color: event.target.value })} /></label>
          </div>
          {form.fulfillment === "external" && <p className="ab3d-ops-note">Die Garage mit sechs Bambu Lab H2D ist ein möglicher, pro Auftrag bezahlter Dienstleister. Preise und Verfügbarkeit sind nicht vereinbart; keine Partnerschaft oder Gewinnbeteiligung.</p>}
          <div className="ab3d-offer-dimensions">
            {([ ["width", "Breite"], ["depth", "Tiefe"], ["height", "Höhe"] ] as const).map(([key, label]) => <label key={key}>{label} (mm)<input inputMode="decimal" value={form[key]} maxLength={15} placeholder="Offen" onChange={event => update({ [key]: event.target.value })} /></label>)}
          </div>
          <div className="ab3d-offer-grid">
            <label>Menge (Stück)<input inputMode="numeric" value={form.quantity} maxLength={6} placeholder="Offen" onChange={event => update({ quantity: event.target.value })} /></label>
            <label>Druckzeit pro Stück (Minuten)<input inputMode="numeric" value={form.printMinutes} maxLength={8} placeholder="Offen" onChange={event => update({ printMinutes: event.target.value })} /></label>
          </div>
          <p className="ab3d-ops-note">Druckzeit dient der Planung. Es wird kein Stundenpreis angenommen.</p>
        </fieldset>
        <fieldset disabled={locked} className="ab3d-offer-fields">
          <legend>Kosten in CHF</legend>
          <p className="ab3d-ops-note">Leere Beträge sind offen. Bekannte Nullkosten ausdrücklich als 0 eingeben. Einmalige Kosten und Kosten pro Stück bleiben getrennt; «Nicht zutreffend» schliesst eine Position ausdrücklich aus.</p>
          <div className="ab3d-offer-costs">{OFFER_COST_KEYS.map(key => <div key={key} className="ab3d-offer-cost-row">
            <label>{COST_LABELS[key]}<select aria-label={`${COST_LABELS[key]} – Erfassung`} value={form.costs[key].state} onChange={event => update({ costs: { ...form.costs, [key]: { ...form.costs[key], state: event.target.value as CostForm["state"] } } })}><option value="open">Offen</option><option value="included">Beträge erfassen</option><option value="excluded">Nicht zutreffend</option></select></label>
            {form.costs[key].state === "included" ? <>
              <label>Einmalig<input aria-label={`${COST_LABELS[key]} einmalig in CHF`} inputMode="decimal" maxLength={20} value={form.costs[key].oneOff} placeholder="Offen" onChange={event => update({ costs: { ...form.costs, [key]: { ...form.costs[key], oneOff: event.target.value } } })} /></label>
              <label>Pro Stück<input aria-label={`${COST_LABELS[key]} pro Stück in CHF`} inputMode="decimal" maxLength={20} value={form.costs[key].perUnit} placeholder="Offen" onChange={event => update({ costs: { ...form.costs, [key]: { ...form.costs[key], perUnit: event.target.value } } })} /></label>
            </> : <p className="ab3d-offer-cost-state">{form.costs[key].state === "open" ? "Kosten noch ungeklärt" : "Aus Berechnung ausgeschlossen"}</p>}
          </div>)}</div>
          <label className="ab3d-offer-sale">Geplanter Verkaufspreis für die gesamte Menge (CHF)<input inputMode="decimal" value={form.plannedSale} maxLength={20} placeholder="Offen" onChange={event => update({ plannedSale: event.target.value })} /></label>
        </fieldset>
        <label>Interne Angebotsnotizen<textarea rows={4} value={form.notes} maxLength={2000} disabled={locked} onChange={event => update({ notes: event.target.value })} /><span className="ab3d-offer-count">{form.notes.length}/2000 Zeichen · nur intern</span></label>
        {conflict && offer && <aside className="ab3d-ops-conflict" role="alert">
          <strong>{needsFreshConflict ? "Konflikt – aktueller Serverstand noch nicht geladen" : `Abweichender Serverstand: Version ${offer.version}`}</strong>
          <p>Deine Eingabe bleibt oben erhalten. Speichern ist bis zum ausdrücklichen Abgleich gesperrt.</p>
          {needsFreshConflict && <p>Lade den Serverstand erneut. Erst nach erfolgreichem Laden kannst du vergleichen und einen Stand übernehmen.</p>}
          <details><summary>{needsFreshConflict ? `Zuletzt geladene Version ${offer.version} – Aktualität nicht bestätigt` : "Aktuellen Serverstand vergleichen"}</summary><dl className="ab3d-ops-data">{offer.sheet.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details>
          <div className="ab3d-offer-actions"><button type="button" className="ab3d-ops-secondary" disabled={locked || needsFreshConflict} onClick={discard}>Serverstand übernehmen, eigene Änderungen verwerfen</button>
            <button type="button" className="ab3d-ops-secondary" disabled={locked || busy || needsFreshConflict} onClick={() => {
              if (savingRef.current || conflictReadRequired.current[orderId]) return;
              const current = draftRef.current[orderId], incoming = offerRef.current[orderId]; if (!current || !incoming) return;
              persist(orderId, { ...current, version: incoming.version, saved: toForm(incoming.payload) });
              setConflicts(current => ({ ...current, [orderId]: false })); setErrors(current => ({ ...current, [orderId]: "" }));
              setNotices(current => ({ ...current, [orderId]: "Eigene Eingabe auf den aktuellen Serverstand vorbereitet. Prüfe die Werte und speichere anschliessend ausdrücklich." }));
            }}>Nach Vergleich meine Eingabe weiterverwenden</button></div>
        </aside>}
        <div className="ab3d-offer-actions"><button type="button" disabled={!isDirty || locked || conflict || busy} onClick={save}>{saving === orderId ? "Wird gespeichert …" : "Internen Entwurf speichern"}</button><button type="button" className="ab3d-ops-secondary" disabled={!isDirty || locked || needsFreshConflict} onClick={discard}>Lokale Änderungen verwerfen</button></div>
      </>}
      {calculation && <section className="ab3d-offer-calculation" aria-label="Gespeicherte Kostenberechnung">
        <h4>Serverberechnung · gespeicherte Version {offer.version}</h4>
        {isDirty && <p className="ab3d-ops-note">Diese Werte gehören zum zuletzt gespeicherten Stand. Deine ungespeicherten Eingaben sind noch nicht eingerechnet.</p>}
        <dl className="ab3d-ops-data"><div><dt>Bekannte einmalige Kosten</dt><dd>{money(calculation.knownOneOffCents)}</dd></div><div><dt>Bekannte Kosten pro Stück</dt><dd>{money(calculation.knownPerUnitCents)}</dd></div><div><dt>Bekannte Zwischensumme</dt><dd>{money(calculation.knownTotalCents)}</dd></div><div><dt>Vollständige Gesamtkosten</dt><dd>{money(calculation.totalCostCents)}</dd></div><div><dt>Geplanter Umsatz</dt><dd>{money(calculation.revenueCents)}</dd></div><div><dt>Marge auf geplanten Umsatz – vor Steuern und nicht erfassten Kosten</dt><dd>{money(calculation.marginCents)}{calculation.marginBasisPoints === null ? "" : ` (${new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 }).format(calculation.marginBasisPoints / 100)} %) `}</dd></div></dl>
        {calculation.openCostItems.length > 0 && <p className="ab3d-ops-note">Noch offen: {calculation.openCostItems.join(" · ")}. Eine vollständige Marge ist erst mit vollständigen Angaben möglich.</p>}
      </section>}
      {offer && <details className="ab3d-offer-sheet"><summary>Fertigungsblatt-Entwurf · gespeicherter Stand</summary><p className="ab3d-ops-note">Interner Arbeitsstand; keine Fertigungsfreigabe. Keine Weiterleitung an einen Dienstleister.</p><dl className="ab3d-ops-data">{offer.sheet.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p className="ab3d-ops-note">{offer.updatedAt ? `Zuletzt gespeichert: ${new Date(offer.updatedAt).toLocaleString("de-CH")}` : "Noch kein Angebotsentwurf gespeichert."}</p></details>}
    </div>
  </details>;
}
