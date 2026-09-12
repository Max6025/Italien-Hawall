// Der Zustandsautomat, der entscheidet, ob das Panel an oder aus sein soll.
//
// Die Rangfolge ist bewusst starr und steht an genau einer Stelle (decide()). Sie lautet von
// oben nach unten -- die erste zutreffende Regel gewinnt:
//
//   1. Kalendersteuerung aus oder unvollständig  -> Panel an   (sonst wäre das Gerät nicht einzurichten)
//   2. Karenzzeit nach dem Start                 -> Panel an   (Rettungsanker nach einem Windows-Update)
//   3. Pause aktiv                               -> Panel an   (jemand steht davor und will bedienen)
//   4. Gerade angekommen                         -> Panel an   (schlägt die Nachtsperre, s.u.)
//   5. Nachtsperre aktiv                         -> Panel aus  (hat Vorrang vor dem Anzeigefenster)
//   6. Anzeigefenster läuft, Ankunft steht aus   -> Panel aus  (siehe control/ankunft.js)
//   7. Ein Anzeigefenster läuft                  -> Panel an
//   8. sonst                                     -> Panel aus
//
// Regel 4 steht bewusst ÜBER der Nachtsperre: Wer nachts um halb eins ankommt, soll begrüßt
// werden und nicht vor einer schwarzen Wand stehen. Sie gilt nur für eine einstellbare Frist
// nach der Ankunft; danach greift die Nachtsperre wieder wie sonst auch.
//
// Bei nicht erreichbarem Home Assistant bleiben die zuletzt bekannten Anzeigefenster stehen,
// statt auf eine leere Liste zurückzufallen: siehe docs/adr/0003-stillbleiben-bei-netzausfall.md

const fs = require('fs');
const path = require('path');
const calendar = require('./calendar');
const ankunft = require('./ankunft');
const { Panel } = require('./panel');

