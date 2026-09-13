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

// --- Eingabeerkennung -------------------------------------------------------------------------
//
// Anlass: Der Aussperr-Schutz ueber powerMonitor greift nur bei "resume" und "unlock-screen".
// Beruehrt jemand ein bloss dunkel geschaltetes Panel, feuert keines von beiden -- es gab weder
// Standby noch Entsperrung. Der Waechter schaltete fuenf Sekunden spaeter wieder ab, und wer
// davorstand, kam nicht ans Geraet.

function controllerMitLeerlauf(values, idle, windows = []) {
  const c = new Controller({ store: fakeStore(values), logDir: null, idleSeconds: () => idle });
  c.windows = windows;
  c.panel.supported = false;
  c.startedAt = Date.now() - 2 * GRACE_MS;
  return c;
}

test('Eine frische Eingabe pausiert, statt den Bildschirm wieder abzuschalten', () => {
  const c = controllerMitLeerlauf(FULL_CONFIG, 1); // vor einer Sekunde beruehrt
  assert.strictEqual(c.decide(new Date()).on, false, 'ohne Eingabe waere abgeschaltet worden');
  c.tick();
  assert.ok(c.pausedUntil > Date.now(), 'es muss eine Pause gesetzt worden sein');
  assert.strictEqual(c.state.panelOn, true, 'das Panel bleibt an');
  assert.strictEqual(c.state.reason, 'pause');
});

test('Laengeres Nichtstun loest keine Pause aus', () => {
  const c = controllerMitLeerlauf(FULL_CONFIG, 600); // zehn Minuten nichts angefasst
  c.tick();
  assert.strictEqual(c.pausedUntil, 0);
  assert.strictEqual(c.state.panelOn, false);
});

test('Bei laufendem Termin wird gar nicht erst auf Eingaben geschaut', () => {
  // Wichtig gegen eine Rueckkopplung: Das Einschalten wackelt mit dem Mauszeiger (panel.js).
  // Wuerde das als Benutzereingabe zaehlen, haette die Steuerung sich selbst am Leben gehalten.
  const now = new Date();
  const fenster = [{ title: 'Italien', start: new Date(now.getTime() - 60000), end: new Date(now.getTime() + 60000) }];
  const c = controllerMitLeerlauf(FULL_CONFIG, 0, fenster);
  c.tick();
  assert.strictEqual(c.pausedUntil, 0, 'keine Pause, weil ohnehin eingeschaltet wird');
  assert.strictEqual(c.state.reason, 'anzeigefenster');
});

test('Ohne Leerlauf-Geber verhaelt sich der Controller wie bisher', () => {
  const c = new Controller({ store: fakeStore(FULL_CONFIG), logDir: null });
  c.panel.supported = false;
  c.startedAt = Date.now() - 2 * GRACE_MS;
  c.tick();
  assert.strictEqual(c.pausedUntil, 0);
  assert.strictEqual(c.state.panelOn, false);
});

test('Ein fehlerhafter Leerlauf-Geber legt die Steuerung nicht lahm', () => {
  const c = new Controller({
    store: fakeStore(FULL_CONFIG), logDir: null,
    idleSeconds: () => { throw new Error('kaputt'); }
  });
  c.panel.supported = false;
  c.startedAt = Date.now() - 2 * GRACE_MS;
  c.tick();
  assert.strictEqual(c.state.panelOn, false, 'faellt auf das normale Verhalten zurueck');
});

test('Das laufende Anzeigefenster steht auch waehrend Karenzzeit und Pause im Zustand', () => {
  // Anlass: Waehrend der Karenzzeit haengt die Entscheidung nicht am Anzeigefenster, und der
  // Zustand meldete deshalb activeWindow: null -- obwohl der Termin lief. Das Dashboard hielt
  // es danach fuer einen neuen Termin und kuendigte ihn erneut an.
  const now = new Date();
  const fenster = windowAround(now, 120, 120);   // laeuft seit zwei Stunden
  const c = controllerWith(FULL_CONFIG, fenster);

  // Karenzzeit: Entscheidung ist "karenzzeit", nicht "anzeigefenster"
  const zustandKarenz = c.buildState(c.decide(now), now);
  assert.strictEqual(zustandKarenz.reason, 'karenzzeit');
  assert.ok(zustandKarenz.activeWindow, 'das laufende Fenster fehlt im Zustand');
  assert.strictEqual(zustandKarenz.activeWindow.title, 'Italien');

  // Pause: dasselbe
  c.startedAt = Date.now() - 2 * GRACE_MS;
  c.pausedUntil = Date.now() + 60000;
  const zustandPause = c.buildState(c.decide(now), now);
  assert.strictEqual(zustandPause.reason, 'pause');
  assert.ok(zustandPause.activeWindow, 'das laufende Fenster fehlt waehrend der Pause');
});

