// Tests fuer die Auslegung der Alarmzustaende.
//
// An derselben Entitaet haengen zwei Funktionen: das Warten auf die Ankunft und das Dimmen bei
// Abwesenheit. Sie duerfen sich nicht widersprechen -- und beide haengen an derselben Frage,
// die genau DREI Antworten hat: zu Hause, abwesend, oder unbekannt. Die dritte ist die
// wichtige: Wer sie zu einer der beiden anderen macht, baut einen Fehler, der wie ein
// Geraetedefekt aussieht.

const test = require('node:test');
const assert = require('node:assert');
const A = require('../renderer/shared/alarm.js');

test('Zu Hause und abwesend schliessen sich aus', () => {
  ['disarmed', 'armed_home', 'armed_away', 'triggered', 'arming'].forEach(z => {
    assert.notStrictEqual(A.istZuhause(z, A.ZUHAUSE_VORGABE), A.istAbwesend(z, A.ZUHAUSE_VORGABE), z);
  });
});

test('Unbekannt ist WEDER zu Hause NOCH abwesend', () => {
  // Das ist die eigentliche Regel dieses Moduls. Ein Tippfehler in der Entitaets-ID wuerde
  // sonst den Bildschirm dauerhaft dimmen -- und wer davorsteht, sucht den Fehler am Geraet.
  ['', null, undefined, 'unknown', 'unknow', 'unavailable', 'none'].forEach(z => {
    assert.strictEqual(A.istZuhause(z, A.ZUHAUSE_VORGABE), false, JSON.stringify(z));
    assert.strictEqual(A.istAbwesend(z, A.ZUHAUSE_VORGABE), false, JSON.stringify(z));
  });
});

test('Alles, was nicht in der Liste steht, gilt als abwesend', () => {
  // Auch Zustaende, die diese App nicht kennt: Eine Anlage darf heissen, wie sie will.
  ['armed_away', 'armed_night', 'armed_vacation', 'triggered', 'pending', 'was_auch_immer']
    .forEach(z => assert.strictEqual(A.istAbwesend(z, A.ZUHAUSE_VORGABE), true, z));
});

test('Eine eigene Liste zaehlt, nicht die Vorgabe', () => {
  assert.strictEqual(A.istZuhause('armed_night', 'armed_night'), true);
  assert.strictEqual(A.istAbwesend('armed_night', 'armed_night'), false);
  // disarmed gehoert dann NICHT mehr dazu -- wer die Liste setzt, setzt sie ganz.
  assert.strictEqual(A.istAbwesend('disarmed', 'armed_night'), true);
});

test('Die Vorgabe greift bei leerer Liste', () => {
  ['', null, undefined, '  ', ',,'].forEach(l => {
    assert.strictEqual(A.istZuhause('disarmed', l), true, JSON.stringify(l));
  });
});

test('control/ankunft.js benutzt genau dieses Modul', () => {
  // Zwei Auslegungen von "zu Hause" waeren eine zu viel: Das Panel wartete dann auf eine
  // Ankunft, die das Dimmen laengst erkannt hat -- oder umgekehrt.
  const ankunft = require('../control/ankunft.js');
  assert.strictEqual(ankunft.ZUHAUSE_VORGABE, A.ZUHAUSE_VORGABE);
  assert.strictEqual(ankunft.istZuhause('armed_night', 'armed_night'), A.istZuhause('armed_night', 'armed_night'));
});
