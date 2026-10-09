# CAPPATEX: geprüfter Arbeitsstand, 09.10.2026

Ausschliesslich AB3D unter C:\Users\berk1\OneDrive\Desktop\ab3d; GitHub ermisalper/ab3d, Branch codex/cappatex-production. Das Abnahmekriterium ist **noch nicht erfüllt**. Dieser Stand ist keine Verkaufsfreigabe.

Ausgangspunkt der Prüfung am 09.10.2026: Commit `b46cf72`, identisch mit dem geprüften Origin-Stand. Die 36 automatisierten Tests haben bestanden. Die folgenden Konto- und Anbieterprüfungen ersetzen keinen vollständigen Bestelltest.

## Tatsächlich geprüft

Am 08.10. über Shopify und die eingebettete Printify-App:

- Shopify 1hagfh-b0.myshopify.com, Printify-Shop CAPPATEX 23104859. Der Zugang über Shopify funktioniert.
- Printify „My Products“ zeigt keine gespeicherten Produkte. Die sechs vorhandenen Shopify-Artikel mit fertigen Motiven bleiben als normale Kollektion erhalten; sie sind keine geprüften Blanko-Vorlagen.
- Printify: reguläre und personalisierte Aufträge Manual; automatische Freigabe akzeptierter Personalisierungen, Überspringen der Importprüfung und Routing aus. Das automatische Upgrade zu Printify Choice wurde ausgeschaltet und gespeichert.
- Shopify führt bezahlte Positionen nicht automatisch aus. Zahlungsmethoden wurden nicht verändert.
- Shopify-Plan **Pause and Build**, daher Checkout deaktiviert. Schweiz als Markt aktiv, Liechtenstein Entwurf. Im allgemeinen Versandprofil fehlt ein Tarif für die LI-Zone. Bestehende Printify-Versandprofile belegen keinen Versand für neue Blanko-Produkte.
- Bisherige Site bleibt private Version 35. Keine Veröffentlichung dieser Änderungen, keine Produktionsmigration. Generierung, Fulfillment und automatische Produktion bleiben deaktiviert; neuer Checkout-Schalter standardmässig aus.

Am 09.10. erneut in der eingebetteten Printify-App bestätigt: Der Shopify-Shop `1hagfh-b0.myshopify.com` ist mit dem Printify-Shop **CAPPATEX, 23104859** verbunden. „My Products“ ist weiterhin leer. Es wurde kein Blanko-Produkt gespeichert oder mit Shopify synchronisiert. Die Auftrags- und Routing-Einstellungen oben stammen aus der Prüfung vom 08.10.; die folgenden Berechtigungs-, Markt- und Versandangaben wurden am 09.10. erneut geprüft.

### Berechtigungen, Märkte und Versand – Prüfung vom 09.10.

- Die Shopify-App **Printify** ist seit **28.06.2025** installiert. Die Berechtigungsmatrix zeigt **Anzeigen und Bearbeiten** für Produkte, Bestellungen, benutzerdefinierte Daten, Onlineshop und sonstige Daten. Es war keine neue Berechtigungsanforderung der App sichtbar. Diese Shopify-App-Rechte belegen nicht die Scopes des separaten Printify-API-Tokens.
- Unter Printify **Connections** ist genau ein Token mit dem Namen **AB3D CAPPATEX Production** aufgeführt. Der Schlüssel wurde nicht aufgedeckt. Im Dialog zur Token-Erstellung sind unter **Custom Scopes** sowohl `catalog.read` als auch `products.write` verfügbar. Es wurde kein Token erstellt, widerrufen oder geändert.
- Die Scopes des vorhandenen Tokens liessen sich in dieser Ansicht ohne Offenlegung nicht erneut feststellen. Die vier am 30.09. dokumentierten Scopes bleiben deshalb ein **historischer Stand**, keine aktuelle Bestätigung. Die für den heutigen Code nötige Ergänzung ist unten beschrieben.
- Im Shopify Dev Dashboard der Organisation **172925382** ist keine eigene Admin-App vorhanden; eine App-Erstellung wird angeboten. Die Anlage eines Produkts über die normale Shopify-Admin-Oberfläche benötigt keine eigene Admin-App. Es wurde keine App erstellt.
- Der Shopify-Tarif ist weiterhin **Pause and Build**. Der Markt **Schweiz** ist aktiv, **Liechtenstein** bleibt im Entwurf. Im allgemeinen Versandprofil besitzt die LI-Zone keinen Tarif.
- Es sind fünf vorhandene Printify-Versandprofile sichtbar, darunter **kein Profil für OPT OnDemand / Provider 30**. Die Schweizer Standardversandstaffel reicht von **CHF 0 bis CHF 9**. Diese bestehenden Tarife belegen noch keine korrekte Abdeckung oder Kalkulation für die neuen Blanko-Artikel; konkrete Blanko-Versandtarife sind weiterhin offen.

### Erster Kandidat – noch nicht freigegeben

Am 09.10. geprüft: **Gildan 64000**, Blueprint **145**, Anbieter **OPT OnDemand**, Provider-ID **30**, Druckverfahren **DTG**. Die Anbieterübersicht nennt Standorte in Tschechien und Deutschland sowie eine Bewertung von **9,3**.

Die Übersicht zeigt **18 Farben und 110 Varianten**. Sieben Varianten der Farbe **Sand** sind ausverkauft. Für **White** waren folgende Varianten als verfügbar ausgewiesen:

