"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import ModelViewer from "./model-viewer";
import GalleryConsent from "./gallery-consent";
import { GALLERY_CATEGORIES, galleryChoiceValid, newGalleryDraft, type GalleryStudio } from "./gallery-policy";
import type { GallerySummary } from "./gallery-storage";
import { collectionPath, publicGalleryPath, galleryReviewPath, galleryWorkPath } from "./gallery-routes";

const visibilityName:Record<string,string>={private:"Privat",pending:"Wartet auf Freigabe",published:"In der Galerie",rejected:"Nicht freigegeben",withdrawn:"Zurückgezogen"};
const stateName:Record<string,string>={creating:"Ergebnis wird vorbereitet",ready:"Gespeichert",unarchived:"Datei noch nicht archiviert",archive_error:"Archivierung offen",preview_ready:"Vorschau gespeichert",failed:"Erstellung nicht abgeschlossen"};
type Detail=GallerySummary&{mine:boolean;canReview:boolean;versions:Array<{taskId:string;type:string;state:string;createdAt:number;modelUrl:string|null}>};
const categoryName=(studio:GalleryStudio,key:string)=>(GALLERY_CATEGORIES[studio] as Record<string,string>)[key]||"Weitere Werke";
async function read(response:Response){const data=await response.json();if(!response.ok)throw new Error(data.error||"Die Anfrage konnte nicht abgeschlossen werden.");return data;}