test('Ohne laufenden Termin bleibt activeWindow leer', () => {
  const c = controllerWith(FULL_CONFIG, []);
  c.startedAt = Date.now() - 2 * GRACE_MS;
  const z = c.buildState(c.decide(new Date()), new Date());
  assert.strictEqual(z.activeWindow, null);
});

// --- Auf Ankunft warten -----------------------------------------------------------------------
//
// Die Rangfolge ist hier das Eigentliche: "gerade angekommen" steht ueber der Nachtsperre,
// "noch nicht angekommen" darunter. Wer die beiden vertauscht, bekommt entweder eine Wand, die
// nachts nicht angeht, wenn jemand ankommt, oder eine, die ab Mitternacht gegen ein leeres Haus
// leuchtet. Beides sieht man erst am Geraet.

const ANKUNFT_CONFIG = {
  ...FULL_CONFIG,
  ankunftEnabled: true,
  ankunftEntity: 'alarm_control_panel.haus'
};

function ankunftController(werte, jetzt, zustand) {
  const c = controllerWith({ ...ANKUNFT_CONFIG, ...werte }, windowAround(jetzt, 600, 600));
  c.startedAt = jetzt.getTime() - GRACE_MS - 1000;   // Karenzzeit vorbei
  c.ankunftZustand = zustand;
  return c;
}

test('Termin laeuft, Anlage scharf: das Panel bleibt aus', () => {
  const jetzt = new Date(2026, 5, 3, 10, 0);
  const c = ankunftController({}, jetzt, 'armed_away');
  c.ankunftAktualisieren(jetzt);
  const d = c.decide(jetzt);
  assert.strictEqual(d.on, false);
  assert.strictEqual(d.reason, 'warte-auf-ankunft');
});

test('Anlage wechselt auf zu Hause: das Panel geht an', () => {
  const jetzt = new Date(2026, 5, 3, 10, 0);
  const c = ankunftController({}, jetzt, 'armed_away');
  c.ankunftAktualisieren(jetzt);
  assert.strictEqual(c.decide(jetzt).on, false);

  c.ankunftZustand = 'disarmed';
  c.ankunftAktualisieren(jetzt);
  assert.strictEqual(c.decide(jetzt).on, true);
});

test('Die Ankunft wird gemerkt -- spaeter wieder scharf schaltet nichts ab', () => {
  // Wer tagsueber wegfaehrt, soll abends nicht vor einer dunklen Wand stehen.
  const jetzt = new Date(2026, 5, 3, 10, 0);
  const c = ankunftController({}, jetzt, 'disarmed');
  c.ankunftAktualisieren(jetzt);

  c.ankunftZustand = 'armed_away';
  const spaeter = new Date(2026, 5, 3, 15, 0);
  c.ankunftAktualisieren(spaeter);
  assert.strictEqual(c.decide(spaeter).on, true);
  assert.strictEqual(c.decide(spaeter).reason, 'anzeigefenster');
});

test('Nach der Ankunft schlaegt das Panel die Nachtsperre', () => {
  // Wer um halb eins nachts ankommt, wird begruesst, statt vor einer schwarzen Wand zu stehen.
  const jetzt = new Date(2026, 5, 3, 0, 30);
  const c = ankunftController(
    { nightModeEnabled: true, nightStart: '23:00', nightEnd: '06:30', ankunftNachMinuten: 60 },
    jetzt, 'disarmed');
  c.ankunftAktualisieren(jetzt);
  const d = c.decide(jetzt);
  assert.strictEqual(d.on, true);
  assert.strictEqual(d.reason, 'ankunft');
});

test('Nach Ablauf der Frist greift die Nachtsperre wieder', () => {
  const ankunftZeit = new Date(2026, 5, 3, 0, 30);
  const c = ankunftController(
    { nightModeEnabled: true, nightStart: '23:00', nightEnd: '06:30', ankunftNachMinuten: 60 },
    ankunftZeit, 'disarmed');
  c.ankunftAktualisieren(ankunftZeit);

  const spaeter = new Date(2026, 5, 3, 2, 0);   // 90 Minuten nach der Ankunft
  assert.strictEqual(c.decide(spaeter).reason, 'nachtsperre');
});

test('Ein unbekannter Zustand haelt das Panel NICHT auf', () => {
  // Ein Tippfehler in der Entitaets-ID darf nicht heissen, dass die Wand nie wieder angeht.
  const jetzt = new Date(2026, 5, 3, 10, 0);
  const c = ankunftController({}, jetzt, null);
  c.ankunftAktualisieren(jetzt);
  assert.strictEqual(c.decide(jetzt).on, true);
  assert.strictEqual(c.decide(jetzt).reason, 'anzeigefenster');
});

test('Abgeschaltet verhaelt sich alles wie vorher', () => {
  const jetzt = new Date(2026, 5, 3, 10, 0);
  const c = ankunftController({ ankunftEnabled: false }, jetzt, 'armed_away');
  c.ankunftAktualisieren(jetzt);
  assert.strictEqual(c.decide(jetzt).on, true);
});