| Farbe | Grössen | Angezeigter Printify-Preis je Artikel | Verfügbarkeit |
| --- | --- | --- | --- |
| White | S, M, L, XL, 2XL | USD 8.90 | Alle verfügbar |
| White | 3XL, 4XL | USD 9.93 | Beide verfügbar |

Dies sind die angezeigten Anbieterpreise zum Prüfzeitpunkt, keine festgelegten Shopify-Verkaufspreise. Echte Varianten-IDs und die endgültige SKU-Zuordnung wurden noch nicht erfasst.

Im Editor ist die Frontfläche mit Referenzgrösse **L: 4200 × 4800 px bei 300 DPI** belegt. Laut Editor wird der Druck für kleinere Grössen herunterskaliert und für grössere Grössen nicht vergrössert. Daraus folgt keine identische Druckfläche für alle Varianten; jede freizugebende Variante benötigt ihre eigene bestätigte Geometrie.

Die Versandübersicht zeigt für **„Northern Europe/EFTA“**: **USD 8.49** für den ersten Artikel, **USD 1.19** je weiteren Artikel und **5–15 Werktage**. Die [offizielle Versandtabelle von OPT OnDemand bei Printify](https://printify.com/shipping-rates/opt-ondemand/) führt die **Schweiz und Liechtenstein ausdrücklich** auf. Dieser Ländernachweis ersetzt noch nicht die Prüfung des konkreten Varianten-/Versandprofils über die API oder die Shopify-Versandkonfiguration. Dauerhafte Blanko-Fotos, vermessene Druckrechtecke und konkrete API-Varianten-/Länderprofile fehlen weiterhin.

Printify verlangt eine Datei zum Speichern. Die vollständig transparente Vorlage ohne Motiv liegt unter `outputs/cappatex-blank-4200x4800.png`. Der Uploadversuch über **„Upload → My device“** in der eingebetteten Shopify-App endete nach zehn Sekunden mit einem File-Chooser-Timeout. Der Betreiber wurde deshalb um den Upload dieser Datei im bestehenden Editor gebeten. Es liegt kein bestätigter Upload und kein gespeichertes Produkt vor; Produkt-ID, Varianten-IDs und Shopify-Synchronisierung wurden nicht angenommen oder ergänzt. Die Profilfreigabeliste bleibt leer.

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

**Zusätzlich zum historischen Tokenstand erforderlich: `catalog.read` und `products.write`.** Am 30.09. waren `shops.read`, `products.read`, `uploads.write` und `orders.write` dokumentiert. Der aktuelle Code liest Anbieter-Varianten und Versanddaten über die Katalog-API und erstellt unveröffentlichte Produktentwürfe. Nach den heute geprüften [offiziellen Scope-Beschreibungen](https://developers.printify.com/#access-scopes) benötigt er dafür zusätzlich `catalog.read` beziehungsweise `products.write`.

Die minimale Scope-Auswahl für den aktuellen Ablauf ist damit: **`shops.read`, `catalog.read`, `products.read`, `products.write`, `uploads.write`, `orders.write`**. Ob der bestehende Token diese sechs Rechte tatsächlich besitzt, wurde nicht neu bestätigt. Vor Aktivierung sicher prüfen beziehungsweise gezielt konfigurieren; derzeit bleibt Fulfillment aus. `orders.read` wäre zusätzlich für eine spätere API-gestützte Auftragsabstimmung sinnvoll, wird aber vom aktuellen Code nicht benötigt, da er keine Printify-Aufträge per GET abruft. Ein Token wurde bei dieser Prüfung weder neu angelegt noch umgestellt.

Die [offizielle Printify-Anleitung zur Token-Erstellung](https://help.printify.com/hc/en-us/articles/4483626447249-How-can-I-generate-an-API-token) beschreibt die Verwaltung unter Connections. Ein künftig neu erstellter Token darf ausschliesslich über einen sicheren Secret-Eingabekanal hinterlegt werden; Schlüsselwerte gehören weder in diesen Nachweis noch in Git oder Chat-Ausgaben.

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
2. Separate Shopify-Kollektion, SKU-/ID-Zuordnung und nativen Import-Unlink einrichten. Die sechs erforderlichen Printify-Scopes einschliesslich `catalog.read` und `products.write` sicher bestätigen beziehungsweise konfigurieren.
3. Geometrie, Fotorechteck und CH-/LI-Versand je Variante belegen; Profile versionieren. LI-Markt und korrekte Versandtarife vorbereiten. Verkaufsfähiger Shopify-Plan benötigt Kostenentscheidung des Betreibers.
4. Produktions-Secrets, R2, Migrationen und Webhook sicher einrichten; Flags aus. Erst vollständigen geprüften Stand veröffentlichen, private Zielgruppe erhalten.
5. Nach gesonderter API-Kostenfreigabe eine echte Generierung im Betreiber-Pilot. Motiv und Druckplatzierung am realen Artikel vergleichen; Checkout CH/LI bis vor Kauf prüfen.
6. Testbestellung, Druckkosten und Produktion jeweils nur nach gesonderter Bestätigung. Automatische Produktion bleibt aus. Keine Verkaufsfreigabe vor Abnahme.

Referenzen: [Printify API](https://developers.printify.com/), [OPT OnDemand: offizielle Versandtabelle](https://printify.com/shipping-rates/opt-ondemand/), [Shopify Pause and Build](https://help.shopify.com/de/manual/your-account/manage-orgs-and-stores/manage-pricing-plan/pause-store). Konto-, Preis-, Verfügbarkeits- und Editorangaben stammen aus der tatsächlichen Admin-Oberfläche zum jeweils genannten Prüfdatum; Kandidatendaten sind keine Verkaufsfreigabe.
