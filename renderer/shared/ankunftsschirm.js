// Der Ankunftsschirm: Vollbildanzeige, die zu Beginn eines Anzeigefensters vor dem Dashboard
// erscheint und einen ankommenden Gast begrüßt.
//
// Ausdrücklich kein Dashboard (siehe CONTEXT.md): kein Kartenraster, sondern gewürfelte
// Farbwolken in Bewegung, Überschrift, Text und ein Bild aus Home Assistant.
//
// Das Modul zerfällt bewusst in zwei Hälften:
//
//   sollAnzeigen()  -- reine Entscheidung, ohne DOM, ohne Uhr, ohne Netz. Genau hier steckt
//                      die Fehleranfälligkeit (Verworfen-Zustand, Ablauf, fehlende Konfiguration),
//                      und genau deshalb ist sie ohne Browser testbar.
//   Ankunftsschirm  -- die Anzeige. Kennt DOM und Animation, trifft aber keine Entscheidung.

(function (global) {
  'use strict';

  const ANZAHL_FORMEN = 6;
  // Lebensdauer einer Form in Sekunden. Kürzer heißt mehr Bewegung.
  const LEBEN_MIN = 11;
  const LEBEN_MAX = 19;

  const z = (a, b) => a + Math.random() * (b - a);

  /**
   * Soll der Ankunftsschirm gerade sichtbar sein?
   *
   * @param {object} p
   * @param {boolean} p.aktiviert        Einstellung "Ankunftsschirm verwenden"
   * @param {object|null} p.anzeigefenster  { start, end } als ISO-Zeichenketten, oder null
   * @param {string} p.verworfenFuer     Beginn des Anzeigefensters, für das weggetippt wurde
   * @param {number} p.stunden           Anzeigedauer ab Beginn des Anzeigefensters
   * @param {Date}   p.jetzt
   */
  function sollAnzeigen(p) {
    if (!p || !p.aktiviert) return false;
    const fenster = p.anzeigefenster;
    if (!fenster || !fenster.start) return false;

    // Weggetippt gilt für genau dieses Anzeigefenster -- und überdauert damit einen Neustart.
    // Beim nächsten Termin hat das Fenster einen anderen Beginn, und der Schirm kommt wieder.
    if (p.verworfenFuer && p.verworfenFuer === fenster.start) return false;

    const beginn = new Date(fenster.start).getTime();
    if (isNaN(beginn)) return false;

    const stunden = Number(p.stunden);
    // 0 Stunden heißt ausdrücklich "bis zum Wegtippen", nicht "gar nicht".
    if (stunden > 0) {
      const jetzt = (p.jetzt || new Date()).getTime();
      if (jetzt >= beginn + stunden * 3600 * 1000) return false;
    }
    return true;
  }

  function Ankunftsschirm(wurzel, optionen) {
    const opt = optionen || {};
    this.wurzel = wurzel;
    this.beimWegtippen = opt.beimWegtippen || function () {};
    this.formen = [];
    this.sichtbar = false;
    this.fensterStart = null;
    this._bauen();
  }

  Ankunftsschirm.prototype._bauen = function () {
    this.wurzel.innerHTML =
      '<div class="as-buehne"></div>' +
      '<div class="as-raster"></div>' +
      '<div class="as-inhalt">' +
        '<div class="as-links">' +
          '<h1 class="as-ueberschrift"></h1>' +
          '<p class="as-text"></p>' +
        '</div>' +
        '<div class="as-rechts">' +
          '<div class="as-bildrahmen"><img class="as-bild" alt=""></div>' +
          '<div class="as-bildtext"></div>' +
        '</div>' +
      '</div>' +
      '<div class="as-tippen">Zum Fortfahren tippen</div>';

    this.buehne = this.wurzel.querySelector('.as-buehne');
    for (let i = 0; i < ANZAHL_FORMEN; i++) {
      const el = document.createElement('div');
      el.className = 'as-form';
      this.buehne.appendChild(el);
      this.formen.push({ el, timerAus: 0, timerNeu: 0 });
    }

    this.wurzel.addEventListener('click', () => {
      if (!this.sichtbar) return;
      this.beimWegtippen(this.fensterStart);
    });
  };

  // Eine Form wird geboren, driftet zu einem zufälligen Ziel, verblasst und wird woanders neu
  // geboren. Der Zufall läuft nur bei der Geburt -- dazwischen bewegt der Browser, nicht JS.
  // Deshalb kostet die Zufälligkeit praktisch keine Rechenzeit.
  Ankunftsschirm.prototype._gebaeren = function (form) {
    const el = form.el;
    const groesse = z(26, 62);
    el.style.width = groesse + 'vw';
    el.style.height = groesse * z(0.7, 1.25) + 'vw';
    el.style.setProperty('--as-weich', Math.round(groesse * z(1.1, 1.9)) + 'px');
    el.style.background = 'radial-gradient(circle at ' + z(30, 70) + '% ' + z(30, 70) + '%, ' +
      'hsl(' + z(0, 360) + ' ' + z(72, 96) + '% ' + z(52, 68) + '%), transparent 70%)';
    el.style.transition = 'none';
    el.style.left = z(-15, 100) + 'vw';
    el.style.top = z(-15, 100) + 'vh';
    el.style.transform = 'translate3d(0,0,0) scale(' + z(0.8, 1.05) + ')';
    el.style.opacity = '0';

    void el.offsetWidth; // Startzustand übernehmen, bevor der Übergang beginnt

    const leben = z(LEBEN_MIN, LEBEN_MAX);
    const blende = Math.min(6, leben / 4);
    el.style.transition = 'transform ' + leben + 's cubic-bezier(.37,.16,.32,.96), opacity ' + blende + 's ease-in-out';
    el.style.transform = 'translate3d(' + z(-38, 38) + 'vw, ' + z(-34, 34) + 'vh, 0) scale(' + z(0.85, 1.5) + ')';
    el.style.opacity = String(z(0.45, 0.9));

    clearTimeout(form.timerAus);
    clearTimeout(form.timerNeu);
    form.timerAus = setTimeout(() => { el.style.opacity = '0'; }, (leben - blende) * 1000);
    form.timerNeu = setTimeout(() => this._gebaeren(form), leben * 1000);
  };

  Ankunftsschirm.prototype._animationStarten = function () {
    this.formen.forEach((form, i) => {
      clearTimeout(form.timerAus);
      clearTimeout(form.timerNeu);
      // Versetzt starten, damit nicht alle gleichzeitig auftauchen
      form.timerNeu = setTimeout(() => this._gebaeren(form), i * z(300, 1400));
    });
  };

  Ankunftsschirm.prototype._animationStoppen = function () {
    // Wichtig fürs Wandpanel: Läuft der Schirm nicht, darf auch nichts mehr rechnen.
    this.formen.forEach(form => {
      clearTimeout(form.timerAus);
      clearTimeout(form.timerNeu);
      form.el.style.opacity = '0';
    });
  };

  /**
   * Inhalte setzen. bildUrl darf leer sein -- dann verschwindet der Bildbereich ganz und
   * Überschrift und Text nehmen die Fläche ein. Kein Platzhalter, kein Hinweis.
   */
  Ankunftsschirm.prototype.inhaltSetzen = function (inhalt) {
    const esc = (global.DashboardRender && global.DashboardRender.esc) || (v => String(v == null ? '' : v));
    this.wurzel.querySelector('.as-ueberschrift').innerHTML = esc(inhalt.ueberschrift || '');
    this.wurzel.querySelector('.as-text').textContent = inhalt.text || '';
    this.wurzel.querySelector('.as-bildtext').textContent = inhalt.bildtext || '';

    const rechts = this.wurzel.querySelector('.as-rechts');
    const bild = this.wurzel.querySelector('.as-bild');
    if (inhalt.bildUrl) {
      bild.src = inhalt.bildUrl;
      rechts.style.display = '';
      this.wurzel.classList.remove('as-ohne-bild');
    } else {
      bild.removeAttribute('src');
      rechts.style.display = 'none';
      this.wurzel.classList.add('as-ohne-bild');
    }
    // Lädt das Bild nicht (Entität weg, HA kurz nicht erreichbar), gilt dasselbe wie oben.
    bild.onerror = () => {
      rechts.style.display = 'none';
      this.wurzel.classList.add('as-ohne-bild');
    };
  };

  Ankunftsschirm.prototype.zeigen = function (fensterStart) {
    this.fensterStart = fensterStart || null;
    if (this.sichtbar) return;
    this.sichtbar = true;
    this.wurzel.classList.add('as-sichtbar');
    this._animationStarten();
  };

  Ankunftsschirm.prototype.verbergen = function () {
    if (!this.sichtbar) return;
    this.sichtbar = false;
    this.wurzel.classList.remove('as-sichtbar');
    this._animationStoppen();
  };

  const api = { sollAnzeigen, Ankunftsschirm, ANZAHL_FORMEN };
  global.AnkunftsschirmModul = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
