# Noch notwendige Betreiberschritte

Diese Schritte benötigen später eine Betreiberentscheidung, Anmeldung oder
gesonderte Freigabe. Sie aktivieren durch diese Dokumentation keinen Verkauf.

## 1. Browserabnahme und Kontozugang

- **Fehlt:** Aktuelle Sicht- und Bedienungsprüfung auf Desktop sowie 320/390 Pixeln und aktuelle Kontoabnahme.
- **Wo:** Gespeicherte Browserberechtigungen für die lokale Vorschau und Shopify, anschliessend bestehender Shopify-/Printify-Shop.
- **Benötigt:** Die gespeicherten Sperren ausdrücklich korrigieren und bei Bedarf im vorhandenen Konto anmelden. Keine zusätzlichen Konten oder Dienste anlegen.
- **Erfolgreich:** Beide Studios, Konto und Betreiberansichten sind ohne abgeschnittene Bedienelemente geprüft; Wiederaufnahme, Zurücknavigation und Fehlerzustände im echten Browser bestätigt. Die jetzigen DOM-Tests ersetzen diese Sichtprüfung nicht.

## 2. Spätere Migration und Bereitstellung gesondert genehmigen

- **Fehlt:** Produktionsanwendung der vorbereiteten Migration `0014_third_expediter.sql` und Bereitstellung des geprüften Entwicklungsstands.
- **Wo:** Bestehende D1-/Sites-Verwaltung, nach Prüfung des Branches `codex/cappatex-production`.
- **Benötigt:** Explizite Freigabe, Datenbanksicherung und abgestimmter Rücksetzungsweg. Vorher vorhandene Tabellen und Migrationsstand prüfen; keine SQL-Datei blind erneut ausführen.
- **Erfolgreich:** Zwei neue interne Angebotstabellen und Versionsindex vorhanden; alte Anfragen unverändert. Betreiber können Entwürfe speichern und Kunden erhalten keinen Zugriff. Neue Site-Version und zugehöriger Git-Commit sind dokumentiert. Bis dahin ist die neue Funktion nur lokal implementiert.

## 3. AB3D-Kalkulation und Fertigungsweg bestätigen

- **Fehlt:** Tatsächliche Kosten, geplanter Verkaufspreis, Fertigungsweg, Qualitätsprüfung und belastbare Lieferzusage je Anfrage.
- **Wo:** Bestehender Betreiberbereich `/betrieb`, später im bestätigten eigenen Fertigungsablauf.
- **Benötigt:** Material, Farbe, Masse, Menge, Druckzeit, alle zutreffenden einmaligen und stückbezogenen Kosten; nicht zutreffende Positionen ausdrücklich ausschliessen. Steuerliche Behandlung und betriebliche Preisregeln geschäftlich klären. Bei externer Fertigung Lieferant, Verfügbarkeit, Preis, Datenweitergabe und Übergabe separat vereinbaren. Die Garage mit sechs H2D ist lediglich ein möglicher bezahlter Dienstleister, ohne vereinbarte Preise, Verfügbarkeit, Partnerschaft oder Beteiligung.
- **Erfolgreich:** Keine ungeklärten Kosten als Null behandelt; vollständige Kalkulation und Marge überprüft; Modell auf Herstellbarkeit, Wandstärke und Masshaltigkeit geprüft. Ein interner Entwurf allein bleibt unverbindlich und erteilt keinen Auftrag.

## 4. AB3D-Angebot, Zahlung und Übergabe festlegen

- **Fehlt:** Verbindliches Kundenangebot, bestätigte vollständige Lieferadresse, Zahlungsnachweis, Versandabwicklung und dauerhafte Sicherung der tatsächlich freigegebenen Druckdatei.
- **Wo:** Bestehender AB3D-Anfrage-/Shopify-Ablauf und betriebliche Dateiablage nach gesonderter Freigabe.
- **Benötigt:** Geschäftliche Regeln zur Angebotsannahme, Zahlung, Steuern, Versand und Aufbewahrung. Eine Anbieterdatei kann ablaufen; der jetzige Prüfdownload ist keine dauerhafte Produktionsarchivierung.
- **Erfolgreich:** Anfrage, angenommener Preis, konkrete Datei, Adresse und Zahlung eindeutig zugeordnet; Fertigung erst nach gesonderter Freigabe. Kein manuelles Umbenennen einer unverbindlichen Anfrage in „bezahlt“.

## 5. CAPPATEX-Produkt-, Foto- und Etikettennachweise vervollständigen

- **Fehlt:** Erneuter Abgleich der tatsächlich verkaufbaren Varianten sowie ungeklärte Pflichtlayer und historische T-Shirt-Rückseitenfotos.
- **Wo:** Richtiger Printify-Shop über vorhandene Shopify-Verbindung; bestehende Profil- und Fotoregister, Freigabeprüfung unter `/cappatex/betrieb`.
- **Benötigt:** Eindeutige reale SKU-/Shopify-/Printify-IDs, verfügbare Varianten, Provider, exakte Front-/Back-Druckmasse und Dateivorgaben. Originalbytes und Kalibrierung der offenen Produktfotos sowie unveränderter Inhalt und Layout aller erforderlichen Etiketten nachweisen. Beim bekannten Nackenlayer fehlt der Inhalts-Hash; Bild-ID und Metadatenhash reichen nicht.
- **Erfolgreich:** Jede angebotene Seite besitzt passende Variante, Druckprofil und bestätigte Fotogeometrie. Ungeklärte Produktseiten und Pflichtlayer bleiben gesperrt; keine allgemeine Etikettenfreiheit aus fehlender Beobachtung ableiten.

