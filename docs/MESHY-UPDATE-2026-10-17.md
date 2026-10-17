# Meshy-Aktualisierung für AB3D, 17.10.2026

Repository: ermisalper/ab3d, Branch codex/cappatex-production. Vorheriger gesicherter Stand 10b8a2d; die CAPPATEX-Erweiterung aus Version 49 bleibt enthalten.

## Prüfung und Entscheidung

Die Website verwendete Meshy 7 explizit in Text-, Bild-, Mehrbild- und Refine-Aufträgen. Ein Anbieterupdate ändert diese expliziten Werte nicht automatisch. Meshy 7 ist inzwischen veraltet; Meshy 7.1 ist die aktuelle Standardgeneration. Am 15.10.2026 wurde zusätzlich T2.5 für Smart Topology veröffentlicht. Beide Modelle werden ausdrücklich angegeben, damit zukünftige Änderungen an `latest` den Ablauf nicht unbemerkt ändern.

| Ablauf | Aktualisierte Vorgabe |
| --- | --- |
| Finale Text-/Einzelbild-/Mehrbildmodelle | `meshy-7.1`, `geometry_resolution: standard`, kein Remeshing |
| Schnelle Text-/Einzelbildvorschau | `meshy-t2.5`, `model_type: smart-topology`, Dreiecke, Ziel 15000 Flächen, ohne Texturen |
| Schnelle Mehrbildvorschau / generierte Mehransicht | Meshy 7.1 ohne Texturen; T2.5 unterstützt diesen Endpunkt nicht |
| Texturierung vorhandener Vorschauen | Erbt das ursprüngliche Modell; kein erzwungener Wechsel alter Vorschauen |
| Druckprüfung und Reparatur | FDM und ausdrückliche Zielhöhe in Millimetern, keine implizite 150-mm-Annahme |

Smart Topology erhält keine inkompatiblen Parameter wie `image_enhancement` oder `remove_lighting`. Finale Originalbilder behalten `image_enhancement: false`. Bestehender kanonischer API-Pfad `/openapi/v2/text-to-3d`, GLB-Vorschau und serverseitige Schlüsselverwendung bleiben erhalten. Mehr als vier Bilder werden ausdrücklich abgelehnt und nicht still abgeschnitten.

Die API-Preise laut Prüfung: T2.5-Grundform 5 Meshy-Credits, 7.1-Grundform 20, 7.1 mit 2K-Texturen insgesamt 30. Die vorhandenen AB3D-Design-Tokenpreise bleiben bestehen. 2K-/4K-Ultra-Geometrie kostet zusätzlich und wird nicht aktiviert; `geometry_resolution: standard` ist ausdrücklich gesetzt. Neue Features wie Auto Split, Rigging, Animation, Text-to-Motion und zusätzliche Creative-Lab-Produkte werden durch dieses Update nicht automatisch in den Kundenablauf aufgenommen. Die bestehende JPG-/PNG-Auswahl bleibt kompatibel; eine zusätzliche WebP-Auswahl ist nicht Bestandteil dieser Änderung. USDZ-Skalierung ist nicht betroffen, da unser Ablauf GLB/STL/3MF nutzt.

## Druckdatei-Freigabe

Die neue API-Wandstärkenprüfung muss für die gewählte Höhe und FDM vorhanden sein. Zielhöhen 2–80 cm werden geprüft; damit funktionieren auch die bereits angebotenen kleinen Keycaps. Unbekannte oder fehlende Wandstärkenergebnisse geben keine Datei als druckgeprüft frei. Bei einer auffälligen Prüfung wird höchstens einmal im bestehenden, ausdrücklich gestarteten Druckpaket repariert; anschließend folgt eine erneute kostenlose Analyse des reparierten Modells. Erst ein gesunder Gesamt- und Wandstärkenbericht für dieselbe Höhe erlaubt den STL-/3MF-Export. Die GLB-Vorschau wird bei Reparatur ebenfalls auf das reparierte Modell umgestellt. Meshys `thin_walls.status` ist massgeblich: kleine scharfe Ecken können `has_thin_walls: true` melden und trotzdem insgesamt `healthy` sein. Eine manuelle Fertigungsfreigabe bleibt erforderlich.

## Validierung

