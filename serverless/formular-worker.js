// Cloudflare Worker: nimmt die Formulare der Website entgegen und legt die Anfrage in onOffice an.
//
// Warum ein Worker? GitHub Pages ist rein statisch. Das onOffice-API-Secret darf nicht in den Browser,
// deshalb sitzt dieser kleine Dienst dazwischen (kostenloser Cloudflare-Tarif reicht).
//
// Einrichtung (einmalig):
//   1. Cloudflare-Konto → Workers & Pages → Create → Worker → diesen Code einfügen → Deploy
//   2. Settings → Variables and Secrets:
//        ONOFFICE_TOKEN   (Secret)
//        ONOFFICE_SECRET  (Secret)
//        ERLAUBTE_HERKUNFT  z. B. https://www.lubrichimmobilien.de
//        EMPFAENGER       (optional) E-Mail-Adresse, an die onOffice die Anfrage schickt
//   3. Die Worker-Adresse (https://….workers.dev) in src/site.config.mjs bei `formEndpoint` eintragen
//      und `npm run build` ausführen bzw. committen.
//   4. Datenschutzerklärung um Cloudflare als Auftragsverarbeiter ergänzen.
//
// onOffice-Aktion „contactaddress“ (Kontaktaufnahme): legt die Adresse an bzw. ordnet sie zu und
// verschickt die Anfrage per E-Mail aus onOffice – wie das offizielle onOffice-WordPress-Plugin.
// Bitte mit einem Testformular prüfen; Feldnamen der Adresse ggf. an den Mandanten anpassen.

const API = 'https://api.onoffice.de/api/stable/api.php';
const DO = 'urn:onoffice-de-ns:smart:2.5:smartml:action:do';

const LABEL = {
  objektnr: 'Objekt-Nr.', objekttitel: 'Objekt', art: 'Immobilienart', haustyp: 'Haustyp', gewerbetyp: 'Gewerbeart',
  baujahr: 'Baujahr', flaeche: 'Wohn-/Nutzfläche (m²)', grundstueck: 'Grundstücksfläche (m²)', erschliessung: 'Erschließung',
  zimmer: 'Zimmer', plz: 'PLZ', ort: 'Ort', strasse: 'Straße', anlass: 'Anlass', nachricht: 'Nachricht',
  such_objektart: 'Gesucht: Objektart', such_preis: 'Gesucht: Preis', such_ort: 'Gesucht: Ort', such_groesse: 'Gesucht: Größe', such_wuensche: 'Gesucht: Wünsche'
};
const KONTAKTFELDER = new Set(['anrede', 'vorname', 'name', 'email', 'telefon', 'objekt_id']);

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function antwort(status, body, herkunft) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': herkunft || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    }
  });
}

const kurz = (v, n = 2000) => String(v ?? '').trim().slice(0, n);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const erlaubt = (env.ERLAUBTE_HERKUNFT || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ok = !erlaubt.length || erlaubt.includes(origin);
    if (request.method === 'OPTIONS') return antwort(ok ? 204 : 403, {}, ok ? origin : '');
    if (request.method !== 'POST' || !ok) return antwort(403, { fehler: 'nicht erlaubt' }, '');

    let eingabe;
    try { eingabe = await request.json(); } catch { return antwort(400, { fehler: 'ungültige Daten' }, origin); }
    const d = eingabe?.daten || {};
    if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || !d.name) return antwort(400, { fehler: 'Name und E-Mail fehlen' }, origin);

    // Vor- und Nachname trennen, falls nur ein Feld ausgefüllt wurde (Wertermittlung)
    let vorname = kurz(d.vorname, 100), name = kurz(d.name, 100);
    if (!vorname && name.includes(' ')) { const t = name.split(/\s+/); name = t.pop(); vorname = t.join(' '); }

    const zeilen = Object.entries(d).filter(([k]) => !KONTAKTFELDER.has(k)).map(([k, v]) => `${LABEL[k] || k}: ${kurz(v)}`);
    const formtype = eingabe.formular === 'wertermittlung' ? 'owner' : eingabe.formular === 'objektanfrage' ? 'interest' : 'contact';

    const parameters = {
      addressdata: {
        Anrede: kurz(d.anrede, 20) || undefined,
        Vorname: vorname || undefined,
        Name: name,
        Email: kurz(d.email, 200),
        Telefon1: kurz(d.telefon, 60) || undefined
      },
      message: `${kurz(eingabe.betreff, 200)}\n\n${zeilen.join('\n')}\n\nGesendet über: ${kurz(eingabe.seite, 300)}`,
      subject: kurz(eingabe.betreff, 200) || 'Anfrage über die Website',
      referrer: kurz(eingabe.seite, 300),
      formtype,
      checkDuplicate: true
    };
    if (d.objekt_id && /^\d+$/.test(d.objekt_id)) parameters.estateid = Number(d.objekt_id);
    if (env.EMPFAENGER) parameters.recipient = env.EMPFAENGER;

    const timestamp = Math.floor(Date.now() / 1000);
    const action = {
      actionid: DO, resourceid: '', resourcetype: 'contactaddress', identifier: '', timestamp, hmac_version: 2,
      hmac: await hmac(env.ONOFFICE_SECRET, `${timestamp}${env.ONOFFICE_TOKEN}contactaddress${DO}`),
      parameters
    };
    const res = await fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: env.ONOFFICE_TOKEN, request: { actions: [action] } })
    });
    const json = await res.json().catch(() => null);
    const fehler = !res.ok || json?.status?.code !== 200 || json?.response?.results?.[0]?.status?.errorcode;
    if (fehler) {
      console.log('onOffice-Fehler', JSON.stringify(json?.response?.results?.[0]?.status || json?.status));
      return antwort(502, { fehler: 'Weiterleitung an onOffice fehlgeschlagen' }, origin);
    }
    return antwort(200, { ok: true }, origin);
  }
};
