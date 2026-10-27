/*
 * Rechenkern: Haushaltsbelastung einer Vergesellschaftung großer Berliner Wohnungsbestände
 * Grundlage: DIW aktuell Nr. 126 (Dany-Knedlik/Kholodilin/Kritikos/Kriwoluzky, 5.10.2026), Tabelle 2
 *
 * Reine Funktion ohne Abhängigkeiten. Läuft im Browser, in Node und in JXA.
 * Vorzeichen: positiv = Zuschuss aus dem Landeshaushalt, negativ = Überschuss.
 * Alle Beträge nominal in Euro, sofern nicht anders benannt.
 */

var STANDARD = {
  entschaedigungMrd: 13.5,     // Entschädigung in Mrd. €
  wohnungen: 240000,           // Zahl der Wohnungen (Rechnungshof 2024 / Holm et al. 2025)
  flaecheJeWohnung: 61,        // m² je Wohnung (Rechnungshof 2024)
  miete: 7.0,                  // Nettokaltmiete im ersten Jahr, €/m² und Monat
  mietsteigerung: 0.01,        // p.a. (Holm et al. 2025 Grundmodell; Linke: LWU-Mieterhöhungen max. 1 % p.a.)
  bewirtschaftung: 3.73,       // €/m² und Monat im ersten Jahr (Holm et al. 2025, Tab. 5, LWU)
  kostensteigerung: 0.02,      // p.a. (Holm et al. 2025)
  ekQuote: 0.2,                // Anteil Eigenkapital des Landes
  zinsEK: 0.04,                // Zins auf die Kredite des Landes für das Eigenkapital
  zinsFK: 0.05,                // Zins auf die Kredite der Anstalt
  laufzeitEK: 50,              // Jahre
  laufzeitFK: 50,              // Jahre
  tilgung: "annuitaet",        // "annuitaet" oder "nurZinsen" (Kredit wird dauerhaft prolongiert)
  horizont: 50,                // Betrachtungszeitraum in Jahren
  diskontsatz: null            // für den Barwert; null = zinsEK
};

function annuitaetenfaktor(r, n) {
  if (n <= 0) return 0;
  if (Math.abs(r) < 1e-12) return 1 / n;
  return r / (1 - Math.pow(1 + r, -n));
}

function kapitaldienstTranche(betrag, r, n, tilgung, jahr) {
  if (betrag <= 0) return { zahlung: 0, restschuld: 0 };
  if (tilgung === "nurZinsen") return { zahlung: betrag * r, restschuld: betrag };
  if (jahr > n) return { zahlung: 0, restschuld: 0 };
  var a = betrag * annuitaetenfaktor(r, n);
  // Restschuld nach 'jahr' Zahlungen
  var rest = Math.abs(r) < 1e-12
    ? betrag * (1 - jahr / n)
    : betrag * Math.pow(1 + r, jahr) - a * (Math.pow(1 + r, jahr) - 1) / r;
  return { zahlung: a, restschuld: Math.max(rest, 0) };
}

