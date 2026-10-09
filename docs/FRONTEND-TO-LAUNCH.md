# AB3D: von Frontend-Fertigstellung bis Verkaufsstart

Diese Punkte bleiben bewusst deaktiviert, bis Oberfläche, Bedienung und mobile Darstellung freigegeben sind.

## Danach verbinden

- OpenAI Image API für CAPPATEX über `OPENAI_API_KEY` (nur serverseitig)
- Meshy ausschließlich für echte 3D-Generierung und druckfähige Modell-Downloads
- Printify-Katalog über `PRINTIFY_API_TOKEN` und `PRINTIFY_SHOP_ID`
- Shopify Storefront und sichere Webhooks über die vorgesehenen Shopify-Variablen
- Zahlung, Steuer, Versandprofile, Rückgaben und rechtliche Seiten vor Live-Bestellungen prüfen

## Sichere Aktivierungsreihenfolge

1. Produktionszugänge über einen sicheren Secret-Eingabekanal hinterlegen. Keine Werte in Chat, Tool-Ausgaben, Browser-Code oder Git. `OPENAI_ASSISTANT_ENABLED`, `CAPPATEX_GENERATION_ENABLED`, `CAPPATEX_UPLOAD_ENABLED`, `CAPPATEX_CHECKOUT_ENABLED`, `CAPPATEX_FULFILLMENT_ENABLED` und `CAPPATEX_AUTO_PRODUCTION_ENABLED` bleiben `false`.
2. Den tatsächlichen Printify-Shop, Blanko-Produkte, Shopify-SKUs/IDs, Varianten, Druckflächen und CH-/LI-Versand ohne Bestellung prüfen. Druckgeometrie und Vorschau mit synthetischen Daten testen. Nur vollständig geprüfte Profile freigeben.
3. D1/R2 und Webhook-Konfiguration vorbereiten. `orders/paid` benötigt die richtige Shopdomain und HMAC-Geheimnis. Für die private Site zusätzlich eine unterstützte Zustellung durch Shopify nachweisen; die Shopify-Signatur allein gewährt keinen Sites-Servicezugang. Keine eigenmächtige Änderung der Site-Zielgruppe.
4. Erst nach gesonderter API-Kostenfreigabe `CAPPATEX_GENERATION_ENABLED` für den Betreiber-Pilot einschalten (`CAPPATEX_GENERATION_AUDIENCE=owner` und bestätigte Adresse in `CAPPATEX_GENERATION_ALLOWED_EMAILS`). Original-PNG, daraus verkleinerte Vorschau und Platzierung vergleichen. `OPENAI_ASSISTANT_ENABLED` bleibt davon unabhängig gesperrt, bis auch seine Responses-Aufrufe freigegeben sind.
5. Verkaufsfähigen Shopify-Tarif, Märkte und Versandprofile bestätigen. Checkout CH/LI bis vor Kauf prüfen; den Checkout-Schalter nur für den kontrollierten Test freigeben. Blankos vom nativen Printify-Import entkoppeln, bevor AB3D individuelle Printify-Aufträge anlegt.
6. Testbestellung und `CAPPATEX_FULFILLMENT_ENABLED` nur nach gesonderter Bestätigung. Der Webhook übernimmt die Originaldatei in einen eigenen Printify-Produkt- und Auftragsentwurf; er generiert das Motiv nicht erneut. Kein automatischer Wiederholungsversuch bei unklarem Auftragsergebnis.
7. `CAPPATEX_AUTO_PRODUCTION_ENABLED=false` beibehalten. Der aktuelle Handler besitzt keine Produktionsfreigabe; `true` sperrt seinen Fulfillment-Weg. Kostenpflichtiger Druck und manuelle Produktionsfreigabe brauchen eine weitere ausdrückliche Bestätigung. Erst nach erfolgreicher Abnahme Verkaufsfreigabe erteilen.

## Kostenregel

Kostenpflichtige API-Aufrufe und echte Produktionsaufträge werden erst nach ausdrücklicher Bestätigung des Shopbetreibers ausgelöst.
