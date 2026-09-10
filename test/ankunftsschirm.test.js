// Tests fuer die Entscheidung, wann der Ankunftsschirm sichtbar ist.
//
// Die Anzeige selbst (Animation, DOM) ist nicht das Fehleranfaellige. Das hier ist es: der
// Verworfen-Zustand, der einen Neustart ueberdauern muss, und die Anzeigedauer. Beides laesst
// sich ohne Browser pruefen, weil sollAnzeigen() bewusst nichts als seine Argumente kennt --
// keine Uhr, kein DOM, kein Netz.

const test = require('node:test');
const assert = require('node:assert');
const { sollAnzeigen } = require('../renderer/shared/ankunftsschirm.js');

const START = '2026-09-12T14:00:00.000Z';
const FENSTER = { start: START, end: '2026-09-14T10:00:00.000Z' };
const beiUhrzeit = (iso) => new Date(iso);

const basis = (ueberschreiben) => Object.assign({
  aktiviert: true,
  anzeigefenster: FENSTER,
  verworfenFuer: '',
  stunden: 5,
  jetzt: beiUhrzeit('2026-09-12T14:30:00.000Z')
}, ueberschreiben);

test('Bei laufendem Termin erscheint er', () => {
  assert.strictEqual(sollAnzeigen(basis()), true);
});

test('Ausgeschaltet erscheint er nie', () => {
  assert.strictEqual(sollAnzeigen(basis({ aktiviert: false })), false);
});

test('Ohne Anzeigefenster erscheint er nicht', () => {
  assert.strictEqual(sollAnzeigen(basis({ anzeigefenster: null })), false);
});

test('Weggetippt bleibt weggetippt -- fuer genau dieses Anzeigefenster', () => {
  assert.strictEqual(sollAnzeigen(basis({ verworfenFuer: START })), false);
});

test('Beim NAECHSTEN Termin erscheint er wieder', () => {
  // Anderes Fenster, anderer Beginn -- der alte Verworfen-Eintrag darf nicht mehr greifen.
  const naechstes = { start: '2026-09-19T14:00:00.000Z', end: '2026-09-21T10:00:00.000Z' };
  const s = sollAnzeigen(basis({
    anzeigefenster: naechstes,
    verworfenFuer: START,
    jetzt: beiUhrzeit('2026-09-19T14:30:00.000Z')
  }));
  assert.strictEqual(s, true);
});

test('Nach Ablauf der Anzeigedauer verschwindet er', () => {
  // 5 Stunden ab 14:00 -- um 19:01 ist Schluss.
  assert.strictEqual(sollAnzeigen(basis({ jetzt: beiUhrzeit('2026-09-12T18:59:00.000Z') })), true);
  assert.strictEqual(sollAnzeigen(basis({ jetzt: beiUhrzeit('2026-09-12T19:00:00.000Z') })), false);
  assert.strictEqual(sollAnzeigen(basis({ jetzt: beiUhrzeit('2026-09-12T19:30:00.000Z') })), false);
});

test('Dauer 0 heisst "bis zum Wegtippen", nicht "gar nicht"', () => {
  // Sonst waere eine 0 im Eingabefeld ein stiller Ausschalter -- genau die Sorte
  // Ueberraschung, die man ein Jahr spaeter sucht.
  const spaeter = basis({ stunden: 0, jetzt: beiUhrzeit('2026-09-13T22:00:00.000Z') });
  assert.strictEqual(sollAnzeigen(spaeter), true);
  assert.strictEqual(sollAnzeigen(Object.assign(spaeter, { verworfenFuer: START })), false);
});

test('Ein unbrauchbarer Beginn fuehrt nicht zu einem Schirm, der ewig steht', () => {
  assert.strictEqual(sollAnzeigen(basis({ anzeigefenster: { start: 'kaputt' } })), false);
  assert.strictEqual(sollAnzeigen(basis({ anzeigefenster: { start: '' } })), false);
});

test('Fehlende Argumente stuerzen nicht ab', () => {
  assert.strictEqual(sollAnzeigen(null), false);
  assert.strictEqual(sollAnzeigen({}), false);
  assert.strictEqual(sollAnzeigen({ aktiviert: true }), false);
});

test('Ein Verworfen-Eintrag eines fremden Fensters blockiert nicht', () => {
  const s = sollAnzeigen(basis({ verworfenFuer: '2026-01-01T00:00:00.000Z' }));
  assert.strictEqual(s, true);
});

// --- Markdown ---------------------------------------------------------------------------------
//
// Sicherheitsprinzip: Erst wird alles maskiert, danach werden ausschliesslich die eigenen
// Auszeichnungen zu Tags. Aus dem Text kann also nie HTML entstehen, das jemand hineingeschrieben
// hat -- der Text landet auf einem Geraet, das Gaesten gehoert.

