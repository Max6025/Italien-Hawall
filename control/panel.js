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
//    unzuverlässig. Zuverlässig weckt nur echte Eingabe. Deshalb wackeln wir beim Einschalten
//    zusätzlich um einen Pixel mit dem Mauszeiger und setzen ihn sofort zurück.
//
// Damit der Wächter nicht alle paar Sekunden einen neuen PowerShell-Prozess startet, hält
// dieses Modul EINEN Prozess offen und schiebt ihm Befehle über die Standardeingabe zu.

const { spawn } = require('child_process');

const HWND_BROADCAST = -1;
const WM_SYSCOMMAND = 0x0112;
const SC_MONITORPOWER = 0xF170;
const MONITOR_OFF = 2;

// Wird einmal beim Start der Sitzung in den PowerShell-Prozess geschrieben.
const PRELUDE = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -Name PanelCtl -Namespace Wall -MemberDefinition @'
[DllImport("user32.dll")] public static extern int SendMessage(int hWnd, int hMsg, int wParam, int lParam);
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern bool GetCursorPos(out System.Drawing.Point p);
'@ -ReferencedAssemblies System.Drawing
function Panel-Off {
  [Wall.PanelCtl]::SendMessage(${HWND_BROADCAST}, ${WM_SYSCOMMAND}, ${SC_MONITORPOWER}, ${MONITOR_OFF}) | Out-Null
}
function Panel-On {
  $p = New-Object System.Drawing.Point
  [void][Wall.PanelCtl]::GetCursorPos([ref]$p)
  [void][Wall.PanelCtl]::SetCursorPos($p.X + 1, $p.Y)
  Start-Sleep -Milliseconds 40
  [void][Wall.PanelCtl]::SetCursorPos($p.X, $p.Y)
  [Wall.PanelCtl]::SendMessage(${HWND_BROADCAST}, ${WM_SYSCOMMAND}, ${SC_MONITORPOWER}, -1) | Out-Null
}
`.trim();

class Panel {
  constructor(logger) {
    this.log = logger || (() => {});
    this.proc = null;
    this.supported = process.platform === 'win32';
    this.lastDesired = null;
  }

  _ensureProcess() {
    if (!this.supported) return null;
    if (this.proc && !this.proc.killed && this.proc.exitCode === null) return this.proc;

    try {
      this.proc = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
        { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] }
      );
      this.proc.on('error', (err) => {
        this.log('warn', `Panel-Steuerung konnte nicht gestartet werden: ${err.message}`);
        this.proc = null;
      });
      this.proc.on('exit', () => { this.proc = null; });
      if (this.proc.stderr) this.proc.stderr.on('data', () => {});
      this.proc.stdin.on('error', () => { this.proc = null; });
      this.proc.stdin.write(PRELUDE + '\n');
      return this.proc;
    } catch (err) {
      this.log('warn', `Panel-Steuerung nicht verfügbar: ${err.message}`);
      this.proc = null;
      return null;
    }
  }

  _send(command) {
    const proc = this._ensureProcess();
    if (!proc || !proc.stdin.writable) return false;
    try {
      proc.stdin.write(command + '\n');
      return true;
    } catch (err) {
      this.log('warn', `Panel-Befehl fehlgeschlagen: ${err.message}`);
      this.proc = null;
      return false;
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
      if (!changed) return true; // Einschalten muss nicht wiederholt werden
      this.log('info', 'Panel wird eingeschaltet');
      return this._send('Panel-On');
    }
    if (changed) this.log('info', 'Panel wird ausgeschaltet');
    return this._send('Panel-Off');
  }

  dispose() {
    if (this.proc) {
      try { this.proc.stdin.end(); } catch (e) { /* Prozess ist bereits weg */ }
      try { this.proc.kill(); } catch (e) { /* Prozess ist bereits weg */ }
      this.proc = null;
    }
  }
}

module.exports = { Panel };
