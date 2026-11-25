/* Lubrich Immobilien – Interaktion (ohne Bibliotheken) */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const body = document.body;
  const ENDPOINT = body.dataset.formEndpoint || '';
  const EMAIL = body.dataset.email || 'info@lubrichimmobilien.de';

  /* ------------------------------------------------------------ Menü */
  const menueKnopf = $('.kopf__menue');
  const nav = $('#hauptnav');
  if (menueKnopf && nav) {
    const setze = (offen) => {
      menueKnopf.setAttribute('aria-expanded', String(offen));
      nav.classList.toggle('ist-offen', offen);
    };
    menueKnopf.addEventListener('click', () => setze(menueKnopf.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('ist-offen')) { setze(false); menueKnopf.focus(); } });
  }

  /* ------------------------------------------------------------ Filter Immobilien */
  const filter = $('[data-filter]');
  if (filter) {
    const karten = $$('.karten .karte');
    const liste = $('.karten');
    const treffer = $('[data-treffer]');
    const leer = $('[data-leer]');
    const ursprung = karten.slice();
    const anwenden = () => {
      const d = new FormData(filter);
      const v = d.get('vermarktung'), art = d.get('art'), ort = d.get('ort'), sort = d.get('sortierung');
      let n = 0;
      karten.forEach((k) => {
        const ok = (!v || k.dataset.vermarktung === v) && (!art || k.dataset.art === art) && (!ort || k.dataset.ort === ort);
        k.hidden = !ok; if (ok) n++;
      });
      const num = (k, a) => (k.dataset[a] === '' ? NaN : Number(k.dataset[a]));
      const sortiert = ursprung.slice();
      if (sort === 'preis-auf') sortiert.sort((a, b) => (num(a, 'preis') || Infinity) - (num(b, 'preis') || Infinity));
      if (sort === 'preis-ab') sortiert.sort((a, b) => (num(b, 'preis') || -1) - (num(a, 'preis') || -1));
      if (sort === 'flaeche-ab') sortiert.sort((a, b) => (num(b, 'flaeche') || 0) - (num(a, 'flaeche') || 0));
      sortiert.forEach((k) => liste.appendChild(k));
      treffer.textContent = `${n} ${n === 1 ? 'Angebot' : 'Angebote'}`;
      leer.hidden = n > 0;
      const p = new URLSearchParams();
      for (const [k, val] of d) if (val && !(k === 'sortierung' && val === 'neu')) p.set(k, val);
      history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
    };
    // Startwerte aus URL (z. B. ?vermarktung=Miete)
    const start = new URLSearchParams(location.search);
    for (const [k, val] of start) {
      const feld = filter.elements[k];
      if (!feld) continue;
      if (feld instanceof RadioNodeList) { const r = [...feld].find((x) => x.value === val); if (r) r.checked = true; }
      else feld.value = val;
    }
    filter.addEventListener('change', anwenden);
    $('[data-filter-reset]')?.addEventListener('click', () => { filter.reset(); anwenden(); });
    if ([...start].length) anwenden();
  }

  /* ------------------------------------------------------------ Galerie */
  const galerie = $('[data-galerie]');
  if (galerie) {
    const bilder = JSON.parse($('[data-bilder]', galerie).textContent);
    const dlg = $('dialog', galerie);
    const img = $('img', dlg);
    const titel = $('.lightbox__titel', dlg);
    let index = 0, ausloeser = null;
    const zeige = (i) => {
      index = (i + bilder.length) % bilder.length;
      img.src = bilder[index].src;
      img.alt = bilder[index].titel || `Bild ${index + 1}`;
      titel.textContent = `${bilder[index].titel ? bilder[index].titel + ' – ' : ''}Bild ${index + 1} von ${bilder.length}`;
    };
    galerie.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-index]');
      if (!b || dlg.contains(b)) return;
      ausloeser = b; zeige(Number(b.dataset.index)); dlg.showModal();
    });
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-zu]') || e.target === dlg) dlg.close();
      const s = e.target.closest('[data-schritt]'); if (s) zeige(index + Number(s.dataset.schritt));
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') zeige(index + 1);
      if (e.key === 'ArrowLeft') zeige(index - 1);
    });
    let x0 = null;
    dlg.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) zeige(index + (dx < 0 ? 1 : -1)); x0 = null; });
    dlg.addEventListener('close', () => ausloeser?.focus());
  }

  /* ------------------------------------------------------------ Versand */
  const LABEL = {
    formular: 'Formular', objektnr: 'Objekt-Nr.', objekttitel: 'Objekt', anrede: 'Anrede', vorname: 'Vorname', name: 'Name',
    email: 'E-Mail', telefon: 'Telefon', nachricht: 'Nachricht', art: 'Immobilienart', haustyp: 'Haustyp', gewerbetyp: 'Gewerbeart',
    baujahr: 'Baujahr', flaeche: 'Wohn-/Nutzfläche (m²)', grundstueck: 'Grundstücksfläche (m²)', erschliessung: 'Erschließung',
    zimmer: 'Zimmer', plz: 'PLZ', ort: 'Ort', strasse: 'Straße', anlass: 'Anlass',
    such_objektart: 'Gesucht: Objektart', such_preis: 'Gesucht: Preis', such_ort: 'Gesucht: Ort', such_groesse: 'Gesucht: Größe', such_wuensche: 'Gesucht: Wünsche'
  };

  function sammle(form) {
    const d = {};
    for (const [k, v] of new FormData(form)) {
      if (k === 'website' || k === 'datenschutz' || v === '') continue;
      d[k] = String(v).trim();
    }
    return d;
  }

  async function sende(typ, betreff, daten) {
    const nutzlast = { formular: typ, betreff, seite: location.href, zeitpunkt: new Date().toISOString(), daten };
    if (ENDPOINT) {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nutzlast) });
      if (!r.ok) throw new Error(`Server antwortet mit ${r.status}`);
      return 'gesendet';
    }
    // Ohne Formular-Dienst: E-Mail-Programm mit vorbereiteter Nachricht öffnen
    const zeilen = Object.entries(daten).filter(([k]) => k !== 'objekt_id').map(([k, v]) => `${LABEL[k] || k}: ${v}`);
    const text = `${betreff}\n\n${zeilen.join('\n')}\n\n– gesendet über ${location.href}`;
    location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
    return 'mailto';
  }

  function pruefe(container) {
    let erstes = null;
    $$('.fehlertext', container).forEach((e) => e.remove());
    $$('input, textarea, select', container).forEach((f) => {
      if (f.closest('.hp') || f.closest('[hidden]')) return;
      f.classList.remove('ist-fehler'); f.removeAttribute('aria-invalid');
      if (f.checkValidity()) return;
      f.classList.add('ist-fehler'); f.setAttribute('aria-invalid', 'true');
      const msg = document.createElement('p');
      msg.className = 'fehlertext';
      msg.id = `${f.id || f.name}-fehler`;
      msg.textContent = f.type === 'checkbox' ? 'Bitte bestätigen Sie die Datenschutzerklärung.'
        : f.validity.valueMissing ? 'Bitte füllen Sie dieses Feld aus.'
        : f.type === 'email' ? 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
        : f.name === 'plz' ? 'Bitte geben Sie eine fünfstellige Postleitzahl ein.'
        : f.validity.rangeUnderflow || f.validity.rangeOverflow ? `Bitte einen Wert zwischen ${f.min} und ${f.max} eingeben.`
        : 'Bitte prüfen Sie Ihre Eingabe.';
      (f.type === 'checkbox' ? f.closest('label') : f).insertAdjacentElement('afterend', msg);
      f.setAttribute('aria-describedby', msg.id);
      erstes ??= f;
    });
    erstes?.focus();
    return !erstes;
  }

  function status(form, art, text) {
    const s = $('.formular__status', form);
    s.className = `formular__status ist-${art}`;
    s.textContent = text;
  }

  const MAILTO_HINWEIS = 'Ihr E-Mail-Programm wurde mit einer vorbereiteten Nachricht geöffnet. Bitte senden Sie diese ab. Falls sich nichts geöffnet hat, schreiben Sie uns direkt an ' + EMAIL + '.';

  $$('form[data-formular]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.elements.website?.value) return; // Spam
      if (!pruefe(form)) return;
      const knopf = $('button[type="submit"]', form);
      knopf.disabled = true;
      try {
        const ergebnis = await sende(form.dataset.formular, form.dataset.betreff || 'Anfrage', sammle(form));
        status(form, 'ok', ergebnis === 'mailto' ? MAILTO_HINWEIS : 'Vielen Dank! Ihre Nachricht ist bei uns angekommen. Wir melden uns so schnell wie möglich.');
        if (ergebnis !== 'mailto') form.reset();
      } catch (err) {
        status(form, 'fehler', `Die Nachricht konnte nicht gesendet werden. Bitte rufen Sie uns an oder schreiben Sie an ${EMAIL}.`);
      } finally { knopf.disabled = false; }
    });
  });

  /* ------------------------------------------------------------ Wertermittlung */
  const rechner = $('[data-rechner]');
  if (rechner) {
    const ABLAUF = {
      grundstueck: ['art', 'grundstueck', 'erschliessung', 'lage', 'anlass', 'kontakt'],
      haus: ['art', 'haustyp', 'baujahr', 'flaeche', 'grundstueck', 'lage', 'anlass', 'kontakt'],
      wohnung: ['art', 'baujahr', 'flaeche', 'zimmer', 'lage', 'anlass', 'kontakt'],
      gewerbe: ['art', 'gewerbetyp', 'flaeche', 'baujahr', 'lage', 'anlass', 'kontakt']
    };
    const schritte = Object.fromEntries($$('[data-schritt]', rechner).map((s) => [s.dataset.schritt, s]));
    const balken = $('[data-balken]', rechner);
    const schrittText = $('[data-schritt-text]', rechner);
    const zurueck = $('[data-zurueck]', rechner);
    const zusammenfassung = $('[data-zusammenfassung]');
    const zListe = $('[data-liste]', zusammenfassung);
    let verlauf = ['art'];

    const art = () => rechner.elements.art.value;
    const ablauf = () => ABLAUF[art()] || ['art'];

    // Regler und Zahlenfeld koppeln
    $$('[data-regler]', rechner).forEach((r) => {
      const zahl = $('input[type="number"]', r), regler = $('input[type="range"]', r);
      regler.addEventListener('input', () => { zahl.value = regler.value; });
      zahl.addEventListener('input', () => { if (zahl.value !== '') regler.value = zahl.value; });
    });

    function passeTexteAn() {
      const a = art();
      const fl = schritte.flaeche;
      const legend = $('legend', fl), label = $('label', fl), regler = $('input[type="range"]', fl), skala = $('[data-skala-max]', fl);
      legend.textContent = a === 'gewerbe' ? legend.dataset.legendeGewerbe : a === 'wohnung' ? legend.dataset.legendeWohnung : 'Wie groß ist die Wohnfläche?';
      label.textContent = a === 'gewerbe' ? 'Nutzfläche' : 'Wohnfläche';
      regler.max = a === 'gewerbe' ? regler.dataset.maxGewerbe : 400;
      skala.textContent = a === 'gewerbe' ? '5.000 m² und mehr' : '400 m² und mehr';
      if (a === 'gewerbe' && Number($('#r-flaeche').value) === 120) { $('#r-flaeche').value = 500; regler.value = 500; }
      const bl = $('legend', schritte.baujahr);
      bl.textContent = a === 'wohnung' ? bl.dataset.legendeWohnung : 'Wann wurde die Immobilie gebaut?';
    }

    function zusammenfassen() {
      const d = sammle(rechner);
      const zeilen = [];
      const text = (name) => rechner.querySelector(`input[name="${name}"]:checked`)?.dataset.text;
      if (d.art) zeilen.push(['Immobilie', text('art')]);
      if (d.haustyp) zeilen.push(['Typ', d.haustyp]);
      if (d.gewerbetyp) zeilen.push(['Typ', d.gewerbetyp]);
      const besucht = new Set(verlauf);
      if (besucht.has('baujahr') && verlauf.indexOf('baujahr') < verlauf.length - 1) zeilen.push(['Baujahr', d.baujahr]);
      if (besucht.has('flaeche') && verlauf.indexOf('flaeche') < verlauf.length - 1) zeilen.push([art() === 'gewerbe' ? 'Nutzfläche' : 'Wohnfläche', `${d.flaeche} m²`]);
      if (besucht.has('grundstueck') && verlauf.indexOf('grundstueck') < verlauf.length - 1) zeilen.push(['Grundstück', `${Number(d.grundstueck).toLocaleString('de-DE')} m²`]);
      if (d.erschliessung) zeilen.push(['Erschließung', d.erschliessung]);
      if (d.zimmer) zeilen.push(['Zimmer', d.zimmer.replace(' Zimmer', '')]);
      if (besucht.has('lage') && verlauf.indexOf('lage') < verlauf.length - 1 && d.plz) zeilen.push(['Lage', [d.plz, d.ort].filter(Boolean).join(' ')]);
      if (d.anlass) zeilen.push(['Anlass', d.anlass]);
      zListe.innerHTML = '';
      zeilen.forEach(([k, v]) => { const div = document.createElement('div'); div.innerHTML = '<dt></dt><dd></dd>'; div.firstChild.textContent = k; div.lastChild.textContent = v; zListe.appendChild(div); });
      zusammenfassung.hidden = zeilen.length === 0;
    }

    function zeige(name, { fokus = true } = {}) {
      Object.values(schritte).forEach((s) => { s.hidden = s.dataset.schritt !== name; });
      const liste = ablauf();
      const pos = name === 'fertig' ? liste.length : liste.indexOf(name) + 1;
      const gesamt = art() ? liste.length : 6;
      balken.style.width = `${Math.max(8, (pos / gesamt) * 100)}%`;
      schrittText.textContent = name === 'fertig' ? 'Fertig' : `Schritt ${pos} von ${gesamt}`;
      zurueck.hidden = verlauf.length <= 1 || name === 'fertig';
      if (name === 'art' || name === 'fertig') schrittText.hidden = name === 'fertig';
      zusammenfassen();
      if (fokus) {
        const ziel = name === 'fertig' ? schritte.fertig : $('legend', schritte[name]);
        if (ziel) { ziel.setAttribute('tabindex', '-1'); ziel.focus({ preventScroll: true }); }
        const oben = rechner.getBoundingClientRect().top;
        if (oben < 0 || oben > window.innerHeight * 0.5) rechner.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
    }

    function weiter() {
      const aktuell = verlauf[verlauf.length - 1];
      if (!pruefe(schritte[aktuell])) return;
      const liste = ablauf();
      const naechster = liste[liste.indexOf(aktuell) + 1];
      if (!naechster) return;
      verlauf.push(naechster);
      zeige(naechster);
    }

    // Auswahlkacheln: automatisch weiter
    rechner.addEventListener('change', (e) => {
      const t = e.target;
      if (t.type !== 'radio' || t.name === 'anrede') return;
      if (t.name === 'art') { verlauf = ['art']; passeTexteAn(); }
      setTimeout(weiter, 180);
    });
    rechner.addEventListener('click', (e) => {
      if (e.target.closest('[data-weiter]')) weiter();
      if (e.target.closest('[data-zurueck]')) { if (verlauf.length > 1) { verlauf.pop(); zeige(verlauf[verlauf.length - 1]); } }
    });
    // Enter in Zahlenfeldern = Weiter
    rechner.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('input:not([type="radio"]):not([type="checkbox"])') && !schritte.kontakt.contains(e.target)) { e.preventDefault(); weiter(); }
    });

    rechner.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (rechner.elements.website?.value) return;
      if (!pruefe(schritte.kontakt)) return;
      const d = sammle(rechner);
      // Nur Angaben senden, die zum gewählten Ablauf gehören
      const erlaubt = new Set(['art', 'anrede', 'name', 'telefon', 'email', 'nachricht', 'plz', 'ort', 'strasse', 'anlass']);
      ablauf().forEach((s) => erlaubt.add(s));
      const daten = Object.fromEntries(Object.entries(d).filter(([k]) => erlaubt.has(k)));
      daten.art = rechner.querySelector('input[name="art"]:checked')?.dataset.text || daten.art;
      const knopf = $('button[type="submit"]', rechner);
      knopf.disabled = true;
      try {
        const ergebnis = await sende('wertermittlung', `Wertermittlung: ${daten.art}${daten.plz ? ' in ' + daten.plz + ' ' + (daten.ort || '') : ''}`.trim(), daten);
        if (ergebnis === 'mailto') $('[data-fertig-text]', rechner).textContent = MAILTO_HINWEIS;
        verlauf.push('fertig');
        zeige('fertig');
      } catch (err) {
        status(rechner, 'fehler', `Die Anfrage konnte nicht gesendet werden. Bitte rufen Sie uns an oder schreiben Sie an ${EMAIL}.`);
      } finally { knopf.disabled = false; }
    });

    // Einstieg mit ?art=haus (Schnellwahl auf der Startseite)
    const startArt = new URLSearchParams(location.search).get('art');
    const startFeld = startArt && rechner.querySelector(`input[name="art"][value="${CSS.escape(startArt)}"]`);
    if (startFeld) {
      startFeld.checked = true; passeTexteAn();
      verlauf = ['art', ablauf()[1]];
      zeige(verlauf[1], { fokus: false });
    } else {
      zeige('art', { fokus: false });
    }
  }
})();
