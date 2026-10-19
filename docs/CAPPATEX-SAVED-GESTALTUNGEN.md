# Private Produktgestaltungen wiederfinden und fortsetzen

Stand 17.10.2026. Repository `ermisalper/ab3d`, Branch `codex/cappatex-production`. Ergänzung zur [Verkaufsvorbereitung](SHOP-LAUNCH-READINESS.md) und [Versandabnahme](CAPPATEX-SALES-AND-SHIPPING-ACCEPTANCE.md). Keine Verkaufs- oder Produktionsfreigabe.

Aktuelle Fortsetzung vom 19.10.2026: siehe „Stabile Produktansichten und sichere Auswahl“ am Ende. Das ursprüngliche Protokoll zur Version 56 bleibt nachfolgend erhalten.

## Konzept

Motive und gestaltete Produkte haben unterschiedliche Aufgaben: `/cappatex/sammlung` enthält eigene Motive. `/cappatex/gestaltungen` enthält unveränderlich gespeicherte Produktstände mit Farbe, Grösse, Menge, Lieferland und den ausgewählten Druckseiten. Beide bleiben im CAPPATEX-Bereich. Die 3D-Sammlung wird nicht geändert.

Die Übersicht liest ausschliesslich fertige Stände des angemeldeten Kontos. Pro Seite werden zwölf Einträge geladen. Die Fortsetzung verwendet einen Cursor aus Zeitstempel und ID; neu gespeicherte Stände verschieben dadurch keine ältere Seite. Weder Kundendaten noch Speicherpfade oder Dateischlüssel werden ausgegeben. Jeder Eintrag wird gegen die gespeicherte Prüfsumme geprüft. Nicht lesbare Stände werden ausdrücklich gesperrt dargestellt.

Die kleinen Bilder sind als Motive gekennzeichnet. Für bis zu zwei ausgewählte Stände lädt der Vergleich die vollständigen, eigenen gespeicherten Produktansichten mit jeder Druckseite und deren Auflösung. Die Darstellung greift auf denselben Beleg wie die bestehende Prüfansicht zurück. Die Übersicht selbst löst keine Generierung, Bestellung oder Dateierstellung aus.

„Als Kopie weitergestalten“ lädt den vollständigen Stand in den Designer. Die ursprüngliche Druckvorbereitung und ihre Druckdateien bleiben unverändert. Ein neuer Stand muss erneut gespeichert und vor einem späteren Kauf geprüft werden. Aktuelle Profilversion, konkrete Variante, Druckflächen und eigene Motivquellen müssen weiterhin passen; veraltete oder nicht verfügbare Daten dürfen keine stillen Ersatzprodukte oder geänderten Positionen erzeugen.

Vorder- und Rückseite benötigen jeweils ein eigenes Motiv und eine eigene Platzierung im Arbeitszustand. Ein Seitenwechsel muss das zugehörige Motiv zeigen. Der Arbeitszustand darf nicht mit einer Verkaufsfreigabe, einem Kauf oder einer Einwilligung zur Veröffentlichung verwechselt werden.

## Neuladen und unklarer Speicherstatus

Der aktuelle Tab-Entwurf wird als begrenzte Referenz in `sessionStorage` gehalten: höchstens zwei Arbeitsseiten und zwei ausdrücklich übernommene Druckseiten. Es werden keine Bildbytes, Prompts, Schlüssel, Kosten-/Galerie-/AGB-Einwilligungen oder Checkout-Freigaben abgelegt. Der Speichername ist an den Hash der frisch angemeldeten Konto-E-Mail gebunden. Jede Motivquelle wird beim Wiederherstellen erneut über den eigenen authentifizierten Metadaten-Endpunkt geladen. Profilversion, konkrete SKU-/ID-Zuordnung, Farb-/Grössenoptionen und Kalibrierung müssen unverändert passen.

