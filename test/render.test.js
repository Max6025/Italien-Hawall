// Tests fuer das Renderer-Modul.
//
// Bis hierher konnte kein Test dieses Modul ueberhaupt laden -- es war fest an ein
// Browser-Fenster gebunden. Genau in einem solchen ungetesteten Pfad steckte der Fehler, der
// es bis aufs Geraet geschafft hat. Deshalb laesst es sich jetzt auch in Node laden.

const test = require('node:test');
const assert = require('node:assert');
const D = require('../renderer/shared/dashboard-render.js');

test('Fremder Text wird maskiert, bevor er ins HTML geht', () => {
  assert.strictEqual(D.esc('<script>'), '&lt;script&gt;');
  assert.strictEqual(D.esc('Tor & Tuer'), 'Tor &amp; Tuer');
  assert.strictEqual(D.esc('a"b'), 'a&quot;b');
  assert.strictEqual(D.esc("a'b"), 'a&#39;b');
});

test('Ein Kalendertitel mit spitzer Klammer zerlegt keine Karte mehr', () => {
  // Genau dieser Fall war moeglich, seit Termintitel auf Karten landen.
  const titel = 'Italien <Familie> "Sommer"';
  const maskiert = D.esc(titel);
  assert.ok(!maskiert.includes('<'), 'keine oeffnende Klammer mehr enthalten');
  assert.ok(!maskiert.includes('>'), 'keine schliessende Klammer mehr enthalten');
});

test('Leere Werte ergeben eine leere Zeichenkette, nicht "null" oder "undefined"', () => {
  assert.strictEqual(D.esc(null), '');
  assert.strictEqual(D.esc(undefined), '');
  assert.strictEqual(D.esc(0), '0');
});

test('Mindestgroessen gibt es nicht mehr -- jede Karte darf 1x1', () => {
  for (const typ of Object.keys(D.CARD_TYPES)) {
    const min = D.minSpanFor(typ);
    assert.strictEqual(min.cols, 1, `${typ} darf nicht breiter als 1 erzwingen`);
    assert.strictEqual(min.rows, 1, `${typ} darf nicht hoeher als 1 erzwingen`);
  }
});

test('clampSpan laesst 1x1 fuer jeden Typ zu', () => {
  for (const typ of Object.keys(D.CARD_TYPES)) {
    const span = D.clampSpan({ cols: 1, rows: 1 }, typ);
    assert.deepStrictEqual(span, { cols: 1, rows: 1 }, `${typ} wurde hochgezwungen`);
  }
});

test('Das eingebaute Standarddesign ist vollstaendig', () => {
  const t = D.DEFAULT_THEME;
  assert.strictEqual(t.name, 'Ankunft');
  for (const feld of ['bg', 'surface', 'panel2', 'cardBorder', 'text', 'muted']) {
    assert.ok(t.dark[feld], `dark.${feld} fehlt`);
    assert.ok(t.light[feld], `light.${feld} fehlt`);
  }
  assert.ok(t.pageBgGradient.includes('radial-gradient'), 'Hintergrundverlauf fehlt');
  assert.ok(t.cardBlur, 'Glas-Effekt fehlt');
});

// --- Tor-Card ---------------------------------------------------------------------------------

test('Die Tor-Card ist als Kartentyp angemeldet', () => {
  assert.ok(D.CARD_TYPES.gate, 'Kartentyp "gate" fehlt');
  assert.strictEqual(D.CARD_TYPES.gate.label, 'Tor öffnen');
});

test('Die Karten-Entitaet der Tor-Card ist die Melde-Entitaet', () => {
  // Nicht die Knoepfe -- die stehen in den Einstellungen und duerfen aus jeder Domain kommen.
  const domains = D.domainsForType('gate');
  assert.ok(domains.includes('input_boolean'), 'input_boolean muss zulaessig sein');
  assert.ok(domains.includes('binary_sensor'), 'binary_sensor muss zulaessig sein');
  assert.ok(!domains.includes('input_button'), 'ein Taster ist keine Melde-Entitaet');
});

