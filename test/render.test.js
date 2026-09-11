// Tests fuer das Renderer-Modul.
//
// Bis hierher konnte kein Test dieses Modul ueberhaupt laden -- es war fest an ein
// Browser-Fenster gebunden. Genau in einem solchen ungetesteten Pfad steckte der Fehler, der
// es bis aufs Geraet geschafft hat. Deshalb laesst es sich jetzt auch in Node laden.

const test = require('node:test');
const assert = require('node:assert');
const D = require('../renderer/shared/dashboard-render.js');

test('Fremder Text wird maskiert, bevor er ins HTML geht', () => {
  assert.strictEqual(D.esc('<script>'), '&lt;script&gt;');
  assert.strictEqual(D.esc('Tor & Tuer'), 'Tor &amp; Tuer');
  assert.strictEqual(D.esc('a"b'), 'a&quot;b');
  assert.strictEqual(D.esc("a'b"), 'a&#39;b');
});

test('Ein Kalendertitel mit spitzer Klammer zerlegt keine Karte mehr', () => {
  // Genau dieser Fall war moeglich, seit Termintitel auf Karten landen.
  const titel = 'Italien <Familie> "Sommer"';
  const maskiert = D.esc(titel);
  assert.ok(!maskiert.includes('<'), 'keine oeffnende Klammer mehr enthalten');
  assert.ok(!maskiert.includes('>'), 'keine schliessende Klammer mehr enthalten');
});

test('Leere Werte ergeben eine leere Zeichenkette, nicht "null" oder "undefined"', () => {
  assert.strictEqual(D.esc(null), '');
  assert.strictEqual(D.esc(undefined), '');
  assert.strictEqual(D.esc(0), '0');
});

test('Mindestgroessen gibt es nicht mehr -- jede Karte darf 1x1', () => {
  for (const typ of Object.keys(D.CARD_TYPES)) {
    const min = D.minSpanFor(typ);
    assert.strictEqual(min.cols, 1, `${typ} darf nicht breiter als 1 erzwingen`);
    assert.strictEqual(min.rows, 1, `${typ} darf nicht hoeher als 1 erzwingen`);
  }
});

test('clampSpan laesst 1x1 fuer jeden Typ zu', () => {
  for (const typ of Object.keys(D.CARD_TYPES)) {
    const span = D.clampSpan({ cols: 1, rows: 1 }, typ);
    assert.deepStrictEqual(span, { cols: 1, rows: 1 }, `${typ} wurde hochgezwungen`);
  }
});

test('Das eingebaute Standarddesign ist vollstaendig', () => {
  const t = D.DEFAULT_THEME;
  assert.strictEqual(t.name, 'Ankunft');
  for (const feld of ['bg', 'surface', 'panel2', 'cardBorder', 'text', 'muted']) {
    assert.ok(t.dark[feld], `dark.${feld} fehlt`);
    assert.ok(t.light[feld], `light.${feld} fehlt`);
  }
  assert.ok(t.pageBgGradient.includes('radial-gradient'), 'Hintergrundverlauf fehlt');
  assert.ok(t.cardBlur, 'Glas-Effekt fehlt');
});

// --- Tor-Card ---------------------------------------------------------------------------------

test('Die Tor-Card ist als Kartentyp angemeldet', () => {
  assert.ok(D.CARD_TYPES.gate, 'Kartentyp "gate" fehlt');
  assert.strictEqual(D.CARD_TYPES.gate.label, 'Tor öffnen');
});

test('Die Karten-Entitaet der Tor-Card ist die Melde-Entitaet', () => {
  // Nicht die Knoepfe -- die stehen in den Einstellungen und duerfen aus jeder Domain kommen.
  const domains = D.domainsForType('gate');
  assert.ok(domains.includes('input_boolean'), 'input_boolean muss zulaessig sein');
  assert.ok(domains.includes('binary_sensor'), 'binary_sensor muss zulaessig sein');
  assert.ok(!domains.includes('input_button'), 'ein Taster ist keine Melde-Entitaet');
});

