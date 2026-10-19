# Verkaufsvorbereitung für AB3D und CAPPATEX

Stand 17.10.2026. Ausschliesslich `ermisalper/ab3d`, Branch `codex/cappatex-production`. Die Site bleibt owner-private. Dieser Schritt ist keine Verkaufsfreigabe.

Neueste Ergänzung: [Private Produktgestaltungen wiederfinden und fortsetzen](CAPPATEX-SAVED-GESTALTUNGEN.md), einschliesslich Vorder-/Rückseiten-Kopien und abgesicherter Tab-Wiederherstellung.

## Persönlicher Kontakt · 19.10.2026

Auf ausdrücklichen Wunsch des Betreibers sind `/kontakt` für AB3D und `/cappatex/kontakt` für CAPPATEX ergänzt. Beide Bereiche haben einen ständig sichtbaren Kontaktlink in der Kopfzeile und einen passenden Footerlink. Die Kontaktseiten benötigen keine zusätzliche Anmeldung. CAPPATEX bietet ausserdem einen Link zur persönlichen Designhilfe in einem neuen Tab, damit der aktuelle Entwurf offen bleibt.

WhatsApp nutzt `https://wa.me/41788206684` mit einem statischen bereichsspezifischen Nachrichtentwurf. Die angegebene Schweizer Nummer `0788206684` wird als `+41 78 820 66 84` angezeigt. E-Mail nutzt `berk_ermis@icloud.com` mit einem statischen passenden Betreff. Es gibt keine Kontakt-API, Formdatenspeicherung, WhatsApp-SDK, Tracking-Einbettung, automatische Nachricht oder automatische Übernahme von Motiven, Kontodaten und Bestellreferenzen. Besucher wählen ihren Kanal und senden selbst.

Die frühere Kontaktadresse wurde in Footer, Impressum, Service-/Rechtstexten und Assistant-Hinweisen ersetzt. Im Impressum ist WhatsApp statt des bisherigen Telefon-Platzhalters angegeben. Geschäftsadresse, Rechtsform und übrige offene Betreiberangaben bleiben ausdrücklich offen; keine rechtlichen Regeln, Zahlungen, Kontoabos oder Verkaufs-/Produktionsfreigaben wurden verändert.

Browserabnahme lokal: beide echten Kontaktseiten HTTP200; richtige Bereichslinks, Nummer und Mail-Betreff; 48px Kontaktbuttons und Kopfzeilenkontakt bei 320px ohne horizontalen Überlauf. Der echte AB3D-Header wurde einschliesslich Warenkorb bei 320px geprüft. Für schmale Geräte steht die Bereichskennung in einer zweiten Zeile. Eine zusätzlich bestätigte Überlappung der Desktop-Bereichswahl mit Kontakt/Konto/Warenkorb bei 901px ist durch kompaktere Kopfzeilenspalten und einen Warenkorb ohne Textlabel in dieser Breite behoben; beide Bereiche bleiben sichtbar.

Das WhatsApp-Ziel wurde im Browser geöffnet und zeigte exakt die angegebene Nummer sowie den erwarteten AB3D-Entwurf. Kein App-Login, Versand einer Testnachricht oder Zustelltest. Die E-Mail-Verknüpfung wurde als `mailto:` mit Adresse und Bereichsbetreff geprüft; kein E-Mail-Versand. Die Kontaktdaten wurden vom Betreiber bereitgestellt, nicht aus Konto- oder Anbieterzugängen übernommen.

510/510 vorhandene Tests, Typprüfung und vollständiges ESLint erfolgreich. Der bestehende isolierte Assistant-Test lädt die neuen Kontaktdaten aus dem tatsächlichen reinen Modul; seine Kosten-/Anmeldegates bleiben unverändert geprüft. Keine neuen Tests für reine Link-/Textdarstellung. Die abschliessende private Bereitstellung und Live-Abnahme werden nachfolgend dokumentiert.

### Private Bereitstellung und Live-Abnahme · Version 61

