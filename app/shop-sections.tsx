import Link from "next/link";
import { creatorPlans, tokenRules } from "./creator-plans";

export function ShopHero({ productCount }: { productCount: number }) {
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow hero-kicker">Designed in Zürich · Für dich gefertigt</p>
        <h1>Objekte, die kein zweites Mal <em>genauso entstehen.</em></h1>
        <p className="hero-lead">Skulpturale Wohnobjekte und persönliche 3D-Kreationen – lokal, auf Bestellung und in deiner Wunschfarbe gefertigt.</p>
        <div className="hero-actions"><a className="button primary" href="#kollektion">Kollektion entdecken</a><a className="button ghost" href="#studio">Eigenes Design erschaffen</a></div>
        <div className="trust-row"><span><b>360°</b> Produktvorschau</span><span><b>100%</b> erst nach Bestellung</span><span><b>{productCount}</b> Shopify-Produkte</span></div>
      </div>
      <div className="hero-art hero-product-stage" aria-label="Interaktive dreidimensionale AB3D Produktvorschau">
        <div className="sun-disc" aria-hidden="true" />
        <div className="hero-model-wrap">
          {/* @ts-expect-error model-viewer is a registered web component. */}
          <model-viewer src="/models/ab3d-ribbed-vase.glb" alt="Gerippte terracottafarbene AB3D Japandi-Vase als frei drehbares 3D-Modell" camera-controls touch-action="pan-y" camera-orbit="28deg 72deg auto" min-camera-orbit="auto 25deg 68%" max-camera-orbit="auto 155deg 250%" field-of-view="27deg" shadow-intensity="1.35" shadow-softness=".75" exposure="1.08" tone-mapping="aces" environment-image="neutral" interaction-prompt="auto" interaction-prompt-style="wiggle" loading="eager" reveal="auto" />
          <span className="hero-product-floor" aria-hidden="true" />
        </div>
        <div className="drag-hint"><i aria-hidden="true">360°</i> Drehen &amp; zoomen</div>
      </div>
    </section>
  );
}

export function CappatexTeaser() {
  return (
    <section className="cappatex-home section" data-reveal>
      <div className="cappatex-home-copy"><p className="eyebrow">Neu · CAPPATEX by AB3D</p><h2>Deine Idee.<br /><em>Jetzt tragbar.</em></h2><p>Erstelle mit wenigen Worten ein eigenes Motiv, platziere es direkt auf Kleidung oder Accessoires und bestelle dein Einzelstück on demand.</p><Link className="button light" href="/cappatex">CAPPATEX Studio öffnen →</Link></div>
      <div className="cappatex-home-art" aria-hidden="true"><span /><div><b>AB</b><i>DEINE<br />IDEE</i></div><small>Prompt → Motiv → Produkt</small></div>
    </section>
  );
}

export function PlansSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="subscription-teaser section" id="preise">
      <div className="section-heading" data-reveal><div><p className="eyebrow">AB3D Creator Plans</p><h2>Zwei Studios.<br />Einfach gewählt.</h2></div><p>Nutze AB3D 3D und CAPPATEX getrennt oder gemeinsam. Bei physischen Bestellungen geht die Produktionsdatei intern an uns; ein eigener Dateidownload ist im passenden Abo enthalten.</p></div>
      <div className="home-plan-grid">
        {creatorPlans.map((plan) => (
          <article className={plan.popular ? "featured" : ""} data-reveal key={plan.id}>
            {plan.popular && <i>Beide Studios</i>}<span>{plan.name}</span><h3>{plan.price}<small>{plan.cadence}</small></h3><b>{plan.tokens}</b><p><strong>{plan.audience}</strong><br />{plan.features.join(" · ")}</p>
          </article>
        ))}
      </div>
      <div className="home-token-guide" data-reveal><strong>Tokens pro Aktion</strong><div>{tokenRules.map(([tokens, use]) => <span key={tokens}><b>{tokens}</b>{use}</span>)}</div></div>
      <Link className="button primary" href={signedIn ? "/konto" : "/signin-with-chatgpt?return_to=%2Fkonto"}>{signedIn ? "Tokens & Abo verwalten" : "Kostenlos anmelden"}</Link>
    </section>
  );
}

const faqItems = [
  ["Wie lange dauert die Fertigung?", "Die meisten Kollektionsteile benötigen 5–10 Werktage. Individuelle KI-Designs erhalten nach der Druckbarkeitsprüfung einen konkreten Termin."],
  ["Sind die Objekte wasserdicht?", "Dekorative Vasen sind primär für Trockenblumen gedacht. Eine zusätzliche Versiegelung kann individuell angefragt werden."],
  ["Kann ich Farbe und Grösse ändern?", "Ja. In der Kollektion stehen mehrere Farben und drei Grössen bereit. Im AI Studio kannst du die Modellhöhe exakt zwischen 5 und 80 cm festlegen."],
  ["Wo bezahle ich meine Bestellung?", "Du gestaltest und wählst alles direkt hier bei AB3D. Erst beim Bezahlen öffnet sich der sichere Shopify-Checkout für Adresse, Versandart und Zahlungsmethode."],
] as const;

export function FaqSection() {
  return (
    <section className="faq-section section" id="faq">
      <div data-reveal><p className="eyebrow">Gut zu wissen</p><h2>Fragen vor<br />der Bestellung.</h2><p>Der Design-Guide unten rechts hilft dir ebenfalls sofort weiter.</p></div>
      <div className="faq-list">{faqItems.map(([question, answer]) => <details data-reveal key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    </section>
  );
}

const footerGroups = [
  { title: "3D Design", links: [["Kollektion", "/#kollektion"], ["3D AI Studio", "/#studio"], ["Creator Plans", "/#preise"]] },
  { title: "CAPPATEX", links: [["Print Studio", "/cappatex"], ["So funktioniert es", "/cappatex#ablauf"]] },
  { title: "Service & Recht", links: [["Kontakt", "mailto:hello@ab3d.ch"], ["Rechtscenter", "/recht"], ["Impressum", "/recht/impressum"], ["Datenschutz", "/recht/datenschutz"], ["AGB", "/recht/agb"], ["Versand & Rückgabe", "/recht/versand-rueckgabe"]] },
] as const;

export function ShopFooter() {
  return (
    <footer>
      <div className="footer-brand"><a className="brand" href="#top"><span>AB</span><b>3D</b></a><p>Schweizer 3D-Design für Räume mit Persönlichkeit.</p></div>
      {footerGroups.map((group) => <div key={group.title}><b>{group.title}</b>{group.links.map(([label, href]) => href.startsWith("mailto:") ? <a href={href} key={href}>{label}</a> : <Link href={href} key={href}>{label}</Link>)}</div>)}
      <small>© 2026 AB3D · Designed & made in Switzerland</small>
    </footer>
  );
}
