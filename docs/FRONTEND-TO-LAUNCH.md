# AB3D: von Frontend-Fertigstellung bis Verkaufsstart

Diese Punkte bleiben bewusst deaktiviert, bis Oberfläche, Bedienung und mobile Darstellung freigegeben sind.

## Danach verbinden

- OpenAI Image API für CAPPATEX über `OPENAI_API_KEY` (nur serverseitig)
- Meshy ausschließlich für echte 3D-Generierung und druckfähige Modell-Downloads
- Printify-Katalog über `PRINTIFY_API_TOKEN` und `PRINTIFY_SHOP_ID`
- Shopify Storefront und sichere Webhooks über die vorgesehenen Shopify-Variablen
- Zahlung, Steuer, Versandprofile, Rückgaben und rechtliche Seiten vor Live-Bestellungen prüfen

## Sichere Aktivierungsreihenfolge

1. Produktionszugänge als geheime Hosting-Variablen hinterlegen, niemals im Browser oder Git.
2. Vorschaugenerierung mit Testkonten prüfen; keine automatische Bestellung auslösen.
3. Druckdateien, Größen, Auflösung, Beschnitt und Produktvarianten mit Testaufträgen abnehmen.
4. Checkout und Webhook-Signaturen in Shopify testen.
5. Erst danach `CAPPATEX_GENERATION_ENABLED`, dann `CAPPATEX_FULFILLMENT_ENABLED` aktivieren.
6. `CAPPATEX_AUTO_PRODUCTION_ENABLED` erst nach einem erfolgreichen manuellen End-to-End-Test aktivieren.

## Kostenregel

Kostenpflichtige API-Aufrufe und echte Produktionsaufträge werden erst nach ausdrücklicher Bestätigung des Shopbetreibers ausgelöst.
