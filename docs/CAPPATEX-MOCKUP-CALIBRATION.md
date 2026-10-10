# CAPPATEX: gemessene Front-Mockup-Rahmen

Prüfstand: 09.10.2026. **Die Farben wurden separat als Foto-Boundingbox gemessen.** Die Messung beschreibt den Anbieter-Mockup mit der unten angegebenen Unsicherheit, nicht die tatsächliche Drucktoleranz. Die Gildan-64000-Messwerte sind in [cappatex-design-profiles.ts](../app/cappatex-design-profiles.ts) übernommen; die Oberfläche weist auf die Näherung bei Stofffalten hin. Hoodie, Sweatshirt und Tanktop sind in eigenen Abschnitten dokumentiert. Eine Freigabe zur Gestaltung erteilt keine Checkout- oder Fulfillment-Freigabe.

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

## B&C King Hoodie: separat gemessene Frontfotos

Produkt `6ac9455655a9ebcaa50bc346`, Blueprint `517`, OPT OnDemand / Provider `30`, Modell WU02K. Das [Hoodie-API-Audit](../outputs/cappatex-hoodie-api-audit.json) belegt zehn aktive White-/Black-Pure-Varianten S bis 2XL; Shopify-Produkt-ID `15926043509110`, `visible=false`, `is_locked=false` beim Abruf um 19:56:16 UTC. Dies beschreibt die versteckte Verknüpfung, keine Verkaufsfreigabe.

| Grösse, beide Farben | Anbieter-Frontfläche | Abgeleitet bei 300 DPI |
| --- | --- | --- |
| S | 3543 × 2591 px | 299,974 × 219,371 mm |
| M | 3898 × 2850 px | 330,031 × 241,300 mm |
| L, XL, 2XL | 4200 × 3071 px | 355,600 × 260,011 mm |

Die zwei Originalfotos sind jeweils 1200 × 1200 Pixel und ausdrücklich `position=front`, `camera_label=front`: [White, Referenz L / 68258](https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/68258/8876/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front), [Black Pure, Referenz L / 69090](https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/69090/8867/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front). Lokale Originale: [White](../outputs/cappatex-hoodie-white-mockup.jpg), [Black Pure](../outputs/cappatex-hoodie-black-mockup.jpg).

Die vollflächige magentafarbene Messdatei mit 4200 × 4800 Pixeln wurde im Editor mit **Fill to placeholder** eingefügt: 100 %, 14 × 16 Zoll, links 0 %, oben −28,15 %. Das einfarbige Bild überdeckt dadurch die ganze Hoodie-Front; Printify beschneidet es auf die tatsächliche Fläche von 4200 × 3071 Pixeln. Die Bildhöhe von 4800 Pixeln wird ausdrücklich nicht als Hoodie-Druckhöhe übernommen. Die beiden Mess-Screenshots ([White](../outputs/cappatex-hoodie-calibration-white.jpg), [Black Pure](../outputs/cappatex-hoodie-calibration-black.jpg)) zeigen Referenzgrösse L und haben jeweils 1280 × 720 Pixel.

Die unabhängigen Registrierungen anhand unveränderter Kapuzen-, Ärmel- und Saumkanten liefern `Screenshot(x,y)=(248.60,57.62)+0.49438*Blankofoto(x,y)` für White und `(248.70,−8.30)+0.49423*Blankofoto(x,y)` für Black Pure. Der schwarze Screenshot ist somit tatsächlich rund 66 Pixel nach oben versetzt; sein abgeschnittener oberer Kapuzenteil wurde nicht zur Registrierung verwendet. 62 462 beziehungsweise 17 204 Kantenmesspunkte wurden ausgewertet. Separate Fits der Kleidungsregionen weichen an den Messrahmenecken um höchstens 0,061 beziehungsweise 0,165 Originalpixel voneinander ab.

| Foto 1200 × 1200 | White gemessen | Black Pure gemessen |
| --- | --- | --- |
| left | 391,197 px | 391,113 px |
| top | 435,657 px | 435,627 px |
| printWidth | 418,706 px | 418,833 px |
| printHeight | 307,456 px | 307,549 px |

