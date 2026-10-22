# AB3D Creator Platform

AB3D verbindet einen kuratierten Schweizer Design-Shop mit einem KI-gestützten
3D-Studio. Angemeldete Nutzer können mit vorhandenem Token-Guthaben aus Text
oder Bildern druckbare 3D-Modelle erzeugen. Neue Konten erhalten keinen
automatischen Startbonus; bestehende Guthaben bleiben erhalten.

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
- Abo-Anfragen für 3D Studio, CAPPATEX und Complete
- individuelle, unverbindliche Fertigungsanfragen mit geschützter Betreiberprüfung
- interne Angebots- und Fertigungsblatt-Entwürfe mit versionierter CHF-Kalkulation

## Lokale Entwicklung

Voraussetzungen: Node.js ab 22.15.0 und pnpm 11.9.0 (in `packageManager` festgelegt).
Die CI verwendet Node.js 24.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

### Wiederholbarer Qualitätscheck

```bash
pnpm check
```

Der Check führt TypeScript-Prüfung, ESLint, genau einen Produktionsbuild und
anschliessend die Offline-Tests aus. `pnpm test` baut ebenfalls genau einmal
und führt dann die Tests aus. Nach einem bereits abgeschlossenen Build kann
`pnpm test:run` die Tests ohne erneuten Build ausführen; einzelne Tests prüfen
absichtlich die erzeugten Produktionsdateien in `dist/`.

Der GitHub-Workflow `.github/workflows/ci.yml` prüft Pushes auf `main` und
`codex/cappatex-production` sowie Pull Requests. Er installiert mit dem
vorhandenen Lockfile und benötigt keine Anbieter-Secrets. Diese Checks
erzeugen keine echten Generierungen, Zahlungen oder Bestellungen und führen
weder Deployment noch Produktionsmigrationen aus.

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

### Schutz vor mehrfachen Gratis-Konten

Neue Konten beginnen mit **0 Tokens**. Bestehende Guthaben, Pläne und die
ausdrückliche Betreiber-Ausnahme vom Tokenabzug werden nicht verändert.
Kostenlose Beispiele und die regelbasierte Designhilfe bleiben zugänglich.
Ein aktives Abo ist für die Nutzung eines vorhandenen Token-Guthabens nicht
zusätzlich erforderlich. Tokenkäufe bleiben bis zur eigenen Shopabnahme gesperrt.

Vor kostenpflichtigen Meshy-, CAPPATEX-, Assistenten- und Planeraufrufen wird
eine gemeinsame D1-Reservierung gespeichert: standardmässig höchstens **12
Anfragen pro Konto in zehn Minuten**, **30 pro Konto und UTC-Tag** und **100
insgesamt pro UTC-Tag**. Auch Betreiberaufrufe zählen mit. Die optionalen
Serverwerte `AI_ACCOUNT_10_MINUTE_LIMIT`, `AI_ACCOUNT_DAILY_LIMIT` und
`AI_PROVIDER_DAILY_LIMIT` erlauben ganze Zahlen von 0 bis 100000; 0 sperrt.
Ungültige Werte oder eine nicht verfügbare Prüfung sperren Anbieteraufrufe.
Statusabfragen und die kostenlose regelbasierte Hilfe bleiben nutzbar.
Live-Assistent und Live-Planer benötigen vorhandenes Guthaben oder die
ausdrückliche Token-Ausnahme; dabei wird kein neuer Tokenpreis eingeführt.

Die Grenzen zählen zugelassene Versuche, einschliesslich fehlgeschlagener und
unklarer Antworten. Sie sind **kein CHF-Kostenlimit**. Es gibt weder automatische
Wiederholungen noch Rücksetzungen einer verbrauchten Anfrage-Reservierung.
Gespeichert werden nur zufällige ID, Dienst, Zeit und ein SHA-256 der normalisierten
Konto-E-Mail; keine Prompts, Bilder oder IP-Adressen. Der Hash ist pseudonym,
nicht anonym. Verschiedene E-Mails werden dadurch nicht als eine Person erkannt.
Migration `0016_powerful_tenebrous.sql` ist dafür erforderlich und wird in diesem
Arbeitsschritt nur lokal getestet, nicht in Produktion angewendet.

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

Migrationen `0014_third_expediter.sql` für interne Angebotsentwürfe und
`0015_brief_onslaught.sql` für eindeutige Anfragewiederholungen sind nur
vorbereitet und lokal getestet. Eine Anwendung auf die Produktionsdatenbank
oder Bereitstellung dieses Entwicklungsstands ist nicht freigegeben.

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

Anfragen zu eigenen 3D-Modellen sind unverbindlich. Interne Prüfung und
Angebotsentwurf bestätigen weder Zahlung noch Produktionsfreigabe. Physische
Shop-Checkouts und digitale Tokenkäufe besitzen getrennte Zahlungsnachweise;
Browserangaben können keine Preise oder Tokengutschriften festlegen.

## Sicherheit

Siehe [SECURITY.md](SECURITY.md). CAPPATEX speichert Originalmotive und private
Gestaltungen kontogebunden für die Wiederaufnahme und Druckprüfung. Eine
öffentliche Galerie benötigt eine gesonderte Einwilligung und Prüfung.
Offene Betreiberschritte stehen in [NEXT-MANUAL-STEPS.md](docs/NEXT-MANUAL-STEPS.md).