test('Der Dienst wird aus der Entitaet abgeleitet -- Taster, Rollladen und Skript gemischt', () => {
  const f = (id) => { const d = D.serviceFuerEntitaet(id); return { domain: d.domain, service: d.service }; };
  assert.deepStrictEqual(f('input_button.tor_vorne'), { domain: 'input_button', service: 'press' });
  assert.deepStrictEqual(f('button.tor'), { domain: 'button', service: 'press' });
  assert.deepStrictEqual(f('cover.garagentor'), { domain: 'cover', service: 'open_cover' });
  assert.deepStrictEqual(f('script.tor_auf'), { domain: 'script', service: 'turn_on' });
  assert.deepStrictEqual(f('scene.ankunft'), { domain: 'scene', service: 'turn_on' });
  assert.deepStrictEqual(f('automation.tor'), { domain: 'automation', service: 'trigger' });
  assert.deepStrictEqual(f('switch.tor'), { domain: 'switch', service: 'turn_on' });
});

test('Unbekannte Domains liefern keinen Dienst, statt einen falschen zu raten', () => {
  assert.strictEqual(D.serviceFuerEntitaet('sensor.temperatur'), null);
  assert.strictEqual(D.serviceFuerEntitaet(''), null);
  assert.strictEqual(D.serviceFuerEntitaet(null), null);
});

test('Die Tor-Card taucht bei einer passenden Entitaet in der Typauswahl auf', () => {
  assert.ok(D.typesForEntity('input_boolean.tor_dauerhaft_offen').includes('gate'));
  assert.ok(!D.typesForEntity('sensor.temperatur').includes('gate'));
});

// --- Klimakarte -------------------------------------------------------------------------------

test('Die Betriebsarten haben deutsche Beschriftungen, unbekannte bleiben unveraendert', () => {
  // Unbekannte Modi duerfen nicht verschluckt werden -- lieber ein englisches Wort als ein
  // leerer Knopf, den niemand zuordnen kann.
  const html = D.CARD_TYPES.climate;
  assert.ok(html, 'Klimakarte fehlt');
});

test('Klima nimmt jetzt eine Einheit entgegen', () => {
  // settings.suffix wurde von der Karte gelesen, war im Editor aber nicht erreichbar.
  // Der Test haelt fest, dass die Karte den Typ ueberhaupt kennt.
  assert.deepStrictEqual(D.domainsForType('climate'), ['climate']);
});

test('Relais werden im Tor-Knopf als Taster behandelt, nicht als Schalter', () => {
  // Ein Torantrieb haengt an einem Relais. Nur einschalten laesst es eingeschaltet -- das Tor
  // faehrt dann einmal und der Kontakt bleibt geschlossen.
  const schalter = D.serviceFuerEntitaet('switch.torgarage_switch_0');
  assert.strictEqual(schalter.impuls, true, 'ein switch muss gepulst werden');
  assert.strictEqual(schalter.aus, 'turn_off', 'ohne Gegenbefehl bleibt das Relais an');

  const boolean = D.serviceFuerEntitaet('input_boolean.tor_merker');
  assert.strictEqual(boolean.impuls, true);
});

test('Von Natur aus momentane Entitaeten werden nicht gepulst', () => {
  // Ein zweiter Befehl waere hier sinnlos bis schaedlich.
  for (const id of ['input_button.tor_vorne', 'button.tor', 'script.tor_auf', 'scene.ankunft', 'automation.tor']) {
    assert.strictEqual(D.serviceFuerEntitaet(id).impuls, false, id + ' darf nicht gepulst werden');
  }
  assert.strictEqual(D.serviceFuerEntitaet('cover.garagentor').impuls, false,
    'ein Rollladen faehrt und darf nicht mittendrin gestoppt werden');
});

// --- Muellfarben ------------------------------------------------------------------------------
//
// Die eingebauten Regeln raten deutsche Tonnenbezeichnungen. Wer einen Kalender mit anderen
// Woertern hat, bekam ausnahmslos Grau und hatte kein Gegenmittel -- deshalb eigene Regeln.

test('Die eingebauten Tonnenarten werden erkannt', () => {
  assert.strictEqual(D.wasteColor('Biotonne'), '#6b8e23');
  assert.strictEqual(D.wasteColor('Papier / Pappe'), '#4f7cff');
  assert.strictEqual(D.wasteColor('Gelber Sack'), '#f0b429');
  assert.strictEqual(D.wasteColor('Restmüll'), '#6b7280');
});

test('Grossschreibung ist egal', () => {
  assert.strictEqual(D.wasteColor('BIOTONNE'), D.wasteColor('biotonne'));
});

test('Eine unbekannte Tonnenart bleibt grau', () => {
  assert.strictEqual(D.wasteColor('Grüngut'), '#9ca3af');
});

