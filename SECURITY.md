# Security Policy

## Geheimnisse

- API-Schlüssel und Zahlungsschlüssel gehören ausschließlich in geschützte
  Umgebungsvariablen.
- `.env`-Dateien, Zugangsdaten und Produktionsdaten dürfen nie committed
  werden.
- Offengelegte Schlüssel müssen sofort widerrufen und ersetzt werden.

## KI-Generierung

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
- Bildinterpretation und Folgegenerierung prüfen das notwendige Gesamtguthaben,
  damit kein kostenpflichtiger Zwischenschritt ohne nutzbares 3D-Ergebnis
  gestartet wird.

## Shop-Assistent

- Der OpenAI-Schlüssel bleibt serverseitig und wird nie an den Browser
  übertragen.
- Ohne OpenAI-Schlüssel arbeitet der Assistent mit kuratiertem Shopwissen.
- Live-KI ist nur für angemeldete Nutzer aktiv, begrenzt die Anfragerate und
  erhält keine Zahlungs- oder API-Zugangsdaten.

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
