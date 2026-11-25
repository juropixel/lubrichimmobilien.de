// Einsatzgebiet. Koordinaten = Ortsmitte (WGS84), für die Regionskarte und Entfernungsangaben.
// `seite: true` erzeugt eine Ortsseite unter /makler/<slug>/ (bestehende Adressen der alten Website).

export const buero = { name: 'Bad Berka', lat: 50.8972, lon: 11.2797 };

export const orte = [
  {
    slug: 'bad-berka', name: 'Bad Berka', lat: 50.8972, lon: 11.2797, seite: true,
    kurz: 'Kurstadt an der Ilm und Sitz unseres Büros',
    text: [
      'In Bad Berka sitzt unser Büro – hier sind wir zu Hause. Wir kennen die Wohnlagen zwischen Kurpark, Ilmtal und den Hängen am Stadtrand und wissen, welche Häuser und Wohnungen gerade gesucht werden.',
      'Ob Sie Ihr Haus verkaufen, eine Wohnung vermieten oder erst einmal wissen möchten, was Ihre Immobilie wert ist: Wir kommen vorbei, schauen uns alles in Ruhe an und sagen Ihnen ehrlich, welcher Preis realistisch ist.'
    ]
  },
  {
    slug: 'weimar', name: 'Weimar', lat: 50.9795, lon: 11.3235, seite: true,
    kurz: 'Kreisfreie Stadt nördlich von Bad Berka',
    text: [
      'Weimar liegt nur wenige Minuten von unserem Büro in Bad Berka entfernt. Für Eigentümer in Weimar übernehmen wir Bewertung, Vermarktung und Vermietung – von der Altbauwohnung bis zum Einfamilienhaus am Stadtrand.',
      'Weil Preise in Weimar je nach Lage stark schwanken, bewerten wir jede Immobilie einzeln vor Ort und nicht nach Quadratmeter-Durchschnitt.'
    ]
  },
  {
    slug: 'weimarer-land', name: 'Weimarer Land', lat: 50.98, lon: 11.45, seite: true, karte: false,
    kurz: 'Unser Landkreis rund um Apolda, Bad Berka und Blankenhain',
    text: [
      'Das Weimarer Land ist unser Arbeitsgebiet: von Apolda im Norden über Bad Berka bis nach Blankenhain und Kranichfeld im Süden. Hier vermitteln wir Häuser, Wohnungen, Grundstücke und Anlageobjekte.',
      'Zwischen Kleinstadt und Dorf unterscheiden sich Nachfrage und Preise deutlich. Diese Unterschiede kennen wir aus vielen Besichtigungen und Gesprächen mit Käufern und Mietern.'
    ]
  },
  {
    slug: 'blankenhain', name: 'Blankenhain', lat: 50.8596, lon: 11.3437, seite: true,
    kurz: 'Stadt im Süden des Weimarer Landes',
    text: [
      'Blankenhain und seine Ortsteile liegen nur ein kurzes Stück von Bad Berka entfernt. Wir betreuen hier Verkäufe und Vermietungen von Einfamilienhäusern, Höfen und Grundstücken.',
      'Gerade bei ländlichen Objekten kommt es auf eine sorgfältige Bewertung und gute Unterlagen an – beides übernehmen wir für Sie.'
    ]
  },
  {
    slug: 'kranichfeld', name: 'Kranichfeld', lat: 50.8536, lon: 11.2006, seite: true,
    kurz: 'Kleinstadt an der Ilm',
    text: [
      'Kranichfeld liegt ilmaufwärts von Bad Berka. Für Eigentümer in Kranichfeld und Umgebung übernehmen wir die Bewertung und den kompletten Verkauf oder die Vermietung.',
      'Wir kümmern uns um Exposé, Fotos, Anzeigen, Besichtigungen und den Weg bis zum Notartermin – Sie haben dabei einen festen Ansprechpartner.'
    ]
  },
  {
    slug: 'grammetal', name: 'Grammetal', lat: 50.9633, lon: 11.2333, seite: true,
    kurz: 'Landgemeinde zwischen Erfurt und Weimar',
    text: [
      'Die Landgemeinde Grammetal liegt zwischen Erfurt und Weimar und ist bei Familien gefragt, die ländlich wohnen und trotzdem schnell in der Stadt sein möchten.',
      'Wir bewerten Häuser und Grundstücke in den Ortsteilen von Grammetal und finden passende Käufer oder Mieter.'
    ]
  },
  {
    slug: 'klettbach', name: 'Klettbach', lat: 50.9178, lon: 11.1378, seite: true,
    kurz: 'Gemeinde westlich von Bad Berka',
    text: [
      'Klettbach liegt westlich von Bad Berka in Richtung Erfurt. Hier vermitteln wir vor allem Einfamilienhäuser und Grundstücke.',
      'Was ein Haus in Klettbach wert ist, hängt stark von Zustand, Grundstück und Lage im Ort ab. Wir schauen uns Ihre Immobilie an und nennen Ihnen einen realistischen Preis.'
    ]
  },
  {
    slug: 'magdala', name: 'Magdala', lat: 50.9064, lon: 11.4442, seite: true,
    kurz: 'Kleinstadt östlich von Bad Berka',
    text: [
      'Magdala liegt östlich von Bad Berka, zwischen Weimar und Jena. Wir betreuen hier Eigentümer beim Verkauf und bei der Vermietung von Häusern und Wohnungen.',
      'Durch die Nähe zu Jena und Weimar ist die Nachfrage oft größer, als viele Eigentümer erwarten. Eine fundierte Bewertung ist deshalb der beste erste Schritt.'
    ]
  },
  // nur Karte, keine eigene Seite
  { slug: 'apolda', name: 'Apolda', lat: 51.0262, lon: 11.5139, kurz: 'Kreisstadt' },
  { slug: 'erfurt', name: 'Erfurt', lat: 50.9787, lon: 11.0328, kurz: 'Landeshauptstadt', referenz: true },
  { slug: 'jena', name: 'Jena', lat: 50.9271, lon: 11.5892, kurz: '', referenz: true }
];

export function entfernungKm(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
