// Warten auf die Ankunft: das Dashboard soll nicht um Mitternacht angehen, sondern dann, wenn
// jemand wirklich da ist.
//
// DAS PROBLEM
//
// Die Termine im Kalender sind ganztaegig. Ein Anzeigefenster beginnt damit um 00:00 Uhr des
// Anreisetags -- und bis dahin ist niemand im Haus. Das Panel leuchtet dann einen halben Tag
// gegen eine leere Wand, und der Ankunftsschirm, der die Gaeste begruessen soll, hat seine
// Anzeigedauer laengst aufgebraucht, bevor der erste Gast zur Tuer hereinkommt.
//
// DAS SIGNAL
//
// Die Alarmanlage weiss es besser als jeder Kalender: Sie steht im Regelfall auf "abwesend"
// (scharf) und wird auf "zu Hause" gestellt, kurz bevor jemand ins Haus kommt. Genau dieser
// Wechsel ist die Ankunft.
//
// NUR AM ERSTEN TAG
//
// Gewartet wird ausschliesslich am Anreisetag. Ein mehrtaegiger Termin, bei dem die Anlage
// nie auf "zu Hause" wechselt -- weil sie umbenannt wurde, weil die Gaeste sie gar nicht
// benutzen -- bliebe sonst die ganze Woche dunkel. Ab dem zweiten Tag geht der Bildschirm
// wieder ganz normal mit dem Anzeigefenster an.
//
// EINMAL UND DANN NIE WIEDER
//
// Erkannt wird nur der ERSTE Uebergang je Anzeigefenster, und danach bleibt es dabei. Wer
// waehrend des Aufenthalts tagsueber wegfaehrt und wieder scharf stellt, soll nicht jedes Mal
// eine dunkle Wand vorfinden -- die Frage lautet "ist die Anreise passiert?", nicht "ist gerade
// jemand zu Hause?".
//
// WENN DER ZUSTAND UNBEKANNT IST
//
// Dann wird NICHT gewartet, sondern wie frueher zu Terminbeginn eingeschaltet. Ein Tippfehler
// in der Entitaets-ID, eine umbenannte Anlage, ein nicht erreichbares Home Assistant -- in
// allen drei Faellen waere die Alternative ein Panel, das nie wieder angeht und dessen Ursache
// niemand sieht. Lieber einen halben Tag zu frueh hell als einen ganzen Termin lang dunkel.

// Die Zustandsnamen der Anlage stehen in renderer/shared/alarm.js -- dieselbe Entitaet traegt
// zwei Funktionen (Ankunft und Abwesenheits-Dimmen), und zwei Auslegungen von "zu Hause" waeren
// eine zu viel. Weitergereicht, damit Aufrufer dieses Moduls nichts davon wissen muessen.
const { ZUHAUSE_VORGABE, zuhauseListe, zustandBekannt, istZuhause } = require('../renderer/shared/alarm.js');

/**
 * Die Lage zu einem Zeitpunkt.
 *
 * @param {object} p
 * @param {boolean} p.aktiv          Einstellung "auf Ankunft warten"
 * @param {string}  p.entitaet       Entitaets-ID der Anlage; ohne sie wird nie gewartet
 * @param {object|null} p.fenster    laufendes Anzeigefenster ({ start: Date }) oder null
 * @param {string}  p.zustand        zuletzt bekannter Zustand der Anlage
 * @param {string}  p.zuhause        eingetragene "zu Hause"-Zustaende
 * @param {number}  p.erkanntZeit    Zeitpunkt der Ankunft in ms, oder 0
 * @param {number}  p.nachMinuten    wie lange nach der Ankunft die Nachtsperre zurueckstehen muss
 * @param {boolean} p.ersterTag      laeuft heute der erste Tag des Anzeigefensters?
 * @param {Date}    p.jetzt
 * @returns {{wartet: boolean, frisch: boolean, greift: boolean}}
 *   wartet -- Termin laeuft, Ankunft steht aus: Panel bleibt aus
 *   frisch -- gerade angekommen: Panel bleibt an, auch nachts
 *   greift -- die Funktion ist ueberhaupt in Kraft
 */
function ankunftLage(p) {
  const jetzt = (p.jetzt || new Date()).getTime();
  const greift = !!(p.aktiv && String(p.entitaet || '').trim() && p.fenster);
  if (!greift) return { wartet: false, frisch: false, greift: false };

  const erkannt = Number(p.erkanntZeit) || 0;
  if (erkannt) {
    const dauer = Number(p.nachMinuten);
    const minuten = dauer > 0 ? dauer : 0;
    return { wartet: false, frisch: jetzt - erkannt < minuten * 60000, greift: true };
  }

  // Noch nicht angekommen. Gewartet wird nur am Anreisetag und nur, solange sich der Zustand
  // ueberhaupt ablesen laesst -- sonst gaebe es keinen Weg mehr zurueck zu einem hellen
  // Bildschirm.
  const ersterTag = p.ersterTag === undefined ? true : !!p.ersterTag;
  return { wartet: ersterTag && zustandBekannt(p.zustand), frisch: false, greift: true };
}

/**
 * Ab wann der Ankunftsschirm zaehlt: ab der Ankunft, sonst ab Terminbeginn.
 *
 * Ohne das laeuft die Anzeigedauer waehrend der ganzen Nacht ab, in der niemand da ist -- der
 * Schirm waere abgelaufen, bevor ihn der erste Gast sehen koennte. Genau umgekehrt gedacht als
 * der Rest der Steuerung: Hier zaehlt nicht, wann der Termin begann, sondern wann jemand kam.
 */
function bezugsbeginn(fensterStartIso, erkanntZeit) {
  const beginn = new Date(fensterStartIso).getTime();
  const ankunft = Number(erkanntZeit) || 0;
  if (isNaN(beginn)) return ankunft || NaN;
  return ankunft > beginn ? ankunft : beginn;
}

/** Holt den Zustand einer Entitaet aus Home Assistant. Wirft bei jedem Fehlschlag. */
async function zustandHolen(cfg, entitaet, options = {}) {
  const { haUrl, token } = cfg;
  if (!haUrl || !token || !entitaet) throw new Error('Ankunftserkennung ist nicht vollständig konfiguriert');
  const base = String(haUrl).replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  let res;
  try {
    res = await fetch(`${base}/api/states/${encodeURIComponent(entitaet)}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`Home Assistant antwortete mit HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.state !== 'string') throw new Error('Unerwartete Antwort von Home Assistant');
  return data.state;
}

module.exports = {
  ZUHAUSE_VORGABE, zuhauseListe, zustandBekannt, istZuhause, ankunftLage, bezugsbeginn, zustandHolen
};
