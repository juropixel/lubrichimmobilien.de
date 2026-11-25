#!/usr/bin/env node
// Holt alle für die Homepage freigegebenen Immobilien aus onOffice enterprise
// und schreibt sie nach data/immobilien.json (+ Bilder nach bilder/immobilien/).
//
// Benötigt zwei Umgebungsvariablen (in GitHub: Settings → Secrets → Actions):
//   ONOFFICE_TOKEN   API-Token  } beides in onOffice unter
//   ONOFFICE_SECRET  API-Secret } Extras → Einstellungen → Benutzer → API-Benutzer
//
// Optional:
//   ONOFFICE_FILTER_STATUS=0   auch inaktive Objekte holen (Standard: nur Status „aktiv“)
//   ONOFFICE_DRY_RUN=1         nur abrufen und anzeigen, nichts speichern
//
// API-Doku: https://apidoc.onoffice.de/
import crypto from 'node:crypto';
import { bildSpeichern, speichern, lesbar } from './lib/objekte.mjs';
import { leseZahl } from './lib/format.mjs';

const API = process.env.ONOFFICE_API_URL || 'https://api.onoffice.de/api/stable/api.php';
const TOKEN = process.env.ONOFFICE_TOKEN;
const SECRET = process.env.ONOFFICE_SECRET;
const DRY = process.env.ONOFFICE_DRY_RUN === '1';

if (!TOKEN || !SECRET) {
  console.error('ONOFFICE_TOKEN und ONOFFICE_SECRET fehlen. Sync übersprungen, bestehende Daten bleiben unverändert.');
  process.exit(process.env.CI ? 0 : 1);
}

// Gewünschte Felder. Felder, die es im Mandanten nicht gibt, werden automatisch weggelassen.
const FELDER = {
  basis: ['Id', 'objektnr_extern', 'objekttitel', 'objektart', 'objekttyp', 'nutzungsart', 'vermarktungsart',
    'status2', 'reserviert', 'verkauft', 'erstellt_am', 'geaendert_am',
    'plz', 'ort', 'strasse', 'hausnummer', 'objektadresse_freigeben'],
  preise: ['kaufpreis', 'kaltmiete', 'warmmiete', 'nebenkosten', 'kaution', 'aussen_courtage', 'courtage', 'provisionsnote'],
  flaechen: ['wohnflaeche', 'nutzflaeche', 'grundstuecksflaeche', 'anzahl_zimmer', 'anzahl_schlafzimmer', 'anzahl_badezimmer',
    'anzahl_stellplaetze', 'multiParkingLot', 'baujahr'],
  energie: ['energieausweistyp', 'energieausweis_gueltig_bis', 'endenergiebedarf', 'energieverbrauchskennwert',
    'energyClass', 'energietraeger', 'baujahr_wesentlicher_energietraeger'],
  texte: ['objektbeschreibung', 'lage', 'ausstatt_beschr', 'sonstige_angaben'],
  // erscheinen unter „Ausstattung“, Bezeichnung kommt aus onOffice
  ausstattung: ['zustand', 'heizungsart', 'befeuerung', 'unterkellert', 'etage', 'anzahl_etagen', 'balkon', 'terrasse',
    'anzahl_balkone', 'anzahl_terrassen', 'garten', 'fahrstuhl', 'kamin', 'einbaukueche', 'barrierefrei', 'denkmalgeschuetzt',
    'vermietet', 'stellplatzart', 'bodenbelag']
};
const TEXT_TITEL = { objektbeschreibung: 'Objektbeschreibung', lage: 'Lage', ausstatt_beschr: 'Ausstattung', sonstige_angaben: 'Sonstige Angaben' };
const BILD_KATEGORIEN = ['Titelbild', 'Foto', 'Foto_gross', 'Grundriss', 'Lageplan', 'Panorama'];

