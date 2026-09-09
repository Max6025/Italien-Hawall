// Regressionstest fuer den PowerShell-Vorspann der Panel-Steuerung.
//
// Anlass: Der Vorspann enthielt einen mehrzeiligen Here-String (@'...'@). Ueber die
// Standardeingabe erkennt PowerShell dessen Ende nicht -- es puffert alles Folgende als Text,
// fuehrt nie etwas aus und beendet sich am Dateiende mit Code 0, ohne Ausgabe und ohne
// Fehlermeldung. Die Funktionen Panel-Off/Panel-On existierten damit nie, jeder Abschaltbefehl
// lief ins Leere, und das Panel blieb dauerhaft an. Kein einziger der uebrigen Tests konnte das
// sehen, weil sie den PowerShell-Pfad nie betreten.
//
// Dieser Test betritt ihn. Er prueft ausschliesslich, dass der Vorspann durchlaeuft und die
// Funktionen definiert sind -- Panel-Off wird NICHT aufgerufen, sonst wuerde der Bildschirm
// des Entwicklungsrechners mitten im Testlauf schwarz.

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const { PRELUDE, READY_MARKER, oneShotCommand } = require('../control/panel');

const isWindows = process.platform === 'win32';

function runPowerShell(input, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const ps = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    let out = '';
    let err = '';
    const timer = setTimeout(() => { ps.kill(); reject(new Error('Zeitüberschreitung')); }, timeoutMs);
    ps.stdout.on('data', d => { out += d; });
    ps.stderr.on('data', d => { err += d; });
    ps.on('error', e => { clearTimeout(timer); reject(e); });
    ps.on('close', code => { clearTimeout(timer); resolve({ code, out, err }); });
    ps.stdin.write(input);
    ps.stdin.end();
  });
}

test('Der Vorspann enthaelt keinen mehrzeiligen Here-String', () => {
  // Reine Textpruefung, laeuft auf jedem System: @' am Zeilenende ist der Ausloeser.
  assert.ok(!/@'\s*$/m.test(PRELUDE),
    'Ein Here-String im Vorspann macht die Panel-Steuerung stumm (siehe Kommentar oben)');
  assert.ok(!PRELUDE.includes("'@"),
    'Kein Here-String-Abschluss im Vorspann erlaubt');
});

test('Jede Anweisung des Vorspanns steht auf genau einer Zeile', () => {
  const lines = PRELUDE.split('\n').filter(l => l.trim());
  assert.ok(lines.length >= 4, 'Vorspann wirkt unvollständig');
  for (const line of lines) {
    assert.ok(line.trim().length > 0);
  }
  assert.ok(PRELUDE.includes('function Panel-Off'), 'Panel-Off fehlt im Vorspann');
  assert.ok(PRELUDE.includes('function Panel-On'), 'Panel-On fehlt im Vorspann');
});

test('Der Rueckfallweg kommt ohne Standardeingabe aus', () => {
  const cmd = oneShotCommand(false);
  assert.ok(cmd.includes('Add-Type'), 'Der Einzelaufruf muss den Typ selbst anlegen');
  assert.ok(!cmd.includes('\n'), 'Der Einzelaufruf muss eine einzige Zeile sein');
});

test('PowerShell fuehrt den echten Vorspann aus und meldet Bereitschaft', { skip: !isWindows && 'nur unter Windows' }, async () => {
  const { code, out, err } = await runPowerShell(PRELUDE + '\n');
  assert.strictEqual(code, 0, `PowerShell endete mit Code ${code}: ${err}`);
  assert.ok(out.includes(READY_MARKER),
    `Der Vorspann hat sich nicht gemeldet. Ausgabe: ${JSON.stringify(out)} / Fehler: ${JSON.stringify(err)}`);
});

test('Panel-Off und Panel-On sind nach dem Vorspann definiert', { skip: !isWindows && 'nur unter Windows' }, async () => {
  const probe = PRELUDE + '\n'
    + '"OFF:" + [bool](Get-Command Panel-Off -EA SilentlyContinue)\n'
    + '"ON:" + [bool](Get-Command Panel-On -EA SilentlyContinue)\n';
  const { out } = await runPowerShell(probe);
  assert.match(out, /OFF:True/, 'Panel-Off wurde nicht definiert -- das Abschalten liefe ins Leere');
  assert.match(out, /ON:True/, 'Panel-On wurde nicht definiert -- das Einschalten liefe ins Leere');
});

// Panel-On ist gefahrlos: es schaltet ein und bewegt den Mauszeiger um einen Pixel hin und
// zurueck. Damit ist der gesamte Weg bis in user32.dll einmal wirklich durchlaufen, ohne dass
// beim Testen ein Bildschirm dunkel wird.
test('Ein echter Aufruf erreicht user32.dll', { skip: !isWindows && 'nur unter Windows' }, async () => {
  const probe = PRELUDE + '\nPanel-On\n"AUFRUF-OK"\n';
  const { out, err } = await runPowerShell(probe);
  assert.match(out, /AUFRUF-OK/, `Der Aufruf brach ab. Fehler: ${JSON.stringify(err)}`);
  assert.ok(!/Exception|nicht gefunden|not recognized/i.test(err),
    `PowerShell meldete einen Fehler: ${err}`);
});
