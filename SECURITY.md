# Security Policy

## Geheimnisse

- API-Schlüssel und Zahlungsschlüssel gehören ausschließlich in geschützte
  Umgebungsvariablen.
- `.env`-Dateien, Zugangsdaten und Produktionsdaten dürfen nie committed
  werden.
- Offengelegte Schlüssel müssen sofort widerrufen und ersetzt werden.

## KI-Generierung

- Neue Konten erhalten 0 automatische Tokens. Bestehende Guthaben und explizite
  Token-Ausnahmen bleiben erhalten; Konto-E-Mails werden nicht zusammengeführt.
- Kostenpflichtige KI-Anfragen aller vier Dienste benötigen vor dem Anbieteraufruf
  eine atomare, gemeinsame D1-Reservierung. Kontogrenzen und gemeinsames UTC-Tageslimit
  gelten auch für Betreiber. Fehlende Migration, unklare Datenbankantwort oder ungültige
  Grenzwerte sperren den Aufruf, bevor Tokens abgezogen werden.
- Die Reservierungen zählen Versuche, keine CHF-Kosten. Sie bleiben auch nach
  Anbieterfehlern erhalten und lösen weder Wiederholung noch Tokenkorrektur aus.
  Gespeichert werden pseudonyme Konto-Hashes, Dienst und Zeitpunkt; keine Roh-E-Mails,
  Prompts, IP-Adressen oder Gerätefingerabdrücke. Dies erkennt keine Person hinter
  unterschiedlichen Konten. Vorhandene Guthaben werden nicht rückwirkend entzogen.
- Jeder kostenpflichtige Meshy-Auftrag erfordert eine serverseitig bestätigte
  Anmeldung und ausreichende AB3D Design-Tokens.
- Task-IDs werden einem Konto zugeordnet; fremde Tasks dürfen weder gelesen
  noch verfeinert werden.
- Fehlgeschlagene Generierungen werden einmalig zurückerstattet.
- Uploads werden nach Typ, Dateisignatur, dekodierten Abmessungen und Grösse
  geprüft. CAPPATEX-Originalmotive und private Gestaltungen werden geschützt
  kontogebunden gespeichert; öffentliche Galerien sind davon getrennt.
- Dateisignatur, Grösse und MIME-Typ werden serverseitig geprüft; aktive
  Uploadformate wie SVG oder HTML werden nicht akzeptiert.
- Modell- und Bild-URLs aus KI-Antworten werden im Browser auf verschlüsselte
  Meshy-Domains begrenzt.
- KI- und Abo-Anfragen begrenzen die tatsächlich gelesenen JSON-Bytes, auch ohne
  vertrauenswürdige Content-Length. Ungültiges UTF-8, fehlerhaftes JSON und falsche
  erforderliche Feldtypen werden vor Anbieteraufrufen zurückgewiesen.
- Im 3D-Studio sperrt ein synchroner Laufwächter doppelte Starts. Antworten eines
  gestoppten oder verlassenen Laufs dürfen weder das neue Modell überschreiben noch
  kostenpflichtige Folgeschritte auslösen. Eine gestoppte Ansicht storniert keinen
  bereits beim Anbieter gestarteten Auftrag.
- Verbindungstest und Startbeleg werden nach dem tatsächlichen Antwortvertrag geprüft.
  Unlesbare oder unvollständige Meshy-Annahmen, Transportfehler nach Versand sowie
  Anbieter-Serverfehler werden als unbestätigt gemeldet: kein erfundener Task, keine
  automatische Wiederholung und keine aus diesem unklaren Ausgang abgeleitete Gutschrift.
  Auch eine gescheiterte lokale Zuordnung nach Anbieterannahme verlangt zuerst Abgleich.
- Bildinterpretation und Folgegenerierung prüfen das notwendige Gesamtguthaben,
  damit kein kostenpflichtiger Zwischenschritt ohne nutzbares 3D-Ergebnis
  gestartet wird.

## Shop-Assistent

- Der OpenAI-Schlüssel bleibt serverseitig und wird nie an den Browser
  übertragen.