function berechne(eingabe) {
  var p = {};
  for (var k in STANDARD) p[k] = STANDARD[k];
  for (var k2 in (eingabe || {})) if (eingabe[k2] !== undefined) p[k2] = eingabe[k2];

  var E = p.entschaedigungMrd * 1e9;
  var EK = p.ekQuote * E;
  var FK = E - EK;
  var flaeche = p.wohnungen * p.flaecheJeWohnung;           // m²
  var d = (p.diskontsatz === null || p.diskontsatz === undefined) ? p.zinsEK : p.diskontsatz;

  var jahre = [];
  var summePositiv = 0, summeNetto = 0, barwert = 0, kum = 0, maxKum = 0;
  var erstesJahrOhneZuschuss = null;

  for (var t = 1; t <= p.horizont; t++) {
    var miete = p.miete * Math.pow(1 + p.mietsteigerung, t - 1);
    var bew = p.bewirtschaftung * Math.pow(1 + p.kostensteigerung, t - 1);
    var mieteinnahmen = miete * flaeche * 12;
    var bewirtschaftung = bew * flaeche * 12;
    var reinertrag = mieteinnahmen - bewirtschaftung;
    var ek = kapitaldienstTranche(EK, p.zinsEK, p.laufzeitEK, p.tilgung, t);
    var fk = kapitaldienstTranche(FK, p.zinsFK, p.laufzeitFK, p.tilgung, t);
    var kapitaldienst = ek.zahlung + fk.zahlung;
    var belastung = kapitaldienst - reinertrag;             // > 0: Zuschuss

    summePositiv += Math.max(belastung, 0);
    summeNetto += belastung;
    barwert += belastung / Math.pow(1 + d, t);
    kum += belastung;
    if (kum > maxKum) maxKum = kum;
    if (erstesJahrOhneZuschuss === null && belastung <= 0) erstesJahrOhneZuschuss = t;

    jahre.push({
      jahr: t,
      miete: miete,                                          // €/m²/Monat
      bewirtschaftungJeQm: bew,                              // €/m²/Monat
      mieteinnahmen: mieteinnahmen,
      bewirtschaftung: bewirtschaftung,
      reinertrag: reinertrag,
      kapitaldienstLand: ek.zahlung,                         // Eigenkapital-Kredit des Landes
      kapitaldienstAnstalt: fk.zahlung,                      // Kredite der Anstalt
      kapitaldienst: kapitaldienst,
      saldoAnstalt: reinertrag - fk.zahlung,                 // > 0: Anstalt kann an das Land abführen
      belastung: belastung,                                  // konsolidiert Land + Anstalt
      belastungJeQmMonat: belastung / flaeche / 12,
      belastungJeWohnungMonat: belastung / p.wohnungen / 12,
      kumuliert: kum,
      restschuld: ek.restschuld + fk.restschuld
    });
  }

  return {
    parameter: p,
    eigenkapital: EK,
    fremdkapital: FK,
    flaeche: flaeche,
    jahr1: jahre[0],
    jahre: jahre,
    summeZuschuesse: summePositiv,       // Summe nur der Jahre mit Zuschuss
    summeNetto: summeNetto,              // Zuschüsse minus Überschüsse
    barwert: barwert,                    // diskontiert mit d
    maxKumuliertesDefizit: maxKum,
    erstesJahrOhneZuschuss: erstesJahrOhneZuschuss
  };
}

// Vergleichsgrößen Landeshaushalt (siehe PROJEKTBRIEFING.md, Abschnitt 5)
var HAUSHALT = {
  ausgaben2026: 45.0e9,         // bereinigte Ausgaben (DIW aktuell Nr. 126, Fn.; PM SenFin 19.12.2025)
  ausgaben2027: 45.9e9,
  finanzierungsdefizit2026: 4.6e9,
  einzelplan10_2027: 5.43e9,
  schuldenbremseSpielraumMin: 0.675e9,
  schuldenbremseSpielraumMax: 0.8e9,
  schuldenstand: 69e9
};

// Voreinstellungen
var PRESETS = {
  diw_tabelle2a: { label: "DIW aktuell, Tabelle 2 (EK 4 %, FK 5 %)", miete: 7, mietsteigerung: 0, kostensteigerung: 0 },
  diw_tabelle2b: { label: "Sensitivität Zinsen +1 Pp. (EK 5 %, FK 6 %)", miete: 7, zinsEK: 0.05, zinsFK: 0.06, mietsteigerung: 0, kostensteigerung: 0 },
  imk: { label: "IMK Policy Brief 225 (rekonstruiert, real)", entschaedigungMrd: 13.5, wohnungen: 210000, flaecheJeWohnung: 63,
         miete: 7.08, bewirtschaftung: 3.66, ekQuote: 0.3, zinsEK: 0.015, zinsFK: 0.02, laufzeitEK: 40, laufzeitFK: 40,
         horizont: 40, mietsteigerung: 0, kostensteigerung: 0 },
  dwe_anleihe: { label: "DWE-Gesetzentwurf: Anleihe 3,5 %, 100 Jahre", ekQuote: 0, zinsFK: 0.035, laufzeitFK: 100, horizont: 100 },
  holm_dynamik: { label: "Dynamik nach Holm et al. (Miete +1 %, Kosten +2 %)", mietsteigerung: 0.01, kostensteigerung: 0.02 }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { berechne: berechne, annuitaetenfaktor: annuitaetenfaktor, STANDARD: STANDARD, HAUSHALT: HAUSHALT, PRESETS: PRESETS };
}
