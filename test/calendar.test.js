const test = require('node:test');
const assert = require('node:assert');
const calendar = require('../control/calendar');

test('Keywords werden kommagetrennt gelesen und normalisiert', () => {
  assert.deepStrictEqual(calendar.parseKeywords(' Italien , Urlaub ,, GÄSTE '), ['italien', 'urlaub', 'gäste']);
  assert.deepStrictEqual(calendar.parseKeywords(''), []);
  assert.deepStrictEqual(calendar.parseKeywords(null), []);
});

test('Ein Treffer ist ein Titel, der ein Keyword enthaelt -- unabhaengig von Gross-/Kleinschreibung', () => {
  const kw = ['italien'];
  assert.ok(calendar.isMatch({ summary: 'Italien' }, kw));
  assert.ok(calendar.isMatch({ summary: 'Urlaub Italien 2026' }, kw));
  assert.ok(calendar.isMatch({ summary: 'ITALIEN' }, kw));
  assert.ok(!calendar.isMatch({ summary: 'Spanien' }, kw));
  assert.ok(!calendar.isMatch({ summary: '' }, kw));
});

test('Die Beschreibung wird bewusst NICHT durchsucht', () => {
  const event = { summary: 'Zahnarzt', description: 'danach Italien buchen' };
  assert.ok(!calendar.isMatch(event, ['italien']));
});

test('Ganztages-Termine werden als lokale Mitternacht gelesen, nicht als UTC', () => {
  const d = calendar.toDate({ date: '2026-06-03' });
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 5);
  assert.strictEqual(d.getDate(), 3);
  assert.strictEqual(d.getHours(), 0);
});

test('Ein mehrtaegiger Ganztages-Termin deckt alle Tage ab -- das Enddatum ist ausschliessend', () => {
  // Home Assistant liefert fuer "3. bis 7. Juni" das Ende als 2026-06-08.
  const w = calendar.toWindow({ summary: 'Italien', start: { date: '2026-06-03' }, end: { date: '2026-06-08' } }, 0, 0);
  const during = new Date(2026, 5, 7, 23, 30); // spaeter Abend des letzten Tages
  const after = new Date(2026, 5, 8, 0, 30);   // schon der Folgetag
  assert.ok(during >= w.start && during < w.end, 'letzter Tag muss noch abgedeckt sein');
  assert.ok(!(after >= w.start && after < w.end), 'der Folgetag darf nicht mehr abgedeckt sein');
});

test('Vorlauf und Nachlauf verschieben das Anzeigefenster', () => {
  const w = calendar.toWindow({
    summary: 'Italien',
    start: { dateTime: '2026-06-03T14:00:00+02:00' },
    end: { dateTime: '2026-06-03T16:00:00+02:00' }
  }, 15, 30);
  assert.strictEqual(w.start.toISOString(), '2026-06-03T11:45:00.000Z');
  assert.strictEqual(w.end.toISOString(), '2026-06-03T14:30:00.000Z');
});

test('Termine ohne brauchbare Zeiten werden verworfen, statt ein kaputtes Fenster zu erzeugen', () => {
  assert.strictEqual(calendar.toWindow({ summary: 'x', start: {}, end: {} }, 0, 0), null);
  assert.strictEqual(calendar.toWindow({
    summary: 'x',
    start: { dateTime: '2026-06-03T16:00:00Z' },
    end: { dateTime: '2026-06-03T14:00:00Z' }
  }, 0, 0), null, 'Ende vor Beginn ergibt kein Fenster');
});

test('activeWindow und nextWindow trennen laufend von kommend', () => {
  const windows = [
    { title: 'A', start: new Date(2026, 0, 1, 8), end: new Date(2026, 0, 1, 10) },
    { title: 'B', start: new Date(2026, 0, 1, 14), end: new Date(2026, 0, 1, 16) }
  ];
  const now = new Date(2026, 0, 1, 9);
  assert.strictEqual(calendar.activeWindow(windows, now).title, 'A');
  assert.strictEqual(calendar.nextWindow(windows, now).title, 'B');

  const between = new Date(2026, 0, 1, 12);
  assert.strictEqual(calendar.activeWindow(windows, between), null);
  assert.strictEqual(calendar.nextWindow(windows, between).title, 'B');
});

test('Das Fensterende ist ausschliessend: exakt zur Endzeit laeuft kein Fenster mehr', () => {
  const windows = [{ title: 'A', start: new Date(2026, 0, 1, 8), end: new Date(2026, 0, 1, 10) }];
  assert.ok(calendar.activeWindow(windows, new Date(2026, 0, 1, 9, 59, 59)));
  assert.strictEqual(calendar.activeWindow(windows, new Date(2026, 0, 1, 10, 0, 0)), null);
});

test('Ohne Keywords wird gar nicht erst abgerufen', async () => {
  const windows = await calendar.fetchWindows({
    haUrl: 'http://example.invalid', token: 'x', entity: 'calendar.test', keywords: '   '
  });
  assert.deepStrictEqual(windows, []);
});

test('Unvollstaendige Konfiguration wirft, statt still eine leere Liste zu liefern', async () => {
  await assert.rejects(
    () => calendar.fetchWindows({ haUrl: '', token: '', entity: '', keywords: 'italien' }),
    /nicht vollständig konfiguriert/
  );
});
