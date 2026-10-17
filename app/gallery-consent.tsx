"use client";
import { GALLERY_CATEGORIES, type GalleryDraft, type GalleryStudio } from "./gallery-policy";

export default function GalleryConsent({studio,value,onChange,disabled=false}:{studio:GalleryStudio;value:GalleryDraft;onChange:(v:GalleryDraft)=>void;disabled?:boolean}) {
  const patch=(p:Partial<GalleryDraft>)=>onChange({...value,...p});
  return <fieldset className="gallery-consent" disabled={disabled}>
    <legend>Dein Ergebnis. Deine Entscheidung.</legend>
    <p>Wir speichern dein Ergebnis in deiner privaten Sammlung. Darf es zusätzlich in unserer Galerie erscheinen?</p>
    <div className="gallery-consent-options">
      <label><input type="radio" name={`gallery-${studio}`} checked={value.visibility==="private"} onChange={()=>patch({visibility:"private",rightsConfirmed:false})}/><span><b>Nur für mich</b><small>In meiner privaten Sammlung speichern.</small></span></label>
      <label><input type="radio" name={`gallery-${studio}`} checked={value.visibility==="public"} onChange={()=>patch({visibility:"public",rightsConfirmed:false})}/><span><b>In der Galerie zeigen</b><small>Nach Prüfung für andere sichtbar.</small></span></label>
    </div>
    <div className="gallery-consent-fields"><label>Kategorie<select value={value.category} onChange={e=>patch({category:e.target.value})}>
      {Object.entries(GALLERY_CATEGORIES[studio]).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>Titel <small>optional</small><input value={value.title} maxLength={80} placeholder={studio==="ab3d"?"Zum Beispiel: Meine Bergvase":"Zum Beispiel: Alpine Blume"} onChange={e=>patch({title:e.target.value})}/></label></div>
    {value.visibility==="public"&&<div className="gallery-consent-disclosure">
      <p>{studio==="ab3d"?"Die Galerie zeigt dein Modell samt Vorschau. Die angezeigte GLB-Datei ist dabei öffentlich abrufbar.":"Die Galerie zeigt eine verkleinerte Motivvorschau. Deine Original-Druckdatei bleibt geschützt."} Titel und Kategorie werden sichtbar; dein Name, deine E-Mail, Prompts und hochgeladene Referenzbilder werden nicht gezeigt.</p>
      <label><input type="checkbox" checked={value.rightsConfirmed} onChange={e=>patch({rightsConfirmed:e.target.checked})}/><span>Ich darf dieses Ergebnis öffentlich zeigen und möchte es zur Galerieprüfung einreichen.</span></label>
      <p>Du kannst die Veröffentlichung in „Meine Sammlung“ zurückziehen. Bereits gespeicherte Kopien anderer Besucher können wir nicht zurückrufen.</p>
    </div>}
    {!value.visibility&&<p className="gallery-choice-note">Bitte triff deine Auswahl vor der Erstellung. Privat und öffentlich haben denselben Erstellungspreis.</p>}
  </fieldset>;
}