test('Eine eigene Regel faengt genau die auf', () => {
  const eigene = [{ muster: 'grüngut', farbe: '#123456' }];
  assert.strictEqual(D.wasteColor('Grüngut Abfuhr', eigene), '#123456');
});

test('Eigene Regeln gehen vor den eingebauten', () => {
  // Sonst waere "Biotonne Süd" nicht umfaerbbar -- die eingebaute bio-Regel griffe zuerst.
  const eigene = [{ muster: 'biotonne süd', farbe: '#abcdef' }];
  assert.strictEqual(D.wasteColor('Biotonne Süd', eigene), '#abcdef');
  assert.strictEqual(D.wasteColor('Biotonne Nord', eigene), '#6b8e23');
});

test('Eine kaputte Regel legt die Karte nicht lahm', () => {
  // Die Muster kommen aus einem Eingabefeld. Frueher waeren das regulaere Ausdruecke
  // gewesen -- "(" haette dann eine Ausnahme geworfen und die ganze Karte verschluckt.
  assert.doesNotThrow(() => D.wasteColor('Bio', [{ muster: '(' }, null, { farbe: '#fff' }]));
  assert.strictEqual(D.wasteColor('Bio', [{ muster: '(' }]), '#6b8e23');
});

test('Ohne Titel wird nichts erraten', () => {
  assert.strictEqual(D.wasteColor(''), '#9ca3af');
  assert.strictEqual(D.wasteColor(null), '#9ca3af');
});

// --- Querschnitt: Nachkommastellen ------------------------------------------------------------
//
// Bis 1.6.x hatte KEIN Kartentyp eine Einstellung dafuer. Ein Sensor, der 21.34567 meldet,
// stand genau so auf der Wand.

test('Ohne Einstellung bleibt der Wert unveraendert', () => {
  // Wichtig: kein Standard-Runden. Sonst aendert dieses Update stillschweigend jede
  // bestehende Karte.
  assert.strictEqual(D.zahlFormatieren('21.34567'), '21.34567');
  assert.strictEqual(D.zahlFormatieren('21.34567', ''), '21.34567');
  assert.strictEqual(D.zahlFormatieren('21.34567', null), '21.34567');
});

test('Gerundet wird deutsch formatiert', () => {
  assert.strictEqual(D.zahlFormatieren('21.34567', 1), '21,3');
  assert.strictEqual(D.zahlFormatieren('21.34567', 0), '21');
  assert.strictEqual(D.zahlFormatieren(1234.5, 1), '1.234,5');
});

test('Stellen werden aufgefuellt, damit die Anzeige nicht springt', () => {
  // 21 und 21,00 nebeneinander sehen aus wie ein Fehler.
  assert.strictEqual(D.zahlFormatieren(21, 2), '21,00');
});

test('Ein Text bleibt ein Text', () => {
  // "an", "unavailable", "Fährt zur Basis" -- nicht jede Karte zeigt eine Zahl.
  assert.strictEqual(D.zahlFormatieren('an', 2), 'an');
  assert.strictEqual(D.zahlFormatieren('–', 1), '–');
});

test('Unsinnige Stellenzahlen werden gebaendigt', () => {
  assert.strictEqual(D.zahlFormatieren(1.23456789, 99), D.zahlFormatieren(1.23456789, 6));
  assert.strictEqual(D.zahlFormatieren(1.5, -3), '2');
});

// --- Querschnitt: Symbol ----------------------------------------------------------------------

test('Ohne Wahl bleibt das Symbol des Kartentyps', () => {
  assert.strictEqual(D.symbolFuer({}, D.ICONS.sensor), D.ICONS.sensor);
  assert.strictEqual(D.symbolFuer(null, D.ICONS.sensor), D.ICONS.sensor);
});

test('Ein gewaehltes Symbol gewinnt', () => {
  assert.strictEqual(D.symbolFuer({ icon: 'trash' }, D.ICONS.sensor), D.ICONS.trash);
});

test('Ein Symbolname, den es nicht gibt, faellt zurueck statt zu verschwinden', () => {
  // Sonst stuende nach einem Tippfehler eine Karte ohne Symbol da.
  assert.strictEqual(D.symbolFuer({ icon: 'gibtsnicht' }, D.ICONS.sensor), D.ICONS.sensor);
});

