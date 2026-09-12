// Wie dringend die Akkuwarnung gerade ist.
//
// WARUM STUFEN UND NICHT EIN TON
//
// Ein gleichbleibender Warnton hat genau zwei Enden: Entweder er ist leise genug, dass man ihn
// nach dem dritten Mal nicht mehr hoert -- dann ist das Geraet irgendwann leer. Oder er ist
// laut genug, dass man ihn nicht ueberhoeren kann -- dann schaltet ihn jemand am zweiten Tag
// dauerhaft ab, und das Geraet ist irgendwann leer. Beides endet gleich.
//
// Deshalb faengt die Warnung leise und selten an und wird beides mit der Zeit: haeufiger und
// lauter. Wer sofort reagiert, hoert sie fast nicht. Wer sie ignoriert, wird sie nicht los.
//
// ZWEI ACHSEN
//
// Die Dringlichkeit waechst mit der Zeit seit der ersten Warnung UND mit dem sinkenden
// Akkustand. Die Zeit allein reicht nicht: Ein Geraet, das von 21 auf 12 Prozent faellt,
// waehrend jemand dreimal wegdrueckt, ist dringender als eines, das seit einer Stunde bei
// 19 Prozent steht. Der Akkustand allein reicht auch nicht: Zwischen 20 und 15 Prozent liegen
// je nach Geraet zwanzig Minuten, und in denen soll die Warnung deutlicher werden, nicht
// gleich bleiben.
//
// STUMMSCHALTEN GEHT -- ABER NICHT BELIEBIG OFT
//
// Wer gerade telefoniert, darf den Ton fuer ein paar Minuten wegdruecken. Drei Mal. Danach
// nicht mehr: Ab da ist es keine Stoerung mehr, sondern die letzte Warnung vor einem Geraet,
// das sich abschaltet.

