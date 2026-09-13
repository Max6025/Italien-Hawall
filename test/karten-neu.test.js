// Tests fuer die Sonneneinstrahlungs-Karte, die Sensorfarben und die Symbole aus Home Assistant.

const test = require('node:test');
const assert = require('node:assert');
const R = require('../renderer/shared/dashboard-render.js');

// --- Sonneneinstrahlung -------------------------------------------------------------------

test('Die Einheit W/m2 macht eine Sonneneinstrahlungs-Karte', () => {
  // Die Einheit ist der zuverlaessige Teil: device_class "irradiance" gibt es erst seit
  // HA 2022, und aeltere Integrationen liefern sie oft gar nicht.
  ['W/m²', 'W/m2', 'W/m ²'].forEach(u => {
    assert.strictEqual(R.isSolar('sensor.x', { unit_of_measurement: u }), true, u);
  });
  assert.strictEqual(R.isSolar('sensor.x', { device_class: 'irradiance' }), true);
});

test('Watt allein ist keine Einstrahlung', () => {
  // An einem Wechselrichter steht "Solar" und er liefert Watt -- das ist Leistung, keine
  // Einstrahlung, und gehoert auf eine andere Karte.
  assert.strictEqual(R.isSolar('sensor.solar_power', { unit_of_measurement: 'W', device_class: 'power' }), false);
  assert.strictEqual(R.isSolar('sensor.solar_ertrag', { unit_of_measurement: 'kWh', device_class: 'energy' }), false);
});

test('Ohne Einheit entscheidet der Name -- aber nur, wenn nichts anderes dagegen spricht', () => {
  assert.strictEqual(R.isSolar('sensor.ecowitt_solar_radiation', {}), true);
  assert.strictEqual(R.isSolar('sensor.sonneneinstrahlung', {}), true);
  // Eine device_class hat sich schon erklaert -- dann zaehlt der Name nicht mehr.
  assert.strictEqual(R.isSolar('sensor.solar_radiation_batterie', { device_class: 'battery' }), false);
});

test('Eine Einstrahlungs-Entitaet bekommt die Sonnenkarte vorgeschlagen', () => {
  const z = { state: '412', attributes: { unit_of_measurement: 'W/m²', friendly_name: 'Solar Radiation' } };
  assert.strictEqual(R.defaultCardType('sensor.solar', z), 'solar');
  assert.ok(R.allowedCardTypes('sensor.solar', z).includes('solar'));
});

test('Die Sonnenkarte steht im Katalog und nimmt Sensor-Domains', () => {
  assert.ok(R.CARD_TYPES.solar, 'fehlt im Katalog');
  assert.ok(R.domainsForType('solar').includes('sensor'));
});

// --- Sensorfarben -------------------------------------------------------------------------

test('Mehrere Sensorkarten bekommen verschiedene Farben', () => {
  // Drei nebeneinander sahen bisher identisch aus -- man musste jedes Mal die
  // Bildunterschrift lesen.
  const ids = ['sensor.a', 'sensor.b', 'sensor.c', 'sensor.d'];
  const farben = Object.values(R.sensorAkzente(ids));
  assert.strictEqual(new Set(farben).size, ids.length, JSON.stringify(farben));
});

test('Dieselbe Karte behaelt ihre Farbe, wenn daneben etwas dazukommt', () => {
  // Sonst faerbte sich das halbe Dashboard um, weil irgendwo ein Sensor hinzukam.
  const vorher = R.sensorAkzente(['sensor.a', 'sensor.b']);
  const nachher = R.sensorAkzente(['sensor.a', 'sensor.b', 'sensor.neu']);
  assert.strictEqual(nachher['sensor.a'], vorher['sensor.a']);
  assert.strictEqual(nachher['sensor.b'], vorher['sensor.b']);
});

test('Die Farben sind stabil ueber Programmlaeufe hinweg', () => {
  assert.deepStrictEqual(R.sensorAkzente(['sensor.aussen']), R.sensorAkzente(['sensor.aussen']));
});

