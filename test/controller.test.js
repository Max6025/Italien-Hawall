const test = require('node:test');
const assert = require('node:assert');
const { Controller, isWithinNightLock, GRACE_MS } = require('../control/controller');

// Ein Speicher, der sich wie electron-store verhaelt, ohne Electron zu brauchen.
function fakeStore(values = {}) {
  const data = { ...values };
  return {
    get: (k) => data[k],
    set: (k, v) => { data[k] = v; },
    delete: (k) => { delete data[k]; },
    clear: () => { for (const k of Object.keys(data)) delete data[k]; },
    _data: data
  };
}

const FULL_CONFIG = {
  haUrl: 'http://ha.local:8123',
  token: 'geheim',
  calendarEnabled: true,
  calendarEntity: 'calendar.familie',
  calendarKeywords: 'italien'
};

function controllerWith(values, windows = []) {
  const c = new Controller({ store: fakeStore(values), logDir: null });
  c.windows = windows;
  c.panel.supported = false; // im Test nie PowerShell starten
  return c;
}

function windowAround(now, beforeMin, afterMin) {
  return [{
    title: 'Italien',
    start: new Date(now.getTime() - beforeMin * 60000),
    end: new Date(now.getTime() + afterMin * 60000)
  }];
}

test('Nachtsperre erkennt ein Fenster ueber Mitternacht', () => {
  const cfg = { nightModeEnabled: true, nightStart: '23:00', nightEnd: '06:30' };
  assert.ok(isWithinNightLock(cfg, new Date(2026, 0, 1, 23, 30)));
  assert.ok(isWithinNightLock(cfg, new Date(2026, 0, 1, 2, 0)));
  assert.ok(isWithinNightLock(cfg, new Date(2026, 0, 1, 6, 29)));
  assert.ok(!isWithinNightLock(cfg, new Date(2026, 0, 1, 6, 30)));
  assert.ok(!isWithinNightLock(cfg, new Date(2026, 0, 1, 12, 0)));
});

test('Nachtsperre erkennt auch ein Fenster innerhalb eines Tages', () => {
  const cfg = { nightModeEnabled: true, nightStart: '13:00', nightEnd: '15:00' };
  assert.ok(isWithinNightLock(cfg, new Date(2026, 0, 1, 14, 0)));
  assert.ok(!isWithinNightLock(cfg, new Date(2026, 0, 1, 16, 0)));
});

test('Ohne Kalender-Konfiguration wird niemals abgeschaltet', () => {
  const c = controllerWith({});
  c.startedAt = Date.now() - 2 * GRACE_MS; // Karenzzeit bewusst vorbei
  const d = c.decide(new Date());
  assert.strictEqual(d.on, true);
  assert.strictEqual(d.reason, 'nicht-konfiguriert');
});

test('Fehlende Keywords gelten als unvollstaendig -- sonst waere das Geraet nach dem Einschalten der Steuerung sofort dunkel', () => {
  const c = controllerWith({ ...FULL_CONFIG, calendarKeywords: '  ' });
  c.startedAt = Date.now() - 2 * GRACE_MS;
  assert.strictEqual(c.decide(new Date()).reason, 'nicht-konfiguriert');
});

test('Waehrend der Karenzzeit nach dem Start bleibt das Panel an', () => {
  const c = controllerWith(FULL_CONFIG);
  const d = c.decide(new Date());
  assert.strictEqual(d.on, true);
  assert.strictEqual(d.reason, 'karenzzeit');
});

test('Nach der Karenzzeit schaltet ein fehlender Treffer ab', () => {
  const c = controllerWith(FULL_CONFIG);
  c.startedAt = Date.now() - 2 * GRACE_MS;
  const d = c.decide(new Date());
  assert.strictEqual(d.on, false);
  assert.strictEqual(d.reason, 'kein-treffer');
});

