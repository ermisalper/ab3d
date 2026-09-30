# CAPPATEX: Produktionsanbindung (Stand 30.09.2026)

## Verifiziert

- Printify-Konto `cappatex@gmail.com`, verbundener Shopify-Shop `CAPPATEX`, Printify-Shop-ID `23104859`.
- API-Token `AB3D CAPPATEX Production` liegt ausschliesslich als geheime Sites-Variable `PRINTIFY_API_TOKEN` vor. Rechte: `shops.read`, `products.read`, `uploads.write`, `orders.write`. Nicht im Repository speichern.
- `PRINTIFY_SHOP_ID=23104859` ist als Sites-Variable gesetzt. Die Konfiguration wurde mit der bestehenden privaten Site-Version veröffentlicht.
- Printify-Auftragsfreigabe steht auf **Manual**. `CAPPATEX_FULFILLMENT_ENABLED`, `CAPPATEX_AUTO_PRODUCTION_ENABLED` und `CAPPATEX_GENERATION_ENABLED` bleiben `false`.
- Shopify-Kollektion `cappatex`: sechs aktive Produkte, 30 unterschiedliche, nicht leere Varianten-SKUs.
- Der verbundene Printify-Shop zeigt derzeit **keine eigenen Produkte**. Deshalb ist keine dieser Varianten per SKU einer Printify-Produktionsvariante zuordenbar. Keine Zuordnung erfinden; CAPPATEX-Bestellungen bleiben gesperrt.
- Shopify Storefront API konnte für `Unisex Oversized Boxy Tee / White / XS` einen Warenkorb samt Checkout-URL erzeugen. Die Checkout-Seite stoppt mit „Dieser Shop kann noch keine Bestellungen erhalten“: Shopify-Tarif **Pause and Build**. Es wurde keine Zahlung und keine Printify-Bestellung ausgelöst.

## Erforderlich vor einem echten Testkauf

1. Die sechs Shopify-Produkte ihrem tatsächlichen Printify-Ursprung zuordnen. Falls sie in einem anderen Printify-Konto liegen, den richtigen Shop anbinden; andernfalls druckbare Vorlagen in diesem Printify-Shop erstellen und die Shopify-SKUs bewusst auf die neuen Printify-SKUs abstimmen. Bestehende Kundenprodukte nicht blind überschreiben.
2. Im Shopify-Admin einen verkaufsfähigen Tarif auswählen. Das ist eine kostenpflichtige Entscheidung des Betreibers. Erst danach ist ein Checkout-Test bis zur Eingabe der Versanddaten möglich.
3. Druckgrafik, Platzierung, Varianten, Versandzonen, Steuern und Produktrecht an einem realen Produkt prüfen. Die Printify-Einstellung für EU/UK ist derzeit `Non-EU`; vor EU-Verkäufen GPSR-Konfiguration prüfen.
4. OpenAI-Bildgenerierung und den Shopify-`orders/paid`-Webhook samt Signaturschlüssel vollständig einrichten und kontrolliert testen. Die Produktionsflags erst nach einem erfolgreichen End-to-End-Test aktivieren.
5. Einen echten Testkauf und eine Probeproduktion nur nach Freigabe der entstehenden Kosten durchführen.

Die Anwendung ignoriert mehrdeutige oder doppelte SKUs und akzeptiert beim CAPPATEX-Checkout nur eine Variante, die sowohl in der CAPPATEX-Shopify-Kollektion als auch eindeutig im selben Printify-Produkt liegt.
