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
- Uploads werden nach Typ und Größe geprüft und nicht dauerhaft gespeichert.
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

## Meldung von Schwachstellen

Bitte Sicherheitsprobleme nicht öffentlich als Issue veröffentlichen. Melde sie
vertraulich an die im Impressum angegebene AB3D-Kontaktadresse.