(function (global) {
  'use strict';

  // Ab hier ist es kein Hinweis mehr. Fest verdrahtet und bewusst nicht einstellbar: Wer die
  // Warnschwelle hochsetzt, will frueher gewarnt werden -- nicht spaeter ernst genommen.
  const KRITISCH_PROZENT = 15;

  // Die Warnschwelle darf nicht beliebig tief. Unter zwanzig Prozent bleibt bei einem Panel,
  // das nebenbei laedt und entlaedt, keine Reserve mehr, um in Ruhe zu reagieren.
  const SCHWELLE_MINDESTENS = 20;

  // Wie lange stumm -- und wie oft. Auf der kritischen Stufe kuerzer: Drei Minuten Ruhe sind
  // dort ein Viertel der Zeit, die das Geraet noch hat.
  const STUMM_MINUTEN = 3;
  const STUMM_MINUTEN_KRITISCH = 1;
  const STUMM_MAXIMAL = 3;

  // Je Stufe: Abstand zwischen zwei Toenen, Lautstaerke des Tons selbst (0..1), Mindestwert
  // fuer die Systemlautstaerke in Prozent, das Motiv und ob die Anzeige blinkt.
  //
  // Die Systemlautstaerke steht hier mit drin, weil der schoenste Ton nichts nuetzt, wenn das
  // Geraet auf zehn Prozent steht -- und niemand daran denkt, sie vorher hochzudrehen.
  const STUFEN = [
    null,
    { abstandSekunden: 60, lautstaerke: 0.20, systemLautstaerke: 35, motiv: 'ruhig',    blinkt: false },
    { abstandSekunden: 30, lautstaerke: 0.34, systemLautstaerke: 60, motiv: 'ruhig',    blinkt: false },
    { abstandSekunden: 12, lautstaerke: 0.55, systemLautstaerke: 90, motiv: 'dringend', blinkt: true }
  ];

  // Zwei Motive, nicht zwei Lautstaerken desselben: Ein Klang, der sich aendert, faellt auf,
  // auch wenn man den leisen schon gewohnt ist.
  //
  // Ruhig: ein absteigender Dreiklang (a - fis - d). Absteigend, weil das die Richtung ist, in
  // die es geht; eine steigende Folge klaenge nach Erfolg.
  // Dringend: dieselben Toene enger und schneller, mit einem Ton darunter -- es klingt
  // gedraengt, weil es das ist.
  const MOTIVE = {
    ruhig:    { toene: [880, 740, 587], abstand: 0.26, dauer: 0.42 },
    dringend: { toene: [988, 740, 988, 740, 587], abstand: 0.16, dauer: 0.24 }
  };

  /**
   * Wie dringend ist es gerade?
   *
   * @param {object} p
   * @param {number} p.prozent          Akkustand
   * @param {boolean} p.laedt           haengt das Geraet am Netzteil?
   * @param {number} p.schwelle         eingestellte Warnschwelle
   * @param {number} p.minutenSeitStart wie lange die Warnung schon steht
   * @returns {number} 0 = keine Warnung, 1 = Hinweis, 2 = deutlich, 3 = kritisch
   */
  function akkuStufe(p) {
    // Number(null) ist 0, nicht NaN -- ein fehlender Wert haette damit dieselbe Wirkung wie
    // ein leerer Akku: sofort die kritische Stufe. Deshalb erst aussortieren, dann rechnen.
    const roh = p ? p.prozent : null;
    const prozent = (roh === null || roh === undefined || roh === '') ? NaN : Number(roh);
    if (!Number.isFinite(prozent)) return 0;
    // Am Netzteil gibt es nichts zu warnen -- auch nicht bei zwei Prozent. Es geht ja bergauf.
    if (p.laedt) return 0;

    const schwelle = Math.max(SCHWELLE_MINDESTENS, Number(p.schwelle) || SCHWELLE_MINDESTENS);
    if (prozent > schwelle) return 0;

    if (prozent <= KRITISCH_PROZENT) return 3;

    const minuten = Math.max(0, Number(p.minutenSeitStart) || 0);
    if (minuten >= 15) return 3;
    if (minuten >= 5) return 2;
    // Auch ohne Zeitablauf: Wer die Schwelle schon deutlich unterschritten hat, ist weiter als
    // jemand, bei dem sie gerade erst gerissen wurde.
    if (prozent <= schwelle - 5) return 2;
    return 1;
  }

  /** Die Einstellungen zu einer Stufe, oder null bei Stufe 0. */
  function stufenEinstellung(stufe) {
    const s = STUFEN[Math.max(0, Math.min(STUFEN.length - 1, Number(stufe) || 0))];
    return s ? Object.assign({}, s) : null;
  }

  /** Das Tonmotiv einer Stufe. */
  function stufenMotiv(stufe) {
    const s = stufenEinstellung(stufe);
    const m = MOTIVE[(s && s.motiv) || 'ruhig'];
    return { toene: m.toene.slice(), abstand: m.abstand, dauer: m.dauer };
  }

  /**
   * Darf jetzt ein Ton kommen?
   *
   * Alles, was daran schiefgehen kann, gehoert hierher und nicht in die Anzeige: eine Warnung,
   * die zu oft kommt, schaltet jemand ab, und eine, die zu selten kommt, hoert niemand.
   *
   * @param {object} p
   * @param {number} p.stufe
   * @param {number} p.jetzt         Zeit in ms
   * @param {number} p.letzterTon    Zeit des letzten Tons in ms, 0 = noch keiner
   * @param {number} p.stummBis      Zeit in ms, bis zu der stummgeschaltet wurde
   */
  function tonFaellig(p) {
    const stufe = Number(p.stufe) || 0;
    if (stufe < 1) return false;
    const jetzt = Number(p.jetzt) || 0;
    if (jetzt < (Number(p.stummBis) || 0)) return false;
    const letzter = Number(p.letzterTon) || 0;
    if (!letzter) return true;
    return jetzt - letzter >= stufenEinstellung(stufe).abstandSekunden * 1000;
  }

  /** Wie lange eine Stummschaltung auf dieser Stufe gilt, in Minuten. */
  function stummMinuten(stufe) {
    return (Number(stufe) || 0) >= 3 ? STUMM_MINUTEN_KRITISCH : STUMM_MINUTEN;
  }

  /**
   * Was passiert, wenn jemand die Warnung antippt?
   *
   * Das Kontingent gilt JE STUFE, nicht je Warnung. Vorher war es ein Vorrat fuer die ganze
   * Warnung -- wer ihn bei zwanzig Prozent aufgebraucht hatte, konnte den Ton bei vierzehn
   * Prozent nicht mehr wegdruecken, obwohl das eine voellig andere Lage ist. Gemeldet wurde
   * das als "ab 15 % geht das Stummschalten nicht mehr".
   *
   * Ausgesessen werden kann die Warnung trotzdem nicht: Auf der kritischen Stufe sind es
   * dreimal eine Minute, und danach kommt sie alle zwoelf Sekunden wieder.
   *
   * @returns {{erlaubt: boolean, bisMs: number, verbleibend: number, minuten: number, text: string}}
   */
  function stummschalten(jetzt, bisherVerwendet, stufe) {
    const verwendet = Math.max(0, Number(bisherVerwendet) || 0);
    const minuten = stummMinuten(stufe);
    if (verwendet >= STUMM_MAXIMAL) {
      return {
        erlaubt: false, bisMs: 0, verbleibend: 0, minuten,
        text: 'Jetzt nicht mehr – bitte anschließen'
      };
    }
    const verbleibend = STUMM_MAXIMAL - verwendet - 1;
    return {
      erlaubt: true,
      bisMs: (Number(jetzt) || 0) + minuten * 60000,
      verbleibend, minuten,
      text: verbleibend > 0
        ? minuten + (minuten === 1 ? ' Minute' : ' Minuten') + ' still (noch ' + verbleibend + '×)'
        : minuten + (minuten === 1 ? ' Minute' : ' Minuten') + ' still – danach nicht mehr'
    };
  }

  const api = {
    KRITISCH_PROZENT, SCHWELLE_MINDESTENS, STUMM_MINUTEN, STUMM_MINUTEN_KRITISCH, STUMM_MAXIMAL,
    akkuStufe, stufenEinstellung, stufenMotiv, tonFaellig, stummschalten, stummMinuten
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.AkkuModul = api;
})(typeof window !== 'undefined' ? window : globalThis);
