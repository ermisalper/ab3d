import Link from "next/link";
import LegalShell from "./legal-shell";

const cards = [
  ["Impressum", "Wer AB3D und CAPPATEX betreibt und wie du uns erreichst.", "/recht/impressum"],
  ["Datenschutz", "Welche Daten wir wofür verarbeiten und welche Rechte du hast.", "/recht/datenschutz"],
  ["Allgemeine Geschäftsbedingungen", "Regeln für Kollektion, individuelle 3D-Produkte, KI-Designs und Abos.", "/recht/agb"],
  ["Versand & Rückgabe", "Liefergebiete, Kosten, Fertigungszeiten, Schäden und Rückgaben.", "/recht/versand-rueckgabe"],
  ["KI & Produktsicherheit", "Verantwortung für Uploads, Designprüfung, Material- und Sicherheitshinweise.", "/recht/ki-produktsicherheit"],
] as const;

export default function LegalOverviewPage() {
  return (
    <LegalShell title="Rechtlich klar. Verständlich erklärt." intro="Hier findest du die Regeln für beide AB3D Bereiche: individuelle 3D-Objekte und CAPPATEX Print-on-Demand-Produkte.">
      <section>
        <h2>Alles an einem Ort</h2>
        <p>Diese Dokumente bilden den Arbeitsstand für den geplanten Schweizer Shop. Sie sind bewusst in verständlicher Sprache geschrieben und orientieren sich an den tatsächlichen Abläufen der Website.</p>
        <div className="legal-card-grid">
          {cards.map(([title, text, href]) => <Link href={href} key={href}><b>{title}</b><span>{text}</span><i>Öffnen →</i></Link>)}
        </div>
      </section>
      <section className="legal-action-box">
        <h2>Vor dem öffentlichen Start noch erforderlich</h2>
        <ul>
          <li>Vollständigen Namen beziehungsweise Firma und Rechtsform bestätigen.</li>
          <li>Ladungsfähige Geschäftsadresse und Kontakttelefon ergänzen.</li>
          <li>UID- und MWST-Nummer ergänzen, sofern vorhanden beziehungsweise erforderlich.</li>
          <li>Freiwillige Rückgabefrist und genaue Abo-Kündigungsregeln festlegen.</li>
          <li>Finale rechtliche Prüfung für das konkrete Unternehmen und Sortiment durchführen lassen.</li>
        </ul>
      </section>
    </LegalShell>
  );
}