export default function CreationGallery({studio,scope="public",detailId}:{studio:GalleryStudio;scope?:"public"|"mine"|"review";detailId?:string}) {
  const [category,setCategory]=useState(""),[query,setQuery]=useState(""),[search,setSearch]=useState(""),[page,setPage]=useState(1);
  const [items,setItems]=useState<GallerySummary[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [detail,setDetail]=useState<Detail|null>(null),[refresh,setRefresh]=useState(0),[busy,setBusy]=useState(false),[canReview,setCanReview]=useState(false),[rotate,setRotate]=useState(true);
  const [choice,setChoice]=useState(newGalleryDraft);
  const requestRefresh=()=>{setLoading(true);setError("");setRefresh(v=>v+1);};
  useEffect(()=>{
    let active=true;
    const p=new URLSearchParams({scope,page:String(page)});if(studio)p.set("studio",studio);if(category)p.set("category",category);if(search)p.set("q",search);
    fetch(detailId?`/api/creations/${detailId}`:`/api/creations?${p}`,{cache:"no-store"}).then(read).then(data=>{
      if(!active)return;
      if(detailId){setDetail(data);setChoice({...newGalleryDraft(),category:data.category,title:data.title});}
      else {setItems(data.items);setMore(data.hasMore);setCanReview(data.canReview);}
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[studio,category,search,page,scope,detailId,refresh]);
  useEffect(()=>{if(detail?.modelUrl)import("@google/model-viewer");},[detail?.modelUrl]);

  async function change(action:string){
    if(!detail||busy)return;setBusy(true);setError("");setMessage("");
    try{await read(await fetch(`/api/creations/${detail.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,revision:detail.revision,choice})}));
      setMessage(action==="approve"?"Das Werk ist jetzt in der Galerie sichtbar.":action==="withdraw"?"Die Veröffentlichung wurde zurückgezogen.":action==="reject"?"Der Beitrag wurde nicht freigegeben.":"Deine Auswahl wurde gespeichert.");requestRefresh();
    }catch(e){setError(e instanceof Error?e.message:"Speichern fehlgeschlagen.");}finally{setBusy(false);}
  }
  async function checkArchive(){
    if(!detail?.resultTaskId||!detail.sourceType||busy)return;setBusy(true);setError("");
    try{const result=await read(await fetch(`/api/meshy?taskId=${encodeURIComponent(detail.resultTaskId)}&type=${encodeURIComponent(detail.sourceType)}`,{cache:"no-store"}));
      setMessage(result.status==="SUCCEEDED"?"Anbieterstatus geprüft. Der Speicherstand wird neu geladen.":"Das Modell ist noch in Bearbeitung. Du kannst den Status später erneut prüfen.");requestRefresh();
    }catch(e){setError(e instanceof Error?e.message:"Die Datei ist beim Anbieter nicht mehr verfügbar.");}finally{setBusy(false);}
  }
  if(detailId)return <div className="gallery-detail">
    <Link className="text-link" href={detail?.mine?collectionPath(studio):publicGalleryPath(studio)}>← Zur Übersicht</Link>
    {loading&&<p role="status">Werk wird geladen …</p>}{error&&<p role="alert" className="gallery-error">{error}</p>}{message&&<p role="status">{message}</p>}
    {detail&&<><div className="gallery-detail-head"><p className="eyebrow">{detail.studio==="ab3d"?"AB3D · 3D-Modell":"CAPPATEX · Motiv"} / {categoryName(detail.studio,detail.category)}</p><h1>{detail.title}</h1>
      {detail.visibility&&<p>{visibilityName[detail.visibility]} · {stateName[detail.state||""]}</p>}</div>
      <div className={`gallery-detail-media ${detail.studio}`}>
        {detail.modelUrl?<ModelViewer src={detail.modelUrl} poster={detail.thumbnailUrl||undefined} autoRotate={rotate} setAutoRotate={setRotate}/>
          :detail.thumbnailUrl?<img src={detail.thumbnailUrl} alt={detail.title}/>:<p>{stateName[detail.state||""]||"Vorschau noch nicht verfügbar"}</p>}
      </div>
      {detail.mine&&<section className="gallery-owner-controls"><h2>Dein gespeichertes Werk</h2><p>Deine Sammlung bleibt privat. Über eine Veröffentlichung entscheidest du selbst.</p>
        {detail.studio==="cappatex"&&detail.sourceId&&<Link className="button secondary" href={`/cappatex?designId=${encodeURIComponent(detail.sourceId)}#studio`}>Im CAPPATEX Studio öffnen</Link>}
        {detail.studio==="ab3d"&&detail.resultTaskId&&detail.state!=="ready"&&<><button type="button" className="button secondary" disabled={busy} onClick={checkArchive}>Fertigstellung & Speicherung prüfen</button><p>Keine neue Generierung. Bei alten Aufträgen kann die Anbieterdatei bereits abgelaufen sein.</p></>}
        {detail.modelUrl&&<a className="text-link" href={detail.modelUrl} download>Gespeichertes GLB öffnen</a>}
        {detail.versions.length>1&&<details><summary>Gespeicherte Modellstufen ({detail.versions.length})</summary><ul>{detail.versions.map(v=><li key={v.taskId}>{v.type} · {v.state==="ready"?"archiviert":v.state==="error"?"Archivierung offen":"in Bearbeitung"}{v.modelUrl&&<> · <a href={v.modelUrl}>GLB öffnen</a></>}</li>)}</ul></details>}
        {["published","pending","rejected"].includes(detail.visibility||"")&&<button type="button" className="button secondary" disabled={busy} onClick={()=>change("withdraw")}>Aus Galerie zurückziehen</button>}
        <details><summary>Sichtbarkeit, Titel und Kategorie ändern</summary><GalleryConsent studio={detail.studio} value={choice} onChange={setChoice} disabled={busy}/>
          <button type="button" className="button primary" disabled={busy||detail.state!=="ready"||!galleryChoiceValid(choice,detail.studio)} onClick={()=>change("choice")}>Auswahl speichern</button>
          {detail.state!=="ready"&&<p>Die Veröffentlichung kann erst nach abgeschlossener Speicherung angefragt werden.</p>}</details>
      </section>}
      {detail.canReview&&<section className="gallery-owner-controls"><h2>Beitrag prüfen</h2><p>Eine ausdrückliche Galerie-Anfrage und Rechtebestätigung liegen vor. Prüfe Inhalt und Kategorie vor der Freigabe.</p>
        <button type="button" className="button primary" disabled={busy} onClick={()=>change("approve")}>Für Galerie freigeben</button>
        <button type="button" className="button secondary" disabled={busy} onClick={()=>change("reject")}>Nicht freigeben</button></section>}
      {!detail.mine&&<p className="gallery-rights-note">Zum Ansehen freigegeben. Daraus entsteht keine Erlaubnis, das Werk zu verkaufen oder fremde Motive als eigene zu verwenden.</p>}
    </>}
  </div>;

  return <>
    <header className="gallery-intro"><p className="eyebrow">{studio==="cappatex"?"CAPPATEX":"AB3D · 3D Objekte"} · {scope==="mine"?"Deine Sammlung":scope==="review"?"Betreiberbereich":studio==="cappatex"?"Designgalerie":"Modellgalerie"}</p>
      <h1>{scope==="mine"?studio==="cappatex"?"Deine Motive. Aufbewahrt.":"Deine 3D-Modelle. Aufbewahrt.":scope==="review"?"Bereit für die Galerie?":studio==="cappatex"?"Motive zum Entdecken.":"Formen aus unserer Community."}</h1>
      <p>{scope==="mine"?studio==="cappatex"?"Hier findest du deine gespeicherten CAPPATEX-Motive – auch private Designs und ihre Speicherstände.":"Hier findest du deine gespeicherten 3D-Modelle – auch private Modelle und ihre Speicherstände.":scope==="review"?"Diese Werke wurden ausdrücklich zur Veröffentlichung eingereicht.":"Stöbere durch freigegebene Werke. Hinter jedem Ergebnis steht eine eigene Idee und eine bewusste Entscheidung zum Teilen."}</p>
      <div className="gallery-shortcuts"><Link href={publicGalleryPath(studio)}>{studio==="cappatex"?"Designgalerie":"Modellgalerie"}</Link><Link href={collectionPath(studio)}>{studio==="cappatex"?"Meine Motive":"Meine 3D-Modelle"}</Link>{studio==="cappatex"&&<Link href="/cappatex/gestaltungen">Meine Gestaltungen</Link>}{canReview&&<Link href={galleryReviewPath(studio)}>Freigaben prüfen</Link>}</div>
    </header>
    <div className="gallery-filterbar">
      <form onSubmit={e=>{e.preventDefault();setSearch(query);setPage(1);requestRefresh();}}><label>Nach Titel suchen<input value={query} maxLength={80} onChange={e=>setQuery(e.target.value)} placeholder="Ein Werk finden …"/></label><button type="submit">Suchen</button></form>
    </div>
    {studio&&<div className="gallery-categories" aria-label="Galerie nach Kategorie filtern">{[["","Alle Kategorien"],...Object.entries(GALLERY_CATEGORIES[studio])].map(([key,label])=><button key={key} type="button" aria-pressed={category===key} onClick={()=>{setCategory(key);setPage(1);requestRefresh();}}>{label}</button>)}</div>}
    {loading?<p role="status" className="gallery-empty">Werke werden geladen …</p>:error?<p role="alert" className="gallery-error">{error}</p>:items.length===0?<div className="gallery-empty"><span aria-hidden="true">{scope==="review"?"✓":"✦"}</span><h2>{search||category?"Hier passt noch kein Werk.":scope==="mine"?"Hier beginnt deine Sammlung.":scope==="review"?"Alle Anfragen sind geprüft.":"Platz für die ersten Werke."}</h2>
      <p>{scope==="public"?"Hier erscheinen nur Werke, deren Ersteller ausdrücklich zugestimmt haben und die freigegeben wurden.":scope==="mine"?studio==="cappatex"?"Erstelle ein CAPPATEX-Motiv. Deine Designs werden hier privat gespeichert.":"Erstelle ein 3D-Modell. Deine Modelle werden hier privat gespeichert.":"Neue Galerie-Anfragen erscheinen nach abgeschlossener Speicherung hier."}</p>
      {scope!=="review"&&<Link className="button primary" href={studio==="cappatex"?"/cappatex#studio":"/#studio"}>Eigene Idee gestalten</Link>}</div>:
      <div className="gallery-grid">{items.map(item=><article className="gallery-work" key={item.id}><Link href={galleryWorkPath(item.studio,item.id)}>
        <div className={`gallery-work-image ${item.studio}`}>{item.thumbnailUrl?<img src={item.thumbnailUrl} alt={item.title} loading="lazy"/>:<span>{stateName[item.state||""]||"3D-Modell"}</span>}<small>{item.studio==="ab3d"?"3D":"MOTIV"}</small></div>
        <p>{categoryName(item.studio,item.category)}</p><h2>{item.title}</h2>{item.visibility&&<span className="gallery-work-status">{visibilityName[item.visibility]} · {stateName[item.state||""]}</span>}</Link></article>)}</div>}
    <div className="gallery-pagination"><button type="button" disabled={page<=1||loading} onClick={()=>{setPage(v=>v-1);requestRefresh();}}>← Zurück</button><span>Seite {page}</span><button type="button" disabled={!more||loading} onClick={()=>{setPage(v=>v+1);requestRefresh();}}>Weitere Werke →</button></div>
  </>;
}