// ------------------------------------------------------------------ API-Aufruf
function aktion(actionid, resourcetype, parameters, resourceid = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  // HMAC Version 2: base64(hmac_sha256(timestamp + token + resourcetype + actionid, secret))
  const hmac = crypto.createHmac('sha256', SECRET).update(`${timestamp}${TOKEN}${resourcetype}${actionid}`).digest('base64');
  return { actionid, resourceid, resourcetype, identifier: '', timestamp, hmac, hmac_version: 2, parameters };
}

async function anfrage(...aktionen) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, request: { actions: aktionen } })
  });
  if (!res.ok) throw new Error(`onOffice API: HTTP ${res.status}`);
  const json = await res.json();
  if (json.status?.code !== 200) throw new Error(`onOffice API: ${json.status?.code} ${json.status?.message || ''}`);
  return json.response.results.map((r) => {
    if (r.status?.errorcode) throw new Error(`onOffice API (${r.resourcetype}): Fehler ${r.status.errorcode} – ${r.status.message}`);
    return r.data;
  });
}

const READ = 'urn:onoffice-de-ns:smart:2.5:smartml:action:read';
const GET = 'urn:onoffice-de-ns:smart:2.5:smartml:action:get';

// ------------------------------------------------------------------ Abruf
async function verfuegbareFelder() {
  const [d] = await anfrage(aktion(GET, 'fields', { modules: ['estate'], labels: true, language: 'DEU' }));
  const rec = d.records.find((r) => r.id === 'estate') || d.records[0];
  const felder = { ...rec.elements };
  delete felder.label;
  return felder; // { feldname: { label, type, permittedvalues, ... } }
}

async function objekteLesen(felder) {
  const filter = { veroeffentlichen: [{ op: '=', val: 1 }] };
  if (process.env.ONOFFICE_FILTER_STATUS !== '0') filter.status = [{ op: '=', val: 1 }];
  const liste = [];
  for (let offset = 0; ; offset += 500) {
    const [d] = await anfrage(aktion(READ, 'estate', {
      data: felder, filter, listlimit: 500, listoffset: offset,
      sortby: { erstellt_am: 'DESC' }, formatoutput: true, outputlanguage: 'DEU', estatelanguage: 'DEU'
    }));
    liste.push(...d.records);
    if (liste.length >= (d.meta?.cntabsolute ?? 0) || !d.records.length) break;
  }
  return liste;
}

async function bilderLesen(ids) {
  if (!ids.length) return {};
  const [d] = await anfrage(aktion(GET, 'estatepictures', { estateids: ids.map(Number), categories: BILD_KATEGORIEN, language: 'DEU', size: 'original' }));
  const proObjekt = {};
  for (const rec of d.records) {
    for (const el of rec.elements || []) {
      (proObjekt[el.estateid] ||= []).push(el);
    }
  }
  // Titelbild zuerst, Grundrisse/Lagepläne ans Ende
  const rang = (t) => (t === 'Titelbild' ? 0 : t === 'Grundriss' || t === 'Lageplan' ? 2 : 1);
  for (const id in proObjekt) proObjekt[id].sort((a, b) => rang(a.type) - rang(b.type));
  return proObjekt;
}

