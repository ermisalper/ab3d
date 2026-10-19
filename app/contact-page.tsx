import SiteHeader from "./site-header";
import { CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, contactEmailUrl, contactPageHref, contactWhatsAppUrl } from "./contact-details";

type ContactArea = "objects" | "cappatex";

function ContactIcon({ kind }: { kind: "message" | "mail" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "message" ? <><path d="M20 11.5a8 8 0 0 1-11.9 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" /><path d="M8.5 9h7M8.5 13h4.5" /></>
      : <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>}
  </svg>;
}

function ContactArrow() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 15 15 5M5 5h10v10" />
  </svg>;
}

export default function ContactPage({ area, userName }: { area: ContactArea; userName?: string | null }) {
  const cappatex = area === "cappatex";
  const home = cappatex ? "/cappatex" : "/";
  const division = cappatex ? "CAPPATEX" : "AB3D";
  const suggestions = cappatex ? [
    "Beschreibe dein Motiv oder schicke ein Bild, zu dem du Hilfe möchtest.",
    "Nenne das Produkt, die Farbe und die Grösse, die du dir vorstellst.",
    "Bei Fragen zu einer Gestaltung hilft ein Screenshot oder die Nummer deines gespeicherten Stands.",
  ] : [
    "Beschreibe deine Idee oder schicke ein Foto oder eine Skizze.",
    "Nenne die gewünschte Grösse und wofür du dein Objekt verwenden möchtest.",
    "Schreib dazu, ob du schon Wünsche zu Farbe oder Material hast.",
  ];

  return <div className={`contact-page${cappatex ? " cappatex-page" : ""}`}>
    <SiteHeader area={area} userName={userName} />
    <main id="main-content" className="contact-main">
      <a className="contact-back" href={home}><span aria-hidden="true">←</span> Zurück zu {division}</a>
      <div className="contact-layout">
        <section className="contact-intro" aria-labelledby="contact-heading">
          <p className="contact-eyebrow">{cappatex ? "CAPPATEX by AB3D" : "AB3D Swiss Design"} · Kontakt</p>
          <h1 className="contact-title" id="contact-heading">Schreib mir<br /><em>deine Idee.</em></h1>
          <p className="contact-lead">Ich bin Berk. {cappatex
            ? "Du brauchst Hilfe mit deinem Motiv, möchtest dein Design besprechen oder hast einen Sonderwunsch? Schreib mir, was du dir vorstellst."
            : "Du hast eine Frage zu einem 3D-Objekt, möchtest eine eigene Idee umsetzen oder hast einen Sonderwunsch? Schreib mir, was du dir vorstellst."}</p>
          <p className="contact-person"><span className="contact-person-mark" aria-hidden="true">B</span><span><strong>Berk</strong><small>{cappatex ? "Motiv- und Designhilfe für CAPPATEX" : "Dein Kontakt für AB3D und 3D-Objekte"}</small></span></p>
        </section>

        <section className="contact-channels" aria-label="Kontaktmöglichkeiten">
          <article className="contact-channel contact-channel-whatsapp" aria-labelledby="contact-whatsapp-heading">
            <span className="contact-channel-icon"><ContactIcon kind="message" /></span>
            <h2 id="contact-whatsapp-heading">Auf WhatsApp</h2>
            <p>Schreib mir direkt im Chat. Du kannst auch ein Bild oder einen Screenshot deiner Idee ergänzen.</p>
            <p className="contact-value">{CONTACT_PHONE_DISPLAY}</p>
            <a className="contact-action" href={contactWhatsAppUrl(area)} target="_blank" rel="noopener noreferrer"><span>WhatsApp öffnen</span><ContactArrow /></a>
          </article>

          <article className="contact-channel contact-channel-email" aria-labelledby="contact-email-heading">
            <span className="contact-channel-icon"><ContactIcon kind="mail" /></span>
            <h2 id="contact-email-heading">Per E-Mail</h2>
            <p>Mehr Platz für deine Idee, Fragen oder besondere Wünsche. Schreib mir in deinem E-Mail-Programm.</p>
            <p className="contact-value">{CONTACT_EMAIL}</p>
            <a className="contact-action contact-action-secondary" href={contactEmailUrl(area)}><span>E-Mail schreiben</span><ContactArrow /></a>
          </article>
          <p className="contact-channel-note">Die Nachricht wird erst gesendet, wenn du sie in WhatsApp oder deinem E-Mail-Programm abschickst.</p>
        </section>
        <section className="contact-help" aria-labelledby="contact-help-heading">
          <h2 id="contact-help-heading">Das hilft mir bei deiner Anfrage</h2>
          <ul>{suggestions.map(suggestion => <li key={suggestion}>{suggestion}</li>)}</ul>
        </section>
      </div>
    </main>
    <footer className="contact-footer">
      <p className="contact-footer-brand">AB3D Swiss Design <span>· Kontakt mit Berk</span></p>
      <nav className="contact-footer-links" aria-label="Kontakt und rechtliche Informationen">
        <a href={contactPageHref(cappatex ? "objects" : "cappatex")}>Kontakt: {cappatex ? "3D-Objekte" : "CAPPATEX"}</a>
        <a href="/recht/impressum">Impressum</a>
        <a href="/recht/datenschutz">Datenschutz</a>
      </nav>
    </footer>
  </div>;
}
