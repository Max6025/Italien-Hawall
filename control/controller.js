// Der Zustandsautomat, der entscheidet, ob das Panel an oder aus sein soll.
//
// Die Rangfolge ist bewusst starr und steht an genau einer Stelle (decide()). Sie lautet von
// oben nach unten -- die erste zutreffende Regel gewinnt:
//
//   1. Kalendersteuerung aus oder unvollständig  -> Panel an   (sonst wäre das Gerät nicht einzurichten)
//   2. Karenzzeit nach dem Start                 -> Panel an   (Rettungsanker nach einem Windows-Update)
//   3. Pause aktiv                               -> Panel an   (jemand steht davor und will bedienen)
//   4. Nachtsperre aktiv                         -> Panel aus  (hat Vorrang vor dem Anzeigefenster)
//   5. Ein Anzeigefenster läuft                  -> Panel an
//   6. sonst                                     -> Panel aus
//
// Bei nicht erreichbarem Home Assistant bleiben die zuletzt bekannten Anzeigefenster stehen,
// statt auf eine leere Liste zurückzufallen: siehe docs/adr/0003-stillbleiben-bei-netzausfall.md

const fs = require('fs');
const path = require('path');
const calendar = require('./calendar');
const { Panel } = require('./panel');

const TICK_MS = 5 * 1000;               // Wächter-Takt
const POLL_MS = 2 * 60 * 1000;          // Kalender-Abruf
const GRACE_MS = 1 * 60 * 1000;         // Karenzzeit nach dem Start (auf Wunsch von 10 auf 1 Minute)
const PAUSE_MS = 30 * 60 * 1000;        // Dauer einer Pause
const FAILURES_BEFORE_ERROR = 3;        // erst danach erscheint die Fehlerseite

function parseHM(str) {
  const parts = String(str || '').split(':').map(Number);
  if (isNaN(parts[0])) return null;
  return parts[0] * 60 + (parts[1] || 0);
}

// Nachtsperre darf über Mitternacht laufen (23:00 bis 06:30).
function isWithinNightLock(cfg, now) {
  if (!cfg.nightModeEnabled) return false;
  const start = parseHM(cfg.nightStart || '23:00');
  const end = parseHM(cfg.nightEnd || '06:30');
  if (start === null || end === null || start === end) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  return start > end ? (cur >= start || cur < end) : (cur >= start && cur < end);
}

class Controller {
  constructor({ store, logDir, onStateChange }) {
    this.store = store;
    this.onStateChange = onStateChange || (() => {});
    this.logFile = logDir ? path.join(logDir, 'kalendersteuerung.log') : null;
    this.panel = new Panel((level, msg) => this.log(level, msg));

    this.startedAt = Date.now();
    this.pausedUntil = 0;
    this.windows = [];            // zuletzt erfolgreich abgerufene Anzeigefenster
    this.lastPollOk = null;
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.errorSince = null;
    this.state = null;
    this.tickTimer = null;
    this.pollTimer = null;
  }

  log(level, message) {
    const line = `${new Date().toISOString()} [${level}] ${message}\n`;
    if (!this.logFile) return;
    try {
      fs.appendFileSync(this.logFile, line);
    } catch (e) {
      // Protokollieren darf die Steuerung niemals zum Absturz bringen
    }
  }

  config() {
    const g = (k, d) => {
      const v = this.store.get(k);
      return v === undefined || v === null ? d : v;
    };
    return {
      haUrl: g('haUrl', ''),
      token: g('token', ''),
      enabled: !!g('calendarEnabled', false),
      entity: g('calendarEntity', ''),
      keywords: g('calendarKeywords', ''),
      leadMinutes: Number(g('calendarLeadMinutes', 0)) || 0,
      trailMinutes: Number(g('calendarTrailMinutes', 0)) || 0,
      nightModeEnabled: !!g('nightModeEnabled', false),
      nightStart: g('nightStart', '23:00'),
      nightEnd: g('nightEnd', '06:30')
    };
  }

  // Vollständig konfiguriert heißt: eingeschaltet, HA erreichbar konfiguriert, Entität gesetzt
  // und mindestens ein Keyword vorhanden. Fehlt eines davon, schaltet nie etwas ab.
  isConfigured(cfg) {
    return !!(cfg.enabled && cfg.haUrl && cfg.token && cfg.entity &&
      calendar.parseKeywords(cfg.keywords).length > 0);
  }