const { markdown } = require('../renderer/shared/ankunftsschirm.js');
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

test('Fett, kursiv und Code werden ausgezeichnet', () => {
  assert.strictEqual(markdown('**fett**', esc), '<p><strong>fett</strong></p>');
  assert.strictEqual(markdown('_kursiv_', esc), '<p><em>kursiv</em></p>');
  assert.strictEqual(markdown('`code`', esc), '<p><code>code</code></p>');
});

test('Aufzaehlungen werden zu einer Liste', () => {
  const h = markdown('- eins\n- zwei', esc);
  assert.strictEqual(h, '<ul><li>eins</li><li>zwei</li></ul>');
});

test('Ueberschriften beginnen bei h2 -- h1 gehoert der Ueberschrift des Schirms', () => {
  assert.strictEqual(markdown('# Titel', esc), '<h2>Titel</h2>');
  assert.strictEqual(markdown('## Kleiner', esc), '<h3>Kleiner</h3>');
});

test('HTML im Text wird angezeigt, nicht ausgefuehrt', () => {
  const h = markdown('<script>alert(1)</script>', esc);
  assert.ok(!h.includes('<script'), 'es darf kein script-Tag entstehen');
  assert.ok(h.includes('&lt;script&gt;'), 'es muss als Text sichtbar sein');
});

test('Ein Bildtag im Text erzeugt kein Bild', () => {
  const h = markdown('<img src=x onerror=alert(1)>', esc);
  assert.ok(!h.includes('<img'), 'es darf kein img-Tag entstehen');
});

test('Nur http und https werden zu Links', () => {
  assert.ok(markdown('[HA](https://example.org)', esc).includes('<a href="https://example.org"'));
  const boese = markdown('[klick](javascript:alert(1))', esc);
  assert.ok(!boese.includes('<a '), 'javascript: darf nie zu einem Link werden');
});

test('Leerer Text ergibt nichts', () => {
  assert.strictEqual(markdown('', esc), '');
  assert.strictEqual(markdown(null, esc), '');
});

test('Die Ueberschrift kann fett gesetzt werden', () => {
  // "Herzlich **willkommen**" ergibt dieselbe Zweiteilung wie in der Entwurfsvorlage:
  // erste Zeile schlank, zweite kraeftig (das Umbrechen macht das CSS).
  const { inlineMarkdown } = require('../renderer/shared/ankunftsschirm.js');
  assert.strictEqual(inlineMarkdown('Herzlich **willkommen**', esc),
    'Herzlich <strong>willkommen</strong>');
});

test('Auch in der Ueberschrift wird HTML maskiert', () => {
  const { inlineMarkdown } = require('../renderer/shared/ankunftsschirm.js');
  const h = inlineMarkdown('<b>roh</b>', esc);
  assert.ok(!h.includes('<b>'), 'rohes HTML darf nicht durchkommen');
});

// --- Bildwechsel ------------------------------------------------------------------------------
//
// Am Geraet gemeldet: Das zweite Bild erschien, war nach rund drei Sekunden wieder weg, dann
// wartete der Schirm die eingestellte Dauer und dasselbe von vorn. Ursache war NICHT der
// Zeitgeber, sondern dass inhaltSetzen() bei jeder Zustandsmeldung aufgerufen wird und dabei
// hart auf Bild eins zuruecksetzte. Die Kennung unten ist das Gegenmittel.

const { bildFolge, textFuerDrehung } = require('../renderer/shared/ankunftsschirm.js');

test('Gleicher Inhalt ergibt dieselbe Kennung -- der Wechsel laeuft weiter', () => {
  const inhalt = { bildUrl: 'a.png', bildUrl2: 'b.png', bildtext: 'WLAN', wechselSekunden: 20 };
  assert.strictEqual(bildFolge(inhalt).kennung, bildFolge({ ...inhalt }).kennung);
});

test('Ein geaenderter Inhalt ergibt eine andere Kennung', () => {
  const a = bildFolge({ bildUrl: 'a.png', bildUrl2: 'b.png', wechselSekunden: 20 });
  assert.notStrictEqual(a.kennung, bildFolge({ bildUrl: 'a.png', bildUrl2: 'c.png', wechselSekunden: 20 }).kennung);
  assert.notStrictEqual(a.kennung, bildFolge({ bildUrl: 'a.png', bildUrl2: 'b.png', wechselSekunden: 30 }).kennung);
});

test('Die Ueberschrift aendert die Kennung NICHT', () => {
  // Sonst setzte ein wechselnder Termintitel den Bildwechsel zurueck -- derselbe Fehler
  // in neuem Gewand.
  const basis = { bildUrl: 'a.png', bildUrl2: 'b.png', wechselSekunden: 20 };
  assert.strictEqual(
    bildFolge({ ...basis, ueberschrift: 'Hallo' }).kennung,
    bildFolge({ ...basis, ueberschrift: 'Anders' }).kennung);
});

