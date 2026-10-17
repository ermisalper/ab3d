"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SiteHeader from "../site-header";
import CappatexDesigner from "./cappatex-designer";
import type { ShopifyCatalogProduct } from "../shopify-catalog";
import FinishedCollection from "./finished-collection";
import { ReplayBrandIntro } from "../brand-intro";

const heroPrints = [
  { id: "alpine", label: "Alpine Bloom", mark: "✦", lineOne: "ALPINE", lineTwo: "BLOOM" },
  { id: "orbit", label: "Orbit 03", mark: "●", lineOne: "ORBIT", lineTwo: "03" },
  { id: "wild", label: "Wild Lines", mark: "≈", lineOne: "WILD", lineTwo: "LINES" },
  { id: "cappatex", label: "CAPPATEX Studio", mark: "C", lineOne: "CAPPA", lineTwo: "TEX" },
] as const;


export default function CappatexStudio({ userName, finishedProducts, storeDomain }: { userName?: string | null; finishedProducts: ShopifyCatalogProduct[]; storeDomain: string }) {
  const [heroPrintIndex, setHeroPrintIndex] = useState(0);
  const [heroPressActive, setHeroPressActive] = useState(false);
  const heroPrintTimer = useRef<number | null>(null);
  useEffect(() => () => { if (heroPrintTimer.current !== null) window.clearTimeout(heroPrintTimer.current); }, []);
  const pressNextHeroDesign = () => {
    if (heroPressActive) return;
    setHeroPressActive(true);
    heroPrintTimer.current = window.setTimeout(() => {
      setHeroPrintIndex(current => (current + 1) % heroPrints.length);
      heroPrintTimer.current = null;
    }, 310);
  };
  return (
    <main className="cappatex-page" id="main-content">
      <SiteHeader area="cappatex" userName={userName} />

      <section className="cappatex-hero">
        <div>
          <p className="eyebrow">KI-Design · Print on Demand</p>
          <h1>Deine Idee.<br /><em>Dein Statement.</em></h1>
          <p>Beschreibe dein Wunschmotiv, sieh es direkt auf deinem Produkt und passe Grösse sowie Position selbst an.</p>
          <a className="button primary" href="#studio">Jetzt gestalten</a>
          <div className="studio-quick-links"><Link href="/cappatex/designs">Designgalerie entdecken ↗</Link><Link href="/cappatex/sammlung">Meine Motive ↗</Link></div>
        </div>
        <div className="cappatex-hero-art">
          <button
            type="button"
            className={`cappatex-press-scene ${heroPressActive ? "is-pressing" : ""}`}
            onClick={pressNextHeroDesign}
            onAnimationEnd={(event) => {
              if (event.animationName === "cappatexPressCycle") setHeroPressActive(false);
            }}
            aria-label={`T-Shirt bedrucken. Aktuelles Motiv: ${heroPrints[heroPrintIndex].label}. Klicken für das nächste Design.`}
          >
            <span className="cappatex-press-grid" aria-hidden="true" />
            <span className="cappatex-press-machine" aria-hidden="true">
              <span className="cappatex-press-column" />
              <span className="cappatex-press-rail" />
              <span className="cappatex-press-head"><i /><b>PRINT</b></span>
            </span>
            <span className="cappatex-shirt-stage" aria-hidden="true">
              <span className="cappatex-shirt-shadow" />
              <span className="cappatex-hero-shirt-real">
                <span className="cappatex-shirt-neck" />
                <span className="cappatex-shirt-seam seam-left" />
                <span className="cappatex-shirt-seam seam-right" />
                <span className={`cappatex-shirt-print print-${heroPrints[heroPrintIndex].id}`}>
                  <i>{heroPrints[heroPrintIndex].mark}</i>
                  <b>{heroPrints[heroPrintIndex].lineOne}</b>
                  <strong>{heroPrints[heroPrintIndex].lineTwo}</strong>
                </span>
              </span>
            </span>
            <span className="cappatex-ink-flash" aria-hidden="true" />
            <span className="cappatex-press-instruction">
              <i>{String(heroPrintIndex + 1).padStart(2, "0")} / {String(heroPrints.length).padStart(2, "0")}</i>
              <b>{heroPressActive ? "Wird gepresst …" : "Klicken & neu bedrucken"}</b>
              <small>Jeder Klick · ein neues Motiv</small>
            </span>
          </button>
        </div>
      </section>

      <CappatexDesigner />
      <FinishedCollection products={finishedProducts} storeDomain={storeDomain} />

      <section className="cappatex-how section" id="ablauf">
        <div><p className="eyebrow">So entsteht dein Einzelstück</p><h2>Einfach gestaltet.<br />Bewusst produziert.</h2></div>
        <ol>
          <li><b>01</b><div><strong>Du gestaltest</strong><p>Die KI übersetzt deine Beschreibung in ein Motiv im gewählten Format.</p></div></li>
          <li><b>02</b><div><strong>Du prüfst</strong><p>Produkt, Farbe, Grösse und Platzierung bleiben bis zur Bestellung anpassbar.</p></div></li>
          <li><b>03</b><div><strong>Wir produzieren</strong><p>Erst nach deiner Bestellung wird dein Einzelstück gedruckt und versendet.</p></div></li>
        </ol>
      </section>

      <section className="faq-section section cappatex-faq" id="faq">
        <div><p className="eyebrow">Häufige Fragen</p><h2>Klar vor der Bestellung.</h2><p>Du entscheidest erst nach der Vorschau, ob dein Motiv produziert werden soll.</p></div>
        <div className="faq-list">
          <details><summary>Wann wird mein Produkt produziert?</summary><p>Erst nach deiner bestätigten Zahlung. Produkt, Variante, Motivgrösse und Position werden mit der Bestellung gespeichert und unveränderlich für die Produktion gespeichert. Die Produktion wird erst nach der Betreiberfreigabe gestartet.</p></details>
          <details><summary>Kann ich mein Motiv herunterladen?</summary><p>Dein Motiv bleibt als unveränderte PNG-Datei mit der Bestellung gespeichert. Die angezeigte Auflösung entscheidet darüber, wie gross es gedruckt werden kann.</p></details>
          <details><summary>Warum sehe ich manchmal keinen Produktkatalog?</summary><p>Das Studio zeigt ausschliesslich tatsächlich verbundene und bestellbare Produkte. Ist die Verbindung vorübergehend nicht verfügbar, werden keine erfundenen Produkte oder Preise eingeblendet.</p></details>
        </div>
      </section>

      <footer className="cappatex-footer">
        <div className="footer-brand"><Link className="brand" href="/#top"><span>AB</span><b>3D</b></Link><p>CAPPATEX verbindet deine Idee mit hochwertigem Print on Demand.</p><ReplayBrandIntro studio="cappatex"/></div>
        <div><b>CAPPATEX</b><a href="#studio">Motiv gestalten</a><Link href="/cappatex/designs">Designgalerie</Link><Link href="/cappatex/sammlung">Meine Motive</Link><Link href="/cappatex#kollektion">Fertige Artikel</Link><Link href="/#studio">3D-Modell gestalten</Link></div>
        <div><b>Service & Recht</b><a href="mailto:hello@ab3d.ch">Kontakt</a><Link href="/recht">Rechtscenter</Link><Link href="/recht/datenschutz">Datenschutz</Link><Link href="/recht/agb">AGB</Link><Link href="/recht/versand-rueckgabe">Versand & Rückgabe</Link></div>
        <small>© 2026 AB3D · CAPPATEX · Designed in Switzerland</small>
      </footer>
    </main>
  );
}
