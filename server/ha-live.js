// Dauerhafte Verbindung zu Home Assistant: Zustandsänderungen kommen, statt abgeholt zu werden.
//
// WARUM KEINE EIGENE HA-INTEGRATION?
//
// Gewünscht war "eine Integration, die dem Display sagt, es soll sich aktualisieren". Genau
// das kann Home Assistant von Haus aus: Die WebSocket-API liefert `state_changed` für jede
// Entität, mit demselben Token, das ohnehin schon hinterlegt ist.
//
// Eine eigene Integration hieße: eine Python-Komponente schreiben, sie über HACS oder von Hand
// installieren, sie bei jedem HA-Update nachziehen -- und das alles für eine Nachricht, die es
// bereits gibt. Auf einem Gerät, das jahrelang an der Wand hängt, ist das Gegenteil von
// wartungsarm. Was eine eigene Integration zusätzlich könnte, wäre das Panel IN Home Assistant
// sichtbar zu machen (als Gerät mit Entitäten). Das ist ein anderes Feature; danach war nicht
// gefragt.
//
// VERHÄLTNIS ZU ADR 0002
//
// Dort steht, dass der Kalender ABGERUFEN und nicht per Push geliefert wird: Ein verpasster
// Anstoß wird nie nachgeholt, und ein verpasster Termin lässt das Panel dunkel. Dieses Modul
// widerspricht dem nicht -- es ersetzt den Abruf nicht, sondern verkürzt die Wartezeit
// dazwischen. Der Abruf bleibt als Netz bestehen, nur seltener, solange die Verbindung steht.
// Für den Kalender bleibt es beim reinen Abruf.

const WebSocket = require('ws');

/**
 * WebSocket-Adresse aus der HA-Adresse.
 *
 * Nicht nur http->ws ersetzen: Ein abschliessender Schraegstrich ergaebe sonst eine doppelte
 * Adresse, und https MUSS zu wss werden -- mit ws gegen einen TLS-Server bekommt man eine
 * Fehlermeldung, die nach allem klingt ausser nach der Ursache.
 */
function wsAdresse(haUrl) {
  const roh = String(haUrl || '').trim().replace(/\/+$/, '');
  if (!roh) return '';
  if (roh.startsWith('https://')) return 'wss://' + roh.slice(8) + '/api/websocket';
  if (roh.startsWith('http://')) return 'ws://' + roh.slice(7) + '/api/websocket';
  // Ohne Schema: HA laeuft meist unverschluesselt im eigenen Netz.
  return 'ws://' + roh + '/api/websocket';
}

/**
 * Wartezeit vor dem nächsten Verbindungsversuch, in Millisekunden.
 *
 * Verdoppelnd bis zu einer halben Minute. Ohne Obergrenze wartet das Gerät nach einer langen
 * Störung stundenlang; ohne Verdopplung hämmert es bei einem abgeschalteten Home Assistant
 * im Sekundentakt gegen eine tote Adresse.
 */
function rueckfallZeit(versuch) {
  const n = Math.max(0, Math.min(20, Number(versuch) || 0));
  return Math.min(30000, 1000 * Math.pow(2, n));
}

/**
 * Zieht aus einer HA-Nachricht die Zustandsänderung, oder null.
 *
 * HA schickt über dieselbe Verbindung auch Antworten auf Kommandos, Pong-Nachrichten und
 * Ereignisse anderer Art. Alles, was nicht genau diese Form hat, geht uns nichts an.
 */
function zustandsAenderung(nachricht) {
  if (!nachricht || nachricht.type !== 'event') return null;
  const e = nachricht.event;
  if (!e || e.event_type !== 'state_changed' || !e.data) return null;
  const neu = e.data.new_state;
  // Kein new_state heisst: Die Entitaet wurde entfernt. Auch das ist eine Aenderung, die das
  // Dashboard angeht -- die Karte wird dann leer.
  if (!neu) return { entity_id: e.data.entity_id, entfernt: true };
  return {
    entity_id: neu.entity_id,
    state: neu.state,
    attributes: neu.attributes || {}
  };
}

/**
 * Hält eine Verbindung zu Home Assistant offen und meldet jede Zustandsänderung.
 *
 * Die Verbindung baut sich nach jedem Abbruch selbst wieder auf. Ein Wandpanel läuft
 * monatelang durch; WLAN-Aussetzer, HA-Neustarts und Netzwerkwechsel sind dort keine
 * Ausnahme, sondern Alltag.
 */
class HaLive {
  constructor({ getConfig, onAenderung, onStatus, log }) {
    this.getConfig = getConfig;
    this.onAenderung = onAenderung || (() => {});
    this.onStatus = onStatus || (() => {});
    this.log = log || (() => {});
    this.ws = null;
    this.versuch = 0;
    this.verbunden = false;
    this.gestoppt = false;
    this.timer = null;
    this.pingTimer = null;
    this.letzteNachricht = 0;
  }

  istVerbunden() { return this.verbunden; }