test('Vier Wuerfelseiten, damit er immer gleich herum dreht', () => {
  const f = bildFolge({ bildUrl: 'a.png', bildUrl2: 'b.png' });
  assert.deepStrictEqual(f.seiten, ['a.png', 'b.png', 'a.png', 'b.png']);
  assert.strictEqual(f.dreht, true);
});

test('Nur ein Bild heisst: keine Drehung', () => {
  const f = bildFolge({ bildUrl: 'a.png' });
  assert.strictEqual(f.dreht, false);
  assert.deepStrictEqual(f.seiten, ['a.png', 'a.png', 'a.png', 'a.png']);
});

test('Ohne Bild bleibt der Bereich leer', () => {
  assert.deepStrictEqual(bildFolge({}).seiten, []);
  assert.deepStrictEqual(bildFolge(null).seiten, []);
});

test('Die zweite Bildunterschrift faellt auf die erste zurueck', () => {
  assert.deepStrictEqual(bildFolge({ bildUrl: 'a', bildtext: 'WLAN' }).texte, ['WLAN', 'WLAN']);
  assert.deepStrictEqual(bildFolge({ bildUrl: 'a', bildtext: 'WLAN', bildtext2: 'Karte' }).texte, ['WLAN', 'Karte']);
});

test('Die Unterschrift folgt der Drehung', () => {
  const texte = ['WLAN', 'Karte'];
  assert.strictEqual(textFuerDrehung(texte, 0), 'WLAN');
  assert.strictEqual(textFuerDrehung(texte, -90), 'Karte');
  assert.strictEqual(textFuerDrehung(texte, -180), 'WLAN');
  assert.strictEqual(textFuerDrehung(texte, -270), 'Karte');
  assert.strictEqual(textFuerDrehung(texte, -360), 'WLAN');
});

test('Eine unbrauchbare Wechseldauer faellt auf acht Sekunden zurueck', () => {
  assert.strictEqual(bildFolge({ bildUrl: 'a' }).sekunden, 8);
  assert.strictEqual(bildFolge({ bildUrl: 'a', wechselSekunden: 0 }).sekunden, 8);
  assert.strictEqual(bildFolge({ bildUrl: 'a', wechselSekunden: 'x' }).sekunden, 8);
  assert.strictEqual(bildFolge({ bildUrl: 'a', wechselSekunden: 25 }).sekunden, 25);
});

// --- "Jetzt anzeigen" -------------------------------------------------------------------------
//
// Der Knopf in den Einstellungen setzte frueher nur den Verworfen-Zustand zurueck. Ohne
// laufenden Termin gibt es aber gar kein Anzeigefenster, und die Pruefung stieg sofort aus:
// Man drueckt "jetzt anzeigen", und es passiert nichts. Wer den Schirm ansehen will, hat in
// aller Regel gerade KEINEN Termin laufen -- sonst muesste er nicht danach fragen.

const inZehnMinuten = () => Date.now() + 10 * 60000;
const vorEinerMinute = () => Date.now() - 60000;

test('Erzwungen erscheint er auch OHNE laufenden Termin', () => {
  assert.strictEqual(sollAnzeigen({
    aktiviert: true, anzeigefenster: null, erzwungenBis: inZehnMinuten(), jetzt: new Date()
  }), true);
});

// basis() rechnet mit einer festen Pruefuhr im September 2026 -- das Zeitfenster muss sich
// darauf beziehen, nicht auf die echte Uhr.
const nachPruefuhr = (p, minuten) => (p.jetzt || new Date()).getTime() + minuten * 60000;

test('Erzwungen schlaegt den Verworfen-Zustand', () => {
  // Sonst waere der Knopf wirkungslos, sobald jemand den Schirm einmal weggetippt hat --
  // und genau dann drueckt man ihn.
  const p = basis({ verworfenFuer: START });
  assert.strictEqual(sollAnzeigen(Object.assign(p, { erzwungenBis: nachPruefuhr(p, 10) })), true);
});

test('Erzwungen schlaegt die abgelaufene Anzeigedauer', () => {
  const p = basis({ jetzt: beiUhrzeit('2026-09-13T22:00:00.000Z') });
  assert.strictEqual(sollAnzeigen(Object.assign(p, { erzwungenBis: nachPruefuhr(p, 10) })), true);
});

