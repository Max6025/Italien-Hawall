// Tests fuer den Akkustand des Panels -- ueber HTTP, nicht am Modul vorbei.
//
// Die Lehre aus dem Import-Pfad gilt hier genauso: Das Modul kann in Ordnung sein und der Weg
// dorthin trotzdem falsch. Und dieser Weg hat eine Besonderheit -- er geht in BEIDE Richtungen:
// Die Anzeige schreibt, die Einrichtungsseite liest. Faellt eine Haelfte aus, steht in der
// Leiste einfach nichts, und niemand sieht, an welcher Haelfte es lag.

const test = require('node:test');
const assert = require('node:assert');
const { startServer } = require('../server/setup-server');

function fakeStore(values = {}) {
  const data = { ...values };
  return {
    get: (k) => data[k],
    set: (k, v) => { data[k] = v; },
    delete: (k) => { delete data[k]; },
    clear: () => { for (const k of Object.keys(data)) delete data[k]; },
    path: require('node:path').join(require('node:os').tmpdir(), 'akku-test-config.json')
  };
}

const PORT = 18790;
const U = (pfad) => `http://127.0.0.1:${PORT}${pfad}`;
let server;
let live;

test.before(() => {
  const app = startServer({
    port: PORT, store: fakeStore({ haUrl: 'http://ha.invalid', token: 'geheim' }),
    onConfigSaved: () => {}, getLocalIps: () => [],
    updater: { currentVersion: '1.0.0', getState: () => ({}), check: () => {}, install: () => {} },
    controller: null
  });
  server = app.server;
  live = app.haLive;
});

test.after(() => {
  if (server) server.close();
  if (live) live.stop();
});

const melden = (koerper) => fetch(U('/api/geraet/akku'), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(koerper)
});

test('Ohne Meldung sagt der Server ehrlich "nichts bekannt"', async () => {
  // Nicht 404 und nicht 0 %: Beides liest sich in der Leiste wie eine Aussage ueber den Akku.
  const d = await fetch(U('/api/geraet/akku')).then(r => r.json());
  assert.strictEqual(d.ok, true);
  assert.strictEqual(d.akku, null);
});

test('Ein gemeldeter Stand kommt unveraendert zurueck', async () => {
  assert.strictEqual((await melden({ prozent: 42, laedt: true })).status, 200);
  const d = await fetch(U('/api/geraet/akku')).then(r => r.json());
  assert.deepStrictEqual(d.akku, { prozent: 42, laedt: true });
});

test('Das Alter wird mitgeliefert', async () => {
  // Ohne das Alter stuende ein Stand von vorgestern in der Leiste und saehe aus wie jetzt.
  await melden({ prozent: 80, laedt: false });
  const d = await fetch(U('/api/geraet/akku')).then(r => r.json());
  assert.ok(typeof d.alterSekunden === 'number', JSON.stringify(d));
  assert.ok(d.alterSekunden < 5, 'frisch gemeldet: ' + d.alterSekunden);
});

test('Unsinnige Werte werden abgelehnt, nicht gespeichert', async () => {
  await melden({ prozent: 55, laedt: false });
  for (const unsinn of [{ prozent: -1 }, { prozent: 101 }, { prozent: 'voll' }, {}, { laedt: true }]) {
    const r = await melden(unsinn);
    assert.strictEqual(r.status, 400, JSON.stringify(unsinn));
  }
  const d = await fetch(U('/api/geraet/akku')).then(r => r.json());
  assert.strictEqual(d.akku.prozent, 55, 'der letzte gute Wert muss stehen bleiben');
});

test('Ein Komma-Wert wird auf ganze Prozent gerundet', async () => {
  // navigator.getBattery liefert einen Bruch; gerundet wird an genau einer Stelle.
  await melden({ prozent: 66.6, laedt: false });
  const d = await fetch(U('/api/geraet/akku')).then(r => r.json());
  assert.strictEqual(d.akku.prozent, 67);
});

test('Die Einstellung fuer den Warnton steht in der Konfiguration', async () => {
  // Ab Werk an: Wer nichts einstellt, soll gewarnt werden -- eine Warnung, die man erst
  // einschalten muss, ist fuer die meisten keine.
  const cfg = await fetch(U('/api/config')).then(r => r.json());
  assert.strictEqual(cfg.batterySound, true);
});

test('Eine Aenderung erreicht den Ereignisstrom sofort', async () => {
  // Ohne diesen Weg saehe man ein angestecktes Netzteil erst beim naechsten Abruf -- und der
  // laeuft, seit es den Strom gibt, nur noch jede Minute.
  await melden({ prozent: 30, laedt: false });

  const controller = new AbortController();
  const r = await fetch(U('/api/geraet/akku/live'), { signal: controller.signal });
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('content-type') || '', /text\/event-stream/);

  const leser = r.body.getReader();
  const text = () => leser.read().then(({ value }) => new TextDecoder().decode(value));

  // Der erste Block kommt sofort: Wer sich anmeldet, soll nicht auf die naechste Aenderung
  // warten muessen, um ueberhaupt etwas zu sehen.
  const erst = await text();
  assert.match(erst, /"prozent":30/, erst);

  await melden({ prozent: 31, laedt: true });
  const zweit = await text();
  assert.match(zweit, /"prozent":31/, zweit);
  assert.match(zweit, /"laedt":true/, zweit);

  controller.abort();
});

test('Ein Lebenszeichen ohne Aenderung loest kein Ereignis aus', async () => {
  // Die Anzeige meldet sich alle fuenf Minuten auch unveraendert, damit die Leiste sie nicht
  // fuer abgeschaltet haelt. Daraus ein Ereignis zu machen waere Laerm ohne Inhalt.
  await melden({ prozent: 44, laedt: false });

  const controller = new AbortController();
  const r = await fetch(U('/api/geraet/akku/live'), { signal: controller.signal });
  const leser = r.body.getReader();
  await leser.read();                       // der erste Block

  await melden({ prozent: 44, laedt: false });   // unveraendert
  await melden({ prozent: 45, laedt: false });   // geaendert

  const { value } = await leser.read();
  const block = new TextDecoder().decode(value);
  assert.match(block, /"prozent":45/, 'der unveraenderte Stand haette nicht kommen duerfen: ' + block);

  controller.abort();
});
