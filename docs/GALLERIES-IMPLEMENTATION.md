# Freiwillige Werkgalerien – Umsetzung und Prüfung

17.10.2026. Konzept: [GALLERIES-CONCEPT.md](GALLERIES-CONCEPT.md).

## Umfang

- `/modelle`: AB3D-Modellgalerie, Kategorien, Titelsuche, Seitenwechsel und drehbare Detailansicht.
- `/cappatex/designs`: Motivgalerie mit denselben Filtern und verkleinerten Vorschauen.
- `/sammlung`: authentifizierte eigene Werke, Speicherstatus, Modellstufen, CAPPATEX-Studio-Rückkehr, Sichtbarkeit und Widerruf.
- `/galerie/pruefung`: Betreiberprüfung der ausdrücklich eingereichten Ergebnisse. Zustimmung allein veröffentlicht noch nichts.
- `/werke/[id]`: nach Eigentum, Freigabestatus und Betreiberprüfung geschützter Eintrag. Medien werden über dieselben serverseitigen Berechtigungen ausgeliefert, ohne öffentliche R2-Bucketadressen.

Beide Studios verlangen vor einem neuen kostenpflichtigen Auftrag eine ausdrückliche Privat-/Galeriewahl. Keine Option ist vorausgewählt. Öffentliche Einreichungen erfordern zusätzlich die Rechtebestätigung. Die erste Entscheidung bleibt als versionierter Datensatz mit Zeitpunkt erhalten; spätere Änderungen überschreiben diesen ursprünglichen Nachweis nicht. Modell-Folgestufen erben die Projektentscheidung. Die Galerie enthält weder Prompts noch Kontaktdaten oder hochgeladene Referenzbilder. Die Datenschutzerklärung beschreibt die neue Funktion.

Neue Meshy-GLB-Dateien werden beim erfolgreichen Statusabruf in R2 archiviert. Modellformat, Dateilänge, Anbieterherkunft und eingebettete Ressourcen werden geprüft; Dateien werden begrenzt gestreamt. Abgeschlossene Archive sind unveränderlich. Vorschau und Endergebnis bleiben getrennt; erst ein gespeichertes Endergebnis kann freigegeben werden. CAPPATEX verwendet seine bestehende normalisierte kleine PNG-Vorschau. Die druckfähige Originaldatei ist über die Galerie nie erreichbar.

Migrationen `0010` und `0011` fügen ausschließlich die beiden Galerie-Tabellen, Indizes und den ursprünglichen Einwilligungsnachweis hinzu. Historische Daten werden nicht in Migrationen veröffentlicht oder kopiert. Der authentifizierte Sammlungsabruf indexiert vorhandene eigene Werke begrenzt und ausschließlich privat.

## Verifikation vor Bereitstellung

Typprüfung, ESLint, Produktionsbuild und alle **226 Tests** bestanden. Davon prüfen **24** neue Integrationstests die echten API-Handler mit SQLite, R2-Testadapter und vollständig simuliertem Anbieter. Es wurden keine kostenpflichtigen APIs aufgerufen.

Geprüft: fehlende Zustimmung und fehlender Speicher verhindern kostenpflichtige Anbieteraufrufe; private Dateien sind für andere Konten und Betreiber gesperrt; Freigabe nur durch Betreiber; Widerruf gewinnt auch bei paralleler Freigabe; Erstentscheidung bleibt unverändert; Original-Druckdateien bleiben privat; abgelaufene Anbieterdateien werden nicht als gespeicherte Dateien ausgegeben; beschädigte und externe GLB-Ressourcen werden abgelehnt; Archivierungswiederholung und parallele Statusabfragen erzeugen keine neuen bezahlten Aufträge; Text-Vorschau/Finalisierung gehören zu einem Projekt; Finalisierung übersteht einen vorherigen Archivfehler; Suchfilter und Seitenwechsel funktionieren.

Lokale D1-Migrationen erfolgreich. HTTP 200 für Modellgalerie und leere Galerie-API. Im echten Browser beide Galerie-Seiten, Kategorienwechsel, Wechsel zwischen beiden Studios sowie die ungewählte Einwilligung und öffentliche GLB-/Rechtehinweise geprüft. Ein dabei erkannter Zustandserhalt zwischen Galerie-Seiten wurde mit getrennten Komponentenschlüsseln behoben. Die angeforderte mobile Viewport-Emulation wurde vom In-App-Browser nicht wirksam angewandt; eine echte 390-Pixel-Prüfung wird deshalb nicht behauptet.

## Grenzen

Keine kostenpflichtige neue 3D- oder Bildgenerierung, Bestellung oder Produktion im Test. Die reale Meshy-Archivierung hängt von noch erreichbaren Anbieterdateien ab; bereits abgelaufene historische Dateien können nicht rekonstruiert werden. Ohne laufende Statusabfrage beginnt keine Hintergrundarchivierung; nach einem geschlossenen Tab lässt sie sich in der Sammlung mit „Fertigstellung & Speicherung prüfen“ nachholen. Die Sammlung unterscheidet Datensätze und tatsächlich vorhandene Dateien.

