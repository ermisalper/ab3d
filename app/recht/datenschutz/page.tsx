import type { Metadata } from "next";
import LegalShell from "../legal-shell";

export const metadata: Metadata = { title: "Datenschutz | AB3D Swiss Design" };

export default function DatenschutzPage() {
  return (
    <LegalShell title="Datenschutzerklärung" intro="Wie AB3D Daten im Shop, in den KI-Studios und bei der Produktion verarbeitet.">
      <section>
        <h2>1. Verantwortliche Stelle</h2>
        <p>Verantwortlich ist der im Impressum bezeichnete Betreiber von AB3D Swiss Design, Zürich, Schweiz. Datenschutzanfragen können an <a href="mailto:hello@ab3d.ch">hello@ab3d.ch</a> gerichtet werden. Die vollständigen Betreiber- und Adressangaben werden vor der öffentlichen Freigabe ergänzt.</p>
      </section>
      <section>
        <h2>2. Welche Daten wir verarbeiten</h2>
        <ul>
          <li><b>Konto:</b> E-Mail-Adresse, Anzeigename, Anmeldestatus, Plan, Token-Guthaben und Abonnementanfragen.</li>
          <li><b>Bestellung:</b> Name, Lieferadresse, optional Telefonnummer und Hinweise, Warenkorb, Varianten, Preise und Status.</li>
          <li><b>Kreativdaten:</b> Prompts, Antworten im Designplaner, hochgeladene Bilder, generierte Vorschauen, 3D-Dateien, Druckparameter und Designreferenzen.</li>
          <li><b>Nutzung und Sicherheit:</b> technisch erforderliche Protokoll-, Fehler-, Missbrauchs- und Request-Daten.</li>
          <li><b>Zahlung und Versand:</b> Status- und Referenzdaten, die für Checkout, Produktion, Lieferung, Rückerstattung oder Support benötigt werden. Vollständige Kartendaten werden nicht durch AB3D gespeichert.</li>
        </ul>
      </section>
      <section>
        <h2>3. Zwecke</h2>
        <p>Wir verarbeiten Daten, um Konten bereitzustellen, Ideen in Designs umzusetzen, Bestellanfragen und Käufe abzuwickeln, Dateien zu prüfen, Produkte zu fertigen und zu versenden, Support zu leisten, Missbrauch zu verhindern und gesetzliche Pflichten zu erfüllen.</p>
      </section>
      <section>
        <h2>4. Dienstleister und Datenübermittlung</h2>
        <p>Für Hosting, Anmeldung, KI-Generierung, 3D-Verarbeitung, Checkout, Druck und Versand setzen wir sorgfältig ausgewählte Auftrags- und Unterauftragsdienstleister ein. Dabei können Daten auch ausserhalb der Schweiz bearbeitet werden. Wir begrenzen die übermittelten Daten auf den jeweiligen Zweck und verwenden angemessene vertragliche sowie technische Schutzmassnahmen.</p>
        <p>Empfänger sind – soweit für den jeweiligen Vorgang erforderlich – Anbieter für Website-Hosting und Anmeldung, KI- und 3D-Verarbeitung, Zahlungs- und Shopabwicklung, Auftragsdruck, Versand sowie technischer Support. Bei einer Bearbeitung ausserhalb der Schweiz stützen wir die Übermittlung auf einen anerkannten Angemessenheitsentscheid oder geeignete Garantien, insbesondere anerkannte Standarddatenschutzklauseln. Auskunft zu den für einen konkreten Vorgang eingesetzten Empfängern und Staaten kann über <a href="mailto:hello@ab3d.ch">hello@ab3d.ch</a> angefordert werden.</p>
      </section>
      <section>
        <h2>5. Speicherdauer</h2>
        <p>Wir speichern personenbezogene Daten nur so lange, wie sie für Konto, Auftrag, Produktion, Support, Sicherheit oder gesetzliche Aufbewahrungspflichten benötigt werden. Kreativdateien können für die Abwicklung eines Auftrags und den späteren Kontozugriff gespeichert bleiben. Löschwünsche prüfen wir unter Berücksichtigung laufender Aufträge und gesetzlicher Pflichten.</p>
      </section>
      <section>
        <h2>6. Automatisierte Verarbeitung</h2>
        <p>KI-Systeme unterstützen die Erstellung von Entwürfen. Sie treffen keine alleinige Entscheidung mit rechtlich erheblicher Wirkung. Individuelle 3D-Produkte werden vor der Produktion technisch geprüft. KI-Ergebnisse können fehlerhaft oder nicht einzigartig sein.</p>
      </section>
      <section>
        <h2>7. Deine Rechte</h2>
        <p>Im Rahmen des anwendbaren Datenschutzrechts kannst du insbesondere Auskunft, Berichtigung, Herausgabe oder Löschung deiner Daten verlangen und einer Verarbeitung widersprechen. Eine erteilte Einwilligung kann für die Zukunft widerrufen werden. Zur Identitätsprüfung können wir zusätzliche Angaben verlangen.</p>
      </section>
      <section>
        <h2>8. Cookies und Messung</h2>
        <p>Die aktuelle Version verwendet technisch notwendige Funktionen für Anmeldung, Konto, Warenkorb und Sicherheit. Marketing- oder Werbetracking ist derzeit nicht aktiviert. Wird dies später geändert, aktualisieren wir diese Erklärung und holen erforderliche Einwilligungen ein.</p>
      </section>
      <section>
        <h2>9. Stand und Änderungen</h2>
        <p>Stand: 19. August 2026. Wir passen diese Erklärung an, wenn sich Funktionen, Dienstleister oder gesetzliche Anforderungen ändern. Die jeweils aktuelle Fassung wird hier veröffentlicht.</p>
      </section>
    </LegalShell>
  );
}
