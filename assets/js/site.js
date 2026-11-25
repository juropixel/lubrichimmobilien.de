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

  /* ------------------------------------------------------------ Intro (nur Startseite, einmal pro Besuch) */
  const stapel = $('[data-stapel]');
  const intro = $('#intro');
  // Karten austeilen; danach normale Übergänge ohne Verzögerung
  const planLos = () => {
    if (!stapel || stapel.classList.contains('stapel--los')) return;
    stapel.classList.add('stapel--los');
    setTimeout(() => stapel.classList.add('stapel--bereit'), 1600);
  };
  if (intro) {
    try { sessionStorage.setItem('lubrich-intro', '1'); } catch (e) { /* privater Modus */ }
    // Koordinaten zählen hoch
    $$('[data-zahl]', intro).forEach((el) => {
      const ziel = Number(el.dataset.zahl), start = performance.now() + 1100, dauer = 1100;
      const schritt = (t) => {
        const f = Math.min(1, Math.max(0, (t - start) / dauer));
        el.textContent = (ziel * (1 - Math.pow(1 - f, 3))).toFixed(3).replace('.', ',');
        if (f < 1) requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    });
    let fertig = false;
    const ende = () => {
      if (fertig) return; fertig = true;
      document.documentElement.classList.add('intro-fertig');
      intro.hidden = true;
      intro.parentNode && intro.parentNode.removeChild(intro);
    };
    // Die Zeichnung der Bühne startet, während sich der Giebel öffnet
    const planTimer = setTimeout(planLos, 2700);
    intro.addEventListener('animationend', (e) => { if (e.target === intro) ende(); });
    const ueberspringen = () => {
      if (intro.classList.contains('intro--sofort')) return;
      clearTimeout(planTimer);
      intro.classList.add('intro--sofort');
      setTimeout(planLos, 250);
    };
    intro.addEventListener('click', ueberspringen);
    document.addEventListener('keydown', ueberspringen, { once: true });
    setTimeout(ende, 4600); // Sicherheitsnetz
  } else {
    requestAnimationFrame(planLos);
  }

  /* ------------------------------------------------------------ Giebelkarten-Stapel (Startseite) */
  if (stapel) {
    const karten = $$('.giebelkarte', stapel);
    const nr = $('[data-nr]', stapel);
    const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let reihe = karten.slice();
    let sperre = false;

    const ordnen = (liste = reihe) => {
      liste.forEach((k, pos) => {
        k.dataset.pos = String(Math.min(pos, 3));
        const a = $('a', k);
        if (pos === 0) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1');
        k.setAttribute('aria-hidden', pos === 0 ? 'false' : 'true');
      });
      nr.textContent = String(karten.indexOf(reihe[0]) + 1);
    };
    const weiter = () => {
      if (sperre || reihe.length < 2) return; sperre = true;
      const oben = reihe.shift();
      oben.classList.add('geht');
      ordnen(reihe);
      setTimeout(() => {
        oben.classList.add('zieht'); oben.classList.remove('geht');
        reihe.push(oben); ordnen();
        oben.style.transform = '';
        requestAnimationFrame(() => { oben.classList.remove('zieht'); sperre = false; });
      }, ruhig ? 0 : 550);
    };
    const zurueck = () => {
      if (sperre || reihe.length < 2) return;
      reihe.unshift(reihe.pop()); ordnen();
    };
    $('[data-weiter]', stapel).addEventListener('click', () => { weiter(); pause(8000); });
    $('[data-zurueck]', stapel).addEventListener('click', () => { zurueck(); pause(8000); });

    // automatisch weiterblättern, pausiert bei Maus/Fokus und wenn nicht sichtbar
    let pausiertBis = 0, sichtbar = true, drueber = false;
    const pause = (ms) => { pausiertBis = Date.now() + ms; };
    stapel.addEventListener('pointerenter', () => { drueber = true; });
    stapel.addEventListener('pointerleave', () => { drueber = false; });
    stapel.addEventListener('focusin', () => pause(10000));
    new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; }).observe(stapel);
    if (!ruhig) setInterval(() => {
      if (stapel.classList.contains('stapel--bereit') && sichtbar && !drueber && Date.now() > pausiertBis && !document.hidden) weiter();
    }, 4200);

    // oberste Karte wegwischen
    let start = null, dx = 0, gezogen = false;
    stapel.addEventListener('pointerdown', (e) => {
      const k = e.target.closest('.giebelkarte');
      if (!k || k !== reihe[0] || sperre) return;
      start = e.clientX; dx = 0; gezogen = false;
      k.classList.add('zieht');
    });
    window.addEventListener('pointermove', (e) => {
      if (start === null) return;
      dx = e.clientX - start;
      if (Math.abs(dx) > 6) gezogen = true;
      reihe[0].style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    });
    window.addEventListener('pointerup', () => {
      if (start === null) return;
      const k = reihe[0];
      start = null;
      k.classList.remove('zieht');
      k.style.transform = '';
      if (Math.abs(dx) > 90) { weiter(); pause(8000); }
    });
    // nach dem Ziehen keinen Link öffnen
    stapel.addEventListener('click', (e) => { if (gezogen && e.target.closest('.giebelkarte')) { e.preventDefault(); gezogen = false; } }, true);

    ordnen();
  }

  /* ------------------------------------------------------------ Goldener Faden (Startseite)
     Eine feine Linie zeichnet sich beim Scrollen: vom Kartenstapel durch den Verkaufsablauf
     bis zum Kontaktbereich, wo sie das Dach aus dem Logo bildet. */
  const ablaufSchritte = $$('.start .schritte li');
  const kontaktBand = $('.start .band--nacht');
  if (ablaufSchritte.length && kontaktBand) {
    const NS = 'http://www.w3.org/2000/svg';
    const main = $('#inhalt');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'faden'); svg.setAttribute('aria-hidden', 'true');
    const linie = document.createElementNS(NS, 'path'); linie.setAttribute('class', 'faden__linie');
    const dach = document.createElementNS(NS, 'path'); dach.setAttribute('class', 'faden__dach');
    const spitze = document.createElementNS(NS, 'circle'); spitze.setAttribute('class', 'faden__spitze'); spitze.setAttribute('r', '4');
    svg.append(linie, dach, spitze);
    main.appendChild(svg);
    const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.body.classList.add('faden-an');
    // Wegabschnitte: Länge am Ende jedes Abschnitts und die Scroll-Zielhöhe, bei der er fertig gezeichnet ist
    let abschnitte = [], laenge = 0, dachLaenge = 0, dachStart = 0, ankerListe = [], bereit = false;

    const messen = () => {
      const mr = main.getBoundingClientRect();
      const oy = mr.top + window.scrollY, ox = mr.left;
      const pos = (el) => { const r = el.getBoundingClientRect(); return { x: r.left - ox, y: r.top + window.scrollY - oy, w: r.width, h: r.height }; };
      const W = main.clientWidth, H = main.offsetHeight;
      svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

      const rahmen = $('.ablauf');
      const rp = pos(rahmen);
      const pad = parseFloat(getComputedStyle(rahmen).paddingLeft);
      const randL = Math.max(10, rp.x + pad - 40);
      const randR = Math.min(W - 10, rp.x + rp.w - pad + 40);

      // Start: unter dem Kamin der obersten Karte (offsetLeft/-Width ignorieren laufende Animationen)
      const karte = $('.giebelkarte');
      const liste = $('.stapel__karten');
      const steuer = $('.stapel__steuerung');
      const sp = steuer ? pos(steuer) : pos($('.start-buehne'));
      const sx = karte && liste ? pos(liste).x + karte.offsetLeft + karte.offsetWidth * 0.6575 : randL;
      const sy = sp.y + sp.h + 22;

      const kreise = ablaufSchritte.map((li) => { const p = pos(li); return { x: p.x + 24, y: p.y + 20.8 }; });
      const ax = kreise[0].x, y1 = kreise[0].y, yN = kreise[kreise.length - 1].y;

      // Abschnitte sammeln: d = Pfadstück, z = Scroll-Zielhöhe am Ende des Stücks
      const seg = [];
      const neu = (d, z) => seg.push({ d, z });
      neu(`M${sx} ${sy}`, sy);

      // 1) in den Verkaufsablauf (mobil an der Einleitung vorbei)
      const ip = pos($('.ablauf__intro'));
      if (ip.y + ip.h < y1 - 10) {
        const yR = Math.max(sy + 50, ip.y - 10);
        neu(`C${sx} ${sy + 40} ${randL} ${sy + 20} ${randL} ${yR}`, yR);
        neu(`L${randL} ${y1 - 70}`, y1 - 70);
        neu(`C${randL} ${y1 - 30} ${ax} ${y1 - 45} ${ax} ${y1}`, y1);
      } else {
        neu(`C${sx} ${sy + 120} ${ax} ${y1 - 150} ${ax} ${y1}`, y1);
      }
      neu(`L${ax} ${yN}`, yN);
      neu(`C${ax} ${yN + 160} ${randL} ${yN + 80} ${randL} ${yN + 260}`, yN + 260);

      // 2) „Wobei wir helfen“: links herunter, dann waagerecht über die Oberkante des Kastens nach rechts
      const anliegen = $('.start .anliegen');
      if (anliegen) {
        const ab = pos(anliegen), yT = ab.y;
        // Eckradius passend zum verfügbaren Rand (mobil nur wenige Pixel), damit die Ecke nicht ins Feld schneidet
        const rL = Math.max(3, Math.min(24, ab.x - randL - 2)), rR = Math.max(3, Math.min(24, randR - (ab.x + ab.w) - 2));
        neu(`L${randL} ${yT - rL}`, yT - rL);
        neu(`Q${randL} ${yT} ${randL + rL} ${yT}`, yT);
        neu(`L${randR - rR} ${yT}`, yT + 300);          // langsame Querfahrt
        neu(`Q${randR} ${yT} ${randR} ${yT + rR}`, yT + 320);
      }

      // 3) rechts herunter bis unter die Region, dann in weitem Bogen zurück nach links
      const regionAbschnitt = $('.start .region')?.closest('section');
      const stimmenKopf = $('#stimmen-titel')?.closest('.abschnitt__kopf');
      const bp = pos(kontaktBand), hp = pos($('h2', kontaktBand));
      const yb = hp.y - 16, xl = hp.x;
      if (regionAbschnitt && stimmenKopf) {
        const inhalt = $$('.rahmen > *', regionAbschnitt).map(pos);
        const kopfY = pos(stimmenKopf).y;
        const y0 = Math.min(Math.max(...inhalt.map((p) => p.y + p.h)) + 40, kopfY - 70);
        const yK = Math.max(y0 + 40, kopfY - 24);
        neu(`L${randR} ${y0}`, y0);
        neu(`C${randR} ${y0 + (yK - y0) * 0.75} ${randL} ${yK - (yK - y0) * 0.75} ${randL} ${yK}`, yK + 220);
      }
      neu(`L${randL} ${yb - 26}`, yb - 26);

      // Pfad setzen und Länge je Abschnitt bestimmen
      abschnitte = []; let dSoFar = '', zMax = -Infinity;
      for (const s of seg) {
        dSoFar += (dSoFar ? ' ' : '') + s.d;
        linie.setAttribute('d', dSoFar);
        zMax = Math.max(zMax, s.z);
        abschnitte.push({ l: linie.getTotalLength(), z: zMax });
      }
      laenge = abschnitte[abschnitte.length - 1].l;

      // 4) Dach wie im Logo: die Linie steigt vom Rand in einem weichen Bogen als Dachschräge auf
      const x0 = randL, Wd = Math.min(240, Math.max(150, (xl - x0) + hp.w * 0.28)), Hd = Wd * 0.3;
      const kx = x0 + Wd * 0.585;
      dach.setAttribute('d', [
        `M${x0} ${yb - 26} Q${x0} ${yb} ${x0 + 16} ${yb - 16 * Hd / (Wd * 0.47)} L${x0 + Wd * 0.47} ${yb - Hd}`,
        `M${kx} ${yb - Hd - 18} L${kx} ${yb - Hd - 9}`,
        `M${kx} ${yb - Hd + 2} L${kx} ${yb - 2}`,
        `M${x0 + Wd * 0.655} ${yb - Hd + 12} L${x0 + Wd} ${yb}`
      ].join(' '));
      dachStart = yb - 40;
      dachLaenge = dach.getTotalLength();
      linie.style.strokeDasharray = laenge; dach.style.strokeDasharray = dachLaenge;

      // Anker: Elemente werden aktiv, sobald die gezeichnete Länge ihren nächstgelegenen Punkt erreicht
      const proben = [];
      for (let i = 0; i <= 900; i++) { const l = (laenge * i) / 900, p = linie.getPointAtLength(l); proben.push({ l, x: p.x, y: p.y }); }
      const laengeBei = (x, y) => { let best = 0, bd = Infinity; for (const p of proben) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = p.l; } } return best; };
      ankerListe = [];
      ablaufSchritte.forEach((li, i) => ankerListe.push({ el: li, l: laengeBei(kreise[i].x, kreise[i].y), klasse: 'erreicht' }));
      const felder = $$('.start .anliegen__feld');
      const nebeneinander = felder.length > 1 && Math.abs(pos(felder[1]).y - pos(felder[0]).y) < 5;
      felder.forEach((f) => { const p = pos(f); ankerListe.push({ el: f, l: nebeneinander ? laengeBei(p.x + p.w / 2, p.y) : laengeBei(p.x + p.w, p.y + p.h / 2) }); });
      const person = $('.start .persoenlich .person');
      if (person) { const p = pos(person); ankerListe.push({ el: person, l: laengeBei(p.x + p.w, p.y + p.h / 2) }); }
      const region = $('.start .region');
      if (region) { const p = pos(region); ankerListe.push({ el: region, l: laengeBei(p.x + p.w, p.y + p.h / 2) }); }
      $$('.start .stimme').forEach((s) => { const p = pos(s); ankerListe.push({ el: s, l: laengeBei(randL, p.y + 30) }); });

      bereit = true;
      zeichnen();
    };

    // Scrollposition → gezeichnete Länge (stückweise linear je Abschnitt)
    const laengeFuer = (ziel) => {
      if (ziel <= abschnitte[0].z) return 0;
      for (let i = 1; i < abschnitte.length; i++) {
        const a = abschnitte[i - 1], b = abschnitte[i];
        if (ziel <= b.z) return b.z === a.z ? b.l : a.l + (b.l - a.l) * (ziel - a.z) / (b.z - a.z);
      }
      return laenge;
    };

    const zeichnen = () => {
      if (!bereit) return;
      const mr = main.getBoundingClientRect();
      const ziel = ruhig ? Infinity : window.innerHeight * 0.62 - mr.top;
      const l = laengeFuer(ziel);
      linie.style.strokeDashoffset = laenge - l;
      const t = Math.min(1, Math.max(0, (ziel - dachStart) / 220));
      dach.style.strokeDashoffset = dachLaenge * (1 - t);
      // Stiftspitze am Ende der gezeichneten Linie
      const p = t > 0 ? dach.getPointAtLength(dachLaenge * t) : linie.getPointAtLength(l);
      spitze.setAttribute('cx', p.x.toFixed(1)); spitze.setAttribute('cy', p.y.toFixed(1));
      spitze.classList.toggle('ist-sichtbar', l > 2 && t < 1 && !ruhig);
      ankerListe.forEach((a) => a.el.classList.toggle(a.klasse || 'aktiv', l >= a.l - 1));
    };

    let anfrage = 0;
    const planen = () => { if (!anfrage) anfrage = requestAnimationFrame(() => { anfrage = 0; zeichnen(); }); };
    window.addEventListener('scroll', planen, { passive: true });
    let mt = 0;
    const neuMessen = () => { clearTimeout(mt); mt = setTimeout(messen, 120); };
    window.addEventListener('resize', neuMessen);
    if ('ResizeObserver' in window) new ResizeObserver(neuMessen).observe(main);
    (document.fonts?.ready || Promise.resolve()).then(messen);
    window.addEventListener('load', messen);
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