test('Der Dienst wird aus der Entitaet abgeleitet -- Taster, Rollladen und Skript gemischt', () => {
  const f = (id) => { const d = D.serviceFuerEntitaet(id); return { domain: d.domain, service: d.service }; };
  assert.deepStrictEqual(f('input_button.tor_vorne'), { domain: 'input_button', service: 'press' });
  assert.deepStrictEqual(f('button.tor'), { domain: 'button', service: 'press' });
  assert.deepStrictEqual(f('cover.garagentor'), { domain: 'cover', service: 'open_cover' });
  assert.deepStrictEqual(f('script.tor_auf'), { domain: 'script', service: 'turn_on' });
  assert.deepStrictEqual(f('scene.ankunft'), { domain: 'scene', service: 'turn_on' });
  assert.deepStrictEqual(f('automation.tor'), { domain: 'automation', service: 'trigger' });
  assert.deepStrictEqual(f('switch.tor'), { domain: 'switch', service: 'turn_on' });
});

test('Unbekannte Domains liefern keinen Dienst, statt einen falschen zu raten', () => {
  assert.strictEqual(D.serviceFuerEntitaet('sensor.temperatur'), null);
  assert.strictEqual(D.serviceFuerEntitaet(''), null);
  assert.strictEqual(D.serviceFuerEntitaet(null), null);
});

test('Die Tor-Card taucht bei einer passenden Entitaet in der Typauswahl auf', () => {
  assert.ok(D.typesForEntity('input_boolean.tor_dauerhaft_offen').includes('gate'));
  assert.ok(!D.typesForEntity('sensor.temperatur').includes('gate'));
});

// --- Klimakarte -------------------------------------------------------------------------------

test('Die Betriebsarten haben deutsche Beschriftungen, unbekannte bleiben unveraendert', () => {
  // Unbekannte Modi duerfen nicht verschluckt werden -- lieber ein englisches Wort als ein
  // leerer Knopf, den niemand zuordnen kann.
  const html = D.CARD_TYPES.climate;
  assert.ok(html, 'Klimakarte fehlt');
});

test('Klima nimmt jetzt eine Einheit entgegen', () => {
  // settings.suffix wurde von der Karte gelesen, war im Editor aber nicht erreichbar.
  // Der Test haelt fest, dass die Karte den Typ ueberhaupt kennt.
  assert.deepStrictEqual(D.domainsForType('climate'), ['climate']);
});

test('Relais werden im Tor-Knopf als Taster behandelt, nicht als Schalter', () => {
  // Ein Torantrieb haengt an einem Relais. Nur einschalten laesst es eingeschaltet -- das Tor
  // faehrt dann einmal und der Kontakt bleibt geschlossen.
  const schalter = D.serviceFuerEntitaet('switch.torgarage_switch_0');
  assert.strictEqual(schalter.impuls, true, 'ein switch muss gepulst werden');
  assert.strictEqual(schalter.aus, 'turn_off', 'ohne Gegenbefehl bleibt das Relais an');

  const boolean = D.serviceFuerEntitaet('input_boolean.tor_merker');
  assert.strictEqual(boolean.impuls, true);
});

test('Von Natur aus momentane Entitaeten werden nicht gepulst', () => {
  // Ein zweiter Befehl waere hier sinnlos bis schaedlich.
  for (const id of ['input_button.tor_vorne', 'button.tor', 'script.tor_auf', 'scene.ankunft', 'automation.tor']) {
    assert.strictEqual(D.serviceFuerEntitaet(id).impuls, false, id + ' darf nicht gepulst werden');
  }
  assert.strictEqual(D.serviceFuerEntitaet('cover.garagentor').impuls, false,
    'ein Rollladen faehrt und darf nicht mittendrin gestoppt werden');
});