Die gemessenen Screenshot-Aussenrahmen sind `[442,273,649,425]` und `[442,207,649,359]`, rechte/untere Grenze exklusiv. Ganze Pixel ergeben White **391 / 436 / 419 / 307**, Black Pure **391 / 436 / 419 / 308**. Die eine Pixel unterschiedliche gerundete Höhe entsteht an der Rundungsgrenze und belegt keine unterschiedliche physische Druckfläche. Vier Farbschwellen variieren die Grenzen um höchstens 2,024 Originalpixel; als konservative Arbeitsunsicherheit gelten **±3 Originalpixel je Kante**, kein statistisches Konfidenzintervall. Im Randkern bleiben die seitlichen Grenzen beider Farben konstant; feinere Verformungen unterhalb dieser Auflösung sind damit nicht ausgeschlossen. Vollständige Messwerte und Eingabe-Hashes: [White-Analyse](../outputs/cappatex-hoodie-calibration-white-analysis.json), [Black-Pure-Analyse](../outputs/cappatex-hoodie-calibration-black-analysis.json).

Der Betreiber-Agent bestätigte die Entfernung der Messschichten per Undo bis „Nothing to undo yet“; sie wurden nicht gespeichert. Der Abgleich der technischen Rechteckschicht in der Website und ein etwaiger Deploymentnachweis bleiben gesonderte Prüfungen. Keine Bestellung wurde durch diese Messung angelegt.

## Gildan 18000 Sweatshirt: gemessene, gekrümmte Fotoprojektion

Produkt `6ac946e23b3a3e64620a6ea2`, Blueprint `49`, Textildruck Europa / Provider `26`. Das [Sweatshirt-API-Audit](../outputs/cappatex-sweatshirt-api-audit.json) und das [Katalog-Audit](../outputs/cappatex-expansion-catalog-audit.json) belegen die ausgewählten White-/Black-Varianten und Druckflächen.

| Grösse, beide Farben | Anbieter-Frontfläche | Abgeleitet bei 300 DPI |
| --- | --- | --- |
| S | 3319 × 3761 px | 281,009 × 318,431 mm |
| M | 3909 × 4431 px | 330,962 × 375,158 mm |
| L, XL, 2XL | 4500 × 5100 px | 381,000 × 431,800 mm |

