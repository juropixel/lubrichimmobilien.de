# lubrichimmobilien.de

Neue Website von Lubrich Immobilien (Bad Berka). Statisch erzeugt, gehostet über **GitHub Pages** (Branch `main`, Ordner `/`).
Die Inserate kommen aus **onOffice** und werden automatisch übernommen.

## Aufbau

| Ordner / Datei | Inhalt |
|---|---|
| `src/pages/*.html` | Inhaltsseiten (Start, Leistungen, Über uns, Wertermittlung, Kontakt, Rechtliches) |
| `src/orte.mjs` | Orte im Einsatzgebiet → Regionskarte und Ortsseiten `/makler/<ort>/` |
| `src/site.config.mjs` | Firmendaten, Domain, Formular-Ziel |
| `data/immobilien.json` | Inserate (wird vom Sync geschrieben, nicht von Hand pflegen) |
| `bilder/immobilien/<id>/` | Objektfotos als WebP (groß + `-s` klein) |
| `assets/` | CSS, JavaScript, Schriften (lokal, keine Google-Verbindung), Logos |
| `scripts/build.mjs` | Erzeugt alle HTML-Seiten, `sitemap.xml`, `robots.txt`, `404.html` |
| `scripts/sync-onoffice.mjs` | Holt Inserate über die onOffice-API |
| `scripts/import-openimmo.mjs` | Alternative: importiert einen OpenImmo-Export (ZIP/Ordner) |
| `serverless/formular-worker.js` | Optional: leitet Formulare direkt an onOffice weiter |
| `.github/workflows/immobilien-sync.yml` | Stündlicher Sync + Build + Commit |

Die erzeugten HTML-Dateien (`index.html`, `immobilien/`, `immobilien-details/` …) liegen im Projektstamm und werden mit committet,
weil GitHub Pages direkt aus `main` ausliefert. **Texte immer in `src/` ändern**, danach `npm run build`.
Bei einem Push auf `main` baut der Workflow die Seite ohnehin neu.

Alle Adressen der alten Website bleiben erhalten (`/leistungen`, `/immobilienbewertung`, `/makler/weimar`,
`/immobilien-details/<nr>/<titel>/<ort>` …), damit Google-Einträge und Links weiter funktionieren.

## Lokal arbeiten

```bash
npm install
```

```bash
npm run build
```

```bash
npm run serve
```

Danach unter http://localhost:8080 ansehen.

## Inserate aus onOffice

### So läuft es heute (alte Website)

onOffice erstellt bei jeder Änderung einen **OpenImmo-Export** (ZIP mit XML und Bildern) und lädt ihn per FTP
auf den Webspace der alten Website (All-Inkl). Das Contao-CMS der Agentur moderne-medien liest diese Datei ein
(`files/openimmo/data/<objektnummer>/…`) und zeigt die Objekte an. Auf dieselbe Weise schickt onOffice die
Objekte an weitere Kanäle wie immowelt. Gepflegt wird alles nur in onOffice.

### So läuft es mit der neuen Website

**Empfohlen: onOffice-API (Pull)**

1. In onOffice einen API-Benutzer anlegen: *Extras → Einstellungen → Benutzer → API-Benutzer*
   (je nach Vertrag über den onOffice-Support/Marketplace freischalten lassen). Er braucht Leserechte auf Immobilien.
2. Token und Secret in GitHub hinterlegen: *Settings → Secrets and variables → Actions*
   → `ONOFFICE_TOKEN` und `ONOFFICE_SECRET`.
3. Fertig: Der Workflow „Immobilien aktualisieren“ läuft stündlich (6–21 Uhr) und kann im Tab *Actions*
   jederzeit per „Run workflow“ gestartet werden.

Es erscheinen alle Objekte, bei denen in onOffice **„Veröffentlichen“** (Homepage) gesetzt ist und der Status **aktiv** ist.
Die Straße wird nur angezeigt, wenn **„Objektadresse freigeben“** gesetzt ist.
Felder, die es im Mandanten nicht gibt, überspringt das Skript automatisch und meldet sie im Log.
Meldet onOffice 0 Objekte, bleibt die Website zur Sicherheit unverändert.

