# Private Produktgestaltungen wiederfinden und fortsetzen

Stand 17.10.2026. Repository `ermisalper/ab3d`, Branch `codex/cappatex-production`. Ergänzung zur [Verkaufsvorbereitung](SHOP-LAUNCH-READINESS.md) und [Versandabnahme](CAPPATEX-SALES-AND-SHIPPING-ACCEPTANCE.md). Keine Verkaufs- oder Produktionsfreigabe.

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
