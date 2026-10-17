# Konzept: gemeinsam gespeicherte Vorder- und Rückseite

Stand: 17.10.2026. Umsetzungsschritt 1, ausschließlich AB3D / codex/cappatex-production.

## Ziel und Abgrenzung

Ein angemeldeter Pilotbetreiber kann eine verfügbare Blanko-Variante mit Front, Back oder beiden Seiten ausdrücklich zusammenstellen, die Seiten unabhängig mit demselben oder unterschiedlichen vorhandenen Motiven und Positionen belegen und einen unveränderlichen Stand speichern. Dabei entstehen echte transparente PNG-Druckdateien in den geprüften Providermaßen. Speichern löst weder Shopify-Warenkorb, Printify-Upload/Produkt/Bestellung noch KI-Generierung aus. Preise, mehrseitige Verkaufstarife, Checkout und Produktionsfreigabe sind eigene Folgeschritte und bleiben gesperrt.

## Bestehender Stand

Version 46 hat getrennte URL-Platzierungen, aber nur ein aktives Motiv. CheckoutSnapshot und Printify-Draft behandeln eine einzelne Datei und Position. Private Designprofile sind ausdrücklich nicht die leere Produktionsfreigabeliste. Diese Trennung bleibt erhalten. Bestehende einseitige Snapshots und Tests behalten ihren Vertrag.

## Bedienung

Unter der aktuellen Gestaltungsansicht wird „Druckseiten zusammenstellen“ ergänzt. Der Benutzer übernimmt die gerade sichtbare Seite ausdrücklich; bloßes Ansehen einer Rückseite fügt keinen Druck hinzu. Die Übernahme kopiert Motiv-ID, Maße, Position und geprüfte Seitenzuordnung. Danach kann auf der anderen Seite ein anderes bestehendes/generiertes/hochgeladenes Motiv übernommen werden, ohne die erste Seite zu verändern. Eine Zusammenstellung gilt genau für Produkt, Profilversion und Shopify-Variante; beim Variantenwechsel wird sie neu begonnen. Ausgewählte Seiten sind einzeln entfernbar. Eine Zusammenfassung zeigt die übernommenen Motive und Positionen; Speichern validiert alle Seiten gemeinsam. Ein gespeicherter Stand hat einen eigenen Link und getrennte Downloads. Änderungen am Designer verändern ihn nicht.

## Datenvertrag Version 2

Neue Tabelle cappatex_preparations: ID, Eigentümer, Idempotenzschlüssel, Request-Hash, Status preparing/ready/failed, unveränderliches payload_json und dessen SHA-256, Erstellungszeit. Eindeutiger Schlüssel (Eigentümer, Idempotenzschlüssel) und höchstens ein laufender Auftrag pro Eigentümer.

Payload: schemaVersion=2, rendererVersion, ID, Profil-ID/-Version, Produkt-/Provider-/Shop-IDs, gewählte Variante/SKU/Farbe/Größe, Menge, Zielland, Erstellungszeit und ein geordnetes Array mit 1–2 Seiten. Je Seite: front/back, Design-ID, Quelle (R2-Key, SHA-256, Pixelmaße), geprüfte Druckfläche und Mockup, normierte Platzierung, effektive Druckmaße/DPI sowie fertige PNG (R2-Key, SHA-256, Druckflächen-Pixelmaße). Kein ungeprüfter Client-Dateipfad, Preis, Provider oder Bild-URL wird übernommen.

## Serverablauf

POST /api/cappatex/preparations: Same-Origin, Anmeldung und vorhandene Betreiber-Allowlist prüfen; Eingabe begrenzen und streng validieren (maximal zwei eindeutige Seiten, endliche Zahlen, ganzzahlige Menge 1–5, CH/LI). Alle Seiten gehören zur selben live geprüften Variante. Providerabgleich erfolgt lesend durch den bestehenden Designkatalog. Jede Design-ID muss dem Konto gehören und preview_ready sein. Originaldatei muss zur gespeicherten Prüfsumme und Größe passen. Druckprofil, Begrenzung und Mindest-DPI gelten je Seite. Ein ungültiger Teil verhindert die gesamte Freigabe.

Vor dem Rendering wird atomar reserviert (maximal 20 Versuche/Tag). Gleicher Schlüssel und gleiche Eingabe liefert denselben gespeicherten Stand; abweichende Eingabe mit gleichem Schlüssel wird abgelehnt. Gleichzeitige Reservierungen können keinen zweiten Renderer starten. Bei unklarem Ausgang wird nicht still erneut begonnen. Erst nach Speicherung aller Dateien wird der Datensatz ready. Teilweise erzeugte Dateien verleihen keinen Download-/Bestellzugriff.

GET /api/cappatex/preparations/[id]: nur eigener Datensatz, ready und intakter Payload-Hash. Gibt eine sichere Zusammenfassung und eigene Download-Links zurück, niemals R2-Schlüssel oder E-Mail. PNG-Download prüft Eigentümer, vorhandene Original-Downloadberechtigung bei KI-Motiven und Datei-Hash. Keine öffentlichen R2-URLs. Bestehende Plangrenzen werden nicht über die neuen Downloads umgangen.

## Deterministische Druckdatei

