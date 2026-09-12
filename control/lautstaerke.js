// Die Systemlautstärke des Geräts anheben.
//
// WARUM DIE APP DAS ÜBERHAUPT ANFASST
//
// Ein Warnton nützt nichts, wenn das Gerät auf zehn Prozent steht oder stumm geschaltet ist --
// und genau so hängt ein Wandpanel normalerweise an der Wand, weil es sonst monatelang nur
// stumm dastehen soll. Am Gerät gemessen: Der Tonkontext lief, der Ton wurde abgespielt, und zu
// hören war trotzdem nichts. Wer erst dann die Lautstärke hochdreht, wenn er den Warnton hört,
// hört ihn nie.
//
// WAS SIE DABEI NICHT TUT
//
// Nur ANHEBEN, nie senken: Steht das Gerät schon lauter, bleibt es dabei. Und nur, während eine
// Akkuwarnung läuft -- außerhalb davon fasst diese Datei die Lautstärke nicht an. Abschaltbar
// ist es außerdem; wer sein Panel bewusst stumm hält, soll das behalten dürfen.
//
// WARUM EINE DATEI UND NICHT EIN AUFRUF
//
// Windows hat keinen Befehl für die Lautstärke. Sie liegt hinter IAudioEndpointVolume, einer
// COM-Schnittstelle, die sich nur über eine C#-Deklaration erreichen lässt -- rund vierzig
// Zeilen. Über `-EncodedCommand` mitzugeben scheitert: Base64 von UTF-16 bläht den Text auf das
// Vierfache, und Windows bricht mit "Die Befehlszeile ist zu lang" ab. Über die Standardeingabe
// scheitert es auch, siehe den PowerShell-Vorspann in `panel.js`. Bleibt die Datei.
//
// DIE EIGENTLICHE FEHLERQUELLE
//
// Die Reihenfolge der Methoden in der Schnittstellen-Deklaration. Wer eine ausläßt, ruft die
// nächste auf. Ein erster Anlauf hatte zwei Platzhalter zu wenig und rief statt `SetMute` etwas
// anderes -- die Fehlermeldung lautete "Der Wert liegt außerhalb des erwarteten Bereichs" und
// sagte über die Ursache nichts.

const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Die Methoden von IAudioEndpointVolume in EXAKT der Reihenfolge der Schnittstelle. Die
// Platzhalter sind keine Bequemlichkeit: Ohne sie verschiebt sich jeder folgende Aufruf.
const SKRIPT = `param([int]$Ziel = 50)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr n);
  int UnregisterControlChangeNotify(IntPtr n);
  int GetChannelCount(out uint c);
  int SetMasterVolumeLevel(float l, Guid g);
  int SetMasterVolumeLevelScalar(float l, Guid g);
  int GetMasterVolumeLevel(out float l);
  int GetMasterVolumeLevelScalar(out float l);
  int SetChannelVolumeLevel(uint n, float l, Guid g);
  int SetChannelVolumeLevelScalar(uint n, float l, Guid g);
  int GetChannelVolumeLevel(uint n, out float l);
  int GetChannelVolumeLevelScalar(uint n, out float l);
  int SetMute(bool m, Guid g);
  int GetMute(out bool m);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int ctx, IntPtr act, out IAudioEndpointVolume o); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int EnumAudioEndpoints(int f, int m, out IntPtr c);
  int GetDefaultAudioEndpoint(int f, int r, out IMMDevice d);
}
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class WallTon {
  static IAudioEndpointVolume Holen() {
    IMMDeviceEnumerator e = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
    IMMDevice d; e.GetDefaultAudioEndpoint(0, 1, out d);
    Guid iid = typeof(IAudioEndpointVolume).GUID;
    IAudioEndpointVolume v; d.Activate(ref iid, 23, IntPtr.Zero, out v);
    return v;
  }
  public static string Anheben(int ziel) {
    IAudioEndpointVolume v = Holen();
    float l; v.GetMasterVolumeLevelScalar(out l);
    bool m; v.GetMute(out m);
    int ist = (int)Math.Round(l * 100);
    if (m) v.SetMute(false, Guid.Empty);
    if (ist < ziel) v.SetMasterVolumeLevelScalar(ziel / 100f, Guid.Empty);
    return ist + "|" + (m ? "stumm" : "laut") + "|" + Math.Max(ist, ziel);
  }
}
"@
[WallTon]::Anheben($Ziel)
`;

let skriptPfad = null;

/**
 * Legt das Skript ab und liefert seinen Pfad.
 *
 * Einmal je Programmlauf geschrieben, nicht bei jedem Aufruf: Der Inhalt ändert sich nie, und
 * bei Stufe 3 kommt alle zwölf Sekunden ein Ton.
 */
function skriptAblegen(verzeichnis) {
  if (skriptPfad && fs.existsSync(skriptPfad)) return skriptPfad;
  const ziel = path.join(verzeichnis || os.tmpdir(), 'wall-lautstaerke.ps1');
  fs.writeFileSync(ziel, SKRIPT, 'utf8');
  skriptPfad = ziel;
  return ziel;
}

/** Baut den Aufruf. Ausgelagert, damit er sich ohne Windows prüfen lässt. */
function befehl(pfad, ziel) {
  const z = Math.max(0, Math.min(100, Math.round(Number(ziel) || 0)));
  // ExecutionPolicy Bypass, weil eine frisch geschriebene .ps1 sonst je nach Richtlinie gar
  // nicht erst startet -- und zwar mit einer Meldung, die nach einem Rechteproblem aussieht.
  return `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${pfad}" -Ziel ${z}`;
}

/** Liest eine Antwortzeile "vorher|stumm|jetzt". */
function antwortLesen(stdout) {
  const teile = String(stdout || '').trim().split('|');
  if (teile.length < 3) return null;
  const vorher = Number(teile[0]);
  const jetzt = Number(teile[2]);
  if (!Number.isFinite(vorher) || !Number.isFinite(jetzt)) return null;
  return { vorher, warStumm: teile[1] === 'stumm', jetzt };
}

/**
 * Hebt die Systemlautstärke auf mindestens `ziel` Prozent an und hebt eine Stummschaltung auf.
 *
 * Der Vorher-Wert gehört zur Antwort: Ohne ihn lässt sich hinterher nicht sagen, ob das Gerät
 * leise war oder der Ton.
 */
function anheben(ziel, optionen = {}) {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false, fehler: 'nur unter Windows' });
  let pfad;
  try {
    pfad = skriptAblegen(optionen.verzeichnis);
  } catch (e) {
    return Promise.resolve({ ok: false, fehler: 'Skript nicht ablegbar: ' + String(e.message || e) });
  }
  return new Promise((resolve) => {
    exec(befehl(pfad, ziel), { timeout: optionen.timeoutMs || 15000 }, (err, stdout, stderr) => {
      const gelesen = antwortLesen(stdout);
      if (gelesen) return resolve(Object.assign({ ok: true }, gelesen));
      resolve({ ok: false, fehler: String((err && err.message) || stderr || stdout || 'keine Antwort').trim() });
    });
  });
}

module.exports = { anheben, befehl, antwortLesen, skriptAblegen, SKRIPT };
