// Das Windows-Hintergrundbild setzen.
//
// WOZU
//
// Bei einem Update beendet sich die App, der Installer läuft still durch, und die App startet
// neu. In diesen Sekunden ist nichts von der App zu sehen -- die Taskleiste ist ausgeblendet,
// also schaut man auf den nackten Windows-Desktop. Auf einer Wand im Wohnzimmer ist das der
// einzige Moment, in dem das Gerät wie ein Computer aussieht und nicht wie eine Anzeige.
//
// Deshalb liegt dort dasselbe Bild wie hinter dem Dashboard -- und während des Updates eine
// Fassung mit einem Satz darauf, dass gerade gewartet wird.
//
// WARUM DAS EINE EINSTELLUNG IST
//
// Es ändert eine Windows-Einstellung des Benutzers. Auf einem Wandpanel sieht den Desktop
// ohnehin niemand; auf einem normalen Rechner wäre es ein Übergriff. Ab Werk aus.
//
// WARUM POWERSHELL UND EINE DATEI
//
// Windows kennt keinen Befehl dafür. Der Hintergrund wird über `SystemParametersInfo` gesetzt,
// eine Funktion aus der user32.dll -- erreichbar nur über eine Deklaration. Die steht deshalb
// in einer Datei und nicht im Aufruf: Dieselbe Lehre wie bei `control/lautstaerke.js`, wo
// Windows mit "Die Befehlszeile ist zu lang" abbrach.

const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// SPI_SETDESKWALLPAPER = 20; SPIF_UPDATEINIFILE | SPIF_SENDWININICHANGE = 3 -- ohne das dritte
// Flag merkt sich Windows das Bild nicht über den nächsten Start hinaus.
const SKRIPT = `param([Parameter(Mandatory=$true)][string]$Bild)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Bild)) { Write-Output 'FEHLT'; exit }
# Das Bild soll den Bildschirm fuellen, nicht gekachelt oder zentriert stehen.
$k = 'HKCU:\\Control Panel\\Desktop'
Set-ItemProperty -Path $k -Name WallpaperStyle -Value '10'
Set-ItemProperty -Path $k -Name TileWallpaper -Value '0'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WallHintergrund {
  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
  public static int Setzen(string pfad) { return SystemParametersInfo(20, 0, pfad, 3); }
}
"@
$r = [WallHintergrund]::Setzen((Resolve-Path -LiteralPath $Bild).Path)
if ($r -ne 0) { Write-Output 'OK' } else { Write-Output 'FEHLER' }
`;

let skriptPfad = null;

function skriptAblegen(verzeichnis) {
  if (skriptPfad && fs.existsSync(skriptPfad)) return skriptPfad;
  const ziel = path.join(verzeichnis || os.tmpdir(), 'wall-hintergrund.ps1');
  fs.writeFileSync(ziel, SKRIPT, 'utf8');
  skriptPfad = ziel;
  return ziel;
}

/** Baut den Aufruf. Ausgelagert, damit er sich ohne Windows prüfen lässt. */
function befehl(skript, bild) {
  return `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${skript}" -Bild "${bild}"`;
}

/**
 * Setzt das Hintergrundbild. Liefert { ok } oder { ok: false, fehler }.
 *
 * Ein fehlendes Bild ist kein Fehler, sondern der Normalfall vor dem ersten Start: Die Bilder
 * entstehen erst, wenn die Anzeige sie gezeichnet hat.
 */
function setzen(bildPfad, optionen = {}) {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, fehler: 'nur unter Windows' });
  if (!bildPfad || !fs.existsSync(bildPfad)) return Promise.resolve({ ok: false, fehler: 'Bild noch nicht vorhanden' });
  let skript;
  try {
    skript = skriptAblegen(optionen.verzeichnis);
  } catch (e) {
    return Promise.resolve({ ok: false, fehler: 'Skript nicht ablegbar: ' + String(e.message || e) });
  }
  return new Promise((fertig) => {
    exec(befehl(skript, bildPfad), { timeout: optionen.timeoutMs || 15000 }, (err, stdout, stderr) => {
      const antwort = String(stdout || '').trim();
      if (antwort.includes('OK')) return fertig({ ok: true });
      fertig({ ok: false, fehler: String((err && err.message) || stderr || antwort || 'keine Antwort').trim() });
    });
  });
}

module.exports = { setzen, befehl, skriptAblegen, SKRIPT };