Version **61** ist seit 19.10.2026, 17:09 UTC erfolgreich privat bereitgestellt. Anwendungscode `6301adf841bb7b9d43f074f9cc6da34421f655f6` stimmt auf GitHub und in der gespeicherten Site-Version überein. Deployment `appgdep_6ad64e997c7081919b6542f97190d62c`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_c458f3ba62f08191a75a4cbae7d378f9`, Status `succeeded`, Umgebungsrevision unverändert **11**. Keine Änderung des Betreiberzugriffs oder der Verkaufsfreigaben. Die zuvor ebenfalls privat bereitgestellte Version60 wurde durch diese Kontakt-Navigationskorrektur ersetzt.

Kontakt-Einstiegspunkte verwenden normale HTML-Navigation; der Designer-Hilfelink öffnet einen neuen Tab. Die automatisierte Aktivierung interner Kontaktlinks liess sich im eingebauten Browser nicht zuverlässig bestätigen, auch nach frischer Tab-Bindung und Tastaturprüfung. Direkte Navigation zu beiden tatsächlichen URLs funktionierte. Es wurden keine entsprechenden Hosting-Fehler gemeldet. Das ist eine dokumentierte Grenze der interaktiven Abnahme, keine bestätigte Zustell- oder Ende-zu-Ende-Kommunikationsprüfung.

Live nachgewiesen: beide Kontaktseiten laden mit korrekter Bereichszuordnung, Telefonnummer, statischem WhatsApp-Entwurf, E-Mail-Adresse und Bereichsbetreff. Bei 320px liegen Kopfzeilenkontakt und beide 48px-Buttons innerhalb der Ansicht; kein horizontaler Überlauf. WhatsApp selbst zeigte die richtige Nummer und den AB3D-Entwurf. Kein Login in WhatsApp, App-Start, Nachrichten- oder E-Mail-Versand. Temporäre WhatsApp-/Prüftabs wurden geschlossen, der lokale Devserver beendet, Browserbreite zurückgesetzt. Screenshot: `outputs/contact-cappatex-v61-20261019.jpg`.

Hosting-Paket: 142 Dateien, 13.219.840 Bytes im erfassten Tar-Archiv, SHA-256 `d86f638243fa99237c04081ccb9e551623e6f5246152336239a1beac434ae699`. Quellscan über342 Dateien und Paket-Scan ohne Treffer vorhandener lokaler Secretwerte. Produktionsbuild erfolgreich. Die offizielle Paketierung scheiterte am bekannten Windows-Startfehler; das bestehende Windows-Verfahren paketierte den sauberen geprüften Commit. Erforderliche Git-/Netzwerkaktionen wurden regulär freigegeben; keine Ablehnung wurde umgangen. Dieser abschliessende Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.

Fortsetzung nach Version 54: [Preis-, Versand- und Etikettenabnahme](CAPPATEX-SALES-AND-SHIPPING-ACCEPTANCE.md). Dort stehen die neue Bindung bezahlter Versandtarife, der aktuelle Pflichtlayer-Nachweis und die sichtbaren Druckgrössengrenzen. Das nachfolgende Protokoll beschreibt den Stand der Version 54.

## Bestellkonzept

Neue CAPPATEX-Käufe beginnen beim vollständig gespeicherten Gestaltungsstand. Der Designer führt zur Druckvorbereitung und anschliessend zur Prüfansicht. Ein zweiter direkter Front-Checkout könnte eine bereits gestaltete Rückseite verlieren und wird aus der Bedienung entfernt. Historische einseitige Server-Snapshots bleiben prüfbar.

1. Vorderseite, Rückseite oder beide werden ausdrücklich übernommen. Jede Seite behält Motiv, Platzierung und eigene Druckfläche. Der Renderer speichert je eine transparente PNG in geprüften Providerabmessungen; der gemeinsame Stand bleibt unveränderlich und kontogebunden.
2. Ein ausdrücklich freigegebenes `preparedCheckout`-Angebot nennt Variante, genaue erlaubte Seitenkombinationen, CHF-Stückpreis und Renderer. Der Preis muss dem tatsächlichen Shopify-Preis entsprechen. Unterschiedliche Seitenpreise benötigen später passende, eindeutig zugeordnete Shopify-Varianten. Keine erfundenen Aufschläge oder versteckten Warenkorbpositionen.
3. Nur bei vollständiger Serverfreigabe erscheint der Shopify-Button. Die neue Eingabe enthält ausschliesslich `preparationId` und AGB-/Datenschutzbestätigung. Browserpreise und neue Motive/Positionen werden nicht übernommen. Geprüft werden Eigentümer, Renderer, aktuelle Zuordnungen, Seitengeometrie, Verfügbarkeit sowie Hashes/Pixelmasse der fertigen Dateien.
4. Schema-2-Bestellsnapshots enthalten den vollständigen vorbereiteten Stand und dessen SHA-256. Warenkorb und bezahlte Position müssen Snapshot-ID, Vorbereitung-ID und Vorbereitung-Prüfsumme unverändert übernehmen. Preis, Währung, Menge, Zielland, SKU und Eigentümer bleiben Prüfbedingungen.
5. Genau ein Fulfillment-Weg ist vorgesehen: AB3D erstellt per Printify-API einen unveröffentlichten individuellen Produktentwurf und einen manuell freizugebenden Auftrag. Vorher muss die Trennung dieser Blankos vom nativen Printify-Shopify-Import nachgewiesen werden. Das Verkaufsregister bleibt bis dahin leer.
6. Schema 2 überträgt ausschliesslich die bereits gespeicherten fertigen PNGs. Kein Rendering oder KI-Eingriff nach Zahlung. Vollflächen-PNGs liegen bei Printify mittig mit Skalierung 1; keine doppelte Platzierung. Die Antwort muss exakt die erwarteten Seiten und Upload-IDs enthalten. Ungeprüfte Zusatzebenen, etwa Pflichtetiketten, bleiben ein Sperrgrund.
7. Atomare Reservierung, eindeutige Snapshot-Zuordnung und bestehende Zustandsübergänge verhindern doppelte Auftragsanlage. Unklare Printify-Antworten werden nicht automatisch wiederholt. Die geschützte Übersicht `/cappatex/betrieb` zeigt manuelle/festhängende Prüffälle ohne Wiederholungs- oder Produktionsaktion.

## Frisch nachgewiesen

Nur lesender Printify-API-Abgleich im Shop **CAPPATEX, 23104859**, am 17.10.2026:

| Blanko | Verfügbare Varianten | Rückseiten | CH/LI-Anbieterversand erstes / weiteres Stück |
| --- | ---: | ---: | --- |
| Gildan 64000 T-Shirt | 10 | 10 | USD 8.49 / 1.19 |
| B&C King Hoodie | 26 | 26 | USD 10.89 / 2.39 |
| Bella+Canvas Tanktop | 6 | 6 | USD 7.29 / 1.99 |
| B&C WUI23 Pullover | 15 | 15 | USD 10.89 / 2.39 |
| Gildan 2400 Langarmshirt | 14 | 14 | USD 8.49 / 1.19 |
| Poster | 4 | 0 | USD 8.49 / 1.99 |

**75 Varianten, 71 Rückseiten.** Tanktop Black/M, Printify-ID `24640`, ist heute deaktiviert und fehlt beim Anbieter. Der vorhandene Gestaltungskatalog filtert diese Variante korrekt aus. Die gespeicherten 76 SKU-/Shopify-ID-Zuordnungen sind eindeutig; die übrigen Zuordnungen passen zu Anbieter, Druckfläche, Optionen und Foto. Verfügbarkeit bleibt bei jedem Kauf erneut zu prüfen.

Anbieterversand ist kein bestätigter Shopify-Checkout-Tarif. Product-GET enthält `variant.cost` in Cents ohne Währungsfeld; daraus werden weder CHF-Einkaufspreise noch Margen abgeleitet. Tassen und Handyhüllen bleiben wegen ungeprüfter Druckgeometrie/Ausschnitte ausserhalb des Registers.

Hosting-Umgebungsrevision **11**: `CAPPATEX_CHECKOUT_ENABLED=false`, `CAPPATEX_FULFILLMENT_ENABLED=false`, `CAPPATEX_AUTO_PRODUCTION_ENABLED=false`. OpenAI-, Meshy- und beide Printify-Tokens sind als Secrets konfiguriert; Werte wurden nicht ausgegeben oder geändert. **`SHOPIFY_WEBHOOK_SECRET` fehlt.** Ein produktiver Webhook ist damit nicht eingerichtet. Owner-private bleibt unverändert.

Der lokale Lesetoken hat nur `shops.read`, `catalog.read`, `products.read`. Lesen beweist keine Schreibrechte. Der Betreiber-Audit verwendet bevorzugt diesen Token und kennzeichnet Produktionsrechte als ungeprüft.

## Weitere Korrekturen

- AB3D berechnet den unverbindlichen Richtpreis serverseitig mit derselben validierten Formel wie im Studio; Clientpreise und Komplexitätswerte werden ignoriert. Neue Datensätze sind `inquiry`, keine Zahlungs-/Fertigungsaufträge. Der alte Status-Endpunkt darf sie nicht in Zahlung/Produktion überführen. Wunschhöhe ersetzt keine Herstellbarkeitsprüfung.
- Echte Streamlimits vor der Pufferung von Checkout-/Webhook-Bodies; HMAC weiterhin auf unveränderten Rohbytes.
- Papier-/Oberflächenoptionen für Poster und ähnliche Produkte werden ausdrücklich anhand des Profils in Shopify und Printify abgeglichen. Fehlende, doppelte oder falsche Optionswerte werden abgelehnt; Kleidung behält die exakte Farb-/Grössenprüfung. Dies erteilt noch keine Produktfreigabe.
- Mobile Raster, lange Speicherbuttons, Auswahlfelder und Berührungsflächen korrigiert; Bereichskennzeichnung bleibt bei 390px sichtbar. Kontonavigation kann umbrechen.
- Betreiberübersicht: Anmeldung plus Betreiber-Allowlist, GET-only, kein Cache, begrenzte Metadaten ohne Kundennamen, Adressen, Originale oder Geheimnisse.

## Noch vor Verkauf nötig

1. Freigegebene Geschäftsdaten für das Impressum und zum tatsächlichen Angebot passende Rechtstexte/Kontaktangaben. Keine erfundenen Betreiber-, Adress- oder Steuerangaben.
2. Kostenwährung, Druckseitenkosten, Steuer-/Versandbehandlung und Marge bestätigen; konkrete Shopify-Verkaufspreise und exakte Seitenangebote einrichten.
3. Printify-Pflichtetiketten/Zusatzebenen, native Importtrennung, manuelle Auftragsfreigabe und API-Schreibrechte im richtigen Shop nachweisen.
4. CH-/LI-Märkte und Versandprofile mit echten Checkout-Tarifen prüfen. Letzter UI-Nachweis vom 09.10.: Pause and Build, LI-Markt Entwurf, LI-Tarif im allgemeinen Profil fehlend. Heute nicht erneut in Shopify bestätigt.
5. Unterstützte Webhook-Zustellung an die geschützte Site und Signatur-Secret einrichten. Shopify-Signatur ersetzt nicht den Plattformzugang. Zielgruppe deshalb nicht einfach öffnen.
6. Erst nach gesonderter Zustimmung Plan/Zahlungen und kontrollierten End-to-End-Kauf prüfen. Keine echte Bestellung, Produktion, Aboänderung oder kostenpflichtige Generierung in diesem Schritt.
7. Nach erfolgreicher Abnahme Verkaufsprofile und Checkout schrittweise freigeben. Öffentliche Freigabe und automatische Produktion bleiben eigene zu genehmigende Schritte.

## Prüfprotokoll

Produktionsbuild, Typprüfung, vollständiges ESLint und **316 von 316 Tests** bestanden, ohne übersprungene Tests. Die Regressionen umfassen echte Routen mit vollständig isolierten Datenbank-/Datei-/API-Testdaten: Front, Back, beide Seiten, mehrere Positionen, exakte PNG-Bytes, Preis-/Währungs-/Attributänderungen, veränderte Dateien, Import-/Freigabesperren, parallele Wiederholung und unklare Auftragsergebnisse. Keine Testanfrage ging an eine echte Bestell-/Produktions- oder kostenpflichtige KI-API. Lokaler Quellscan ohne Treffer vorhandener Secretwerte; `.env.local` bleibt ignoriert.

Die Browsersteuerung startete in dieser Sitzung nicht (Sandbox-/Node-Initialisierungsfehler). Lokal lieferten beide Hauptseiten HTTP 200; Betreiberseite ohne Anmeldung 307 zur Anmeldung, Betreiber-API ohne Berechtigung 403. Das ersetzt keine Sichtprüfung oder echte Smartphoneprüfung.

## Private Bereitstellung

Version **54** wurde am 17.10.2026 um 15:21 UTC erfolgreich unter `https://ab3d-swiss-design.berk-ermis.chatgpt.site` bereitgestellt. Geprüfter Anwendungscode: `e1bd049ac3fa70fb001ad8f637373c5faa09442f`, sowohl auf GitHub als auch im Site-Quellarchiv bestätigt. Deployment `appgdep_6ad3924aa36c8191b47c53ef178b3b9d`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_70e0719adecc8191be3e4304c7f2ff25`; Status `succeeded`, Umgebungsrevision unverändert **11**. Owner-private blieb erhalten.

Paket: 114 Dateien, 9.349.120 Bytes, SHA-256 `7021c012bc3d65fa1eaa6c61a46bf800fa9e2871675b1a5445e4c32d8d569dc2`. Keine neue Migration. Der offizielle Quellhelfer synchronisierte den Commit; nach seinem bekannten Windows-Paketierungsstartfehler wurde mit dem vorhandenen Windows-Verfahren aus dem sauberen, geprüften HEAD gepackt. Keine Treffer der vorhandenen lokalen Schlüssel-/Token-/Secretwerte im Paket. Die neue Betreiberansicht wurde zum Öffnen in Codex vorgemerkt; die UI meldete `queued`, nicht eine bestätigte Sichtprüfung.

Dieser abschliessende Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht. Geschützter Betreiberbereich: `/cappatex/betrieb`, auch über das eigene Konto verlinkt. Kein kostenpflichtiger KI-Aufruf, Shopify-Upgrade, Zahlungswechsel, echter Kauf oder Printify-Produktionsauftrag wurde ausgelöst.