Die Website bleibt in ihrer bestehenden privaten Pilot-Zielgruppe. Historische echte Werke werden im Test nicht öffentlich freigegeben. Shopify-, Produktions- und Verkaufssperren sowie Zahlungsarten bleiben unverändert. Eine spätere öffentliche Freigabe der gesamten Website ist eine getrennte Entscheidung.

## Bereitstellung und echte Browserprüfung

**Version 51** erfolgreich auf `https://ab3d-swiss-design.berk-ermis.chatgpt.site` bereitgestellt, weiterhin nur für den bestehenden privaten Pilotzugang. Quellcommit `20f9103d0e7498ed6562b80a760973aae8c722fe`, GitHub-Branch `codex/cappatex-production`. Deployment `appgdep_6ad381bbd0ac8191837c34c1ecef3eff`, Umgebungsrevision unverändert `11`. Das überprüfte Windows-Paket enthält beide neuen Migrationen; die Prüfung des Pakets gegen lokale OpenAI-/Printify-Schlüssel fand keinen Treffer. Der offizielle Helfer synchronisierte den Quellstand, scheiterte jedoch beim Start seines Paketierungskommandos unter Windows; die bereits vorhandene native Windows-Paketierung wurde für diesen Stand verwendet.

Auf der bereitgestellten Site im echten Testkonto nachgewiesen:

- Historische CAPPATEX-Vorschauen erscheinen als private gespeicherte Motive, historische 3D-Datensätze zunächst als nicht archiviert.
- Ein kostenfreier Statusabruf des vorhandenen Meshy-Auftrags `01a12797-aabc-73d3-98f2-1da831539d46` meldete `Task not found`. Keine neue Generierung oder Abbuchung; die Datei wurde nicht als vorhanden ausgegeben. Eine neue reale Meshy-GLB-Archivierung ist deshalb nur mit simulierten Anbieterdateien getestet.
- Ein ausschließlich lokal berechnetes geometrisches PNG wurde ohne KI und Tokenkosten hochgeladen. Ohne Galerieentscheidung blieb die Übernahme gesperrt. Nach expliziter Privatwahl wurden Titel, Kategorie und Motiv dauerhaft gespeichert: Design `CPX-05473EF09709`, Sammlung `GLD-f41e3cdc499c43d2b99bd2b420e4ab03`, Kategorie `kunst`.
- Anschließend am eigenen synthetischen Testmotiv: öffentliche Wahl mit Rechtebestätigung, Status „Wartet auf Freigabe“, Betreiberfreigabe, sichtbarer Beitrag in der Motivgalerie unter „Kunst & Abstrakt“, danach erfolgreicher Widerruf. Die Motivgalerie zeigt wieder den leeren Zustand; das Testmotiv bleibt mit Status „Zurückgezogen“ privat in der Sammlung. Kein historisches echtes Werk wurde veröffentlicht.
- Die persönliche Sammlung wurde nach CAPPATEX gefiltert und mit echten Vorschaubildern angezeigt. Browsernachweise lokal und ignoriert: `outputs/gallery-live-collection.jpg` und `outputs/gallery-live-designs-test.jpg` (letzteres zeigt den kurzzeitig freigegebenen Testzustand vor Widerruf).

Dieser abschließende Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht. GitHub enthält nach dem Dokumentationscommit zusätzlich diesen geprüften Bereitstellungsnachweis.

## Bereichstrennung – Version 52

Auf Nutzerwunsch sind die zuvor gemeinsamen privaten Sammlungen jetzt getrennt: `/sammlung` enthält ausschließlich eigene AB3D-3D-Modelle, `/cappatex/sammlung` ausschließlich CAPPATEX-Motive. Navigation, Überschriften, Kategorien, leere Zustände, Studioverweise und Kontolinks benennen den jeweiligen Inhalt. Der gemeinsame Studiofilter entfällt. Auch Freigabeansichten filtern fest nach Bereich (`/galerie/pruefung` und `/cappatex/galerie/pruefung`). Motivdetails liegen unter `/cappatex/werke/[id]`; vorhandene gemeinsame Motivlinks werden erst nach serverseitiger Zugriffsprüfung weitergeleitet. Private Daten werden nicht verschoben oder neu veröffentlicht, Einwilligungen und Dateien bleiben erhalten.

Version **52**, Quellcommit `ef8889ef102c863ccd0075aa239077e9de98695c`, Deployment `appgdep_6ad385929a548191accb2552cb0a992b`, erfolgreich und weiterhin owner-private; Umgebungsrevision unverändert `11`. Typprüfung, Lint, Produktionsbuild und alle **226 Tests** bestanden. Lokaler Browsercheck beider Galerien erfolgreich. Im echten Konto live geprüft: CAPPATEX-Sammlung mit sechs Motivkarten, null Modellkarten und ohne gemischten Studiofilter; 3D-Sammlung mit 24 Modellkarten, null Motivkarten und ohne gemischten Studiofilter. Motiv- und Modelldetails verweisen jeweils zur eigenen Sammlung zurück; der alte Motivlink wird korrekt nach CAPPATEX umgeleitet. Keine Generierung, Bestellung oder Änderung der bisherigen Freigaben erforderlich. Lokale Browsernachweise: `outputs/cappatex-own-designs-separated.jpg`, `outputs/ab3d-own-models-separated.jpg`.
