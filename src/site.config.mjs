// Zentrale Einstellungen der Website.
// Änderungen hier wirken nach `npm run build` auf alle Seiten.

export default {
  // Öffentliche Adresse (für Sitemap, Canonical-Links, Open Graph)
  url: 'https://www.lubrichimmobilien.de',

  // Wird nur für die 404-Seite gebraucht, weil GitHub Pages sie unter beliebigen Pfaden ausliefert.
  // Eigene Domain: '/'. Ohne eigene Domain (juropixel.github.io/lubrichimmobilien.de/): '/lubrichimmobilien.de/'
  basePath: '/lubrichimmobilien.de/',

  firma: {
    name: 'Lubrich Immobilien',
    inhaber: 'Franz Lubrich',
    strasse: 'Johann-Scholz-Straße 41',
    plz: '99438',
    ort: 'Bad Berka',
    telefon: '0172 7570689',
    telefonLink: '+491727570689',
    email: 'info@lubrichimmobilien.de',
    instagram: 'https://www.instagram.com/immobilien.lubrich/',
    immowelt: 'https://www.immowelt.de/profil/34121eb8bd34456195d85878fa707c93',
    googleBewertung: 'https://www.google.com/search?q=Lubrich+Immobilien+Bad+Berka',
    geo: { lat: 50.8972, lon: 11.2797 }
  },

  // Ziel für Formulare (Kontakt, Objektanfrage, Wertermittlung).
  // Leer lassen  -> Formular öffnet das E-Mail-Programm mit vorausgefüllter Nachricht (funktioniert ohne Dienst).
  // URL eintragen -> Formular wird per POST (JSON) dorthin geschickt, z. B. an den
  //                  Cloudflare-Worker aus /serverless (legt die Anfrage direkt in onOffice an).
  formEndpoint: ''
};
