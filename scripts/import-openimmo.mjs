#!/usr/bin/env node
// Importiert einen OpenImmo-Export (so wie onOffice ihn heute per FTP an die alte Website schickt).
//
//   node scripts/import-openimmo.mjs pfad/zum/export.zip      (ZIP mit XML + Bildern)
//   node scripts/import-openimmo.mjs pfad/zum/ordner           (entpackter Export)
//   OPENIMMO_QUELLE=… node scripts/import-openimmo.mjs        (Pfad per Umgebungsvariable)
//
// Vollabgleich (umfang="VOLL") ersetzt alle Objekte. Teilabgleich (umfang="TEIL") ändert/ergänzt
// einzelne Objekte und entfernt Objekte mit <aktion aktionart="DELETE"/>.
import fs from 'node:fs';
import path from 'node:path';
import { DATEN, bildSpeichern, speichern, lesbar } from './lib/objekte.mjs';
import { leseZahl } from './lib/format.mjs';

const quelle = process.argv[2] || process.env.OPENIMMO_QUELLE;
if (!quelle || !fs.existsSync(quelle)) {
  console.error('Bitte Pfad zu einer OpenImmo-ZIP-Datei oder einem Ordner angeben.');
  process.exit(1);
}

const { XMLParser } = await import('fast-xml-parser').catch(() => { throw new Error('Paket "fast-xml-parser" fehlt – bitte "npm install" ausführen.'); });

// ------------------------------------------------------------------ Dateien lesen (ZIP oder Ordner)
async function dateienLesen(p) {
  const dateien = new Map(); // relativer Pfad (klein geschrieben) -> () => Promise<Buffer>
  if (fs.statSync(p).isDirectory()) {
    const lauf = (dir) => {
      for (const f of fs.readdirSync(dir)) {
        const voll = path.join(dir, f);
        if (fs.statSync(voll).isDirectory()) lauf(voll);
        else dateien.set(path.relative(p, voll).split(path.sep).join('/').toLowerCase(), async () => fs.readFileSync(voll));
      }
    };
    lauf(p);
  } else {
    const unzipper = (await import('unzipper').catch(() => { throw new Error('Paket "unzipper" fehlt – bitte "npm install" ausführen.'); })).default;
    const zip = await unzipper.Open.file(p);
    for (const eintrag of zip.files) if (eintrag.type === 'File') dateien.set(eintrag.path.toLowerCase(), () => eintrag.buffer());
  }
  return dateien;
}

const dateien = await dateienLesen(quelle);
const xmlDateien = [...dateien.keys()].filter((k) => k.endsWith('.xml'));
if (!xmlDateien.length) { console.error('Keine XML-Datei im Export gefunden.'); process.exit(1); }

const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, trimValues: true,
  removeNSPrefix: true,
  isArray: (name) => ['immobilie', 'anhang', 'anbieter'].includes(name)
});

const arr = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const text = (x) => (x === undefined || x === null ? '' : typeof x === 'object' ? (x['#text'] ?? '') : String(x)).trim();
const wahr = (v) => v === true || v === 'true' || v === '1' || v === 1;

const OBJEKTART = {
  haus: 'Haus', wohnung: 'Wohnung', grundstueck: 'Grundstück', buero_praxen: 'Büro / Praxis', einzelhandel: 'Einzelhandel',
  gastgewerbe: 'Gastgewerbe', hallen_lager_prod: 'Halle / Lager', land_und_forstwirtschaft: 'Land- und Forstwirtschaft',
  parken: 'Stellplatz', zinshaus_renditeobjekt: 'Renditeobjekt', freizeitimmobilie_gewerblich: 'Freizeitimmobilie',
  sonstige: 'Sonstige', zimmer: 'Zimmer'
};
const SCHOEN = { LUFTWP: 'Luft-Wärmepumpe', ERDWAERME: 'Erdwärme', FERN: 'Fernwärme', ELEKTRO: 'Strom', OEL: 'Öl', GAS: 'Gas', PELLET: 'Pellets', SOLAR: 'Solar', HOLZ: 'Holz', ZENTRAL: 'Zentralheizung', ETAGE: 'Etagenheizung', FUSSBODEN: 'Fußbodenheizung', OFEN: 'Ofenheizung', VERBRAUCH: 'Verbrauchsausweis', BEDARF: 'Bedarfsausweis' };
const schoen = (s) => SCHOEN[String(s).toUpperCase()] || (String(s).charAt(0) + String(s).slice(1).toLowerCase()).replace(/_/g, ' ');
// Attribute mit Wert "true" → Liste ihrer Namen (z. B. <befeuerung GAS="true" SOLAR="true"/>)
const attributListe = (el) => Object.entries(el || {}).filter(([k, v]) => k.startsWith('@') && wahr(v)).map(([k]) => schoen(k.slice(1)));

