#!/usr/bin/env node
// Erzeugt die statische Website (HTML-Dateien im Projektstamm) für GitHub Pages.
//   Quellen:  src/pages/*.html  (Inhaltsseiten)   data/immobilien.json  (Inserate)
//   Aufruf:   npm run build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../src/site.config.mjs';
import { orte, buero, entfernungKm } from '../src/orte.mjs';
import { esc, euro, flaeche, zahl, absaetze, slugify } from './lib/format.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = config.firma;
const daten = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/immobilien.json'), 'utf8'));
const objekte = (daten.objekte || []).filter((o) => o.status !== 'inaktiv');
const logoMark = fs.readFileSync(path.join(ROOT, 'src/partials/logo-mark.svg'), 'utf8')
  .replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
// Cache-Version aus dem Inhalt von CSS/JS – ändert sich nur, wenn sich die Dateien ändern
const assetVersion = (await import('node:crypto')).createHash('sha1')
  .update(fs.readFileSync(path.join(ROOT, 'assets/css/site.css')))
  .update(fs.readFileSync(path.join(ROOT, 'assets/js/site.js')))
  .digest('hex').slice(0, 10);
const erzeugt = [];

// ---------------------------------------------------------------- Hilfen
const rel = (depth) => (depth === 0 ? '' : '../'.repeat(depth));
const tiefe = (p) => (p === '' ? 0 : p.replace(/\/$/, '').split('/').length);

function schreibe(seitenPfad, html) {
  const ziel = seitenPfad.endsWith('.html')
    ? path.join(ROOT, seitenPfad)
    : path.join(ROOT, seitenPfad, 'index.html');
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, html);
  erzeugt.push(seitenPfad);
}

export function objektPfad(o) {
  return `immobilien-details/${encodeURIComponent(o.id)}/${o.slug || slugify(o.titel)}/${slugify(o.adresse?.ort || 'ort')}/`;
}

function preisInfo(o) {
  const p = o.preise || {};
  if (o.vermarktung === 'Miete') {
    if (p.kaltmiete) return { label: 'Kaltmiete', wert: euro(p.kaltmiete), zahl: p.kaltmiete };
    if (p.warmmiete) return { label: 'Warmmiete', wert: euro(p.warmmiete), zahl: p.warmmiete };
  } else if (p.kaufpreis) return { label: 'Kaufpreis', wert: euro(p.kaufpreis), zahl: p.kaufpreis };
  return { label: o.vermarktung === 'Miete' ? 'Miete' : 'Kaufpreis', wert: 'auf Anfrage', zahl: null };
}

function eckdaten(o) {
  const f = o.flaechen || {};
  const liste = [];
  if (o.zimmer) liste.push(['Zimmer', zahl(o.zimmer)]);
  if (f.wohnflaeche) liste.push(['Wohnfläche', flaeche(f.wohnflaeche)]);
  else if (f.nutzflaeche) liste.push(['Nutzfläche', flaeche(f.nutzflaeche)]);
  if (f.grundstuecksflaeche) liste.push(['Grundstück', flaeche(f.grundstuecksflaeche)]);
  else if (o.stellplaetze) liste.push(['Stellplätze', zahl(o.stellplaetze)]);
  return liste;
}

const icon = {
  telefon: '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M5 3.5h3.2l1.6 4.2-2.1 1.4a11.5 11.5 0 0 0 7.2 7.2l1.4-2.1 4.2 1.6V19a1.6 1.6 0 0 1-1.7 1.6A16.6 16.6 0 0 1 3.4 5.2 1.6 1.6 0 0 1 5 3.5Z"/></svg>',
  mail: '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M3.5 5.5h17v13h-17zM3.5 6l8.5 7 8.5-7"/></svg>',
  pin: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  waage: '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 20h16M12 4v16M5 8h14M5 8l-2.5 6h5L5 8Zm14 0-2.5 6h5L19 8Z"/></svg>',
  menu: '<svg aria-hidden="true" viewBox="0 0 24 24" width="26" height="26"><path stroke="currentColor" stroke-width="2" d="M3 7h18M3 12h18M3 17h18"/></svg>',
  instagram: '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>'
};

// Piktogramme für den Bewertungsrechner (eigene Zeichnungen, gleiche Strichstärke)
const pikto = {
  grundstueck: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 40 20 14h30l8 26Z"/><path d="M20 14l-3 26M33 14v26M46 14l3 26M9 32h50M14 22h41"/></svg>',
  haus: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M8 24 32 6l24 18"/><path d="M14 20v22h36V20"/><path d="M27 42V30h10v12"/><path d="M43 12V6h5v10"/></svg>',
  wohnung: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M16 42V6h32v36"/><path d="M10 42h44"/><path d="M23 12h6v5h-6zM35 12h6v5h-6zM23 22h6v5h-6zM35 22h6v5h-6zM29 42v-8h6v8"/></svg>',
  gewerbe: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 42V22l12-7v7l12-7v7l12-7V8h8v34Z"/><path d="M4 42h56M14 32h6M26 32h6M38 32h6"/></svg>',
  efh: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M12 24 32 8l20 16"/><path d="M17 20v22h30V20M28 42V31h8v11"/></svg>',
  mfh: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M12 16 32 4l20 12"/><path d="M15 14v28h34V14"/><path d="M21 20h6v5h-6zM37 20h6v5h-6zM21 30h6v5h-6zM37 30h6v5h-6zM29 42v-9h6v9"/></svg>',
  buero: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M18 42V4h28v38M12 42h40"/><path d="M24 10h16M24 16h16M24 22h16M24 28h16M29 42v-7h6v7"/></svg>',
  wohnGeschaeft: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M12 42V12l20-8 20 8v30"/><path d="M8 42h48M18 32h28M18 32v10M46 32v10M20 18h6v6h-6zM38 18h6v6h-6z"/></svg>',
  halle: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 42V18c8-10 44-10 52 0v24"/><path d="M4 42h56M20 42V28h24v14M20 33h24M20 38h24"/></svg>',
  erschlossen: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 40 18 16h28l12 24Z"/><path d="M32 4v22M26 10h12M24 26h16"/><circle cx="32" cy="32" r="3"/></svg>',
  teilerschlossen: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 40 18 16h28l12 24Z"/><path d="M32 4v10M32 18v8" stroke-dasharray="3 3"/><path d="M26 10h12"/></svg>',
  unerschlossen: '<svg viewBox="0 0 64 48" aria-hidden="true"><path d="M6 40 18 16h28l12 24Z"/><path d="M22 24c4 4 6 4 10 0s6-4 10 0M18 32c5 4 9 4 14 0s9-4 14 0"/></svg>',
  zimmer: (n) => `<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="8" y="8" width="48" height="34" rx="1"/>${n >= 2 ? '<path d="M32 8v34"/>' : ''}${n >= 3 ? '<path d="M8 25h24"/>' : ''}${n >= 4 ? '<path d="M32 25h24"/>' : ''}</svg>`
};

