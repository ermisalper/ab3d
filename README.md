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

Für lokale KI-Aufrufe wird die ignorierte `.env.local` dieses AB3D-Projekts benötigt:

```text
MESHY_API_KEY=...
OPENAI_API_KEY=...
```

Secrets niemals committen. Produktionswerte werden ausschließlich als
geschützte Hosting-Umgebungsvariablen verwaltet.

`MESHY_API_KEY` ist für die 3D-Generierung erforderlich. Design-Guide und
Produktplaner verwenden kostenfreie Shopinformationen beziehungsweise Produktregeln,
solange `OPENAI_ASSISTANT_ENABLED` nicht ausdrücklich `true` ist. Erst mit diesem
separaten Kostenschalter, gesetztem `OPENAI_API_KEY` und angemeldetem Nutzer wird
die Responses API verwendet. Die CAPPATEX-Schalter ersetzen diese Freigabe nicht.

## CAPPATEX: OpenAI, Shopify und Printify

CAPPATEX verwendet OpenAI nur serverseitig. Ein freigegebener Bildaufruf erzeugt
das Original-PNG; Originalbytes und SHA-256 werden gespeichert. Die Vorschau
wird deterministisch verkleinert. Nach Zahlung wird das Motiv weder neu erzeugt
noch durch einen weiteren KI-Aufruf verändert.

Die bestehende Kollektion `cappatex` enthält fertige Motive. Individuell gestaltbare
Blankos gehören in `cappatex-selbst-gestalten` und benötigen ein geprüftes Profil
in `app/cappatex-profiles.ts`: eindeutige Shopify-/Printify-IDs und SKU,
verifizierte Varianten, Druckgeometrie, Auflösung, echtes Produktfoto sowie
Versandnachweise für Schweiz und Liechtenstein. Ohne vollständige Freigabe sind
sie nicht bestellbar. Der aktuelle Prüfstand und offene Konto-Voraussetzungen
stehen in [CAPPATEX-PRODUCTION-STATUS.md](docs/CAPPATEX-PRODUCTION-STATUS.md).

Produktions-Secrets (ausschliesslich über einen sicheren Secret-Eingabekanal):

```text
OPENAI_API_KEY=...
PRINTIFY_API_TOKEN=...
SHOPIFY_WEBHOOK_SECRET=...
```

Der Storefront-Token ist optional und bleibt, falls verwendet, serverseitig.
Nicht geheime Konfiguration: `PRINTIFY_SHOP_ID=23104859`,
`SHOPIFY_STORE_DOMAIN=1hagfh-b0.myshopify.com`, `SHOPIFY_API_VERSION=2026-07`.
Der Printify-Token benötigt `shops.read`, `catalog.read`, `products.read`,
`products.write`, `uploads.write` und `orders.write`.

Alle Freigaben beginnen deaktiviert:

```text
OPENAI_ASSISTANT_ENABLED=false
CAPPATEX_GENERATION_ENABLED=false
CAPPATEX_GENERATION_AUDIENCE=owner
CAPPATEX_GENERATION_ALLOWED_EMAILS=
CAPPATEX_UPLOAD_ENABLED=false
CAPPATEX_CHECKOUT_ENABLED=false
CAPPATEX_FULFILLMENT_ENABLED=false
CAPPATEX_AUTO_PRODUCTION_ENABLED=false
```

`CAPPATEX_GENERATION_ENABLED` erlaubt nach separater API-Kostenfreigabe die
Bildgenerierung für die konfigurierte Zielgruppe. Der Betreiber-Pilot benötigt
eine bestätigte E-Mail-Adresse in `CAPPATEX_GENERATION_ALLOWED_EMAILS`.
Upload und Checkout werden unabhängig freigegeben. Vor jedem Warenkorb wird
ein unveränderlicher Snapshot von Originaldatei, Profil, Variante, Preis,
Menge, Land und bestätigter Platzierung gespeichert.

Der einzige Fulfillment-Weg für individuelle Artikel ist AB3D → Printify API.
`CAPPATEX_FULFILLMENT_ENABLED` erlaubt nach verifizierter Zahlung einen
Printify-Auftragsentwurf mit der unveränderten Originaldatei. Atomare D1-Zustände
sperren doppelte Verarbeitung und unklare API-Ergebnisse; unklare Aufträge
werden manuell abgeglichen. Der Handler sendet keinen Auftrag in Produktion.
`CAPPATEX_AUTO_PRODUCTION_ENABLED` bleibt `false`; ein Wert `true` sperrt den
aktuellen Fulfillment-Weg vorsorglich.

In Shopify wird ein `orders/paid`-Webhook auf
`/api/cappatex/webhooks/shopify` eingerichtet. Der Handler prüft HMAC über die
Rohbytes, Shop, Thema, Zahlung und Snapshot. Vor Aktivierung müssen die
Blanko-Varianten vom nativen Printify-Import entkoppelt sein. Die fertige
Kollektion wird dadurch nicht umgestellt. Produktionsfreigabe bleibt manuell.

Die Zustellung an die derzeit private Site ist noch zu verifizieren:
Shopify-HMAC ersetzt nicht die Sites-Zugangsberechtigung für Serveraufrufe.
Die Zielgruppe der Site wird für einen Webhook nicht eigenmächtig geändert.
Testbestellungen, Druckkosten und Produktionsfreigabe benötigen jeweils die
gesonderte Bestätigung des Betreibers.

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
