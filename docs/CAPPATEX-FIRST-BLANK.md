# CAPPATEX: erster gespeicherter Blanko-Entwurf

Prüfstand: 09.10.2026. Ausschliesslich AB3D unter `C:\Users\berk1\OneDrive\Desktop\ab3d`, Repository `ermisalper/ab3d`.

**In Printify gespeichert und als separater Shopify-Entwurf angelegt; unveröffentlicht und nicht zum Verkauf freigegeben.** Die folgenden Angaben stammen aus den bestehenden Printify-/Shopify-Oberflächen und dem tatsächlichen Printify-API-Leseaudit. Alle zehn SKUs sind eindeutig mit Printify-API-Varianten-IDs und Shopify-GIDs verbunden. Das vollständige Front-Druckprofil für die Produktion und die Trennung vom nativen Bestellimport sind noch nicht freigegeben. Bei der damaligen Blanko-Anlage und dem Leseaudit wurde keine Bestellung, Produktion oder kostenpflichtige API-Generierung ausgelöst. Ein später separat erzeugtes, gespeichertes Motiv wird für die unten beschriebene Gestaltung wiederverwendet.

## Identität und Speicherbestätigung

| Feld | Bestätigter Wert |
| --- | --- |
| Printify-Shop | CAPPATEX, `23104859` |
| Produktname | CAPPATEX Blanko – Gildan 64000 – OPT OnDemand – Pilot |
| Printify-Produkt-ID | `6ac927b73b3a3e64620a53a3` |
| Blueprint | Gildan 64000, `145` |
| Druckanbieter | OPT OnDemand, `30` |
| Verfahren | DTG |
| Status in „My Products“ | Unpublished, 10 Varianten |
| Tags | `cappatex-blank`, `cappatex-pilot` |

Der Betreiber hat die transparente Frontvorlage `outputs/cappatex-blank-4200x4800.png` manuell hochgeladen. Die Speicherung wurde in „My Products“ bestätigt. Screenshot: [cappatex-printify-first-blank-draft.jpg](../outputs/cappatex-printify-first-blank-draft.jpg). Das spätere API-Audit zeigte zusätzlich eine Nacken-Druckebene, die in der Oberfläche als erforderliches Pflegeetikett identifiziert wurde. Die Front bleibt ohne Kundenmotiv; ein vollständig unbedruckter Nacken wird nicht zugesichert.

## Tatsächliches API-Leseaudit

Am **09.10.2026 um 17:57:31.997 UTC** wurden ausschliesslich vier GET-Abfragen ausgeführt. Alle antworteten mit **HTTP 200**: Shopliste, gespeichertes Produkt, Anbieter-Varianten und Anbieter-Versand. Der vollständige bereinigte Nachweis liegt in [cappatex-first-blank-api-audit.json](../outputs/cappatex-first-blank-api-audit.json).

Nach tatsächlicher Betreiberfreigabe wurde dafür der separate Token **CAPPATEX Katalogprüfung** mit ausschliesslich `shops.read`, `catalog.read` und `products.read` sicher als `PRINTIFY_API_TOKEN` in der ignorierten AB3D-`.env.local` gespeichert. Der vorhandene OpenAI-Schlüssel blieb erhalten; der Produktionstoken wurde nicht geändert. Die Tokenliste bestätigte zwei Einträge. [Nachweis der Tokenanlage ohne Schlüsselwert](../outputs/cappatex-printify-read-token-created.jpg). Lesezugriff belegt keine Schreib-, Upload- oder Bestellrechte.

Der API-Nachweis bestätigt Shop `23104859`, Produkt `6ac927b73b3a3e64620a53a3`, Blueprint `145`, Anbieter `30`, zehn aktivierte/verfügbare Varianten sowie `visible=false`. Die externe Produktverknüpfung ist leer (`external.id=""`, `external.handle=null`); das allein beweist keine vollständige Sperre des nativen Bestellimports.

## Vorlage und gespeicherte Einstellungen

- Fronteditor: **14 × 16 Zoll**, **300 DPI**, Vorlage **4200 × 4800 Pixel**, Skalierung **100 %**, Position **links 0 / oben 0**.
- Zwei Front-Mockups gespeichert.
- „Hide in store“ aktiviert; Auswahl auf vorrätige Varianten begrenzt.
- Native Personalisierung deaktiviert; KI-Optimierung der Produktbeschreibung abgewählt.

