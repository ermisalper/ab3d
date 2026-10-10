# CAPPATEX: Erweiterung des privaten Gestaltungskatalogs

Stand: 10.10.2026. Dieser Nachweis ergänzt [das erste Gildan-T-Shirt](CAPPATEX-FIRST-BLANK.md). Er dokumentiert echte Anbieterprodukte und die lokale Implementierung; er bestätigt noch kein Deployment oder eine Verkaufsfreigabe.

## Abgrenzung

Die Profile in [`app/cappatex-design-profiles.ts`](../app/cappatex-design-profiles.ts) sind ausschliesslich für den privaten, authentifizierten Betreiber-Gestaltungskatalog bestimmt. Sie liefern `purchaseReady=false` und `price=null`. Die bestehende Verkaufsfreigabeliste, Checkout, Fulfillment und automatische Produktion bleiben unverändert gesperrt. Anbieterpreise im Audit sind keine genehmigten Verkaufspreise. Kein Testauftrag wurde für diese Erweiterung angelegt.

Die Oberfläche vergleicht das vorhandene Motiv direkt auf den tatsächlich ausgegebenen Produktkarten. Jedes Produkt verwendet sein eigenes geprüftes Foto und seine eigene Druckgeometrie. Variante und normalisierte Platzierung werden je Produkt gemerkt und beim Wechsel zurück wiederhergestellt; dafür wird kein Motiv neu generiert. Die URL erhält diese Einstellungen beim Neuladen. Entfernte Varianten oder geänderte Profilversionen verlangen eine ausdrückliche Neuauswahl. Warnungen und Motivmasse beziehen sich auf die ausgewählte Druckfläche und die Originalpixel des Motivs.

## Echte Produkte und Datenquellen

Die untersuchten Produkte gehören zum Printify-Shop `23104859` und wurden durch bereinigte GET-Nachweise sowie die tatsächliche Shopify-Oberfläche geprüft. Der Gestaltungskatalog prüft Produkt, Anbieter, Optionen, SKU, Verfügbarkeit, Druckfläche und Fotozuordnung vor jeder Ausgabe erneut. Ein Fehler bei einem Produkt sperrt dieses Produkt, ohne die anderen geprüften Produkte zu verbergen.

| Produkt | Printify-Produkt-ID | Blueprint / Anbieter | Shopify-Produkt-ID | Umfang |
| --- | --- | --- | --- | --- |
| B&C King Hoodie WU02K | `6ac9455655a9ebcaa50bc346` | `517` / OPT OnDemand `30` | `15926043509110` | White und Black Pure, S–2XL, zehn Varianten |
| Gildan 18000 Sweatshirt | `6ac946e23b3a3e64620a6ea2` | `49` / Textildruck Europa `26` | `15926044230006` | White und Black, S–2XL, zehn Varianten; nicht im Gestaltungskatalog |
| Bella+Canvas 3480 Tanktop | `6ac948494e4b21bea10a38d4` | `39` / Textildruck Europa `26` | `15926045540726` | White S–2XL, Black S/M; sieben Varianten |

## Tanktop: Zuordnung am 10.10.2026

Produkt-GET um 15:01:54 UTC bestätigt die native Shopify-ID, `visible=false`, `is_locked=false` und sieben aktive Varianten. Shopify wurde als **Entwurf**, mit Tag `cappatex-blank` und ohne Vertriebskanäle gespeichert. Black L ist nur Fotoreferenz und wird nicht als Variante angeboten. Nachweise: `outputs/cappatex-tanktop-api-audit.json` und `outputs/cappatex-tanktop-shopify-links.json`.

| Farbe | Grösse | Printify-ID | Shopify-Varianten-ID | SKU |
| --- | --- | --- | --- | --- |
| White | S | 24830 | 58949386830198 | 19746673615853889641 |
| White | M | 24829 | 58949386895734 | 28550720649768312977 |
| White | L | 24828 | 58949386928502 | 20495463372002808285 |
| White | XL | 24831 | 58949386961270 | 18864056977205457455 |
| White | 2XL | 24833 | 58949386994038 | 26864856465071405094 |
| Black | S | 24641 | 58949386797430 | 33114593541059620971 |
| Black | M | 24640 | 58949386862966 | 22615528761464870906 |