test('Erzwungen erscheint er auch, wenn er ausgeschaltet ist', () => {
  // Der Knopf steht in den Ankunftsschirm-Einstellungen und heisst "jetzt anzeigen". Wer ihn
  // drueckt, will hinsehen -- auch (und gerade) um zu pruefen, ob sich das Einschalten lohnt.
  assert.strictEqual(sollAnzeigen({
    aktiviert: false, anzeigefenster: null, erzwungenBis: inZehnMinuten(), jetzt: new Date()
  }), true);
});

test('Ein abgelaufenes Zeitfenster erzwingt nichts mehr', () => {
  // Sonst bliebe der Schirm nach einem vergessenen Knopfdruck ewig stehen.
  assert.strictEqual(sollAnzeigen({
    aktiviert: true, anzeigefenster: null, erzwungenBis: vorEinerMinute(), jetzt: new Date()
  }), false);
});

test('Ohne Zeitfenster gilt weiter die normale Regel', () => {
  assert.strictEqual(sollAnzeigen(basis({ erzwungenBis: 0 })), true);
  assert.strictEqual(sollAnzeigen(basis({ erzwungenBis: 0, verworfenFuer: START })), false);
  assert.strictEqual(sollAnzeigen({ aktiviert: true, anzeigefenster: null, erzwungenBis: 0 }), false);
});

test('Unsinn im Zeitfenster laesst den Schirm nicht ewig stehen', () => {
  ['kaputt', NaN, null, undefined, {}].forEach((v) => {
    assert.strictEqual(sollAnzeigen({ aktiviert: true, anzeigefenster: null, erzwungenBis: v }), false,
      'erzwungenBis=' + JSON.stringify(v));
  });
});

// --- Testmodus --------------------------------------------------------------------------------
//
// Zum Ausprobieren: Nach ein paar Sekunden ohne Beruehrung kommt der Schirm von allein wieder,
// so oft man will. Ohne das muesste man fuer jeden Blick in die Einstellungen gehen.

const test_ = (ueberschreiben) => Object.assign({
  aktiviert: false, anzeigefenster: null, testmodus: true, testSekunden: 10,
  leerlaufSekunden: 0, jetzt: new Date()
}, ueberschreiben);

test('Im Testmodus kommt er nach der eingestellten Ruhezeit', () => {
  assert.strictEqual(sollAnzeigen(test_({ leerlaufSekunden: 9.9 })), false);
  assert.strictEqual(sollAnzeigen(test_({ leerlaufSekunden: 10 })), true);
  assert.strictEqual(sollAnzeigen(test_({ leerlaufSekunden: 45 })), true);
});

test('Er kommt auch ohne Termin und ohne eingeschaltet zu sein', () => {
  // Sonst braeuchte man zum Testen einen laufenden Termin -- und wer testen will, hat keinen.
  assert.strictEqual(sollAnzeigen(test_({ leerlaufSekunden: 20, aktiviert: false, anzeigefenster: null })), true);
});

test('Ein Verworfen-Eintrag haelt ihn im Testmodus nicht auf', () => {
  // Sonst waere der Testmodus nach dem ersten Antippen wirkungslos.
  assert.strictEqual(sollAnzeigen(test_({
    leerlaufSekunden: 20, anzeigefenster: FENSTER, verworfenFuer: START
  })), true);
});

test('Frisch beruehrt bleibt er weg', () => {
  assert.strictEqual(sollAnzeigen(test_({ leerlaufSekunden: 0 })), false);
  assert.strictEqual(sollAnzeigen(test_({ leerlaufSekunden: 3 })), false);
});

test('Die Ruhezeit ist einstellbar', () => {
  assert.strictEqual(sollAnzeigen(test_({ testSekunden: 30, leerlaufSekunden: 20 })), false);
  assert.strictEqual(sollAnzeigen(test_({ testSekunden: 30, leerlaufSekunden: 31 })), true);
});

test('Ohne Angabe gelten zehn Sekunden', () => {
  assert.strictEqual(sollAnzeigen(test_({ testSekunden: undefined, leerlaufSekunden: 11 })), true);
  assert.strictEqual(sollAnzeigen(test_({ testSekunden: undefined, leerlaufSekunden: 5 })), false);
});

test('Ein fehlender Leerlaufwert zeigt nichts an, statt zu raten', () => {
  assert.strictEqual(sollAnzeigen(test_({ leerlaufSekunden: undefined })), false);
  assert.strictEqual(sollAnzeigen(test_({ leerlaufSekunden: NaN })), false);
});

test('Ohne Testmodus gilt weiter die normale Regel', () => {
  // Der lange Leerlauf darf ausserhalb des Testmodus nichts bewirken.
  assert.strictEqual(sollAnzeigen(basis({ testmodus: false, leerlaufSekunden: 9999 })), true);
  assert.strictEqual(sollAnzeigen({
    aktiviert: true, anzeigefenster: null, testmodus: false, leerlaufSekunden: 9999
  }), false);
});
