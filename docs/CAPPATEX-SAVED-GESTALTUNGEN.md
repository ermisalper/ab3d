# Private Produktgestaltungen wiederfinden und fortsetzen

Stand 17.10.2026. Repository `ermisalper/ab3d`, Branch `codex/cappatex-production`. Ergänzung zur [Verkaufsvorbereitung](SHOP-LAUNCH-READINESS.md) und [Versandabnahme](CAPPATEX-SALES-AND-SHIPPING-ACCEPTANCE.md). Keine Verkaufs- oder Produktionsfreigabe.

Aktuelle Fortsetzungen vom 19.10.2026: siehe „Stabile Produktansichten und sichere Auswahl“, „Suche und Wiederherstellung“ sowie „Ansicht der tatsächlichen Druckdatei“. Das ursprüngliche Protokoll zur Version 56 bleibt nachfolgend erhalten.

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

## Suche und Wiederherstellung · 19.10.2026

Die private Übersicht unterstützt jetzt eine wörtliche Suche nach Produktname, Farbe, Grösse und Motiv-ID sowie exakte Filter für nur Vorderseite, nur Rückseite oder beide Druckseiten. Prozent- und Unterstrichzeichen sind keine Suchplatzhalter. SQLite und die nachgelagerte DTO-Prüfung verwenden identische ASCII-Gross-/Kleinschreibung; eine allgemeine Unicode-Faltung wird nicht zugesagt. Filter stehen in der URL und sind an die fortgesetzte Listenseite gebunden. Alte Cursor ohne Filter bleiben lesbar. Kontoisolation, Prüfsummenprüfung und ausschliesslich lesende GETs bleiben bestehen.

Der Cursor folgt der letzten geprüften Datenbankzeile, auch wenn beschädigte Kandidaten aus gefilterten Ergebnissen entfallen. Deshalb kann eine Zwischenseite ohne sichtbare Treffer weitere Ergebnisse anbieten. Die Oberfläche erhält diese Weiterladeaktion und zeigt keine erfundene Gesamttrefferzahl. Neue Suchen verwerfen veraltete Antworten; Mehrladen entfernt doppelte Karten. Lade- und Anmeldefehler lassen gespeicherte Originale erhalten.

Erfolgreiche Listen- und Detailantworten werden vor der Darstellung auf ihre tatsächlichen Felder, IDs, Seiten, URLs, Masse, Geometrie und eventuelle CHF-Preise geprüft. Unbekannte Zusatzfelder werden nicht übernommen. Eine Speicherbestätigung muss ausserdem genau zum abgesendeten Profil, zur Variante, Menge, zum Lieferland und zu jedem Motiv samt Platzierung passen. Bei beschädigten oder abweichenden Bestätigungen bleiben Anfrage-ID und unklarer Speicherstatus erhalten; es erfolgt kein automatischer neuer POST.

Katalog- und Wiederaufnahmefehler bieten eine ausdrückliche GET-Neuprüfung. Beschädigte, veraltete oder mit einem neu geöffneten Motiv kollidierende lokale Referenzen werden nicht still überschrieben. Bei einem Motivkonflikt kann stattdessen der bisherige Tab-Entwurf geöffnet werden. Das gezielte Verwerfen verlangt zwei Klicks, eine frisch bestätigte identische Kontozuordnung und exakt unveränderte lokale Rohdaten; nur dieser eine kontobezogene Sitzungsschlüssel wird entfernt. Dauerhafte Motive und Druckvorbereitungen bleiben erhalten. Ein unklarer früherer Speicherversuch wird sichtbar benannt, Wiederholen der Ladeprüfung löst keine Speicherung aus.

Die bestehende Priorität einer ausdrücklich geöffneten Kopie vor einer gültigen Tab-Sicherung bleibt erhalten. Nur eine beschädigte oder alte lokale Sicherung hält das Ersetzen an. Ein expliziter gespeicherter Stand und seine eigenen Motivquellen können vorher gelesen werden; die Oberfläche verlinkt die direkte Prüfansicht. Eine neue Kopie wird in diesem Fall erst nach bewusstem Verwerfen der lokalen Referenz aktiviert.

Gesamtprüfung: **482/482 Offline-Tests**, TypeScript, vollständiges ESLint und Produktionsbuild erfolgreich. Neue Prüfungen umfassen 13 zusätzliche Listenfälle, elf Response-/Speicherbestätigungsfälle und fünf Recovery-Fälle. Keine Migration, Preisfreigabe, neue Secretvariable oder Kontoänderung.

Die tatsächlichen React-Komponenten wurden über CUA in isolierten lokalen HTTP-Fixtures bedient. Listenprüfung: wörtliche Suche, beide Druckseiten, leere Seite mit weiterem Cursor, verspätete alte Suchantwort, beschädigte 200-Antwort mit erfolgreichem Retry, 401-Anmeldung, überlappende Mehrladeseite ohne doppelte Karten und beschädigter Vergleichsbeleg. Bei 390px passten alle Suchfelder und Buttons in die Ansicht.

