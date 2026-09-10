// Steuerung des physischen Panels unter Windows.
//
// "Panel aus" heißt hier: Windows schaltet die Hintergrundbeleuchtung ab (SC_MONITORPOWER).
// Das ist ausdrücklich NICHT das Nachtschwarz der Vorlage, bei dem ein schwarzes Overlay über
// einem weiterhin leuchtenden Bildschirm liegt.
//
// Zwei Windows-Eigenheiten prägen dieses Modul:
//
// 1. Jede Eingabe -- Maus, Touch, Tastatur, manche Hintergrunddienste -- weckt das Panel sofort
//    wieder auf. Deshalb genügt einmaliges Abschalten nicht; der Wächter im Controller schaltet
//    wiederholt nach. Dieses Modul stellt dafür nur das billige Nachschalten bereit.
//
// 2. Das Einschalten über SC_MONITORPOWER mit -1 funktioniert auf aktuellen Windows-Versionen
//    unzuverlässig. Zuverlässig weckt nur echte Eingabe -- und zwar ECHTE: `SetCursorPos`
//    verschiebt zwar den Mauszeiger, zählt für Windows aber nicht als Benutzereingabe und setzt
//    den Leerlaufzähler nicht zurück. Am Gerät beobachtet: Das Panel ging an, zeigte zwei
//    Sekunden den Sperrbildschirm und wurde sofort wieder verdunkelt; ein Tastendruck dagegen
//    liess es an. Deshalb wird die Eingabe jetzt über `mouse_event` eingespeist -- eine relative
//    Bewegung um einen Pixel und zurück, die Windows als echte Eingabe verbucht.
//
// Damit der Wächter nicht alle paar Sekunden einen neuen PowerShell-Prozess startet, hält
// dieses Modul EINEN Prozess offen und schiebt ihm Befehle über die Standardeingabe zu.
//
// ACHTUNG, teuer bezahlte Lektion: Der Vorspann darf KEINEN mehrzeiligen Here-String (@'...'@)
// enthalten. Über die Standardeingabe erkennt PowerShell dessen Ende nicht, puffert alles
// Folgende als Text, führt nie etwas aus und beendet sich am Dateiende ohne Ausgabe und ohne
// Fehlermeldung -- das Panel wird dann nie abgeschaltet, und niemand merkt es. Alle
// Deklarationen stehen deshalb einzeilig. Der Bereitschafts-Rückruf unten sichert das ab.

const { spawn } = require('child_process');

const HWND_BROADCAST = -1;
const WM_SYSCOMMAND = 0x0112;
const SC_MONITORPOWER = 0xF170;
const MONITOR_OFF = 2;
const MONITOR_ON = -1;

const READY_MARKER = 'PANEL-BEREIT';
const READY_TIMEOUT_MS = 10000;
// Das Einschalten wird regelmaessig bekraeftigt. Einmal genuegt in der Theorie -- praktisch gibt
// es unter Windows genug Stellen, die einen Bildschirm wieder verdunkeln (Sperrbildschirm-
// Zeitgeber, Treiber, Energierichtlinien). Eine Minute ist selten genug, um nicht zu stoeren,
// und haeufig genug, dass ein dunkler Bildschirm waehrend eines Termins nicht dunkel bleibt.
const ON_REASSERT_MS = 60 * 1000;

const MOUSEEVENTF_MOVE = 0x0001;

const MEMBERS = [
  '[DllImport("user32.dll")] public static extern int SendMessage(int hWnd, int hMsg, int wParam, int lParam);',
  '[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, System.IntPtr dwExtraInfo);'
].join(' ');

const OFF_CALL = `[Wall.PanelCtl]::SendMessage(${HWND_BROADCAST}, ${WM_SYSCOMMAND}, ${SC_MONITORPOWER}, ${MONITOR_OFF}) | Out-Null`;
// Erst einschalten, dann echte Eingabe einspeisen, damit der Zustand haelt. Die Reihenfolge ist
// wichtig: Die Eingabe setzt den Leerlaufzaehler zurueck und verhindert das sofortige erneute
// Verdunkeln -- deshalb muss sie NACH dem Einschalten kommen.
const ON_CALL = [
  `[Wall.PanelCtl]::SendMessage(${HWND_BROADCAST}, ${WM_SYSCOMMAND}, ${SC_MONITORPOWER}, ${MONITOR_ON}) | Out-Null`,
  `[Wall.PanelCtl]::mouse_event(${MOUSEEVENTF_MOVE}, 1, 0, 0, [System.IntPtr]::Zero)`,
  'Start-Sleep -Milliseconds 40',
  `[Wall.PanelCtl]::mouse_event(${MOUSEEVENTF_MOVE}, -1, 0, 0, [System.IntPtr]::Zero)`
].join('; ');

const ADD_TYPE = `Add-Type -Name PanelCtl -Namespace Wall -MemberDefinition '${MEMBERS}'`;

const PRELUDE = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  ADD_TYPE,
  `function Panel-Off { ${OFF_CALL} }`,
  `function Panel-On { ${ON_CALL} }`,
  `"${READY_MARKER}"`
].join('\n');

