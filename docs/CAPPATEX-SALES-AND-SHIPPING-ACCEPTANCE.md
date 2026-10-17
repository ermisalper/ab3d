# Preis-, Versand- und Etikettenabnahme

Stand: 17.10.2026, Fortsetzung nach Version 54. Keine Verkaufs-, Zahlungs- oder Produktionsfreigabe. Ausschliesslich AB3D, Branch `codex/cappatex-production`.

## Bezahlten Versand verbindlich prüfen

Der bisherige Bestellweg prüfte Lieferland und Anbieterversand, aber nicht den tatsächlich bezahlten Shopify-Versandtarif. Der neue Freigabeweg verlangt daher einen belegten Kundentarif und rechnet ihn nicht aus USD-Anbieterraten hoch.

`CAPPATEX_SHIPPING_RELEASES` ist zunächst leer. Eine spätere, ausdrücklich genehmigte Freigabe enthält ID/Version, Prüfzeit und Gültigkeit, Belegreferenzen, richtigen Shopify-/Printify-Shop, CH oder LI, CHF-Betrag, Printify-Methode 1, die exakte Shopify-Versandart (`source`, `code`, `title`) und den normalisierten vollständigen Warenkorb aus Profil/Version, Shopify-Variante und Menge. Identische Varianten dürfen zusammengefasst werden; daraus wird niemals ein Versandpreis berechnet. Gemischte Anbieter oder Warenkörbe benötigen einen eigenen Nachweis.

Vor dem Checkout muss die einzelne Konfiguration abgedeckt sein. Der unveränderliche Snapshot bindet Freigabe-ID, Version und SHA-256. Der Paid-Webhook prüft diese Einzelbindung und zusätzlich den vollständigen Bestellwarenkorb. Die einzelne aktive Versandzeile muss mit der freigegebenen Versandart, dem unveränderten CHF-Preis sowie ursprünglichen, rabattierten und aktuellen Geldfeldern übereinstimmen. Unbekannte Kombinationen, fehlende Daten, andere Währung, Express statt Standard, unerlaubte Rabatte oder geänderte/abgelaufene Belege führen zur manuellen Prüfung. Historische Snapshots werden nicht umgeschrieben; ohne Versandbindung erfolgt ebenfalls eine manuelle Prüfung.

Auch reine Versandänderungen gehören zum Idempotenz-Fingerprint. Eine erneute Zustellung mit geändertem Tarif darf keine zweite Printify-Bestellung erzeugen. Die Betreiberübersicht zeigt solche Fälle als `shipping_unapproved` und bietet keine automatische Wiederholung an.

