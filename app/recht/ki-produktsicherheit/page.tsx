import type { Metadata } from "next";
import LegalShell from "../legal-shell";

export const metadata: Metadata = { title: "KI & Produktsicherheit | AB3D Swiss Design" };

export default function KiProduktsicherheitPage() {
  return (
    <LegalShell title="KI & Produktsicherheit" intro="Damit kreative Entwürfe zu sinnvollen, sicheren und druckbaren Produkten werden.">
      <section><h2>Verantwortung für Eingaben</h2><p>Bitte lade nur Inhalte hoch, die du verwenden darfst. Fotos erkennbarer Personen erfordern deren Einwilligung. Marken, Figuren, Kunstwerke oder Designs Dritter dürfen nur mit ausreichender Berechtigung genutzt werden. Illegale, diskriminierende, gewaltverherrlichende, sexualisierte oder gefährliche Inhalte können blockiert werden.</p></section>
      <section><h2>KI-Ergebnisse sind Entwürfe</h2><p>KI kann Formen missverstehen, Details erfinden oder technisch ungeeignete Geometrie erzeugen. Eine Vorschau ist deshalb weder eine Garantie für Einzigartigkeit noch eine Produktionsfreigabe. Vor der Fertigung prüfen wir unter anderem geschlossene Geometrie, Wandstärken, Standfläche, Teilung, Verbindung, Massstab und vorgesehenen Zweck.</p></section>
      <section><h2>Mehrteilige Produkte</h2><p>Elektronik, Kabel, Schrauben, Leuchtmittel, Magnete oder andere Zukaufteile werden nicht als Kunststoffbestandteil mitgedruckt. Der Produktplan muss gedruckte Teile, separat zu beschaffende Komponenten, Montagefolge und sichere Zugänge klar trennen. Abbildungen können Zubehör zur Veranschaulichung enthalten; der Lieferumfang wird vor Vertragsschluss bestätigt.</p></section>
      <section><h2>Lampen und elektrische Anwendungen</h2><p>3D-gedruckte Lampenkörper sind nur für den ausdrücklich bestätigten Aufbau bestimmt. Es dürfen keine offenen Flammen oder ungeprüften Netzspannungsbauteile eingesetzt werden. Vorgesehen sind geeignete, wärmebegrenzte Niedervolt-LED-Komponenten mit ausreichendem Abstand, Belüftung, Kabelführung und Zugang. Elektrische Komplettprodukte werden erst nach der erforderlichen Konformitäts- und Sicherheitsprüfung verkauft.</p></section>
      <section><h2>Materialgrenzen</h2><ul><li>PLA und ähnliche Druckkunststoffe können sich bei Wärme, direkter Sonne oder im Fahrzeug verformen.</li><li>Dekorative Vasen sind ohne ausdrückliche Versiegelung nicht als dauerhaft wasserdicht zugesichert.</li><li>Produkte sind nicht für Lebensmittelkontakt, Kinder unter drei Jahren, medizinische Zwecke, tragende Bauteile oder sicherheitskritische Anwendungen bestimmt, sofern dies nicht ausdrücklich bestätigt wird.</li><li>Kleine Teile, Magnete und bewegliche Komponenten können verschluckt werden und gehören nicht in Kinderhände.</li></ul></section>
      <section><h2>Freigabe und Nutzung</h2><p>Kundinnen und Kunden prüfen vor dem Kauf Zweck, Masse, Text, Motiv und sichtbare Platzierung. Nach Erhalt sind Montage- und Pflegehinweise einzuhalten. Bei Rissen, starker Verformung, lockeren Teilen oder übermässiger Erwärmung darf das Produkt nicht weiterverwendet werden.</p></section>
      <section><h2>Fragen vor der Bestellung</h2><p>Wenn ein Produkt eine elektrische, mechanische, tragende, lebensmittelnahe oder kindernahe Funktion haben soll, muss dies im Designplaner ausdrücklich angegeben werden. Unsichere Einsatzzwecke klären wir vor der Produktionsfreigabe über <a href="mailto:hello@ab3d.ch">hello@ab3d.ch</a>.</p></section>
    </LegalShell>
  );
}
