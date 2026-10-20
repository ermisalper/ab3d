"use client";
import { GALLERY_CATEGORIES, type GalleryDraft, type GalleryStudio } from "./gallery-policy";

export default function GalleryConsent({studio,value,onChange,disabled=false,compact=false}:{studio:GalleryStudio;value:GalleryDraft;onChange:(v:GalleryDraft)=>void;disabled?:boolean;compact?:boolean}) {
  const patch=(p:Partial<GalleryDraft>)=>onChange({...value,...p});
  const compactCappatex=compact&&studio==="cappatex";
  const collectionFields=<div className="gallery-consent-fields"><label>Kategorie<select value={value.category} onChange={e=>patch({category:e.target.value})}>
      {Object.entries(GALLERY_CATEGORIES[studio]).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>Titel <small>optional</small><input value={value.title} maxLength={80} placeholder={studio==="ab3d"?"Zum Beispiel: Meine Bergvase":"Zum Beispiel: Alpine Blume"} onChange={e=>patch({title:e.target.value})}/></label></div>;
  return <fieldset className={`gallery-consent${compactCappatex?" gallery-consent--compact":""}`} disabled={disabled}>
    <legend>{compactCappatex?"In deiner Sammlung":"Dein Ergebnis. Deine Entscheidung."}</legend>
    <p>{compactCappatex?"Dein Motiv wird gespeichert. Wähle, wer es sehen darf.":"Wir speichern dein Ergebnis in deiner privaten Sammlung. Darf es zusätzlich in unserer Galerie erscheinen?"}</p>
    <div className="gallery-consent-options">
      <label><input type="radio" name={`gallery-${studio}`} checked={value.visibility==="private"} onChange={()=>patch({visibility:"private",rightsConfirmed:false})}/><span><b>{compactCappatex?"Privat":"Nur für mich"}</b><small>{compactCappatex?"Nur für dich sichtbar.":"In meiner privaten Sammlung speichern."}</small></span></label>
      <label><input type="radio" name={`gallery-${studio}`} checked={value.visibility==="public"} onChange={()=>patch({visibility:"public",rightsConfirmed:false})}/><span><b>{compactCappatex?"Galerie vorschlagen":"In der Galerie zeigen"}</b><small>{compactCappatex?"Erst nach Prüfung sichtbar.":"Nach Prüfung für andere sichtbar."}</small></span></label>
    </div>
    {compactCappatex?<details className="gallery-consent-collection" open={value.visibility==="public"}>
      <summary>{value.visibility==="public"?"Galerieangaben":"Ordnen & benennen (optional)"}</summary>
      {collectionFields}
    </details>:collectionFields}
    {value.visibility==="public"&&<div className="gallery-consent-disclosure">
      <p>{studio==="ab3d"?"Die Galerie zeigt dein Modell samt Vorschau. Die angezeigte GLB-Datei ist dabei öffentlich abrufbar.":"Die Galerie zeigt eine verkleinerte Motivvorschau. Deine Original-Druckdatei bleibt geschützt."} Titel und Kategorie werden sichtbar; dein Name, deine E-Mail, Prompts und hochgeladene Referenzbilder werden nicht gezeigt.</p>
      <label><input type="checkbox" checked={value.rightsConfirmed} onChange={e=>patch({rightsConfirmed:e.target.checked})}/><span>Ich darf dieses Ergebnis öffentlich zeigen und möchte es zur Galerieprüfung einreichen.</span></label>
      <p>Du kannst die Veröffentlichung unter „{studio==="cappatex"?"Meine Motive":"Meine 3D-Modelle"}“ zurückziehen. Bereits gespeicherte Kopien anderer Besucher können wir nicht zurückrufen.</p>
    </div>}
    {!value.visibility&&<p className="gallery-choice-note">{compactCappatex?"Bitte vor der Erstellung auswählen. Der Preis bleibt gleich.":"Bitte triff deine Auswahl vor der Erstellung. Privat und öffentlich haben denselben Erstellungspreis."}</p>}
  </fieldset>;
}