Diese Editorwerte belegen den gespeicherten Entwurf. Die Anbieter-API bestätigt jetzt unterschiedliche Frontflächen je Grösse, jeweils für White und Black:

| Grösse | Frontfläche laut Anbieter-API | Verfahren |
| --- | --- | --- |
| S | 3461 × 3955 Pixel | DTG |
| M | 3839 × 4387 Pixel | DTG |
| L, XL, 2XL | 4200 × 4800 Pixel | DTG |

Die für L sichtbaren 14 × 16 Zoll dürfen daher nicht pauschal auf alle Grössen übertragen werden. Physische Geometrie, Platzierung und Fotorechtecke müssen weiterhin je Variante zu einem geprüften Druckprofil zusammengeführt werden.

**Erforderliches Pflegeetikett:** Das Produkt enthält laut API unter `neck` mit Verfahren `dtf` eine Ebene `text_layer.svg` (Bild-ID `5941187eb8e7e37b3f0e62e5`, 100 × 100 Pixel). Die Anbieterfläche für `neck` beträgt 750 × 750 Pixel. Die anschliessende UI-Prüfung unter „Neck label inner“ zeigt **Care Instructions / Required layer**, mit dem Tooltip **Add design first to edit**. Sichtbar sind für die Referenzgrösse L die Angaben „L“, „100% Cotton“, „Made in Bangladesh“ und Pflegesymbole. [Screenshot des erforderlichen Pflegeetiketts](../outputs/cappatex-printify-required-care-label.jpg).

Damit ist diese Ebene als automatisch erforderliches Pflegeetikett und nicht als frei hinzugefügtes Kundenmotiv belegt. Sie bleibt erhalten; es war keine Löschung, Produktänderung oder erneute Speicherung nötig. Die Front bleibt unbedruckt, der Nacken trägt das Pflichtetikett. Keine weitere Druckfläche wird allein durch ihr Vorhandensein in der API für Kunden freigegeben.

**Fulfillment-Blocker trotz erfolgreicher UI-Prüfung:** Der aktuelle `draftProductPayload` erstellt ausschliesslich die Frontposition; `draftMatchesSnapshot` akzeptiert nur eine Position. Das erforderliche OPT-Pflegeetikett wird bei der API-Entwurfserstellung deshalb bislang weder ausdrücklich bewahrt noch als Pflichtbestandteil verlangt. Eine tatsächliche Anbieterantwort mit `front` und `neck` würde zur manuellen Prüfung führen, bevor ein Printify-Auftrag angelegt wird. Die UI-Prüfung des bestehenden Entwurfs belegt somit noch keine Verträglichkeit des automatischen Fulfillment-Wegs.

Vor Freigabe braucht es eine genaue Vorgabe für das Pflichtetikett mit geprüftem Inhalts-/Layout-Fingerprint und eine dazu passende, bestätigte Anbieterantwort. Das bereinigte API-Audit enthält keinen SVG-Text- oder Schriftinhalt und reicht dafür nicht aus. Zusätzliche Ebenen oder unerwartete farbige Druckflächenhintergründe dürfen nicht pauschal erlaubt werden. Der vorhandene Pflegeetikett-Nachweis ist keine Bestell- oder Druckfreigabe.

## Tatsächlich gespeicherte Varianten und SKUs

Alle zehn Varianten waren beim Speichern als **In Stock** mit einem angezeigten Printify-Produktpreis von **USD 8.90 je Artikel** ausgewiesen. Das ist eine Momentaufnahme, keine Verfügbarkeitsgarantie oder bestätigte Verkaufskalkulation.

