import type { Metadata } from "next";
import LegalShell from "../legal-shell";

export const metadata: Metadata = { title: "Impressum | AB3D Swiss Design" };

export default function ImpressumPage() {
  return (
    <LegalShell title="Impressum" intro="Kontakt- und Betreiberinformationen für AB3D Swiss Design und CAPPATEX.">
      <section>
        <h2>Betreiber</h2>
        <dl className="legal-identity">
          <div><dt>Geschäftsbezeichnung</dt><dd>AB3D Swiss Design</dd></div>
          <div><dt>Angebot</dt><dd>AB3D 3D Objekte und CAPPATEX by AB3D</dd></div>
          <div className="is-missing"><dt>Rechtlicher Betreiber / Rechtsform</dt><dd>Vor Publikation ergänzen</dd></div>
          <div className="is-missing"><dt>Vollständige Geschäftsadresse</dt><dd>Vor Publikation ergänzen · Zürich, Schweiz</dd></div>
          <div className="is-missing"><dt>UID / MWST</dt><dd>Ergänzen, sofern vorhanden oder steuerlich erforderlich</dd></div>
        </dl>
      </section>
      <section>
        <h2>Kontakt</h2>
        <p>E-Mail: <a href="mailto:hello@ab3d.ch">hello@ab3d.ch</a></p>
        <p className="legal-placeholder">Telefonnummer: vor Publikation ergänzen</p>
        <p>Für Bestellungen, Mängelmeldungen oder Datenschutzanfragen bitte die Bestell- beziehungsweise Designreferenz angeben. Sensible Daten sollen nicht unnötig per E-Mail übermittelt werden.</p>
      </section>
      <section>
        <h2>Inhalte und Urheberrechte</h2>
        <p>Die Inhalte, Produktdarstellungen, Markenbestandteile und das Erscheinungsbild dieser Website sind geschützt. Eine Verwendung ausserhalb des persönlichen, nicht kommerziellen Zwecks bedarf der vorherigen Zustimmung, soweit nicht gesetzlich anders erlaubt.</p>
        <p>Für von Kundinnen und Kunden bereitgestellte Texte, Bilder, Modelle oder Marken sind die einreichenden Personen verantwortlich. Einzelheiten stehen in den AGB und in den Regeln zu KI und Produktsicherheit.</p>
      </section>
    </LegalShell>
  );
}
