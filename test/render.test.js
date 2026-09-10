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