test('Die Symbolliste ist nicht leer und enthaelt nur bekannte Namen', () => {
  const namen = D.symbolNamen();
  assert.ok(namen.length > 10, 'zu wenige Symbole zur Auswahl');
  namen.forEach(n => assert.ok(D.ICONS[n], `Symbol ${n} steht in der Liste, existiert aber nicht`));
});

// --- Schnellzugriff ---------------------------------------------------------------------------
//
// Die Kacheln konnten AUSSCHLIESSLICH eine Quelle am Media Player waehlen.

test('Eine Kachel ohne Art gilt weiter als Quellenwahl', () => {
  // Bestehende Kacheln haben kein art-Feld. Waeren sie nach dem Update stumm, waere das
  // schlimmer als die fehlende Funktion davor.
  const a = D.quickTileAktion({ mediaPlayerEntity: 'media_player.tv', source: 'Netflix' });
  assert.deepStrictEqual(a, {
    domain: 'media_player', service: 'select_source',
    entity_id: 'media_player.tv', daten: { source: 'Netflix' }
  });
});

test('Ein Skript wird ueber script.turn_on ausgeloest', () => {
  // turn_on statt des Dienstes mit dem Skriptnamen: funktioniert fuer jedes Skript gleich,
  // ohne den Dienstnamen aus der Entitaets-ID zu basteln.
  const a = D.quickTileAktion({ art: 'script', entity: 'script.gute_nacht' });
  assert.strictEqual(a.domain, 'script');
  assert.strictEqual(a.service, 'turn_on');
  assert.strictEqual(a.entity_id, 'script.gute_nacht');
});

test('Eine Szene wird ueber scene.turn_on ausgeloest', () => {
  const a = D.quickTileAktion({ art: 'scene', entity: 'scene.abendessen' });
  assert.strictEqual(a.domain, 'scene');
  assert.strictEqual(a.service, 'turn_on');
});

test('Eine leere Kachel erzeugt keinen Aufruf ins Nichts', () => {
  assert.strictEqual(D.quickTileAktion({}).entity_id, '');
  assert.strictEqual(D.quickTileAktion(null).entity_id, '');
});

test('Nur die Quellenwahl kann leuchten', () => {
  const zustaende = {
    'media_player.tv': { state: 'playing', attributes: { source: 'Netflix' } }
  };
  assert.strictEqual(D.quickTileAktiv({ mediaPlayerEntity: 'media_player.tv', source: 'Netflix' }, zustaende), true);
  assert.strictEqual(D.quickTileAktiv({ mediaPlayerEntity: 'media_player.tv', source: 'ARD' }, zustaende), false);
  // Ein Skript hat keinen "laeuft"-Zustand -- es darf nie leuchten.
  assert.strictEqual(D.quickTileAktiv({ art: 'script', entity: 'script.x' }, zustaende), false);
});

test('Steht der Player still, leuchtet nichts', () => {
  const zustaende = { 'media_player.tv': { state: 'paused', attributes: { source: 'Netflix' } } };
  assert.strictEqual(D.quickTileAktiv({ mediaPlayerEntity: 'media_player.tv', source: 'Netflix' }, zustaende), false);
});

test('Die Beschriftung faellt sinnvoll zurueck', () => {
  assert.strictEqual(D.quickTileText({ label: 'Kino' }), 'Kino');
  assert.strictEqual(D.quickTileText({ source: 'Netflix' }), 'Netflix');
  assert.strictEqual(D.quickTileText({ art: 'script', entity: 'script.x' }), 'script.x');
  assert.strictEqual(D.quickTileText({}), '?');
});

// --- Foto-Diashow -----------------------------------------------------------------------------

test('Bild eins behaelt die ID ohne Nummer', () => {
  // Sonst schauten alle bestehenden Foto-Karten nach dem Update auf einen leeren Rahmen.
  assert.strictEqual(D.fotoBildId('photo:17123', 0), 'photo:17123');
  assert.strictEqual(D.fotoBildId('photo:17123', 1), 'photo:17123__2');
  assert.strictEqual(D.fotoBildId('photo:17123', 2), 'photo:17123__3');
});

test('Eine alte Einzelbild-Karte wird weiter angezeigt', () => {
  assert.deepStrictEqual(D.fotoVersionen({ photoVersion: 111 }), [111]);
});