// ---------------------------------------------------------------- Layout
const navigation = [
  ['immobilien/', 'Immobilien'],
  ['immobilienbewertung/', 'Wertermittlung'],
  ['leistungen/', 'Leistungen'],
  ['ueber-uns/', 'Über uns'],
  ['kontakt/', 'Kontakt']
];

function layout({ pfad, titel, beschreibung, inhalt, bodyKlasse = '', head = '', basis, ogBild }) {
  const r = basis ?? rel(tiefe(pfad));
  const canonical = `${config.url}/${pfad}`;
  const aktiv = (p) => (pfad === p || (p !== '' && pfad.startsWith(p)) || (p === 'immobilien/' && pfad.startsWith('immobilien-details/')) || (p === 'ueber-uns/' && pfad.startsWith('ueber-uns')));
  const nav = navigation
    .map(([p, t]) => `<li><a href="${r}${p}"${aktiv(p) ? ' aria-current="page"' : ''}>${t}</a></li>`)
    .join('');
  const og = ogBild ? `${config.url}/${ogBild}` : `${config.url}/assets/img/og-lubrich-immobilien.png`;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<meta name="description" content="${esc(beschreibung)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:locale" content="de_DE">
<meta property="og:site_name" content="${esc(F.name)}">
<meta property="og:title" content="${esc(titel)}">
<meta property="og:description" content="${esc(beschreibung)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${og}">
<meta name="theme-color" content="#0b2341">
<link rel="icon" href="${r}favicon.ico" sizes="any">
<link rel="icon" href="${r}assets/img/icon-lubrich.svg" type="image/svg+xml">
<link rel="preload" href="${r}assets/fonts/barlow-semi-condensed-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${r}assets/fonts/barlow-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${r}assets/css/site.css?v=${assetVersion}">
${head}
</head>
<body class="${bodyKlasse}" data-root="${r}" data-form-endpoint="${esc(config.formEndpoint)}" data-email="${esc(F.email)}">
<a class="skip" href="#inhalt">Zum Inhalt springen</a>
<header class="kopf">
  <div class="kopf__innen">
    <a class="marke" href="${r || './'}" aria-label="${esc(F.name)} – Startseite">
      <span class="marke__zeichen">${logoMark}</span>
      <span class="marke__name">Lubrich <span>Immobilien</span></span>
    </a>
    <nav class="hauptnav" id="hauptnav" aria-label="Hauptnavigation">
      <ul>${nav}</ul>
    </nav>
    <a class="kopf__telefon" href="tel:${F.telefonLink}">${icon.telefon}<span>${F.telefon}</span></a>
    <button class="kopf__menue" type="button" aria-expanded="false" aria-controls="hauptnav">${icon.menu}<span class="sr">Menü</span></button>
  </div>
</header>
<main id="inhalt">
${inhalt}
</main>
${fuss(r)}
<nav class="aktionsleiste" aria-label="Schnellkontakt">
  <a href="tel:${F.telefonLink}">${icon.telefon}<span>Anrufen</span></a>
  <a href="${r}immobilienbewertung/">${icon.waage}<span>Bewerten</span></a>
  <a href="mailto:${F.email}">${icon.mail}<span>E-Mail</span></a>
</nav>
<script src="${r}assets/js/site.js?v=${assetVersion}" defer></script>
</body>
</html>
`;
}

function fuss(r) {
  const ortLinks = orte.filter((o) => o.seite)
    .map((o) => `<li><a href="${r}makler/${o.slug}/">Makler ${o.name}</a></li>`).join('');
  return `<footer class="fuss">
  <div class="fuss__innen">
    <div class="fuss__marke">
      <span class="marke__zeichen marke__zeichen--hell">${logoMark}</span>
      <p><strong>${F.name}</strong><br>${F.strasse}<br>${F.plz} ${F.ort}</p>
      <p><a href="tel:${F.telefonLink}">${F.telefon}</a><br><a href="mailto:${F.email}">${F.email}</a></p>
    </div>
    <div>
      <h2 class="fuss__titel">Unsere Region</h2>
      <ul class="fuss__liste">${ortLinks}</ul>
    </div>
    <div>
      <h2 class="fuss__titel">Service</h2>
      <ul class="fuss__liste">
        <li><a href="${r}immobilien/">Aktuelle Immobilien</a></li>
        <li><a href="${r}immobilienbewertung/">Kostenlose Wertermittlung</a></li>
        <li><a href="${r}leistungen/">Leistungen</a></li>
        <li><a href="${r}ueber-uns/kundenstimmen/">Kundenstimmen</a></li>
        <li><a href="${r}kontakt/">Kontakt</a></li>
      </ul>
    </div>
    <div class="fuss__partner">
      <h2 class="fuss__titel">Mitglied und Partner</h2>
      <a href="https://www.ihk.de/erfurt/" rel="noopener" target="_blank"><img src="${r}assets/img/ihk-erfurt.svg" alt="IHK Erfurt" width="150" height="48" loading="lazy"></a>
      <a href="${F.immowelt}" rel="noopener" target="_blank"><img src="${r}assets/img/immowelt-partner.svg" alt="immowelt Partner" width="56" height="56" loading="lazy"></a>
      <a class="fuss__social" href="${F.instagram}" rel="noopener" target="_blank">${icon.instagram}<span>Instagram</span></a>
    </div>
  </div>
  <div class="fuss__recht">
    <p>© ${new Date().getFullYear()} ${F.name}</p>
    <ul>
      <li><a href="${r}impressum/">Impressum</a></li>
      <li><a href="${r}datenschutz/">Datenschutz</a></li>
      <li><a href="${r}widerrufsbelehrung/">Widerrufsbelehrung</a></li>
      <li><a href="${r}barrierefreiheit/">Barrierefreiheit</a></li>
    </ul>
  </div>
</footer>`;
}

// ---------------------------------------------------------------- Bausteine
function objektKarte(o, r, { ueberschrift = 'h3' } = {}) {
  const b = o.bilder?.[0];
  const p = preisInfo(o);
  const H = ueberschrift;
  const fakten = eckdaten(o).map(([l, w]) => `<div><dt>${l}</dt><dd>${w}</dd></div>`).join('');
  const typ = [o.objektart, o.vermarktung === 'Miete' ? 'zur Miete' : 'zum Kauf'].filter(Boolean).join(' ');
  return `<article class="karte" data-vermarktung="${esc(o.vermarktung)}" data-art="${esc(o.objektart)}" data-ort="${esc(o.adresse?.ort)}" data-preis="${p.zahl ?? ''}" data-flaeche="${o.flaechen?.wohnflaeche ?? o.flaechen?.nutzflaeche ?? ''}" data-zimmer="${o.zimmer ?? ''}" data-nr="${esc(o.id)}">
  <a class="karte__link" href="${r}${objektPfad(o)}">
    <div class="karte__bild">${b ? `<img src="${r}${b.klein || b.datei}" alt="${esc(b.titel || o.titel)}" width="${b.w || 800}" height="${b.h || 600}" loading="lazy" decoding="async">` : '<span class="karte__ohnebild">Bilder auf Anfrage</span>'}
      <span class="karte__typ">${esc(typ)}</span>${o.status === 'reserviert' ? '<span class="karte__status">Reserviert</span>' : ''}</div>
    ${o.flaechen?.wohnflaeche || o.flaechen?.grundstuecksflaeche ? `<span class="karte__mass" aria-hidden="true"><span>${o.flaechen?.wohnflaeche ? `${flaeche(o.flaechen.wohnflaeche)} Wohnfläche` : `${flaeche(o.flaechen.grundstuecksflaeche)} Grundstück`}</span></span>` : ''}
    <div class="karte__text">
      <p class="karte__ort">${icon.pin}${esc(o.adresse?.plz || '')} ${esc(o.adresse?.ort || '')}</p>
      <${H} class="karte__titel">${esc(o.titel)}</${H}>
      <dl class="karte__fakten">${fakten}</dl>
      <p class="karte__preis"><span>${p.label}</span> ${p.wert}</p>
    </div>
  </a>
</article>`;
}

function objektListe(r, liste = objekte, opts) {
  if (!liste.length) {
    return `<div class="leer"><p>Gerade sind alle Objekte vermittelt. Neue Angebote kommen laufend hinzu – mit einem Suchauftrag erfahren Sie als Erste davon.</p><p><a class="knopf knopf--hell" href="${r}kontakt/#suche">Suchauftrag anlegen</a></p></div>`;
  }
  return `<div class="karten">${liste.map((o) => objektKarte(o, r, opts)).join('\n')}</div>`;
}

function bewertungStart(r) {
  const arten = [
    ['grundstueck', 'Grundstück', pikto.grundstueck],
    ['haus', 'Haus', pikto.haus],
    ['wohnung', 'Wohnung', pikto.wohnung],
    ['gewerbe', 'Gewerbe', pikto.gewerbe]
  ];
  return `<form class="schnellwahl" action="${r}immobilienbewertung/" method="get">
  <fieldset>
    <legend>Welche Immobilie möchten Sie bewerten lassen?</legend>
    <div class="schnellwahl__optionen">
      ${arten.map(([w, t, svg]) => `<button class="wahl" type="submit" name="art" value="${w}">${svg}<span>${t}</span></button>`).join('')}
    </div>
  </fieldset>
  <p class="schnellwahl__hinweis">Kostenlos und unverbindlich. Dauert etwa zwei Minuten.</p>
</form>`;
}

function regionKarte(r, { aktiv } = {}) {
  // Einfache Projektion: Längengrad gestaucht mit cos(Breite)
  const W = 640, H = 420, pad = 48;
  const pts = orte.filter((o) => o.karte !== false);
  const k = Math.cos((51 * Math.PI) / 180);
  const xs = pts.map((o) => o.lon * k), ys = pts.map((o) => o.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
  const ox = (W - (maxX - minX) * s) / 2, oy = (H - (maxY - minY) * s) / 2;
  const P = (o) => [ox + (o.lon * k - minX) * s, oy + (maxY - o.lat) * s];
  const [bx, by] = P(buero);
  const kmPx = s / 111.2; // 1 km in Pixeln (Breitengrad ≈ 111,2 km)
  const ringe = [5, 10, 15, 20].map((km) => `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${(km * kmPx).toFixed(1)}" class="karte-ring"/>`).join('');
  const ringLabel = [10, 20].map((km) => `<text x="${(bx + km * kmPx * 0.707 + 4).toFixed(1)}" y="${(by - km * kmPx * 0.707 - 4).toFixed(1)}" class="karte-km">${km} km</text>`).join('');
  const punkte = pts.map((o) => {
    const [x, y] = P(o);
    const istBuero = o.slug === 'bad-berka';
    const label = `<text x="${(x + 10).toFixed(1)}" y="${(y + 5).toFixed(1)}">${o.name}</text>`;
    const kreis = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${istBuero ? 9 : o.referenz ? 4 : 6}" class="${istBuero ? 'karte-buero' : o.referenz ? 'karte-ref' : 'karte-ort'}"/>`;
    const cls = `karte-punkt${o.slug === aktiv ? ' ist-aktiv' : ''}${o.referenz ? ' ist-ref' : ''}`;
    return o.seite
      ? `<a href="${r}makler/${o.slug}/" class="${cls}">${kreis}${label}</a>`
      : `<g class="${cls}">${kreis}${label}</g>`;
  }).join('');
  return `<figure class="region">
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="region-titel">
    <title id="region-titel">Karte: Orte im Umkreis von Bad Berka, in denen wir Immobilien vermitteln</title>
    ${ringe}${ringLabel}${punkte}
  </svg>
  <figcaption>Kreise im Abstand von 5 km um unser Büro in Bad Berka.</figcaption>
</figure>`;
}

