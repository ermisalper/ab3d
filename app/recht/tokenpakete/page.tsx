import type { Metadata } from "next";
import LegalShell from "../legal-shell";

export const metadata: Metadata = { title: "Design-Tokenpakete | AB3D" };

export default function TokenPackConditions() {
  return <LegalShell title="Einmalige Design-Tokenpakete" intro="Tokens für einzelne KI-Aktionen kaufen, ohne ein Creator-Abo abzuschliessen.">
    <section><h2>Dein einmaliger Kauf</h2><p>Vor dem Kauf siehst du die Anzahl der Design-Tokens, den Paketpreis in CHF und dein Rechnungsland. Das Paket ist eine einmalige Zahlung; es entsteht kein Abonnement und keine automatische Verlängerung. Der verbindliche Gesamtbetrag wird vor der Zahlung bei Shopify angezeigt.</p></section>
    <section><h2>Gutschrift nach der Zahlung</h2><p>Die Tokens werden nach bestätigter und zugeordneter Zahlung deinem angemeldeten AB3D-Konto einmalig gutgeschrieben. Ein gestarteter Checkout oder eine Rückkehr auf die Website ist keine Zahlungsbestätigung. Bei einer verzögerten oder unklaren Bestätigung wird der Kauf geprüft; wiederholte Zahlungsbenachrichtigungen erzeugen keine zusätzliche Gutschrift.</p></section>
    <section><h2>Wofür du Tokens verwendest</h2><p>Tokens werden für die jeweils freigegebenen KI- und Druckaufbereitungsaktionen verwendet. Den Tokenbedarf siehst du vor dem Start der jeweiligen Aktion. Ein Paket allein schaltet keine zusätzlichen Dateidownloads oder Abo-Leistungen frei. Die Freigaben deines Kontos gelten weiterhin.</p></section>
    <section><h2>Fragen zu einem Kauf</h2><p>Bitte nenne bei einer fehlenden Gutschrift die Shopify-Bestellreferenz und die verwendete Konto-E-Mail. Der Kaufstatus lässt sich im Konto aktualisieren. Kontaktmöglichkeiten findest du auf der Kontaktseite und im Impressum. Gesetzliche Rechte bleiben vorbehalten.</p></section>
  </LegalShell>;
}