function umwandeln(im) {
  const vt = im.verwaltung_techn || {};
  const kat = im.objektkategorie || {};
  const geo = im.geo || {};
  const pr = im.preise || {};
  const fl = im.flaechen || {};
  const au = im.ausstattung || {};
  const zu = im.zustand_angaben || {};
  const ep = arr(zu.energiepass)[0] || {};
  const ft = im.freitexte || {};
  const artKey = Object.keys(kat.objektart || {}).find((k) => !k.startsWith('@'));
  const artEl = artKey ? kat.objektart[artKey] : {};
  const typ = artEl && typeof artEl === 'object' ? Object.entries(artEl).find(([k]) => k.startsWith('@') && k.endsWith('typ'))?.[1] : undefined;
  const va = kat.vermarktungsart || {};
  const nutz = kat.nutzungsart || {};
  const z = (v) => leseZahl(text(v));
  const adresseFrei = wahr(text(im.verwaltung_objekt?.objektadresse_freigeben));

  const ausstattung = [];
  const heizung = attributListe(au.heizungsart); if (heizung.length) ausstattung.push({ label: 'Heizungsart', wert: heizung.join(', ') });
  const befeuerung = attributListe(au.befeuerung); if (befeuerung.length) ausstattung.push({ label: 'Befeuerung', wert: befeuerung.join(', ') });
  if (au.unterkellert?.['@keller']) ausstattung.push({ label: 'Keller', wert: schoen(au.unterkellert['@keller']) });
  if (z(fl.anzahl_balkone)) ausstattung.push({ label: 'Balkone', wert: text(fl.anzahl_balkone) });
  if (z(fl.anzahl_terrassen)) ausstattung.push({ label: 'Terrassen', wert: text(fl.anzahl_terrassen) });
  if (wahr(au.gartennutzung)) ausstattung.push({ label: 'Gartennutzung', wert: 'Ja' });
  if (au.fahrstuhl) ausstattung.push({ label: 'Fahrstuhl', wert: 'Ja' });
  if (wahr(au.kamin)) ausstattung.push({ label: 'Kamin', wert: 'Ja' });

  const titel = { objektbeschreibung: 'Objektbeschreibung', lage: 'Lage', ausstatt_beschr: 'Ausstattung', sonstige_angaben: 'Sonstige Angaben' };
  return {
    id: text(vt.objektnr_extern) || text(vt.openimmo_obid),
    objektnr: text(vt.objektnr_extern) || text(vt.objektnr_intern),
    titel: text(ft.objekttitel),
    objektart: OBJEKTART[artKey] || 'Immobilie',
    objekttyp: typ ? schoen(typ) : undefined,
    nutzungsart: wahr(nutz['@GEWERBE']) ? 'Gewerbe' : wahr(nutz['@ANLAGE']) ? 'Anlage' : 'Wohnen',
    vermarktung: wahr(va['@MIETE_PACHT']) ? 'Miete' : 'Kauf',
    status: 'aktiv',
    adresse: { strasse: adresseFrei ? [text(geo.strasse), text(geo.hausnummer)].filter(Boolean).join(' ') || null : null, plz: text(geo.plz), ort: text(geo.ort) },
    preise: Object.fromEntries(['kaufpreis', 'kaltmiete', 'warmmiete', 'nebenkosten', 'kaution'].map((k) => [k, z(pr[k])]).filter(([, v]) => v)),
    provision: text(pr.aussen_courtage) || undefined,
    flaechen: Object.fromEntries(['wohnflaeche', 'nutzflaeche', 'grundstuecksflaeche'].map((k) => [k, z(fl[k])]).filter(([, v]) => v)),
    zimmer: z(fl.anzahl_zimmer), schlafzimmer: z(fl.anzahl_schlafzimmer), badezimmer: z(fl.anzahl_badezimmer),
    stellplaetze: z(fl.anzahl_stellplaetze), baujahr: z(zu.baujahr),
    ausstattung,
    energie: Object.fromEntries(Object.entries({
      art: ep.epart ? schoen(text(ep.epart)) : '',
      gueltigBis: text(ep.gueltig_bis),
      verbrauchskennwert: z(ep.energieverbrauchkennwert) || undefined,
      bedarfskennwert: z(ep.endenergiebedarf) || undefined,
      klasse: text(ep.wertklasse),
      energietraeger: ep.primaerenergietraeger ? schoen(text(ep.primaerenergietraeger)) : '',
      baujahr: text(ep.baujahr)
    }).filter(([, v]) => v)),
    texte: Object.keys(titel).filter((k) => text(ft[k])).map((k) => ({ titel: titel[k], text: text(ft[k]).replace(/<br\s*\/?>/gi, '\n') })),
    anhaenge: arr(im.anhaenge?.anhang),
    loeschen: String(vt.aktion?.['@aktionart'] || '').toUpperCase() === 'DELETE'
  };
}

