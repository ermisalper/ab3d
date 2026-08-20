import type { Metadata } from "next";
import LegalShell from "../legal-shell";

export const metadata: Metadata = { title: "Versand & Rückgabe | AB3D Swiss Design" };

export default function VersandRueckgabePage() {
  return (
    <LegalShell title="Versand & Rückgabe" intro="Was bei Fertigung, Lieferung, Schäden und personalisierten Produkten gilt.">
      <section><h2>Liefergebiet</h2><p>Der Shopify-Checkout prüft die verfügbare Lieferung für die eingegebene Adresse. Zum Start sind Lieferungen in die Schweiz und nach Liechtenstein vorgesehen. CAPPATEX Liefermöglichkeiten hängen zusätzlich vom gewählten Produkt und Druckpartner ab.</p></section>
      <section><h2>Versandkosten</h2><p>Für AB3D Kollektionsteile zeigt der Warenkorb aktuell CHF 9 als Versandrichtwert an; ab CHF 80 Warenwert wird kostenloser Versand berechnet. Verbindlich ist der unmittelbar vor der Zahlung im Shopify-Checkout angezeigte Gesamtpreis.</p></section>
      <section><h2>Fertigungs- und Lieferzeit</h2><p>Kollektionsteile benötigen üblicherweise 5–10 Werktage für die Fertigung. Individuelle 3D-Produkte erhalten nach der Machbarkeits- und Druckprüfung einen konkreten Termin. CAPPATEX Zeiten hängen von Produkt, Druckpartner und Zieladresse ab und werden im Checkout beziehungsweise in der Bestätigung angezeigt. Bei Verzögerungen informieren wir über die hinterlegte Kontaktadresse.</p></section>
      <section><h2>Adressprüfung</h2><p>Die Kundin oder der Kunde ist für eine vollständige, zustellbare Adresse verantwortlich. Änderungen sollen vor Produktions- oder Versandfreigabe sofort mit der Bestellreferenz an <a href="mailto:hello@ab3d.ch">hello@ab3d.ch</a> gesendet werden.</p></section>
      <section><h2>Rückgabe und Meinungsänderung</h2><p>In der Schweiz besteht für Onlinekäufe grundsätzlich kein allgemeines gesetzliches Widerrufsrecht. Da AB3D Kollektionsteile auf Bestellung fertigt und individuelle sowie CAPPATEX Produkte personalisiert produziert werden, bieten wir nach Produktionsbeginn keine freiwillige Rückgabe wegen blosser Meinungsänderung an. Eine Stornierungsanfrage vor Produktionsbeginn kann an <a href="mailto:hello@ab3d.ch">hello@ab3d.ch</a> gesendet werden; sie ist erst nach unserer schriftlichen Bestätigung wirksam. Zwingende Rechte bei Mängeln, Falschlieferung oder Transportschäden bleiben bestehen.</p></section>
      <section><h2>Schaden oder Mangel melden</h2><ol><li>Bestell- oder Designreferenz bereithalten.</li><li>Gesamtprodukt, Verpackung und betroffene Stelle fotografieren.</li><li>Beschreibung und Bilder möglichst rasch an <a href="mailto:hello@ab3d.ch">hello@ab3d.ch</a> senden.</li><li>Produkt nicht ohne Rückgabeanweisung zurücksenden oder entsorgen.</li></ol><p>Wir prüfen Reparatur, Ersatz, Nachproduktion, Preisreduktion oder Rückerstattung abhängig vom konkreten Fall und den gesetzlichen Ansprüchen.</p></section>
    </LegalShell>
  );
}
