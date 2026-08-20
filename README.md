# AB3D Creator Platform

AB3D verbindet einen kuratierten Schweizer Design-Shop mit einem KI-gestützten
3D-Studio. Angemeldete Nutzer erhalten Design-Tokens und können aus Text oder
Bildern druckbare 3D-Modelle erzeugen.

## Funktionen

- responsiver Premium-Shop mit Warenkorb
- Produkt-Schnellansicht mit Farbe, Grösse und dynamischem Variantenpreis
- geführter Checkout für kontogebundene Bestellanfragen
- serverseitig berechnete Summen, Versandgrenze und Bestellhistorie in D1
- Vorlagen und Kategorien für Wohnobjekte, persönliche Designs und funktionale Produkte
- Text-zu-3D sowie kreative Bildinterpretation vor Bild-zu-3D über Meshy
- interaktiver GLB-Viewer sowie GLB-/STL-Download
- physisch korrekte Grössenskalierung von 5–80 cm über Meshys Resize API
- automatischer CHF-Richtpreis nach Grösse, Material, Finish, Menge und Komplexität
- AB3D Design-Guide mit Shopwissen und optionalem OpenAI-Live-Modus
- Anmeldung mit ChatGPT
- persistente Nutzerkonten und Token-Ledger in Cloudflare D1
- automatische Token-Rückerstattung bei fehlgeschlagenen Generierungen
- Abo-Anfragen für Studio und Pro
- B2B- und individuelle Fertigungsanfragen

## Lokale Entwicklung

Voraussetzungen: Node.js 22+ und pnpm.

```bash
pnpm install
pnpm dev
```

Für lokale KI-Aufrufe wird eine nicht versionierte `.env` benötigt:

```text
MESHY_API_KEY=...
OPENAI_API_KEY=...
```

Secrets niemals committen. Produktionswerte werden ausschließlich als
geschützte Hosting-Umgebungsvariablen verwaltet.

`MESHY_API_KEY` ist für die Generierung erforderlich. Ohne `OPENAI_API_KEY`
antwortet der Design-Guide weiterhin mit kuratiertem Shopwissen. Mit gesetztem
OpenAI-Schlüssel nutzt er für angemeldete Nutzer die Responses API.

## CAPPATEX: OpenAI, Shopify und Printify

CAPPATEX verwendet OpenAI nur serverseitig. Eine Vorschau wird über
`gpt-image-2` als WebP mit niedriger Qualität erzeugt. Nach einem verifizierten
Shopify-Webhook kann dieselbe Vorschau über die Image-Edit-API zu einer
hochwertigen PNG-Druckdatei verfeinert und an Printify übertragen werden.

Erforderliche Produktions-Secrets:

```text
OPENAI_API_KEY=...
PRINTIFY_API_TOKEN=...
PRINTIFY_SHOP_ID=...
SHOPIFY_STORE_DOMAIN=cappatex.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=...
SHOPIFY_WEBHOOK_SECRET=...
```

Kostenpflichtige Schritte sind standardmäßig gesperrt. Die Schalter werden erst
nach Betreiberfreigabe aktiviert:

```text
CAPPATEX_GENERATION_ENABLED=true
CAPPATEX_FULFILLMENT_ENABLED=true
CAPPATEX_AUTO_PRODUCTION_ENABLED=true
```

`CAPPATEX_GENERATION_ENABLED` erlaubt Vorschauen. `CAPPATEX_FULFILLMENT_ENABLED`
erlaubt nach bezahlten Shopify-Bestellungen die finale OpenAI-Datei und einen
Printify-Auftrag. `CAPPATEX_AUTO_PRODUCTION_ENABLED` sendet diesen Auftrag
tatsächlich in Produktion und sollte zuletzt aktiviert werden.

In Shopify wird ein `orders/paid`-Webhook auf
`/api/cappatex/webhooks/shopify` eingerichtet. Die Printify-Produkte müssen in
Shopify veröffentlicht sein und identische SKUs besitzen. Die automatische
Printify-Bestellweiterleitung für diese personalisierten Artikel darf nicht
parallel aktiv sein, sonst kann eine Doppelbestellung entstehen.

## Datenmodell

Die D1-Migrationen befinden sich in `drizzle/`. Schemaänderungen werden mit
`pnpm db:generate` erzeugt und vor dem Deployment geprüft.

## Veröffentlichung

Produktionsversionen werden über OpenAI Sites gebaut und veröffentlicht. Die
Datei `.openai/hosting.json` enthält nur logische Ressourcenbindungen und keine
Zugangsdaten.

## Abrechnung

Konten, Token-Abzug und Abo-Anfragen sind implementiert. Automatische
Kreditkartenzahlungen und monatliche Token-Aufladung werden erst nach Auswahl
und Konfiguration des Zahlungsanbieters aktiviert.

Die Creator-Pläne sind nach Nutzung getrennt: `3D Studio` schaltet STL-, 3MF-
und GLB-Exporte frei, `CAPPATEX` die HD-Motivdateien und `Complete` verbindet
beide Studios mit gemeinsamem Token-Guthaben. Physische 3D-Bestellungen benötigen
kein Kundenabo; nach bestätigter Zahlung erhält AB3D die zugehörige Produktions-STL.
Betreiberkonten für Produktionsfreigaben werden serverseitig über
`AB3D_OWNER_EMAILS` festgelegt.

Kollektion-Bestellungen werden bis dahin als verbindliche Produktionsanfragen
gespeichert. Produktpreise, Varianten und Versand werden serverseitig erneut
berechnet; der Browser kann die zu zahlende Summe nicht vorgeben.

## Sicherheit

Siehe [SECURITY.md](SECURITY.md). Kundenbilder werden nicht dauerhaft im Shop
gespeichert, sondern nur für den jeweiligen Auftrag an Meshy übertragen.
