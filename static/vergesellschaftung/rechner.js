/*
 * Bedienoberfläche des Rechners „Was kostet die Vergesellschaftung den Berliner Haushalt?“
 * Rechnet ausschließlich mit berechne() aus rechenkern.js. Keine Abhängigkeiten, kein Tracking.
 */
(function () {
  'use strict';

  var ZINSSTAND = '20.10.2026';
  var BUND30 = 3.79;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var COL = { zuschuss: '#c4423a', ueberschuss: '#009b8a', ink3: '#6b7370', hover: '#1f2623' };

  // ------------------------------------------------------------------ Format
  function clean(x, d) { var f = Math.pow(10, d); return Math.abs(x) < 0.5 / f ? 0 : x; }
  function nf(x, d) {
    x = clean(x, d);
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(x).replace('-', '−');
  }
  function sf(x, d) { x = clean(x, d); if (x === 0) return nf(0, d); return (x > 0 ? '+' : '−') + nf(Math.abs(x), d); }
  function geld(xMio, signed) {
    var f = signed ? sf : nf;
    if (Math.abs(xMio) >= 999.5) return f(xMio / 1000, 1) + ' Mrd. €';
    return f(xMio, 0) + ' Mio. €';
  }
  function pct(x, d) { return nf(x * 100, d === undefined ? 1 : d) + ' %'; }
  function nfIn(x, maxD, minD) {
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: minD || 0, maximumFractionDigits: maxD }).format(clean(x, maxD)).replace('-', '\u2212');
  }
  function parseDe(s) {
    s = String(s).trim().replace(/\s|\u00a0/g, '').replace('\u2212', '-').replace(/[€%]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return parseFloat(s);
  }
  function nb(h) { return h.replace(/(\d) (Mrd\.|Mio\.) €/g, '$1\u00a0$2\u00a0€').replace(/(\d) (€|%)/g, '$1\u00a0$2'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------------ Eingaben
  // pct: Wert intern als Anteil, Anzeige in Prozent
  var CONTROLS = [
    { key: 'entschaedigungMrd', url: 'e', label: 'Entschädigung', unit: 'Mrd. €', min: 5, max: 40, step: 0.5, nmin: 0, nmax: 80, nstep: 0.1, dec: 1, main: true,
      hint: 'Was das Land den bisherigen Eigentümern insgesamt zahlt.',
      marks: [
        { v: 8, s: 'Initiative', t: 'Initiative Deutsche Wohnen & Co enteignen: Ertragswert nach dem „Faire-Mieten-Modell“; auch Szenario des Rechnungshofs (2024)' },
        { v: 11, s: 'Initiative', t: 'Initiative: Ertragswert mit den Mieten der landeseigenen Unternehmen; auch Szenario des Rechnungshofs (2024)' },
        { v: 13.5, s: 'IMK', t: 'IMK Policy Brief 225 (2026): Ertragswert, 4 % real, 40 Jahre, zzgl. Boden' },
        { v: 21, s: 'IMK neu bewertet', t: 'Ertragswert der IMK-Annahmen, wenn man mit dem eigenen Finanzierungssatz statt 4 % real bewertet (DIW aktuell)' },
        { v: 29, s: 'Verkehrswert', t: 'Verkehrswert, untere Schätzung (Senat 2019; Rechnungshof 2024)' },
        { v: 36, s: 'Verkehrswert', t: 'Verkehrswert, obere Schätzung (Senat 2019; Rechnungshof 2024). Senat 2020: bis 39,5 Mrd. €' }
      ] },
    { key: 'miete', url: 'm', label: 'Miete im ersten Jahr', unit: '€/m²', minDec: 2, min: 4, max: 10, step: 0.05, nmin: 0, nmax: 20, nstep: 0.01, dec: 2, main: true,
      hint: 'Nettokaltmiete je m² und Monat, die in den vergesellschafteten Wohnungen verlangt wird.',
      marks: [
        { v: 4.04, s: 'Faire Mieten', t: '„Faire-Mieten-Modell“, leistbare Nettokaltmiete (Holm et al. 2025, Kap. 1)' },
        { v: 6, s: 'Neubau-Untergrenze', t: 'Untergrenze der einkommensabhängigen Mieten im kommunalen Neubau, 6–12 € (Wahlprogramm Die Linke Berlin 2026, S. 35). Für die vergesellschafteten Bestände nennt das Programm keine Zielmiete.' },
        { v: 7, s: 'Holm et al.', t: 'Grundmodell Holm et al. (2025); etwa die Durchschnittsmiete der landeseigenen Unternehmen' },
        { v: 7.08, s: 'Ø LWU (IMK)', t: 'Durchschnittsmiete der sechs landeseigenen Unternehmen (IMK 2026, Tab. 1)' },
        { v: 8, s: 'heute', t: 'Etwa das heutige Niveau in den betroffenen Beständen: 7,94 € Ende 2023 (Bernt/Holm 2023), fortgeschrieben rund 8,30 € 2026' }
      ] },
    { key: 'mietsteigerung', url: 'gm', pct: true, label: 'Mietsteigerung pro Jahr', unit: '%', min: 0, max: 3, step: 0.1, nmin: -2, nmax: 6, nstep: 0.1, dec: 1, main: true,
      marks: [
        { v: 0, s: 'konstant', t: 'Konstante Miete, wie in Tabelle 2 des DIW aktuell' },
        { v: 0.01, s: 'Holm et al.', t: 'Grundmodell Holm et al. (2025); Wahlprogramm Die Linke: Mieterhöhungen der landeseigenen Unternehmen höchstens 1 % pro Jahr' },
        { v: 0.02, s: 'wie Kosten', t: 'Mieten steigen so schnell wie die Kosten im Standardfall (2 %)' }
      ] },
    { key: 'zinsEK', url: 'rek', pct: true, label: 'Zins für das Land', unit: '%', min: 0, max: 8, step: 0.1, nmin: 0, nmax: 15, nstep: 0.05, dec: 2, main: true,
      hint: 'Zins auf die Kredite, mit denen das Land das Eigenkapital finanziert.',
      marks: [
        { v: 0.015, s: 'IMK', t: 'Rechnerischer Zins hinter dem IMK-Kapitaldienst (40-jährige Annuität); plausibel nur als realer Zins' },
        { v: BUND30 / 100, s: 'Bund 30 J.', t: 'Rendite 30-jähriger Bundesanleihen ' + nf(BUND30, 2) + ' % (Deutsche Bundesbank, ' + ZINSSTAND + ') – die Untergrenze' },
        { v: 0.04, s: 'DIW', t: 'DIW aktuell, Tabelle 2a: Bundesanleihe 30 Jahre plus rund 0,2 Prozentpunkte Berlin-Aufschlag' },
        { v: 0.05, s: 'DIW +1 Pp.', t: 'DIW aktuell, Tabelle 2b: Zinsen 1 Prozentpunkt höher' }
      ] },
    { key: 'zinsFK', url: 'rfk', pct: true, label: 'Zins für die Anstalt', unit: '%', min: 0, max: 8, step: 0.1, nmin: 0, nmax: 15, nstep: 0.05, dec: 2, main: true,
      hint: 'Zins auf die Kredite der Anstalt öffentlichen Rechts.',
      marks: [
        { v: 0.02, s: 'IMK', t: 'Rechnerischer Zins hinter dem IMK-Kapitaldienst (40-jährige Annuität); plausibel nur als realer Zins' },
        { v: 0.035, s: 'DWE-Anleihe', t: 'Gesetzentwurf der Initiative: Schuldverschreibungen mit 3,5 % Zins, 100 Jahre Annuität' },
        { v: 0.05, s: 'DIW', t: 'DIW aktuell, Tabelle 2a: mittlere Laufzeit Bund plus rund 1 Prozentpunkt (vgl. HOWOGE-Anleihe), vorsichtig gerundet' },
        { v: 0.06, s: 'DIW +1 Pp.', t: 'DIW aktuell, Tabelle 2b: Zinsen 1 Prozentpunkt höher' }
      ] },
    // Weitere Annahmen
    { key: 'ekQuote', url: 'q', pct: true, label: 'Eigenkapitalquote', unit: '%', min: 0, max: 60, step: 1, nmin: 0, nmax: 100, nstep: 1, dec: 0, scaleMax: true,
      hint: 'Anteil der Entschädigung, den das Land als Eigenkapital einbringt (selbst kreditfinanziert).',
      marks: [
        { v: 0, s: 'DWE-Anleihe', t: 'Gesetzentwurf der Initiative: Zahlung vollständig in Schuldverschreibungen der Anstalt' },
        { v: 0.2, s: 'Holm/DIW', t: 'Holm et al. (2025); DIW aktuell' },
        { v: 0.3, s: 'IMK', t: 'IMK (2026), etwa der Durchschnitt der landeseigenen Unternehmen' },
        { v: 0.4, s: 'Dullien/Krebs', t: 'Dullien/Krebs (2020)' }
      ] },
    { key: 'laufzeitFK', url: 'nfk', label: 'Laufzeit Kredite der Anstalt', unit: 'Jahre', min: 10, max: 100, step: 1, nmin: 1, nmax: 150, nstep: 1, dec: 0,
      marks: [{ v: 40, s: 'IMK', t: 'IMK (2026)' }, { v: 50, s: 'DIW', t: 'DIW aktuell' }, { v: 100, s: 'DWE', t: 'Gesetzentwurf der Initiative' }] },
    { key: 'laufzeitEK', url: 'nek', label: 'Laufzeit Eigenkapital-Kredit', unit: 'Jahre', min: 10, max: 100, step: 1, nmin: 1, nmax: 150, nstep: 1, dec: 0,
      marks: [{ v: 40, s: 'IMK', t: 'IMK (2026)' }, { v: 50, s: 'DIW', t: 'DIW aktuell' }] },
    { key: 'tilgung', type: 'tilgung', url: 't', label: 'Tilgung' },
    { key: 'bestand', type: 'bestand', label: 'Bestand' },
    { key: 'bewirtschaftung', url: 'b', label: 'Bewirtschaftungskosten', unit: '€/m²', minDec: 2, min: 2, max: 6, step: 0.01, nmin: 0, nmax: 15, nstep: 0.01, dec: 2,
      hint: 'Je m² und Monat im ersten Jahr: Instandhaltung, Modernisierung, Verwaltung, Mietausfall, nicht umlagefähige Betriebskosten.',
      marks: [
        { v: 2.94, s: 'Holm Basis', t: 'Holm et al. (2025), Tab. 4' },
        { v: 3.66, s: 'IMK', t: 'IMK (2026): Instandhaltung und Modernisierung 2,70 € (Rechnungshof, fortgeschrieben) + 0,52 + 0,14 + 0,30' },
        { v: 3.73, s: 'LWU (Standard)', t: 'Holm et al. (2025), Tab. 5, landeseigene Unternehmen: 1,77 + 1,00 + 0,52 + 0,14 + 0,30' },
        { v: 4.40, s: 'IW Köln', t: 'IW Köln (2026): realistischere Modernisierungskosten (13–25 statt 6–12 €/m² im Jahr)' },
        { v: 4.44, s: 'Holm Plus', t: 'Holm et al. (2025), Tab. 6: erhöhte Instandsetzung' }
      ] },
    { key: 'kostensteigerung', url: 'gb', pct: true, label: 'Kostensteigerung pro Jahr', unit: '%', min: 0, max: 4, step: 0.1, nmin: -2, nmax: 8, nstep: 0.1, dec: 1,
      marks: [{ v: 0, s: 'konstant', t: 'Konstante Kosten, wie in Tabelle 2 des DIW aktuell' }, { v: 0.02, s: 'Holm et al.', t: 'Holm et al. (2025): inflationsbedingt 2 % pro Jahr' }] },
    { key: 'horizont', url: 'h', label: 'Betrachtungszeitraum', unit: 'Jahre', min: 10, max: 100, step: 1, nmin: 1, nmax: 100, nstep: 1, dec: 0,
      marks: [{ v: 40, s: 'IMK', t: 'IMK (2026)' }, { v: 50, s: 'DIW', t: 'DIW aktuell' }, { v: 100, s: 'DWE', t: 'Laufzeit im Gesetzentwurf der Initiative' }] }
  ];

  var ADVANCED = ['ekQuote', 'laufzeitEK', 'laufzeitFK', 'tilgung', 'wohnungen', 'flaecheJeWohnung', 'bewirtschaftung', 'horizont'];

  var BESTAND = [
    { id: 'rh', w: 240000, a: 61, label: '240.000 Wohnungen à 61 m² (Rechnungshof, Holm et al.)' },
    { id: 'imk', w: 210000, a: 63, label: '210.000 Wohnungen à 63 m² (IMK, DWE-Entwurf)' },
    { id: 'frei', label: 'eigene Angaben' }
  ];

  // ------------------------------------------------------------------ Voreinstellungen
  var DWE_TEXT = '<p><strong>Gesetzentwurf der Initiative:</strong> Die bisherigen Eigentümer erhalten statt Geld übertragbare Schuldverschreibungen der Anstalt „Gemeingut Wohnen“, verzinst mit 3,5 % und über 100 Jahre mit konstanter Annuität getilgt; das Land haftet. Liegt der Marktzins über 3,5 %, notieren die Papiere unter dem Nennwert. Die niedrigen Finanzierungskosten gehen dann teilweise zulasten der Entschädigung (und erhöhen das Rechtsrisiko).</p>';
  var PRESETS_UI = [
    { id: 'standard', label: 'Standard', over: {},
      note: '<p><strong>Standard:</strong> Annahmen des DIW aktuell (Zinsen 4 % für das Land und 5 % für die Anstalt, 20 % Eigenkapital, 50 Jahre Laufzeit) mit der Dynamik nach Holm et al. (2025): Mieten +1 %, Kosten +2 % pro Jahr. Weil die Kosten schneller steigen als die Mieten, wächst die Belastung mit der Zeit.</p>' },
    { id: 't2a', label: 'DIW Tabelle 2a', over: { mietsteigerung: 0, kostensteigerung: 0 },
      note: '<p><strong>DIW aktuell, Tabelle 2a:</strong> Zinsen 4 % / 5 %, Miete und Kosten konstant. Die Belastung ist dann in jedem Jahr gleich hoch.</p>' },
    { id: 't2b', label: 'DIW Tabelle 2b (Zinsen +1 Pp.)', over: { zinsEK: 0.05, zinsFK: 0.06, mietsteigerung: 0, kostensteigerung: 0 },
      note: '<p><strong>DIW aktuell, Tabelle 2b:</strong> Zinsen 1 Prozentpunkt höher (5 % / 6 %). Die Belastung steigt je nach Entschädigung um 70 bis 250 Mio. € pro Jahr.</p>' },
    { id: 'imk', label: 'IMK (rekonstruiert)', over: { entschaedigungMrd: 13.5, wohnungen: 210000, flaecheJeWohnung: 63, miete: 7.08, bewirtschaftung: 3.66, ekQuote: 0.3,
      zinsEK: 0.015, zinsFK: 0.02, laufzeitEK: 40, laufzeitFK: 40, horizont: 40, mietsteigerung: 0, kostensteigerung: 0 },
      note: '<p><strong>IMK Policy Brief 225 (rekonstruiert):</strong> Das IMK nennt keinen Zinssatz, nur den Kapitaldienst (345 Mio. € für 9,5 Mrd. € Fremdkapital, 135 Mio. € für 4 Mrd. € Eigenkapital). Rechnerisch entspricht das einer 40-jährigen Annuität zu rund 2,0 bzw. 1,5 % – plausibel nur als realer Zins – oder reiner Verzinsung zu rund 3,6 bzw. 3,4 % ohne Tilgung. Finanziert die Anstalt nominal zu heutigen Marktzinsen, entsteht im ersten Jahr ein Defizit von rund 260 Mio. €. Die IMK-Miete von 7,08 € liegt rund 15 % unter dem geschätzten heutigen Niveau in den Beständen (≈ 8,30 €).</p>' },
    { id: 'dwe', label: 'DWE-Anleihemodell', over: { ekQuote: 0, zinsFK: 0.035, laufzeitFK: 100, horizont: 100 }, note: DWE_TEXT, kurs: true }
  ];

  // ------------------------------------------------------------------ Zustand
  var p = {};
  function standard() { var s = {}; for (var k in STANDARD) s[k] = STANDARD[k]; return s; }
  function presetState(pr) { var s = standard(); for (var k in pr.over) s[k] = pr.over[k]; return s; }
  var KEYS = ['entschaedigungMrd', 'wohnungen', 'flaecheJeWohnung', 'miete', 'mietsteigerung', 'bewirtschaftung', 'kostensteigerung',
    'ekQuote', 'zinsEK', 'zinsFK', 'laufzeitEK', 'laufzeitFK', 'tilgung', 'horizont'];
  function same(a, b) {
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i];
      if (typeof a[k] === 'number') { if (Math.abs(a[k] - b[k]) > 1e-9) return false; } else if (a[k] !== b[k]) return false;
    }
    return true;
  }
  function ctl(key) { for (var i = 0; i < CONTROLS.length; i++) if (CONTROLS[i].key === key) return CONTROLS[i]; }

  // ------------------------------------------------------------------ URL
  function readUrl() {
    var q = new URLSearchParams(location.search);
    CONTROLS.forEach(function (c) {
      if (!c.url || !q.has(c.url)) return;
      if (c.type === 'tilgung') { p.tilgung = q.get('t') === 'z' ? 'nurZinsen' : 'annuitaet'; return; }
      var v = parseFloat(String(q.get(c.url)).replace(',', '.'));
      if (!isFinite(v)) return;
      if (c.pct) v = v / 100;
      p[c.key] = clampCtl(c, v);
    });
    var w = parseFloat(q.get('w')), a = parseFloat(q.get('a'));
    if (isFinite(w) && w > 0) p.wohnungen = Math.round(w);
    if (isFinite(a) && a > 0) p.flaecheJeWohnung = a;
  }
  var urlTimer = null;
  function writeUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      var s = standard(), q = new URLSearchParams();
      CONTROLS.forEach(function (c) {
        if (!c.url) return;
        if (c.type === 'tilgung') { if (p.tilgung !== s.tilgung) q.set('t', p.tilgung === 'nurZinsen' ? 'z' : 'a'); return; }
        if (Math.abs(p[c.key] - s[c.key]) > 1e-9) q.set(c.url, String(+(c.pct ? p[c.key] * 100 : p[c.key]).toFixed(4)));
      });
      if (p.wohnungen !== s.wohnungen) q.set('w', p.wohnungen);
      if (p.flaecheJeWohnung !== s.flaecheJeWohnung) q.set('a', p.flaecheJeWohnung);
      var qs = q.toString();
      try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) { /* z. B. file:// */ }
    }, 250);
  }

  // ------------------------------------------------------------------ Eingabeelemente bauen
  function clampCtl(c, v) {
    var lo = c.pct ? c.nmin / 100 : c.nmin, hi = c.pct ? c.nmax / 100 : c.nmax;
    return Math.min(hi, Math.max(lo, v));
  }
  function disp(c, v) { return c.pct ? v * 100 : v; }

  function buildControls() {
    var main = $('vgr-main-controls'), more = $('vgr-more-controls');
    CONTROLS.forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'ctl';
      var id = 'vgr-' + (c.url || c.key);
      if (c.type === 'tilgung') {
        el.innerHTML = '<span class="lbl" id="' + id + '-lbl">Tilgung</span>' +
          '<p class="hint">Annuität: Kredite werden über die Laufzeit vollständig getilgt. Nur Zinsen: Kredite werden dauerhaft verlängert, die Schuld bleibt bestehen.</p>' +
          '<div class="seg" role="radiogroup" aria-labelledby="' + id + '-lbl">' +
          '<label><input type="radio" name="vgr-tilgung" value="annuitaet"> Annuität</label>' +
          '<label><input type="radio" name="vgr-tilgung" value="nurZinsen"> nur Zinsen</label></div>';
        el.addEventListener('change', function (e) { p.tilgung = e.target.value; update(); });
      } else if (c.type === 'bestand') {
        el.innerHTML = '<label for="vgr-bestand">Bestand</label>' +
          '<p class="hint">Betroffen sind Unternehmen mit mehr als 3.000 Wohnungen in Berlin.</p>' +
          '<select id="vgr-bestand">' + BESTAND.map(function (b) { return '<option value="' + b.id + '">' + esc(b.label) + '</option>'; }).join('') + '</select>' +
          '<div class="pair"><span class="valbox"><label for="vgr-w">Wohnungen</label><input id="vgr-w" type="text" inputmode="numeric" autocomplete="off"></span>' +
          '<span class="valbox"><label for="vgr-a">m² je Wohnung</label><input id="vgr-a" type="text" inputmode="decimal" autocomplete="off"></span></div>';
        el.querySelector('select').addEventListener('change', function (e) {
          var b = BESTAND.filter(function (x) { return x.id === e.target.value; })[0];
          if (b && b.w) { p.wohnungen = b.w; p.flaecheJeWohnung = b.a; update(); }
        });
        el.querySelector('#vgr-w').addEventListener('change', function (e) { var v = parseDe(e.target.value); if (v >= 1000) { p.wohnungen = Math.round(v); } update(); });
        el.querySelector('#vgr-a').addEventListener('change', function (e) { var v = parseDe(e.target.value); if (v >= 10) { p.flaecheJeWohnung = v; } update(); });
      } else {
        var marks = (c.marks || []).map(function (m, i) {
          return '<button type="button" class="mark" data-i="' + i + '" title="' + esc(m.t) + '" aria-label="' + esc(nf(disp(c, m.v), c.dec) + ' ' + c.unit + ': ' + m.t) + '"><b>' +
            nf(disp(c, m.v), markDec(c, m.v)) + '</b> ' + esc(m.s) + '</button>';
        }).join('');
        el.innerHTML = '<div class="ctl-head"><label for="' + id + '">' + esc(c.label) + '</label>' +
          '<span class="valbox"><input id="' + id + '-n" type="text" inputmode="decimal" autocomplete="off" aria-label=""' + esc(c.label + ' in ' + c.unit) + '">' + esc(c.unit) + '</span></div>' +
          (c.hint ? '<p class="hint">' + esc(c.hint) + '</p>' : '') +
          '<input type="range" id="' + id + '" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '">' +
          (marks ? '<div class="marks" aria-label="Werte aus der Debatte">' + marks + '</div>' : '');
        var range = el.querySelector('input[type=range]'), num = el.querySelector('input[type=text]');
        range.addEventListener('input', function () { p[c.key] = c.pct ? parseFloat(range.value) / 100 : parseFloat(range.value); update(range); });
        num.addEventListener('keydown', function (e) { if (e.key === 'Enter') num.blur(); });
        num.addEventListener('change', function () {
          var v = parseDe(num.value);
          if (isFinite(v)) p[c.key] = clampCtl(c, c.pct ? v / 100 : v);
          if (c.key === 'laufzeitEK' || c.key === 'laufzeitFK' || c.key === 'horizont') p[c.key] = Math.round(p[c.key]);
          update();
        });
        el.querySelectorAll('.mark').forEach(function (b) {
          b.addEventListener('click', function () { p[c.key] = c.marks[+b.dataset.i].v; update(); });
        });
        c.range = range; c.num = num; c.el = el;
      }
      (c.main ? main : more).appendChild(el);
    });
  }
  function markDec(c, v) {
    var d = disp(c, v);
    if (Math.abs(d - Math.round(d)) < 1e-9) return 0;
    if (Math.abs(d * 10 - Math.round(d * 10)) < 1e-9) return 1;
    return 2;
  }

  function syncControls(skip) {
    CONTROLS.forEach(function (c) {
      if (c.type === 'tilgung') {
        document.querySelectorAll('input[name=vgr-tilgung]').forEach(function (r) { r.checked = r.value === p.tilgung; });
        return;
      }
      if (c.type === 'bestand') {
        var match = BESTAND.filter(function (b) { return b.w === p.wohnungen && b.a === p.flaecheJeWohnung; })[0];
        $('vgr-bestand').value = match ? match.id : 'frei';
        if (document.activeElement !== $('vgr-w')) $('vgr-w').value = nfIn(p.wohnungen, 0);
        if (document.activeElement !== $('vgr-a')) $('vgr-a').value = nfIn(p.flaecheJeWohnung, 1);
        return;
      }
      var v = disp(c, p[c.key]);
      if (c.range !== skip) c.range.value = v;
      c.range.setAttribute('aria-valuetext', nf(v, c.dec) + ' ' + c.unit);
      if (document.activeElement !== c.num) c.num.value = nfIn(v, c.dec, c.minDec);
      c.el.querySelectorAll('.mark').forEach(function (b) {
        b.classList.toggle('is-on', Math.abs(c.marks[+b.dataset.i].v - p[c.key]) < 1e-9);
      });
    });
  }

  // ------------------------------------------------------------------ Voreinstellungen
  function buildPresets() {
    var box = $('vgr-presets');
    box.style.display = 'contents';
    PRESETS_UI.forEach(function (pr) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'preset'; b.textContent = pr.label; b.dataset.id = pr.id;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        p = presetState(pr); update();
        if (ADVANCED.some(function (k) { return p[k] !== STANDARD[k]; })) $('vgr-more').open = true;
      });
      box.appendChild(b);
    });
  }
  function activePreset() {
    for (var i = 0; i < PRESETS_UI.length; i++) if (same(p, presetState(PRESETS_UI[i]))) return PRESETS_UI[i];
    return null;
  }
  function kurswert(rMarkt) {
    // Barwert der Zahlungen auf 1 € Nennwert (Annuität bzw. ewige Verzinsung) zur Marktrendite
    if (p.tilgung === 'nurZinsen') return p.zinsFK / rMarkt;
    return annuitaetenfaktor(p.zinsFK, p.laufzeitFK) / annuitaetenfaktor(rMarkt, p.laufzeitFK);
  }
  function renderPresetNote(pr) {
    document.querySelectorAll('.preset').forEach(function (b) { b.setAttribute('aria-pressed', pr && b.dataset.id === pr.id ? 'true' : 'false'); });
    var note = $('vgr-preset-note');
    if (!pr) { note.hidden = true; return; }
    var html = pr.note;
    if (pr.kurs) {
      var rs = [p.zinsFK, 0.04, 0.041, 0.045, 0.05].filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
      html += '<div class="tbl-wrap"><table style="max-width:26rem"><tr><th>Marktrendite</th><th>Kurswert der Entschädigung</th></tr>' +
        rs.map(function (r) { return '<tr><td>' + pct(r, 1) + '</td><td>' + pct(kurswert(r), 0) + ' des Nennwerts</td></tr>'; }).join('') + '</table></div>';
    }
    note.innerHTML = html;
    note.hidden = false;
  }

  // ------------------------------------------------------------------ Ergebnis
  var res = null, view = 'jahr', matrixUnit = 'mio';

  function update(skipEl) {
    res = berechne(p);
    syncControls(skipEl);
    renderPresetNote(activePreset());
    renderHero();
    renderTiles();
    drawChart();
    renderYearTable();
    renderMatrix();
    writeUrl();
  }

  function kdFaktor() {
    var fEK = p.tilgung === 'nurZinsen' ? p.zinsEK : annuitaetenfaktor(p.zinsEK, p.laufzeitEK);
    var fFK = p.tilgung === 'nurZinsen' ? p.zinsFK : annuitaetenfaktor(p.zinsFK, p.laufzeitFK);
    return p.ekQuote * fEK + (1 - p.ekQuote) * fFK;
  }

  function renderHero() {
    var j = res.jahr1, B = j.belastung / 1e6;
    var zus = B > 0.5, ueb = B < -0.5;
    $('vgr-hero').classList.toggle('is-ueberschuss', !zus);
    $('vgr-hero-value').innerHTML = esc(sf(B, 0)) + '<span class="hero-unit">Mio. € pro Jahr</span>';
    $('vgr-hero-tag').textContent = zus ? 'Zuschuss' : (ueb ? 'Überschuss' : 'ausgeglichen');
    $('vgr-hero-qm').textContent = sf(j.belastungJeQmMonat, 2) + ' €';
    $('vgr-hero-we').textContent = sf(j.belastungJeWohnungMonat, 0) + ' €';
    $('vgr-mini-v').textContent = sf(B, 0) + ' Mio. € pro Jahr';
    $('vgr-mini-t').textContent = zus ? 'Zuschuss' : (ueb ? 'Überschuss' : 'ausgeglichen');
    $('vgr-mini').classList.toggle('is-ueberschuss', !zus);
    $('vgr-br-rein').textContent = geld(j.reinertrag / 1e6);
    $('vgr-br-land').textContent = geld(j.kapitaldienstLand / 1e6);
    $('vgr-br-aoer').textContent = geld(j.kapitaldienstAnstalt / 1e6);

    // Einordnung
    var H = HAUSHALT, txt;
    if (zus) {
      var lo = j.belastung / H.schuldenbremseSpielraumMax, hi = j.belastung / H.schuldenbremseSpielraumMin;
      var spiel = hi < 1
        ? 'Davon würde die Belastung ' + pct(lo, 0).replace(' %', '') + ' bis ' + pct(hi, 0) + ' binden.'
        : (lo >= 1 ? 'Die Belastung wäre das ' + nf(lo, 1) + '- bis ' + nf(hi, 1) + '-Fache davon.' : 'Die Belastung würde ihn ganz oder fast ganz aufbrauchen.');
      txt = 'Das entspricht <strong>' + pct(j.belastung / H.ausgaben2027) + '</strong> des Berliner Haushalts 2027, <strong>' +
        pct(j.belastung / H.finanzierungsdefizit2026) + '</strong> des Finanzierungsdefizits 2026 und <strong>' +
        pct(j.belastung / H.einzelplan10_2027) + '</strong> der Ausgaben für Bildung, Jugend und Familie (Einzelplan 10). ' +
        'Der jährliche Verschuldungsspielraum unter der Schuldenbremse beträgt etwa 675 bis 800 Mio. €. ' + spiel;
    } else {
      txt = 'Im ersten Jahr decken die Mieten Bewirtschaftung, Zins und Tilgung. ' +
        (ueb ? 'Es bleibt ein Überschuss von <strong>' + geld(-B) + '</strong>, der an das Land fließen kann.' : '');
    }
    var later = null;
    for (var t = 1; t < res.jahre.length; t++) if ((res.jahre[t].belastung > 0) !== (res.jahre[0].belastung > 0)) { later = res.jahre[t]; break; }
    if (later && later.belastung > 0) txt += ' Weil die Kosten schneller steigen als die Mieten, sind <strong>ab Jahr ' + later.jahr + '</strong> Zuschüsse nötig.';
    if (later && later.belastung <= 0) txt += ' Weil die Mieten schneller steigen als die Kosten, ist <strong>ab Jahr ' + later.jahr + '</strong> kein Zuschuss mehr nötig.';
    $('vgr-context').innerHTML = nb(txt);

    // Break-even
    var f = kdFaktor(), rein = j.reinertrag;
    var emax = rein > 0 ? rein / f / 1e9 : 0;
    var mmin = p.bewirtschaftung + j.kapitaldienst / res.flaeche / 12;
    var be = '<p>';
    if (rein > 0) {
      be += 'Bei diesen Zinsen und einer Miete von ' + nf(p.miete, 2) + ' € trägt sich im ersten Jahr eine Entschädigung von höchstens <strong>' + nf(emax, 1) + ' Mrd. €</strong>. ';
    } else {
      be += 'Bei einer Miete von ' + nf(p.miete, 2) + ' € decken die Mieten nicht einmal die Bewirtschaftungskosten – jede Entschädigung muss vollständig aus dem Haushalt bedient werden. ';
    }
    be += 'Bei einer Entschädigung von ' + nf(p.entschaedigungMrd, 1) + ' Mrd. € ist mindestens eine Miete von <strong>' + nf(mmin, 2) + ' €</strong> je m² nötig, damit im ersten Jahr kein Zuschuss anfällt';
    be += mmin > p.miete ? ' – ' + nf(mmin - p.miete, 2) + ' € mehr als angenommen.' : '.';
    if (p.kostensteigerung > p.mietsteigerung) be += ' Da die Kosten schneller steigen als die Mieten, reicht das nur im ersten Jahr.';
    be += '</p>';
    $('vgr-breakeven').innerHTML = nb(be);
  }

  function renderTiles() {
    var H = res.jahre.length, last = res.jahre[H - 1];
    var mit = res.jahre.filter(function (j) { return j.belastung > 0; });
    var lastMit = mit.length ? mit[mit.length - 1].jahr : 0;
    var dauerhaft = !mit.length ? 'von Anfang an ohne Zuschuss' : (lastMit >= H ? 'bis zum Ende des Zeitraums' : 'ab Jahr ' + (lastMit + 1) + ' dauerhaft ohne Zuschuss');
    var d = (p.diskontsatz === null || p.diskontsatz === undefined) ? p.zinsEK : p.diskontsatz;
    var tiles = [
      ['Summe der Zuschüsse in ' + H + ' Jahren', geld(res.summeZuschuesse / 1e6), Math.abs(res.summeNetto - res.summeZuschuesse) > 5e5 ? 'nominal; netto nach Überschüssen ' + geld(res.summeNetto / 1e6, true) : 'nominal, nicht abgezinst'],
      ['Barwert der Belastungen', geld(res.barwert / 1e6, true), 'abgezinst mit ' + pct(d, 1)],
      ['Belastung im Jahr ' + H, geld(last.belastung / 1e6, true), sf(last.belastungJeQmMonat, 2) + ' € je m² und Monat'],
      ['Höchstes aufgelaufenes Defizit', geld(res.maxKumuliertesDefizit / 1e6), 'Summe der Belastungen bis zum Höchststand'],
      ['Jahre mit Zuschuss', mit.length + ' von ' + H, dauerhaft],
      ['Eigenkapital des Landes', geld(res.eigenkapital / 1e6), '+' + pct(res.eigenkapital / HAUSHALT.schuldenstand) + ' Schuldenstand (≈ 69 Mrd. €)'],
      ['Kredite der Anstalt', geld(res.fremdkapital / 1e6), 'außerhalb des Landeshaushalts'],
      ['Restschuld nach ' + H + ' Jahren', geld(last.restschuld / 1e6), p.tilgung === 'nurZinsen' ? 'Kredite werden nicht getilgt' : 'Land und Anstalt']
    ];
    $('vgr-tiles').innerHTML = tiles.map(function (t) {
      return '<div class="tile"><div class="k">' + esc(t[0]) + '</div><div class="v num">' + esc(t[1]) + '</div><div class="s">' + esc(t[2]) + '</div></div>';
    }).join('');
  }

  // ------------------------------------------------------------------ Diagramm (SVG, ohne Bibliothek)
  function niceTicks(lo, hi, n) {
    if (lo === hi) { lo -= 1; hi += 1; }
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / n)));
    var err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var t0 = Math.floor(lo / step) * step, t1 = Math.ceil(hi / step) * step, out = [];
    for (var v = t0; v <= t1 + step / 2; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : v);
    return out;
  }
  function svgEl(name, attrs, parent) {
    var e = document.createElementNS(SVG_NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function barPath(x, w, y0, y1, r) {
    // rundes Ende an der Datenseite, eckig an der Nulllinie
    var up = y1 < y0, h = Math.abs(y1 - y0);
    r = Math.min(r, w / 2, h);
    if (h < 0.5) return '';
    if (up) return 'M' + x + ',' + y0 + 'V' + (y1 + r) + 'Q' + x + ',' + y1 + ' ' + (x + r) + ',' + y1 + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y1 + ' ' + (x + w) + ',' + (y1 + r) + 'V' + y0 + 'Z';
    return 'M' + x + ',' + y0 + 'V' + (y1 - r) + 'Q' + x + ',' + y1 + ' ' + (x + r) + ',' + y1 + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y1 + ' ' + (x + w) + ',' + (y1 - r) + 'V' + y0 + 'Z';
  }

  function chartData() {
    var J = res.jahre;
    if (view === 'qm') {
      return {
        kind: 'lines',
        title: 'Miete und Kosten je m² und Monat',
        sub: 'Kosten = Bewirtschaftung + Kapitaldienst (Zins und Tilgung). Liegen die Kosten über der Miete, muss der Haushalt die Lücke schließen.',
        unit: '€',
        series: [
          { name: 'Miete', color: COL.ueberschuss, values: J.map(function (j) { return j.miete; }) },
          { name: 'Kosten', color: COL.zuschuss, values: J.map(function (j) { return j.bewirtschaftungJeQm + j.kapitaldienst / res.flaeche / 12; }) }
        ],
        fmtTick: function (v) { return nf(v, v % 1 ? 1 : 0); }
      };
    }
    var kum = view === 'kum';
    return {
      kind: 'bars',
      title: kum ? 'Aufgelaufene Belastung' : 'Jährliche Belastung des Landeshaushalts',
      sub: kum ? 'Summe der Zuschüsse (positiv) und Überschüsse (negativ) bis zum jeweiligen Jahr, in Mrd. €, nominal.' : 'Mio. € pro Jahr, nominal. Positiv: Zuschuss aus dem Landeshaushalt; negativ: Überschuss.',
      unit: kum ? 'Mrd. €' : 'Mio. €',
      values: J.map(function (j) { return kum ? j.kumuliert / 1e9 : j.belastung / 1e6; }),
      fmtTick: function (v) { return kum ? nf(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) : nf(v, 0); }
    };
  }

  function drawChart() {
    var box = $('vgr-chart'), tip = $('vgr-tooltip');
    var old = box.querySelector('svg'); if (old) box.removeChild(old);
    var D = chartData(), J = res.jahre, n = J.length;
    $('vgr-chart-title').textContent = D.title;
    $('vgr-chart-sub').textContent = D.sub;
    $('vgr-legend').innerHTML = D.kind === 'bars'
      ? '<span><i style="background:' + COL.zuschuss + '"></i>Zuschuss</span><span><i style="background:' + COL.ueberschuss + '"></i>Überschuss</span>'
      : D.series.map(function (s) { return '<span><i class="line" style="background:' + s.color + '"></i>' + s.name + '</span>'; }).join('');

    var W = Math.max(300, box.clientWidth || 600), Hh = Math.round(Math.min(340, Math.max(220, W * 0.45)));
    var m = { l: 46, r: D.kind === 'lines' ? 92 : 14, t: 26, b: 28 };
    var pw = W - m.l - m.r, ph = Hh - m.t - m.b;
    var all = D.kind === 'bars' ? D.values : D.series[0].values.concat(D.series[1].values);
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (D.kind === 'bars') { lo = Math.min(0, lo); hi = Math.max(0, hi); } else { lo = Math.min(0, lo); }
    var ticks = niceTicks(lo, hi, 5); lo = ticks[0]; hi = ticks[ticks.length - 1];
    var y = function (v) { return m.t + ph - (v - lo) / (hi - lo) * ph; };
    var band = pw / n, xc = function (i) { return m.l + band * (i + 0.5); };

    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': chartSummary(D) });
    // Gitter und Achsen
    ticks.forEach(function (t) {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), 'class': t === 0 ? 'zero' : 'grid' }, svg);
      var tx = svgEl('text', { x: m.l - 6, y: y(t) + 3.5, 'text-anchor': 'end' }, svg); tx.textContent = D.fmtTick(t);
    });
    var stepYears = n <= 20 ? 2 : n <= 50 ? 10 : 20;
    for (var i = 0; i < n; i++) {
      var yr = i + 1;
      if ((yr === 1 || yr % stepYears === 0) && (n - yr >= stepYears / 2 || yr === n || n < 10)) {
        var tx2 = svgEl('text', { x: xc(i), y: Hh - 8, 'text-anchor': 'middle' }, svg); tx2.textContent = yr;
      }
    }
    var ul = svgEl('text', { x: 0, y: 10, 'text-anchor': 'start' }, svg); ul.textContent = D.unit;


    var hl = svgEl('line', { x1: 0, x2: 0, y1: m.t, y2: m.t + ph, stroke: COL.hover, 'stroke-width': 1, opacity: 0 }, svg);

    if (D.kind === 'bars') {
      var bw = Math.max(1, Math.min(24, band - 2)), r = 4;
      D.values.forEach(function (v, i) {
        var d = barPath(xc(i) - bw / 2, bw, y(0), y(v), r);
        if (d) svgEl('path', { d: d, fill: v > 0 ? COL.zuschuss : COL.ueberschuss }, svg);
      });
      // Direktbeschriftung: letztes Jahr
      var lv = D.values[n - 1], lt = svgEl('text', { x: Math.min(xc(n - 1), W - m.r), y: lv >= 0 ? y(lv) - 6 : y(lv) + 14, 'text-anchor': 'end', style: 'fill:#1f2623;font-weight:600' }, svg);
      lt.textContent = (n > 1 ? 'Jahr ' + n + ': ' : '') + sf(lv, view === 'kum' ? 1 : 0);
    } else {
      var s0 = D.series[0].values, s1 = D.series[1].values;
      for (var k = 0; k < n - 1; k++) {
        var gap = (s1[k] - s0[k]) + (s1[k + 1] - s0[k + 1]);
        svgEl('polygon', {
          points: [xc(k), y(s0[k]), xc(k + 1), y(s0[k + 1]), xc(k + 1), y(s1[k + 1]), xc(k), y(s1[k])].join(' '),
          fill: gap > 0 ? COL.zuschuss : COL.ueberschuss, opacity: 0.12
        }, svg);
      }
      D.series.forEach(function (s) {
        var pts = s.values.map(function (v, i) { return xc(i) + ',' + y(v); }).join(' ');
        if (n === 1) svgEl('circle', { cx: xc(0), cy: y(s.values[0]), r: 4, fill: s.color }, svg);
        else svgEl('polyline', { points: pts, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      });
      // Endbeschriftung mit Abstand, falls nah beieinander
      var e0 = y(s0[n - 1]), e1 = y(s1[n - 1]);
      if (Math.abs(e0 - e1) < 14) { var mid = (e0 + e1) / 2; if (e0 <= e1) { e0 = mid - 7; e1 = mid + 7; } else { e0 = mid + 7; e1 = mid - 7; } }
      [[D.series[0], e0, s0[n - 1]], [D.series[1], e1, s1[n - 1]]].forEach(function (a) {
        var t = svgEl('text', { x: W - m.r + 8, y: a[1] + 4, style: 'fill:#1f2623' }, svg);
        t.textContent = a[0].name + ' ' + nf(a[2], 2) + ' €';
      });
    }

    // Hover-Schicht
    var hit = svgEl('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent', style: 'cursor:crosshair' }, svg);
    function show(evt) {
      var rect = svg.getBoundingClientRect(), scale = W / rect.width;
      var px = (evt.clientX - rect.left) * scale;
      var i = Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / band)));
      var j = J[i];
      hl.setAttribute('x1', xc(i)); hl.setAttribute('x2', xc(i)); hl.setAttribute('opacity', 0.35);
      var rows;
      if (D.kind === 'bars') {
        rows = [
          ['Belastung', geld(j.belastung / 1e6, true)],
          ['aufgelaufen', geld(j.kumuliert / 1e6, true)],
          ['Reinertrag', geld(j.reinertrag / 1e6)],
          ['Kapitaldienst', geld(j.kapitaldienst / 1e6)]
        ];
      } else {
        rows = [
          ['<span class="sw" style="background:' + COL.ueberschuss + '"></span>Miete', nf(j.miete, 2) + ' €'],
          ['<span class="sw" style="background:' + COL.zuschuss + '"></span>Kosten', nf(j.bewirtschaftungJeQm + j.kapitaldienst / res.flaeche / 12, 2) + ' €'],
          ['davon Bewirtschaftung', nf(j.bewirtschaftungJeQm, 2) + ' €'],
          ['Belastung je m²', sf(j.belastungJeQmMonat, 2) + ' €']
        ];
      }
      tip.innerHTML = '<div class="t">Jahr ' + j.jahr + '</div>' + rows.map(function (r) { return '<div class="r"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('');
      tip.hidden = false;
      var bx = box.getBoundingClientRect(), tx = evt.clientX - bx.left + 14, ty = evt.clientY - bx.top - 10;
      if (tx + tip.offsetWidth > bx.width) tx = evt.clientX - bx.left - tip.offsetWidth - 14;
      tip.style.left = Math.max(0, tx) + 'px'; tip.style.top = Math.max(0, ty) + 'px';
    }
    function hide() { tip.hidden = true; hl.setAttribute('opacity', 0); }
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide);
    box.insertBefore(svg, tip);
  }
  function chartSummary(D) {
    var J = res.jahre, n = J.length;
    if (D.kind === 'lines') return 'Liniendiagramm: Miete steigt von ' + nf(J[0].miete, 2) + ' € auf ' + nf(J[n - 1].miete, 2) + ' € je m² und Monat; die Kosten liegen im ersten Jahr bei ' +
      nf(J[0].bewirtschaftungJeQm + J[0].kapitaldienst / res.flaeche / 12, 2) + ' €. Alle Werte in der Tabelle unter dem Diagramm.';
    return 'Säulendiagramm über ' + n + ' Jahre: Belastung im ersten Jahr ' + geld(J[0].belastung / 1e6, true) + ', im letzten Jahr ' + geld(J[n - 1].belastung / 1e6, true) +
      ', aufgelaufen ' + geld(J[n - 1].kumuliert / 1e6, true) + '. Alle Werte in der Tabelle unter dem Diagramm.';
  }

  function renderYearTable() {
    var rows = res.jahre.map(function (j) {
      return '<tr><td>' + j.jahr + '</td><td>' + nf(j.miete, 2) + '</td><td>' + nf(j.bewirtschaftungJeQm, 2) + '</td><td>' + nf(j.reinertrag / 1e6, 1) + '</td><td>' +
        nf(j.kapitaldienstLand / 1e6, 1) + '</td><td>' + nf(j.kapitaldienstAnstalt / 1e6, 1) + '</td><td>' + sf(j.belastung / 1e6, 1) + '</td><td>' + sf(j.belastungJeQmMonat, 2) +
        '</td><td>' + sf(j.kumuliert / 1e6, 0) + '</td><td>' + nf(j.restschuld / 1e6, 0) + '</td></tr>';
    }).join('');
    $('vgr-yeartable').innerHTML = '<table><thead><tr><th>Jahr</th><th>Miete €/m²</th><th>Bewirt. €/m²</th><th>Reinertrag Mio. €</th><th>KD Land Mio. €</th><th>KD Anstalt Mio. €</th>' +
      '<th>Belastung Mio. €</th><th>Belastung €/m²</th><th>Aufgelaufen Mio. €</th><th>Restschuld Mio. €</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  // ------------------------------------------------------------------ Matrix (wie Tabelle 2)
  var M_E = [8, 11, 13.5, 21, 29, 36], M_M = [4.04, 6, 7, 8, 9];
  function withCur(list, v) { var l = list.slice(); if (!l.some(function (x) { return Math.abs(x - v) < 1e-9; })) l.push(v); return l.sort(function (a, b) { return a - b; }); }
  function renderMatrix() {
    var Es = withCur(M_E, p.entschaedigungMrd), Ms = withCur(M_M, p.miete);
    var head = '<thead><tr><th scope="col">Entschädigung \\ Miete</th>' + Ms.map(function (mm) { return '<th scope="col">' + nf(mm, 2) + ' €</th>'; }).join('') + '</tr></thead>';
    var body = Es.map(function (e) {
      return '<tr><th scope="row">' + nf(e, e % 1 ? 1 : 0) + ' Mrd. €</th>' + Ms.map(function (mm) {
        var q = {}; for (var k in p) q[k] = p[k];
        q.entschaedigungMrd = e; q.miete = mm; q.horizont = 1;
        var j = berechne(q).jahr1, v = matrixUnit === 'mio' ? j.belastung / 1e6 : j.belastungJeQmMonat;
        var d = matrixUnit === 'mio' ? 0 : 2, txt = sf(v, d);
        var cls = clean(v, d) > 0 ? 'pos' : (clean(v, d) < 0 ? 'neg' : '');
        if (Math.abs(e - p.entschaedigungMrd) < 1e-9 && Math.abs(mm - p.miete) < 1e-9) cls += ' cur';
        return '<td class="' + cls + '"><button type="button" data-e="' + e + '" data-m="' + mm + '" aria-label="' + esc(nf(e, 1) + ' Mrd. € Entschädigung, ' + nf(mm, 2) + ' € Miete: ' + txt + (matrixUnit === 'mio' ? ' Mio. €' : ' € je m²')) + '">' + txt + '</button></td>';
      }).join('') + '</tr>';
    }).join('');
    $('vgr-matrix').innerHTML = head + '<tbody>' + body + '</tbody>';
    $('vgr-matrix-params').textContent = 'Zins Land ' + pct(p.zinsEK, 1) + ', Zins Anstalt ' + pct(p.zinsFK, 1) + ', Eigenkapital ' + pct(p.ekQuote, 0) +
      ', Laufzeit ' + p.laufzeitFK + ' Jahre, Bewirtschaftung ' + nf(p.bewirtschaftung, 2) + ' €/m²';
  }

  // ------------------------------------------------------------------ Downloads
  function csv() {
    writeUrlNow();
    var c = function (x, d) { return nf(x, d).replace(/ |\./g, '').replace('−', '-'); };
    var L = [];
    L.push('Was kostet die Vergesellschaftung den Berliner Haushalt? – Rechnung mit diesen Annahmen');
    L.push('Quelle;' + location.href);
    L.push('');
    CONTROLS.forEach(function (k) {
      if (k.type === 'tilgung') { L.push('Tilgung;' + (p.tilgung === 'nurZinsen' ? 'nur Zinsen' : 'Annuität')); return; }
      if (k.type === 'bestand') { L.push('Wohnungen;' + p.wohnungen); L.push('m² je Wohnung;' + c(p.flaecheJeWohnung, 1)); return; }
      L.push(k.label + ' (' + k.unit + ');' + c(disp(k, p[k.key]), k.dec + 2));
    });
    L.push('');
    L.push(['Jahr', 'Miete €/m²/Monat', 'Bewirtschaftung €/m²/Monat', 'Mieteinnahmen Mio €', 'Bewirtschaftungskosten Mio €', 'Reinertrag Mio €', 'Kapitaldienst Land Mio €',
      'Kapitaldienst Anstalt Mio €', 'Belastung Mio €', 'Belastung €/m²/Monat', 'Belastung € je Wohnung/Monat', 'Aufgelaufen Mio €', 'Saldo Anstalt Mio €', 'Restschuld Mio €'].join(';'));
    res.jahre.forEach(function (j) {
      L.push([j.jahr, c(j.miete, 4), c(j.bewirtschaftungJeQm, 4), c(j.mieteinnahmen / 1e6, 3), c(j.bewirtschaftung / 1e6, 3), c(j.reinertrag / 1e6, 3), c(j.kapitaldienstLand / 1e6, 3),
        c(j.kapitaldienstAnstalt / 1e6, 3), c(j.belastung / 1e6, 3), c(j.belastungJeQmMonat, 4), c(j.belastungJeWohnungMonat, 2), c(j.kumuliert / 1e6, 3), c(j.saldoAnstalt / 1e6, 3), c(j.restschuld / 1e6, 3)].join(';'));
    });
    var blob = new Blob(['﻿' + L.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'Vergesellschaftung_Rechnung.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function copyLink() {
    clearTimeout(urlTimer);
    var done = function () { $('vgr-copied').textContent = 'Link kopiert'; setTimeout(function () { $('vgr-copied').textContent = ''; }, 2500); };
    writeUrlNow();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, function () { window.prompt('Link kopieren:', location.href); });
    else window.prompt('Link kopieren:', location.href);
  }
  function writeUrlNow() { writeUrl(); clearTimeout(urlTimer); /* sofort schreiben */
    var s = standard(), q = new URLSearchParams();
    CONTROLS.forEach(function (c) {
      if (!c.url) return;
      if (c.type === 'tilgung') { if (p.tilgung !== s.tilgung) q.set('t', p.tilgung === 'nurZinsen' ? 'z' : 'a'); return; }
      if (Math.abs(p[c.key] - s[c.key]) > 1e-9) q.set(c.url, String(+(c.pct ? p[c.key] * 100 : p[c.key]).toFixed(4)));
    });
    if (p.wohnungen !== s.wohnungen) q.set('w', p.wohnungen);
    if (p.flaecheJeWohnung !== s.flaecheJeWohnung) q.set('a', p.flaecheJeWohnung);
    var qs = q.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) { /* ignorieren */ }
  }

  // ------------------------------------------------------------------ Start
  function init() {
    if (typeof berechne !== 'function') return;
    p = standard();
    readUrl();
    buildPresets();
    buildControls();
    document.querySelectorAll('.vgr .chart-head [role=tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        view = b.dataset.view;
        document.querySelectorAll('.vgr .chart-head [role=tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        drawChart();
      });
    });
    document.querySelectorAll('#vgr-matrix-unit [role=tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        matrixUnit = b.dataset.unit;
        document.querySelectorAll('#vgr-matrix-unit [role=tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        renderMatrix();
      });
    });
    $('vgr-matrix').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      p.entschaedigungMrd = parseFloat(b.dataset.e); p.miete = parseFloat(b.dataset.m); update();
      $('vgr-hero').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('vgr-reset').addEventListener('click', function () { p = standard(); update(); });
    $('vgr-csv').addEventListener('click', csv);
    $('vgr-link').addEventListener('click', copyLink);
    if (ADVANCED.some(function (k) { return p[k] !== STANDARD[k]; })) $('vgr-more').open = true;
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) {
        var e = en[0];
        $('vgr-mini').classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top > 0);
      }).observe($('vgr-hero'));
      $('vgr-mini').addEventListener('click', function () { $('vgr-hero').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }
    if (window.ResizeObserver) {
      var lastW = 0;
      new ResizeObserver(function (en) { var w = Math.round(en[0].contentRect.width); if (w !== lastW && res) { lastW = w; drawChart(); } }).observe($('vgr-chart'));
    }
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