// ------------------------------------------------------------------ Verarbeiten
let teilabgleich = false;
const neu = [];
for (const xmlName of xmlDateien) {
  const xml = (await dateien.get(xmlName)()).toString('utf8');
  const doc = parser.parse(xml).openimmo;
  if (!doc) continue;
  if (String(doc.uebertragung?.['@umfang'] || '').toUpperCase() === 'TEIL') teilabgleich = true;
  const basis = path.posix.dirname(xmlName);
  for (const anbieter of arr(doc.anbieter)) {
    for (const im of arr(anbieter.immobilie)) {
      const o = umwandeln(im);
      if (!o.id) { console.warn('Objekt ohne Objektnummer übersprungen.'); continue; }
      o.bilder = [];
      if (!o.loeschen) {
        const anh = o.anhaenge.filter((a) => /bild|titelbild|grundriss|innenansichten|aussenansichten|karten_lageplan/i.test(a['@gruppe'] || 'BILD'));
        anh.sort((a, b) => (a['@gruppe'] === 'TITELBILD' ? -1 : 0) - (b['@gruppe'] === 'TITELBILD' ? -1 : 0));
        for (const a of anh) {
          const pfad = text(a.daten?.pfad);
          if (!pfad) continue;
          try {
            const istUrl = /^https?:\/\//i.test(pfad);
            const key = istUrl ? null : [path.posix.join(basis, pfad), pfad].map((x) => x.replace(/^\.\//, '').toLowerCase()).find((x) => dateien.has(x));
            if (!istUrl && !key) { console.warn(`Bild fehlt im Export: ${pfad}`); continue; }
            o.bilder.push(await bildSpeichern(o.id, istUrl ? pfad : `${pfad}|${xmlName}`, async () => {
              if (!istUrl) return dateien.get(key)();
              const r = await fetch(pfad); if (!r.ok) throw new Error(`HTTP ${r.status}`); return Buffer.from(await r.arrayBuffer());
            }, text(a.anhangtitel)));
          } catch (err) { console.warn(`Bild ${pfad} übersprungen: ${err.message}`); }
        }
      }
      delete o.anhaenge;
      neu.push(o);
    }
  }
}

let ergebnis;
if (teilabgleich) {
  const alt = fs.existsSync(DATEN) ? JSON.parse(fs.readFileSync(DATEN, 'utf8')).objekte : [];
  const map = new Map(alt.map((o) => [o.id, o]));
  for (const o of neu) {
    if (o.loeschen) map.delete(o.id);
    else map.set(o.id, o);
  }
  ergebnis = [...map.values()];
  console.log(`Teilabgleich: ${neu.filter((o) => !o.loeschen).length} geändert, ${neu.filter((o) => o.loeschen).length} gelöscht.`);
} else {
  ergebnis = neu.filter((o) => !o.loeschen);
  console.log(`Vollabgleich: ${ergebnis.length} Objekte.`);
}
ergebnis.forEach((o) => delete o.loeschen);
speichern(ergebnis, 'OpenImmo-Export aus onOffice');