Lokal testen, ohne etwas zu speichern:

```bash
ONOFFICE_TOKEN=… ONOFFICE_SECRET=… ONOFFICE_DRY_RUN=1 node scripts/sync-onoffice.mjs
```

**Alternative: OpenImmo-Export weiter nutzen**

Der bestehende Export kann bleiben. Im onOffice-Export einen eigenen FTP-Zugang als Ziel eintragen
(Export-Typ „Vollabgleich“) und die Adresse als Secret `OPENIMMO_FTP_URL` hinterlegen
(z. B. `ftp://benutzer:passwort@server/openimmo/`). Der Workflow holt dann die neueste ZIP-Datei.
Nicht denselben Ordner wie die alte Contao-Seite verwenden, weil deren Import die Dateien nach dem Einlesen verschieben oder löschen kann.

Manuell:

```bash
node scripts/import-openimmo.mjs export.zip && node scripts/build.mjs
```

## Formulare (Kontakt, Exposé-Anfrage, Wertermittlung)

GitHub Pages kann keine Formulare verarbeiten. Es gibt zwei Betriebsarten (`formEndpoint` in `src/site.config.mjs`):

- **leer (Standard):** Beim Absenden öffnet sich das E-Mail-Programm der Besucher mit einer fertig ausgefüllten
  Nachricht an info@lubrichimmobilien.de. Das funktioniert sofort und ohne weiteren Dienst.
- **URL des Workers:** Die Anfrage wird direkt in onOffice angelegt (Aktion „Kontaktaufnahme“ wie beim
  onOffice-WordPress-Plugin) und von onOffice per E-Mail zugestellt. Einrichtung siehe Kopf von
  `serverless/formular-worker.js`. Danach in der Datenschutzerklärung Cloudflare ergänzen.

Der Bewertungsrechner bildet den Ablauf der alten Seite nach:
Grundstück (Fläche → Erschließung), Haus (Typ → Baujahr → Wohnfläche → Grundstück),
Wohnung (Baujahr → Wohnfläche → Zimmer), Gewerbe (Typ → Nutzfläche → Baujahr),
danach Lage, Anlass und Kontaktdaten. Wie bisher wird **kein Preis automatisch berechnet**:
Die Angaben gehen als Anfrage an den Makler.

## Eigene Domain umstellen

1. In den GitHub-Einstellungen *Pages → Custom domain* `www.lubrichimmobilien.de` eintragen
   (legt eine `CNAME`-Datei an) und „Enforce HTTPS“ aktivieren.
2. Beim Domain-Anbieter DNS ändern: `www` als CNAME auf `juropixel.github.io`, die Hauptdomain per
   A-Records auf die GitHub-Pages-IPs (siehe GitHub-Doku „Managing a custom domain“).
3. Vorher die OpenImmo-/API-Anbindung testen, damit nach dem Umzug sofort alle Objekte da sind.

Ohne eigene Domain läuft die Seite unter `https://juropixel.github.io/lubrichimmobilien.de/`.
Dann in `src/site.config.mjs` `basePath: '/lubrichimmobilien.de/'` setzen (nur für die 404-Seite nötig).

## Noch zu klären / offen

- **Foto von Franz Lubrich**: als `bilder/team/franz-lubrich.jpg` (Hochformat, ca. 640 × 800 px) ablegen, es erscheint dann automatisch.
- **Datenschutzerklärung und Impressum** wurden an die neue Technik angepasst (kein Cookie-Banner, keine Drittdienste nötig).
  Bitte vor dem Livegang rechtlich prüfen lassen.
- Die Stock-Fotos der alten Seite (Adobe Stock über die Agentur) werden bewusst **nicht** übernommen.
- Objekt 269 und 270 sind in onOffice doppelt angelegt (gleiches Haus, einmal mit Tippfehler „enziehen“), bei Objekt 273 fehlt der Preis.
