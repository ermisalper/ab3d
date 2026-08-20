import Link from "next/link";
import SiteHeader from "../site-header";

const legalLinks = [
  ["Übersicht", "/recht"],
  ["Impressum", "/recht/impressum"],
  ["Datenschutz", "/recht/datenschutz"],
  ["AGB", "/recht/agb"],
  ["Versand & Rückgabe", "/recht/versand-rueckgabe"],
  ["KI & Produktsicherheit", "/recht/ki-produktsicherheit"],
] as const;

export default function LegalShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="legal-page">
      <SiteHeader area="objects" />
      <header className="legal-hero">
        <div>
          <p className="eyebrow">AB3D Rechtscenter</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        <aside className="legal-draft-notice" role="status">
          <b>Entwurf für die private Vorbereitungsphase</b>
          <p>Vor der öffentlichen Freigabe müssen Betreibername, Rechtsform, vollständige Adresse und gegebenenfalls UID/MWST-Nummer bestätigt werden.</p>
        </aside>
      </header>

      <div className="legal-layout">
        <nav className="legal-nav" aria-label="Rechtliche Informationen">
          {legalLinks.map(([label, href]) => <Link key={href} href={href}>{label}<span aria-hidden="true">→</span></Link>)}
        </nav>
        <article className="legal-content">{children}</article>
      </div>

      <footer className="legal-footer">
        <div className="footer-brand"><Link className="brand" href="/#top"><span>AB</span><b>3D</b></Link><p>Schweizer 3D-Design und personalisierte Produkte.</p></div>
        <div><b>Rechtliches</b>{legalLinks.slice(1, 4).map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
        <div><b>Service</b>{legalLinks.slice(4).map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}<a href="mailto:hello@ab3d.ch">hello@ab3d.ch</a></div>
        <small>© 2026 AB3D · Stand 15. August 2026 · Rechtsentwurf, noch nicht öffentlich freigegeben</small>
      </footer>
    </main>
  );
}
