# Werkstatt-Einstieg und Bedienung beider Studios

## Gestaltungsentscheidungen

Der Besuch beginnt in der Werkstatt: AB3D baut eine gerippte Form Schicht für Schicht, CAPPATEX überträgt ein Bergmotiv auf ein T-Shirt. Diese eine große Bewegung ist das zentrale Gestaltungselement. Die bestehenden interaktiven Produktansichten bleiben erhalten; es werden keine Videos oder kostenpflichtigen Medien erzeugt.

Palette: Tannengrün `#18312f`, Salbei `#486861`, Mineralweiß `#edf2ef`, Kupfer `#a9432e`, heller Stein `#d8e3df`, sanftes Mint `#c9e5c6`. AB3D erhält kühlere mineralische Oberflächen, CAPPATEX wärmere Stoff-/Papierfarben. Die vorhandenen Georgia-Überschriften und Arial-Bedienfelder bleiben erhalten. Die kräftige Kupferfarbe wird für Text und Schaltflächen dunkler; helles Terracotta bleibt als Materialfarbe der Objekte sichtbar. Kontrast Kupfer/Weiß 5,95:1, Kupfer/Mineralweiß 5,26:1, Salbei/Seitenhintergrund 5,69:1. Dunkle Studioflächen erhalten helle Fokuslinien.

## Verhalten

- Startanimation: 5000 ms, einmal pro Bereich und Browser-Sitzung, mit überspringbarer nativer Dialogfläche und Escape. Speicherung der Besuchsmarkierung erst beim tatsächlichen Start. Bei reduzierter Bewegung entfällt sie. Unterseiten sowie Links mit gespeicherter Auswahl oder Sprungmarke werden direkt geöffnet. Im Footer beider Hauptseiten lässt sich der Einstieg über „Startanimation ansehen“ erneut starten.
- Navigation: einheitliche Handlungen „3D gestalten“ und „Motiv gestalten“, sichtbarer aktueller Bereich, direkte Galerie-/Sammlungslinks auch im Hero und Footer. Eigene Motive und Modelle bleiben getrennt.
- Produktauswahl: bei mehreren Größen wird zunächst die vorhandene Größen-/Farbauswahl geöffnet. Keine unsichtbare Standardgröße per Kartenbutton in den Warenkorb. Einfache Produkte bleiben direkt hinzufügbar. Produktdaten, Preise und Checkout-APIs bleiben unverändert.
- Schnellansicht und Warenkorb: Fokus beim Öffnen in den Dialog, Tab/Shift+Tab innerhalb, beim Schließen zurück zum Auslöser. Escape und bisherige Scrollsperren bleiben erhalten.
- 3D-Studio: Vorlagen, Kategorien, Eingabeart und Qualitätsmodus besitzen explizite gedrückte Auswahlzustände. Sprünge zum Formular berücksichtigen reduzierte Bewegung.
- CAPPATEX: drei verlinkte Schritte, konkrete Sperrhinweise vor Erstellung/Upload, Fehler direkt beim betroffenen Button. Nach neuem Motiv zeigt und fokussiert die Seite die echte Platzierungsvorschau; ein altes unbedrucktes Anbieterfoto wird dafür verlassen.
- Druckseiten: übernommen/offen/geändert, gespeicherte/ungespeicherte Zusammenstellung, Hinweise auf Variantenwechsel und unverändert gespeicherte Stände. Kein automatisches Überschreiben von Motivpositionen. Kostenbestätigung, Galerieeinwilligung ohne Vorauswahl, Dateiprüfungen, Idempotenz und sämtliche Verkaufs-/Produktionssperren bleiben erhalten.

## Prüfung

Typprüfung, ESLint, Produktionsbuild und alle 226 vorhandenen Tests bestanden. Die bestehende Intro-Renderprüfung wurde an die neue Datei und das Skip-/Session-Verhalten angepasst. Es wurden keine kostenpflichtigen APIs, Käufe, Abonnements oder Produktionsaufträge ausgelöst.

Browser lokal: beide farblich abgestimmten Hauptseiten, beide Werkstattanimationen, 5-s-Animationsstil, automatisches Ausblenden, Überspringen und Escape, Wiederholung aus dem Footer, direkter Galerieaufruf ohne Intro, Schrittanker im Designer. Schnellansicht: erster Fokus auf Schließen, Shift+Tab bleibt im Dialog, Escape zurück zur Produktkarte; Wechsel Schnellansicht→Warenkorb→Escape ebenfalls mit korrektem Rückfokus. Erreichbarkeitsprüfung beider Hauptseiten, beider Galerien und aller sechs öffentlichen Rechtsseiten.

Die Viewport-Funktion des In-App-Browsers setzt den angeforderten 390-Pixel-Modus nicht um (tatsächliche Breite blieb 2369 Pixel). Responsive CSS und mobile Regeln sind vorbereitet, aber eine echte Smartphone-/Screenreaderprüfung wird nicht behauptet. Die Medienpräferenz für reduzierte Bewegung ist in Code und CSS abgesichert; eine Umschaltung der Betriebssystempräferenz wurde nicht vorgenommen. Die private Pilot-Zielgruppe bleibt unverändert.

## Bereitstellung und Live-Prüfung

Version **53** auf `https://ab3d-swiss-design.berk-ermis.chatgpt.site` erfolgreich und weiterhin owner-private bereitgestellt. Quellcommit `d9a7e758f0a2b89ba68740b96236821b05892143`, Deployment `appgdep_6ad389ded7708191be3c139c4cec83b6`, Umgebungsrevision unverändert `11`. Das Paket enthält 112 Dateien und die unveränderten vorhandenen Migrationen. Der offizielle Quellhelfer synchronisierte den Commit; nach dessen bekanntem Windows-Paketierungsstartfehler wurde die vorhandene native Windows-Paketierung verwendet. Kein Treffer der lokalen OpenAI-/Printify-Schlüssel im Paket.

Auf der bereitgestellten Site geprüft: automatischer AB3D-Einstieg und anschließende Freigabe der Seite; CAPPATEX-Einstieg über den Footer; bestehendes privates Testmotiv `CPX-05473EF09709` ohne neue Generierung geladen. Vorderseite übernommen, Horizontalposition geändert, passende Änderungswarnung sichtbar, erneut übernommen; anschließend Rückseite übernommen. Beide Seiten wurden gemeinsam als „Übernommen“ angezeigt, die Zusammenstellung korrekt als noch nicht gespeichert. Der Shopify-Checkout blieb deaktiviert. Es wurden keine neuen Druckdateien, Bestellungen oder Produktionsaufträge ausgelöst.

Browsernachweise im ignorierten Ausgabeordner: `outputs/ab3d-workshop-intro-live.jpg`, `outputs/cappatex-workshop-intro-live.jpg`, `outputs/cappatex-clear-save-flow-live.jpg`. Dieser Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.