const stimmen = [
  { name: 'K. Deubert', text: 'Der Verkauf meines Hauses war nicht einfach, aber Herr Lubrich hat mich mit viel Fachwissen, Geduld und Engagement hervorragend begleitet. Er war stets erreichbar, ehrlich in der Beratung und lösungsorientiert. Dank seiner Unterstützung konnte das Haus erfolgreich verkauft werden. Sehr empfehlenswert!' },
  { name: 'Petra', text: 'Ich habe mich von Franz Lubrich von Beginn an sehr gut beraten und verstanden gefühlt. Er war immer ansprechbar bzw. hat sofort zurückgerufen. Für jede Frage und jedes noch so kleine Anliegen hat er sich Zeit genommen. Ich empfehle Herrn Lubrich sehr!' },
  { name: 'MR', text: 'Ich habe Herrn Lubrich im Rahmen einer Immobilienbesichtigung kennengelernt und bereits beim ersten telefonischen Kontakt seine außergewöhnlich kundenorientierte und hilfsbereite Art sehr zu schätzen gewusst. Während der Besichtigung nahm er sich viel Zeit und überzeugte durch seine fachkundige und kompetente Beratung – ein Aspekt, der meiner Meinung nach gerade beim Immobilienkauf von entscheidender Bedeutung ist, da Vertrauen und Zuverlässigkeit hier eine große Rolle spielen. Auch wenn ich mich damals nicht für den Kauf der besichtigten Immobilie entschieden habe, konnte ich mich später bei einem anderen Immobilienvorhaben erneut an Herrn Lubrich wenden. Er nahm sich mit großer Geduld und Engagement meiner Anliegen an und stand mir mit seinem fundierten Wissen und seiner ehrlichen Einschätzung als verlässlicher Berater zur Seite. Wer auf der Suche nach einer Immobilie ist oder eine kompetente Beratung benötigt, dem kann ich Herrn Lubrich uneingeschränkt und wärmstens empfehlen.' },
  { name: 'Collin Meiburg', text: 'Ehrlich, Kompetent und Zuverlässig!' }
];

