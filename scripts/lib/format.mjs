// Gemeinsame Helfer für Build und Import-Skripte.

export function slugify(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function esc(s = '') {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const nf = (digits) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function zahl(n, digits = 1) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  return nf(digits).format(Number(n));
}

export function euro(n) {
  if (n === null || n === undefined || n === '' || Number(n) === 0) return '';
  const v = Number(n);
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR',
    maximumFractionDigits: v >= 10000 ? 0 : 2, minimumFractionDigits: v >= 10000 ? 0 : 2
  }).format(v);
}

export function flaeche(n) {
  const z = zahl(n, 1);
  return z ? `${z} m²` : '';
}

/** Teilt Freitext (aus onOffice/OpenImmo) in Absätze. */
export function absaetze(text = '') {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/** Zahl aus deutschem oder englischem Format lesen ("429 000,00 €", "429000.00"). */
export function leseZahl(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[€m²\s  ]/g, '');
  if (/^-?[\d.]+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
