// Prueft die Sicherheitsgrenze des Setup-Servers gegen einen echten laufenden Server.
//
// Der Kern: Anfragen ueber die Loopback-Schnittstelle (das Wall Display selbst) kommen ohne
// Zugangscode durch, Anfragen ueber die LAN-Adresse nicht. Deshalb spricht dieser Test den
// Server einmal ueber 127.0.0.1 und einmal ueber die echte IP-Adresse dieses Rechners an --
// nur so wird der Unterschied ueberhaupt sichtbar.

const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const { startServer } = require('../server/setup-server');

function fakeStore(values = {}) {
  const data = { ...values };
  return {
    get: (k) => data[k],
    set: (k, v) => { data[k] = v; },
    delete: (k) => { delete data[k]; },
    clear: () => { for (const k of Object.keys(data)) delete data[k]; }
  };
}

function lanAddress() {
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

const PORT = 18788;
const store = fakeStore({ haUrl: 'http://ha.invalid', token: 'geheim' });
let server;
let live;

test.before(() => {
  const app = startServer({
    port: PORT,
    store,
    onConfigSaved: () => {},
    getLocalIps: () => [],
    updater: { currentVersion: '1.0.0', getState: () => ({}), check: () => {}, install: () => {} },
    controller: null
  });
  server = app.server;
  live = app.haLive;
});

test.after(() => {
  if (server) server.close();
  // Ohne das versucht die Live-Verbindung im Hintergrund weiter, Home Assistant zu erreichen.
  if (live) live.stop();
});

test('Ohne gesetzten Code ist die Ersteinrichtung erreichbar', async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/config`);
  assert.strictEqual(r.status, 200);
  const cfg = await r.json();
  assert.strictEqual(cfg.hasSetupCode, false);
});

test('Der Zugangscode wird nie zurueckgegeben, nur seine Existenz', async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setupCode: 'geheim1234' })
  });
  assert.strictEqual((await r.json()).ok, true);

  const cfg = await fetch(`http://127.0.0.1:${PORT}/api/config`).then(x => x.json());
  assert.strictEqual(cfg.hasSetupCode, true);
  assert.ok(!('setupCode' in cfg), 'der Code darf nicht im Konfigurations-Abruf auftauchen');
});

test('Ein zu kurzer Code wird abgelehnt, statt den Schutz still auszuhebeln', async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setupCode: '12' })
  });
  assert.strictEqual(r.status, 400);
});

test('Das Wall Display selbst bleibt ueber Loopback frei -- auch mit gesetztem Code', async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/config`);
  assert.strictEqual(r.status, 200);
});

test('Aus dem Netz ist ohne Code kein Zugriff moeglich', async (t) => {
  const ip = lanAddress();
  if (!ip) return t.skip('kein Netzwerkadapter mit LAN-Adresse vorhanden');

  const api = await fetch(`http://${ip}:${PORT}/api/config`);
  assert.strictEqual(api.status, 401, 'API muss 401 liefern');
  assert.strictEqual((await api.json()).needsAuth, true);

  const page = await fetch(`http://${ip}:${PORT}/setup/`, { redirect: 'manual' });
  assert.strictEqual(page.status, 302, 'Seiten werden zur Anmeldung umgeleitet');
  assert.match(page.headers.get('location') || '', /^\/login/);
});

test('Ein falscher Code oeffnet nichts, ein richtiger schon', async (t) => {
  const ip = lanAddress();
  if (!ip) return t.skip('kein Netzwerkadapter mit LAN-Adresse vorhanden');

  const bad = await fetch(`http://${ip}:${PORT}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'falsch' })
  });
  assert.strictEqual(bad.status, 401);

  const good = await fetch(`http://${ip}:${PORT}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'geheim1234' })
  });
  assert.strictEqual(good.status, 200);

  const cookie = (good.headers.get('set-cookie') || '').split(';')[0];
  assert.match(cookie, /^wallcode=/);

  const api = await fetch(`http://${ip}:${PORT}/api/config`, { headers: { Cookie: cookie } });
  assert.strictEqual(api.status, 200, 'mit gueltigem Cookie ist der Zugriff offen');
});

test('Eine Code-Aenderung meldet alle Geraete ab', async (t) => {
  const ip = lanAddress();
  if (!ip) return t.skip('kein Netzwerkadapter mit LAN-Adresse vorhanden');

  const login = await fetch(`http://${ip}:${PORT}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'geheim1234' })
  });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  assert.strictEqual(
    (await fetch(`http://${ip}:${PORT}/api/config`, { headers: { Cookie: cookie } })).status, 200);

  await fetch(`http://127.0.0.1:${PORT}/api/config`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setupCode: 'neuerCode99' })
  });

  assert.strictEqual(
    (await fetch(`http://${ip}:${PORT}/api/config`, { headers: { Cookie: cookie } })).status, 401,
    'das alte Cookie darf nach der Aenderung nicht mehr gelten');
});