Andere Varianten behalten ihre Entwürfe während der offenen Bearbeitung im Arbeitsspeicher. Nur der aktuelle Entwurf erhält die Tab-Sicherung. Für dauerhafte Aufbewahrung muss die Zusammenstellung ausdrücklich gespeichert werden. Ist der Browser-Sitzungsspeicher gesperrt oder voll, bleibt die normale Speicherung auf dem Server möglich; es entsteht daraus keine Garantie für ungespeicherte Änderungen.

Eine explizite Kopie (`resume=1`) hat Vorrang vor der Tab-Sicherung. Nach erfolgreichem Laden wird dieser Parameter entfernt. Der normale Reload verwendet nur eine zur URL passende Sitzung; ein Verweis auf einen anderen gespeicherten Stand wird nicht überdeckt. Ohne passende Tab-Sicherung lädt ein vorhandener `preparationId`-Verweis seine eigenen gespeicherten Seiten. Eine Kennzeichnung als bereits gespeichert wird nur aus einem frisch gelesenen, eigenen Serverstand abgeleitet.

Vor dem Speicher-POST wird die Anfrage-ID samt exakter Seitenauswahl synchron in der Tab-Sicherung festgehalten. Nach Timeout oder Verbindungsabbruch wird derselbe unveränderte Versuch mit derselben ID geprüft. Eine geänderte Zusammenstellung oder eine explizit neue Kopie bekommt eine neue ID. Wiederherstellen sendet selbst keine Speicher-, Generierungs-, Checkout- oder Produktionsanfrage.

## Nachgewiesene Regressionen

Zwölf neue Tests prüfen die private Listenroute einschliesslich Kontoisolation, gleicher Zeitstempel, neuer Einträge zwischen Listenseiten, beschädigter Daten und vollständig fehlender Schreib-/Datei-/Netzwerkwirkungen.

Zwanzig weitere Tests verwenden die tatsächlichen sechs registrierten Produktprofile mit Nicht-Defaultvarianten. Sie prüfen gleiche und unterschiedliche Motive, Rückseite allein, genaue Positionen und produktspezifische Front-/Back-Abmessungen. Fehlende oder deaktivierte Varianten, geänderte Profilversionen, Druckflächen, Fotos und Motive werden gesperrt. Die Tests belegen die registrierte Geometrie; sie ersetzen keinen aktuellen Live-Bestands- oder physischen Drucktest.

Ein zusätzlicher Integrationstest durchläuft die echten Serverrouten mit isolierter SQLite-Datenbank, Dateispeicher und Anbieterantworten: zwei unterschiedliche PNG-Uploads → gemeinsame Druckvorbereitung → Liste → Detail → authentifizierte Motiv-Metadaten und Katalog → Wiederaufnahme → Speicherung einer neuen Kopie → identische Wiederholung. Die ursprüngliche Datenbankzeile und beide PNGs bleiben bytegenau unverändert. Die Kopie besitzt eine neue ID und exakt dieselben Motive, Positionen und Druckdatei-Bytes. Eine Wiederholung erzeugt keine weitere Kopie. Kein externer Schreibaufruf, keine Tokenabbuchung und keine Bestellung.

Acht Sessiontests prüfen die begrenzte Serialisierung, getrennte Arbeits-/übernommene Seiten, fortgesetzte Wiederholungs-IDs, ungültige Referenzen, Kontoquellen und veränderte Zuordnungen. Die Quelldaten enthalten keine übertragenen Einwilligungen oder Kaufberechtigungen.

Gesamtprüfung: **430/430 Tests**, vollständiges ESLint, TypeScript und Produktionsbuild erfolgreich, kein übersprungener Test. Der Quellscan prüfte 297 Dateien ohne Treffer vorhandener lokaler Secretwerte. Lokal lieferten `/` und `/cappatex` HTTP 200; `/cappatex/gestaltungen` ohne Anmeldung 307 zum Login und `/api/cappatex/preparations` HTTP 401 mit `private, no-store`. Ein lesender Blick auf die bisherige Live-Version ergab in den letzten 180 Minuten keine vom Hosting gemeldeten Fehlerereignisse. Das ist kein Ersatz für die weiterhin fehlende visuelle Browser-Abnahme.