function stimmenBlock(r, { alle = false } = {}) {
  const liste = alle ? stimmen : stimmen.slice(0, 3);
  const sterne = '<span class="sterne" role="img" aria-label="5 von 5 Sternen">★★★★★</span>';
  return `<div class="stimmen${alle ? ' stimmen--alle' : ''}">
  ${liste.map((s) => `<figure class="stimme">${sterne}<blockquote><p>${esc(s.text)}</p></blockquote><figcaption>${esc(s.name)} <span>auf Google</span></figcaption></figure>`).join('\n  ')}
</div>`;
}

function ansprechpartner(r) {
  const foto = fs.existsSync(path.join(ROOT, 'bilder/team/franz-lubrich.jpg'));
  return `<aside class="person">
  ${foto ? `<img class="person__foto" src="${r}bilder/team/franz-lubrich.jpg" alt="Franz Lubrich" width="320" height="400" loading="lazy">` : '<div class="person__foto person__foto--initialen" aria-hidden="true">FL</div>'}
  <div>
    <p class="person__name">Franz Lubrich</p>
    <p class="person__rolle">Inhaber und Immobilienmakler</p>
    <p class="person__kontakt"><a href="tel:${F.telefonLink}">${icon.telefon}${F.telefon}</a><a href="mailto:${F.email}">${icon.mail}${F.email}</a></p>
  </div>
</aside>`;
}

function kontaktBand(r, { titel = 'Lassen Sie uns über Ihre Immobilie sprechen.', text = 'Rufen Sie an oder schreiben Sie uns. Das erste Gespräch und die Einschätzung vor Ort sind kostenlos.' } = {}) {
  return `<section class="band band--nacht" aria-labelledby="kontakt-band">
  <div class="rahmen band__raster">
    <div>
      <h2 id="kontakt-band">${titel}</h2>
      <p>${text}</p>
    </div>
    <div class="band__aktionen">
      <a class="knopf knopf--gold" href="tel:${F.telefonLink}">${icon.telefon}${F.telefon}</a>
      <a class="knopf knopf--rand-hell" href="${r}kontakt/">Nachricht schreiben</a>
    </div>
  </div>
</section>`;
}

const schutzHinweis = (r) => `<label class="einwilligung"><input type="checkbox" name="datenschutz" value="akzeptiert" required>
  <span>Ich habe die <a href="${r}datenschutz/" target="_blank">Datenschutzerklärung</a> gelesen und bin einverstanden, dass meine Angaben zur Bearbeitung meiner Anfrage gespeichert werden. Die Einwilligung kann ich jederzeit per E-Mail widerrufen.*</span></label>`;