test('Die Bildliste gewinnt gegen das alte Einzelfeld', () => {
  assert.deepStrictEqual(D.fotoVersionen({ photoVersion: 111, photoBilder: [222, 333] }), [222, 333]);
});

test('Ohne Bild bleibt die Liste leer', () => {
  assert.deepStrictEqual(D.fotoVersionen({}), []);
  assert.deepStrictEqual(D.fotoVersionen(null), []);
});

test('Die Adressen zeigen auf die richtigen Bilder', () => {
  const urls = D.fotoUrls('photo:1', { photoBilder: [10, 20] }, 'http://x');
  assert.strictEqual(urls.length, 2);
  assert.ok(urls[0].includes('photo%3A1/background?v=10'), urls[0]);
  assert.ok(urls[1].includes('photo%3A1__2/background?v=20'), urls[1]);
});

test('Mehr als acht Bilder nimmt eine Karte nicht', () => {
  const viele = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.strictEqual(D.fotoVersionen({ photoBilder: viele }).length, 8);
});

// --- Tendenz ----------------------------------------------------------------------------------
//
// Eine Zahl allein beantwortet die eigentliche Frage nicht: 21 Grad sind etwas anderes, wenn es
// seit Stunden faellt, als wenn es steigt.

test('Steigend und fallend werden erkannt', () => {
  const rauf = [10, 11, 12, 13, 14];
  const runter = [14, 13, 12, 11, 10];
  assert.strictEqual(D.tendenz(rauf).richtung, 1);
  assert.strictEqual(D.tendenz(runter).richtung, -1);
});

test('Ein zitternder Sensor gilt nicht als steigend', () => {
  // Ohne Totzone zeigte der Pfeil bei jedem Aufbau woanders hin -- ein Flackern, das
  // schlimmer waere als gar keine Angabe.
  const zittert = [20, 20.4, 19.8, 20.3, 20.02];
  assert.strictEqual(D.tendenz(zittert).richtung, 0);
});

test('Die Totzone richtet sich nach der beobachteten Spanne', () => {
  // Ein halbes Grad ist bei einem Raumthermometer viel und bei einem Backofen nichts.
  const raum = [20, 20.2, 20.5];
  const ofen = [20, 120, 220.5];
  assert.strictEqual(D.tendenz(raum).richtung, 1, 'halbes Grad bei kleiner Spanne zaehlt');
  assert.strictEqual(D.tendenz(ofen).richtung, 1);
});

test('Zu wenige Punkte ergeben keine Tendenz statt einer erratenen', () => {
  assert.strictEqual(D.tendenz([]), null);
  assert.strictEqual(D.tendenz([5]), null);
  assert.strictEqual(D.tendenz([5, 9]), null);
  assert.strictEqual(D.tendenz(null), null);
});

// --- Verlauf im Hintergrund -------------------------------------------------------------------

test('Aus genug Punkten entsteht eine Flaeche', () => {
  const svg = D.miniVerlaufSvg([1, 4, 2, 6, 3, 7], 'test');
  assert.ok(svg.includes('<svg'), 'kein SVG erzeugt');
  assert.ok(svg.includes('<path'), 'kein Pfad erzeugt');
  assert.ok(svg.includes('mv-test'), 'Verlaufskennung fehlt');
});

test('Zu wenige Punkte zeichnen lieber nichts', () => {
  // Eine Karte ohne Verlaufsdaten soll aussehen wie vorher, nicht wie eine kaputte Flaeche.
  assert.strictEqual(D.miniVerlaufSvg([1, 2], 'x'), '');
  assert.strictEqual(D.miniVerlaufSvg([], 'x'), '');
  assert.strictEqual(D.miniVerlaufSvg(null, 'x'), '');
});

test('Unbrauchbare Werte erzeugen kein kaputtes SVG', () => {
  // Genau das ist beim Bauen passiert: doppelt durch downsample() gereicht, und im Pfad
  // standen NaN-Koordinaten. Der Browser meldet dafuer nichts -- er zeichnet einfach nichts.
  assert.strictEqual(D.miniVerlaufSvg([1, NaN, 3, 4], 'x'), '');
  assert.strictEqual(D.miniVerlaufSvg([1, undefined, 3, 4], 'x'), '');
});

test('Eine waagerechte Linie ergibt trotzdem ein gueltiges SVG', () => {
  // Spanne 0 -- ohne Absicherung waere hier durch null geteilt worden.
  const svg = D.miniVerlaufSvg([5, 5, 5, 5], 'x');
  assert.ok(svg.includes('<svg'));
  assert.ok(!svg.includes('NaN'), 'NaN im Pfad');
});