// Für den Rückfallweg: ein vollständiger Einzelbefehl, der ohne Standardeingabe auskommt.
function oneShotCommand(on) {
  return `${ADD_TYPE}; ${on ? ON_CALL : OFF_CALL}`;
}

class Panel {
  constructor(logger) {
    this.log = logger || (() => {});
    this.proc = null;
    this.supported = process.platform === 'win32';
    this.lastDesired = null;
    this.lastOnAssert = 0;   // wann zuletzt "einschalten" gesendet wurde
    this.ready = false;      // hat der Prozess seine Bereitschaft gemeldet?
    this.fallback = false;   // Dauerprozess aufgegeben, Einzelaufrufe verwenden
    this.readyTimer = null;
  }

  _spawnPersistent() {
    try {
      const proc = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      let buffer = '';
      proc.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        if (!this.ready && buffer.includes(READY_MARKER)) {
          this.ready = true;
          clearTimeout(this.readyTimer);
          this.log('info', 'Panel-Steuerung bereit');
        }
        if (buffer.length > 4096) buffer = buffer.slice(-1024);
      });

      proc.on('error', (err) => {
        this.log('warn', `Panel-Steuerung konnte nicht gestartet werden: ${err.message}`);
        this._dropProcess();
      });
      proc.on('exit', () => { this._dropProcess(); });
      if (proc.stderr) proc.stderr.on('data', () => {});
      proc.stdin.on('error', () => { this._dropProcess(); });

      proc.stdin.write(PRELUDE + '\n');

      // Meldet sich der Prozess nicht, ist der Dauerweg kaputt -- dann lieber teurere
      // Einzelaufrufe als ein Panel, das still nie ausgeht.
      this.readyTimer = setTimeout(() => {
        if (this.ready) return;
        this.log('warn', 'Panel-Steuerung meldet keine Bereitschaft -- Umschalten auf Einzelaufrufe');
        this.fallback = true;
        this._dropProcess();
      }, READY_TIMEOUT_MS);
      this.readyTimer.unref && this.readyTimer.unref();

      return proc;
    } catch (err) {
      this.log('warn', `Panel-Steuerung nicht verfügbar: ${err.message}`);
      this.fallback = true;
      return null;
    }
  }

  _dropProcess() {
    this.ready = false;
    if (this.proc) {
      try { this.proc.kill(); } catch (e) { /* Prozess ist bereits weg */ }
    }
    this.proc = null;
  }

  _ensureProcess() {
    if (!this.supported || this.fallback) return null;
    if (this.proc && !this.proc.killed && this.proc.exitCode === null) return this.proc;
    this.proc = this._spawnPersistent();
    return this.proc;
  }

  // Rückfallweg: ein eigener Prozess je Schaltvorgang. Teurer, aber ohne Standardeingabe und
  // damit ohne die Fehlerquelle, die den Dauerprozess stumm machen kann.
  _oneShot(on) {
    try {
      const proc = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', oneShotCommand(on)],
        { windowsHide: true, stdio: 'ignore' }
      );
      proc.on('error', (err) => this.log('warn', `Panel-Einzelaufruf fehlgeschlagen: ${err.message}`));
      return true;
    } catch (err) {
      this.log('warn', `Panel-Einzelaufruf nicht möglich: ${err.message}`);
      return false;
    }
  }

  _send(command, on) {
    const proc = this._ensureProcess();
    if (!proc || !proc.stdin.writable) return this._oneShot(on);
    try {
      proc.stdin.write(command + '\n');
      return true;
    } catch (err) {
      this.log('warn', `Panel-Befehl fehlgeschlagen: ${err.message}`);
      this._dropProcess();
      return this._oneShot(on);
    }
  }

  /**
   * Schaltet das Panel ein bzw. aus.
   *
   * Beim Ausschalten wird bewusst auch dann erneut gesendet, wenn das Panel nach unserem
   * Kenntnisstand längst aus ist -- genau das ist das Nachschalten des Wächters, und der
   * Befehl ist bei bereits dunklem Panel wirkungslos und billig.
   */
  setPower(on) {
    if (!this.supported) return false;
    const changed = this.lastDesired !== on;
    this.lastDesired = on;
    if (on) {
      const faellig = Date.now() - this.lastOnAssert >= ON_REASSERT_MS;
      if (!changed && !faellig) return true;
      this.lastOnAssert = Date.now();
      // Nur der Wechsel wird protokolliert -- sonst stuende jede Minute eine Zeile im Protokoll.
      if (changed) this.log('info', 'Panel wird eingeschaltet');
      return this._send('Panel-On', true);
    }
    if (changed) this.log('info', 'Panel wird ausgeschaltet');
    return this._send('Panel-Off', false);
  }

  dispose() {
    clearTimeout(this.readyTimer);
    if (this.proc) {
      try { this.proc.stdin.end(); } catch (e) { /* Prozess ist bereits weg */ }
    }
    this._dropProcess();
  }
}

module.exports = { Panel, PRELUDE, READY_MARKER, oneShotCommand };