const honeypot = '<div class="hp" aria-hidden="true"><label>Firma (bitte leer lassen)<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>';

function anfrageFormular(r, o) {
  return `<form class="formular" data-formular="objektanfrage" data-betreff="Anfrage zu Objekt ${esc(o.objektnr || o.id)}: ${esc(o.titel)}" novalidate>
  <input type="hidden" name="objektnr" value="${esc(o.objektnr || o.id)}">
  <input type="hidden" name="objekt_id" value="${esc(o.id)}">
  <input type="hidden" name="objekttitel" value="${esc(o.titel)}">
  <div class="feld"><label for="a-name">Name*</label><input id="a-name" name="name" autocomplete="name" required></div>
  <div class="feld"><label for="a-mail">E-Mail*</label><input id="a-mail" name="email" type="email" autocomplete="email" required></div>
  <div class="feld"><label for="a-tel">Telefon</label><input id="a-tel" name="telefon" type="tel" autocomplete="tel"></div>
  <div class="feld"><label for="a-msg">Nachricht</label><textarea id="a-msg" name="nachricht" rows="4">Ich interessiere mich für dieses Objekt und bitte um das ausführliche Exposé.</textarea></div>
  ${honeypot}
  ${schutzHinweis(r)}
  <button class="knopf knopf--voll" type="submit">Exposé anfordern</button>
  <div class="formular__status" role="status" aria-live="polite"></div>
</form>`;
}

// ---------------------------------------------------------------- Seiten aus src/pages
function bausteine(r, pfad) {
  return {
    root: r,
    telefon: F.telefon,
    telefonLink: F.telefonLink,
    email: F.email,
    'objekte:neueste': objektListe(r, objekte.slice(0, 3)),
    'objekte:anzahl': String(objekte.length),
    'objekte:anzahl-text': objekte.length === 1 ? 'ein Angebot' : `${objekte.length} Angebote`,
    'bewertung:start': bewertungStart(r),
    'region:karte': regionKarte(r),
    'region:liste': orte.filter((o) => o.seite).map((o) => `<li><a href="${r}makler/${o.slug}/">${o.name}</a></li>`).join(''),
    stimmen: stimmenBlock(r),
    'stimmen:alle': stimmenBlock(r, { alle: true }),
    ansprechpartner: ansprechpartner(r),
    'kontakt:band': kontaktBand(r),
    einwilligung: schutzHinweis(r),
    honeypot,
    'icon:telefon': icon.telefon,
    'icon:mail': icon.mail,
    'icon:pin': icon.pin,
    'pikto:grundstueck': pikto.grundstueck, 'pikto:haus': pikto.haus, 'pikto:wohnung': pikto.wohnung, 'pikto:gewerbe': pikto.gewerbe,
    'pikto:efh': pikto.efh, 'pikto:mfh': pikto.mfh, 'pikto:buero': pikto.buero, 'pikto:wohnGeschaeft': pikto.wohnGeschaeft, 'pikto:halle': pikto.halle,
    'pikto:erschlossen': pikto.erschlossen, 'pikto:teilerschlossen': pikto.teilerschlossen, 'pikto:unerschlossen': pikto.unerschlossen,
    'pikto:zimmer1': pikto.zimmer(1), 'pikto:zimmer2': pikto.zimmer(2), 'pikto:zimmer3': pikto.zimmer(3), 'pikto:zimmer4': pikto.zimmer(4),
    jahr: String(new Date().getFullYear())
  };
}

function fuelle(html, werte, datei) {
  return html.replace(/\{\{\s*([\w:-]+)\s*\}\}/g, (_, k) => {
    if (!(k in werte)) throw new Error(`Unbekannter Platzhalter {{${k}}} in ${datei}`);
    return werte[k];
  });
}

function inhaltsSeiten() {
  const dir = path.join(ROOT, 'src/pages');
  for (const datei of fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const roh = fs.readFileSync(path.join(dir, datei), 'utf8');
    const m = roh.match(/^<!--\s*([\s\S]*?)\s*-->\s*/);
    if (!m) throw new Error(`${datei}: Kopfkommentar mit JSON fehlt`);
    const meta = JSON.parse(m[1]);
    const r = rel(tiefe(meta.pfad));
    const inhalt = fuelle(roh.slice(m[0].length), bausteine(r, meta.pfad), datei);
    const head = meta.jsonld ? `<script type="application/ld+json">${JSON.stringify(meta.jsonld === 'firma' ? firmaJsonLd() : meta.jsonld)}</script>` : '';
    schreibe(meta.pfad, layout({ pfad: meta.pfad, titel: meta.titel, beschreibung: meta.beschreibung, inhalt, bodyKlasse: meta.klasse || '', head }));
  }
}

function firmaJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: F.name,
    url: config.url + '/',
    telephone: F.telefonLink,
    email: F.email,
    image: `${config.url}/assets/img/og-lubrich-immobilien.png`,
    address: { '@type': 'PostalAddress', streetAddress: F.strasse, postalCode: F.plz, addressLocality: F.ort, addressCountry: 'DE' },
    geo: { '@type': 'GeoCoordinates', latitude: F.geo.lat, longitude: F.geo.lon },
    areaServed: orte.filter((o) => o.seite).map((o) => o.name),
    founder: { '@type': 'Person', name: F.inhaber },
    sameAs: [F.instagram, F.immowelt]
  };
}