## 6. Verkaufspreise und Versand CH/LI abnehmen

- **Fehlt:** Genehmigte CHF-Preise und tatsächlich bezahlbare Shopify-Versandtarife für die konkreten Produkte, Seitenkombinationen, Mengen und Warenkörbe.
- **Wo:** Shopify-Märkte, Versandprofile und Checkout; bestehende CAPPATEX-Verkaufs- und Versandfreigaberegister.
- **Benötigt:** Tatsächliche Providerkosten, zweite Druckseite/Pflichtlayer, Währungsumrechnung, Gebühren, Steuern und bestätigter Verkaufspreis. Separate Nachweise für Schweiz und Liechtenstein; Anbieterversandpreise sind keine Shopify-Checkout-Abnahme.
- **Erfolgreich:** Reale Zuordnungen und datierte Freigaben mit Gültigkeitsfrist dokumentiert; Checkout-Betrag und Tarif stimmen exakt. Keine offenen oder abgelaufenen Nachweise als freigegeben behandeln.

## 7. Shopify-Verkaufsbetrieb und Rechtstexte bestätigen

- **Fehlt:** Aktuelle Konto-, Markt-, Zahlungs- und Geschäftsabnahme für einen späteren Verkaufsstart.
- **Wo:** Bestehende Shopify-Einstellungen sowie Impressum, Datenschutz und Verkaufs-/Rückgabebedingungen beider Bereiche.
- **Benötigt:** Persönliche Geschäftsentscheidung zu Tarifwechsel aus „Pause and Build“, Zahlungsmethoden, Steuern, vollständigen Anbieterangaben und anwendbaren Kundenbedingungen. Diese Änderungen benötigen eine ausdrückliche Genehmigung.
- **Erfolgreich:** Verantwortliche Geschäftsdaten und Bedingungen bestätigt; CH-/LI-Checkout mit erlaubten Zahlungsarten nach gesonderter Testfreigabe geprüft. Ein Shopify-Upgrade allein öffnet weder Studios noch Produktion.

## 8. Einzigen Fulfillment-Weg und Webhook-Zustellung extern belegen

- **Fehlt:** Tatsächliche Schreibrechte, Trennung individueller Produkte vom nativen Printify-Import und signierte Zustellung an die private Site.
- **Wo:** Bestehender Printify-Shop, Shopify-Webhooks und Sites-Zugangsverwaltung.
- **Benötigt:** Vorhandene Berechtigungen prüfen; notwendige Erweiterungen nur später ausdrücklich freigeben. Beide `orders/paid`-Ziele (`/api/cappatex/webhooks/shopify` und `/api/token-purchases/webhooks/shopify`) korrekt einrichten. Unterstützten Zugang zur privaten Site klären, ohne den öffentlichen Zugriff zu erweitern. Der beabsichtigte individuelle Bestellweg ist ausschliesslich AB3D → Printify API; Produktionsfreigabe bleibt manuell.
- **Erfolgreich:** Signierte Zustellungen im richtigen Shop nachgewiesen; eine physische Bestellung erzeugt höchstens einen zugeordneten Printify-Entwurf, Tokenkäufe keinen. Unklare Anbieterantworten werden manuell abgeglichen, nicht automatisch wiederholt.

## 9. Digitale Tokenpakete und Rückabwicklungsregeln bestätigen

- **Fehlt:** Reale digitale Shopify-Paketvarianten, Zahlungsabnahme und bestätigte Geschäftsregeln für Erstattung/Rückbuchung.
- **Wo:** Bestehende Shopify-Produkte und `app/token-pack-releases.ts`; gesonderter Token-Zahlungsweg.
- **Benötigt:** Digitale SKUs/Varianten-IDs, Paketmengen, genehmigte CHF-Endpreise/Steuern, CH-/LI-Checkout und signierter Gutschriftnachweis. Erstattungs- und Guthabenkorrekturregeln ausdrücklich entscheiden; aktuell keine automatische Regel ergänzen.
- **Erfolgreich:** Ein bestätigter Paketkauf wird genau einmal korrekt gutgeschrieben, wiederholte Benachrichtigungen bleiben wirkungslos. Physische Bestellungen erzeugen keine Tokengutschrift. Das Register bleibt bis zur Abnahme leer und der Kauf gesperrt.

## 10. Kontrollierten Ende-zu-Ende-Test und späteren Start freigeben

- **Fehlt:** Externe Abnahme des vollständigen erlaubten Kaufwegs und physischer Druckqualität.
- **Wo:** Bestehendes privates Testsystem mit Shopify/Printify und anschliessend tatsächlicher Druckkontrolle.
- **Benötigt:** Separate Freigaben für jede kostenpflichtige KI-Generierung, Testzahlung/-bestellung, Druck und Produktion; vorher alle offenen Produkt-, Preis-, Versand-, Etiketten- und Webhook-Nachweise abschliessen. Öffentlicher Verkauf und Produktion bleiben eigenständige spätere Entscheidungen.
- **Erfolgreich:** Vorderseite, Rückseite und beide Seiten stimmen von Vorschau bis unveränderter Produktionsdatei und realem Artikel überein; Preis, Versand und eindeutige Bestellzuordnung bestätigt. Keine Sperre allein aufgrund bestandener Offline-Tests aufheben.