const TICK_MS = 5 * 1000;               // Wächter-Takt
const POLL_MS = 2 * 60 * 1000;          // Kalender-Abruf
const GRACE_MS = 1 * 60 * 1000;         // Karenzzeit nach dem Start (auf Wunsch von 10 auf 1 Minute)
const PAUSE_MS = 30 * 60 * 1000;        // Dauer einer Pause
const FAILURES_BEFORE_ERROR = 3;        // erst danach erscheint die Fehlerseite
const EINGABE_SEKUNDEN = 3;             // so frisch muss eine Eingabe sein, um als "jemand steht davor" zu gelten
const EINGABE_PAUSE_MS = 2 * 60 * 1000; // Pause, die eine solche Eingabe ausloest

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
  /**
   * idleSeconds: liefert die Sekunden seit der letzten Benutzereingabe am Geraet.
   * Wird aus dem Hauptprozess hereingereicht (powerMonitor.getSystemIdleTime), damit dieses
   * Modul ohne Electron testbar bleibt. Ohne Angabe verhaelt es sich, als sei nie jemand da.
   */
  constructor({ store, logDir, onStateChange, idleSeconds }) {
    this.store = store;
    this.idleSeconds = idleSeconds || (() => Infinity);
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

    // Ankunft: zuletzt bekannter Zustand der Anlage und das Fenster, fuer das die Ankunft
    // bereits erkannt wurde. Letzteres liegt im Store, nicht nur im Speicher -- ein Neustart
    // mitten im Aufenthalt (Update, Stromausfall) wuerde sonst wieder auf eine Ankunft warten,
    // die laengst passiert ist, und die Wand bliebe dunkel, bis jemand die Anlage anfasst.
    this.ankunftZustand = null;
    this.ankunftFuer = this.store.get('ankunftErkanntFuer') || '';
    this.ankunftZeit = Number(this.store.get('ankunftErkanntZeit')) || 0;
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
      nightEnd: g('nightEnd', '06:30'),
      ankunftEnabled: !!g('ankunftEnabled', false),
      ankunftEntity: g('ankunftEntity', ''),
      ankunftZuhause: g('ankunftZuhause', ankunft.ZUHAUSE_VORGABE),
      ankunftNachMinuten: Number(g('ankunftNachMinuten', 60)) || 0
    };
  }

  // Vollständig konfiguriert heißt: eingeschaltet, HA erreichbar konfiguriert, Entität gesetzt
  // und mindestens ein Keyword vorhanden. Fehlt eines davon, schaltet nie etwas ab.
  isConfigured(cfg) {
    return !!(cfg.enabled && cfg.haUrl && cfg.token && cfg.entity &&
      calendar.parseKeywords(cfg.keywords).length > 0);
  }

  /**
   * Ankunft festhalten, sobald die Anlage auf "zu Hause" steht.
   *
   * Laeuft bei jedem Takt und ist innerhalb eines Anzeigefensters absichtlich unumkehrbar:
   * Wer tagsueber wegfaehrt und scharf stellt, soll nicht abends vor einer dunklen Wand
   * stehen. Vergessen wird die Ankunft erst mit dem Fenster selbst.
   */
  ankunftAktualisieren(now = new Date()) {
    const cfg = this.config();
    // Vor dem ersten erfolgreichen Abruf wissen wir gar nichts: Die Fensterliste ist leer, weil
    // noch niemand gefragt hat, nicht weil kein Termin laeuft. Wer hier schon aufraeumt, loescht
    // beim Start der App genau den Vermerk, der einen Neustart mitten im Aufenthalt ueberleben
    // soll -- und die Wand bliebe dunkel, bis jemand die Alarmanlage anfasst.
    if (!this.lastPollOk && !this.windows.length) return;

    const aktiv = calendar.activeWindow(this.windows, now);
    const schluessel = aktiv ? aktiv.start.toISOString() : '';

    if (this.ankunftFuer !== schluessel) {
      // Anderes Fenster (oder gar keines): Der alte Vermerk gilt nicht mehr.
      this.ankunftFuer = schluessel;
      this.ankunftZeit = 0;
      this.store.set('ankunftErkanntFuer', schluessel);
      this.store.set('ankunftErkanntZeit', 0);
    }
    if (!aktiv || this.ankunftZeit) return;
    if (!cfg.ankunftEnabled || !String(cfg.ankunftEntity || '').trim()) return;
    if (!ankunft.istZuhause(this.ankunftZustand, cfg.ankunftZuhause)) return;

    this.ankunftZeit = now.getTime();
    this.store.set('ankunftErkanntZeit', this.ankunftZeit);
    this.log('info', 'Ankunft erkannt: ' + cfg.ankunftEntity + ' steht auf "' + this.ankunftZustand + '"');
  }

  /** Die Ankunftslage zum gegebenen Zeitpunkt -- ohne Seiteneffekte. */
  ankunftLage(cfg, now = new Date()) {
    return ankunft.ankunftLage({
      aktiv: cfg.ankunftEnabled,
      entitaet: cfg.ankunftEntity,
      fenster: calendar.activeWindow(this.windows, now),
      zustand: this.ankunftZustand,
      zuhause: cfg.ankunftZuhause,
      erkanntZeit: this.ankunftZeit,
      nachMinuten: cfg.ankunftNachMinuten,
      jetzt: now
    });
  }

  decide(now = new Date()) {
    const cfg = this.config();
    if (!this.isConfigured(cfg)) return { on: true, reason: 'nicht-konfiguriert' };
    if (now.getTime() - this.startedAt < GRACE_MS) return { on: true, reason: 'karenzzeit' };
    if (now.getTime() < this.pausedUntil) return { on: true, reason: 'pause' };

    const lage = this.ankunftLage(cfg, now);
    const active = calendar.activeWindow(this.windows, now);
    // Gerade angekommen: Das schlaegt die Nachtsperre. Wer um halb eins nachts ankommt, wird
    // begruesst, statt vor einer schwarzen Wand zu stehen.
    if (lage.frisch) return { on: true, reason: 'ankunft', window: active };
    if (isWithinNightLock(cfg, now)) return { on: false, reason: 'nachtsperre' };
    // Termin laeuft, aber es ist noch niemand da: Die Termine sind ganztaegig und begaennen
    // sonst um Mitternacht.
    if (active && lage.wartet) return { on: false, reason: 'warte-auf-ankunft', window: active };
    if (active) return { on: true, reason: 'anzeigefenster', window: active };
    return { on: false, reason: 'kein-treffer' };
  }

  buildState(decision, now = new Date()) {
    const cfg = this.config();
    const inError = this.consecutiveFailures >= FAILURES_BEFORE_ERROR;
    const next = calendar.nextWindow(this.windows, now);
    // Das laufende Anzeigefenster wird UNABHAENGIG von der Entscheidung ermittelt.
    //
    // Frueher stand hier decision.window -- und das ist nur gesetzt, wenn die Entscheidung
    // tatsaechlich am Anzeigefenster haengt. Waehrend Karenzzeit, Pause oder Nachtsperre gewinnt
    // eine andere Regel, und das Fenster verschwand aus dem Zustand, obwohl der Termin lief.
    // Das Dashboard hielt es danach fuer einen neuen Termin und kuendigte ihn erneut an.
    const aktiv = calendar.activeWindow(this.windows, now);
    return {
      configured: this.isConfigured(cfg),
      enabled: cfg.enabled,
      panelOn: decision.on,
      reason: decision.reason,
      activeWindow: aktiv
        ? { title: aktiv.title, start: aktiv.start.toISOString(), end: aktiv.end.toISOString() }
        : null,
      // Wie weit ein mehrtaegiger Termin ist -- das Dashboard blendet daraus den Hinweis
      // "Letzter Tag" ein. Bei eintaegigen Terminen bleibt es null.
      verlauf: aktiv ? calendar.verlauf({ start: aktiv.start, end: aktiv.end }, now) : null,
      // Die Anzeige braucht den Ankunftszeitpunkt: Der Ankunftsschirm zaehlt seine Anzeigedauer
      // ab der Ankunft, nicht ab Terminbeginn -- sonst waere er abgelaufen, bevor der erste
      // Gast hereinkommt.
      ankunft: {
        aktiv: !!cfg.ankunftEnabled && !!String(cfg.ankunftEntity || '').trim(),
        erkannt: this.ankunftZeit || 0,
        wartet: decision.reason === 'warte-auf-ankunft',
        zustand: this.ankunftZustand
      },
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

  // Jemand steht am Geraet: Waehrend das Panel aus waere, hat gerade eine Eingabe stattgefunden.
  //
  // Das deckt den Fall ab, den weder "resume" noch "unlock-screen" sehen: Der Bildschirm ist bloss
  // dunkel geschaltet, niemand hat geschlafen und niemand hat sich entsperrt -- es hat einfach
  // jemand das Panel beruehrt. Ohne diese Regel schaltet der Waechter fuenf Sekunden spaeter
  // wieder ab, und wer davorsteht, kommt nicht ans Geraet.
  beruecksichtigeEingabe(now) {
    if (now.getTime() < this.pausedUntil) return false; // laeuft schon
    let idle;
    try { idle = this.idleSeconds(); } catch (e) { return false; }
    if (!(idle <= EINGABE_SEKUNDEN)) return false;
    this.pausedUntil = now.getTime() + EINGABE_PAUSE_MS;
    this.log('info', `Eingabe am Geraet erkannt -- Bildschirmsteuerung pausiert ${EINGABE_PAUSE_MS / 60000} Minuten`);
    return true;
  }

  tick() {
    const now = new Date();
    this.ankunftAktualisieren(now);
    let decision = this.decide(now);

    // Nur pruefen, wenn tatsaechlich abgeschaltet wuerde. Sonst wuerde das Mauszeiger-Wackeln
    // beim Einschalten (siehe panel.js) sich selbst als Benutzereingabe zurueckmelden.
    if (!decision.on && this.beruecksichtigeEingabe(now)) {
      decision = this.decide(now);
    }

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
    await this.ankunftAbrufen(cfg);
    this.tick();
  }

  /**
   * Zustand der Anlage abrufen.
   *
   * Das Netz unter der Live-Verbindung: Die kommt ueber die WebSocket-Verbindung von Home
   * Assistant und meldet jede Aenderung binnen Sekundenbruchteilen (siehe server/ha-live.js)
   * -- aber ein verpasster Anstoss wird nie nachgeholt, und ein verpasster Anstoss hiesse hier
   * eine Wand, die den ganzen Aufenthalt dunkel bleibt. Deshalb zusaetzlich dieser Abruf.
   *
   * Getrennt vom Kalender-Abruf gezaehlt: Ein Fehler hier ist kein Grund fuer die Fehlerseite,
   * und er darf den Kalender nicht als gestoert erscheinen lassen.
   */
  async ankunftAbrufen(cfg) {
    if (!cfg.ankunftEnabled || !String(cfg.ankunftEntity || '').trim()) return;
    try {
      const zustand = await ankunft.zustandHolen(cfg, cfg.ankunftEntity);
      if (zustand !== this.ankunftZustand) {
        this.log('info', 'Ankunftserkennung: ' + cfg.ankunftEntity + ' = ' + zustand);
      }
      this.ankunftZustand = zustand;
    } catch (err) {
      // Unbekannt heisst ausdruecklich "nicht warten" (siehe ankunft.js) -- lieber zu frueh
      // hell als den ganzen Termin dunkel.
      if (this.ankunftZustand !== null) {
        this.log('warn', 'Ankunftserkennung: Zustand nicht abrufbar (' + String(err.message || err) + ')');
      }
      this.ankunftZustand = null;
    }
  }

  /**
   * Eine gemeldete Zustandsaenderung aus der Live-Verbindung.
   *
   * Damit steht das Dashboard in dem Moment da, in dem jemand die Anlage auf "zu Hause"
   * stellt -- nicht erst beim naechsten Abruf zwei Minuten spaeter. Vor der Haustuer sind
   * zwei Minuten dunkle Wand eine lange Zeit.
   */
  zustandGemeldet(entityId, zustand) {
    const cfg = this.config();
    if (!cfg.ankunftEnabled) return;
    if (!entityId || entityId !== String(cfg.ankunftEntity || '').trim()) return;
    if (zustand === this.ankunftZustand) return;
    this.ankunftZustand = zustand;
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
    // Nur protokollieren, wenn tatsaechlich eine Pause lief. Sonst fuellt jeder Druck auf
    // "Pause beenden" das Protokoll, auch wenn er nichts bewirkt -- und ein zugemuelltes
    // Protokoll ist genau dann wertlos, wenn man es braucht.
    const lief = this.pausedUntil > Date.now();
    this.pausedUntil = 0;
    if (lief) this.log('info', 'Pause vorzeitig beendet');
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

module.exports = { Controller, isWithinNightLock, parseHM, TICK_MS, POLL_MS, GRACE_MS, PAUSE_MS, FAILURES_BEFORE_ERROR, EINGABE_SEKUNDEN, EINGABE_PAUSE_MS };
