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

  /**
   * Kleiner Markdown-Satz fuer den Text des Ankunftsschirms.
   *
   * Sicherheitsprinzip: Erst wird ALLES maskiert, danach werden ausschliesslich die eigenen
   * Auszeichnungen wieder zu Tags. So kann aus dem Text nie HTML entstehen, das jemand
   * hineingeschrieben hat -- auch nicht ueber einen Umweg.
   */
  // Absichtlich ueber Zeichencodes statt ueber Maskierungen: Diese Datei wird von Skripten
  // erzeugt und veraendert, und eine zerbrochene Maskierung faellt erst zur Laufzeit auf.
  const NEUE_ZEILE = new RegExp(String.fromCharCode(13) + '?' + String.fromCharCode(10));

  function markdown(text, escFn) {
    const esc = escFn || (v => String(v == null ? '' : v));
    const zeilen = String(text || '').split(NEUE_ZEILE);
    const raus = [];
    let liste = false;

    const inline = (roh) => {
      let t = esc(roh);
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
      t = t.replace(/_([^_]+)_/g, '<em>$1</em>');
      // Nur http und https -- alles andere waere ein Einfallstor.
      t = t.replace(/\[([^\]]+)\]\((https?:&#x2F;&#x2F;[^)\s]+|https?:\/\/[^)\s]+)\)/g,
        (m, txt, url) => `<a href="${url.replace(/&#x2F;/g, '/')}" rel="noopener">${txt}</a>`);
      return t;
    };

    const listeSchliessen = () => { if (liste) { raus.push('</ul>'); liste = false; } };

    for (const zeile of zeilen) {
      const z = zeile.trim();
      if (!z) { listeSchliessen(); continue; }
      const punkt = z.match(/^[-*+]\s+(.*)$/);
      if (punkt) {
        if (!liste) { raus.push('<ul>'); liste = true; }
        raus.push('<li>' + inline(punkt[1]) + '</li>');
        continue;
      }
      listeSchliessen();
      const ueberschrift = z.match(/^(#{1,3})\s+(.*)$/);
      if (ueberschrift) {
        const stufe = ueberschrift[1].length + 1; // h2 bis h4, h1 gehoert der Ueberschrift oben
        raus.push(`<h${stufe}>` + inline(ueberschrift[2]) + `</h${stufe}>`);
        continue;
      }
      raus.push('<p>' + inline(z) + '</p>');
    }
    listeSchliessen();
    return raus.join('');
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
          '<div class="as-bildrahmen">' +
            '<img class="as-bild as-bild-a" alt="">' +
            '<img class="as-bild as-bild-b" alt="">' +
          '</div>' +
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
    this.wurzel.querySelector('.as-text').innerHTML = markdown(inhalt.text || '', esc);
    this.wurzel.querySelector('.as-bildtext').textContent = inhalt.bildtext || '';

    const rechts = this.wurzel.querySelector('.as-rechts');
    const a = this.wurzel.querySelector('.as-bild-a');
    const b = this.wurzel.querySelector('.as-bild-b');
    const bilder = [inhalt.bildUrl, inhalt.bildUrl2].filter(Boolean);

    clearInterval(this._bildWechsel);
    if (!bilder.length) {
      a.removeAttribute('src'); b.removeAttribute('src');
      rechts.style.display = 'none';
      this.wurzel.classList.add('as-ohne-bild');
      return;
    }

    rechts.style.display = '';
    this.wurzel.classList.remove('as-ohne-bild');
    a.src = bilder[0];
    b.src = bilder[1] || bilder[0];
    a.classList.add('as-bild-vorn');
    b.classList.remove('as-bild-vorn');

    // Laedt ein Bild nicht (Entitaet weg, HA kurz nicht erreichbar), verschwindet der Bildbereich
    // ganz -- kein Platzhalter, kein Hinweis.
    const wegBeiFehler = () => {
      if (!a.complete || a.naturalWidth === 0) {
        rechts.style.display = 'none';
        this.wurzel.classList.add('as-ohne-bild');
      }
    };
    a.onerror = wegBeiFehler;

    if (bilder.length > 1) {
      const sekunden = Number(inhalt.wechselSekunden) > 0 ? Number(inhalt.wechselSekunden) : 8;
      let vorn = 0;
      this._bildWechsel = setInterval(() => {
        vorn = 1 - vorn;
        a.classList.toggle('as-bild-vorn', vorn === 0);
        b.classList.toggle('as-bild-vorn', vorn === 1);
      }, sekunden * 1000);
    }
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
    clearInterval(this._bildWechsel);
    this.sichtbar = false;
    this.wurzel.classList.remove('as-sichtbar');
    this._animationStoppen();
  };

  // --- Terminankuendigung ---------------------------------------------------------------------
  //
  // Beginnt ein Termin, faellt das Panel nicht mit der Tuer ins Haus. Ablauf: schwarz, dann
  // erscheint ein Symbol mit "Neuer Termin", Titel und Zeitraum, und erst danach uebernimmt der
  // Ankunftsschirm oder das Dashboard. Fuenf Sekunden, weich ein und aus.
  const ANKUENDIGUNG_MS = 5000;

  function Terminankuendigung(wurzel) {
    this.wurzel = wurzel;
    this.timer = null;
    wurzel.innerHTML =
      '<div class="ta-inhalt">' +
        '<div class="ta-symbol">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">' +
          '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>' +
          '<path d="M12 14v3M10.5 15.5h3"/></svg>' +
        '</div>' +
        '<div class="ta-klein">Neuer Termin</div>' +
        '<div class="ta-titel"></div>' +
        '<div class="ta-zeit"></div>' +
      '</div>';
  }

  Terminankuendigung.prototype.zeigen = function (fenster, danach) {
    const esc = (global.DashboardRender && global.DashboardRender.esc) || (v => String(v == null ? '' : v));
    const von = new Date(fenster.start);
    const bis = new Date(fenster.end);
    const tag = von.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
    const uhr = von.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const bisUhr = bis.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const mehrtaegig = von.toDateString() !== bis.toDateString();
    const bisText = mehrtaegig
      ? bis.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }) + ', ' + bisUhr
      : bisUhr;

    this.wurzel.querySelector('.ta-titel').innerHTML = esc(fenster.title || '');
    this.wurzel.querySelector('.ta-zeit').textContent = tag + ', ' + uhr + ' bis ' + bisText;

    this.wurzel.classList.add('ta-sichtbar');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.wurzel.classList.remove('ta-sichtbar');
      // Erst nach dem Ausblenden weitergeben, damit sich die Uebergaenge nicht ueberlagern.
      setTimeout(() => { if (danach) danach(); }, 700);
    }, ANKUENDIGUNG_MS);
  };

  Terminankuendigung.prototype.abbrechen = function () {
    clearTimeout(this.timer);
    this.wurzel.classList.remove('ta-sichtbar');
  };

  const api = { sollAnzeigen, markdown, Ankunftsschirm, Terminankuendigung, ANZAHL_FORMEN, ANKUENDIGUNG_MS };
  global.AnkunftsschirmModul = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