  decide(now = new Date()) {
    const cfg = this.config();
    if (!this.isConfigured(cfg)) return { on: true, reason: 'nicht-konfiguriert' };
    if (now.getTime() - this.startedAt < GRACE_MS) return { on: true, reason: 'karenzzeit' };
    if (now.getTime() < this.pausedUntil) return { on: true, reason: 'pause' };
    if (isWithinNightLock(cfg, now)) return { on: false, reason: 'nachtsperre' };
    const active = calendar.activeWindow(this.windows, now);
    if (active) return { on: true, reason: 'anzeigefenster', window: active };
    return { on: false, reason: 'kein-treffer' };
  }

  buildState(decision, now = new Date()) {
    const cfg = this.config();
    const inError = this.consecutiveFailures >= FAILURES_BEFORE_ERROR;
    const next = calendar.nextWindow(this.windows, now);
    return {
      configured: this.isConfigured(cfg),
      enabled: cfg.enabled,
      panelOn: decision.on,
      reason: decision.reason,
      activeWindow: decision.window
        ? { title: decision.window.title, start: decision.window.start.toISOString(), end: decision.window.end.toISOString() }
        : null,
      nextWindow: next
        ? { title: next.title, start: next.start.toISOString(), end: next.end.toISOString() }
        : null,
      matchCount: this.windows.length,
      pausedUntil: this.pausedUntil > now.getTime() ? this.pausedUntil : 0,
      graceUntil: this.startedAt + GRACE_MS,
      lastPollOk: this.lastPollOk,
      consecutiveFailures: this.consecutiveFailures,
      // Die Fehlerseite erscheint nur, wenn das Panel ohnehin an ist -- ein Netzausfall darf
      // das Gerät niemals einschalten (ADR 0003).
      showError: inError && decision.on,
      error: inError ? { message: this.lastError, since: this.errorSince } : null
    };
  }

  tick() {
    const now = new Date();
    const decision = this.decide(now);
    this.panel.setPower(decision.on);

    const next = this.buildState(decision, now);
    const changed = !this.state || JSON.stringify(this.state) !== JSON.stringify(next);
    this.state = next;
    if (changed) this.onStateChange(next);
  }

  async poll() {
    const cfg = this.config();
    if (!this.isConfigured(cfg)) return;
    try {
      const windows = await calendar.fetchWindows(cfg);
      this.windows = windows;
      this.lastPollOk = new Date().toISOString();
      if (this.consecutiveFailures > 0) {
        this.log('info', `Home Assistant wieder erreichbar nach ${this.consecutiveFailures} Fehlversuch(en)`);
      }
      this.consecutiveFailures = 0;
      this.lastError = null;
      this.errorSince = null;
    } catch (err) {
      // Die zuletzt bekannten Anzeigefenster bleiben absichtlich stehen.
      this.consecutiveFailures += 1;
      this.lastError = String((err && err.message) || err);
      if (!this.errorSince) this.errorSince = new Date().toISOString();
      this.log('warn', `Kalender-Abruf fehlgeschlagen (${this.consecutiveFailures}. Versuch): ${this.lastError}`);
    }
    this.tick();
  }

  pause(minutes) {
    const ms = (Number(minutes) > 0 ? Number(minutes) * 60 * 1000 : PAUSE_MS);
    this.pausedUntil = Date.now() + ms;
    this.log('info', `Pause gesetzt bis ${new Date(this.pausedUntil).toISOString()}`);
    this.tick();
    return this.pausedUntil;
  }

  resume() {
    this.pausedUntil = 0;
    this.log('info', 'Pause vorzeitig beendet');
    this.tick();
  }

  getState() {
    if (!this.state) this.tick();
    return this.state;
  }

  // Nach dem Speichern der Einstellungen sofort neu abrufen, statt bis zu zwei Minuten zu warten.
  refresh() {
    return this.poll();
  }

  start() {
    this.log('info', 'Kalendersteuerung gestartet');
    this.tick();
    this.poll();
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    this.pollTimer = setInterval(() => this.poll(), POLL_MS);
  }

  stop() {
    clearInterval(this.tickTimer);
    clearInterval(this.pollTimer);
    this.panel.dispose();
  }
}

module.exports = { Controller, isWithinNightLock, parseHM, TICK_MS, POLL_MS, GRACE_MS, PAUSE_MS, FAILURES_BEFORE_ERROR };