| Farbe | Grösse | Tatsächliche SKU in Printify und Shopify | Shopify-Varianten-GID | Printify-API-Varianten-ID |
| --- | --- | --- | --- | --- |
| White | S | `33603799854393951295` | `gid://shopify/ProductVariant/58948948132214` | `38163` |
| White | M | `16514680811209162343` | `gid://shopify/ProductVariant/58948948164982` | `38177` |
| White | L | `20561467104941246541` | `gid://shopify/ProductVariant/58948948197750` | `38191` |
| White | XL | `18802167567243624716` | `gid://shopify/ProductVariant/58948948230518` | `38205` |
| White | 2XL | `33604710571350644314` | `gid://shopify/ProductVariant/58948948263286` | `38219` |
| Black | S | `95708940648128493227` | `gid://shopify/ProductVariant/58948948296054` | `38164` |
| Black | M | `54345834634857859010` | `gid://shopify/ProductVariant/58948948328822` | `38178` |
| Black | L | `11413559055592218079` | `gid://shopify/ProductVariant/58948948361590` | `38192` |
| Black | XL | `17364865402080621657` | `gid://shopify/ProductVariant/58948948394358` | `38206` |
| Black | 2XL | `77167321191872434834` | `gid://shopify/ProductVariant/58948948427126` | `38220` |

Die SKUs wurden im Shopify-Bulkeditor gespeichert und anschliessend über die Produkt-/Variantenansicht erneut gelesen. Danach wurden sie mit `enabled_variants` des Printify-Produkts und den zehn passenden Anbieter-Varianten abgeglichen. SKUs werden als Zeichenketten behandelt; sie sind keine Printify-Varianten-IDs. Die Tabelle enthält die tatsächlichen IDs aus beiden Systemen, keine aus Bild-URLs abgeleiteten Werte.

Die angezeigten Verkaufspreis-Vorgaben im Entwurf lagen bei **USD 29.99**, ausgenommen **White XL und White 2XL mit USD 30.99**. Diese Vorgaben sind **keine genehmigten CAPPATEX-Verkaufspreise**. Die in der Oberfläche angezeigten **USD 0 Versand** sind **kein Versandnachweis** für die Schweiz oder Liechtenstein.

Der spätere Anbieter-API-Versandnachweis enthält dagegen **CH und LI ausdrücklich** in einem Profil, das alle zehn ausgewählten Varianten umfasst: **USD 8.49 für den ersten Artikel, USD 1.19 je weiteren Artikel**. Dieser verifizierte Anbieterpreis ersetzt weder die noch offene Shopify-Versandkonfiguration noch Steuer-/Zollprüfung oder eine tatsächliche Zustell- und Checkoutabnahme.

## Separater Shopify-Entwurf

| Feld | Bestätigter Wert |
| --- | --- |
| Shopify-Shop | `1hagfh-b0.myshopify.com` |
| Produktname | CAPPATEX Blanko – Gildan 64000 – Pilot |
| Produkt-ID / GID | `15925915418998` / `gid://shopify/Product/15925915418998` |
| Status | Draft |
| Veröffentlichung | Kein Vertriebskanal veröffentlicht |
| Optionen | Color: White, Black; Size: S, M, L, XL, 2XL |
| Bestand | Verfolgt, je Variante 0; Verkauf bei fehlendem Bestand deaktiviert |
| Interner Preis-Platzhalter | Je Variante CHF 0.00; ausdrücklich kein Verkaufspreis |
| Tag | `cappatex-blank` |