  start() {
    this.gestoppt = false;
    this._verbinden();
  }

  stop() {
    this.gestoppt = true;
    clearTimeout(this.timer);
    clearInterval(this.pingTimer);
    this._schliessen();
  }

  /** Nach einer Konfigurationsänderung (andere Adresse, neuer Token) neu aufbauen. */
  neuVerbinden() {
    if (this.gestoppt) return;
    this._schliessen();
    this.versuch = 0;
    this._verbinden();
  }

  _schliessen() {
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        // Ein halb offener Socket meldet beim Abbruch noch einen Fehler ("WebSocket was closed
        // before the connection was established"). Ohne Zuhoerer wird daraus in Node eine
        // unbehandelte Ausnahme -- und die reisst den ganzen Prozess mit, obwohl hier nur
        // planmaessig aufgeraeumt wird. Der leere Zuhoerer ist deshalb kein Verschlucken eines
        // echten Fehlers: Er gehoert zu einer Verbindung, die uns nicht mehr interessiert.
        this.ws.on('error', () => {});
        this.ws.terminate();
      } catch (e) { /* war schon zu */ }
      this.ws = null;
    }
    this._setzeVerbunden(false);
  }

  _setzeVerbunden(wert) {
    if (this.verbunden === wert) return;
    this.verbunden = wert;
    this.onStatus(wert);
  }

  _spaeterWiederVersuchen() {
    if (this.gestoppt) return;
    const wartezeit = rueckfallZeit(this.versuch++);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this._verbinden(), wartezeit);
    // Der Wecker darf den Prozess nicht am Leben halten: Sonst beendet sich kein Testlauf
    // mehr, und ein `node`-Aufruf haengt, obwohl er fertig ist. Die App laeuft ohnehin wegen
    // ihres Fensters weiter.
    if (this.timer.unref) this.timer.unref();
  }

  _verbinden() {
    if (this.gestoppt) return;
    const cfg = this.getConfig() || {};
    const adresse = wsAdresse(cfg.haUrl);
    if (!adresse || !cfg.token) {
      // Noch nicht eingerichtet -- in Ruhe warten, nicht im Sekundentakt fragen.
      this.timer = setTimeout(() => this._verbinden(), 15000);
      if (this.timer.unref) this.timer.unref();
      return;
    }

    let ws;
    try {
      ws = new WebSocket(adresse);
    } catch (err) {
      this.log('Live-Verbindung konnte nicht geoeffnet werden: ' + err.message);
      return this._spaeterWiederVersuchen();
    }
    this.ws = ws;

    ws.on('message', (roh) => {
      this.letzteNachricht = Date.now();
      let data;
      try { data = JSON.parse(roh.toString()); } catch (e) { return; }

      if (data.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: cfg.token }));
        return;
      }
      if (data.type === 'auth_invalid') {
        this.log('Live-Verbindung: Token abgelehnt');
        // Ein falscher Token wird durch Wiederholen nicht richtig. Trotzdem nicht aufgeben --
        // der Token kann in den Einstellungen erneuert werden, und dann soll es von allein
        // wieder laufen.
        this._schliessen();
        return this._spaeterWiederVersuchen();
      }
      if (data.type === 'auth_ok') {
        ws.send(JSON.stringify({ id: 1, type: 'subscribe_events', event_type: 'state_changed' }));
        return;
      }
      if (data.type === 'result' && data.id === 1) {
        if (data.success) {
          this.versuch = 0;
          this._setzeVerbunden(true);
          this.log('Live-Verbindung steht');
        } else {
          this.log('Live-Verbindung: Anmeldung fuer Ereignisse abgelehnt');
          this._schliessen();
          this._spaeterWiederVersuchen();
        }
        return;
      }

      const aenderung = zustandsAenderung(data);
      if (aenderung) this.onAenderung(aenderung);
    });

    const abbruch = (grund) => {
      if (this.ws !== ws) return;    // schon ersetzt
      this.log('Live-Verbindung weg: ' + grund);
      this._schliessen();
      this._spaeterWiederVersuchen();
    };
    ws.on('close', () => abbruch('geschlossen'));
    ws.on('error', (err) => abbruch(err.message));

    // Eine tote Verbindung meldet sich nicht von selbst: Wird das WLAN abgeschaltet, bleibt
    // der Socket offen und still. Ohne diesen Wecker haette das Panel eine Verbindung, ueber
    // die nie wieder etwas kommt -- und niemand merkte es.
    clearInterval(this.pingTimer);
    this.letzteNachricht = Date.now();
    this.pingTimer = setInterval(() => {
      if (!this.ws) return;
      if (Date.now() - this.letzteNachricht > 90000) return abbruch('keine Antwort mehr');
      try { this.ws.ping(); } catch (e) { abbruch('Ping fehlgeschlagen'); }
    }, 30000);
    if (this.pingTimer.unref) this.pingTimer.unref();
  }
}

module.exports = { HaLive, wsAdresse, rueckfallZeit, zustandsAenderung };
