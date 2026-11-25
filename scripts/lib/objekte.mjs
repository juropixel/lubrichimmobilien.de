// Gemeinsame Logik für onOffice-Sync und OpenImmo-Import:
// Bilder herunterladen/verkleinern und data/immobilien.json schreiben.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { slugify } from './format.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATEN = path.join(ROOT, 'data/immobilien.json');
export const BILDER = path.join(ROOT, 'bilder/immobilien');

const GROSS = 1600, KLEIN = 720;

async function sharpLaden() {
  try { return (await import('sharp')).default; }
  catch { throw new Error('Das Paket "sharp" fehlt. Bitte zuerst "npm install" ausführen.'); }
}

/**
 * Speichert ein Bild (Buffer) als WebP in zwei Größen.
 * Der Dateiname leitet sich aus einem stabilen Schlüssel ab, damit unveränderte Bilder nicht neu erzeugt werden.
 */
export async function bildSpeichern(objektId, schluessel, laden, titel = '') {
  const sharp = await sharpLaden();
  const name = crypto.createHash('sha1').update(String(schluessel)).digest('hex').slice(0, 12);
  const dir = path.join(BILDER, String(objektId));
  fs.mkdirSync(dir, { recursive: true });
  const gross = path.join(dir, `${name}.webp`), klein = path.join(dir, `${name}-s.webp`);
  if (!fs.existsSync(gross) || !fs.existsSync(klein)) {
    const buf = await laden();
    await sharp(buf).rotate().resize({ width: GROSS, height: GROSS, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toFile(gross);
    await sharp(buf).rotate().resize({ width: KLEIN, height: KLEIN, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(klein);
  }
  const meta = await sharp(gross).metadata();
  return {
    datei: path.relative(ROOT, gross).split(path.sep).join('/'),
    klein: path.relative(ROOT, klein).split(path.sep).join('/'),
    titel, w: meta.width, h: meta.height
  };
}

/** Entfernt Bildordner und -dateien, die nicht mehr verwendet werden. */
export function bilderAufraeumen(objekte) {
  if (!fs.existsSync(BILDER)) return;
  const genutzt = new Set(objekte.flatMap((o) => (o.bilder || []).flatMap((b) => [b.datei, b.klein])));
  for (const id of fs.readdirSync(BILDER)) {
    const dir = path.join(BILDER, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      const rel = `bilder/immobilien/${id}/${f}`;
      if (!genutzt.has(rel)) fs.rmSync(path.join(dir, f));
    }
    if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
  }
}

/** Vereinheitlicht ein Objekt und füllt Standardwerte. */
export function normalisiere(o) {
  const titel = (o.titel || '').trim() || `${o.objektart || 'Immobilie'} in ${o.adresse?.ort || ''}`.trim();
  return {
    id: String(o.id),
    objektnr: String(o.objektnr || o.id),
    titel,
    slug: slugify(titel).slice(0, 90) || 'immobilie',
    objektart: o.objektart || 'Immobilie',
    objekttyp: o.objekttyp || undefined,
    nutzungsart: o.nutzungsart || 'Wohnen',
    vermarktung: o.vermarktung === 'Miete' ? 'Miete' : 'Kauf',
    status: o.status || 'aktiv',
    adresse: { strasse: o.adresse?.strasse || null, plz: o.adresse?.plz || '', ort: o.adresse?.ort || '' },
    preise: o.preise || {},
    provision: o.provision || undefined,
    flaechen: o.flaechen || {},
    zimmer: o.zimmer ?? null,
    schlafzimmer: o.schlafzimmer ?? null,
    badezimmer: o.badezimmer ?? null,
    stellplaetze: o.stellplaetze ?? null,
    baujahr: o.baujahr ?? null,
    ausstattung: o.ausstattung || [],
    energie: o.energie || {},
    texte: (o.texte || []).filter((t) => t.text && String(t.text).trim()),
    bilder: o.bilder || [],
    erstellt: o.erstellt || undefined,
    geaendert: o.geaendert || undefined
  };
}

export function speichern(objekte, quelle) {
  const sauber = objekte.map(normalisiere);
  // neueste zuerst (nach Erstelldatum, sonst nach ID absteigend)
  sauber.sort((a, b) => String(b.erstellt || '').localeCompare(String(a.erstellt || '')) || Number(b.id) - Number(a.id));
  const inhalt = { quelle, aktualisiert: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), objekte: sauber };
  const alt = fs.existsSync(DATEN) ? JSON.parse(fs.readFileSync(DATEN, 'utf8')) : null;
  if (alt && JSON.stringify(alt.objekte) === JSON.stringify(sauber)) {
    console.log('Keine Änderungen an den Inseraten.');
    return false;
  }
  fs.mkdirSync(path.dirname(DATEN), { recursive: true });
  fs.writeFileSync(DATEN, JSON.stringify(inhalt, null, 2) + '\n');
  bilderAufraeumen(sauber);
  console.log(`${sauber.length} Inserate gespeichert.`);
  return true;
}

/** Ja/Nein und Listen aus Rohwerten lesbar machen. */
export function lesbar(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) return v.map(lesbar).filter(Boolean).join(', ');
  if (v === true || v === '1' || v === 1 || v === 'true') return 'Ja';
  if (v === false || v === '0' || v === 0 || v === 'false') return '';
  return String(v).trim();
}