[Shopify-Entwurf im Admin](https://admin.shopify.com/store/1hagfh-b0/products/15925915418998) · [Screenshot der gespeicherten SKUs](../outputs/cappatex-shopify-draft-skus.jpg)

Die Beschreibung kennzeichnet CHF 0.00 ausdrücklich als internen Platzhalter. Vor einer späteren Verkaufsfreigabe sind genehmigte Preise, Bestandspolitik, Versand und Produktprofile zu setzen und erneut zu prüfen. Der Entwurf bleibt bis dahin unveröffentlicht und nicht bestellbar. Er wurde manuell angelegt; es wurde kein Printify-Publish und keine native Produktsynchronisierung ausgelöst.

Die separate Shopify-Kollektion **CAPPATEX Selbst gestalten**, ID **`703531843958`**, Handle **`cappatex-selbst-gestalten`**, wurde gespeichert und in der Oberfläche bestätigt. Sie hat **keinen veröffentlichten Vertriebskanal** und enthält genau den manuell aufgenommenen Pilotentwurf `15925915418998`. Die bestehende Katalogkollektion wurde nicht verändert. [Screenshot der Blanko-Kollektion](../outputs/cappatex-shopify-blank-collection.jpg).

## Bildnachweis

Die sichtbaren White- und Black-Vorschaubilder wurden mit jeweils 400 × 400 Pixeln angezeigt:

- [White: Printify-Frontvorschaubild](https://images.printify.com/mockup/6ac927b73b3a3e64620a53a3/38191/97992/cappatex-blanko-gildan-64000-opt-ondemand-pilot.jpg?camera_label=front&t=1791567924394&s=400)
- [Black: Printify-Frontvorschaubild](https://images.printify.com/mockup/6ac927b73b3a3e64620a53a3/38192/97992/cappatex-blanko-gildan-64000-opt-ondemand-pilot.jpg?camera_label=front&t=1791567924394&s=400)

Die Zahlen `38191` und `38192` wurden ursprünglich nicht aus diesen Bildpfaden als Varianten-IDs angenommen. Inzwischen bestätigt der unabhängige Produkt-/Anbieter-API-Abgleich sie als L/White und L/Black. Die API ordnet das White-Mockup allen fünf ausgewählten White-Varianten und das Black-Mockup allen fünf Black-Varianten zu. Die Vorschaubilder belegen weiterhin weder eine druckfähige Originaldatei noch vermessene Platzierungsrechtecke.

## Betreiber-Gestaltung: Implementierung vom 09.10.2026

Der separate [Gestaltungskatalog](../app/cappatex-design-catalog.ts) und das [Gildan-Pilotprofil](../app/cappatex-design-profiles.ts) sind für **White und Black in S, M, L, XL und 2XL** vorbereitet. Sie verwenden die zehn tatsächlich belegten SKU-/Shopify-/Printify-Zuordnungen aus diesem Nachweis. Der Gestaltungskatalog ist ausschliesslich für angemeldete, ausdrücklich freigegebene Betreiberaccounts bestimmt; eine spätere Freigabe der Bildgenerierung für Abonnenten öffnet diesen unveröffentlichten Pilotartikel nicht automatisch für Kunden.

Vor der Ausgabe prüft der Server per GET das tatsächliche Printify-Produkt, Shop-/Blueprint-/Anbieterzuordnung, unveröffentlichten Status, aktive und verfügbare Varianten, eindeutige IDs/SKUs, Farb-/Grössenoptionen, aktuelle Anbieter-Druckflächen und die Zuordnung des Frontfotos zur Variante. Die Profilprüfung verlangt ausserdem dokumentierte, zeitlich gültige Geometrie und ein plausibles Fotorechteck. Abweichende Varianten werden nicht ausgegeben. Die Fotokalibrierung wird separat in [CAPPATEX-MOCKUP-CALIBRATION.md](CAPPATEX-MOCKUP-CALIBRATION.md) belegt; nur Farben mit tatsächlich eingetragenen Messwerten gelangen in den Gestaltungskatalog. Ohne solche Einträge bleibt er leer.

Die bestehende Oberfläche kann damit Produkt, Farbe, Grösse und Menge von 1 bis 5 auswählen und das unveränderte Motiv auf dem echten Frontfoto positionieren. Sie zeigt die Druckfläche der gewählten Grösse, Motivmasse in Millimetern und die aus den Originalpixeln berechnete Auflösung. Die Anfangsplatzierung berücksichtigt das interne Qualitätsziel von 300 DPI. Ein Farb- oder Grössenwechsel innerhalb desselben Produkts erhält die normalisierte Position und Skalierung exakt; eine grössere Druckfläche kann deshalb eine Auflösungswarnung auslösen. Erst beim Wechsel auf ein anderes Produkt wird eine neue Anfangsplatzierung gewählt. Die Fotos zeigen laut Anbieter stets **Referenzgrösse L**; die Oberfläche weist ausdrücklich darauf hin, dass die Druckmasse zur gewählten Grösse gehören.

Das bereits gespeicherte Motiv **`CPX-A3EBF595EF42`** lässt sich über `/cappatex?designId=CPX-A3EBF595EF42` laden. Der neue authentifizierte Metadaten-Endpunkt prüft den Eigentümer und liefert die vorhandene Vorschau samt Originalabmessungen; er löst keine neue Generierung aus. Für dieses Motiv wurden Original **2048 × 2048 Pixel** und deterministische Vorschau **512 × 512 Pixel** bereits anhand ihrer gespeicherten SHA-256-Werte abgeglichen. Produkt, Variante, normalisierte Platzierung, Menge und Lieferland bleiben für einen Reload in der URL erhalten. Fehlt die gespeicherte Produktvariante inzwischen, wird ihre Platzierung nicht auf ein anderes Produkt übertragen: Die Oberfläche fordert eine ausdrückliche Neuauswahl und behält bis dahin die ursprüngliche URL bei.

**Gestaltungsfreigabe ist keine Verkaufsfreigabe.** Der Pilot wird stets mit `purchaseReady=false`, einem sichtbaren Sperrgrund und `price=null` ausgegeben. Die Oberfläche zeigt keinen CHF-0-Platzhalter als Verkaufspreis. Der Checkout verwendet weiterhin ausschliesslich den unabhängigen Verkaufskatalog und dessen vollständige Versand-, Shopify- und Fulfillment-Prüfungen; ein manipuliertes Checkout-POST kann den Gestaltungskandidaten nicht zu einem bestellbaren Profil machen. Die Verkaufsfreigabeliste bleibt getrennt. Es wurden durch diese Implementierung weder Preise oder Bestände in Shopify geändert noch Checkout, Fulfillment oder automatische Produktion freigeschaltet.

Gezielte lokale Tests prüfen Betreiberzugriff, Anbieter-/Foto-/Geometrieabweichungen, die Sperre eines manipulierten Checkouts, die auflösungsabhängige Anfangsplatzierung sowie Wiederherstellung und Variantenwechsel. Typecheck und die gezielte Codeprüfung bestanden. **Dieser Abschnitt dokumentiert den implementierten und lokal geprüften Stand; er bestätigt noch kein Deployment und keine Live-Anzeige des Gestaltungskatalogs.** Den jeweiligen Messstand enthält der separate Kalibrierungsnachweis. Eine Abnahme von Shopify-Checkout oder realem Druck ist damit nicht verbunden.

## Noch vor Freigabe erforderlich

1. Das vermessene Frontprofil im veröffentlichten Designer abgleichen und die tatsächliche API-Auftragsvorlage mit dem Anbieter prüfen. Die bestehende Draft-Prüfung akzeptiert nur die freigegebene Frontfläche. Anforderungen an zusätzliche Druckflächen oder ein Pflegeetikett müssen anhand der Anbieterantwort geklärt werden: Die Printify-Vorgabe für ein eigenes inneres Nackenetikett belegt keine allgemeine Pflicht zu zusätzlichem Nackendruck bei einem reinen Frontmotiv. Vor Verkaufsfreigabe Verfügbarkeit erneut abgleichen.
2. Passende Shopify-Tarife für den bestätigten CH-/LI-Anbieterversand und genehmigte Verkaufspreise einrichten; Checkout und Lieferländer separat abnehmen.
3. Nachweisen, dass der einzige Bestellweg für diese individuellen Artikel AB3D → Printify API ist und kein paralleler nativer Printify-Import entsteht. Bislang wurde nur ein auftragsbezogenes natives Unlink-Verfahren belegt; zum Ausprobieren wurde wegen der fehlenden Bestellfreigabe kein Auftrag angelegt. Eine mögliche Trennung über einen eigenen API-Shop ist nicht implementiert. Der unveröffentlichte Printify-Entwurf und manuelle Shopify-Entwurf allein reichen nicht als Nachweis. Manuelle Produktionsfreigabe beibehalten.
4. Produktions-Schreibrechte getrennt von diesem reinen Leseaudit prüfen. Der neue lokale Token kann keine Produkte, Uploads oder Bestellungen schreiben; der bestehende Produktionstoken wurde nicht ersetzt oder erweitert.

Bis dahin bleibt der Blanko-Entwurf ausserhalb der geprüften, bestellbaren CAPPATEX-Profile. Ein gespeicherter Entwurf ist keine Verkaufs- oder Druckfreigabe.