## Unveränderte Grenzen

- Keine kostenpflichtige Bild-/3D-Generierung, Bestellung, Produktion oder Kontoänderung.
- Verkaufsprofile und Versandfreigaben bleiben leer, Checkout/Fulfillment/automatische Produktion deaktiviert.
- Die Site bleibt ausschliesslich für den Betreiber zugänglich. Eigene Motive und Gestaltungen werden nicht veröffentlicht.
- Anbieterzugänge, reale Checkout-Tarife, Geschäftsangaben und der spätere kontrollierte End-to-End-Kauf bleiben separate Abnahmepunkte.
- Die Browsersteuerung konnte in dieser Sitzung wegen ihres Sandbox-/Node-Initialisierungsfehlers nicht gestartet werden. Automatisierte HTTP-/Serverprüfungen ersetzen keine visuelle oder Smartphone-Abnahme.

## Private Bereitstellung

Version **56** wurde am 17.10.2026 um 18:15 UTC erfolgreich auf `https://ab3d-swiss-design.berk-ermis.chatgpt.site` bereitgestellt. Anwendungscode `dd8dcbe0a37643b49b23102f7b3e31a118753c15` ist auf GitHub und im Site-Quellstand identisch bestätigt. Deployment `appgdep_6ad3bb397d948191bf301c5ceed5dc95`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_f731a15347b88191af40319192d1d22c`; Status `succeeded`, Umgebungsrevision unverändert **11**. Owner-private blieb erhalten.

Das gespeicherte Paket enthält 116 Dateien, 9.441.280 Bytes im vom Hosting erfassten Tar-Archiv, SHA-256 `ae14a3eeee6d0b561c0b62dd5960f26347d3fa4f986fdd13cf9855d773ab9931`. Keine Migration, Secretänderung oder Verkaufsfreigabe. Nach dem bekannten Windows-Startfehler der offiziellen Paketierung wurde das bestehende Windows-Verfahren aus dem sauberen, geprüften Commit verwendet; der Paket-Scan fand keine vorhandenen lokalen Secretwerte.

Die neue Übersicht `/cappatex/gestaltungen` wurde zum Öffnen in Codex vorgemerkt (`queued`). Das bestätigt keine Browser-Sichtprüfung. Der lokale Prüfserver wurde nach den HTTP-Prüfungen beendet. Dieser abschliessende Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.

## Stabile Produktansichten und sichere Auswahl · 19.10.2026

26 zuvor kalibrierte Original-JPEGs sind unverändert unter `public/cappatex/mockups/<sha256>.jpg` abgelegt. Der Resolver prüft die exakte ursprüngliche URL und die 1200×1200-Pixelabmessungen und liefert nur den passenden lokalen Inhalt. [Die maschinenlesbare Evidenz](evidence/cappatex-mockup-assets.json) nennt Herkunft, SHA-256 und verbleibende Ausnahmen. Profil-URLs, Profilversionen, bestehende CPP-Payloads und die Druckgeometrie werden nicht umgeschrieben. Das Pinning hält das kalibrierte Referenzfoto stabil; es überwacht nicht, ob der Anbieter sein heutiges CDN-Bild geändert hat.

Bei zwei T-Shirt-Rückseiten sind die historischen Blanko-Originalbytes nicht mehr vorhanden. Ihre genaue URL-/Abmessungszuordnung bleibt als Legacy-Ausnahme erhalten. Die bisherige Live-Ansicht wird ausdrücklich gewarnt angezeigt und kann weitergestaltet werden; sie zählt nicht als bestätigte Bildansicht für den späteren Bestellschritt. Keine neuen Inhalts-Hashes oder Nachweise wurden erfunden. Unbekannte Fotos und abweichende Abmessungen erlauben keine Seitenübernahme.

Vorbereitung und Prüfansicht kontrollieren das Laden und die Originalabmessungen jedes Fotos und jeder privaten Motivvorschau. Motive werden erst auf korrekt geladenen Fotos eingeblendet. Fehlende Bilder, falsche Masse und 20-Sekunden-Ladeüberschreitungen erhalten eine sichtbare Meldung und eine Wiederholungsmöglichkeit. Eine spätere Bildbestätigung wird erst nach vollständiger Anzeige aller gepinnten Druckseiten ermöglicht; ein Neuladen setzt diese Bestätigung zurück. Preis-, Produkt- und Versandfreigaben bleiben zusätzliche Voraussetzungen.

Diese Ansicht setzt weiterhin die gespeicherten Geometrie-/Platzierungsdaten mit der privaten Viertelauflösungs-Motivvorschau zusammen. Sie ist kein direktes Thumbnail der fertigen Druck-PNG. Die unveränderlichen finalen PNGs samt serverseitiger SHA-/Dimensionsprüfung vor Checkout und Fulfillment bleiben bestehen. Es wurde weder ein HD-Download freigeschaltet noch ein grosser Bilddecoder in den Worker eingeführt.

Farbwechsel ersetzen eine nicht verfügbare Wunschgrösse nicht mehr still durch die erste angebotene Variante. Die bisherige Auswahl bleibt erhalten, passende Grössen werden ausdrücklich zur Auswahl angeboten. Reale Regressionen betreffen Tanktop White/L → Black, Hoodie Navy/4XL → White und Langarmshirt Black/5XL → White. Vergleichskarten und anschliessendes Öffnen verwenden dieselbe eigene Vorderseiten-Motivzuordnung. Ein Katalogausfall blockiert Produkte, lässt bereits bestätigte Konto-Freigaben für Motivwerkzeuge aber erhalten; Einwilligungen und Kostenbestätigungen werden nicht umgangen.

Abgebrochene Speichervorgänge blockieren das Konto nicht mehr dauerhaft. Ausschliesslich eigene `preparing`-Reservierungen ohne Payload oder Payload-Hash werden nach 15 Minuten beim nächsten gültigen Speicher-POST als fehlgeschlagen markiert. Die alte Anfrage-ID bleibt verbraucht, ein neuer ausdrücklicher Speicherversuch verwendet eine neue ID. Ein verspäteter alter Worker kann durch das bestehende `WHERE state='preparing'` keine abgeschlossene oder neue Vorbereitung überschreiben. Er kann private, nicht referenzierte Dateien im alten Namensraum hinterlassen; fertige Originale werden nicht verändert oder gelöscht. GET bleibt schreibfrei, die Tagesgrenze zählt fehlgeschlagene Versuche weiterhin mit.

Gesamtprüfung: **453/453 Offline-Tests**, Typprüfung, vollständiges ESLint und Produktionsbuild erfolgreich. Neue Tests umfassen acht Lease-/Race-Fälle, acht Asset-/Evidenzfälle und sieben Auswahl-/Motivzuordnungsfälle. Quellscan: 329 Dateien, keine Treffer vorhandener lokaler Secretwerte. Keine neue Migration, Kosten, echte Bestellung, Produktion, Kontoänderung oder öffentliche Freigabe.

Die Browsersteuerung funktioniert am 19.10. wieder. Die bestehende Anmeldung war ohne Benutzeraktion möglich. Auf der bisherigen privaten Live-Version wurden die Liste, die vollständige Vorder-/Rückseitenansicht und die Wiederaufnahme als Kopie des vorhandenen eigenen CPP-Stands geprüft, ohne eine neue Speicherung oder Generierung auszulösen.

Zusätzlich wurden die tatsächlichen React-Prüfkomponenten über CUA in einem isolierten lokalen Fixture bedient: gesunde Vorderseite, fehlendes Foto, fehlendes Motiv, falsche Foto-/Motivmasse, 20-Sekunden-Timeout, gewarnte Legacy-Rückseite, unbekanntes Foto, zwei gesunde Seiten und eine fehlende zweite Motivseite. Bei Fehlern blieben Bestätigung und Weiterleitung gesperrt. Nach Reparatur und Retry wurde die Ansicht geladen, eine neue Bestätigung blieb erforderlich. Beide gesunden Seiten ermöglichten den Button erst nach ausdrücklicher synthetischer Testbestätigung. Kein Checkout-POST, keine Kontodaten und kein externer Anbieteraufruf. Bei 390px gab es keinen horizontalen Überlauf; die Wiederholungsbuttons passten in die Ansicht. Der lokale Fixture-Server wurde danach beendet.

Alle 26 gepinnten Bilder wurden auch über den lokalen HTTP-Server gelesen: jeweils HTTP200 und exakt die dokumentierte SHA-256. Die CAPPATEX-Seite lieferte HTTP200. Dies ist weiterhin kein echter Kauf-/Versand-/Produktions- oder physischer Drucktest. Die bisher gesperrten Verkaufs-, Versand- und Produktionsschritte bleiben unverändert.

### Private Bereitstellung und Live-Prüfung

Version **57** wurde am 19.10.2026 um 15:10 UTC erfolgreich bereitgestellt. Anwendungscode `eb5e94eb6be4e4909a34efe0c61fb8e9588f922e` ist auf GitHub und in der gespeicherten Site-Version identisch bestätigt. Deployment `appgdep_6ad632c1c988819186b957d70651c770`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_25fe39df6c4881919469dc7cd905ce4a`; Status `succeeded`, Umgebungsrevision unverändert **11**, Zugriff weiterhin owner-private.

