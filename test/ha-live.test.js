// Tests fuer die Live-Verbindung zu Home Assistant.
//
// Geprueft wird, was ohne Netz und ohne laufendes Home Assistant pruefbar ist: die Umrechnung
// der Adresse, die Wartezeiten nach einem Abbruch und das Herausziehen der Zustandsaenderung
// aus dem Nachrichtenstrom. Das ist genau der Teil, in dem sich Fehler verstecken, die man
// spaeter fuer ein Netzproblem haelt.

const test = require('node:test');
const assert = require('node:assert');
const { wsAdresse, rueckfallZeit, zustandsAenderung } = require('../server/ha-live');

// --- Adresse ------------------------------------------------------------------------------------

test('http wird ws, https wird wss', () => {
  // Nicht kosmetisch: Mit ws gegen einen TLS-Server bekommt man eine Fehlermeldung, die nach
  // allem klingt ausser nach der Ursache.
  assert.strictEqual(wsAdresse('http://ha.local:8123'), 'ws://ha.local:8123/api/websocket');
  assert.strictEqual(wsAdresse('https://ha.example.org'), 'wss://ha.example.org/api/websocket');
});

test('Ein abschliessender Schraegstrich ergibt keine doppelte Adresse', () => {
  assert.strictEqual(wsAdresse('http://ha.local:8123/'), 'ws://ha.local:8123/api/websocket');
  assert.strictEqual(wsAdresse('http://ha.local:8123///'), 'ws://ha.local:8123/api/websocket');
});

test('Leerzeichen drumherum stoeren nicht', () => {
  // Adressen werden von Hand in ein Textfeld getippt.
  assert.strictEqual(wsAdresse('  http://ha.local:8123  '), 'ws://ha.local:8123/api/websocket');
});

test('Ohne Schema wird unverschluesselt angenommen', () => {
  // Home Assistant laeuft im eigenen Netz meist ohne TLS.
  assert.strictEqual(wsAdresse('ha.fritz.box:8123'), 'ws://ha.fritz.box:8123/api/websocket');
});

test('Ohne Adresse kommt nichts heraus, kein Unsinn', () => {
  assert.strictEqual(wsAdresse(''), '');
  assert.strictEqual(wsAdresse(null), '');
  assert.strictEqual(wsAdresse('   '), '');
});

// --- Wartezeiten --------------------------------------------------------------------------------

test('Die Wartezeit verdoppelt sich und ist nach oben begrenzt', () => {
  // Ohne Verdopplung haemmert das Geraet bei abgeschaltetem Home Assistant im Sekundentakt
  // gegen eine tote Adresse; ohne Obergrenze wartet es nach einer langen Stoerung stundenlang.
  assert.strictEqual(rueckfallZeit(0), 1000);
  assert.strictEqual(rueckfallZeit(1), 2000);
  assert.strictEqual(rueckfallZeit(4), 16000);
  assert.strictEqual(rueckfallZeit(5), 30000);
  assert.strictEqual(rueckfallZeit(99), 30000);
});

test('Unsinnige Versuchszahlen ergeben eine brauchbare Wartezeit', () => {
  assert.strictEqual(rueckfallZeit(-5), 1000);
  assert.strictEqual(rueckfallZeit(null), 1000);
  assert.strictEqual(rueckfallZeit('drei'), 1000);
});

// --- Nachrichten --------------------------------------------------------------------------------

test('Aus einer Zustandsaenderung wird der neue Zustand gezogen', () => {
  const a = zustandsAenderung({
    type: 'event',
    event: {
      event_type: 'state_changed',
      data: { entity_id: 'climate.bad', new_state: { entity_id: 'climate.bad', state: 'heat', attributes: { temperature: 23 } } }
    }
  });
  assert.deepStrictEqual(a, { entity_id: 'climate.bad', state: 'heat', attributes: { temperature: 23 } });
});

test('Alles andere im Strom wird ignoriert', () => {
  // Ueber dieselbe Verbindung kommen Antworten auf Kommandos, Pongs und fremde Ereignisse.
  [
    { type: 'result', id: 1, success: true },
    { type: 'auth_ok' },
    { type: 'event', event: { event_type: 'call_service', data: {} } },
    { type: 'event' },
    {},
    null
  ].forEach(n => assert.strictEqual(zustandsAenderung(n), null, JSON.stringify(n)));
});

test('Eine entfernte Entitaet ist auch eine Aenderung', () => {
  // Ohne new_state wurde die Entitaet geloescht. Die Karte wird dann leer -- das geht das
  // Dashboard genauso an wie ein neuer Wert.
  const a = zustandsAenderung({
    type: 'event',
    event: { event_type: 'state_changed', data: { entity_id: 'light.weg', new_state: null } }
  });
  assert.deepStrictEqual(a, { entity_id: 'light.weg', entfernt: true });
});

test('Fehlende Attribute ergeben ein leeres Objekt, nicht undefined', () => {
  // Sonst wirft jeder Zugriff auf attributes.irgendwas beim Zeichnen der Karte.
  const a = zustandsAenderung({
    type: 'event',
    event: { event_type: 'state_changed', data: { entity_id: 'x.y', new_state: { entity_id: 'x.y', state: 'on' } } }
  });
  assert.deepStrictEqual(a.attributes, {});
});