// ---------------------------------------------------------------- Immobilien-Übersicht
function immobilienSeite() {
  const pfad = 'immobilien/';
  const r = rel(tiefe(pfad));
  const arten = [...new Set(objekte.map((o) => o.objektart).filter(Boolean))].sort();
  const orteListe = [...new Set(objekte.map((o) => o.adresse?.ort).filter(Boolean))].sort();
  const inhalt = `
<section class="seitenkopf">
  <div class="rahmen">
    <h1>Unsere Immobilien</h1>
    <p class="seitenkopf__text">Aktuelle Häuser, Wohnungen und Anlageobjekte im Weimarer Land und Umgebung – zum Kauf und zur Miete.</p>
  </div>
</section>
<section class="rahmen abschnitt-klein" aria-label="Angebote">
  <form class="filter" data-filter aria-label="Angebote filtern">
    <fieldset class="segment">
      <legend class="sr">Vermarktungsart</legend>
      <label><input type="radio" name="vermarktung" value="" checked><span>Alle</span></label>
      <label><input type="radio" name="vermarktung" value="Kauf"><span>Kaufen</span></label>
      <label><input type="radio" name="vermarktung" value="Miete"><span>Mieten</span></label>
    </fieldset>
    <label class="filter__feld"><span>Objektart</span><select name="art"><option value="">Alle</option>${arten.map((a) => `<option>${esc(a)}</option>`).join('')}</select></label>
    <label class="filter__feld"><span>Ort</span><select name="ort"><option value="">Alle Orte</option>${orteListe.map((a) => `<option>${esc(a)}</option>`).join('')}</select></label>
    <label class="filter__feld"><span>Sortierung</span><select name="sortierung"><option value="neu">Neueste zuerst</option><option value="preis-auf">Preis aufsteigend</option><option value="preis-ab">Preis absteigend</option><option value="flaeche-ab">Größte Fläche</option></select></label>
  </form>
  <p class="trefferzahl" data-treffer aria-live="polite">${objekte.length} ${objekte.length === 1 ? 'Angebot' : 'Angebote'}</p>
  ${objektListe(r, objekte, { ueberschrift: 'h2' })}
  <p class="leer leer--filter" data-leer hidden>Keine Angebote passen zu Ihrer Auswahl. <button type="button" class="textknopf" data-filter-reset>Filter zurücksetzen</button></p>
</section>
<section class="band band--kalk" aria-labelledby="suchauftrag">
  <div class="rahmen band__raster">
    <div>
      <h2 id="suchauftrag">Nichts Passendes dabei?</h2>
      <p>Sagen Sie uns, was Sie suchen – wir melden uns, sobald ein passendes Objekt in die Vermarktung geht.</p>
    </div>
    <div class="band__aktionen"><a class="knopf" href="${r}kontakt/#suche">Suchauftrag anlegen</a></div>
  </div>
</section>`;
  schreibe(pfad, layout({ pfad, titel: 'Immobilien kaufen & mieten im Weimarer Land | Lubrich Immobilien', beschreibung: `Aktuelle Immobilienangebote von Lubrich Immobilien: ${objekte.length} Häuser, Wohnungen und Anlageobjekte in Bad Berka, Weimar, Apolda und Umgebung.`, inhalt }));
}

// ---------------------------------------------------------------- Exposé-Seiten
function energieSkala(e) {
  const wert = e.verbrauchskennwert ?? e.bedarfskennwert ?? e.endenergie;
  if (wert === undefined || wert === null) return '';
  const klassen = [['A+', 30], ['A', 50], ['B', 75], ['C', 100], ['D', 130], ['E', 160], ['F', 200], ['G', 250], ['H', 300]];
  const pos = Math.max(0, Math.min(100, (Number(wert) / 275) * 100));
  return `<div class="energie" aria-hidden="true">
  <div class="energie__skala">${klassen.map(([k]) => `<span>${k}</span>`).join('')}</div>
  <div class="energie__zeiger" style="left:${pos.toFixed(1)}%"><span>${zahl(wert, 1)}</span></div>
</div>`;
}