Hosting-Paket: 142 Dateien, 13.127.680 Bytes im erfassten Tar-Archiv, SHA-256 `30e041824dfbfe66f648a563d6585456b8dfb8a467f9b551666140b83987d4a1`. Nach dem bekannten Windows-Startfehler der offiziellen Paketierung wurde das bestehende Windows-Verfahren aus dem sauberen, geprüften Commit verwendet. Paket-Scan ohne Treffer vorhandener lokaler Secretwerte. Beide lokalen Prüfserver wurden beendet.

Anschliessend wurden auf der tatsächlichen privaten Version 57 mit dem bereits vorhandenen eigenen Motiv alle sechs Produktgruppen ausgewählt. Jede aktive Vorderansicht lud die lokale, gepinnte 1200×1200-Datei vollständig und erlaubte nach Laden der Motivvorschau die Seitenübernahme. Die Oberfläche zeigte bei 390px keinen horizontalen Überlauf. Das ist eine exemplarische Produktgruppenprüfung, keine Prüfung jeder Farbe, Grösse, Fotogalerie oder physischen Druckqualität.

Auch die drei problematischen Farbwechsel wurden live geprüft: Tanktop White/L blieb nach Black-Wunsch unverändert White/L und bot wegen des aktuellen Bestands nur Black/S zur ausdrücklichen Auswahl an; diese Auswahl wechselte erst nach Klick zu Black/S. Hoodie Navy/4XL blieb bei White-Wunsch Navy/4XL. Langarmshirt Black/5XL blieb bei White-Wunsch Black/5XL. Die Hinweise nannten jeweils die tatsächlich angebotenen Alternativgrössen.

Die vorhandene Vorder-/Rückseiten-Kopie wurde nach Neuladen erneut vollständig aus der kontobezogenen Tab-Sicherung übernommen; die Legacy-Rückseite zeigte ihren sichtbaren Vorbehalt. Kein neuer Upload, Speicher-POST, kostenpflichtiger KI-Aufruf, Shopify-Checkout, Kauf oder Produktionsauftrag wurde ausgelöst. Mobile Browserbreite wurde anschliessend zurückgesetzt. Lokale Screenshots und Prüfprotokolle liegen ausschliesslich im ignorierten `outputs`-Ordner. Dieser Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.