Frontflächen: S **2362 × 2908 px**, M **2717 × 3344 px**, L/XL/2XL **3071 × 3780 px**. 300 Pixel pro Zoll sind im Printify-Editor bestätigt. Die separat gemessenen Fotorechtecke und ihre Unsicherheit stehen in [der Kalibrierung](CAPPATEX-MOCKUP-CALIBRATION.md). Einkaufspreise: USD 19.03, White 2XL USD 21.81. Keine Endkundenpreis- oder Verkaufsfreigabe.

Lokale Nachweise, ohne API-Schlüssel oder vollständige rohe Fehlerantworten:

- [`cappatex-expansion-catalog-audit.json`](../outputs/cappatex-expansion-catalog-audit.json): Anbieter-Varianten, grössenabhängige Frontflächen und ausdrückliche CH-/LI-Versandprofile.
- [`cappatex-hoodie-api-audit.json`](../outputs/cappatex-hoodie-api-audit.json): Produkt-GET vom 09.10.2026, `visible=false`, zehn aktivierte und verfügbare Varianten, echte SKUs, Foto- und Variantenverknüpfungen.
- [`cappatex-hoodie-shopify-links.json`](../outputs/cappatex-hoodie-shopify-links.json): zehn im Shopify-Admin gelesene Variantenlinks mit SKU. Der Hauptagent bestätigte zusätzlich den gespeicherten Status **Entwurf**, Tag `cappatex-blank` und **null veröffentlichte Vertriebskanäle**.
- [`cappatex-sweatshirt-api-audit.json`](../outputs/cappatex-sweatshirt-api-audit.json): Produkt- und Anbieter-GET, `visible=false`, zehn aktivierte und verfügbare Varianten. `external.id` war beim ersten Audit noch leer; der erneute Produkt-GET um 20:02:43 UTC bestätigt nach der Synchronisierung `15926044230006`. Die echten Shopify-Variantenlinks und SKUs wurden anschliessend in [`cappatex-sweatshirt-shopify-links.json`](../outputs/cappatex-sweatshirt-shopify-links.json) erfasst und eindeutig abgeglichen. Der Hauptagent bestätigte den gespeicherten Status **Entwurf**, Tag `cappatex-blank` und **null veröffentlichte Vertriebskanäle**. Daraus wird keine Profilfreigabe abgeleitet.

Die ignorierten `outputs`-Dateien sind lokale Prüfnachweise. Die folgenden Tabellen halten die für die Registrierung wesentlichen Daten auch in der versionierten Dokumentation fest.

## B&C King Hoodie: vollständige Zuordnung

Die Shopify-GIDs der Tabelle lauten jeweils `gid://shopify/ProductVariant/` gefolgt von der angegebenen ID. Das Produkt hat die GID `gid://shopify/Product/15926043509110`. Jede SKU wurde eindeutig mit genau einer aktivierten Printify-Variante und genau einem tatsächlichen Shopify-Variantenlink verbunden; Farb- und Grössenbezeichnungen stammen aus dem unabhängigen Anbieter-Katalog.

| Farbe | Grösse | Printify-ID | Shopify-Varianten-ID | SKU |
| --- | --- | --- | --- | --- |
| White | S | `68254` | `58949378408822` | `79443817543322247857` |
| White | M | `68256` | `58949378474358` | `20608663527267452343` |
| White | L | `68258` | `58949378539894` | `12576155924086547144` |
| White | XL | `68260` | `58949378605430` | `79366225886983859293` |
| White | 2XL | `68262` | `58949378670966` | `10034276845034413921` |
| Black Pure | S | `69088` | `58949378441590` | `98161376281522849245` |
| Black Pure | M | `69089` | `58949378507126` | `47462548419388241756` |
| Black Pure | L | `69090` | `58949378572662` | `15087323398869215439` |
| Black Pure | XL | `69091` | `58949378638198` | `17390505869233129707` |
| Black Pure | 2XL | `69092` | `58949378703734` | `94475536643163851777` |

### Druckflächen und Fotokalibrierung

Nur die Frontfläche mit Verfahren `dtg` wird für die Gestaltung freigegeben. Die Pixelmasse wurden pro Varianten-ID aus der Anbieter-API gelesen und nicht aus der Referenzgrösse hochgerechnet:

