# CAPPATEX: gemessene Front-Mockup-Rahmen

Prüfstand: 09.10.2026. **White und Black wurden separat als Foto-Boundingbox gemessen.** Die Messung beschreibt den Anbieter-Mockup mit der unten angegebenen Unsicherheit, nicht die tatsächliche Drucktoleranz. Die gerundeten Messwerte sind inzwischen in [cappatex-design-profiles.ts](../app/cappatex-design-profiles.ts) übernommen; die Oberfläche weist auf die Näherung bei Stofffalten hin. Eine Freigabe zur Gestaltung erteilt keine Checkout- oder Fulfillment-Freigabe.

## Belegte Produktdaten

Gildan 64000, Printify-Shop `23104859`, Produkt `6ac927b73b3a3e64620a53a3`, Blueprint `145`, OPT OnDemand / Provider `30`, Front-DTG. Die zehn echten White-/Black-Varianten in S bis 2XL sind anhand von SKU, Printify-ID und Shopify-GID eindeutig zugeordnet: [vollständiger Nachweis](CAPPATEX-FIRST-BLANK.md#tatsächlich-gespeicherte-varianten-und-skus). Das [bereinigte API-Audit](../outputs/cappatex-first-blank-api-audit.json) bestätigt die folgenden Pixelmasse.

| Grösse, beide Farben | Anbieter-Frontfläche | Abgeleitet bei 300 DPI |
| --- | --- | --- |
| S | 3461 × 3955 px | 293,031 × 334,857 mm |
| M | 3839 × 4387 px | 325,035 × 371,433 mm |
| L, XL, 2XL | 4200 × 4800 px | 355,600 × 406,400 mm |

Die Millimeterwerte ergeben sich aus `px / 300 * 25.4`; sie sind keine separat vermessenen Kleidungsmasse. Der Editor belegt für die Referenz L 14 × 16 Zoll bei 300 DPI. Intern ungerundet rechnen; 300 DPI ist die konservative Auflösungsregel dieses Designers. Printify beschreibt eine proportionale Verkleinerung für S/M und keine Vergrösserung oberhalb L; Editor und Mockups zeigen stets [Referenzgrösse L](https://help.printify.com/hc/en-us/articles/4483635618961-Will-my-design-be-scaled-up-or-down-based-on-the-garment-size).

## Echte Fotos und technische Vorlage

Die über die Produkt-API belegten Frontfotos wurden mit `camera_label=front` als **1200 × 1200 Pixel** heruntergeladen:

- White, Referenzvariante `38191`: [lokales JPG](../outputs/cappatex-blank-white-mockup.jpg), [Printify-Quelle](https://images.printify.com/mockup/6ac927b73b3a3e64620a53a3/38191/97992/cappatex-blanko-gildan-64000-opt-ondemand-pilot.jpg?camera_label=front).
- Black, Referenzvariante `38192`: [lokales JPG](../outputs/cappatex-blank-black-mockup.jpg), [Printify-Quelle](https://images.printify.com/mockup/6ac927b73b3a3e64620a53a3/38192/97992/cappatex-blanko-gildan-64000-opt-ondemand-pilot.jpg?camera_label=front).

Die API ordnet jedes Foto allen fünf Grössen seiner Farbe zu. Die nachfolgende Messung bestimmt die Fotorechtecke für White und Black jeweils durch eine eigene Bildregistrierung.

Die zusätzliche offizielle [technische SVG-Ansicht](../outputs/cappatex-gildan64000-opt-front.svg) besitzt `viewBox="0 0 3547.142 3547.142"` und einen Frontplatzhalter bei `left=1051.855`, `top=779.797`, `width=1439.964`, `height=1631.959`. Dessen Verhältnis weicht um rund 0,84 % von 4200:4800 ab. Diese Zeichnungskoordinaten sind **kein Ersatz für eine Kalibrierung der JPG-Fotos** und werden nicht als Fotorechteck übernommen.

## Separate Messung der White- und Black-Frontfotos

Die Datei [cappatex-calibration-front-4200x4800.png](../outputs/cappatex-calibration-front-4200x4800.png) enthält eine vollständig deckende magentafarbene RGBA-Fläche mit **4200 × 4800 Pixeln**. Sie dient ausschliesslich dazu, im Anbietereditor die volle Frontfläche bei **100 % Skalierung, links 0 / oben 0** im tatsächlichen Mockup sichtbar zu machen. Daraus wurde kein Auftrag ausgelöst.

Nach dem anfänglichen FileChooser-Timeout wurde die Messdatei erfolgreich übernommen. [Editor-Nachweis](../outputs/cappatex-calibration-upload-handoff.jpg): 100 %, 14 × 16 Zoll, links 0 / oben 0. Die tatsächlichen [White-](../outputs/cappatex-calibration-white-full.jpg) und [Black-Vorschauen](../outputs/cappatex-calibration-black-full.jpg) liegen als unveränderte Screenshots mit jeweils 3095 × 1244 Pixeln vor.

Die Lage wurde gegen das jeweilige 1200-Pixel-Blankofoto anhand unveränderter Kantenpixel an Kragen, Ärmeln und Saum registriert: 7086 Messpunkte für White und 2648 für Black. Widersprüchliche DOM-Koordinaten wurden nicht als Messbeleg verwendet. Die gefundene Abbildung lautet für White `Screenshot(x,y) = (894.77,57.83) + 0.9311233333 * Blankofoto(x,y)`, für Black separat `(894.97,-7.94) + 0.9308433333 * Blankofoto(x,y)`. Die um rund 66 Screenshotpixel unterschiedliche vertikale Lage wurde damit tatsächlich erfasst. Separate Fits der vier Kleidungsregionen unterscheiden sich an den Messrahmenecken um höchstens 0,454 Originalpixel bei White und 0,325 bei Black.

| Foto 1200 × 1200 | White gemessen | White gerundet | Black gemessen | Black gerundet |
| --- | --- | --- | --- | --- |
| left | 390,099 px | 390 px | 390,001 px | 390 px |
| top | 315,930 px | 316 px | 314,704 px | 315 px |
| printWidth | 424,219 px | 424 px | 424,346 px | 424 px |
| printHeight | 484,361 px | 484 px | 486,655 px | 487 px |

Die magentafarbene Fläche liegt im White-Screenshot bei `[1258,352,1653,803]`, im Black-Screenshot bei `[1258,285,1653,738]` (rechte/untere Grenze exklusiv). Vier Farbschwellen variieren die einzelnen Grenzen um höchstens rund 1,075 Originalpixel. Zusammen mit Registrierung und JPEG-/Screenshot-Rasterung wird **±2 Originalpixel je Kante** als konservative Arbeitsunsicherheit angesetzt; dies ist kein statistisches Konfidenzintervall. Bei Black liefert die strengste Schwelle beispielsweise `top=315.778`, `printHeight=484.507`; die geringe Differenz zwischen den gemessenen Farbrahmen ist kein Beleg für unterschiedliche physische Druckmasse. Vollständige Werte, Methode und SHA-256 der Eingabedateien: [White-Analyse](../outputs/cappatex-calibration-white-analysis.json) und [Black-Analyse](../outputs/cappatex-calibration-black-analysis.json).

Printify verformt bei beiden Farben den sichtbaren linken Motivrand leicht entlang des Stoffs: im Screenshot von x=1258 bis x=1262, entsprechend rund **4,30 Originalpixeln**. Ein flaches Rechteck bildet deshalb den gemessenen Aussenrahmen ab, aber nicht jede lokale Stoffverformung. Diese Abweichung ist von der Messunsicherheit zu unterscheiden. Die Foto-Boundingbox-Messung ist abgeschlossen; der Abgleich der umgesetzten Website-Vorschau bleibt separat erforderlich. Daraus folgt keine Verkaufs- oder Druckfreigabe.

Nach der Messung wurde die magentafarbene Ebene per Undo entfernt; der Editor zeigte nur noch das ursprüngliche Blanko und keine weitere Undo-Aktion. Der Editor wurde über Go back verlassen. Die anschliessende Produkt-API-Prüfung bestätigte weiterhin `updated_at=2026-10-09 17:45:16+00:00`, also den Stand vor der Messung. Die Kalibrierung wurde nicht als neues Produktdesign gespeichert und löste keinen Auftrag aus. Nach Übernahme der beiden Fotorechtecke bestanden **118 Tests, Produktionsbuild, Lint und TypeScript-Prüfung**; ein Deploymentnachweis gehört zum gesonderten Produktionsstatus.