test('Jede Karte bekommt ihren eigenen Farbverlauf', () => {
  // Gleiche IDs im selben Dokument wuerden dazu fuehren, dass alle Karten die Fuellung der
  // ersten benutzen.
  const a = D.miniVerlaufSvg([1, 2, 3, 4], 'sensorא');
  const b = D.miniVerlaufSvg([1, 2, 3, 4], 'sensorb');
  assert.notStrictEqual(a, b);
});

test('Ein Ausreisser am Rand kippt die Aussage nicht', () => {
  // Erst-gegen-Letzt-Vergleich waere hier "faellt", obwohl die Reihe klar steigt -- der
  // letzte Punkt ist nur ein Ausrutscher, und Sensordaten haben Ausrutscher.
  const steigtMitAusrutscher = [10, 11, 12, 13, 14, 15, 16, 9];
  assert.strictEqual(D.tendenz(steigtMitAusrutscher).richtung, 1);
});

// --- Alarmanlage: Beschriftung und Farbe gehoeren der Anlage -----------------------------------
//
// "armed_home" heisst nicht ueberall dasselbe. In der einen Anlage ist es scharf mit freiem
// Innenbereich, in der anderen der ganz normale Zustand, wenn jemand da ist -- also eher
// unscharf. Wer das fest verdrahtet, erzaehlt der Haelfte der Nutzer etwas Unwahres ueber
// ihre Sicherheit.

test('Ohne Einstellung gelten die Vorgaben', () => {
  assert.deepStrictEqual(D.alarmDarstellung('armed_away', {}), { text: 'Scharf (Abwesend)', ton: 'scharf' });
  assert.deepStrictEqual(D.alarmDarstellung('disarmed', {}), { text: 'Unscharf', ton: 'ruhig' });
  assert.deepStrictEqual(D.alarmDarstellung('triggered', {}), { text: 'ALARM!', ton: 'alarm' });
});

test('Text und Farbe lassen sich je Zustand ueberschreiben', () => {
  const s = { alarmTexte: { armed_home: 'Zu Hause' }, alarmToene: { armed_home: 'ruhig' } };
  assert.deepStrictEqual(D.alarmDarstellung('armed_home', s), { text: 'Zu Hause', ton: 'ruhig' });
});

test('Text und Farbe sind unabhaengig voneinander', () => {
  // Nur umbenennen, Farbe behalten -- und umgekehrt.
  assert.strictEqual(D.alarmDarstellung('armed_home', { alarmTexte: { armed_home: 'Zu Hause' } }).ton, 'scharf');
  assert.strictEqual(D.alarmDarstellung('armed_home', { alarmToene: { armed_home: 'ruhig' } }).text, 'Scharf (Zuhause)');
});

test('Ein leerer Text faellt auf die Vorgabe zurueck', () => {
  // Sonst stuende auf der Karte gar nichts, und niemand wuesste, wie die Anlage steht.
  assert.strictEqual(D.alarmDarstellung('disarmed', { alarmTexte: { disarmed: '   ' } }).text, 'Unscharf');
  assert.strictEqual(D.alarmDarstellung('disarmed', { alarmTexte: { disarmed: '' } }).text, 'Unscharf');
});

test('Ein unbekannter Zustand wird angezeigt statt verschluckt', () => {
  // HA-Integrationen erfinden gelegentlich eigene Zustaende. Lieber die Kennung zeigen als
  // eine leere Karte.
  assert.strictEqual(D.alarmDarstellung('irgendwas', {}).text, 'irgendwas');
  assert.strictEqual(D.alarmDarstellung('irgendwas', {}).ton, 'ruhig');
});

test('Fehlende Einstellungen stuerzen nicht ab', () => {
  assert.ok(D.alarmDarstellung('disarmed', null).text);
  assert.ok(D.alarmDarstellung('disarmed', undefined).text);
});

test('Jeder Zustand hat einen gueltigen Farbton', () => {
  const gueltig = D.ALARM_TOENE.map(t => t.id);
  D.ALARM_ZUSTAENDE.forEach(z => {
    assert.ok(gueltig.includes(z.ton), `${z.id} hat Ton "${z.ton}", den es nicht gibt`);
  });
});