| Grösse | B&C King Hoodie | Gildan 18000 Sweatshirt |
| --- | --- | --- |
| S | 3543 × 2591 px | 3319 × 3761 px |
| M | 3898 × 2850 px | 3909 × 4431 px |
| L, XL, 2XL | 4200 × 3071 px | 4500 × 5100 px |

Die Printify-Editorprüfung bestätigt die physische Vorlagenskalierung von **300 Pixeln pro Zoll**: Beim Hoodie ergibt die 4200 Pixel breite Datei 14 Zoll; beim Sweatshirt entsprechen 5100 Pixel Höhe 17 Zoll. Millimetermasse werden daraus mit `Pixel × 25,4 / 300` abgeleitet. Das im Designer verwendete Mindestziel von 300 DPI ist zusätzlich eine CAPPATEX-Qualitätsregel, keine Aussage über eine universelle Anbieterpflicht.

Beide Hoodie-Frontfotos haben 1200 × 1200 Pixel und zeigen die Referenzgrösse **L**. Die Originalfotos wurden separat gegen die tatsächliche Printify-Vorschau mit Messmotiv registriert; die Rechtecke wurden nicht vom T-Shirt übernommen:

| Farbe | Linke Kante | Obere Kante | Breite | Höhe | Gerundet im Profil |
| --- | --- | --- | --- | --- | --- |
| White | 391,1971 | 435,6568 | 418,7063 | 307,4558 | 391 / 436 / 419 / 307 |
| Black Pure | 391,1134 | 435,6271 | 418,8333 | 307,5491 | 391 / 436 / 419 / 308 |

Alle Werte beziehen sich auf das unveränderte 1200-Pixel-Foto. Die konservative Messunsicherheit beträgt etwa **±3 Originalpixel je Kante**, bedingt durch die Skalierung des Screenshots und die Farbschwelle bei der Messung. Die Fotovorschau vereinfacht Stofffalten; sie ist kein physischer Drucknachweis.