test('Keine Sensorfarbe kollidiert mit einem festen Kartenakzent', () => {
  // Sonst sieht eine Sensorkarte aus wie eine Klimakarte -- und die Farbe wuerde etwas
  // behaupten, was nicht stimmt.
  const feste = ['#7ba4ff', '#ffc061', '#6fd6a0', '#8fdccd', '#7fa2e6', '#bd9cf5',
    '#ff9d7a', '#7fc7e6', '#9db4d8', '#ff8f8f', '#a7b09a', '#f2d867', '#7aa2ff'];
  R.SENSOR_FARBEN.forEach(f => assert.ok(!feste.includes(f.toLowerCase()), 'doppelt: ' + f));
});

test('Eine leere Liste ergibt eine leere Zuordnung, keinen Fehler', () => {
  assert.deepStrictEqual(R.sensorAkzente([]), {});
  assert.deepStrictEqual(R.sensorAkzente(null), {});
});

// --- Symbole aus Home Assistant -------------------------------------------------------------

test('Ohne geladene Pfade kommt kein kaputtes SVG heraus', () => {
  // Die 2,6-MB-Datei wird erst nachgeladen, wenn eine Karte sie braucht. Bis dahin darf hier
  // nichts Halbes entstehen -- ein <path d="undefined"> zeichnet einen Fehler statt nichts.
  assert.strictEqual(R.mdiSymbol('mdi:weather-sunny'), '');
  assert.strictEqual(R.mdiSymbol(''), '');
  assert.strictEqual(R.mdiSymbol(null), '');
});

test('Nachgeladene Pfade ergeben ein gefuelltes SVG', () => {
  const alt = global.window;
  global.window = { MDI_PFADE: { 'weather-sunny': 'M1,2L3,4' } };
  try {
    const svg = R.mdiSymbol('mdi:weather-sunny');
    assert.match(svg, /<svg/);
    assert.match(svg, /d="M1,2L3,4"/);
    // Material-Design-Symbole sind Flaechen, keine Striche.
    assert.match(svg, /fill="currentColor"/);
    // Auch ohne das Praefix "mdi:" -- Home Assistant schreibt es, unsere Einstellungen nicht.
    assert.match(R.mdiSymbol('weather-sunny'), /<svg/);
    assert.strictEqual(R.mdiSymbol('gibtesnicht'), '');
  } finally { global.window = alt; }
});

test('Nur die Sensorkarte holt sich das Symbol aus Home Assistant', () => {
  const mitIcon = { state: '5', attributes: { icon: 'mdi:flower' } };
  assert.strictEqual(R.brauchtMdi('sensor', mitIcon, {}), true);
  // Eine Klimakarte nicht: Dort sagt die Bewegung des eigenen Symbols etwas, das ein fremdes
  // nicht sagen kann.
  assert.strictEqual(R.brauchtMdi('climate', mitIcon, {}), false);
  // Und die eigene Wahl schlaegt Home Assistant.
  assert.strictEqual(R.brauchtMdi('sensor', mitIcon, { icon: 'gate' }), false);
  assert.strictEqual(R.brauchtMdi('sensor', { state: '5', attributes: {} }, {}), false);
});

test('Fuer helles Design gibt es dunklere Sensorfarben', () => {
  // Die pastelligen Toene verschwinden auf hellem Grund fast vollstaendig. Und sie stehen in
  // JS statt im CSS, weil der Akzent direkt am Element gesetzt wird -- eine CSS-Regel kaeme
  // dagegen nicht an.
  assert.strictEqual(R.SENSOR_FARBEN_HELL.length, R.SENSOR_FARBEN.length);
  const hell = R.sensorAkzente(['sensor.a', 'sensor.b'], true);
  const dunkel = R.sensorAkzente(['sensor.a', 'sensor.b'], false);
  Object.keys(hell).forEach(k => assert.notStrictEqual(hell[k], dunkel[k], k));
  Object.values(hell).forEach(f => assert.ok(R.SENSOR_FARBEN_HELL.includes(f), f));
});
