"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const INTRO_DURATION_MS = 5000;
type Studio = "ab3d" | "cappatex";

function WorkshopScene({ studio }: { studio: Studio }) {
  return <svg className="intro-workshop" viewBox="0 0 640 360" aria-hidden="true">
    <defs>
      <pattern id={`intro-layers-${studio}`} width="6" height="7" patternUnits="userSpaceOnUse"><path d="M0 6H6" stroke="currentColor" strokeOpacity=".32"/></pattern>
      <clipPath id={`intro-form-${studio}`}><path d="M275 106h90v35c0 26 55 43 55 91 0 29-15 55-23 65H243c-8-10-23-36-23-65 0-48 55-65 55-91z"/></clipPath>
    </defs>
    <g className="intro-drafting"><path d="M80 300h480M95 55v260M545 55v260M75 95h490M75 250h490"/><circle cx="320" cy="180" r="122"/><path d="M306 180h28m-14-14v28"/></g>
    <ellipse className="intro-object-shadow" cx="320" cy="304" rx="130" ry="11"/>
    {studio === "ab3d" ? <>
      <path className="intro-form-outline" d="M275 106h90v35c0 26 55 43 55 91 0 29-15 55-23 65H243c-8-10-23-36-23-65 0-48 55-65 55-91z"/>
      <g clipPath={`url(#intro-form-${studio})`}><g className="intro-growing-form"><rect x="215" y="100" width="210" height="200" fill="var(--intro-clay)"/><rect x="215" y="100" width="210" height="200" fill={`url(#intro-layers-${studio})`}/><path d="M251 100v205m22-205v205m24-205v205m24-205v205m24-205v205m24-205v205m24-205v205" stroke="white" strokeOpacity=".17" strokeWidth="9"/></g></g>
      <path className="intro-gantry" d="M165 295V62h310v233M165 80h310"/>
      <g className="intro-print-carriage"><path d="M0 0h50v43H0z"/><path className="intro-nozzle" d="M15 43h20l-10 22z"/><path d="M12 12h26v12H12z" fill="var(--intro-light)"/></g>
      <path className="intro-bed-line" d="M205 301h230"/>
    </> : <>
      <path className="intro-shirt" d="M265 90l-74 45 30 58 38-18v120h122V175l38 18 30-58-74-45-21 24h-68z"/>
      <path className="intro-shirt-seams" d="M286 90c0 38 68 38 68 0M259 175v120m122-120v120m-116-8h110"/>
      <g className="intro-textile-design"><circle cx="320" cy="185" r="39"/><path d="M280 218l30-42 18 23 12-16 25 35z" fill="var(--intro-light)"/><path d="M285 235h70"/></g>
      <g className="intro-textile-squeegee"><rect x="244" y="153" width="152" height="16" rx="4"/><path d="M255 172h130"/></g>
      <path className="intro-register-mark" d="M226 75h-12v12m200-12h12v12M214 303v12h12m200-12v12h-12"/>
    </>}
  </svg>;
}

function IntroSequence({ studio }: { studio: Studio }) {
  const [visible, setVisible] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let frame = 0;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const key = `ab3d-welcome-v3-${studio}`;
    function start(force = false) {
      if (media.matches) return;
      if (!force) {
        if (window.location.hash || window.location.search) return;
        try { if (sessionStorage.getItem(key)) return; } catch { /* Storage is optional. */ }
      }
      frame = requestAnimationFrame(() => {
        try { sessionStorage.setItem(key, "seen"); } catch { /* Never block access. */ }
        setVisible(true);
      });
    }
    const replay = (event: Event) => { if ((event as CustomEvent).detail === studio) start(true); };
    start();
    window.addEventListener("ab3d:replay-intro", replay);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("ab3d:replay-intro", replay); };
  }, [studio]);
  useEffect(() => {
    if (!visible) return;
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    const finish = () => { element.close(); setVisible(false); };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setTimeout(finish, INTRO_DURATION_MS);
    media.addEventListener("change", finish);
    return () => { window.clearTimeout(timer); media.removeEventListener("change", finish); if (element.open) element.close(); };
  }, [visible]);
  if (!visible) return null;
  function skip() { dialog.current?.close(); setVisible(false); }
  return <dialog ref={dialog} className={`brand-intro brand-intro-${studio}`} aria-labelledby="intro-brand-name" aria-describedby="intro-caption"
    onCancel={event => { event.preventDefault(); skip(); }}>
    <div className="intro-topline"><span>{studio === "ab3d" ? "AB3D · Schweizer Designwerkstatt" : "CAPPATEX · Dein Printstudio"}</span><button type="button" onClick={skip} aria-label="Startanimation überspringen">Überspringen <span aria-hidden="true">↗</span></button></div>
    <div className="brand-print-stage"><WorkshopScene studio={studio}/>
      <h2 className="printed-brand" id="intro-brand-name">{studio === "cappatex" ? "CAPPATEX" : <><span>AB</span><b>3D</b></>}</h2>
      <p id="intro-caption">{studio === "cappatex" ? "Dein Motiv wird tragbar" : "Idee wird Schicht für Schicht Form"}</p>
    </div>
    <div className="intro-bottomline"><span>{studio === "cappatex" ? "Von der Idee auf dein Lieblingsstück." : "Aus einer Idee entsteht etwas zum Anfassen."}</span><i className="intro-timeline" aria-hidden="true"/></div>
  </dialog>;
}

export default function BrandIntro() {
  const pathname = usePathname();
  const isCappatex = pathname.startsWith("/cappatex");
  // Deep links and saved work remain directly usable.
  if (pathname !== "/" && pathname !== "/cappatex") return null;
  return <IntroSequence key={isCappatex ? "cappatex" : "ab3d"} studio={isCappatex ? "cappatex" : "ab3d"}/>;
}

export function ReplayBrandIntro({ studio }: { studio: Studio }) {
  return <button type="button" className="intro-replay" onClick={() => window.dispatchEvent(new CustomEvent("ab3d:replay-intro", { detail: studio }))}>Startanimation ansehen <span aria-hidden="true">↗</span></button>;
}