Echte API-Frontfotos, jeweils 1200 × 1200 Pixel und Referenz L: [White / 25458](https://images.printify.com/mockup/6ac946e23b3a3e64620a6ea2/25458/98502/cappatex-blanko-gildan-18000-sweatshirt-textildruck-europa.jpg?camera_label=front), [Black / 25459](https://images.printify.com/mockup/6ac946e23b3a3e64620a6ea2/25459/98502/cappatex-blanko-gildan-18000-sweatshirt-textildruck-europa.jpg?camera_label=front); lokale Originale [White](../outputs/cappatex-sweatshirt-white-mockup.jpg) und [Black](../outputs/cappatex-sweatshirt-black-mockup.jpg). Die geprüfte Produktantwort enthält je Farbe eine solche Frontansicht; weitere gespeicherte Kameras sind Back, Neck und Other, keine zweite belegte flache Frontansicht.

Die einfarbige Messdatei 4200 × 4800 Pixel wurde mittels **Fill to placeholder** auf die Anbieterfläche 4500 × 5100 Pixel gelegt. Beide [White-](../outputs/cappatex-sweatshirt-calibration-white.jpg) und [Black-Screenshots](../outputs/cappatex-sweatshirt-calibration-black.jpg) sind 1280 × 720 Pixel; die Vorschau zeigt ausdrücklich L. Die unveränderten Kragen-, Ärmel- und Saumkanten liefern getrennt `Screenshot(x,y)=(248.60,57.62)+0.49436*Blankofoto(x,y)` und `(248.70,23.72)+0.49424*Blankofoto(x,y)`. Der tatsächliche Scrollversatz ist hier rund 34 Pixel. 38 791 beziehungsweise 12 292 Kantenpunkte wurden ausgewertet; unabhängige Regionsfits weichen an den Rahmenkoordinaten um höchstens 0,172 beziehungsweise 0,055 Originalpixel ab.

| Foto 1200 × 1200 | White gemessen | Black gemessen |
| --- | --- | --- |
| left | 370,985 px | 370,872 px |
| top | 314,305 px | 314,179 px |
| printWidth | 457,157 px | 459,291 px |
| printHeight | 542,115 px | 542,247 px |

Die Screenshot-Aussenrahmen sind `[432,213,658,481]` beziehungsweise `[432,179,659,447]`, rechte/untere Grenze exklusiv. Gerundet ergeben sich **371 / 314 / 457 / 542** und **371 / 314 / 459 / 542**. Die Breitenvariation liegt in der Farbschwellenempfindlichkeit von rund 2,024 Originalpixeln. Für die Messung des Aussenrahmens gelten **±3 Originalpixel je Kante** als konservative Arbeitsunsicherheit; die folgende Stoffverformung ist darin ausdrücklich nicht enthalten.

**Dieser Aussenrahmen ist keine ebene Druckflächengeometrie.** Sein Seitenverhältnis beträgt White 0,843284 und Black 0,847015 statt 4500/5100 = 0,882353, also relativ −4,428 % beziehungsweise −4,005 %. Die absolute Verhältnisabweichung 0,039069 / 0,035338 überschreitet die bisherige 0,01-Prüfung. Kein Druckmass wurde zur Anpassung dieser Prüfung verändert. Rund **6,27 % / 6,53 % der Boundingbox** liegen ausserhalb der tatsächlich magentafarbenen Anbieterprojektion.

Die obere Motivkante wölbt sich über rund **18,21 Originalpixel**, die untere Kante über rund **8,09 Pixel**. Im mittleren 80-%-Abschnitt der Motivhöhe verläuft die linke Grenze bis 18,21 Pixel und die rechte bis 10,12 Pixel innerhalb des Aussenrahmens. Die flache technische Rechteckschicht der Website bildet diese Biegung und Verjüngung nicht nach. Eine Nutzung muss deshalb als ausdrücklich belegte **Fotoprojektion mit sichtbarem Näherungshinweis** behandelt werden; Druckpixel, DPI und normalisierte Produktionsplatzierung bleiben davon unabhängig. Die globale Geometrieprüfung darf nicht allein wegen dieser Fotoabweichung pauschal gelockert und kein vermeintlich passendes Rechteck erfunden werden.

Die vollständigen Fits, Farbschwellen, Randmessungen und Eingabe-Hashes liegen in [White-Analyse](../outputs/cappatex-sweatshirt-calibration-white-analysis.json) und [Black-Analyse](../outputs/cappatex-sweatshirt-calibration-black-analysis.json). Der Betreiber-Agent bestätigte die Entfernung der Messschichten per Undo bis „Nothing to undo yet“, ohne Speicherung. Diese Messung umfasst weder Bestellung noch Verkaufsfreigabe; die konkrete Website-Darstellung und deren Freigaberegel sind separat zu prüfen.

## Bella+Canvas 3480 Tanktop: rechteckige Frontfläche

Produkt `6ac948494e4b21bea10a38d4`, Blueprint `39`, Textildruck Europa / Provider `26`. Das [Tanktop-API-Audit](../outputs/cappatex-tanktop-api-audit.json) bestätigt White S/M/L/XL/2XL (`24830/24829/24828/24831/24833`) und Black S/M (`24641/24640`). Das Black-Foto referenziert die **L-Mockup-ID `24639`**, ist in der API aber den beiden verfügbaren Varianten S/M zugeordnet; daraus wird keine zusätzliche kaufbare L-Variante abgeleitet.

| Grösse | Anbieter-Frontfläche | Abgeleitet bei 300 DPI |
| --- | --- | --- |
| S, White/Black | 2362 × 2908 px | 199,983 × 246,211 mm |
| M, White/Black | 2717 × 3344 px | 230,039 × 283,125 mm |
| L/XL/2XL, nur White aktiviert | 3071 × 3780 px | 260,011 × 320,040 mm |

Die echten Frontfotos sind 1200 × 1200 Pixel: [White / 24828](https://images.printify.com/mockup/6ac948494e4b21bea10a38d4/24828/101889/cappatex-blanko-bellacanvas-3480-tanktop-textildruck-europa.jpg?camera_label=front) und [Black / 24639](https://images.printify.com/mockup/6ac948494e4b21bea10a38d4/24639/101889/cappatex-blanko-bellacanvas-3480-tanktop-textildruck-europa.jpg?camera_label=front), lokal [White](../outputs/cappatex-tanktop-white-mockup.jpg) und [Black](../outputs/cappatex-tanktop-black-mockup.jpg). Der Editor zeigt ausdrücklich Referenz L. Die Messdatei 4200 × 4800 wurde per **Fill to placeholder** eingefügt: 78,74 %, 11,02 × 12,6 Zoll, links −3,85 %, oben 0 %. Der seitliche Überstand wird auf die belegten 3071 × 3780 Pixel beschnitten; 12,6 Zoll bei 3780 Pixeln bestätigen 300 DPI.

Die [White-](../outputs/cappatex-tanktop-calibration-white.jpg) und [Black-Screenshots](../outputs/cappatex-tanktop-calibration-black.jpg) mit 1280 × 720 Pixeln wurden unabhängig registriert: `Screenshot(x,y)=(248.70,57.68)+0.49426*Blankofoto(x,y)` und `(248.70,23.73)+0.49421*Blankofoto(x,y)`. 28 211 beziehungsweise 10 075 unveränderte Kantenpunkte an Ausschnitt, Seiten und Saum ergeben unabhängige Regionsabweichungen von höchstens 0,119 beziehungsweise 0,041 Originalpixeln.

| Foto 1200 × 1200 | White gemessen | Black gemessen |
| --- | --- | --- |
| left | 447,740 px | 447,785 px |
| top | 429,571 px | 429,514 px |
| printWidth | 305,507 px | 305,538 px |
| printHeight | 374,297 px | 376,358 px |

Gerundet ergeben sich **448 / 430 / 306 / 374** und **448 / 430 / 306 / 376**. Die Screenshot-Rahmen `[470,270,621,455]` und `[470,236,621,422]` verwenden exklusive rechte/untere Grenzen. Der Höhenunterschied entspricht einem Screenshotpixel und liegt innerhalb der Farbschwellenempfindlichkeit von rund 2,024 Originalpixeln. Arbeitsunsicherheit: **±3 Originalpixel je Kante**. Die absolute Seitenverhältnisabweichung zu 3071/3780 beträgt lediglich 0,003782 beziehungsweise 0,000606 und erfüllt die vorhandene 0,01-Prüfung. Im Randkern bleiben beide Seiten gerade; nur 0,029 % beziehungsweise 0,531 % des Aussenrahmens fehlen in der Magentamaske. Hier ist keine besondere gekrümmte Fotoprojektion erforderlich.

Messwerte, Farbschwellen und Eingabe-Hashes: [White-Analyse](../outputs/cappatex-tanktop-calibration-white-analysis.json), [Black-Analyse](../outputs/cappatex-tanktop-calibration-black-analysis.json). Die Werte wurden zur Profilübernahme weitergegeben; Website-Abgleich und Deployment bleiben separate Nachweise. Diese Analyse veränderte keine Produktdaten und legte keinen Auftrag an.

## B&C WUI23 Pullover: gerade Frontprojektion, 10.10.2026

Printify 6aca555903e91232940b49e4, Blueprint 457 / Textildruck Europa 26. Referenz L: White 63732 / Kamera 5081, Black 63729 / Kamera 5078. Die tatsächlichen Blankofotos aus der Produkt-API haben 1200 × 1200 Pixel. Frontfläche L 4606 × 5787 Pixel. Fill to placeholder mit der vorhandenen Magenta-Messdatei bestätigt Höhe 19.29 Zoll für 5787 Pixel, also 300 Pixel pro Zoll; Skalierung 120.57 %, links −4.97 %, oben 0. Die farbige Messdatei wurde nach der Prüfung zweimal rückgängig gemacht bis „Nothing to undo yet“; ausschliesslich die transparente Blankodatei blieb erhalten, ohne neue Speicherung.

Die gerenderte Printify-Fotovorschau besitzt 2048 × 2048 Pixel und wird im beobachteten DOM auf 593 × 593 Pixel skaliert. Die tatsächliche DOM-Position liefert den Ausgangspunkt der Messung; unveränderte Kragen-/Ärmel-/Saumkanten verfeinern Skalierung und Translation gegen das separate 1200-Pixel-Blankofoto. Die schwarze CMYK-/RGB-Darstellung hat deutlich grössere Helligkeitsabweichungen; deshalb wird die Lage zusätzlich durch die direkte DOM-Geometrie begrenzt, nicht als präziser Farbfit interpretiert.

| Farbe | links | oben | Breite | Höhe |
| --- | --- | --- | --- | --- |
| White | 387 | 353 | 429 | 538 |
| Black | 387 | 352 | 429 | 538 |

Die Farbschwellenprüfung erfolgt mit vier Schwellen. Arbeitsunsicherheit ±3 Originalpixel je Kante. Die gemessene Verhältnisabweichung zur tatsächlichen Frontfläche beträgt 0.001071 und liegt innerhalb der unveränderten 0.01-Grenze. Die Messfläche hat gerade Seiten und kein ausgespartes Loch; Stofffalten bleiben in der Website vereinfacht. Messskript, Eingabe-Hashes, DOM-Geometrie, Schwellen und Ergebnisse: outputs/measure-bc-pullover.py und outputs/cappatex-bc-pullover-calibration-{white,black}-analysis.json. Keine physische Druckabnahme oder Verkaufsfreigabe.

## 2026-10-10: Langarmshirt und Poster

Gildan 2400 / OPT OnDemand, Blueprint 80, Provider 30: tatsächliche Frontvorlage 4200 × 4800 bei 14 × 16 Zoll (300 px/in). L-Fotoreferenz, White-Rechteck 440/357/322/368, Black 437/355/326/372 auf 1200 × 1200. Abweichung des Seitenverhältnisses unter 0.002. Bildschirmgeometrie und unveränderte Foto-Ränder abgeglichen; Unsicherheit ±3 Fotopixel je Rand. Schwarz-Registrierung hat wegen Beleuchtung eine höhere Intensitätsabweichung, die DOM-Geometrie bestätigt die Koordinaten. S/M verwenden ihre tatsächlichen kleineren Druckflächen. Alle Messmotive nach dem Prüfen zweimal zurückgenommen; nur transparente Blankodatei, keine Kalibrierung gespeichert.

Poster EU / OPT OnDemand, Blueprint 443, Provider 30: 11.7 × 16.5 Zoll = 3510 × 4950 Pixel; 8.3 × 11.7 Zoll = 2490 × 3510 Pixel, jeweils 300 px/in und digital-printing. Vier eigene Frontkamera-Fotos (je Format/Papier), alle Rechtecke 251/107/698/985 auf 1200 × 1200. Jede Variante separat mit vollflächiger Magenta-Testdatei im Provider-Preview gemessen, Seitenverhältnisabweichung unter 0.001. Das API-Feld der Fotos lautet tatsächlich position=other, obwohl camera_label=front: nur dieses Profil gestattet other, weiterhin mit exakt registrierter URL und Varianten-ID. Die beiden dunklen Fotoklammern wurden in den tatsächlichen Fotos als Vordergrundkonturen vermessen; Overlay nur in der Vorschau, keine Änderung an Motiv oder Druckgeometrie. Unsicherheit ±3 Fotopixel je Rand. Magenta-Datei nach Messung vollständig zurückgenommen.

Lokale Belege: outputs/cappatex-longsleeve-{white,black}-photo-dom.json, zugehörige Kalibrierungsbilder und Analyse-JSONs; outputs/cappatex-poster-{62338,62339,62354,62355}-photo-dom.json, Kalibrierungsbilder und Analyse-JSONs. Keine kostenpflichtige Bildgenerierung oder Bestellung.