function exposeSeite(o) {
  const pfad = objektPfad(o);
  const r = rel(tiefe(pfad));
  const p = preisInfo(o);
  const bilder = o.bilder || [];
  const f = o.flaechen || {};
  const pr = o.preise || {};
  const e = o.energie || {};

  const tabelle = (zeilen) => {
    const z = zeilen.filter(([, w]) => w !== '' && w !== null && w !== undefined);
    return z.length ? `<dl class="tabelle">${z.map(([l, w]) => `<div><dt>${l}</dt><dd>${esc(w)}</dd></div>`).join('')}</dl>` : '';
  };

  const preise = o.vermarktung === 'Miete'
    ? [['Kaltmiete', euro(pr.kaltmiete)], ['Nebenkosten', euro(pr.nebenkosten)], ['Warmmiete', euro(pr.warmmiete)], ['Kaution', euro(pr.kaution)]]
    : [['Kaufpreis', euro(pr.kaufpreis) || 'auf Anfrage'], ['Käuferprovision', o.provision || '']];
  const objektangaben = [
    ['Objekt-Nr.', o.objektnr || o.id],
    ['Objektart', [o.objektart, o.objekttyp].filter(Boolean).join(' – ')],
    ['Lage', [o.adresse?.strasse, `${o.adresse?.plz || ''} ${o.adresse?.ort || ''}`.trim()].filter(Boolean).join(', ')],
    ['Baujahr', o.baujahr ? String(o.baujahr) : ''],
    ['Wohnfläche', flaeche(f.wohnflaeche)],
    ['Nutzfläche', flaeche(f.nutzflaeche)],
    ['Grundstück', flaeche(f.grundstuecksflaeche)],
    ['Zimmer', zahl(o.zimmer)],
    ['Schlafzimmer', zahl(o.schlafzimmer)],
    ['Badezimmer', zahl(o.badezimmer)],
    ['Stellplätze', zahl(o.stellplaetze)]
  ];
  const ausstattung = (o.ausstattung || []).map((a) => [esc(a.label), a.wert]);
  const energie = [
    ['Energieausweis', e.art || ''],
    ['Gültig bis', e.gueltigBis || ''],
    ['Energieverbrauch', e.verbrauchskennwert ? `${zahl(e.verbrauchskennwert, 1)} kWh/(m²·a)` : ''],
    ['Energiebedarf', e.bedarfskennwert ? `${zahl(e.bedarfskennwert, 1)} kWh/(m²·a)` : ''],
    ['Effizienzklasse', e.klasse || ''],
    ['Energieträger', e.energietraeger || ''],
    ['Baujahr laut Ausweis', e.baujahr || '']
  ];

  const galerie = bilder.length
    ? `<div class="galerie" data-galerie>
    <button class="galerie__haupt" type="button" data-index="0" aria-label="Bild 1 von ${bilder.length} vergrößern">
      <img src="${r}${bilder[0].datei}" alt="${esc(bilder[0].titel || o.titel)}" width="${bilder[0].w}" height="${bilder[0].h}" fetchpriority="high">
    </button>
    <div class="galerie__leiste">
      ${bilder.slice(1, 5).map((b, i) => `<button type="button" data-index="${i + 1}" aria-label="Bild ${i + 2} von ${bilder.length} vergrößern"><img src="${r}${b.klein || b.datei}" alt="${esc(b.titel || '')}" width="${b.w}" height="${b.h}" loading="lazy"></button>`).join('')}
      ${bilder.length > 5 ? `<button type="button" class="galerie__alle" data-index="5">Alle ${bilder.length} Bilder</button>` : ''}
    </div>
    <dialog class="lightbox" aria-label="Bildergalerie">
      <img alt="">
      <p class="lightbox__titel"></p>
      <button type="button" class="lightbox__zu" data-zu aria-label="Galerie schließen">×</button>
      <button type="button" class="lightbox__pfeil lightbox__pfeil--zurueck" data-schritt="-1" aria-label="Vorheriges Bild">‹</button>
      <button type="button" class="lightbox__pfeil lightbox__pfeil--vor" data-schritt="1" aria-label="Nächstes Bild">›</button>
    </dialog>
    <script type="application/json" data-bilder>${JSON.stringify(bilder.map((b) => ({ src: r + b.datei, titel: b.titel || '' }))).replace(/</g, '\\u003c')}</script>
  </div>`
    : '';

  const texte = (o.texte || []).filter((t) => t.text && t.text.trim());
  const textBloecke = texte.map((t) => `<section class="expose__text"><h2>${esc(t.titel)}</h2>${absaetze(t.text)}</section>`).join('\n');

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: o.titel,
    url: `${config.url}/${pfad}`,
    image: bilder.slice(0, 5).map((b) => `${config.url}/${b.datei}`),
    datePosted: o.erstellt || undefined,
    offers: p.zahl ? { '@type': 'Offer', price: p.zahl, priceCurrency: 'EUR', businessFunction: o.vermarktung === 'Miete' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell' } : undefined,
    address: { '@type': 'PostalAddress', postalCode: o.adresse?.plz, addressLocality: o.adresse?.ort, addressCountry: 'DE' },
    provider: { '@type': 'RealEstateAgent', name: F.name, telephone: F.telefonLink }
  };

  const inhalt = `
<nav class="rahmen brotkrumen" aria-label="Brotkrumen"><a href="${r}immobilien/">Immobilien</a> <span aria-hidden="true">/</span> <span>Objekt ${esc(o.objektnr || o.id)}</span></nav>
<article class="rahmen expose">
  <header class="expose__kopf">
    <p class="expose__ort">${icon.pin}${esc([o.objektart, 'in', o.adresse?.plz, o.adresse?.ort].filter(Boolean).join(' '))}</p>
    <h1>${esc(o.titel)}</h1>
  </header>
  ${galerie}
  <div class="expose__raster">
    <div class="expose__haupt">
      <dl class="expose__eckdaten">
        <div class="expose__preis"><dt>${p.label}</dt><dd>${p.wert}</dd></div>
        ${eckdaten(o).map(([l, w]) => `<div><dt>${l}</dt><dd>${w}</dd></div>`).join('')}
      </dl>
      ${textBloecke}
      <section class="expose__text"><h2>Objektangaben</h2>${tabelle(objektangaben)}</section>
      <section class="expose__text"><h2>Preise</h2>${tabelle(preise)}</section>
      ${ausstattung.length ? `<section class="expose__text"><h2>Ausstattung</h2>${tabelle(ausstattung)}</section>` : ''}
      ${energie.some(([, w]) => w) ? `<section class="expose__text"><h2>Energieausweis</h2>${tabelle(energie)}${energieSkala(e)}</section>` : ''}
    </div>
    <aside class="expose__seite" aria-labelledby="anfrage-titel">
      <div class="anfrage">
        <h2 id="anfrage-titel">Interesse an Objekt ${esc(o.objektnr || o.id)}?</h2>
        <p>Wir senden Ihnen das vollständige Exposé und vereinbaren gern eine Besichtigung.</p>
        <a class="anfrage__telefon" href="tel:${F.telefonLink}">${icon.telefon}${F.telefon}</a>
        ${anfrageFormular(r, o)}
      </div>
    </aside>
  </div>
</article>`;
  const beschreibung = `${o.titel} – ${o.objektart || 'Immobilie'} ${o.vermarktung === 'Miete' ? 'zur Miete' : 'zum Kauf'} in ${o.adresse?.plz || ''} ${o.adresse?.ort || ''}. ${eckdaten(o).map(([l, w]) => `${l}: ${w}`).join(', ')}. ${p.label}: ${p.wert}.`;
  schreibe(pfad, layout({
    pfad, titel: `${o.titel} | ${o.adresse?.ort || ''} | Lubrich Immobilien`, beschreibung, inhalt,
    head: `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`,
    ogBild: bilder[0]?.datei
  }));
}