test('Ein neuer Termin wartet wieder auf eine neue Ankunft', () => {
  // Sonst begruesste das Geraet die naechsten Gaeste gar nicht mehr: Der Vermerk vom letzten
  // Aufenthalt haette gereicht, um sofort anzugehen.
  const jetzt = new Date(2026, 5, 3, 10, 0);
  const c = ankunftController({}, jetzt, 'disarmed');
  c.ankunftAktualisieren(jetzt);
  assert.ok(c.ankunftZeit > 0);

  c.windows = windowAround(new Date(2026, 8, 1, 10, 0), 600, 600);
  c.ankunftZustand = 'armed_away';
  const naechster = new Date(2026, 8, 1, 10, 0);
  c.ankunftAktualisieren(naechster);
  assert.strictEqual(c.ankunftZeit, 0);
  assert.strictEqual(c.decide(naechster).reason, 'warte-auf-ankunft');
});

test('Die Ankunft ueberlebt einen Neustart', () => {
  // Ein Update mitten im Aufenthalt wuerde sonst wieder auf eine Ankunft warten, die laengst
  // passiert ist -- und die Wand bliebe dunkel, bis jemand die Anlage anfasst.
  const jetzt = new Date(2026, 5, 3, 10, 0);
  const fenster = windowAround(jetzt, 600, 600);
  const store = fakeStore({ ...ANKUNFT_CONFIG });
  const c1 = new Controller({ store, logDir: null });
  c1.panel.supported = false;
  c1.windows = fenster;
  c1.ankunftZustand = 'disarmed';
  c1.ankunftAktualisieren(jetzt);

  const c2 = new Controller({ store, logDir: null });   // "Neustart" mit demselben Speicher
  c2.panel.supported = false;
  c2.windows = fenster;
  c2.startedAt = jetzt.getTime() - GRACE_MS - 1000;
  c2.ankunftZustand = 'armed_away';                      // wieder scharf, HA gerade befragt
  c2.ankunftAktualisieren(jetzt);
  assert.strictEqual(c2.decide(jetzt).on, true);
});

test('Eine Live-Meldung fuer eine fremde Entitaet aendert nichts', () => {
  const jetzt = new Date(2026, 5, 3, 10, 0);
  const c = ankunftController({}, jetzt, 'armed_away');
  c.zustandGemeldet('light.kueche', 'on');
  assert.strictEqual(c.ankunftZustand, 'armed_away');
});

test('Eine Live-Meldung fuer die eigene Entitaet schaltet sofort', () => {
  // Vor der Haustuer sind zwei Minuten dunkle Wand eine lange Zeit.
  //
  // Hier liegt das Anzeigefenster um die ECHTE Uhrzeit herum: zustandGemeldet() loest einen
  // Takt aus, und der rechnet mit der echten Uhr -- ein erfundener Zeitpunkt haette hier gar
  // kein laufendes Fenster.
  //
  // Der Beginn ist die HEUTIGE Mitternacht, nicht "zehn Stunden zurueck": Gewartet wird nur am
  // ersten Tag, und zehn Stunden vor 00:30 Uhr liegen im Vortag -- der Test waere dann
  // zwischen Mitternacht und zehn Uhr morgens durchgefallen und sonst nicht. Genau so ist er
  // beim ersten Mal um 23 Uhr durchgelaufen und um 1 Uhr rot geworden.
  const jetzt = new Date();
  const heuteBeginn = new Date(jetzt); heuteBeginn.setHours(0, 0, 0, 0);
  const c = ankunftController({}, jetzt, 'armed_away');
  c.windows = [{ title: 'Italien', start: heuteBeginn, end: new Date(jetzt.getTime() + 10 * 3600000) }];
  c.ankunftAktualisieren(jetzt);
  assert.strictEqual(c.decide(jetzt).on, false);

  c.zustandGemeldet('alarm_control_panel.haus', 'disarmed');
  assert.strictEqual(c.ankunftZustand, 'disarmed');
  assert.ok(c.ankunftZeit > 0, 'die Ankunft muss im selben Takt vermerkt sein');
  assert.strictEqual(c.decide(new Date()).on, true);
});

test('Der Start der App loescht keinen Ankunftsvermerk', () => {
  // Beim ersten Takt ist die Fensterliste leer, weil noch niemand gefragt hat -- nicht, weil
  // kein Termin laeuft. Wer hier aufraeumt, wartet nach jedem Neustart wieder auf eine Ankunft,
  // die laengst passiert ist.
  const store = fakeStore({
    ...ANKUNFT_CONFIG,
    ankunftErkanntFuer: '2026-06-03T00:00:00.000Z',
    ankunftErkanntZeit: Date.parse('2026-06-03T18:00:00Z')
  });
  const c = new Controller({ store, logDir: null });
  c.panel.supported = false;
  c.ankunftAktualisieren(new Date());       // Takt ohne je abgerufene Fenster
  assert.strictEqual(c.ankunftFuer, '2026-06-03T00:00:00.000Z');
  assert.ok(c.ankunftZeit > 0);
});