202 lokale Tests bestehen, darunter 23 neue Ausführungstests mit realen Routen und Kontobuchungen, aber ausschließlich lokalen Datenbanken und abgefangenen Anbieterantworten. Abgedeckt: Modell-/Parameterkombinationen für 1/2/4 Bilder, Textvorschau, Refine-Vererbung, Eigentümer- und Elternauftragsprüfung, Höhenumrechnung und Grenzen, fehlende Wandstärkenberichte sowie Rückbuchung bei abgewiesenem Auftrag ohne automatische Wiederholung. Eine Bildanfrage ohne Qualitätsangabe behält die bisherige untexturierte Vorschau, statt unbemerkt Texturkosten zu aktivieren. TypeScript, Lint und Produktions-Build bestanden. Lokale Vorschau HTTP 200; Qualitätsauswahl und T2.5-Prozessanzeige im Browser bestätigt.

Kein kostenpflichtiger Meshy-Auftrag, keine KI-Bildgenerierung, keine Bestellung und keine Änderung an Guthaben, Abos, Schlüsseln oder Zahlungsarten wurden für diese Prüfung ausgelöst. Die tatsächliche neue Generierungsqualität und ein kompletter Drucklauf sind ohne eine separat freigegebene kostenpflichtige Generierung noch nicht live bestätigt. Veröffentlichung und abschließender Browsernachweis werden nach dem Deployment unten ergänzt.

## Primärquellen

- [Meshy Changelog](https://docs.meshy.ai/en/api/changelog)
- [Text to 3D](https://docs.meshy.ai/en/api/text-to-3d)
- [Image to 3D](https://docs.meshy.ai/en/api/image-to-3d)
- [Multi Image to 3D](https://docs.meshy.ai/en/api/multi-image-to-3d)
- [Analyze Printability](https://docs.meshy.ai/en/api/analyze-printability)
- [Repair Printability](https://docs.meshy.ai/en/api/repair-printability)
- [API Pricing](https://docs.meshy.ai/en/api/pricing)

Der lokale Meshy-Skill-Check findet keinen lokalen Meshy-Schlüssel und kein Python-requests; die Web-Anbindung nutzt ihren bestehenden Hosting-Schlüssel. Für das Update werden weder ein neuer lokaler Schlüssel noch Python-Pakete benötigt.

Der separate Live-Verbindungstest per Service-Zugang erreicht die private Site, wird aber ohne Besucheridentität vom geschützten Health-Endpunkt mit 401 abgewiesen. Dabei wird Meshy nicht kontaktiert. Das bestätigt keinen Schlüsseldefekt; die Browseranmeldung und der reine Sites-Service-Zugang sind bewusst getrennt. Die Kontoprüfung wird nicht umgangen und der Endpunkt nicht öffentlich gemacht. Ein erfolgreicher aktueller Anbieter-Healthcheck bleibt deshalb unbestätigt.

## Privater Live-Nachweis

Version **50**, Quellcommit **52cb0881588455f7a8e2519adadcc80597569f1a**, Version-ID `appgprj_6a69247390f08191811183b6a04bae94~appgver_fc8c8c557ecc8191841869c069970145`. Deployment `appgdep_6ad37808a9c081919e14d462da09c3a2` erfolgreich am 17.10.2026 um 13:29:02 UTC, Umgebung weiterhin Revision 11 und Zugriff owner-private.

Im angemeldeten Live-Browser Foto-Vorlage gewählt, Schnellvorschau T2.5 und finales Modell 7.1 ausgewählt, passende Prozessanzeige bestätigt. Desktop und Mobilansicht 390 × 844 geprüft, keine horizontale Überbreite, keine Konsolenfehler im geprüften Studio. Kein Upload und keine Generierung ausgelöst. Bildnachweis: `outputs/ab3d-meshy-update-live-20261017.png`. GitHub-Branch gesichert. Spätere Dokumentationscommits ändern den oben genannten Live-Quellstand nicht.

Bei der Paketvorbereitung wurde eine veraltete Quellstandangabe von der automatischen Freigabe abgelehnt. Nach erneutem Vergleich von sauberem lokalem HEAD und GitHub-Branch wurde ausschliesslich der bestätigte neue Commit verwendet. Der offizielle Sites-Helfer scheiterte danach wie zuvor am Windows-Bash-Packager; das vorhandene Windows-Verfahren prüfte Commit, Hosting-Manifest, Migrationen und Paketinhalt (keine lokalen Schlüssel enthalten), bevor das private Deployment ausgeführt wurde.
