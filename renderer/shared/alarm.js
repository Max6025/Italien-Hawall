// Was die Alarmanlage über das Haus sagt.
//
// Zwei Funktionen hängen an derselben Entität, und deshalb steht sie hier statt zweimal:
//
//   * "Auf Ankunft warten" (control/ankunft.js) -- das Dashboard geht erst an, wenn jemand da
//     ist, statt um Mitternacht.
//   * "Bei Abwesenheit dimmen" (renderer/dashboard.html) -- steht die Anlage auf abwesend,
//     schaut ohnehin niemand hin: Der Bildschirm wird dunkler und fragt seltener nach.
//
// Die Zustandsnamen gehören der Anlage, nicht dieser App. `armed_home` heißt nicht überall
// dasselbe -- in der einen Anlage scharf mit freiem Innenbereich, in der anderen der ganz
// normale Zustand, wenn jemand da ist. Deshalb sind die Vorgaben hier nur Vorgaben, und die
// Liste ist einstellbar.
//
// Die Datei liegt unter renderer/shared/, weil sie der Renderer braucht -- der Hauptprozess
// und der Server holen sie sich von dort. Umgekehrt ginge es nicht: Was unter control/ liegt,
// erreicht kein <script src>.

(function (global) {
  'use strict';

  // alarm_control_panel kennt beides: Wer die Anlage beim Betreten komplett abschaltet, steht
  // auf disarmed; wer nur den Innenbereich freigibt, auf armed_home.
  const ZUHAUSE_VORGABE = 'disarmed, armed_home';

  // Zustände, aus denen sich nichts ablesen lässt. "unknow" ohne letztes n ist kein Versehen
  // in diesem Code, sondern ein häufiger Tippfehler in Home Assistant selbst -- auf diesem
  // Gerät stand er wirklich so drin.
  const UNBEKANNT = ['', 'unknown', 'unknow', 'unavailable', 'none', 'null', 'undefined'];

  /** Die eingetragenen "zu Hause"-Zustände als Liste. */
  function zuhauseListe(roh) {
    const liste = String(roh === undefined || roh === null || roh === '' ? ZUHAUSE_VORGABE : roh)
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    return liste.length ? liste : zuhauseListe(ZUHAUSE_VORGABE);
  }

  /** Lässt sich aus diesem Zustand überhaupt etwas ablesen? */
  function zustandBekannt(zustand) {
    return !UNBEKANNT.includes(String(zustand === undefined || zustand === null ? '' : zustand).trim().toLowerCase());
  }

  /** Steht die Anlage auf "zu Hause"? */
  function istZuhause(zustand, roheListe) {
    if (!zustandBekannt(zustand)) return false;
    return zuhauseListe(roheListe).includes(String(zustand).trim().toLowerCase());
  }

  /**
   * Ist gerade niemand da?
   *
   * Ausdrücklich NICHT das Gegenteil von `istZuhause`: Ein unbekannter Zustand ist weder das
   * eine noch das andere. Wer ihn als "abwesend" liest, dimmt den Bildschirm herunter, weil
   * eine Entität falsch geschrieben ist -- und niemand findet den Grund.
   */
  function istAbwesend(zustand, roheListe) {
    return zustandBekannt(zustand) && !istZuhause(zustand, roheListe);
  }

  const api = { ZUHAUSE_VORGABE, zuhauseListe, zustandBekannt, istZuhause, istAbwesend };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AlarmModul = api;
})(typeof window !== 'undefined' ? window : globalThis);
