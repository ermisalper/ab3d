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