test('Ein laufendes Anzeigefenster schaltet ein', () => {
  const now = new Date();
  const c = controllerWith(FULL_CONFIG, windowAround(now, 30, 30));
  c.startedAt = Date.now() - 2 * GRACE_MS;
  const d = c.decide(now);
  assert.strictEqual(d.on, true);
  assert.strictEqual(d.reason, 'anzeigefenster');
  assert.strictEqual(d.window.title, 'Italien');
});

test('Die Nachtsperre hat Vorrang vor einem laufenden Anzeigefenster', () => {
  const now = new Date(2026, 0, 1, 23, 30);
  const c = controllerWith({ ...FULL_CONFIG, nightModeEnabled: true, nightStart: '23:00', nightEnd: '06:30' },
    windowAround(now, 60, 60));
  c.startedAt = now.getTime() - 2 * GRACE_MS;
  const d = c.decide(now);
  assert.strictEqual(d.on, false);
  assert.strictEqual(d.reason, 'nachtsperre');
});

test('Die Pause schlaegt die Nachtsperre -- sonst waere das Geraet nachts nicht bedienbar', () => {
  const now = new Date(2026, 0, 1, 23, 30);
  const c = controllerWith({ ...FULL_CONFIG, nightModeEnabled: true, nightStart: '23:00', nightEnd: '06:30' });
  c.startedAt = now.getTime() - 2 * GRACE_MS;
  c.pausedUntil = now.getTime() + 10 * 60000;
  const d = c.decide(now);
  assert.strictEqual(d.on, true);
  assert.strictEqual(d.reason, 'pause');
});

test('Eine abgelaufene Pause wirkt nicht mehr', () => {
  const now = new Date();
  const c = controllerWith(FULL_CONFIG);
  c.startedAt = Date.now() - 2 * GRACE_MS;
  c.pausedUntil = now.getTime() - 1000;
  assert.strictEqual(c.decide(now).on, false);
});

test('Ein Netzausfall laesst die zuletzt bekannten Fenster stehen (ADR 0003)', async () => {
  const now = new Date();
  const c = controllerWith({ ...FULL_CONFIG, haUrl: 'http://127.0.0.1:1' }, windowAround(now, 30, 30));
  c.startedAt = Date.now() - 2 * GRACE_MS;
  await c.poll(); // schlaegt fehl: Port 1 nimmt nichts an
  assert.strictEqual(c.consecutiveFailures, 1);
  assert.strictEqual(c.windows.length, 1, 'die Fenster duerfen nicht geleert werden');
  assert.strictEqual(c.decide(now).on, true, 'das Panel bleibt an, weil der Treffer weiterhin gilt');
});

test('Die Fehlerseite erscheint erst nach drei Fehlversuchen -- und nie bei ausgeschaltetem Panel', () => {
  const now = new Date();
  const c = controllerWith(FULL_CONFIG, windowAround(now, 30, 30));
  c.startedAt = Date.now() - 2 * GRACE_MS;
  c.lastError = 'fetch failed';
  c.errorSince = now.toISOString();

  c.consecutiveFailures = 2;
  assert.strictEqual(c.buildState(c.decide(now), now).showError, false, 'zwei Fehlversuche reichen nicht');

  c.consecutiveFailures = 3;
  assert.strictEqual(c.buildState(c.decide(now), now).showError, true, 'bei laufendem Termin sichtbar');

  c.windows = []; // kein Treffer mehr -> Panel aus
  const stateOff = c.buildState(c.decide(now), now);
  assert.strictEqual(stateOff.panelOn, false);
  assert.strictEqual(stateOff.showError, false, 'ein Netzausfall darf das Panel nicht wecken');
});

test('pause() setzt ein Ende in der Zukunft, resume() hebt sie sofort auf', () => {
  const c = controllerWith(FULL_CONFIG);
  const until = c.pause(15);
  assert.ok(until > Date.now() + 14 * 60000);
  c.resume();
  assert.strictEqual(c.pausedUntil, 0);
});
