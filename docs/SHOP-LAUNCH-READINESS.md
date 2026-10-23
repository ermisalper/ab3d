# Verkaufsvorbereitung für AB3D und CAPPATEX

Stand 23.10.2026. Ausschliesslich `ermisalper/ab3d`, Branch `codex/cappatex-production`. Die Site bleibt owner-private. Dieser Schritt ist keine Verkaufsfreigabe; ältere Prüfprotokolle behalten ihren damaligen Stand.

Neueste Ergänzung: [Private Produktgestaltungen wiederfinden und fortsetzen](CAPPATEX-SAVED-GESTALTUNGEN.md), einschliesslich Vorder-/Rückseiten-Kopien und abgesicherter Tab-Wiederherstellung.

## Weitere Vorbereitung der gemeinsamen Abnahme · 23.10.2026 · nur Quellstand

Fortsetzung auf sauberem `54b3a3da9cc942ebb537c388757dc6a9a2eda833` des bestehenden
Arbeitsbranches. Die vorherigen 843 Tests und der [GitHub-CI-Lauf 39840435619](https://github.com/ermisalper/ab3d/actions/runs/39840435619)
sind erfolgreich abgeschlossen. Keine neuen Produktgruppen, Preise, Anbieter,
Konten oder Freigaben. Keine kostenpflichtigen Vorgänge, Browserprüfung,
Produktionsmigration oder Bereitstellung dieser Ergänzungen.

**Tokenbuchungen:** Zwei bestehende Fehler wurden mit echten Wallet-Funktionen,
lokaler SQLite und absichtlich scheiternden Ledger-Triggern reproduziert:
Abbuchen konnte den Saldo von 10 auf 8 senken, ohne die Buchung zu speichern;
Erstatten konnte `refunded=1` setzen, obwohl die Gutschrift zurückgerollt wurde.
Nun werden Abbuchung und Ledger gemeinsam in einem D1-Batch gespeichert;
Refundmarker, Ledger und Gutschrift bilden ebenfalls einen gemeinsamen Batch.
Konditionierte Folgeschritte gehören genau zum vorherigen Schreibvorgang.
SQL-Fehler rollen die Gruppe zurück. Nach einem behobenen Fehler kann derselbe
bereits erstattungsfähige Task ausdrücklich erneut geprüft werden; parallele
Statusabfragen erzeugen höchstens eine Gutschrift. Bestehende Erstattungsregeln,
Nullkosten und Betreiberbefreiung bleiben erhalten. Keine Migration nötig.

Nur bestätigte D1-Ergebnisse gelten als Buchungsnachweis. Widersprüchliche oder
verlorene Bestätigungen und nachträgliche Saldolesefehler werden als unbestätigt
gemeldet. Meshy startet dann keinen Anbieter-POST. Ein tatsächlich bereits
committeter, aber unbestätigter Debit wird nicht automatisch rückgängig gemacht;
Guthaben/Ledger müssen gegebenenfalls manuell abgeglichen werden. Dies ist keine
neue Wiederherstellungs- oder Korrekturregel.

**CAPPATEX und Galerie:** Generierung und Upload übernehmen nur HTTP200 mit
vollständigem eigenem Motivbeleg: gültige ID und privater Bildpfad, PNG-Format,
Original-/Vorschau-Abmessungen und SHA-256 als korrekt formatierte Zeichenkette.
Fehlende Vorschauwerte werden nicht aus anderen Feldern ergänzt. HTTP202,
HTML, fehlender Hash und falsch typisierte Werte bestätigen kein fertiges Motiv.
Eingaben, hochgeladene Auswahl und Datenschutzentscheidung bleiben bei Fehlern
erhalten. Galerieänderungen benötigen HTTP200 mit `ok=true`; unbestätigte
Veröffentlichungen/Rücknahmen lösen keinen Erfolgsrefresh aus. Die Hashprüfung
des Antwortformats ist keine neue Behauptung einer clientseitigen Byteprüfung.

**AB3D-Shopcheckout:** Der bestehende Streamleser begrenzt nun auch hier die
tatsächlich gelesenen JSON-Bytes auf 20.000. Fehlende oder falsch kleine
Content-Length umgeht diese Grenze nicht. Ungültiges UTF-8, JSON, Nullartikel
und falsch typisierte Mengen werden kontrolliert vor Katalog-/Datenbankzugriffen
abgewiesen. Gültige Warenkorb-, SKU-, Varianten-, AGB- und Sitzungsregeln bleiben
erhalten. Token- und CAPPATEX-Webhooks wurden zusätzlich lesend geprüft; kein
weiterer kleiner wesentlicher Befund. Keine unnötige Änderung ihrer bestehenden
HMAC-, Idempotenz- und Zahlungsartentrennung.

Zusätzlich wurden sämtliche vorhandenen Migrationen mit der bereits installierten
lokalen Miniflare-D1-Laufzeit ausgeführt. Vor 0016 eingefügte synthetische Altbestände
(aktives Abo, 37 Tokens, Ledger und Task) bleiben erhalten, Fremdschlüsselprüfung
ohne Befund. Mit tatsächlichen Wallet-Funktionen wurden dort Debit, vollständiger
Rollback bei Ledgerfehlern, unverbrauchter Refundmarker, sechs parallele Refunds
genau einmal und unzureichendes Guthaben erfolgreich geprüft. Keine produktive
D1-Verbindung, keine Hosting-Konfiguration und keine persistente Testdatenbank.
Grundlage: [D1-Batch-Transaktionen](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
und [SQLite changes()](https://www.sqlite.org/lang_corefunc.html#changes).

**Abschlussprüfung:** `pnpm check` vollständig erfolgreich: TypeScript, ESLint,
genau ein Produktionsbuild und **921/921 Tests**, keine übersprungenen Tests.
78 gezielte neue Regressionen: 31 Wallet-/SQLite-Fälle, zwei zusätzliche
Meshy-Debitfehlerfälle, 21 tatsächliche CAPPATEX-/Galerie-Komponentenfälle und
24 Shopcheckout-Routenfälle. Die Ausgangsfehler wurden vor den Korrekturen
reproduziert. Quellscan über 411 Dateien ohne Treffer vorhandener lokaler
Secretwerte; Diffprüfung erfolgreich. Unabhängige lesende Abschlussprüfung
ohne wesentlichen Befund. Bestehendes Lockfile unverändert, keine neue Abhängigkeit
oder Migration. Logs und lokale D1-Einmalprüfung ausschliesslich im ignorierten
`outputs/`. Browser-, Anbieter-, Zahlungs- und Druckabnahme bleiben offen.
Quellcommits: `a8ebe9a` (atomare Tokenbuchungen), `ba5cd97` (CAPPATEX-/Galeriebelege)
und `029583d` (AB3D-Shopcheckout-Eingaben). Ein Push ist keine Bereitstellung.

Offene Betreiberhandlungen bleiben gesammelt in [NEXT-MANUAL-STEPS.md](NEXT-MANUAL-STEPS.md).

## Konto und Generierungsabläufe absichern · 22.10.2026 · nur Quellstand

Fortsetzung auf sauberem `cc37032f41c8f44502c317d9b96472e90e984357` desselben
Arbeitsbranches. Der vorherige [GitHub-CI-Lauf 39816182706](https://github.com/ermisalper/ab3d/actions/runs/39816182706)
ist inzwischen mit `success` abgeschlossen. Dieser Nachweis gilt für den vorherigen
Stand; die folgenden Änderungen werden separat lokal geprüft und auf GitHub gesichert.
Kein Deployment, keine Produktionsmigration, keine Anbieter-/Browserabfrage und
keine Änderung an Schaltern, Preisen, Zugangsdaten, Verkäufen oder Produktion.

**3D-Studio:** Vor dem ersten asynchronen Verbindungstest wird ein synchroner
Laufwächter gesetzt. Dadurch erzeugt ein Doppelklick bei langsamer Verbindung
keine zwei Generierungsabläufe. Stoppen, Modellwechsel und Verlassen machen alte
Antworten ungültig; nach jeder Antwort wird der Lauf erneut geprüft, bevor Daten
übernommen oder weitere kostenpflichtige Schritte gestartet werden. Verspätete
Druckaufbereitungen überschreiben kein neues Modell. Ein gestoppter Browserlauf
storniert keinen angenommenen Anbieterauftrag; der Hinweis verweist vor einem
erneuten Start auf die eigene Sammlung. Keine neue automatische Erstattungsregel.

Der Verbindungstest benötigt den tatsächlichen HTTP200-Dienstnachweis; jeder
Startbeleg zusätzlich eine gültige Task-ID. HTML, HTTP202 oder unvollständige
Antworten bestätigen keinen Start. Serverseitig bleiben unlesbare Meshy-Annahmen,
fehlende/ungültige Task-IDs, HTTP5xx, Transportfehler nach POST und gescheiterte
lokale Zuordnung nach Annahme ausdrücklich unbestätigt (`provider_submission_uncertain`,
HTTP503). Keine erfundene ID, automatische Wiederholung oder Gutschrift aus einem
unklaren Ausgang. Die bisherige Behandlung nachgewiesener Eingabe-/Autorisierungs-/
Guthaben-/Ratenablehnungen bleibt erhalten. Eine angenommene, aber lokal nicht
zuordenbare Aufgabe benötigt später manuellen Abgleich im vorhandenen Anbieterkonto;
dies ist keine neu implementierte automatische Wiederherstellung.

**Konto und Abo-Anfragen:** Eine weitere Anfrage ersetzt nicht mehr den Status
eines aktiven oder laufenden Testabos durch „pending“. Bereits gesetzte andere
Abostatus, Plan, Guthaben und Ledger bleiben ebenfalls erhalten. Derselbe offene
Planwunsch je Konto wird mit atomarem `INSERT … SELECT … WHERE NOT EXISTS`
zusammengeführt. Es wird weder bezahlt noch ein Abo aktiviert. Fremde Herkunft,
unbekannte Pläne und Browserfelder für Preis, Guthaben oder Status werden
abgewiesen. Eine unklare Transaktionsantwort ist keine Speicherbestätigung;
ein ausdrücklicher Wiederholungsversuch erzeugt keinen zweiten offenen Wunsch.

Die tatsächliche Konto-Komponente erhält pro E-Mail einen eigenen Lebenszyklus.
Verspätete Konto-, Betreiber-, Bestell- und Schreibantworten des vorherigen Kontos
werden verworfen. Synchrone Klicksperren und `finally` verhindern doppelte
Schreibanfragen und hängende Bedienelemente nach Verbindungsfehlern. Nur HTTP200
mit passender Abo-Anfragebestätigung gilt als gespeichert. Ungeprüfte Daten werden
als solche angezeigt; ein fehlgeschlagenes Aktualisieren erfindet kein Nullguthaben
oder eine leere Liste. Der bisherige Plan und der getrennte Planwunsch bleiben erkennbar.

**Anfragegrenzen:** Ein gemeinsamer kleiner Streamleser begrenzt die tatsächlich
gelesenen Bytes vor JSON-Verarbeitung. Fehlende oder falsch kleine Content-Length
umgehen die bisherigen Grössengrenzen nicht mehr. Ungültiges UTF-8, JSON und
falsch typisierte notwendige Eingaben werden vor KI-Aufrufen abgewiesen.
Vorhandene legitime Formate und Grössengrenzen bleiben erhalten. Der Produktplaner
behandelt auch `constructor`/`__proto__` als unbekannte Vorlagen, statt Eigenschaften
des Objektprototyps als Produktregeln zu verwenden.

**Lokal geprüft:** `pnpm check` vollständig erfolgreich: TypeScript, ESLint,
genau ein Produktionsbuild und **843/843 Tests**, keine übersprungenen Tests.
Gegenüber 697 sind 146 gezielte Regressionen hinzugekommen: 17 tatsächliche
3D-Studio-Komponentenfälle, 12 Konto-Komponentenfälle, 9 Konto-/SQLite-Routenfälle
und 108 JSON-/KI-Routen-/Anbieterannahmefälle. Vier Studio-Race-Fehler und elf
ungültige Antwortfälle wurden vor den jeweiligen Korrekturen reproduziert.
Neue Tests prüfen tatsächliche Handler und React-Komponenten, lokale SQLite-Daten
und simulierte Anbieter. Keine unabhängige Nachbildung der Anwendungslogik.
Zusätzliche unabhängige Codeprüfung ohne wesentlichen Befund; dabei 183 gezielte
Offline-Tests ebenfalls erfolgreich. Quellscan über 408 Dateien ohne Treffer
vorhandener lokaler Secretwerte; Diffprüfung erfolgreich. Keine neue Migration
oder Abhängigkeit erforderlich.
Quellcommits: `2b13301` (Anfragegrenzen und unklare Anbieterannahmen), `6effa9e`
(3D-Studio) und `69c233b` (Konto-/Abo-Anfragen). Ein Push ist kein Deployment.
Browserabnahme und externe Anbieter-/Zahlungsabnahme bleiben unverändert offen;
notwendige Betreiberhandlungen stehen in [NEXT-MANUAL-STEPS.md](NEXT-MANUAL-STEPS.md).

## Schutz vor mehrfachen Gratis-Konten · 22.10.2026 · nur Quellstand

Auf ausdrücklichen Betreiberwunsch werden neue Konten mit 0 statt 4 automatischen
Tokens angelegt. Bestehende Guthaben, Zahlungen, Pläne und explizite Ausnahmen
vom Tokenabzug bleiben unverändert. Aktuelle Explorer-/Studio-/Assistententexte
versprechen keinen Startbonus mehr; kostenlose Beispiele und regelbasierte Hilfe
bleiben nutzbar. Vorhandenes Guthaben benötigt kein zusätzliches Abo.

Eine zentrale atomare D1-Reservierung begrenzt kostenpflichtige Meshy-, CAPPATEX-,
Assistenten- und Planeraufrufe gemeinsam. Standard: 12/Konto/10 Minuten,
30/Konto/UTC-Tag, 100/gesamt/UTC-Tag, auch für Betreiber. Ungültige Grenzwerte,
fehlende Tabelle oder unbestätigte Datenbankantwort sperren Anbieteraufrufe.
Prüfung nach Guthaben-/Zugangsprüfung und vor Tokenabzug; Statusabfragen zählen
nicht mit. Live-Textassistent/-Planer benötigen positives vorhandenes Guthaben
oder die explizite Token-Ausnahme, sonst antwortet die kostenlose regelbasierte Hilfe.
Fehlerhafte oder unklare Anbieterantworten geben die Anfrage-Reservierung nicht
automatisch zurück. Die Grenzen zählen Versuche und garantieren kein CHF-Budget.

Die neue Tabelle enthält nur UUID, Konto-Hash, Dienst und Zeit, keine Roh-E-Mails,
Prompts, Bilder, IP-Adressen oder Gerätefingerabdrücke. Der Konto-Hash verbindet
keine unterschiedlichen E-Mail-Adressen mit einer Person. Das Entfernen des
automatischen Bonus verhindert neue Gratisguthaben durch erneute Anmeldung;
historische Restguthaben bleiben bewusst erhalten. Keine CAPTCHA- oder Identitätsprüfung
wurde eingerichtet und keine externe Anbieter-Budgetkonfiguration geprüft.

Migration `0016_powerful_tenebrous.sql` ergänzt die Tabelle und ändert den
Datenbankdefault auf 0 über Kopie ausschliesslich der nicht referenzierten
Guthabenspalte. Kein Löschen der referenzierten Kontotabelle, kein Abschalten von
Fremdschlüsseln. Sie ist nur vorbereitet; Produktionsmigration und Deployment
bleiben ausdrücklich aus. Neue Standardwerte werden ausschliesslich in Code und
`.env.example` dokumentiert, keine Hosting-Variablen oder Geheimnisse geändert.

**Lokal geprüft:** `pnpm check` vollständig erfolgreich: TypeScript, ESLint,
genau ein Produktionsbuild und **697/697 Tests**, keine übersprungenen Tests.
Die tatsächlichen Routen werden mit lokalem SQLite und simulierten Anbietern
geprüft: kein Anbieteraufruf/Tokenabzug bei abgewiesener Reservierung, kein
Quotenverbrauch durch neue unfinanzierte Konten, gemeinsame Betreibergrenzen,
weiter nutzbare Statusabfragen und kostenlose Hilfsantworten. Vier unabhängige
SQLite-Verbindungen überschreiten weder 12 gemeinsame Kontozulassungen noch 100
globale Zulassungen. Migration mit bestehenden Konten und acht Kindtabellen
sowie Unterbrechungen vor/nach dem Spaltenwechsel geprüft: Bestände und
Fremdschlüssel bleiben erhalten bzw. vollständig rücksetzbar. Zusätzliche
unabhängige Codeprüfung ohne wesentlichen Befund. Quellscan über 403 Dateien
ohne Treffer vorhandener lokaler Secretwerte; Diffprüfung erfolgreich.
Keine Browser-, Anbieter-, Zahlungs- oder Live-Abnahme dieses Schritts.

## Weitere Absicherung nach Commit 566ef06 · ausschliesslich lokal

Fortsetzung auf demselben Arbeitsbranch aus sauberem Stand `566ef0602f60e8f970281003b789f045923c1047`. Keine Bereitstellung, Migration, Anbieterabfrage oder Änderung von Preisen, Tokens, Freigaben, Servervariablen oder Zugangsdaten. Bestehende Geschäfts- und Browsergrenzen gelten weiter; die untenstehenden historischen Live-Prüfungen sind keine Abnahme dieser Ergänzungen.

**AB3D-Anfragebestätigung:** Das tatsächliche Studio prüft jetzt die vollständige Antwort vor „Anfrage gespeichert“: HTTP200, `ok=true`, gültige PRINT-ID, unverbindlicher Anfragezustand, CHF und ein sicherer ganzzahliger Centbetrag. Unvollständiges JSON, HTML und HTTP202 bleiben unbestätigt; Kontaktdaten und Wiederholungs-ID bleiben erhalten. Antworten und Netzwerkfehler einer früheren Vorlage oder eines früheren Modus werden nach einem neuen Modell nicht in dessen Zustand übernommen. Höhe, Material, Finish und Menge sind während der Speicherung auch gegen bereits laufende Eingabeereignisse geschützt. Keine Änderung an Generierung, Kalkulation, Anfrage- oder Produktionsfreigaben.

**CAPPATEX-Speichern und Prüfen:** Das Speicherpanel akzeptiert nach vollständiger Inhalts-/Kompositionsprüfung die tatsächlichen Routenverträge HTTP201 für eine neue Speicherung und HTTP200 für eine Wiederholung. HTTP202 bestätigt keine fertige Speicherung. Die gespeicherte Prüfseite akzeptiert für ihre GET- und Checkout-Antworten nur HTTP200. Fehlende oder unlesbare Antworten erzeugen verständliche deutsche Meldungen; sie verlieren weder übernommene Seiten noch die Wiederholungs-ID. Nur eine ausdrückliche fehlgeschlagene Reservierung mit HTTP409/422 und `code=failed` erlaubt eine neue ID; ein gleichnamiger Code bei einem unklaren HTTP503 tut dies nicht. Vorder-/Rückseitenansichten und AGB bleiben vor einer möglichen Weiterleitung erforderlich. Originalmotive, Druckdateien und gesicherte Stände werden durch diese Prüfungen nicht verändert.

Ein Wechsel zu einem anderen gespeicherten Stand oder das Verlassen der Prüfkomponente bricht den alten Checkout-Anfragelebenszyklus ab. Auch ein verspätetes Ergebnis eines nicht auf Abbruch reagierenden Netzwerks kann dann weder einen alten Zahlungslink öffnen noch dessen Fehler im neuen Stand anzeigen. Ein synchroner Guard verhindert eine zweite gleichzeitige Checkout-Anfrage; es werden keine Anbieteraufträge storniert oder automatisch wiederholt.

**Token-Kaufstatus:** Die tatsächliche Kontokomponente prüft Paketflags, bekannte Paket-IDs, Kauf-IDs, UUIDs, positive Ganzzahlbeträge, Tokenmengen und CHF vor der Anzeige. Preis, Tokenmenge und Währung eines neuen Serverangebots müssen zur dargestellten Paketkarte passen; bei einer Änderung fordert die Seite zum Neuladen auf. Bereits gespeicherte historische Kaufpreise werden dabei nicht an aktuelle Paketpreise angepasst. Ein fehlgeschlagenes Statusladen sperrt den zuvor verfügbaren Kaufweg und bewahrt die letzte Historie sowie offene UUID. Nur eine passende bestätigte Gutschrift desselben Pakets kann die lokale Anfrage auflösen. Unbestätigte HTTP202- oder unvollständige Checkout-Antworten öffnen keine Zahlungsseite.

Kontowechsel trennen den Tokenzustand und brechen alte Anfragelebenszyklen ab; verspätete Antworten können keine Zahlung für das vorige Konto öffnen. Eine alte Katalogantwort überstimmt keinen neueren gesperrten Status. Gleichzeitige Klicks erzeugen nur einen laufenden POST. Nach wieder verfügbarem Sitzungsspeicher liest ein ausdrücklicher Statusabruf die bestehende UUID erneut ein und verlangt die Einwilligung für die wiederhergestellte Auswahl erneut. Es wird keine neue Anfrage automatisch gesendet und kein Kauf freigeschaltet.

Die Ergänzungen verwenden die vorhandenen Komponenten, Datenverträge und Testwerkzeuge; keine neue Abhängigkeit, Tabelle oder Migration. Sichtprüfung bei320/390Pixeln, externe Produkt-/Versand-/Etiketten-/Zahlungsabnahme und tatsächlicher Druck bleiben unverändert offen. Die notwendigen Betreiberhandlungen stehen weiterhin ausschliesslich in [NEXT-MANUAL-STEPS.md](NEXT-MANUAL-STEPS.md).

**Prüfung dieser Fortsetzung:** `pnpm check` vollständig erfolgreich: TypeScript, ESLint, ein Produktionsbuild und **649/649 Tests**, ohne übersprungene Tests.21 zusätzliche tatsächliche React-DOM-Regressionen:4 AB3D-,8 CAPPATEX- und9 Tokenfälle. Neue Fehler wurden vor der Korrektur reproduziert und anschliessend gegen die tatsächlichen Antwortverträge geprüft. Quellscan über398 Dateien ohne Treffer vorhandener lokaler Secretwerte; Diffprüfung ohne Inhaltsfehler. Keine neue Browser- oder Live-Abnahme. Der Quellstand wird auf dem bestehenden Arbeitsbranch gesichert; ein Push ist kein Deployment.

## Technische Weiterentwicklung · nur lokaler Quellstand · 20.10.2026

Dieser Auftrag begann auf `codex/cappatex-production` bei sauberem Commit `fd181d9503dda45b0d104898f1096d56f826071a`. Alle folgenden Ergänzungen sind **lokal implementiert und geprüft, nicht bereitgestellt**. Die unten dokumentierte private Version65 ist ein historischer Bereitstellungsnachweis, keine Veröffentlichung dieser Änderungen. Keine Produktionsmigration, kein Deployment, keine Schlüssel-, Tarif-, Zahlungs-, Zielgruppen- oder Freigabeänderung. Bestehende Generierungs- und Upload-Einstellungen wurden nicht zurückgesetzt.

### Interne Angebotsvorbereitung in der vorhandenen Verwaltung

`/betrieb` verwendet weiterhin die vorhandenen Anfragen und Betreiberrechte. Pro Anfrage kommt ein einklappbarer interner Angebotsentwurf hinzu: eigene/externe/noch offene Fertigung, interne Lieferantenreferenz, Material, Farbe, drei Abmessungen, Menge, Druckzeit je Stück, Notizen und geplanter Verkaufspreis für die gesamte Menge. Material, Druckbetrieb, Nachbearbeitung, Verpackung, Versand, externe Fertigung und weitere Kosten werden jeweils einmalig und je Stück erfasst. Jede Position ist offen, ausdrücklich nicht zutreffend oder mit Beträgen erfasst. Leere Beträge bleiben `null`; bekannte Nullkosten müssen ausdrücklich eingegeben werden. Druckzeit erzeugt keinen erfundenen Stundenpreis. Die erwähnte Garage mit sechs H2D ist ausschliesslich ein möglicher bezahlter Dienstleister, ohne vereinbarte Preise, Verfügbarkeit, Partnerschaft oder Beteiligung.

CHF-Eingaben werden als Dezimaltext in ganze Cent umgewandelt. Serverseitig gilt: Gesamtkosten = einmalige Kosten + Stückkosten × Menge. Die kalkulatorische Marge = geplanter Gesamtverkaufspreis − vollständig erfasste Gesamtkosten; die Prozentangabe bezieht sich auf den Verkaufspreis, nicht auf den Kostenaufschlag. Bei fehlenden Angaben bleiben Gesamtkosten und Marge offen. Bekannte Teilbeträge sind als Zwischensummen bezeichnet; unbekannte einmalige und stückbezogene Teilbeträge bleiben getrennt offen. Keine Steuer-, Lieferzeit- oder Gewinnannahme. Die Oberfläche zeigt ausschliesslich die Berechnung der gespeicherten Version, niemals vermeintlich bestätigte Browser-Summen.

GET/PUT unter `/api/ab3d/operations/[id]/offer` sind ausschliesslich für konfigurierte Betreiber freigegeben. PUT prüft Herkunft, tatsächliche JSON-Streamgrösse (20.000Bytes), genaue Felder, sichere Cent-Ganzzahlen, Mengen-/Text-/Massgrenzen und gespeicherte Version. Kalkulations-, Zahlungs- und Produktionsfelder aus dem Browser werden abgewiesen. Entwurf und knapper Versionsnachweis werden atomar gespeichert; die Rückgabe bestätigt genau den eigenen Schreibvorgang. SHA-256 und strenge gespeicherte Payloadprüfung verhindern, dass beschädigte Daten als leerer Entwurf erscheinen. Datenbankfehler geben keine internen Texte oder Kundendaten preis.

Die neue Migration `0014_third_expediter.sql` ergänzt ausschliesslich `production_offer_drafts` und `production_offer_events` mit Fremdschlüsseln und eindeutigem Versionsindex. Sie wurde nur erzeugt und in lokalem SQLite mit Alt- und Neudaten geprüft. Bestehende Anfrage-, Preis-, Prüf-, Token-, Zahlungs- und Produktionsdaten werden nicht geändert. Ohne spätere genehmigte Migration/Bereitstellung ist die neue Funktion nicht live verfügbar.

Die anschliessenden Tests bedienen auch das tatsächliche AB3D-Studio über Planer, Vorschau und Druckpaket bis zum Anfrageformular. Alle Antworten sind synthetisch, auch das WebGL-SDK ist im DOM-Test durch einen gekennzeichneten Testtreiber ersetzt; die tatsächliche React-Viewer-Komponente bleibt eingebunden. Ungültige Kontaktdaten und ungeprüfte Wandstärken sperren die Anfrage. Bei Verbindungsfehlern bleiben Eingaben erhalten und eine deutsche Meldung verweist auf die Kontoprüfung. Dabei wurde zusätzlich eine echte Wiederholungslücke im Anfrage-Endpunkt festgestellt: Nach verlorener Speicherbestätigung konnte ein erneuter ausdrücklicher Klick einen zweiten Datensatz erzeugen. Der Studio-Client erhält deshalb eine stabile UUID je normalisiertem Anfrageinhalt, der Server einen eindeutigen kontoabhängigen Wiederholungsschlüssel samt Inhaltshash. Gleiche Wiederholungen geben die ursprüngliche Anfrage zurück; geänderte Eingaben mit derselben ID werden abgewiesen. Legacy-Anfragen bleiben unverändert und ohne erfundene ID. Migration `0015_brief_onslaught.sql` bereitet dafür zwei optionale Spalten und einen partiellen Eindeutigkeitsindex vor; auch sie wird ausschliesslich lokal getestet und nicht produktiv angewandt.

Ungespeicherte Eingaben werden je Betreiber und Anfrage im Tab wiederhergestellt. Ungültige Geldtexte bleiben bis zur Korrektur erhalten. Gesperrter Sitzungsspeicher wird sichtbar gemeldet; Eingaben bleiben in der Ansicht und können ausdrücklich auf dem Server gespeichert werden. Doppelklicks werden synchron gebremst; unbestätigte Antworten lösen keine automatische Wiederholung aus. Versionskonflikte erfordern Neuladen, Vergleich und eine ausdrückliche Entscheidung. Ein Fertigungsblatt zeigt den gespeicherten internen Stand einschliesslich Kosten; es wird weder versandt noch als Auftrag, Zahlung oder Freigabe behandelt.

### Lesende CAPPATEX- und Token-Freigabeprüfung

Der vorhandene Bereich `/cappatex/betrieb` trennt Konfigurationsschalter von elf Nachweisbereichen: Variantenzuordnung, Druckseiten, Fotos, Druckdateien, Preise, CH-/LI-Versand, Pflichtlayer, Bestellweg, Webhook-Zustellung, digitale Tokenvarianten und Trennung der Zahlungsarten. Jeder Punkt nennt Geltungsbereich, Prüfgrundlage, deren Datum und nächsten fehlenden Nachweis. „Belegt“ gilt nur für diese Grundlage. „Veraltet“ folgt ausschliesslich einer tatsächlich hinterlegten Gültigkeitsfrist, keinem erfundenen Alterslimit. Laden/Aktualisieren führt keine Anbieterprüfung oder Schreibaktion durch.

Die historischen Katalog- und Dateiprüfungen werden nicht zu heutigen Live-Nachweisen erklärt. Verkaufs-, Versand- und Tokenfreigaberegister bleiben leer. T-Shirt-Nackeninhalt und historische ungeprüfte Rückseitenfotos bleiben blockiert. Schreibrechte, Importtrennung, private Webhook-Zustellung, echte CHF-Preise, Versand und Zahlungen bleiben extern abzunehmen. Eine Tokenzahlung erzeugt weiterhin keinen Printify-Auftrag; eine physische Bestellung keine Tokengutschrift. Keine automatischen Erstattungsregeln hinzugefügt.

### Reproduzierbare Qualitäts- und Bedienungsprüfung

`pnpm check` führt TypeScript, vollständiges ESLint, genau einen Produktionsbuild und danach alle Offline-Tests aus. CI prüft nun Pushes auf `main` und `codex/cappatex-production` sowie Pull Requests, mit Node24, deklariertem pnpm11.9.0, eingefrorenem bestehendem Lockfile und ohne Anbieter-Secrets. Lokal ist pnpm11.25.0 vorhanden; eine Offline-Installation mit unverändertem Lockfile ist erfolgreich. Ein tatsächlich ausgeführter GitHub-Lauf wird erst nach dessen Ergebnis behauptet.

Die einzige zusätzliche Entwicklungsabhängigkeit `linkedom@0.18.13` ermöglicht echte React-DOM-Komponententests. Der Testaufbau importiert die Anwendungskomponenten, verwendet synthetische Konten, simulierten Sitzungsspeicher und Anbieterantworten und ersetzt keine Anwendungslogik. Front-/Back-Übernahme, Produkt-/Schrittwechsel, fehlende Varianten, Druckdateifehler, Wiederaufnahme, Netzwerkfehler, unklare Speicherung, Doppelklicks, gesperrter Speicher und parallele Bearbeitung werden gezielt geprüft. Bestehende Routenregressionen decken weiterhin falsche Varianten, Preisänderungen, Versandabweichungen, beschädigte Dateien, HMAC, doppelte Zahlungen, unklare Anbieterantworten und die Trennung physischer/digitaler Bestellungen ab; diese Tests wurden nicht dupliziert oder abgeschwächt.

Zwei reproduzierte Designerfehler sind behoben: ein erfolgreich validiertes Nachladen entfernt die zugehörige veraltete Bildfehlermeldung; Schritt3 bleibt ohne gültige, ausdrücklich bestätigte Variante gesperrt. Beim neuen Angebotsbereich wurden unbekannte Kostenarten getrennt gehalten und technische Netzwerkfehler in eine verständliche deutsche Meldung übersetzt.

**Prüfgrenzen:** Aktuelle Browserprüfung einschliesslich tatsächlicher 320-/390-Pixel-Geometrie fehlt wegen bestehender Zugriffssperren. Diese wurden nicht mit anderen Ports, Browsern oder Werkzeugen umgangen. Responsive CSS-Regeln sind im Quellcode geprüft; DOM-Tests messen weder Layout noch echte Bild-/Druckqualität. Keine externen Konten, Anbieter, Webhooks, Käufe oder Produktionsdateien in diesem Auftrag live verifiziert. Notwendige Betreiberschritte ausschliesslich unter [NEXT-MANUAL-STEPS.md](NEXT-MANUAL-STEPS.md).

**Abschlussprüfung dieses Quellstands:** `pnpm check` erfolgreich: vollständige TypeScript-Prüfung, vollständiges ESLint, ein Produktionsbuild und **628/628 Tests**, ohne übersprungene Tests. Gegenüber dem unveränderten Ausgangsstand mit573 Tests sind55 gezielte Prüfungen hinzugekommen:28 tatsächliche React-DOM-Bedienungstests,15 Angebots-/SQLite-/Routentests,8 zusätzliche Anfrage-Idempotenz-/Migrationsregressionen und4 Nachweismodelltests. Beide neuen Migrationen wurden mit bestehenden und neuen Anfragen geprüft; hinzu kommen Fremdschlüssel, eindeutiges Audit, Rollback, konkurrierende Versionen, verlorene Speicherbestätigungen und die Rückkehr zu einer vorherigen unbestätigten Anfrage. Quellscan über396 versionierte oder zum Commit vorgesehene Dateien ohne Treffer vorhandener lokaler Secretwerte; keine Testberichte mit echten Kundendaten erzeugt. `git diff --check` ohne Inhaltsfehler. Logs liegen ausschliesslich im ignorierten `outputs/`.

**Übergabestatus:** Implementiert und lokal geprüft wie oben beschrieben; kein aktueller Browser-, externer Verbindungs-, Zahlungs-, Versand- oder Drucktest. Kein Deployment und keine Produktionsmigration. Eine Git-Sicherung auf dem Arbeitsbranch ist erlaubt; sie stellt keine Veröffentlichung oder Verkaufsfreigabe dar. Alle ausschliesslich vom Betreiber abhängigen Schritte sind gesammelt unter [NEXT-MANUAL-STEPS.md](NEXT-MANUAL-STEPS.md).

## Kurze Prompt-Beispiele in beiden Studios · 20.10.2026

Die Eingabefelder erklären jetzt in jeweils zwei kurzen Sätzen, was eine hilfreiche Beschreibung enthält, mit einem sichtbaren Beispiel auch nach dem Tippen. AB3D nennt Objekt, Form und Zweck mit einem oben offenen Eulen-Stiftehalter als Beispiel. CAPPATEX nennt Motiv, Farben, Anordnung und Schriftzug mit einer mittigen alpinen Blume als Beispiel. Bestehender AB3D-Erklärungstext und die doppelte CAPPATEX-Unterzeile wurden ersetzt beziehungsweise entfernt. Die Hinweise sind über `aria-describedby` mit ihren Eingaben verbunden; kein zusätzliches Pflichtformular, kein automatisches Einfügen und keine Generierung.

Grundlage sind die am20.10.2026 gelesenen offiziellen [Meshy-Prompt-Empfehlungen](https://docs.meshy.ai/en/webapp/guides/prompting) und der [Text-to-3D-API-Ablauf](https://docs.meshy.ai/en/api/text-to-3d): konkrete Objektbeschreibung und wichtige Formdetails statt allgemeiner Qualitätswörter; zuerst Geometrie, im anschliessenden Refine-Schritt die Textur. Daraus folgt keine Garantie für exakte Masse, Beschriftung oder Übereinstimmung. Für Fotos wurden die [offiziellen Hinweise zu Bildqualität und mehreren Ansichten](https://docs.meshy.ai/en/webapp/image-to-3d) mit dem tatsächlichen AB3D-Code abgeglichen.

Die Fotohilfe passt zum gewählten Ablauf: Originalgetreue Verarbeitung nutzt die Bilder für die Form; ein Textwunsch wird nur bei tatsächlich verwendeter Qualitätstextur angeboten und als Farb-/Oberflächenwunsch bezeichnet. Im allgemeinen kreativen Ablauf beschreibt der Text die vorgeschaltete Bildänderung. Der spezialisierte Creative-Lab-Ablauf überträgt diesen Freitext nicht; sein bislang irreführendes Eingabefeld wird ausgeblendet und durch eine kurze Fotohilfe ersetzt. Vorhandene API-Payloads, Anbieteraufrufe, Kosten, Berechtigungen und Produktionssperren bleiben unverändert.

Keine neuen Tests für reine Textdarstellung. Die vorhandenen573 Tests, Typprüfung, vollständiges ESLint und Produktionsbuild sind erfolgreich. Quellscan über378 Dateien ohne Treffer vorhandener lokaler Secretwerte. Die gespeicherten Browserregeln bleiben respektiert; keine neue Sichtprüfung oder kostenpflichtige Generierung. Versionsnachweis folgt nach erfolgreichem Deployment.

### Private Bereitstellung · Version 65

Version **65** ist seit20.10.2026 um **20:07 Schweizer Zeit** (18:07 UTC) erfolgreich privat bereitgestellt. Anwendungscode `6e36c1dd57a5c4a0e07e820956771538f6bfd379` stimmt auf GitHub und in der gespeicherten Site-Version überein. Deployment `appgdep_6ad7adc3c8ec8191a0334ffaa15c78c2`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_5e36f55b5ea08191824ebcfb101f0172`, Status `succeeded`, Umgebungsrevision unverändert **11**. Weiterhin ein erlaubter Betreiber, null externe Besucher; Checkout, Fulfillment und automatische Produktion unverändert gesperrt. Keine API-Schlüssel, Tarife oder Zahlungsarten geändert.

Gespeichertes Hosting-Paket:152 Dateien,13.629.440 Bytes, Archivhash `sha256:54f148fa11edc41d7dbc2eb46364e829e9b539bcdf453ed733569038087a45ae`. Lokale komprimierte Transportdatei7.394.934 Bytes, SHA-256 `06980a5e99572f9caa5f6bd4537792df35ef065153dd1f5410f7377a9265630e`. Paket-Scan ohne Treffer vorhandener lokaler Secretwerte. Der offizielle Quellhelfer synchronisierte den Commit; nach seinem bekannten technischen Windows-Paketierungsstartfehler paketierte das bestehende lokale Windows-Verfahren denselben sauberen, geprüften Quellstand. Keine Genehmigungsablehnung wurde umgangen.

Die native Bereitstellung ist bestätigt. Das Öffnen von `/cappatex#studio` in Codex ist vorgemerkt (`queued`); dies bestätigt keine Browser-Sichtprüfung. Keine neue Generierung oder echte Bestellung. Dieser Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.

## AB3D-Anfragen persönlich bearbeiten · 20.10.2026

Auf Betreiberwunsch folgt als nächster selbstständig umsetzbarer Schritt eine eigene AB3D-Auftragsverwaltung unter `/betrieb`. Sie bleibt strikt vom CAPPATEX-Betriebsbereich getrennt und ist ausschliesslich für angemeldete, ausdrücklich als AB3D-Betreiber hinterlegte Konten zugänglich. Konto und bisherige 3D-Anfragen verlinken dorthin. Kunden erhalten weder die Betreiberliste noch fremde Daten, interne Notizen oder die internen Prüfdateien.

**Arbeitskonzept:** Eine filterbare, nachladbare Anfragenliste führt zu einem Fertigungsblatt mit Referenz, Kunde, vorhandenen freiwilligen Kontaktdaten, Modellvorlage, gewünschter Höhe, Material, Finish, Menge, unverbindlichem Richtpreis und bestehendem Auftragsstatus. Der separate interne Prüfstand lautet Neu, In Prüfung, Rückfrage nötig, Geprüft oder Abgeschlossen. Eine explizite Speicherung hält Notizen und Bearbeitungsstand fest; eine Versionsprüfung verhindert stilles Überschreiben durch einen zweiten Tab oder Bearbeiter. Ein Änderungsnachweis speichert Zeitpunkt, Bearbeiter und Prüfstand, ohne alte Notiztexte unnötig zu vervielfachen. „Geprüft“ oder „Abgeschlossen“ ist keine Zahlung, Produktionsfreigabe oder Versandbestätigung. Die bisherigen unverbindlichen Anfragen können weiterhin nicht in bezahlte Aufträge umgewandelt werden.

Ungespeicherte Prüfungen bleiben je Anfrage bei Auswahlwechsel erhalten und werden synchron im selben Browser-Tab gesichert, getrennt durch den Hash der angemeldeten Betreiberadresse. Wiederhergestellt werden ausschliesslich begrenzte, validierte Notiz-/Prüfstand-/Versionsdaten. Diese Tab-Sicherung ist ausdrücklich keine Serverspeicherung und geht beim endgültigen Schliessen des Tabs verloren. Bei gesperrtem oder beschädigtem Sitzungsspeicher wird die Bearbeitung sichtbar gesperrt; bereits eingegebene Notizen bleiben im geöffneten Bereich auf dem Server speicherbar. Ein fehlerhafter Cache wird nicht automatisch überschrieben. Neuere bestätigte Serverstände werden nicht durch verspätete GET-Antworten zurückgesetzt. Datei-Links öffnen einen gekennzeichneten neuen Tab, damit auch abgelaufene Dateilinks keinen offenen Prüfstand verlassen.

Eine vorhandene erfolgreich konvertierte Datei des anfragenden Kunden kann der Betreiber ausschliesslich zur internen Prüfung über eine neue geschützte Route ansehen beziehungsweise herunterladen. STL und 3MF stammen aus der tatsächlichen Konvertierung; GLB wird nur aus deren nachgewiesenem, ebenfalls erfolgreich skaliertem oder repariertem Ausgangsmodell desselben Kunden angeboten. Es wird keine GLB-Datei in einer nur für STL/3MF beauftragten Konvertierung erfunden. Das ist eine notwendige Modellprüfung vor dem individuellen Angebot; die bisherigen Kunden-Download-/Abo- und Zahlungsregeln werden dadurch nicht verändert. Eine Vorschau wird nur nach ausdrücklichem Öffnen geladen. Der Server ruft ausschliesslich vorhandene Meshy-Aufgaben und erlaubte Dateien lesend ab. Keine neue Konvertierung, Generierung, Reparatur oder Fertigung. Datei-URL, fremde Aufgaben und Weiterleitungen werden nicht aus Browsereingaben übernommen. Rohdaten, MIME-Typ, Dateisignatur, Herkunft, Zeit- und Grössenlimit werden geprüft; interne Dateien sind auf32MiB begrenzt. Ein erfolgreicher Aufgabenstatus oder eine 3D-Ansicht ersetzt keine Prüfung von Geometrie, Material, Wandstärke, Masshaltigkeit und tatsächlichem Fertigungsaufwand. Dateien können beim Anbieter abgelaufen oder nicht verfügbar sein; eine dauerhafte Archivierung aller Druckdateien ist hier noch nicht implementiert.

**Kundenangaben:** Das Ergebnisformular bietet bei einer unverbindlichen Anfrage freiwillig Name, Telefonnummer, Lieferland CH/LI, Postleitzahl, Ort und einen kurzen Hinweis an. Die Konto-E-Mail kommt weiterhin ausschliesslich aus der Anmeldung. Felder werden serverseitig begrenzt und geprüft; leere Angaben bleiben leer. Land und Postleitzahl dienen der persönlichen Angebotsprüfung. Eine vollständige Lieferadresse wird an dieser Stelle nicht vorsorglich verlangt; sie muss später im bestätigten Checkout erfasst werden. Der Kunde sieht vor dem Absenden, dass das Modell und diese Angaben für die persönliche Prüfung an AB3D gehen. Die öffentliche Galeriewahl bleibt davon unabhängig. Frühere Anfragen funktionieren ohne nachträglich erfundene Kontaktdaten weiter.

Migration `0013_messy_stingray.sql` ergänzt das optionale Anfrage-JSON sowie getrennte Prüf- und Änderungsdaten. Zahlungsstatus, Preis, Fertigungsstatus und Kundendateirechte werden nicht durch Notizen oder Prüfstand geändert. Es gibt keinen automatischen E-Mail-/WhatsApp-Versand, keine Rückfrage-Nachricht an Kunden, keine echte Bestellung und keine kostenpflichtige KI-Aktion. Für den späteren Verkauf bleiben ein verbindlicher Angebots-/Zahlungsweg, bestätigte Lieferadresse und Versandabwicklung offen. Diese Verwaltung macht den vorhandenen Anfrageneingang bearbeitbar, behauptet aber keine vollständige Verkaufsbereitschaft.

**Abnahmegrenze:** Die bestehenden gespeicherten Browserregeln gegen die lokale Vorschau und Shopify werden nicht umgangen. In diesem Schritt erfolgen Code-, SQLite- und Routentests sowie nach erfolgreichen Prüfungen die ausdrücklich beauftragte private Bereitstellung. Kein visuell oder mit einem echten Kundenauftrag bestätigter Ablauf. Prüfzahlen und Versionsnachweis werden nach Abschluss ergänzt.

**Prüfung:** 573/573 Tests ohne übersprungene Tests bestanden, darunter19 neue echte SQLite-/Routentests für die Betreiberverwaltung,10 für Notizwiederherstellung und7 zusätzliche Anfragetests. Geprüft wurden Rechte-/Kundentrennung, unveränderte Zahlungs-/Produktionssperren, atomare Prüfung plus Änderungsnachweis samt Rollback, konkurrierende Versionen, stabile Pagination, private Kontaktangaben, echte Dateiformat-Zuordnung, fremde/veraltete Quellen, HTTP-Weiterleitungen, Herkunft, Dateisignaturen, begrenzte Bytes und transparente Dekomprimierung. Nach einem Testfehler wurde die Zuordnung des angelegten Testdatensatzes an seine zurückgegebene ID gebunden; mehrere Anfragen mit demselben Millisekunden-Zeitpunkt werden nicht anhand zufälliger ID-Reihenfolge verwechselt. Typprüfung, vollständiges ESLint und Produktionsbuild erfolgreich. Quellscan über378 Dateien ohne Treffer vorhandener lokaler Secretwerte. Anbieterantworten ausschliesslich simuliert; keine echte Generierung, Zahlung, Anfrage oder Produktion ausgelöst.

### Private Bereitstellung · Version 64

Version **64** ist seit 20.10.2026 um **18:35 Schweizer Zeit** (16:35 UTC) erfolgreich privat bereitgestellt. Anwendungscode `e590589dbd9a87621478e29656b0ff95c3122e99` stimmt auf GitHub und in der nativen Site-Version überein. Deployment `appgdep_6ad79855b6c4819193371dfdedd329ae`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_72962197e0ec8191983d219c38f4c3f5`, Status `succeeded`, Umgebungsrevision unverändert **11**. Ein erlaubter Betreiber und null externe Besucher. CAPPATEX-Checkout, Fulfillment und automatische Produktion bleiben `false`; keine Servervariablen, Zahlungsarten, Shopify-Tarife oder Produktionsfreigaben geändert.

Das Hosting-Paket umfasst152 Dateien und13.619.200 Bytes, einschliesslich Migration0013 und der Drizzle-Metadaten; serverseitiger Archivhash `sha256:e11bde8183e7dc7e31c608d2ef2cbe5984544de4aff9499c4783350d65d94639`. Lokale komprimierte Transportdatei7.393.604 Bytes, SHA-256 `5bf0f722f1b3a4ca55a4a3c595d99b538aa9b59dd4be475b57cecc2bb491e96a`. Kein Treffer vorhandener lokaler Secretwerte im Paket. Der offizielle Quellhelfer synchronisierte den geprüften Commit; nach dessen bekanntem technischen Windows-Paketierungsstartfehler paketierte das bestehende Windows-Verfahren denselben sauberen Quellstand. Keine Genehmigungsablehnung wurde umgangen.

Die native Veröffentlichung ist bestätigt. Das Öffnen von `/betrieb` in Codex ist vorgemerkt (`queued`), keine bestätigte Browsernavigation oder Sichtprüfung. Es gab keinen echten Kundenauftrag und keinen Live-Aufruf der Modell-Prüfdateien. Die bestehenden Browserregeln wurden respektiert; keine Screenshots oder Smartphone-Abnahme dieses Bereichs. Dieser Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.

## Einmalige Tokenpakete und gemeinsame Bereitstellung · 20.10.2026

Der Betreiber beauftragte jetzt die Bereitstellung des bisherigen Stands sowie Tokenkäufe ohne Abo. Die ältere Vorgabe zur ausschliesslichen Code-/Testfertigstellung wird damit für die Veröffentlichung ersetzt. Die Site bleibt privat; Shopify-Tarif, Zahlungsmethoden, Produktionsfreigaben und kostenpflichtige KI-Aufrufe gehören weiterhin nicht zu diesem Auftrag. Die weiter unten genannten lokalen Stände von Studio, Kontakt und reduzierten Abo-Preisen werden gemeinsam bereitgestellt; der abschliessende Versionsnachweis folgt nach dem Deployment.

Die zentrale Liste `app/token-packs.ts` nennt **5 Tokens für CHF5**, **15 für CHF12** und **40 für CHF28**, jeweils einmalig. Das entspricht CHF1.00/0.80/0.70 pro Token und lässt einen Preisvorteil der monatlichen Abos bestehen. Startseite und Konto verwenden dieselbe Liste. Im Konto sind Paketwahl, Rechnungsland CH/LI, ausdrückliche Bedingungen, Kaufverlauf und manuelle Status-/Guthabenaktualisierung vorbereitet. Einmalkäufe ändern weder Abo noch Downloadrechte; Explorer kann weiterhin die jeweils freigegebenen Studios verwenden. Die neuen Bedingungen unter `/recht/tokenpakete` sind Teil der vorhandenen, noch nicht verkaufsfreigegebenen Rechtssammlung. Es wird keine monatliche Zahlung oder automatische Aufladung ausgelöst.

Dies sind gewählte Startpreise, keine nachgewiesene Deckungsbeitragskalkulation. Die Kostenprüfung verwendet die offiziellen [OpenAI-Bilddokumentation](https://developers.openai.com/api/docs/guides/image-generation) und [Meshy-API-Preise](https://docs.meshy.ai/en/api/pricing), die tatsächlich im Code verwendeten Aktionen und deren Tokenbedarf. Reale Bildausgabe-Token, Meshy-Crediteinkauf, Wechselkurs und Zahlungsgebühren müssen vor Verkaufsfreigabe anhand gemessener Nutzung bestätigt werden. Es wurden dafür keine kostenpflichtigen Generierungen gestartet.

**Technischer Zahlungsweg:** ausschliesslich Shopify mit separaten digitalen Varianten für diese drei Pakete. Der Server verwendet eigene Preise, Tokenmengen und verifizierte SKU-/Varianten-IDs; Browserpreise werden ignoriert. Vor einem Warenkorb prüft ein aktueller Storefront-Leseaufruf unter anderem CHF-Preis, Verfügbarkeit, `requiresShipping=false`, Einzelkauf und Mengenregeln. Ein unveränderlicher, kontogebundener Snapshot hält Paket, CHF-Betrag, Land, Bedingungen und Freigabestand fest. Die pro Konto und Anfrage eindeutige Reservierung verhindert wiederholtes `cartCreate`; ein unklarer Ausgang sperrt neue Anfragen bis zur Klärung. Der Tab bewahrt dieselbe Anfrage auch bei Netzfehler oder vorübergehend gesperrtem Kauf. Er verwirft sie erst nach einer passenden bestätigten Gutschrift. Ein fehlgeschlagener erster Katalogaufruf verhindert nicht die spätere Wiederaufnahme.

Guthaben entsteht ausschliesslich nach einem unverändert signierten `orders/paid`-Webhook an `/api/token-purchases/webhooks/shopify`. Geprüft werden tatsächlicher Shop, Nicht-Test-Zahlung, genau eine digitale Paketposition, Menge1, SKU/Variante, Käuferkonto, Land, CHF-Gesamtsumme ohne zusätzliche Versand-/Rabattbeträge und exakte Snapshot-Attribute. Eine atomare D1-Transaktion mit eindeutiger Bestell-/Kauf-/Ledger-Zuordnung schreibt genau einmal gut, auch bei paralleler Zustellung. Bereits bestätigte Checkout-Stände behalten ihre eingefrorenen Preise, Tokenmengen, Bedingungen und Varianten; ein ausgeschalteter Schalter für neue Käufe oder spätere Katalogänderungen verhindern ihre belegte Gutschrift nicht. Secret, Shop, Snapshot-Hash, gespeicherte Kaufspalten und Signatur bleiben zwingend. Weder Katalogabruf noch Checkout-Erstellung, Rückkehr oder Statusaktualisierung erzeugen Tokens. Printify wird dabei nie aufgerufen. Die beiden Webhooks ignorieren nach Signaturprüfung fachfremde reine Produkt-/Tokenbestellungen, ohne deren Gutschrift oder Fulfillment zu übernehmen. Migration `0012_brown_sunspot.sql` ergänzt Kauf-, Zustell- und Gutschriftsdaten sowie die Unveränderlichkeit des Kaufstands. Erstattungen, Rückbuchungen und nachträgliche Bestelländerungen werden noch nicht automatisch mit verbrauchtem Guthaben verrechnet; ein verbindlicher manueller Klärungsprozess bleibt vor Verkaufsfreigabe nötig.

**Aktuelle Sperre:** `TOKEN_PACK_RELEASES` ist absichtlich leer; keine erfundenen Produkt- oder Varianten-IDs. Zusätzlich müssen `TOKEN_PURCHASES_ENABLED=true`, ein sicher eingerichtetes `SHOPIFY_WEBHOOK_SECRET` und echte CH-/LI-Checkout-/Zustellnachweise vorliegen. Der native Hosting-Leseaufruf bestätigt Umgebungsrevision11 ohne `SHOPIFY_WEBHOOK_SECRET`; der neue Schalter bleibt standardmässig aus. Kaufbuttons bleiben deaktiviert, bis die Voraussetzungen tatsächlich nachgewiesen sind. Der zuletzt bestätigte Shopify-Status ist weiterhin Pause and Build; heute keine neue Kontoprüfung. Auch die Zustellung an die owner-private Site ist noch zu klären, ohne deren Zugang einfach zu öffnen. Eine echte Zahlung oder ein Tarifwechsel benötigt weiterhin eine gesonderte Freigabe.

**Browsergrenze:** Der Betreiber erlaubte die lokale Browserprüfung und Shopify-Lesezugriffe ausdrücklich. Die gespeicherten Browserregeln verweigerten anschliessend weiterhin `localhost:3186` und `accounts.shopify.com`. Keine Umgehung über andere Ports, Browser, APIs oder die veröffentlichte Site. Die Code-/SQLite-/Routentests können abgeschlossen und die ausdrücklich beauftragte private Bereitstellung ausgeführt werden. Eine neue visuelle/interaktive Studio-, Tokenkauf- oder Shopify-Abnahme ist damit weiterhin nicht erfolgt.

**Prüfung dieses Quellstands:** 537/537 Tests bestanden, ohne übersprungene Tests, darunter 22 neue SQLite-/Routentests für Tokenpakete. Echte SQL-Migrationen, atomarer Rollback nach bereits ausgeführter Guthabenänderung, doppelte/parallele Zustellung, Wiederverwendung von Bestell-/Event-IDs, eingefrorene Altpreise trotz Verkaufssperre, unklare Warenkorbergebnisse, beide fachfremden Webhook-Fälle und fehlerhafte Signaturen/Attribute wurden mit lokalen Testdaten geprüft. Typprüfung, vollständiges ESLint und Produktionsbuild erfolgreich. Quellscan über363 Dateien ohne Treffer vorhandener lokaler Secretwerte. Keine externe Testzahlung, KI-Generierung oder Printify-Mutation. Zwei unabhängige Codeprüfungen deckten und korrigierten die Checkout-Wiederaufnahme sowie die Webhook-Trennung; sie ersetzen keine Browser-/Zahlungsabnahme.

### Private Bereitstellung · Version 63

Version **63** wurde am 20.10.2026 um 00:33 UTC (02:33 Schweizer Zeit) erfolgreich privat bereitgestellt. Anwendungscode `9883bdfe6f8d64a3c4e47aa0e7202307326fc60c` stimmt auf GitHub, im synchronisierten Site-Quellstand und in der gespeicherten Site-Version überein. Deployment `appgdep_6ad6b6d69c808191a0104c2d64265d95`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_2d0e365ed7b08191980506bef71807c1`, Status `succeeded`, Umgebungsrevision unverändert **11**. Ein erlaubter Betreiber, null externe Besucher; CAPPATEX-Checkout, Fulfillment und automatische Produktion bleiben `false`. Kein Tokenkauf-Schalter oder Webhook-Secret wurde eingerichtet. Kein Shopify-Tarif, Zahlungsmittel oder API-Schlüssel geändert.

Das gespeicherte Hosting-Paket umfasst 146 Dateien und 13.424.640 Bytes, einschliesslich Migration0012 samt Journal/Snapshot. Serverseitiger Archivhash `sha256:367b108e2fb87f7ef400cd3e63338555ecc929edfc248e6720ac03474b999eed`; lokale komprimierte Transportdatei 7.360.323 Bytes, SHA-256 `e294444bd57602ad9e451f63ad4ca79f111672559c282a84fa091d5ab37635cc`. Paket-Scan ohne Treffer vorhandener lokaler Secretwerte. Der offizielle Quellhelfer synchronisierte den Commit vor seinem bekannten technischen Windows-Paketierungsstartfehler. Das bestehende lokale Windows-Verfahren paketierte anschliessend denselben sauberen, geprüften Commit. Keine Genehmigungsablehnung wurde umgangen.

Die native Bereitstellung ist bestätigt; die neue Oberfläche wurde nicht im Browser abgenommen. Das Öffnen von `/konto#tokens-kaufen` im Codex-Panel ist vorgemerkt (`queued`), keine bestätigte Navigation. Kein neuer Screenshot und kein echter Checkout-/Gutschrift-, Smartphone- oder KI-Test. Die gespeicherten Browserregeln gelten weiterhin. Dieser abschliessende Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.

## Creator-Abos um CHF 3 reduziert · 20.10.2026

Die zentrale Preisliste `app/creator-plans.ts` nennt auf Betreiberwunsch neu CHF16/Monat für 3D Studio, CHF12/Monat für CAPPATEX und CHF26/Monat für Complete. Explorer bleibt bei CHF0; Tokenkontingente und Leistungen bleiben erhalten. Startseite und Kontobereich verwenden dieselbe Liste, weitere Abo-Preisquellen wurden nicht gefunden. Die Abo-Auswahl speichert weiterhin ausschliesslich eine Anfrage, keine kostenpflichtige Abrechnung. Direkte Prüfung aller vier Preis-/Tokenzuordnungen, 13 vorhandene Struktur-/Launchtests, Typprüfung, dateibezogenes ESLint und Produktionsbuild erfolgreich. Gemäss bestehender Code-/Test-Vorgabe noch keine Bereitstellung; live bleibt Version62.

## Gemeinsame CAPPATEX-Kontaktadresse · 20.10.2026

Auf Betreiberwunsch verwenden AB3D und CAPPATEX im aktuellen Quellstand `cappatex@gmail.com` statt der persönlichen iCloud-Adresse. Nachweis aus der vorhandenen AB3D-Git-Historie: Commit `2610ac7`, `docs/CAPPATEX-PRODUCTION-STATUS.md:5`, nennt diese Adresse ausdrücklich für das verbundene CAPPATEX-Printify-Konto (Shop23104859). Das ist ein historischer Kontonachweis, kein neu durchgeführter Zustell- oder Postfachzugriffstest. Der Zugriff auf die Shopify-Anmeldung wurde vom Browser mit „user declined“ abgelehnt und nicht umgangen; die Adresse wurde unabhängig davon im lokalen Git-Verlauf gefunden.

Geändert sind die zentrale Kontaktkonstante (beide Kontaktseiten, Mailto-Links, Kopierbuttons und Assistant-Verweise) sowie die bisherigen statischen Kontaktverweise in Impressum, Rechtsfooter, Datenschutz, AGB, Produktsicherheit und Versand/Rückgabe. WhatsApp und Kontologins bleiben unverändert. Historische Prüfprotokolle weiter unten behalten die damalige Adresse. Die vorherige Vorgabe „Nur Code und Tests fertigstellen“ bleibt erhalten: keine Bereitstellung des noch nicht visuell abgenommenen Studio-Umbaus; die live veröffentlichte Version62 enthält weiterhin den alten Kontaktstand.

Prüfung: Beide tatsächlichen `contactEmailUrl`-Funktionen adressieren `cappatex@gmail.com` mit ihrem jeweiligen Bereichsbetreff. Keine Fundstelle der persönlichen Adresse mehr im Anwendungscode. 515/515 Tests, Typprüfung, vollständiges ESLint und Produktionsbuild erfolgreich. Quellscan über347 Dateien ohne Treffer vorhandener lokaler Secretwerte. Kein E-Mail-Versand oder Zustelltest.

## Geführtes CAPPATEX-Designstudio · 20.10.2026

Ziel des überarbeiteten Kundenwegs: eine Entscheidungsebene pro Schritt statt gleichzeitig sichtbarer Motiv-, Galerie-, Produkt-, Drucktechnik- und Speicherformulare. Die bestehende CAPPATEX-Farbwelt bleibt erhalten: Papierweiss #ffffff, heller Hintergrund #fcf8f4, dunkle Schrift #18312f, Kupfer #a9432e, Linie #dfcec3 und weicher Akzent #f5e3d9. Georgia bleibt die sparsam eingesetzte Titelschrift, Arial die Formularschrift. Die dreiteilige Fortschrittsleiste bezeichnet echte Arbeitsschritte. Sämtliche neuen CSS-Regeln sind auf `.cappatex-guided` begrenzt; das AB3D-Studio wird nicht umgestaltet.

1. **Motiv:** KI oder eigenes Bild, eine Hauptbeschreibung und vier bestehende Stile. Die optionale Schreibhilfe ergänzt Farben, genauen Schriftzug, Bildaufbau und Ausschlüsse ausschliesslich lokal. Vor dem ausdrücklichen Übernehmen zeigt sie den vollständigen Vorschlag und seine Länge. Bestehende manuelle Eingaben werden nicht automatisch ersetzt; über 500 Zeichen wird nichts gekürzt und das Übernehmen bleibt gesperrt. Format und Auflösung sind einklappbar. Ein eigener Freigabebereich bündelt die weiterhin unbeantwortete Wahl privat/Galerievorschlag und die ausdrückliche Kosten- beziehungsweise Bildrechtebestätigung vor dem echten Erstellen/Upload. Öffentliche Rechte- und Datenschutzangaben bleiben sichtbar, sobald Galerie gewählt wird. AB3D nutzt weiterhin die bisherige Galerieansicht.
2. **Produkt:** Produktwechsel in einer kompakten ausklappbaren Auswahl; Farbe, Grösse und tatsächlich unterstützte Druckseite direkt an der grossen kalibrierten Ansicht. Zwei Ansichtsmodi trennen „Dein Design“ von den Anbieter-Produktfotos mit Bildminiaturen. Fotos von getragenen Artikeln bleiben ausdrücklich unbedruckte Produktansichten; dort wird kein unkalibriertes Motiv vorgetäuscht. Einpassen und Zentrieren sind direkt erreichbar, genaue Position/Skalierung und technische Druckdaten bei Bedarf. Qualitätsfehler bleiben sichtbar. Der ausdrückliche Seitenbutton verwendet dieselbe bestehende Übernahmefunktion wie die Prüfung; ein Schrittwechsel übernimmt, generiert oder speichert nichts.
3. **Prüfen:** Artikel/Variante, Menge, CH/LI-Land und ausschliesslich vorhandener Preis; übernommene Vorder-/Rückseiten gemeinsam prüfen und speichern. Bearbeitungslinks führen gezielt zur jeweiligen Druckseite zurück. Geänderte Arbeitsstände ersetzen bereits übernommene Seiten nicht automatisch. Der gespeicherte unveränderliche Stand führt weiterhin zur vorhandenen Shopify-Prüfung mit sämtlichen bisherigen Freigabesperren. Die Oberfläche benennt die aktuelle Testphase, ohne eine Verkaufsbereitschaft zu behaupten.

Technische Erhaltung: Inaktive Bereiche werden mit `hidden` ausgeblendet, nicht je Schritt neu montiert. Das Vorbereitungsmodul behält seinen Varianten-Key, lokalen Speicherstatus und die bisherige Anfrage-ID auch nach unklarem Ausgang. Vorder-/Rückseitenprofile, Bildgeometrie, Pixelprüfung und Renderer wurden nicht geändert. Fehler der Erstellung, Tab-Sicherung und laufende Operationen stehen ausserhalb einklappbarer Freigaben. Die bisherige Link-Strukturprüfung erwartet jetzt den neuen Prüfungseinstieg statt eines entfernten Scrolllinks; die Sperre gegen direkten Checkout im Designer bleibt geprüft. Fünf neue reine Tests prüfen die Schreibhilfe, einschliesslich 500/501 Zeichen und unveränderter manueller Eingaben.

**Abnahmestatus:** 515/515 Tests, Typprüfung, vollständiges ESLint und Produktionsbuild erfolgreich. Quellscan über347 Dateien ohne Treffer vorhandener lokaler Secretwerte. Die Browser-Anfrage für `http://localhost:3186` wurde ausdrücklich mit „user declined“ abgelehnt; diese Ablehnung wurde nicht umgangen. Die zusätzlich vorbereitete rein lokale Testumgebung auf Port3196 wurde deshalb ebenfalls nicht ersatzweise im Browser geöffnet. Auf die erneute Freigabefrage wählte der Betreiber ausdrücklich „Nur Code und Tests fertigstellen“. Daher keine visuelle/interaktive Abnahme, neue Screenshots, Site-Quellsynchronisierung oder Bereitstellung dieses grösseren Umbaus; die live veröffentlichte Version62 bleibt bestehen. Keine bestätigte Smartphone- oder Ende-zu-Ende-Abnahme. Beide lokalen Testserver sind beendet. Kein echter KI-Aufruf, Kauf, Printify-Auftrag oder Wechsel von Hosting-Zugriff/Produktionskonfiguration. Umsetzung und Konzept werden ausschliesslich im bestehenden AB3D-GitHub-Branch gesichert.

## Hilfe ohne Entwurfsverlust und sichtbare Tab-Sicherung · 19.10.2026

Kontakt aus den beiden Studio-Hauptseiten öffnet einen ausdrücklich gekennzeichneten neuen Tab. Das gilt für Kopfzeile und Footer sowie die persönliche Hilfe im 3D-Studio und den AB3D-FAQ. Andere Kontaktseiten navigieren weiterhin im selben Tab. Die neue persönliche 3D-Hilfe ist schon vor einem kostenpflichtigen Druckpaket erreichbar. Keine automatischen Anhänge, Motivdaten oder Kontoinformationen werden übertragen.

Beide Kontaktseiten bieten zusätzlich Kopierbuttons für Telefonnummer und E-Mail. Erfolg wird erst nach erfolgreichem Clipboard-Aufruf angezeigt. Verweigert der Browser den Zugriff, nennt die Seite das manuelle Kopieren als Alternative. Kein automatischer Versand, keine zusätzliche Kontakt-API.

Die normale CAPPATEX-Tab-Sicherung verschluckt Schreibfehler nicht mehr. Eine eigene Statusmeldung erklärt, dass die letzte Änderung nicht im Tab gesichert wurde. Nur diese Meldung wird nach einer später erfolgreichen Sicherung entfernt; bestehende Warnungen über unklare Serverspeicherung bleiben erhalten. Ausdrückliches Speichern bleibt unabhängig davon möglich. Es wird weiterhin nur die aktuelle Variante im Tab gesichert, nicht jeder Entwurf dauerhaft gespeichert.

Browserabnahme mit tatsächlichem Anwendungscode: Kopierbuttons zeigen Erfolg; interner Wechsel von AB3D-Kontakt zu CAPPATEX-Kontakt per Klick bestätigt. Beide Studio-Hilfewege öffneten zusätzliche echte Kontakt-Tabs, die eingegebenen Testideen blieben im ursprünglichen Studio erhalten. Die zuvor dokumentierte Unsicherheit der Kontakt-Navigation ist damit lokal geklärt. Kontaktbuttons wurden bei 320px mit 48px Hauptaktionen und 44px Kopieraktionen innerhalb der Ansicht gemessen; keine Aussage über eine neue vollständige Smartphone-Abnahme aller Shopseiten.

Gezielte Offline-Fixture mit synthetischem Konto, Produkt und Vorder-/Rückseitenmotiv: Lesen aus dem Tab-Speicher funktioniert, Schreiben wirft einen simulierten QuotaExceededError. Warnung sichtbar, beide übernommenen Seiten erhalten, Speichern-Button tatsächlich aktiviert. Ein ausdrücklicher Klick erreichte genau einen lokalen 503-Speichermock; keine externe Mutation. Nach Freigabe des Tab-Speichers und Mengenänderung verschwand ausschliesslich der Autosave-Hinweis; die getrennte Warnung über unklare Serverspeicherung blieb sichtbar. CSP beschränkte Verbindungen auf localhost. Kein kostenpflichtiger KI-Aufruf, echter Kauf oder Produktionsauftrag. Die Fixture liegt ausschliesslich im ignorierten outputs-Verzeichnis.

Abschliessend: 510/510 Tests, Typprüfung, vollständiges ESLint und Produktionsbuild erfolgreich. Quellscan über 343 Dateien ohne Treffer vorhandener lokaler Secretwerte. Keine neue Abhängigkeit, Datenbankmigration oder Änderung an Produktions-Servervariablen und Verkaufsfreigaben.

### Private Bereitstellung · Version 62

Version **62** wurde am 19.10.2026 um 19:15 UTC erfolgreich privat bereitgestellt. Anwendungscode `8ce9569b6251db61163e48e03d4fd79534b45419` stimmt auf GitHub und in der Site-Version überein. Deployment `appgdep_6ad66c45deb481919047322224abadd8`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_cd2e73d5a4d081918075be14246d0ab8`, Status `succeeded`, Umgebungsrevision unverändert **11**. Weiterhin ein erlaubter Betreiber und null externe Besucher; Checkout, Fulfillment und automatische Produktion bleiben gesperrt.

Live bestätigt: aktualisierte Kontaktseite mit beiden Kopierbuttons; der Nummernbutton meldet erfolgreichen Clipboard-Aufruf. Der interne Link wechselte tatsächlich von CAPPATEX-Kontakt zu AB3D-Kontakt. Damit ist die in Version61 noch offene interne Kontakt-Navigation auch live bestätigt. Kein Nachrichtenversand und kein Test einer echten Zustellung. Screenshot `outputs/support-contact-v62-20261019.jpg`. Lokale Prüftabs und beide Testserver sind beendet, temporäre Browserbreite zurückgesetzt.

Das gespeicherte Hosting-Paket umfasst 144 Dateien und 13.230.080 Bytes; serverseitiger Archivhash `sha256:34cf5b5b2a39a9a90dfb9dd89c10c8b32a689cb480321add488b00a5c60c0007`. Die lokale komprimierte Transportdatei hat 7.329.442 Bytes und SHA-256 `6ad08c17fb352a0a6cb9504ed979b986d23839585b915b5b07ec98f404157f8b`. Paket-Scan ohne Treffer vorhandener lokaler Secretwerte. Nach dem bekannten technischen Windows-Startfehler des offiziellen Paketierungsschritts wurde das vorhandene lokale Windows-Verfahren aus dem sauberen, geprüften Commit verwendet. Keine Genehmigungsablehnung wurde umgangen. Dieser Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.

## Persönlicher Kontakt · 19.10.2026

Auf ausdrücklichen Wunsch des Betreibers sind `/kontakt` für AB3D und `/cappatex/kontakt` für CAPPATEX ergänzt. Beide Bereiche haben einen ständig sichtbaren Kontaktlink in der Kopfzeile und einen passenden Footerlink. Die Kontaktseiten benötigen keine zusätzliche Anmeldung. CAPPATEX bietet ausserdem einen Link zur persönlichen Designhilfe in einem neuen Tab, damit der aktuelle Entwurf offen bleibt.

WhatsApp nutzt `https://wa.me/41788206684` mit einem statischen bereichsspezifischen Nachrichtentwurf. Die angegebene Schweizer Nummer `0788206684` wird als `+41 78 820 66 84` angezeigt. E-Mail nutzt `berk_ermis@icloud.com` mit einem statischen passenden Betreff. Es gibt keine Kontakt-API, Formdatenspeicherung, WhatsApp-SDK, Tracking-Einbettung, automatische Nachricht oder automatische Übernahme von Motiven, Kontodaten und Bestellreferenzen. Besucher wählen ihren Kanal und senden selbst.

Die frühere Kontaktadresse wurde in Footer, Impressum, Service-/Rechtstexten und Assistant-Hinweisen ersetzt. Im Impressum ist WhatsApp statt des bisherigen Telefon-Platzhalters angegeben. Geschäftsadresse, Rechtsform und übrige offene Betreiberangaben bleiben ausdrücklich offen; keine rechtlichen Regeln, Zahlungen, Kontoabos oder Verkaufs-/Produktionsfreigaben wurden verändert.

Browserabnahme lokal: beide echten Kontaktseiten HTTP200; richtige Bereichslinks, Nummer und Mail-Betreff; 48px Kontaktbuttons und Kopfzeilenkontakt bei 320px ohne horizontalen Überlauf. Der echte AB3D-Header wurde einschliesslich Warenkorb bei 320px geprüft. Für schmale Geräte steht die Bereichskennung in einer zweiten Zeile. Eine zusätzlich bestätigte Überlappung der Desktop-Bereichswahl mit Kontakt/Konto/Warenkorb bei 901px ist durch kompaktere Kopfzeilenspalten und einen Warenkorb ohne Textlabel in dieser Breite behoben; beide Bereiche bleiben sichtbar.

Das WhatsApp-Ziel wurde im Browser geöffnet und zeigte exakt die angegebene Nummer sowie den erwarteten AB3D-Entwurf. Kein App-Login, Versand einer Testnachricht oder Zustelltest. Die E-Mail-Verknüpfung wurde als `mailto:` mit Adresse und Bereichsbetreff geprüft; kein E-Mail-Versand. Die Kontaktdaten wurden vom Betreiber bereitgestellt, nicht aus Konto- oder Anbieterzugängen übernommen.

510/510 vorhandene Tests, Typprüfung und vollständiges ESLint erfolgreich. Der bestehende isolierte Assistant-Test lädt die neuen Kontaktdaten aus dem tatsächlichen reinen Modul; seine Kosten-/Anmeldegates bleiben unverändert geprüft. Keine neuen Tests für reine Link-/Textdarstellung. Die abschliessende private Bereitstellung und Live-Abnahme werden nachfolgend dokumentiert.

### Private Bereitstellung und Live-Abnahme · Version 61

Version **61** ist seit 19.10.2026, 17:09 UTC erfolgreich privat bereitgestellt. Anwendungscode `6301adf841bb7b9d43f074f9cc6da34421f655f6` stimmt auf GitHub und in der gespeicherten Site-Version überein. Deployment `appgdep_6ad64e997c7081919b6542f97190d62c`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_c458f3ba62f08191a75a4cbae7d378f9`, Status `succeeded`, Umgebungsrevision unverändert **11**. Keine Änderung des Betreiberzugriffs oder der Verkaufsfreigaben. Die zuvor ebenfalls privat bereitgestellte Version60 wurde durch diese Kontakt-Navigationskorrektur ersetzt.

Kontakt-Einstiegspunkte verwenden normale HTML-Navigation; der Designer-Hilfelink öffnet einen neuen Tab. Die automatisierte Aktivierung interner Kontaktlinks liess sich im eingebauten Browser nicht zuverlässig bestätigen, auch nach frischer Tab-Bindung und Tastaturprüfung. Direkte Navigation zu beiden tatsächlichen URLs funktionierte. Es wurden keine entsprechenden Hosting-Fehler gemeldet. Das ist eine dokumentierte Grenze der interaktiven Abnahme, keine bestätigte Zustell- oder Ende-zu-Ende-Kommunikationsprüfung.

Live nachgewiesen: beide Kontaktseiten laden mit korrekter Bereichszuordnung, Telefonnummer, statischem WhatsApp-Entwurf, E-Mail-Adresse und Bereichsbetreff. Bei 320px liegen Kopfzeilenkontakt und beide 48px-Buttons innerhalb der Ansicht; kein horizontaler Überlauf. WhatsApp selbst zeigte die richtige Nummer und den AB3D-Entwurf. Kein Login in WhatsApp, App-Start, Nachrichten- oder E-Mail-Versand. Temporäre WhatsApp-/Prüftabs wurden geschlossen, der lokale Devserver beendet, Browserbreite zurückgesetzt. Screenshot: `outputs/contact-cappatex-v61-20261019.jpg`.

Hosting-Paket: 142 Dateien, 13.219.840 Bytes im erfassten Tar-Archiv, SHA-256 `d86f638243fa99237c04081ccb9e551623e6f5246152336239a1beac434ae699`. Quellscan über342 Dateien und Paket-Scan ohne Treffer vorhandener lokaler Secretwerte. Produktionsbuild erfolgreich. Die offizielle Paketierung scheiterte am bekannten Windows-Startfehler; das bestehende Windows-Verfahren paketierte den sauberen geprüften Commit. Erforderliche Git-/Netzwerkaktionen wurden regulär freigegeben; keine Ablehnung wurde umgangen. Dieser abschliessende Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht.

Fortsetzung nach Version 54: [Preis-, Versand- und Etikettenabnahme](CAPPATEX-SALES-AND-SHIPPING-ACCEPTANCE.md). Dort stehen die neue Bindung bezahlter Versandtarife, der aktuelle Pflichtlayer-Nachweis und die sichtbaren Druckgrössengrenzen. Das nachfolgende Protokoll beschreibt den Stand der Version 54.

## Bestellkonzept

Neue CAPPATEX-Käufe beginnen beim vollständig gespeicherten Gestaltungsstand. Der Designer führt zur Druckvorbereitung und anschliessend zur Prüfansicht. Ein zweiter direkter Front-Checkout könnte eine bereits gestaltete Rückseite verlieren und wird aus der Bedienung entfernt. Historische einseitige Server-Snapshots bleiben prüfbar.

1. Vorderseite, Rückseite oder beide werden ausdrücklich übernommen. Jede Seite behält Motiv, Platzierung und eigene Druckfläche. Der Renderer speichert je eine transparente PNG in geprüften Providerabmessungen; der gemeinsame Stand bleibt unveränderlich und kontogebunden.
2. Ein ausdrücklich freigegebenes `preparedCheckout`-Angebot nennt Variante, genaue erlaubte Seitenkombinationen, CHF-Stückpreis und Renderer. Der Preis muss dem tatsächlichen Shopify-Preis entsprechen. Unterschiedliche Seitenpreise benötigen später passende, eindeutig zugeordnete Shopify-Varianten. Keine erfundenen Aufschläge oder versteckten Warenkorbpositionen.
3. Nur bei vollständiger Serverfreigabe erscheint der Shopify-Button. Die neue Eingabe enthält ausschliesslich `preparationId` und AGB-/Datenschutzbestätigung. Browserpreise und neue Motive/Positionen werden nicht übernommen. Geprüft werden Eigentümer, Renderer, aktuelle Zuordnungen, Seitengeometrie, Verfügbarkeit sowie Hashes/Pixelmasse der fertigen Dateien.
4. Schema-2-Bestellsnapshots enthalten den vollständigen vorbereiteten Stand und dessen SHA-256. Warenkorb und bezahlte Position müssen Snapshot-ID, Vorbereitung-ID und Vorbereitung-Prüfsumme unverändert übernehmen. Preis, Währung, Menge, Zielland, SKU und Eigentümer bleiben Prüfbedingungen.
5. Genau ein Fulfillment-Weg ist vorgesehen: AB3D erstellt per Printify-API einen unveröffentlichten individuellen Produktentwurf und einen manuell freizugebenden Auftrag. Vorher muss die Trennung dieser Blankos vom nativen Printify-Shopify-Import nachgewiesen werden. Das Verkaufsregister bleibt bis dahin leer.
6. Schema 2 überträgt ausschliesslich die bereits gespeicherten fertigen PNGs. Kein Rendering oder KI-Eingriff nach Zahlung. Vollflächen-PNGs liegen bei Printify mittig mit Skalierung 1; keine doppelte Platzierung. Die Antwort muss exakt die erwarteten Seiten und Upload-IDs enthalten. Ungeprüfte Zusatzebenen, etwa Pflichtetiketten, bleiben ein Sperrgrund.
7. Atomare Reservierung, eindeutige Snapshot-Zuordnung und bestehende Zustandsübergänge verhindern doppelte Auftragsanlage. Unklare Printify-Antworten werden nicht automatisch wiederholt. Die geschützte Übersicht `/cappatex/betrieb` zeigt manuelle/festhängende Prüffälle ohne Wiederholungs- oder Produktionsaktion.

## Frisch nachgewiesen

Nur lesender Printify-API-Abgleich im Shop **CAPPATEX, 23104859**, am 17.10.2026:

| Blanko | Verfügbare Varianten | Rückseiten | CH/LI-Anbieterversand erstes / weiteres Stück |
| --- | ---: | ---: | --- |
| Gildan 64000 T-Shirt | 10 | 10 | USD 8.49 / 1.19 |
| B&C King Hoodie | 26 | 26 | USD 10.89 / 2.39 |
| Bella+Canvas Tanktop | 6 | 6 | USD 7.29 / 1.99 |
| B&C WUI23 Pullover | 15 | 15 | USD 10.89 / 2.39 |
| Gildan 2400 Langarmshirt | 14 | 14 | USD 8.49 / 1.19 |
| Poster | 4 | 0 | USD 8.49 / 1.99 |

**75 Varianten, 71 Rückseiten.** Tanktop Black/M, Printify-ID `24640`, ist heute deaktiviert und fehlt beim Anbieter. Der vorhandene Gestaltungskatalog filtert diese Variante korrekt aus. Die gespeicherten 76 SKU-/Shopify-ID-Zuordnungen sind eindeutig; die übrigen Zuordnungen passen zu Anbieter, Druckfläche, Optionen und Foto. Verfügbarkeit bleibt bei jedem Kauf erneut zu prüfen.

Anbieterversand ist kein bestätigter Shopify-Checkout-Tarif. Product-GET enthält `variant.cost` in Cents ohne Währungsfeld; daraus werden weder CHF-Einkaufspreise noch Margen abgeleitet. Tassen und Handyhüllen bleiben wegen ungeprüfter Druckgeometrie/Ausschnitte ausserhalb des Registers.

Hosting-Umgebungsrevision **11**: `CAPPATEX_CHECKOUT_ENABLED=false`, `CAPPATEX_FULFILLMENT_ENABLED=false`, `CAPPATEX_AUTO_PRODUCTION_ENABLED=false`. OpenAI-, Meshy- und beide Printify-Tokens sind als Secrets konfiguriert; Werte wurden nicht ausgegeben oder geändert. **`SHOPIFY_WEBHOOK_SECRET` fehlt.** Ein produktiver Webhook ist damit nicht eingerichtet. Owner-private bleibt unverändert.

Der lokale Lesetoken hat nur `shops.read`, `catalog.read`, `products.read`. Lesen beweist keine Schreibrechte. Der Betreiber-Audit verwendet bevorzugt diesen Token und kennzeichnet Produktionsrechte als ungeprüft.

## Weitere Korrekturen

- AB3D berechnet den unverbindlichen Richtpreis serverseitig mit derselben validierten Formel wie im Studio; Clientpreise und Komplexitätswerte werden ignoriert. Neue Datensätze sind `inquiry`, keine Zahlungs-/Fertigungsaufträge. Der alte Status-Endpunkt darf sie nicht in Zahlung/Produktion überführen. Wunschhöhe ersetzt keine Herstellbarkeitsprüfung.
- Echte Streamlimits vor der Pufferung von Checkout-/Webhook-Bodies; HMAC weiterhin auf unveränderten Rohbytes.
- Papier-/Oberflächenoptionen für Poster und ähnliche Produkte werden ausdrücklich anhand des Profils in Shopify und Printify abgeglichen. Fehlende, doppelte oder falsche Optionswerte werden abgelehnt; Kleidung behält die exakte Farb-/Grössenprüfung. Dies erteilt noch keine Produktfreigabe.
- Mobile Raster, lange Speicherbuttons, Auswahlfelder und Berührungsflächen korrigiert; Bereichskennzeichnung bleibt bei 390px sichtbar. Kontonavigation kann umbrechen.
- Betreiberübersicht: Anmeldung plus Betreiber-Allowlist, GET-only, kein Cache, begrenzte Metadaten ohne Kundennamen, Adressen, Originale oder Geheimnisse.

## Noch vor Verkauf nötig

1. Freigegebene Geschäftsdaten für das Impressum und zum tatsächlichen Angebot passende Rechtstexte/Kontaktangaben. Keine erfundenen Betreiber-, Adress- oder Steuerangaben.
2. Kostenwährung, Druckseitenkosten, Steuer-/Versandbehandlung und Marge bestätigen; konkrete Shopify-Verkaufspreise und exakte Seitenangebote einrichten.
3. Printify-Pflichtetiketten/Zusatzebenen, native Importtrennung, manuelle Auftragsfreigabe und API-Schreibrechte im richtigen Shop nachweisen.
4. CH-/LI-Märkte und Versandprofile mit echten Checkout-Tarifen prüfen. Letzter UI-Nachweis vom 09.10.: Pause and Build, LI-Markt Entwurf, LI-Tarif im allgemeinen Profil fehlend. Heute nicht erneut in Shopify bestätigt.
5. Unterstützte Webhook-Zustellung an die geschützte Site und Signatur-Secret einrichten. Shopify-Signatur ersetzt nicht den Plattformzugang. Zielgruppe deshalb nicht einfach öffnen.
6. Erst nach gesonderter Zustimmung Plan/Zahlungen und kontrollierten End-to-End-Kauf prüfen. Keine echte Bestellung, Produktion, Aboänderung oder kostenpflichtige Generierung in diesem Schritt.
7. Nach erfolgreicher Abnahme Verkaufsprofile und Checkout schrittweise freigeben. Öffentliche Freigabe und automatische Produktion bleiben eigene zu genehmigende Schritte.

## Prüfprotokoll

Produktionsbuild, Typprüfung, vollständiges ESLint und **316 von 316 Tests** bestanden, ohne übersprungene Tests. Die Regressionen umfassen echte Routen mit vollständig isolierten Datenbank-/Datei-/API-Testdaten: Front, Back, beide Seiten, mehrere Positionen, exakte PNG-Bytes, Preis-/Währungs-/Attributänderungen, veränderte Dateien, Import-/Freigabesperren, parallele Wiederholung und unklare Auftragsergebnisse. Keine Testanfrage ging an eine echte Bestell-/Produktions- oder kostenpflichtige KI-API. Lokaler Quellscan ohne Treffer vorhandener Secretwerte; `.env.local` bleibt ignoriert.

Die Browsersteuerung startete in dieser Sitzung nicht (Sandbox-/Node-Initialisierungsfehler). Lokal lieferten beide Hauptseiten HTTP 200; Betreiberseite ohne Anmeldung 307 zur Anmeldung, Betreiber-API ohne Berechtigung 403. Das ersetzt keine Sichtprüfung oder echte Smartphoneprüfung.

## Private Bereitstellung

Version **54** wurde am 17.10.2026 um 15:21 UTC erfolgreich unter `https://ab3d-swiss-design.berk-ermis.chatgpt.site` bereitgestellt. Geprüfter Anwendungscode: `e1bd049ac3fa70fb001ad8f637373c5faa09442f`, sowohl auf GitHub als auch im Site-Quellarchiv bestätigt. Deployment `appgdep_6ad3924aa36c8191b47c53ef178b3b9d`, Saved-Version `appgprj_6a69247390f08191811183b6a04bae94~appgver_70e0719adecc8191be3e4304c7f2ff25`; Status `succeeded`, Umgebungsrevision unverändert **11**. Owner-private blieb erhalten.

Paket: 114 Dateien, 9.349.120 Bytes, SHA-256 `7021c012bc3d65fa1eaa6c61a46bf800fa9e2871675b1a5445e4c32d8d569dc2`. Keine neue Migration. Der offizielle Quellhelfer synchronisierte den Commit; nach seinem bekannten Windows-Paketierungsstartfehler wurde mit dem vorhandenen Windows-Verfahren aus dem sauberen, geprüften HEAD gepackt. Keine Treffer der vorhandenen lokalen Schlüssel-/Token-/Secretwerte im Paket. Die neue Betreiberansicht wurde zum Öffnen in Codex vorgemerkt; die UI meldete `queued`, nicht eine bestätigte Sichtprüfung.

Dieser abschliessende Dokumentationsnachtrag ändert den bereitgestellten Anwendungscode nicht. Geschützter Betreiberbereich: `/cappatex/betrieb`, auch über das eigene Konto verlinkt. Kein kostenpflichtiger KI-Aufruf, Shopify-Upgrade, Zahlungswechsel, echter Kauf oder Printify-Produktionsauftrag wurde ausgelöst.