// ------------------------------------------------------------------ Umwandeln
function umwandeln(rec, info, bilder) {
  const e = rec.elements;
  const z = (k) => leseZahl(e[k]);
  const miete = /miete|pacht/i.test(String(e.vermarktungsart || ''));
  const adresseFrei = lesbar(e.objektadresse_freigeben) === 'Ja';
  const status = lesbar(e.verkauft) === 'Ja' ? 'verkauft' : lesbar(e.reserviert) === 'Ja' ? 'reserviert' : 'aktiv';
  const ausstattung = FELDER.ausstattung
    .filter((k) => k in e && lesbar(e[k]))
    .map((k) => ({ label: info[k]?.label || k, wert: lesbar(e[k]) }));
  const datum = (v) => (v && !String(v).startsWith('0000') ? String(v).replace(' ', 'T') : undefined);
  return {
    id: rec.id,
    objektnr: e.objektnr_extern || rec.id,
    titel: e.objekttitel,
    objektart: lesbar(e.objektart),
    objekttyp: lesbar(e.objekttyp) || undefined,
    nutzungsart: lesbar(e.nutzungsart) || 'Wohnen',
    vermarktung: miete ? 'Miete' : 'Kauf',
    status,
    adresse: {
      // Straße nur, wenn in onOffice „Objektadresse freigeben“ gesetzt ist
      strasse: adresseFrei ? [e.strasse, e.hausnummer].filter(Boolean).join(' ') || null : null,
      plz: e.plz, ort: e.ort
    },
    preise: Object.fromEntries(['kaufpreis', 'kaltmiete', 'warmmiete', 'nebenkosten', 'kaution'].map((k) => [k, z(k)]).filter(([, v]) => v)),
    provision: lesbar(e.aussen_courtage || e.courtage) || undefined,
    flaechen: Object.fromEntries(['wohnflaeche', 'nutzflaeche', 'grundstuecksflaeche'].map((k) => [k, z(k)]).filter(([, v]) => v)),
    zimmer: z('anzahl_zimmer') || null,
    schlafzimmer: z('anzahl_schlafzimmer') || null,
    badezimmer: z('anzahl_badezimmer') || null,
    stellplaetze: z('anzahl_stellplaetze') || null,
    baujahr: z('baujahr') || null,
    ausstattung,
    energie: Object.fromEntries(Object.entries({
      art: lesbar(e.energieausweistyp),
      gueltigBis: lesbar(e.energieausweis_gueltig_bis),
      verbrauchskennwert: z('energieverbrauchskennwert') || undefined,
      bedarfskennwert: z('endenergiebedarf') || undefined,
      klasse: lesbar(e.energyClass),
      energietraeger: lesbar(e.energietraeger),
      baujahr: lesbar(e.baujahr_wesentlicher_energietraeger)
    }).filter(([, v]) => v)),
    texte: FELDER.texte.filter((k) => e[k]).map((k) => ({ titel: TEXT_TITEL[k], text: String(e[k]) })),
    bilder,
    erstellt: datum(e.erstellt_am),
    geaendert: datum(e.geaendert_am)
  };
}

// ------------------------------------------------------------------ Los
const info = await verfuegbareFelder();
const gewuenscht = Object.values(FELDER).flat().filter((f) => f !== 'Id');
const fehlend = gewuenscht.filter((f) => !(f in info));
if (fehlend.length) console.log(`Hinweis: Diese Felder gibt es in Ihrem onOffice nicht und werden übersprungen: ${fehlend.join(', ')}`);
const felder = ['Id', ...gewuenscht.filter((f) => f in info)];

const records = await objekteLesen(felder);
console.log(`${records.length} veröffentlichte Objekte in onOffice gefunden.`);
if (!records.length && process.env.ONOFFICE_ALLOW_EMPTY !== '1') {
  console.error('onOffice meldet 0 veröffentlichte Objekte. Zur Sicherheit wird nichts überschrieben.\n' +
    'Wenn wirklich keine Objekte online sein sollen, mit ONOFFICE_ALLOW_EMPTY=1 erneut ausführen.');
  process.exit(1);
}
const bilderRoh = await bilderLesen(records.map((r) => r.id));

const objekte = [];
for (const rec of records) {
  const bilder = [];
  for (const b of bilderRoh[rec.id] || []) {
    if (DRY) { bilder.push({ datei: b.url, titel: b.title || '' }); continue; }
    try {
      bilder.push(await bildSpeichern(rec.id, `${b.url.split('?')[0]}|${b.modified || ''}`, async () => {
        const r = await fetch(b.url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return Buffer.from(await r.arrayBuffer());
      }, b.title || ''));
    } catch (err) {
      console.warn(`Bild für Objekt ${rec.id} übersprungen: ${err.message}`);
    }
  }
  objekte.push(umwandeln(rec, info, bilder));
}

if (DRY) {
  console.log(JSON.stringify(objekte, null, 2));
} else {
  speichern(objekte, 'onOffice API');
}
