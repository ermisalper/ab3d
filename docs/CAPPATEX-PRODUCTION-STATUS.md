# CAPPATEX: geprüfter Arbeitsstand, 09.10.2026

Ausschliesslich AB3D unter C:\Users\berk1\OneDrive\Desktop\ab3d; GitHub ermisalper/ab3d, Branch codex/cappatex-production. Das Abnahmekriterium ist **noch nicht erfüllt**. Dieser Stand ist keine Verkaufsfreigabe.

## Tatsächlich geprüft

Am 08.10. über Shopify und die eingebettete Printify-App:

- Shopify 1hagfh-b0.myshopify.com, Printify-Shop CAPPATEX 23104859. Der Zugang über Shopify funktioniert.
- Printify „My Products“ zeigt keine gespeicherten Produkte. Die sechs vorhandenen Shopify-Artikel mit fertigen Motiven bleiben als normale Kollektion erhalten; sie sind keine geprüften Blanko-Vorlagen.
- Printify: reguläre und personalisierte Aufträge Manual; automatische Freigabe akzeptierter Personalisierungen, Überspringen der Importprüfung und Routing aus. Das automatische Upgrade zu Printify Choice wurde ausgeschaltet und gespeichert.
- Shopify führt bezahlte Positionen nicht automatisch aus. Zahlungsmethoden wurden nicht verändert.
- Shopify-Plan **Pause and Build**, daher Checkout deaktiviert. Schweiz als Markt aktiv, Liechtenstein Entwurf. Im allgemeinen Versandprofil fehlt ein Tarif für die LI-Zone. Bestehende Printify-Versandprofile belegen keinen Versand für neue Blanko-Produkte.
- Bisherige Site bleibt private Version 35. Keine Veröffentlichung dieser Änderungen, keine Produktionsmigration. Generierung, Fulfillment und automatische Produktion bleiben deaktiviert; neuer Checkout-Schalter standardmässig aus.

### Erster Kandidat – noch nicht freigegeben

Gildan 64000, Blueprint 145, OPT OnDemand 30, DTG. Im Editor Frontansicht L: **4200 × 4800 px bei 300 DPI**. Printify weist auf Verkleinerung für kleinere Grössen hin. Masse nicht auf andere Varianten übertragen.

Anbieterübersicht: 110 Varianten, davon 7 nicht verfügbar. Region „Northern Europe/EFTA“: 5–15 Werktage, USD 8.49 erster Artikel plus USD 1.19 je weiterer Artikel. Das belegt noch keine konkreten CH-/LI-Varianten. Echte Varianten-IDs, dauerhafte Blanko-Fotos, Druckrechtecke und genaue Länderprofile fehlen.

Printify verlangt eine Datei zum Speichern. Vollständig transparente Vorlage ohne Motiv: outputs/cappatex-blank-4200x4800.png. Der Browser-Dateidialog liess sich nicht bedienen; der Betreiber wurde um Upload unter „Upload → My device“ im bestehenden Editor gebeten. Kein Produkt gespeichert oder veröffentlicht.

## Implementierung

- Normale Shopify-Kollektion: cappatex. Individuelle Blankos: cappatex-selbst-gestalten plus explizite Freigabe in app/cappatex-profiles.ts. **Diese Freigabeliste ist leer.**
- Druckprofile enthalten Shop-/Produkt-/Anbieter-/Varianten-IDs, eindeutige SKU, Optionen, Verfahren, Druckfläche in Pixel/mm, DPI, Skalierung, echtes Fotorechteck, CH-/LI-Versandnachweis und Ablaufdatum. Katalog und Checkout prüfen aktuelle Anbieter- und Shopify-Daten erneut. Fehlende, mehrdeutige, abgelaufene oder widersprüchliche Angaben sperren das Produkt.
- REST_OF_THE_WORLD wird nicht ohne ausdrücklichen Ländernachweis zu CH/LI umgedeutet. Für spätere Unterstützung sind Anbieterbeschränkungen und konkrete Länderauflösung zu belegen.
- Ein OpenAI-Aufruf erzeugt das Original-PNG im gewählten Format. Originalbytes und SHA-256 bleiben gespeichert. Die Vorschau wird deterministisch auf ein Viertel jeder Kantenlänge verkleinert, alpha-korrekt. Keine weitere Motivgenerierung nach Zahlung. Druck-DPI und Geometrie verwenden Originalabmessungen. HD-Download prüft die bestehende Abo-Berechtigung.
- Auswahl von Produkt/Farbe/Grösse, Menge/Land, Position und Skalierung mit Auflösungswarnung. Zustimmung/Checkout erst nach geladenem Foto und Motiv und gültiger Geometrie. Unterstützt werden geometrisch geprüfte flache Fotorechtecke; gekrümmte Tassen-/Glasvorschauen sind noch offen.
- Vor jedem Warenkorb wird ein unveränderlicher Snapshot von Datei/Hash, Profil, Variante, Preis, Menge, Land, Platzierung und Zustimmung gespeichert. Weitere Warenkörbe überschreiben keinen früheren Snapshot.

## Einziger Weg für individuelle Artikel: AB3D → Printify API

Die Shopify-Blanko-Varianten müssen vor Freigabe vom nativen Printify-Import entkoppelt sein. Noch nicht durchgeführt, weil keine Blankos eingerichtet sind. Die bestehende fertige Kollektion wird nicht umgestellt. Shopify-Fulfillment-Requests dürfen die manuelle Prüfung nicht umgehen.