Recovery-Prüfung: beschädigte Referenz mit Abbrechen und zweistufigem lokalem Verwerfen; ausstehende Speicherung nach Katalog-503 mit Reparatur und GET-Neuprüfung; unveränderte Rohdaten und null Mock-POSTs; Galerie-Konflikt mit Öffnen des alten Entwurfs; Ablehnung nach synthetischem Kontowechsel; veraltetes Druckprofil und altes Schema. Die Recovery-Buttons passten bei 390px in die Ansicht. Ein Überlauf des synthetischen Fixture-Titels betrifft nicht die Produktionskomponente. Kein echter lokaler Nutzerentwurf wurde gelöscht, kein eigenes Motiv erzeugt, keine neue Vorbereitung gespeichert und kein externer Bestellaufruf ausgeführt.

### Private Bereitstellung und Live-Prüfung · Version 58

Version **58** wurde am 19.10.2026 um 16:09 UTC erfolgreich bereitgestellt. Anwendungscode `2b4698c5b806ebc0bbca3b1c4385ac941ad7e58c` ist auf GitHub und in der gespeicherten Site-Version identisch bestätigt. Deployment `appgdep_6ad6408df1508191996fa18c75622b81`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_a72337b45310819199cd30998e89e3bf`; Status `succeeded`, Umgebungsrevision weiterhin **11**. Zugriff nachkontrolliert: Betreiber als einziger freigegebener Nutzer, keine externen Gruppen oder Editoren.

Hosting-Paket: 142 Dateien, 13.168.640 Bytes im erfassten Tar-Archiv, SHA-256 `7265dcb8bf8bd80465554f8e913f8cb561edf75604c01bd04c8efdb678a4ca6e`. Nach erneutem bekannten Windows-Startfehler der offiziellen Paketierung wurde das bestehende Windows-Verfahren aus dem sauberen, geprüften Commit verwendet. Quellscan: 333 Dateien, kein vorhandener lokaler Secretwert; ebenso kein Treffer im Hosting-Paket. Keine neue Migration oder Änderung der Verkaufs-, Versand-, Kosten- und Produktionsfreigaben.

Live wurden mit vorhandenen eigenen Daten bestätigt: der bestehende T-Shirt-Stand lädt, Suche nach „Hoodie“ zeigt nachvollziehbar keinen Treffer, Filter zurücksetzen funktioniert, „Vorder- und Rückseite“ zeigt den vorhandenen zweiseitigen Stand. Der Vergleich lädt beide Produktfotos mit 1200×1200 und beide privaten Motivvorschauen mit 512×512; der Vorbehalt des nicht gepinnten historischen Rückseitenfotos bleibt sichtbar. Kein Malformed-Response-Fehler bei den tatsächlich gespeicherten Daten.

Auch nach echtem Neuladen mit `sides=both` bleiben Filter und vorhandener Treffer erhalten. Bei 390px liegen alle Suchfelder und Buttons innerhalb der Ansicht, ohne horizontalen Überlauf. Die Browserbreite wurde zurückgesetzt. Beide lokalen Fixture-Server sind beendet. Screenshot im ignorierten `outputs/cappatex-gestaltungen-v58-20261019.jpg`. Kein Upload, Speicher-POST, kostenpflichtiger KI-Aufruf, Checkout, Kauf oder Produktionsauftrag während dieser Abnahme. Dieser abschliessende Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.

## Ansicht der tatsächlichen Druckdatei · 19.10.2026

### Konzept und Grenzen

Eine gespeicherte Produktansicht soll die tatsächlich gespeicherte Druck-PNG zeigen. Ein erneutes Zusammensetzen von Quellmotiv und CSS-Platzierung belegt deren Inhalt nicht. Deshalb liefert ein eigener authentifizierter GET `?preview=front|back` eine transparente Ansicht des unveränderlichen finalen Canvas mit maximal 512 Pixeln Kantenlänge. Der volle Canvas wird genau einmal im gemessenen Druckrechteck des Blankofotos angezeigt; keine zweite Motivplatzierung. Vorder- und Rückseite haben getrennte URLs und Quelldatei-Prüfsummen.

Der GET liest ausschliesslich den fertigen Stand des angemeldeten Kontos, prüft Payload- und Datei-SHA, Renderer-Version, Dateimasse sowie die exakte Übereinstimmung von Platzierung, gerundetem Raster und DPI. Er schreibt keine Datenbank-/R2-Daten, verändert keine Originaldatei und ruft keinen Anbieter auf. Die kleinere Vorschau gewährt keine Original-Downloadberechtigung. Der bestehende `?side=`-Download bleibt separat geschützt.

Die PNG-Verkleinerung verarbeitet das bekannte `rgba-area-v1`-Format zeilenweise: maximal 16 MB komprimierte Eingabe, 10.000 Pixel pro Achse und 40 Millionen Gesamtpixel; CRC, erlaubte Chunkfolge, RGBA8, Filter0, Entpackungsgrenzen und vollständige Datenmenge werden geprüft. Im Anwendungscode bleiben nur eine Eingabezeile und ein kleiner Vorschau-Canvas erhalten, kein dekodierter Vollcanvas mit bis zu 160 MB. Die Vorschau nimmt tatsächliche Pixel aus den Mittelpunkten der verkleinerten Bildzellen. Feine Details können bei 512px verloren gehen; falls alle Stichproben transparent wären, wird die Ansicht gesperrt statt als scheinbar leere Druckdatei bestätigt. Dies ist weiterhin kein Farbproof, Stoffmodell oder physischer Drucktest.

Die Detailantwort bindet die Vorschau exakt an CPP-ID, Druckseite, Datei-SHA und berechnete Vorschaumasse. Ein fehlender oder fehlerhafter PNG-GET fällt nicht auf das Quellmotiv zurück. Bei alten Antwortformaten ohne Druckdatei-Vorschau bleibt eine ausdrücklich gekennzeichnete Quellansicht lesbar, erlaubt aber keine Bildbestätigung. Historische, nicht gepinnte Produktfotos bleiben ebenfalls gesperrt. Im noch nicht gespeicherten Entwurf bleibt die Motivvorschau mit Platzierung bestehen.

### Bestätigte Fehler und Korrekturen

Ein gemeinsamer reiner Rasterhelfer verwendet exakt dieselbe unabhängige Achsenrundung wie der bisherige Renderer. Antwortparser, Dateiprüfung und Renderer stimmen damit überein; ein gültig begrenztes, aber zur Platzierung falsches 1×1-Raster wird abgewiesen. Drei vor der Umstellung gesicherte Ausgaben blieben bytegenau identisch, einschliesslich des echten Hoodie-Formats. Die Renderer-Version und akzeptierte Druck-PNGs werden nicht geändert.

Ein tatsächlich möglicher Leerbildfall wurde reproduziert: Ein sehr kleiner opaker Bildpunkt in einer 6144×1024-Quelle war in der Motivvorschau sichtbar, nach Druckverkleinerung aber vollständig transparent. Der Renderer prüft jetzt die quantisierte Ausgabe-Alpha und lehnt vollständig unsichtbare Druckdateien ab. Die Route markiert den Versuch als fehlgeschlagen und meldet HTTP422 mit konkretem Hinweis; kein fertiger Stand oder Auftrag wird freigegeben. Bereits gespeicherte Dateien werden vor einer späteren Bestell-/Fulfillment-Freigabe ebenfalls über die strenge PNG-Prüfung gelesen.

Die verkleinerte Quellvorschau verwendete bei nicht durch vier teilbaren Bildmassen einen kleineren letzten Pixelblock. Das überbetonte schmale Ränder: Bei einer 1025px-Quelle erschien die letzte opake Spalte mit Alpha255 statt proportional64. Gleichmässige, nach Fläche und Alpha gewichtete Abtastung korrigiert das für neue Uploads/Vorschauen. Sichtbarkeit wird erst nach Alpha-Quantisierung bestimmt. Bereits gespeicherte Originale und Quellvorschauen werden nicht umgeschrieben; die neue gespeicherte Produktansicht verwendet deren finale Druck-PNG.

### Nachweise

**510/510 Offline-Tests**, Typprüfung, vollständiges ESLint und Produktionsbuild erfolgreich. Neue Fälle prüfen gleichmässige Randabdeckung, leere Raster, gemeinsame Pixelgeometrie, Bytekompatibilität, echte finale PNG-Pixel, CRC-/Zlib-/Dimensionsfehler, grosse Providerdateien ohne Vollcanvas-Decoding sowie den tatsächlichen GET mit Kontoisolation, HD-Trennung, Front-/Back-Zuordnung und fehlenden/veränderten Dateien. Alle sieben unabhängigen Proof-Handlerfälle sowie gemeinsame Modulprüfungen wurden zusätzlich lesend von einem zweiten Agenten nachvollzogen.

CUA bediente die tatsächlichen Review-/Receipt-Komponenten in einem rein synthetischen lokalen Fixture: gesunde Druckansicht, 404 mit Reparatur und Retry, falsche Vorschaumasse, Legacy-Foto, altes Format ohne Proof, zwei gesunde Seiten und fehlende zweite Seite. Die Einwilligung blieb bei Fehlern gesperrt. Beide gesunden Seiten erlaubten den Button erst nach synthetischer Testbestätigung; kein Checkout-POST wurde ausgelöst. Gezählt: zwei Proof-GETs, null Quellmotiv-GETs und null Mock-POSTs. Die Bilder füllten das Druckrechteck mit 100% ohne erneute Transformation. Bei 390px passten beide 335px-Produktansichten ohne horizontalen Überlauf. Testtab und lokaler Server wurden geschlossen, Browserbreite zurückgesetzt.
