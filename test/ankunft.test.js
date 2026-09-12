// Tests fuer das Warten auf die Ankunft.
//
// Der Fall, um den es geht, ist der teuerste im ganzen Projekt: Ein ganztaegiger Termin beginnt
// um Mitternacht, und bis jemand kommt, vergeht ein halber Tag. Was hier schiefgeht, sieht man
// entweder als dauerhaft helle Wand oder -- schlimmer -- als Wand, die einen ganzen Aufenthalt
// lang dunkel bleibt. Beides faellt erst am Geraet auf, und dann ist der Termin gelaufen.

const test = require('node:test');
const assert = require('node:assert');
const { zuhauseListe, zustandBekannt, istZuhause, ankunftLage, bezugsbeginn, ZUHAUSE_VORGABE } = require('../control/ankunft');

const FENSTER = { start: new Date('2026-06-03T00:00:00') };

// --- "zu Hause" ---------------------------------------------------------------------------

test('Die Vorgabe kennt beide ueblichen Faelle', () => {
  // Wer die Anlage beim Betreten ganz abschaltet, steht auf disarmed; wer nur den Innenbereich
  // freigibt, auf armed_home. Beides heisst "jemand ist da".
  assert.deepStrictEqual(zuhauseListe(ZUHAUSE_VORGABE), ['disarmed', 'armed_home']);
});

test('Ein leeres Feld ergibt die Vorgabe, keine leere Liste', () => {
  // Eine leere Liste hiesse: nichts zaehlt je als "zu Hause" -- das Panel bliebe den ganzen
  // Termin dunkel, und die Ursache waere ein leeres Textfeld.
  ['', null, undefined, '   ', ',,,'].forEach(w => {
    assert.deepStrictEqual(zuhauseListe(w), ['disarmed', 'armed_home'], JSON.stringify(w));
  });
});

test('Gross- und Kleinschreibung und Leerzeichen spielen keine Rolle', () => {
  assert.strictEqual(istZuhause('DISARMED', 'disarmed'), true);
  assert.strictEqual(istZuhause(' armed_home ', ' Armed_Home , disarmed '), true);
});

test('Ein fremder Zustand zaehlt nicht als zu Hause', () => {
  assert.strictEqual(istZuhause('armed_away', ZUHAUSE_VORGABE), false);
  assert.strictEqual(istZuhause('triggered', ZUHAUSE_VORGABE), false);
});

test('Unbekannte Zustaende sind nicht "zu Hause" und auch nicht "abwesend"', () => {
  // Der Tippfehler "unknow" ohne letztes n steht auf diesem Geraet wirklich in Home Assistant.
  ['', null, undefined, 'unknown', 'unknow', 'unavailable', 'none'].forEach(z => {
    assert.strictEqual(zustandBekannt(z), false, JSON.stringify(z));
    assert.strictEqual(istZuhause(z, ZUHAUSE_VORGABE), false, JSON.stringify(z));
  });
});

// --- Die Lage -------------------------------------------------------------------------------

const lage = (p) => ankunftLage(Object.assign({
  aktiv: true, entitaet: 'alarm_control_panel.haus', fenster: FENSTER,
  zustand: 'armed_away', zuhause: ZUHAUSE_VORGABE, erkanntZeit: 0, nachMinuten: 60,
  jetzt: new Date('2026-06-03T10:00:00')
}, p));

test('Abgeschaltet greift gar nichts', () => {
  assert.deepStrictEqual(lage({ aktiv: false }), { wartet: false, frisch: false, greift: false });
});

test('Ohne Entitaet greift gar nichts', () => {
  // Sonst wartete man auf ein Signal, das niemand schicken kann.
  assert.strictEqual(lage({ entitaet: '' }).greift, false);
  assert.strictEqual(lage({ entitaet: '   ' }).greift, false);
});

test('Ohne laufenden Termin gibt es nichts zu warten', () => {
  assert.strictEqual(lage({ fenster: null }).greift, false);
});

test('Anlage scharf, Termin laeuft: es wird gewartet', () => {
  assert.strictEqual(lage({}).wartet, true);
});

test('Anlage steht schon auf zu Hause: es wird nicht gewartet', () => {
  // Der Fall "die Kameras sind schon auf zu Hause" -- dann faengt es einfach zu Terminbeginn an.
  // Die Ankunft wird im Controller im selben Takt vermerkt, hier zaehlt nur: kein Warten.
  assert.strictEqual(lage({ zustand: 'disarmed', erkanntZeit: Date.parse('2026-06-03T00:00:00') }).wartet, false);
});

test('Ein unbekannter Zustand laesst NICHT warten', () => {
  // Die wichtigste Regel des Moduls: Ein Tippfehler in der Entitaets-ID oder ein nicht
  // erreichbares Home Assistant darf nicht dazu fuehren, dass die Wand nie wieder angeht.
  ['unknown', 'unavailable', null, ''].forEach(z => {
    assert.strictEqual(lage({ zustand: z }).wartet, false, JSON.stringify(z));
  });
});

test('Frisch angekommen gilt nur fuer die eingestellte Frist', () => {
  const an = Date.parse('2026-06-03T09:30:00');
  assert.strictEqual(lage({ erkanntZeit: an, nachMinuten: 60 }).frisch, true);   // 30 min her
  assert.strictEqual(lage({ erkanntZeit: an, nachMinuten: 20 }).frisch, false);  // Frist vorbei
});

test('Null Minuten heisst: die Nachtsperre gilt sofort wieder', () => {
  assert.strictEqual(lage({ erkanntZeit: Date.parse('2026-06-03T09:59:59'), nachMinuten: 0 }).frisch, false);
});

test('Nach der Ankunft wird nie wieder gewartet, auch wenn wieder scharf gestellt wird', () => {
  // Wer tagsueber wegfaehrt und scharf stellt, soll abends nicht vor einer dunklen Wand stehen.
  const l = lage({ erkanntZeit: Date.parse('2026-06-03T08:00:00'), zustand: 'armed_away' });
  assert.strictEqual(l.wartet, false);
});

// --- Bezugsbeginn des Ankunftsschirms ---------------------------------------------------------

test('Ohne Ankunft zaehlt der Ankunftsschirm ab Terminbeginn', () => {
  assert.strictEqual(bezugsbeginn('2026-06-03T00:00:00', 0), Date.parse('2026-06-03T00:00:00'));
});

test('Mit Ankunft zaehlt er ab der Ankunft', () => {
  // Sonst waere die Anzeigedauer in der Nacht abgelaufen, in der niemand da war.
  const an = Date.parse('2026-06-03T18:20:00');
  assert.strictEqual(bezugsbeginn('2026-06-03T00:00:00', an), an);
});

test('Eine Ankunft VOR dem Terminbeginn verschiebt nichts nach vorn', () => {
  const frueher = Date.parse('2026-06-02T22:00:00');
  assert.strictEqual(bezugsbeginn('2026-06-03T00:00:00', frueher), Date.parse('2026-06-03T00:00:00'));
});