Feldvertrag: [Shopify Webhooks 2026-07](https://shopify.dev/docs/api/webhooks/2026-07). Eine erfolgreiche synthetische Prüfung dieses Vertrags beweist noch keinen tatsächlich eingerichteten Shopify-Tarif.

## Kaufmännischer Nachweis vor einer Preisfreigabe

Die folgenden Angaben müssen pro Variante und exakter Druckseitenkombination tatsächlich erhoben werden. Unbekannte Werte bleiben unbekannt und werden nicht mit null oder einer vermuteten Währung ersetzt.

| Nachweis | Aktueller Stand / benötigte Angabe |
| --- | --- |
| Identität | Profil/Version, Renderer, Shop/Produkt/Anbieter, SKU und Shopify-/Printify-Varianten-ID |
| Produktionskosten | Exakte Variante mit genau Front, Back oder beiden Seiten im Product Creator prüfen; aktueller Wert noch nicht als Gesamtpreis bestätigt |
| Katalogwährung | Im richtigen Printify-Konto lesen; getrennt dokumentieren |
| Abrechnungswährung | Unter Wallet / Payment details lesen; keine Einstellung ändern |
| Zusatzkosten | Zweite Druckseite, Pflichtetikette, Steuern und gegebenenfalls Gebühren gesondert bestätigen |
| Kundentarif | Tatsächlichen Shopify-CH-/LI-Tarif für die belegte Menge und Warenkorbzusammensetzung prüfen |
| Verkaufsentscheidung | Genehmigter CHF-Stückpreis, Freigabe-ID, entscheidender Betreiber, Zeitpunkt, Gültigkeit und Beleg-Hash |

Printify trennt Katalog- und Abrechnungswährung; eine Anzeigeänderung bestätigt keine gemeinsame Währung. [Printify: Währung](https://help.printify.com/hc/en-us/articles/12203640151953-How-do-I-change-the-currency-on-Printify)

Die Kostenaufschlüsselung im Product Creator hängt von Variante und belegten Druckflächen ab. Weitere DTG-Flächen kosten zusätzlich; Versand und Steuern sind im dortigen Subtotal nicht enthalten. [Printify: Produktionskosten](https://help.printify.com/hc/en-us/articles/14137088858385-Where-can-I-see-a-production-cost-breakdown)

Ein Shopify-Variantenpreis kann derzeit mehrere Seitenkombinationen nur zu demselben ausdrücklich genehmigten Preis abdecken. Unterschiedliche Seitenpreise benötigen eine zusätzliche genaue Zuordnung; kein Browseraufschlag. Shopify-MoneyV2 bleibt jetzt als ursprünglicher Dezimaltext erhalten. Bruchteils-Cents wie `19.901` werden ausgeschlossen, statt sie bei der Freigabeanzeige auf `19.90` zu runden.

## Aktueller Printify-Etikettennachweis

Nur lesende Prüfung im Shop **23104859**: 16 feste GET-Abfragen, 15 erfolgreich, ein 403 beim Upload-Lesezugriff. Alle sechs Blanko-Produkte weiterhin unveröffentlicht; keine Einstellungen oder Produkte geändert.

| Produkt | Aktivierte Varianten | Gespeicherte Positionen | Gefüllte zusätzliche Ebene |
| --- | ---: | --- | --- |
| Gildan 64000 T-Shirt | 10 | front, back, left_sleeve, right_sleeve, neck | neck / DTF |
| B&C King Hoodie | 26 | front, back | Keine beobachtet |
| Bella+Canvas Tanktop | 6 | front, back | Keine beobachtet |
| B&C WUI23 Pullover | 15 | front, back | Keine beobachtet |
| Gildan 2400 Langarmshirt | 14 | front, back, right_sleeve, left_sleeve | Keine beobachtet |
| Poster | 4 | front | Keine beobachtet |

Die aktuelle Hoodie-Vorlage enthält keine Nackenebene; frühere Nachweise beschreiben den damaligen Stand. Nicht beobachtete Zusatzebenen belegen weder allgemeine Etikettenfreiheit noch Produktionsabnahme. Leere Ärmelpositionen sind keine freigegebenen Kundendruckflächen.

T-Shirt-Produkt `6ac927b73b3a3e64620a53a3`, Blueprint 145 / Provider 30: Die Nackenebene hat ID `5941187eb8e7e37b3f0e62e5`, Providerfläche 750 × 750 px, deklarierte Layergrösse 100 × 100 px, Mittelpunkt 0.5/0.5, Skalierung 1, Winkel 0 und keine Spiegelung. Die zehn aktivierten Varianten sind `38163,38164,38177,38178,38191,38192,38205,38206,38219,38220`. Der vorhandene Print-Area-Datensatz umfasst daneben weitere, nicht angebotene IDs.

Die API liefert `src=""`, `type=text/plain`, `layerType=image`, jedoch weder SVG-/Text-/Schriftinhalt noch ausdrückliche Required-/Mandatory-Flags. Der frühere UI-Nachweis „Required layer“ bleibt eine eigenständige Evidenz. Der vorhandene Lesetoken besitzt kein `uploads.read`; der versuchte Metadatenabruf liefert 403. Es wurden keine weiteren Berechtigungen angelegt oder andere Tokens eingesetzt. [Printify API: Uploads](https://developers.printify.com/#uploads)

Verifizierbar ist nur das Layout. Canonicalisierung: rekursiv nach UTF-16-Codeeinheiten sortierte Objektschlüssel, SHA-256 über UTF-8-JSON; Schema `printify-required-layer-metadata-v1`.

- Layout-SHA: `2208cb2390d6cbd40a3947c63db61dcc24c1a017487e9abccd6cda77aa575b8b`.
- Metadaten-SHA für den festgelegten Shop, das Produkt, den Provider, die aktiven Varianten, Fläche/Layout und Dateinamenhash: `8c7d4465ead3c13b9df3622e66ca65df5c7788e26eb00e098d808738bee15ac2`.
- **`contentSha256=null`**. Kein Inhaltserhalt nachgewiesen.

Eine spätere `requiredLayers`-Freigabe muss Inhalt und Layout getrennt bestätigen, Kundenänderungen daran ausschliessen und die Anbieterantwort exakt auf Kundenseiten plus genehmigte Pflichtlayer prüfen. Bild-ID oder Metadatenhash allein reichen nicht. Das T-Shirt-Fulfillment bleibt bis zum Nachweis gesperrt; der bestehende Entwurfsprüfer akzeptiert keine ungeprüfte Zusatzebene.

## Sichtbare Auflösungsgrenze

Der Designer zeigt jetzt die maximal druckbare Motivgrösse aus Originalpixeln und Mindest-DPI. Bei unzureichender Auflösung steht ausdrücklich, dass nur ein Teilbereich gestaltet werden kann. Andere Seitenverhältnisse verursachen beim proportionalen Einpassen Ränder. Eine Datei, die selbst bei minimaler erlaubter Breite nicht reicht, wird nicht als geeigneter Teilbereich beworben.

Die bestehenden 6,29-Megapixel-/12-MB-Quellgrenzen bleiben erhalten. Vollflächige A4-/A3-Poster bei 300 dpi sind damit derzeit nicht erreichbar; eine höhere Grenze erfordert ein gesondert geprüftes Speicher-/Renderkonzept. Die 11 grössten aktuellen Front-/Back-Formate der sechs Produkte wurden mit einem 2048 × 3072-Testmotiv offline gerendert: exakte Provider-PNG-Masse, korrekte Begrenzung, mindestens 300 dpi. Keine neue KI-Anfrage oder physischer Drucktest.

## Konto- und Browsergrenzen

In-App-Browser und separates Computer-Use-Werkzeug scheitern in dieser Sitzung bereits beim Start mit demselben Windows-Sandbox-/Node-Initialisierungsfehler. Keine Sichtprüfung behauptet. Die verfügbare Shopify-Erweiterung wurde zur Einrichtung angeboten; ohne bestätigte Installation und Kontoverbindung wird kein Zugriff behauptet. Unabhängige Codearbeit läuft weiter. Die private Gestaltung bleibt auf die Betreiber-Allowlist beschränkt; ein Shopify-Upgrade allein öffnet keinen öffentlichen Kundenweg.

## Abschliessende technische Prüfung

**389 von 389 Tests bestanden**, ohne übersprungene Tests. Produktionsbuild, vollständiges ESLint, TypeScript und Diff-Prüfung bestanden. Die neuen Regressionen prüfen echte Checkout-/Webhook-Handler vollständig offline: fehlende/abgelaufene oder geänderte Versandfreigaben, Mengen-/Länder-/Basketabweichungen, gemischte Katalogpositionen, Shopify-MoneyBag-Felder, kostenlose/Express-/Rabattabweichungen sowie wiederholte Zustellung mit geändertem Versand nach bereits angelegtem Auftrag. Hinzu kommen Geldtext-/Währungsgrenzen und Druckgrössen-/DPI-/Seitenverhältnistests.

Frisch bestätigte Hosting-Umgebung: Revision **11**, Checkout/Fulfillment/automatische Produktion weiterhin jeweils `false`. Verkaufs- und Versandfreigaberegister sind leer. Keine Migration oder Secretänderung. Die Shopify-Erweiterung ist beim abschliessenden Statusabruf weiterhin **nicht installiert**; die Konto-/Versandprüfung ist damit noch nicht fortgesetzt worden. Keine echten Tarife oder Geschäftsdaten eingetragen, keine kostenpflichtigen Aufrufe, Bestellungen oder Produktion ausgelöst.

## Private Bereitstellung

Version **55** am 17.10.2026 um 15:40 UTC erfolgreich unter `https://ab3d-swiss-design.berk-ermis.chatgpt.site` bereitgestellt. Anwendungscode und geprüfter GitHub-Branch: `adda9d72f78a64f4a62723707be1da1fea7fbc82`. Deployment `appgdep_6ad396cf3e508191a361af4bb37aaa10`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_a130e8f7b2108191abdf808d1eec590c`, Status `succeeded`, Umgebungsrevision **11**, owner-private.

Paket: 114 Dateien / 9.359.360 Bytes, SHA-256 `b07e0ead15e98dd36a13f3692c9e37c8d5f0f55a06ab30d7a8250b20456b1ca0`. Derselbe bekannte Windows-Startfehler des offiziellen Paketierungsschritts erforderte das vorhandene native Windows-Verfahren, direkt aus dem sauberen geprüften HEAD; vorhandene Migrationen unverändert enthalten, Secretwert-Scan ohne Treffer. Der Quellhelfer synchronisierte denselben Commit. Öffnen des Betreiberbereichs in Codex wurde vorgemerkt (`queued`); daraus folgt keine bestätigte Sichtprüfung.

Dieser Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht. Nächster Kontoschritt: bestehendes Shopify-Konto über die angebotene Erweiterung anbinden oder funktionierenden Browserzugang wiederherstellen, dann reale Märkte und Kundentarife lesen. Zusätzliche Printify-Dateileserechte oder ein verifizierter Anbietermechanismus für die gespeicherte Nackenebene sind getrennt zu klären; es wurden keine Berechtigungen erweitert.