// ---------------------------------------------------------------- Ortsseiten
function ortSeite(ort) {
  const pfad = `makler/${ort.slug}/`;
  const r = rel(tiefe(pfad));
  const km = ort.slug === 'bad-berka' || ort.slug === 'weimarer-land' ? null : Math.round(entfernungKm(buero, ort));
  const vorOrt = objekte.filter((o) => slugify(o.adresse?.ort) === ort.slug);
  const andere = objekte.filter((o) => !vorOrt.includes(o)).slice(0, Math.max(0, 3 - vorOrt.length));
  const inhalt = `
<section class="seitenkopf">
  <div class="rahmen">
    <h1>Immobilienmakler für ${esc(ort.name)}</h1>
    <p class="seitenkopf__text">${esc(ort.kurz)}${km ? ` – etwa ${km} km von unserem Büro in Bad Berka entfernt` : ''}.</p>
  </div>
</section>
<section class="rahmen abschnitt zwei-spalten">
  <div class="fliesstext">
    ${ort.text.map((t) => `<p>${esc(t)}</p>`).join('\n    ')}
    <h2>Was wir für Eigentümer in ${esc(ort.name)} tun</h2>
    <ul class="haken">
      <li>Wertermittlung vor Ort – kostenlos und unverbindlich</li>
      <li>Verkauf von Häusern, Wohnungen und Grundstücken bis zum Notartermin</li>
      <li>Vermietung inklusive Mieterauswahl und Bonitätsprüfung</li>
      <li>Ein fester Ansprechpartner von Anfang bis Ende</li>
    </ul>
    <p><a class="knopf" href="${r}immobilienbewertung/">Immobilie in ${esc(ort.name)} bewerten</a></p>
  </div>
  ${regionKarte(r, { aktiv: ort.slug })}
</section>
${vorOrt.length || andere.length ? `<section class="abschnitt abschnitt--kalk" aria-labelledby="angebote">
  <div class="rahmen">
    <h2 id="angebote">${vorOrt.length ? `Aktuelle Angebote in ${esc(ort.name)}` : 'Aktuelle Angebote in der Region'}</h2>
    ${objektListe(r, [...vorOrt, ...andere])}
    <p class="mehr"><a class="textlink" href="${r}immobilien/">Alle Immobilien ansehen</a></p>
  </div>
</section>` : ''}
<section class="rahmen abschnitt" aria-labelledby="stimmen-titel">
  <h2 id="stimmen-titel">Das sagen unsere Kunden</h2>
  ${stimmenBlock(r)}
</section>
${kontaktBand(r, { titel: `Sie möchten in ${esc(ort.name)} verkaufen oder vermieten?` })}`;
  schreibe(pfad, layout({
    pfad, titel: `Immobilienmakler ${ort.name} | Haus verkaufen & bewerten | Lubrich Immobilien`,
    beschreibung: `Lubrich Immobilien ist Ihr Makler für ${ort.name}: kostenlose Wertermittlung, Verkauf und Vermietung von Häusern, Wohnungen und Grundstücken. Persönlich aus Bad Berka.`,
    inhalt
  }));
}

// ---------------------------------------------------------------- 404, Sitemap, robots
function seite404() {
  const b = config.basePath.endsWith('/') ? config.basePath : config.basePath + '/';
  const inhalt = `<section class="seitenkopf"><div class="rahmen"><h1>Diese Seite gibt es nicht (mehr).</h1>
<p class="seitenkopf__text">Vielleicht ist das Objekt bereits vermittelt. Hier geht es weiter:</p>
<p class="knopfreihe"><a class="knopf knopf--gold" href="${b}immobilien/">Aktuelle Immobilien</a> <a class="knopf knopf--hell" href="${b}">Zur Startseite</a></p></div></section>`;
  schreibe('404.html', layout({ pfad: '404.html', titel: 'Seite nicht gefunden | Lubrich Immobilien', beschreibung: 'Diese Seite wurde nicht gefunden.', inhalt, basis: b }).replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"'));
}

function sitemap() {
  // lastmod nur bei Exposés mit Änderungsdatum aus onOffice – sonst würde sich die Datei täglich ändern
  const geaendert = Object.fromEntries(objekte.filter((o) => o.geaendert).map((o) => [objektPfad(o), String(o.geaendert).slice(0, 10)]));
  const urls = erzeugt.filter((p) => p !== '404.html')
    .map((p) => `  <url><loc>${config.url}/${p}</loc>${geaendert[p] ? `<lastmod>${geaendert[p]}</lastmod>` : ''}</url>`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /src/\nDisallow: /scripts/\nDisallow: /serverless/\n\nSitemap: ${config.url}/sitemap.xml\n`);
}

// Alte Exposé-Ordner entfernen, deren Objekt nicht mehr in den Daten ist
function aufraeumen() {
  const dir = path.join(ROOT, 'immobilien-details');
  if (!fs.existsSync(dir)) return;
  const gueltig = new Set(objekte.map((o) => objektPfad(o)));
  for (const id of fs.readdirSync(dir)) {
    const idDir = path.join(dir, id);
    for (const slug of fs.readdirSync(idDir)) {
      for (const ort of fs.readdirSync(path.join(idDir, slug))) {
        const p = `immobilien-details/${id}/${slug}/${ort}/`;
        if (!gueltig.has(p)) fs.rmSync(path.join(idDir, slug, ort), { recursive: true, force: true });
      }
      if (!fs.readdirSync(path.join(idDir, slug)).length) fs.rmSync(path.join(idDir, slug), { recursive: true });
    }
    if (!fs.readdirSync(idDir).length) fs.rmSync(idDir, { recursive: true });
  }
}

// ---------------------------------------------------------------- Los
aufraeumen();
inhaltsSeiten();
immobilienSeite();
objekte.forEach(exposeSeite);
orte.filter((o) => o.seite).forEach(ortSeite);
seite404();
sitemap();
console.log(`Fertig: ${erzeugt.length} Seiten, ${objekte.length} Objekte (Stand ${daten.aktualisiert || 'unbekannt'}).`);
