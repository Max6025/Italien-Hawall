// Tests fuer die Dringlichkeit der Akkuwarnung.
//
// Hier steckt die eigentliche Entscheidung: Wie oft, wie laut, wie lange stummschaltbar. Falsch
// eingestellt endet beides gleich -- entweder hoert man sie nicht, oder jemand schaltet sie ab.
// Und beides sieht man erst, wenn das Geraet aus ist.

const test = require('node:test');
const assert = require('node:assert');
const A = require('../renderer/shared/akku.js');

const lage = (p) => A.akkuStufe(Object.assign(
  { prozent: 19, laedt: false, schwelle: 20, minutenSeitStart: 0 }, p));

// --- Wann ueberhaupt ----------------------------------------------------------------------

test('Am Netzteil wird nie gewarnt, auch nicht bei zwei Prozent', () => {
  // Es geht ja bergauf. Eine Warnung waere hier schlicht falsch.
  assert.strictEqual(lage({ prozent: 2, laedt: true }), 0);
});

test('Ueber der Schwelle passiert nichts', () => {
  assert.strictEqual(lage({ prozent: 21, schwelle: 20 }), 0);
  assert.strictEqual(lage({ prozent: 80, schwelle: 30 }), 0);
});

test('Genau auf der Schwelle wird gewarnt', () => {
  // "Warnen ab 20 %" heisst bei 20 %, nicht bei 19.
  assert.ok(lage({ prozent: 20, schwelle: 20 }) >= 1);
});

test('Ein unsinniger Akkustand loest keine Warnung aus', () => {
  // Sonst haette ein fehlender Wert dieselbe Wirkung wie ein leerer Akku.
  [null, undefined, NaN, 'voll'].forEach(w => assert.strictEqual(lage({ prozent: w }), 0, String(w)));
});

// --- Die Stufen ---------------------------------------------------------------------------

test('Frisch unter der Schwelle ist es nur ein Hinweis', () => {
  assert.strictEqual(lage({ prozent: 19, schwelle: 20, minutenSeitStart: 0 }), 1);
});

test('Wer sich Zeit laesst, wird deutlicher gewarnt', () => {
  // Die eigentliche Idee: Wer sofort reagiert, hoert die Warnung fast nicht. Wer sie
  // ignoriert, wird sie nicht los.
  assert.strictEqual(lage({ minutenSeitStart: 0 }), 1);
  assert.strictEqual(lage({ minutenSeitStart: 5 }), 2);
  assert.strictEqual(lage({ minutenSeitStart: 15 }), 3);
});

test('Ein deutlich unterschrittener Stand ist auch ohne Zeitablauf dringender', () => {
  // Von 30 auf 24 gefallen: Da ist mehr passiert als bei jemandem, der gerade erst 29 erreicht.
  assert.strictEqual(lage({ prozent: 29, schwelle: 30, minutenSeitStart: 0 }), 1);
  assert.strictEqual(lage({ prozent: 24, schwelle: 30, minutenSeitStart: 0 }), 2);
});

test('Unter 15 Prozent ist es sofort kritisch', () => {
  // Ohne Ruecksicht auf Zeit und Schwelle -- ab hier geht es ums Abschalten.
  assert.strictEqual(lage({ prozent: 15, minutenSeitStart: 0 }), 3);
  assert.strictEqual(lage({ prozent: 4, schwelle: 40, minutenSeitStart: 0 }), 3);
});

test('Eine zu tiefe Schwelle wird angehoben, nicht uebernommen', () => {
  // Unter zwanzig Prozent bleibt keine Reserve, um in Ruhe zu reagieren. Wer 5 % eintraegt,
  // bekommt trotzdem bei 20 % die erste Warnung.
  assert.ok(lage({ prozent: 19, schwelle: 5 }) >= 1);
  assert.strictEqual(A.SCHWELLE_MINDESTENS, 20);
});

// --- Ton und Abstand ----------------------------------------------------------------------

test('Hoehere Stufen sind lauter und kommen oefter', () => {
  const s = [1, 2, 3].map(A.stufenEinstellung);
  for (let i = 1; i < s.length; i++) {
    assert.ok(s[i].abstandSekunden < s[i - 1].abstandSekunden, 'Abstand Stufe ' + (i + 1));
    assert.ok(s[i].lautstaerke > s[i - 1].lautstaerke, 'Lautstaerke Stufe ' + (i + 1));
    assert.ok(s[i].systemLautstaerke > s[i - 1].systemLautstaerke, 'Systemlautstaerke Stufe ' + (i + 1));
  }
});