orders/paid prüft HMAC über rohe Bytes, Shop, Thema, Zahlung, Snapshot und Übereinstimmung von Kunde, Land, Menge, Preis, SKU und IDs. Ein Snapshot darf nur einmal konsumiert werden.

D1-Zustände: pending → preparing → creating → draft_ready. Atomarer Claim; keine automatische Wiederholung nach unklarem Ergebnis. external_id wird nicht als Idempotenzgarantie von Printify behandelt. Kein Aufruf zur Produktionsfreigabe.

Die Vorbereitung lädt das unveränderte Original-PNG hoch, bindet dessen Bild-ID an einen eigenen unveröffentlichten Produktentwurf pro Snapshot und bestellt per product_id. Upload-ID und Entwurfs-ID werden protokolliert. Keine Verwendung von Printifys preview_url als Druckdatei und keine Änderung einer gemeinsam verwendeten Vorlage pro Kunde.

**Zusätzlich erforderlich: products.write.** Die am 30.09. dokumentierten Rechte waren shops.read, products.read, uploads.write und orders.write. Die zusätzliche Berechtigung ist nicht eingerichtet/verifiziert. Ohne sie Fulfillment nicht aktivieren.

Nach unklarer Entwurfserstellung können verwaiste Entwürfe entstehen. Bei creating/manual_review Shopify-Auftrag, Snapshot, gespeicherte IDs und Printify-Auftragsliste anhand external_id manuell abgleichen. Nie blind auf pending zurücksetzen. Geänderte Bestelldaten sperren noch nicht gestartete Aufträge und hinterlassen einen Konfliktvermerk.

## Schlüssel und Produktionsvoraussetzungen

- OpenAI-Schlüssel erst nach **tatsächlich genehmigter separater Speicherortfreigabe** erstellt, ausschliesslich als OPENAI_API_KEY in der ignorierten AB3D-.env.local gespeichert. Frühere „not approved“-Antworten nicht umgangen. Keine echte Bildgenerierung ausgeführt.
- Produktions-OPENAI_API_KEY fehlt. Die verfügbaren Sites-Werkzeuge bieten keinen belegten Import aus der lokalen Secret-Datei; der Schlüssel wurde nicht für den Transfer im Chat/Tool-Ausgaben offengelegt. Sicheren Secret-Eingabekanal bereitstellen; niemals Schlüssel im Chat anfordern.
- SHOPIFY_WEBHOOK_SECRET und tatsächliche Registrierung des orders/paid-Webhooks noch offen. Storefront-Token optional; sein Vorhandensein allein beweist keinen funktionierenden Checkout.
- R2 BUCKET und D1-Migrationen 0005–0008 vorbereitet, nicht produktiv angewandt. Migration 0006 erhält bei alten unklaren Generierungen eine Sperre pro Konto; zusätzliche Altversuche erhalten generation_legacy_review. Vor neuen kostenpflichtigen Aufrufen abgleichen.

## Kostenfreie Validierung

- TypeScript, Lint, Produktionsbuild erfolgreich. Build enthält bestehende Hinweise zu Bundlegrösse/Routenklassifikation.
- 36 automatisierte Tests: SKU-Ambiguitäten, Auflösung/Clipping, Profile, HMAC, Manipulation bezahlter Positionen, Tokenreservierung/Rückerstattung, Altdatenmigration, konkurrierende Webhooks, unklare API-Ergebnisse, Snapshot-Isolation und Originalbildbindung.
- PNG-Tests: unveränderte Originalbytes, Seitenverhältnis, transparente Kanten, deterministische Ausgabe, Ablehnung ungültiger Dateien. Lokaler Cloudflare-Worker verarbeitete synthetische 2048 × 3072 px / 3.10 MB zu 512 × 768 px in 319 ms. Kein Produktionslasttest.
- Browser Desktop/390 px: Aufbau, Eingabe, Formatauswahl, echte fertige Kollektion und gesperrte Aktionen. Echte Produktvorschau, Bildgenerierung, Checkout und Fulfillment sind **nicht Ende-zu-Ende bestätigt**.

## Fortsetzung

1. Transparente Vorlage im bestehenden Printify-Editor hochladen, kleine Auswahl tatsächlicher Blanko-Varianten speichern.
2. Separate Shopify-Kollektion, SKU-/ID-Zuordnung, nativen Import-Unlink und products.write sicher einrichten.
3. Geometrie, Fotorechteck und CH-/LI-Versand je Variante belegen; Profile versionieren. LI-Markt und korrekte Versandtarife vorbereiten. Verkaufsfähiger Shopify-Plan benötigt Kostenentscheidung des Betreibers.
4. Produktions-Secrets, R2, Migrationen und Webhook sicher einrichten; Flags aus. Erst vollständigen geprüften Stand veröffentlichen, private Zielgruppe erhalten.
5. Nach gesonderter API-Kostenfreigabe eine echte Generierung im Betreiber-Pilot. Motiv und Druckplatzierung am realen Artikel vergleichen; Checkout CH/LI bis vor Kauf prüfen.
6. Testbestellung, Druckkosten und Produktion jeweils nur nach gesonderter Bestätigung. Automatische Produktion bleibt aus. Keine Verkaufsfreigabe vor Abnahme.

Referenzen: [Printify API](https://developers.printify.com/), [Shopify Pause and Build](https://help.shopify.com/de/manual/your-account/manage-orgs-and-stores/manage-pricing-plan/pause-store). Kontoangaben stammen aus der tatsächlichen Admin-Oberfläche; Kandidatendaten sind keine Verkaufsfreigabe.
