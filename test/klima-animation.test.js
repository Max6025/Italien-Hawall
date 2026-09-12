// Tests fuer den Startversatz der Klima-Animationen.
//
// Der Fehler, um den es geht, ist unsichtbar in jedem Einzelbild und faellt nur in der
// Bewegung auf: Eine neu gebaute Karte startet ihre CSS-Animation bei null, die Schneeflocke
// springt also mitten in der Drehung zurueck. Pruefbar ist daran die Rechnung -- dass derselbe
// Zeitpunkt denselben Versatz ergibt, und dass er im Zyklus bleibt.

const test = require('node:test');
const assert = require('node:assert');
const { animationsPhase, hvacPhasenStil } = require('../renderer/shared/dashboard-render.js');

test('Der Versatz ist negativ und liegt innerhalb des Zyklus', () => {
  // Ein positiver Versatz wuerde die Animation verzoegert starten lassen -- die Flocke stuende
  // erst einmal still. Gebraucht wird das Gegenteil: ein Start in der Vergangenheit.
  for (const ms of [0, 1, 1500, 999999, Date.now()]) {
    const p = animationsPhase(12, false, ms);
    const wert = parseFloat(p);
    assert.ok(p.endsWith('s'), p);
    assert.ok(wert <= 0, p);
    assert.ok(wert > -12, p);
  }
});

test('Derselbe Zeitpunkt ergibt denselben Versatz', () => {
  // Genau das traegt die Bewegung ueber den Neuaufbau: Zwei Karten, die im selben Moment
  // gebaut werden, muessen an derselben Stelle stehen.
  assert.strictEqual(animationsPhase(12, false, 5000), animationsPhase(12, false, 5000));
});

test('Nach einer vollen Umdrehung steht es wieder am Anfang', () => {
  assert.strictEqual(animationsPhase(12, false, 0), animationsPhase(12, false, 12000));
  assert.strictEqual(animationsPhase(12, false, 3000), animationsPhase(12, false, 15000));
});

test('Bei alternate zaehlt der doppelte Zyklus', () => {
  // Hin und zurueck sind zusammen eine Runde. Mit dem einfachen Zyklus landete jeder zweite
  // Neuaufbau am Wendepunkt statt an der richtigen Stelle.
  assert.strictEqual(animationsPhase(1.1, true, 0), animationsPhase(1.1, true, 2200));
  assert.notStrictEqual(animationsPhase(1.1, true, 0), animationsPhase(1.1, true, 1100));
});

test('Eine Viertelumdrehung ist ein Viertel der Dauer', () => {
  assert.strictEqual(animationsPhase(12, false, 3000), '-3.00s');
  assert.strictEqual(animationsPhase(12, false, 9000), '-9.00s');
});

test('Unsinnige Dauern ergeben keinen Versatz statt NaN', () => {
  // Ein NaN im style-Attribut macht die ganze Deklaration ungueltig -- und damit stuende die
  // Animation still, ohne dass irgendwo ein Fehler auftaucht.
  ['0s', animationsPhase(0, false, 1000), animationsPhase(-5, false, 1000), animationsPhase(null, false, 1000)]
    .forEach(p => assert.strictEqual(p, '0s'));
});

test('Der Stil nennt jede Animation genau einmal', () => {
  const stil = hvacPhasenStil(7000);
  ['zucken', 'atmen', 'flocke', 'tropfen', 'luefter', 'auto'].forEach(name => {
    assert.strictEqual(stil.split('--ph-' + name + ':').length, 2, name + ' in ' + stil);
  });
  assert.ok(!/NaN|undefined/.test(stil), stil);
});
