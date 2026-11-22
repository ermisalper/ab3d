# Integration und privates Deployment

Stand: 22.11.2026. Repository `ermisalper/ab3d`, Arbeitsbranch
`codex/cappatex-production`. Kein Merge und kein Deployment durch dieses Dokument.

## Verifizierter Ausgangspunkt

- Arbeitsbranch vor der CI-Korrektur: `a994303ba691556474d0807d85b001df88ea1800`.
- GitHub-`main`: `f64d13a48aa07e88c0e1b2cd9e76fb2768f97528`.
- Nativer GitHub-Vergleich am22.11.: Arbeitsbranch91Commits voraus,0zurück;
  Merge-Base ist genau der genannte main-Commit. Lokal fehlt lediglich ein eigener
  `main`-Branch; `origin/main` ist vorhanden. Kein Grund, Arbeitsdateien zu ersetzen.
- Vergleich am Ausgangspunkt:281Dateien,48.869Einfügungen/1.532Löschungen.
  Unter anderem Kundenabläufe, Katalog, Betreiberverwaltung, Tests, Lockfile,
  Hostingmanifest und Migrationen haben sich geändert. Ein pauschales Kopieren
  einzelner Ordner oder Zurücksetzen auf main würde zusammengehörige Arbeit verlieren.
- GitHub-Actions-Lauf43751561382, Job132926436104: TypeScript, ESLint und Build
  erfolgreich;942/943Tests bestanden. Fehler beim unmittelbaren Prüfen der
  wiederhergestellten Checkout-Schaltfläche in `tests/token-response-component.test.mjs:138`.
- Hostingprojekt: `appgprj_6a69247390f08191811183b6a04bae94`. Gespeicherter
  Kandidat68 ist kein Nachweis einer Datenbanksicherung. Er enthält spätere
  Quellkorrekturen nicht. Hosting-Quellremote/main und GitHub-main sind getrennt.

## Sicherer Integrationsweg

CI-Korrektur vom22.11.: Kein belegter Fehler im Produktcode. Der bestehende Test
behandelte den React-Klickabschluss als Abschluss der nativen WebCrypto-Arbeit.
Er wartet jetzt auf den tatsächlichen Refresh-Abschluss; alle ursprünglichen
UUID-, Zustimmungs-, POST- und Redirect-Prüfungen bleiben erhalten. Zwei zusätzliche
Regressionen kontrollieren einen verzögerten Digest und eine abgebrochene initiale
Wiederherstellung. `pnpm check` vollständig erfolgreich: **945/945Tests**, TypeScript,
ESLint und genau ein Produktionsbuild. Der zugehörige neue GitHub-Lauf wird nach
dem Push separat bestätigt; der ursprüngliche fehlgeschlagene Lauf bleibt Historie.

1. Änderungen auf dem Arbeitsbranch in überprüfbaren Commits sichern. Lockfile
   erhalten; keine zusätzlichen Paket- oder Framework-Upgrades zur Fehlerumgehung.
2. `pnpm check` mit tatsächlichen Anwendungskomponenten und Offline-Daten ausführen.
   Die Checkout-UUID muss nach einem echten asynchronen Wiederherstellungsabschluss
   dieselbe bleiben; weder POST noch Zahlung dürfen durch Wiederherstellung starten.
3. Commit pushen und den zugehörigen GitHub-CI-Lauf bis zum abgeschlossenen Ergebnis
   prüfen. Ein lokaler Erfolg allein erfüllt die CI-Abnahme nicht.
4. Vor einer späteren Integration GitHub-`main` erneut lesen und vergleichen. Ist
   main weitergezogen, die Änderungen auf dem Arbeitsbranch oder einem isolierten
   Integrationsbranch nachvollziehbar zusammenführen und die Checks wiederholen.
   Keine fremden Commits überschreiben, kein Force-Push und kein Reset von Kundendaten.
5. Einen Pull Request für den vollständigen geprüften Stand gegen main zur
   Überprüfung vorbereiten. Migrationen, Schutzschalter und Hostingmanifest
   ausdrücklich mitprüfen; kein automatischer Merge nach main.
6. Den exakt geprüften Quellcommit nach bestätigtem Backup über den unterstützten
   Sites-Quell-/Paketweg vorbereiten. Bereits erfolgreich durchgeführte unveränderte
   Builds wiederverwenden. Quell-SHA, Archiv-SHA und gespeicherte Version dokumentieren.

## Blockierende Voraussetzungen vor Produktionsmigrationen

Die private Bereitstellung ist bereits autorisiert. Es fehlt keine erneute allgemeine
Freigabe; die folgenden sachlichen Voraussetzungen fehlen weiterhin:

- Vollständiges D1-Backup mit Sicherungskennung beziehungsweise Datei, Zeitpunkt,
  allen Tabellen und ungekürzten langen JSON-Feldern. Der begrenzte Tabellenleser
  ist kein Backup. Gespeicherte Site-Versionen sichern den Code, nicht DB oder R2.
- Vom Hosting unterstützter, nachvollziehbarer Restoreweg für dieselbe Site.
  Wiederherstellbarkeit einschliesslich Beziehungen, Guthaben, Ledger, Anfragen
  und gespeicherten Gestaltungen belegen; lokale Testdaten ersetzen dieses Backup nicht.
- Für dauerhaft referenzierte Druckdateien zusätzlich Dateisicherung/Erhalt der
  R2-Objekte klären. Ein Datenbank-Export allein enthält diese Dateien nicht.
- Aktuellen Migrationsstand unmittelbar vorher lesen. Die am22.11. nativ sichtbaren
  21Tabellen enthalten weder `production_offer_drafts`/`production_offer_events`
  (0014) noch `ai_usage_admissions` (0016). Spalten und Indizes von0015 vor Ausführung
  gesondert prüfen; nicht aus einer Tabellenliste ableiten und nichts blind erneut ausführen.
- 0016 enthält ADD/UPDATE/DROP/RENAME einer Guthabenspalte. Die aktuelle Sites-
  Speicheranleitung verlangt schema-only-Migrationen und getrennte Backfills.
  Deshalb müssen unterstützte Ausführung und vollständige Atomarität dieser
  bestehenden Migration vor Veröffentlichung explizit geklärt werden. Bei
  fehlender Unterstützung einen zulässigen, datenerhaltenden Migrationsweg
  vorbereiten; keine bereits angewandte oder unklar angewandte Historie umschreiben.
  Lokale SQLite-Rollbacktests beweisen keine Hosted-Transaktion oder Restorefähigkeit.
- Vorbereitete und spätere neue Migrationen erst lokal mit Bestands- und Neudaten
  sowie Fehler/Rollback prüfen. Keine Produktions-DDL über einen Anfrage-Endpunkt.

## Private Abnahme nach erfüllten Voraussetzungen

Owner-private Audience beibehalten. Kunden-/Betreibertrennung, Guthaben, gespeicherte
Gestaltungen, Anfrage-Wiederaufnahme und neue Tabellen prüfen. Checkout, Tokenverkauf,
automatische Produktion und alle bisherigen Verkaufsfreigaben bleiben getrennte
Sperren. Kein bezahlter KI-Aufruf, keine Zahlung, Bestellung oder Produktion als
automatischer Deploymenttest. Erfolgreichen nativen Deploymentbeleg mit Version,
Quellcommit und URL dokumentieren; eine Browserabnahme gesondert ausweisen.