Pro Seite entsteht eine RGBA-PNG mit transparentem Hintergrund und exakt der Providerbreite/-höhe. Motiv aus dem geprüften Original, keine KI-Neugenerierung, kein unerwartetes Zuschneiden oder Hintergrund. Normierte Breite und Mittelpunkt werden auf Pixelkoordinaten abgebildet; Rasterrundung höchstens ein Pixel je Kante. Verkleinerung mit Alpha-gewichteter Flächenmittelung, kein Hochskalieren bei unzureichender Auflösung. Druckauflösung/Geometrie wird vor dem Rendering geprüft. 300-dpi-Metadaten bei den derzeitigen 300-dpi-Profilen.

Worker-Speicherlimit 128 MB: große Druckflächen werden zeilenweise in einen PNG/Deflate-Stream geschrieben, niemals als vollständiges RGBA-Zielbild reserviert. Quellen behalten die bestehenden 6,29-Megapixel-/12-MB-Grenzen; Zielgrenze 40 Megapixel/10000 px je Kante, komprimierte Datei höchstens 16 MB. Beide Seiten werden nacheinander verarbeitet.

## Spätere Übergabe und Kompatibilität

Ein reiner, getesteter Adapter erzeugt aus dem V2-Stand und explizit zugeordneten Printify-Upload-IDs genau die ausgewählten Platzhalter. Vollflächen-PNGs werden mit x=0.5/y=0.5/scale=1/angle=0 eingefügt; keine doppelte Platzierung. Die Antwortprüfung verlangt exakt diese Seiten, Druckmethoden und Bilder und lehnt Zusatzflächen/-layer ab. Dieser Adapter ist vorbereitet, aber nicht im aktiven Paid-Webhook eingeschaltet. V2-Eingaben am alten Checkout werden ausdrücklich abgelehnt, damit eine Rückseite niemals stillschweigend verloren geht. Produktionsregister, globale Freigabeschalter und vorhandene Idempotenz bleiben unverändert.

## Abnahmetests

- Front allein, Back allein, beide mit demselben und unterschiedlichen Motiven; unterschiedliche Druckflächen.
- Transparente Ränder, Pixelposition, Skalierung, Alpha/Farbe, volle PNG-Maße, deterministische Prüfsummen und DPI.
- Ungültige Position/Auflösung, doppelte/unerlaubte Seiten, falsche Variante/Profilversion, fremdes oder verändertes Original: keine Freigabe.
- Doppelclick/Wiederholung und parallele Speicherung: eine ID/ein Renderlauf; geänderter Request-Schlüsselkonflikt.
- Zweite Seite oder Dateispeicherung schlägt fehl: kein ready und kein teilweiser Download.
- Eigentümerzugriff, Hashprüfung und Original-Downloadberechtigung.
- Adapter: genau front/back, keine Vertauschung oder doppelte Skalierung; bestehende Legacytests bleiben grün.
- Gesamte Testsuite, TypeScript, Lint, Build; Browserprüfung mit vorhandenem Motiv ohne kostenpflichtige API-Aufrufe. Privat veröffentlichen, GitHub sichern, Verkaufsgrenzen dokumentieren.

## Umsetzungsnachweis

17.10.2026: Datenvertrag, Migration 0009, gemeinsamer Speicher-Endpunkt, authentifizierte Prüfansicht `/cappatex/vorbereitung/[id]`, geprüfte PNG-Downloads, Designer-Zusammenstellung und reiner Printify-Adapter implementiert. Bei unklarem Server-/Netzwerkausgang verwendet die Oberfläche denselben Idempotenzschlüssel weiter; nur ein bestätigter Fehlversuch erlaubt eine neue Reservierung.

179 Tests bestehen, einschliesslich 26 neuer Tests zu mehrseitiger Speicherung und Rastererzeugung. TypeScript, Lint und Produktions-Build bestanden. Grosser Test mit 4606 × 5787 Pixeln und synthetischem 2048²-Motiv: 1148 ms lokal, PNG 122887 Byte; keine Aussage über identische Serverlaufzeit oder komprimierte Grösse bei fotografischen Motiven. Lokale Seite HTTP 200 und allgemeine Oberfläche geprüft; der angemeldete Speicherablauf wird zusätzlich im privaten Hosting geprüft. Die Produktionsfreigabeliste bleibt leer. Der Adapter erzeugt noch keinen externen Auftrag; Preisberechnung für beide Druckseiten und Anschluss an den bezahlten Bestellweg sind ausdrücklich der nächste Schritt.

Im ersten privaten Browsertest wurde ein älteres KI-Original wegen seines caBX-Herkunftsblocks abgelehnt. Korrigiert: nur bei serverseitig als generiert bekannten Originalen ist dieser nicht bildverändernde Block zugelassen, inklusive CRC-Prüfung. Das Original bleibt unverändert gespeichert. Unbekannte Farbprofile, Animation und Upload-Metadaten bleiben gesperrt. Regressionstest prüft identische Druckpixel und Ablehnung beschädigter Herkunftsdaten. Die echte Originaldatei CPX-A3EBF595EF42 wurde lokal erfolgreich zu einer 3461 × 3955-PNG gerendert (476 ms, 1608315 Byte); keine neue KI-Anfrage.