test('Nur die kritische Stufe blinkt', () => {
  assert.strictEqual(A.stufenEinstellung(1).blinkt, false);
  assert.strictEqual(A.stufenEinstellung(2).blinkt, false);
  assert.strictEqual(A.stufenEinstellung(3).blinkt, true);
});

test('Die kritische Stufe klingt anders, nicht nur lauter', () => {
  // Ein Klang, den man schon kennt, hoert man irgendwann weg -- auch einen lauten.
  assert.notDeepStrictEqual(A.stufenMotiv(3).toene, A.stufenMotiv(1).toene);
  assert.ok(A.stufenMotiv(3).abstand < A.stufenMotiv(1).abstand);
});

test('Ohne Warnung kommt nie ein Ton', () => {
  assert.strictEqual(A.tonFaellig({ stufe: 0, jetzt: 1e9, letzterTon: 0, stummBis: 0 }), false);
});

test('Der erste Ton kommt sofort', () => {
  assert.strictEqual(A.tonFaellig({ stufe: 1, jetzt: 1000, letzterTon: 0, stummBis: 0 }), true);
});

test('Der naechste Ton kommt erst nach dem Abstand der Stufe', () => {
  const t0 = 1000000;
  assert.strictEqual(A.tonFaellig({ stufe: 1, jetzt: t0 + 59000, letzterTon: t0 }), false);
  assert.strictEqual(A.tonFaellig({ stufe: 1, jetzt: t0 + 60000, letzterTon: t0 }), true);
  // Stufe 3 draengt: zwoelf Sekunden statt sechzig.
  assert.strictEqual(A.tonFaellig({ stufe: 3, jetzt: t0 + 12000, letzterTon: t0 }), true);
});

test('Stummgeschaltet kommt kein Ton, danach wieder', () => {
  const t0 = 1000000;
  assert.strictEqual(A.tonFaellig({ stufe: 3, jetzt: t0, letzterTon: 0, stummBis: t0 + 1000 }), false);
  assert.strictEqual(A.tonFaellig({ stufe: 3, jetzt: t0 + 1000, letzterTon: 0, stummBis: t0 + 1000 }), true);
});

// --- Stummschalten ------------------------------------------------------------------------

test('Dreimal darf man wegdruecken', () => {
  const t0 = 5000000;
  [0, 1, 2].forEach(n => {
    const r = A.stummschalten(t0, n, 1);
    assert.strictEqual(r.erlaubt, true, 'Versuch ' + n);
    assert.strictEqual(r.bisMs, t0 + A.STUMM_MINUTEN * 60000);
  });
});

test('Auf der kritischen Stufe ist die Ruhe kuerzer', () => {
  // Drei Minuten waeren dort ein Viertel der Zeit, die das Geraet noch hat.
  const t0 = 5000000;
  assert.strictEqual(A.stummMinuten(1), A.STUMM_MINUTEN);
  assert.strictEqual(A.stummMinuten(3), A.STUMM_MINUTEN_KRITISCH);
  assert.strictEqual(A.stummschalten(t0, 0, 3).bisMs, t0 + A.STUMM_MINUTEN_KRITISCH * 60000);
});

test('Der Text nennt die richtige Einzahl', () => {
  // "1 Minuten still" ist die Sorte Kleinigkeit, die eine sonst sorgfaeltige Anzeige billig
  // aussehen laesst.
  assert.match(A.stummschalten(0, 0, 3).text, /1 Minute still/);
  assert.match(A.stummschalten(0, 0, 1).text, /3 Minuten still/);
});

test('Beim vierten Mal nicht mehr', () => {
  // Ab da ist es keine Stoerung mehr, sondern die letzte Warnung vor einem Geraet, das sich
  // abschaltet. Das Kontingent gilt aber je STUFE: Wer es bei zwanzig Prozent aufgebraucht
  // hat, bekommt bei vierzehn ein neues -- das ist eine andere Lage. Diese Zaehlung setzt
  // die Anzeige zurueck, sobald die Stufe steigt.
  const r = A.stummschalten(5000000, 3);
  assert.strictEqual(r.erlaubt, false);
  assert.strictEqual(r.bisMs, 0);
  assert.match(r.text, /anschließen/);
});

test('Der Text sagt, wie oft es noch geht', () => {
  // Sonst druckt man dreimal und steht beim vierten Mal ueberrascht vor einem Ton, der bleibt.
  assert.match(A.stummschalten(0, 0).text, /noch 2/);
  assert.match(A.stummschalten(0, 2).text, /danach nicht mehr/);
});