- [White: tatsächliches Frontfoto, Referenz L/68258](https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/68258/8876/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front), [Messanalyse](../outputs/cappatex-hoodie-calibration-white-analysis.json).
- [Black Pure: tatsächliches Frontfoto, Referenz L/69090](https://images.printify.com/mockup/6ac9455655a9ebcaa50bc346/69090/8867/cappatex-blanko-bc-king-hoodie-opt-ondemand.jpg?camera_label=front), [Messanalyse](../outputs/cappatex-hoodie-calibration-black-analysis.json).

Die API ordnet jedes Foto den fünf tatsächlichen Varianten seiner Farbe zu. Die Grössenwahl ändert Druckmasse, SKU und DPI-Berechnung; das Anbieterfoto bleibt Referenzgrösse L.

## Sweatshirt: versteckter Vorbereitungsentwurf mit Fotoblocker

Die beiden echten Frontfotos liegen in 1200 × 1200 Pixeln vor, mit L-Referenzen `25458` (White) und `25459` (Black), Kamera `98502`. Das Printify-Produkt bleibt ein versteckter Vorbereitungsentwurf mit `visible=false`. Die separate Registrierung im Gestaltungskatalog wurde bewusst nicht vorgenommen.

| Farbe | Gemessenes umschliessendes Rechteck: links / oben / Breite / Höhe | Abweichung vom Druckflächen-Seitenverhältnis |
| --- | --- | --- |
| White | 370,9847 / 314,3054 / 457,1567 / 542,1151 | −4,43 % |
| Black | 370,8725 / 314,1793 / 459,2910 / 542,2467 | −4,00 % |

Nachweise: [White-Messanalyse](../outputs/cappatex-sweatshirt-calibration-white-analysis.json), [Black-Messanalyse](../outputs/cappatex-sweatshirt-calibration-black-analysis.json). Die Messunsicherheit beträgt etwa ±3 Originalpixel je Kante. Die tatsächliche magentafarbene Messfläche ist gebogen: obere Wölbung bis 18,21 Pixel, untere Wölbung 8,09 Pixel und seitliche Einzüge bis 18,21 Pixel. Etwa 6,3–6,5 % des umschliessenden Rechtecks liegen ausserhalb dieser Fläche.

Das Seitenverhältnis der Fotoprojektion weicht damit um rund vier Prozent von der physischen Druckfläche `4500 / 5100` ab. Ein künstlich gestrecktes Rechteck würde die Messung verfälschen; die bestehende Geometrieprüfung wird nicht aufgeweicht. Eine korrekt unterstützte Fotoprojektion oder eine passende alternative Frontansicht ist erforderlich, bevor dieses Produkt zur Gestaltung angeboten werden kann. Die API-Druckmasse bleiben unverändert.

Das vorhandene Template enthält ausserdem eine `neck`-/DTF-Ebene `text_layer.svg`. Das belegt keine allgemeine Pflicht für einen Frontauftrag und keine Kompatibilität mit der aktuellen API-Auftragsvorlage. Zusätzliche Flächen und Etiketten müssen vor einer späteren Fulfillment-Freigabe anhand der tatsächlichen Anbieterantwort behandelt werden.

Die tatsächlichen Shopify-/Printify-Verbindungen sind trotz der gesperrten Fotogeometrie vollständig dokumentiert. Die Shopify-Produkt-GID lautet `gid://shopify/Product/15926044230006`; die Varianten-GIDs verwenden wieder den Präfix `gid://shopify/ProductVariant/`:

| Farbe | Grösse | Printify-ID | Shopify-Varianten-ID | SKU |
| --- | --- | --- | --- | --- |
| White | S | `25396` | `58949383520630` | `21752147342892613479` |
| Black | S | `25397` | `58949383553398` | `30833902792330291761` |
| White | M | `25427` | `58949383586166` | `20056011931613429211` |
| Black | M | `25428` | `58949383618934` | `15824464539761557625` |
| White | L | `25458` | `58949383651702` | `25170323834236991209` |
| Black | L | `25459` | `58949383684470` | `26834135559939005270` |
| White | XL | `25489` | `58949383717238` | `20325676379259677360` |
| Black | XL | `25490` | `58949383750006` | `84288375471060349755` |
| White | 2XL | `25520` | `58949383782774` | `25317309368002274413` |
| Black | 2XL | `25521` | `58949383815542` | `10120427566848425973` |

## Versand und verbleibende Freigaben

Für **Hoodie und Sweatshirt** enthalten die Anbieter-Versandantworten CH und LI ausdrücklich und umfassen alle zehn ausgewählten Varianten: **USD 10.89 für den ersten Artikel, USD 2.39 je weiteren Artikel**. Für das **Tanktop** sind für alle sieben ausgewählten Varianten ausdrücklich **USD 7.29 für den ersten Artikel und USD 1.99 je weiteren Artikel** belegt. Die Profilwerte werden je Produkt zugeordnet; der Hoodie-Tarif wird nicht auf das Tanktop übertragen. Diese Anbieterwerte sind noch keine genehmigten Shopify-Tarife, Endkundenpreise oder bestätigten Steuer-/Zollbeträge.

Vor Verkauf bleiben insbesondere Preise, Shopify-Versand/Checkout, zulässige Druckflächen, die tatsächliche API-Auftragsvorlage und der einzige idempotente Bestellweg zu prüfen. Die native Printify-Verknüpfung wurde nicht durch einen Testauftrag gelöst oder als sicher ausgeschlossen behauptet. Die Gestaltungserweiterung schafft keine Produktionsfreigabe.

## Lokale Prüfung

Die tatsächliche Registrierung umfasst das bestehende Gildan-64000-T-Shirt und den neuen B&C-King-Hoodie mit je zehn Varianten. Offline-Regressionstests prüfen die vollständige Geometrie beider Profile, eine auflösungssichere Anfangsplatzierung jeder Variante, die abweichenden Hoodie-Frontmasse, die exakte Farbbezeichnung `Black Pure`, den Versanddatensatz und die Trennung von der Verkaufsfreigabeliste. Ein zusätzlicher Test hält das Sweatshirt mit der noch nicht unterstützten Fotoprojektion ausdrücklich aus beiden Registrierungen heraus. Alle drei Tests, Typecheck, gezielte ESLint-Prüfung und Diff-Prüfung bestanden. Ein zusätzlicher direkter Offline-Abgleich der tatsächlichen Registrierung mit den gespeicherten Produkt-, Anbieter- und Shopify-Nachweisen bestätigte alle zehn Hoodie-Varianten, ihre SKUs/GIDs, exakten Foto-URLs, Druckmasse und CH-/LI-Versandwerte. Diese lokalen Prüfungen sind keine Live-Anzeige- oder Druckabnahme.

## Verifikation am 10.10.2026

Die Registrierung enthält jetzt T-Shirt (10), Hoodie (10) und Tanktop (7 Varianten). 132 Tests, TypeScript-Prüfung, vollständiges Lint und Produktionsbuild bestanden. Vier reale Profiltests prüfen 27 Varianten auf Geometrie, auflösungssichere Anfangsplatzierung und getrennte Verkaufsfreigabe. Die lokale Browserseite lädt; ohne Betreiberanmeldung bleibt ihr Katalog korrekt gesperrt. Die Live-Browserabnahme folgt nach privatem Deployment.

Vom Betreiber priorisierte nächste Gruppen: Pullover, Tassen, Langarmshirts, Handyhüllen, Poster. B&C WUI23, Blueprint 457 / Anbieter 26, wurde als versteckter Blankoentwurf `6aca555903e91232940b49e4` angelegt und zur versteckten Shopify-Synchronisierung geschickt. 15 aktive Varianten (White XS–4XL; Black XS/S/M/L/XL/3XL/4XL). Noch nicht im Designer registriert; Fotoabnahme und Shopify-Zuordnung folgen. GET-Nachweis: `outputs/cappatex-bc-pullover-api-audit.json`. Anbieter-Versand CH/LI USD 10.89 + USD 2.39.

## B&C WUI23: bestätigte Zuordnung

Shopify-Produkt 15927108829558 ist als Entwurf mit Tag cappatex-blank gespeichert; keine Vertriebskanäle. Printify bestätigt visible=false und is_locked=false nach der nativen Synchronisierung. Front DTG, Provider 26 / Blueprint 457. CH/LI: USD 10.89 + USD 2.39. Kosten USD 22.22 bis USD 25.80, keine genehmigten Verkaufspreise. Black 2XL wird nicht angeboten. Alle 15 tatsächlichen SKUs wurden eindeutig im Shopify-Admin abgeglichen.

| Farbe | Grösse | Printify | Shopify-Variante | SKU | Frontpixel |
| --- | --- | --- | --- | --- | --- |
| Black | XS | 63714 | 58954577117558 | 32678872341066129788 | 3366 × 4230 |
| White | XS | 63717 | 58954577150326 | 21330026037772914430 | 3366 × 4230 |
| Black | S | 63719 | 58954577183094 | 62750618291080586982 | 3780 × 4749 |
| White | S | 63722 | 58954577215862 | 25449384969924700261 | 3780 × 4749 |
| Black | M | 63724 | 58954577248630 | 95880420421167395577 | 4193 × 5268 |
| White | M | 63727 | 58954577281398 | 24353776547763930379 | 4193 × 5268 |
| Black | L | 63729 | 58954577314166 | 17274892019395195918 | 4606 × 5787 |
| White | L | 63732 | 58954577346934 | 15620322811627210052 | 4606 × 5787 |
| Black | XL | 63734 | 58954577379702 | 43773110261645666736 | 4606 × 5787 |
| White | XL | 63737 | 58954577412470 | 88081754547045227028 | 4606 × 5787 |
| White | 2XL | 63742 | 58954577445238 | 22674604911372817753 | 4606 × 5787 |
| Black | 3XL | 63744 | 58954577478006 | 15638368416559766960 | 4606 × 5787 |
| White | 3XL | 63747 | 58954577510774 | 32388819339877992522 | 4606 × 5787 |
| Black | 4XL | 63749 | 58954577543542 | 49285417354779670938 | 4606 × 5787 |
| White | 4XL | 63752 | 58954577576310 | 15795834611143535959 | 4606 × 5787 |

## CAPPATEX Blanko – Gildan 2400 Langarmshirt – OPT OnDemand: bestätigte Zuordnung

Printify 6aca580a7e00a6f93b0445b0; Shopify 15927119610230; Blueprint 80, Provider 30. Native Synchronisierung abgeschlossen, visible=false. Shopify als Entwurf mit cappatex-blank gespeichert, Varianten ohne Vertriebskanäle. Preise bleiben für den Designer null.

| Option | Grösse | Printify | Shopify-Variante | SKU | Frontpixel |
| --- | --- | --- | --- | --- | --- |
| White | S | 33791 | 58954602676598 | 10966533159593605708 | 3461 × 3955 |
| White | M | 33792 | 58954602742134 | 29415264002795040152 | 3839 × 4387 |
| White | L | 33793 | 58954602807670 | 30327933967500366128 | 4200 × 4800 |
| White | XL | 33794 | 58954602873206 | 14062220185393388474 | 4200 × 4800 |
| White | 2XL | 33795 | 58954602938742 | 13386688221712842581 | 4200 × 4800 |
| Black | S | 33796 | 58954602709366 | 53195723560638243391 | 3461 × 3955 |
| Black | M | 33797 | 58954602774902 | 31423304680849399144 | 3839 × 4387 |
| Black | L | 33798 | 58954602840438 | 16490252266190400769 | 4200 × 4800 |
| Black | XL | 33799 | 58954602905974 | 23511004661059502159 | 4200 × 4800 |
| Black | 2XL | 33800 | 58954602971510 | 32719392498732429126 | 4200 × 4800 |
| White | 3XL | 64722 | 58954603004278 | 20866819771864043377 | 4200 × 4800 |
| Black | 3XL | 64723 | 58954603037046 | 25867235486070762761 | 4200 × 4800 |
| Black | 4XL | 77147 | 58954603069814 | 21783118743071385653 | 4200 × 4800 |
| Black | 5XL | 77171 | 58954603102582 | 57613983606352375621 | 4200 × 4800 |

## CAPPATEX Blanko – Poster Hochformat EU – OPT OnDemand: bestätigte Zuordnung

Printify 6aca585903e91232940b4de3; Shopify 15927121740150; Blueprint 443, Provider 30. Native Synchronisierung abgeschlossen, visible=false. Shopify als Entwurf mit cappatex-blank gespeichert, Varianten ohne Vertriebskanäle. Preise bleiben für den Designer null.

| Option | Grösse | Printify | Shopify-Variante | SKU | Frontpixel |
| --- | --- | --- | --- | --- | --- |
| Glossy | 11.7" x 16.5" | 62338 | 58954622206326 | 22943121005929413080 | 3510 × 4950 |
| Matte | 11.7" x 16.5" | 62339 | 58954622239094 | 33631565641566729113 | 3510 × 4950 |
| Glossy | 8.3" x 11.7" | 62354 | 58954622140790 | 10308888179880755219 | 2490 × 3510 |
| Matte | 8.3" x 11.7" | 62355 | 58954622173558 | 79637912688942858255 | 2490 × 3510 |

Langarmshirt: 14 verfügbare Varianten White S–3XL und Black S–5XL, Front DTG. CH/LI USD 8.49 + USD 1.19 je zusätzlichem Artikel. Poster: 4 verfügbare Varianten, zwei Hochformate × Glossy/Matte, digital-printing; CH/LI USD 8.49 + USD 1.99. Dies sind Printify-Anbieterraten, keine getesteten Shopify-Checkout-Tarife. Produktionskosten Poster USD 6.50–7.09. Keine Verkaufspreise freigegeben.

Damit enthält das private Gestaltungsregister sechs Produktmodelle mit 60 Varianten: T-Shirt 10, Hoodie 10, Tanktop 7, Pullover 15, Langarmshirt 14, Poster 4. Tassen (EU BP441/Provider30) und Tough-Case-Handyhüllen (BP421/Provider23) sind recherchiert, aber ohne bestätigte Fotoprojektion nicht registriert: Tassen benötigen Zylinderprojektion, Hüllen Ausschnitt- und Randmasken sowie verifizierten Produktionsstandort. Diese Gruppen bleiben unsichtbar und nicht bestellbar. Das native Shopify-Import-Unlink sowie manuelle Produktionsfreigabe sind weiterhin Verkaufs-Blocker; das Verkaufsregister bleibt leer.