- Ohne OpenAI-Schlüssel arbeitet der Assistent mit kuratiertem Shopwissen.
- Live-KI benötigt Anmeldung und vorhandenes Guthaben oder explizite Token-Ausnahme,
  zählt zu den gemeinsamen Anfragegrenzen und erhält keine Zahlungs- oder
  API-Zugangsdaten. Ohne diese Voraussetzungen antwortet die kostenlose regelbasierte
  Hilfe. Es wird kein Token für diese Hilfsantworten abgezogen.

## Bestellanfragen

- Bestellungen erfordern eine serverseitig bestätigte Anmeldung und werden dem
  jeweiligen Konto zugeordnet.
- Produkt, Variante, Menge, Preis und Versandkosten werden ausschliesslich aus
  dem serverseitigen Katalog berechnet.
- Adress- und Freitextfelder besitzen feste Längen- und Plausibilitätsgrenzen.
- Öffentliche Bestellnummern verwenden zufällige, nicht fortlaufende Kennungen.
- Neue Studio-Anfragen verwenden eine stabile Wiederholungs-ID. Der Server
  bindet sie eindeutig an Konto und normalisierte Anfrage; dieselbe ID mit
  geändertem Inhalt wird abgewiesen. Automatische Wiederholungen sind nicht
  vorgesehen. Ältere Anfragen ohne Wiederholungs-ID bleiben lesbar.

## Konto und Abo-Anfragen

- Eine Abo-Anfrage ist keine Zahlung oder Abo-Aktivierung. Bestehende aktive,
  laufende Test- und andere bereits gesetzte Abostatus bleiben bei einer Anfrage
  erhalten. Derselbe noch offene Wunsch desselben Kontos wird nicht doppelt angelegt.
- Der Abo-Endpunkt prüft die Herkunft und erlaubt ausschliesslich eine bekannte
  Plan-ID; Token-, Preis-, Konto- und Statusfelder aus dem Browser werden abgewiesen.
  Wunsch und Anfrage werden in einer Datenbanktransaktion gespeichert.
- Kontoansichten trennen Daten und laufende Anfragen nach angemeldeter E-Mail.
  Fehlende oder unbestätigte Antworten erscheinen nicht als Nullguthaben, leere
  Bestellhistorie oder erfolgreiche Speicherung. Keine automatischen Schreibwiederholungen.

## Interne Bearbeitung und Angebotsentwürfe

- Betreiberlisten, Prüfdateien, Notizen und Angebotsentwürfe erfordern die
  serverseitige Betreiber-Allowlist. Eine Generierungsfreigabe oder die
  Kundeneigentümerschaft einer Anfrage erteilt keine Betreiberrechte.
- Änderungen benötigen gleiche Herkunft, begrenztes JSON, strenge Eingabeprüfung
  und eine passende gespeicherte Version. Entwurf und Änderungsnachweis werden
  atomar gespeichert; konkurrierende Änderungen werden nicht überschrieben.
- Unbekannte Beträge sind `null`. CHF-Cent-Beträge und getrennte einmalige bzw.
  stückbezogene Kosten werden serverseitig mit Ganzzahlarithmetik berechnet.
  Browser-Summen, Zahlungsstatus und Produktionsfreigaben sind keine zulässigen
  Eingabefelder eines Angebotsentwurfs.
- Entwürfe ändern keine Anfrage, Zahlung, Tokengutschrift oder Produktion und
  versenden keine Nachrichten. Ein fehlender oder beschädigter gespeicherter
  Stand wird nicht durch vermeintlich erfolgreiche Nullwerte ersetzt.
- Lokale Wiederherstellung nutzt begrenzte, validierte Daten im Sitzungsspeicher
  mit getrennten Kontoschlüsseln. Sie ersetzt keine Serverspeicherung. Die
  Benutzeroberfläche zeigt Speicherfehler und unbestätigte Schreibvorgänge an.

## Offline-Prüfungen

Tests verwenden synthetische Konten, lokale SQLite-Daten und simulierte
Anbieterantworten. DOM-Komponententests sind keine Browser-, Druck- oder
Live-Zahlungsabnahme. Qualitätschecks benötigen keine Anbieter-Secrets und
führen weder Produktionsmigrationen noch Deployments aus.

## Meldung von Schwachstellen

Bitte Sicherheitsprobleme nicht öffentlich als Issue veröffentlichen. Melde sie
vertraulich an die im Impressum angegebene AB3D-Kontaktadresse.
