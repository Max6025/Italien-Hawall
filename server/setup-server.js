const express = require('express');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const crypto = require('crypto');
const calendar = require('../control/calendar');

// Domains, die keine sinnvollen Wall-Display-Karten sind (Helfer/System-Entitaeten)
// -- werden weder im Editor angeboten noch als Karten dargestellt.
const EXCLUDED_DOMAINS = new Set([
  'automation', 'zone', 'person', 'device_tracker', 'update',
  'persistent_notification', 'sun', 'tag', 'event',
  'group', 'conversation', 'stt', 'tts'
]);

function haFetch(haUrl, token, endpoint, options = {}) {
  const url = `${haUrl.replace(/\/$/, '')}${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

// HA's Energie-Dashboard-Konfiguration (welche Entitaeten fuer Netz/Solar/Batterie
// hinterlegt sind) ist nur per WebSocket-Kommando abrufbar, es gibt dafuer keine
// REST-Route. Einmaliger Verbindungsaufbau + ein Kommando + Verbindung wieder zu.
function haWebsocketCommand(haUrl, token, message, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const wsUrl = haUrl.replace(/\/$/, '').replace(/^http/, 'ws') + '/api/websocket';
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      return reject(err);
    }
    const timer = setTimeout(() => {
      if (!settled) { settled = true; ws.terminate(); reject(new Error('Zeitüberschreitung bei WebSocket-Verbindung')); }
    }, timeoutMs);

    ws.on('message', (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch (e) { return; }
      if (data.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      } else if (data.type === 'auth_invalid') {
        if (!settled) { settled = true; clearTimeout(timer); ws.close(); reject(new Error('Token ungültig (WebSocket-Auth)')); }
      } else if (data.type === 'auth_ok') {
        ws.send(JSON.stringify({ id: 1, ...message }));
      } else if (data.type === 'result' && data.id === 1) {
        if (!settled) {
          settled = true; clearTimeout(timer); ws.close();
          if (data.success) resolve(data.result);
          else reject(new Error((data.error && data.error.message) || 'HA-WebSocket-Fehler'));
        }
      }
    });
    ws.on('error', (err) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(err); }
    });
  });
}

// --- Zugangsschutz fuer die Setup-Oberflaeche -------------------------------------------------
//
// Die Vorlage lauscht auf 0.0.0.0 ohne jede Anmeldung: jeder im selben WLAN kann ueber
// /api/ha/service beliebige Home-Assistant-Dienste schalten (Schloesser, Alarmanlage) und ueber
// /api/reset die Konfiguration loeschen. Das ist hier bewusst geschlossen.
//
// Die Grenze verlaeuft entlang der Loopback-Schnittstelle: das Wall Display selbst spricht ueber
// http://localhost mit diesem Server und bleibt deshalb frei; alles, was aus dem Netz kommt,
// braucht den Zugangscode. Damit ist der Schutz genau dort, wo die Bedrohung ist, und die App
// muss ihren eigenen Code nicht kennen.

const sessions = new Set();

function isLoopback(req) {
  const ip = (req.socket && req.socket.remoteAddress) || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const LOGIN_PAGE = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Zugangscode</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#111418;color:#e8eaed;font-family:Segoe UI,system-ui,sans-serif}
 form{background:#1b1f24;padding:32px;border-radius:14px;width:min(340px,90vw);
      box-shadow:0 10px 40px rgba(0,0,0,.5)}
 h1{margin:0 0 6px;font-size:20px} p{margin:0 0 20px;color:#9aa0a6;font-size:14px;line-height:1.5}
 input{width:100%;box-sizing:border-box;padding:12px;font-size:18px;letter-spacing:2px;
       text-align:center;border-radius:8px;border:1px solid #333a42;background:#0e1216;color:#fff}
 button{width:100%;margin-top:14px;padding:12px;font-size:16px;border:0;border-radius:8px;
        background:#3b82f6;color:#fff;cursor:pointer}
 .err{color:#f28b82;font-size:14px;margin-top:12px;min-height:20px}
</style></head><body>
<form id="f"><h1>Zugangscode</h1>
<p>Diese Einrichtungsseite ist geschützt. Gib den Code ein, den du bei der Einrichtung festgelegt hast.</p>
<input id="c" type="password" inputmode="numeric" autocomplete="current-password" autofocus>
<button type="submit">Anmelden</button><div class="err" id="e"></div></form>
<script>
document.getElementById('f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const r = await fetch('/api/auth/login', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ code: document.getElementById('c').value })
  });
  const j = await r.json().catch(() => ({}));
  if (j.ok) location.href = new URLSearchParams(location.search).get('next') || '/setup/';
  else { document.getElementById('e').textContent = j.error || 'Code falsch'; document.getElementById('c').value = ''; }
});
</script></body></html>`;

function startServer({ port, store, onConfigSaved, getLocalIps, updater, controller }) {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/login', (req, res) => res.type('html').send(LOGIN_PAGE));

  app.post('/api/auth/login', (req, res) => {
    const expected = store.get('setupCode');
    const given = String((req.body && req.body.code) || '');
    if (!expected) return res.json({ ok: true, note: 'Es ist noch kein Code gesetzt' });
    if (given !== expected) return res.status(401).json({ ok: false, error: 'Code falsch' });
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.add(sid);
    // Ein Jahr gueltig: der Code soll nicht bei jedem Blick aufs Handy neu abgefragt werden.
    res.setHeader('Set-Cookie', `wallcode=${sid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`);
    res.json({ ok: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    const sid = readCookie(req, 'wallcode');
    if (sid) sessions.delete(sid);
    res.setHeader('Set-Cookie', 'wallcode=; Path=/; Max-Age=0');
    res.json({ ok: true });
  });

  app.use((req, res, next) => {
    // Das Wall Display selbst ruft ueber localhost auf und wird nie abgefragt.
    if (isLoopback(req)) return next();
    // Solange kein Code gesetzt ist, muss die Ersteinrichtung erreichbar bleiben -- sonst
    // sperrt sich das Geraet selbst aus, bevor ueberhaupt ein Code vergeben werden konnte.
    if (!store.get('setupCode')) return next();
    const sid = readCookie(req, 'wallcode');
    if (sid && sessions.has(sid)) return next();
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ ok: false, error: 'Zugangscode erforderlich', needsAuth: true });
    }
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  });

  app.use('/setup', express.static(path.join(__dirname, '..', 'renderer', 'setup')));
  app.use('/shared', express.static(path.join(__dirname, '..', 'renderer', 'shared')));

  app.get('/api/status', (req, res) => {
    res.json({
      configured: !!(store.get('haUrl') && store.get('token')),
      ips: getLocalIps(),
      port
    });
  });

  app.post('/api/test-connection', async (req, res) => {
    const { haUrl, token } = req.body || {};
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'haUrl und token erforderlich' });
    try {
      const r = await haFetch(haUrl, token, '/api/');
      if (!r.ok) return res.status(200).json({ ok: false, error: `HA antwortete mit Status ${r.status}` });
      res.json({ ok: true });
    } catch (err) {
      res.json({ ok: false, error: String(err.message || err) });
    }
  });

  // Entitaeten-Liste anhand der bereits gespeicherten Zugangsdaten (fuer die
  // separate Entitaeten-Auswahl, die jederzeit NACH der Ersteinrichtung aufgerufen wird).
  // Optionaler ?domain=-Parameter liefert gezielt eine sonst ausgeschlossene Domain
  // (z.B. "sun" fuer die Tag/Nacht-Theme-Auswahl), ohne sie generell freizugeben.
  app.get('/api/entities', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    const domainFilter = req.query.domain;
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'Erst Verbindung einrichten (Schritt 1)' });
    try {
      const r = await haFetch(haUrl, token, '/api/states');
      if (!r.ok) return res.status(200).json({ ok: false, error: `HA antwortete mit Status ${r.status}` });
      const states = await r.json();
      const entities = states
        .filter(s => {
          const d = s.entity_id.split('.')[0];
          return domainFilter ? d === domainFilter : !EXCLUDED_DOMAINS.has(d);
        })
        .map(s => ({
          entity_id: s.entity_id,
          name: s.attributes.friendly_name || s.entity_id,
          domain: s.entity_id.split('.')[0]
        }));
      res.json({ ok: true, entities });
    } catch (err) {
      res.json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get('/api/config', (req, res) => {
    res.json({
      haUrl: store.get('haUrl') || '',
      hasToken: !!store.get('token'),
      title: store.get('title') || 'Wall Display',
      entities: store.get('entities') || [],
      layout: store.get('layout') || [],
      sunEntity: store.get('sunEntity') || '',
      screensaverSeconds: store.get('screensaverSeconds') || 0,
      screensaverEntities: store.get('screensaverEntities') || [],
      screensaverLayout: store.get('screensaverLayout') || [],
      notifyEntity: store.get('notifyEntity') || '',
      batteryThreshold: store.get('batteryThreshold') || 20,
      nightModeEnabled: store.get('nightModeEnabled') || false,
      nightStart: store.get('nightStart') || '23:00',
      nightEnd: store.get('nightEnd') || '06:30',
      nightModeForceOn: store.get('nightModeForceOn') || false,
      screensaverBackground: !!store.get('screensaverBgExt'),
      screensaverBgVersion: store.get('screensaverBgVersion') || 0,
      motionWakeEnabled: store.get('motionWakeEnabled') || false,
      motionThreshold: store.get('motionThreshold') || 34,
      customTheme: store.get('customTheme') || null,
      // Kalendersteuerung
      calendarEnabled: store.get('calendarEnabled') || false,
      calendarEntity: store.get('calendarEntity') || '',
      calendarKeywords: store.get('calendarKeywords') || '',
      calendarLeadMinutes: store.get('calendarLeadMinutes') || 0,
      calendarTrailMinutes: store.get('calendarTrailMinutes') || 0,
      // Der Code selbst wird nie zurueckgegeben, nur ob einer gesetzt ist.
      hasSetupCode: !!store.get('setupCode')
      // Token bewusst NICHT an den Dashboard-Client zurueckgeben; HA-Aufrufe laufen ueber /api/ha/*
    });
  });

  // Speichert Verbindung UND/ODER Entitaeten-Auswahl UND/ODER Theme-Einstellung UND/ODER
  // Screensaver-Einstellung unabhaengig voneinander: jeweils fehlende Felder bleiben unveraendert.
  app.post('/api/config', (req, res) => {
    const {
      haUrl, token, title, entities, layout, sunEntity, screensaverSeconds, screensaverEntities,
      screensaverLayout, notifyEntity, batteryThreshold, nightModeEnabled, nightStart, nightEnd, nightModeForceOn,
      motionWakeEnabled, motionThreshold,
      calendarEnabled, calendarEntity, calendarKeywords, calendarLeadMinutes, calendarTrailMinutes,
      setupCode
    } = req.body || {};
    const finalHaUrl = haUrl || store.get('haUrl');
    const finalToken = token || store.get('token');
    if (!finalHaUrl || !finalToken) return res.status(400).json({ ok: false, error: 'haUrl und token erforderlich' });
    store.set('haUrl', finalHaUrl);
    store.set('token', finalToken);
    if (title !== undefined) store.set('title', title);
    if (entities !== undefined) store.set('entities', entities);
    if (layout !== undefined) store.set('layout', layout);
    if (sunEntity !== undefined) store.set('sunEntity', sunEntity);
    if (screensaverSeconds !== undefined) store.set('screensaverSeconds', screensaverSeconds);
    if (screensaverEntities !== undefined) store.set('screensaverEntities', screensaverEntities);
    if (screensaverLayout !== undefined) store.set('screensaverLayout', screensaverLayout);
    if (notifyEntity !== undefined) store.set('notifyEntity', notifyEntity);
    if (batteryThreshold !== undefined) store.set('batteryThreshold', batteryThreshold);
    if (nightModeEnabled !== undefined) store.set('nightModeEnabled', nightModeEnabled);
    if (nightStart !== undefined) store.set('nightStart', nightStart);
    if (nightEnd !== undefined) store.set('nightEnd', nightEnd);
    if (nightModeForceOn !== undefined) store.set('nightModeForceOn', nightModeForceOn);
    if (motionWakeEnabled !== undefined) store.set('motionWakeEnabled', motionWakeEnabled);
    if (motionThreshold !== undefined) store.set('motionThreshold', motionThreshold);

    if (calendarEnabled !== undefined) store.set('calendarEnabled', !!calendarEnabled);
    if (calendarEntity !== undefined) store.set('calendarEntity', String(calendarEntity || ''));
    if (calendarKeywords !== undefined) store.set('calendarKeywords', String(calendarKeywords || ''));
    if (calendarLeadMinutes !== undefined) store.set('calendarLeadMinutes', Math.max(0, Number(calendarLeadMinutes) || 0));
    if (calendarTrailMinutes !== undefined) store.set('calendarTrailMinutes', Math.max(0, Number(calendarTrailMinutes) || 0));

    // Mindestlaenge, damit das Feld nicht versehentlich leer bleibt und der Schutz still ausfaellt.
    if (setupCode !== undefined && String(setupCode).length > 0) {
      const code = String(setupCode);
      if (code.length < 4) return res.status(400).json({ ok: false, error: 'Der Zugangscode muss mindestens 4 Zeichen haben' });
      store.set('setupCode', code);
      sessions.clear(); // nach einer Code-Aenderung muessen sich alle Geraete neu anmelden
    }

    res.json({ ok: true });
    if (onConfigSaved) onConfigSaved();
    // Sofort neu abrufen, statt bis zu zwei Minuten auf den naechsten Takt zu warten.
    if (controller) controller.refresh().catch(() => {});
  });

  app.post('/api/reset', (req, res) => {
    store.clear();
    res.json({ ok: true });
    if (onConfigSaved) onConfigSaved();
  });

  // --- Kalendersteuerung ----------------------------------------------------------------------

  app.get('/api/calendar/state', (req, res) => {
    if (!controller) return res.json({ ok: false, error: 'Steuerung nicht aktiv' });
    res.json({ ok: true, state: controller.getState() });
  });

  // Der zweite von drei Wegen in die Pause -- dieser hier ist der, den man vom Handy aus findet.
  app.post('/api/calendar/pause', (req, res) => {
    if (!controller) return res.json({ ok: false, error: 'Steuerung nicht aktiv' });
    const pausedUntil = controller.pause(req.body && req.body.minutes);
    res.json({ ok: true, pausedUntil, state: controller.getState() });
  });

  app.post('/api/calendar/resume', (req, res) => {
    if (!controller) return res.json({ ok: false, error: 'Steuerung nicht aktiv' });
    controller.resume();
    res.json({ ok: true, state: controller.getState() });
  });

  // Vorschau: welche Treffer liefert die aktuelle Keyword-Eingabe? Erlaubt es, die Einstellung
  // zu pruefen, ohne auf den naechsten Termin warten zu muessen.
  app.get('/api/calendar/preview', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    const entity = req.query.entity || store.get('calendarEntity');
    const keywords = req.query.keywords !== undefined ? req.query.keywords : store.get('calendarKeywords');
    if (!haUrl || !token) return res.json({ ok: false, error: 'Erst Verbindung einrichten' });
    if (!entity) return res.json({ ok: false, error: 'Kein Kalender ausgewählt' });
    try {
      const windows = await calendar.fetchWindows({
        haUrl, token, entity, keywords,
        leadMinutes: Number(req.query.lead) || 0,
        trailMinutes: Number(req.query.trail) || 0
      });
      res.json({
        ok: true,
        windows: windows.slice(0, 20).map(w => ({
          title: w.title, start: w.start.toISOString(), end: w.end.toISOString()
        }))
      });
    } catch (err) {
      res.json({ ok: false, error: String(err.message || err) });
    }
  });

  // Proxy fuer das Dashboard: aktuelle Zustaende ausgewaehlter Entitaeten
  app.get('/api/ha/states', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'nicht konfiguriert' });
    try {
      const r = await haFetch(haUrl, token, '/api/states');
      const states = await r.json();
      res.json({ ok: true, states });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  // Proxy fuer Service-Aufrufe (z.B. Licht schalten)
  app.post('/api/ha/service', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    const { domain, service, service_data } = req.body || {};
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'nicht konfiguriert' });
    try {
      const r = await haFetch(haUrl, token, `/api/services/${domain}/${service}`, {
        method: 'POST',
        body: JSON.stringify(service_data || {})
      });
      const data = await r.json().catch(() => ({}));
      res.json({ ok: r.ok, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  // Verlaufsdaten fuer die "Verlauf"-Karte (Sparkline der letzten Stunden)
  app.get('/api/ha/history', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    const entity_id = req.query.entity_id;
    const hours = parseInt(req.query.hours, 10) || 24;
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'nicht konfiguriert' });
    if (!entity_id) return res.status(400).json({ ok: false, error: 'entity_id erforderlich' });
    const start = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    try {
      const r = await haFetch(haUrl, token, `/api/history/period/${start}?filter_entity_id=${encodeURIComponent(entity_id)}&minimal_response`);
      if (!r.ok) return res.json({ ok: false, error: `HA antwortete mit Status ${r.status}` });
      const data = await r.json();
      const series = (data[0] || [])
        .map(p => ({ t: p.last_changed, v: parseFloat(p.state) }))
        .filter(p => !isNaN(p.v));
      res.json({ ok: true, series });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  // Standortverlauf fuer die Tracker-Unterdashboard-Karte (z.B. GPS-Halsband der Katze) --
  // anders als /api/ha/history: braucht volle Attribute (lat/lon/Akku) statt nur Zahlenwerte,
  // und einen frei waehlbaren Start/Ende-Zeitraum statt nur "die letzten X Stunden".
  app.get('/api/ha/tracker-history', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    const entity_id = req.query.entity_id;
    const start = req.query.start;
    const end = req.query.end;
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'nicht konfiguriert' });
    if (!entity_id) return res.status(400).json({ ok: false, error: 'entity_id erforderlich' });
    if (!start || !end) return res.status(400).json({ ok: false, error: 'start und end erforderlich' });
    try {
      const qs = `filter_entity_id=${encodeURIComponent(entity_id)}&end_time=${encodeURIComponent(end)}`;
      const r = await haFetch(haUrl, token, `/api/history/period/${encodeURIComponent(start)}?${qs}`);
      if (!r.ok) return res.json({ ok: false, error: `HA antwortete mit Status ${r.status}` });
      const data = await r.json();
      const raw = data[0] || [];
      const points = raw
        .map(p => ({
          lat: p.attributes && parseFloat(p.attributes.latitude),
          lon: p.attributes && parseFloat(p.attributes.longitude),
          battery: p.attributes && (p.attributes.battery_level ?? p.attributes.battery),
          t: p.last_changed
        }))
        .filter(p => !isNaN(p.lat) && !isNaN(p.lon));
      const lastBattery = [...raw].reverse().map(p => p.attributes && (p.attributes.battery_level ?? p.attributes.battery)).find(b => b !== undefined && b !== null);
      res.json({ ok: true, points, battery: lastBattery ?? null });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  // Bild-Proxy fuer Kamera-/Bild-Entitaeten (z.B. Regenradar-Karte)
  app.get('/api/ha/media', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    const entity_id = req.query.entity_id;
    if (!haUrl || !token) return res.status(400).end();
    if (!entity_id) return res.status(400).end();
    const domain = entity_id.split('.')[0];
    const endpoint = domain === 'camera'
      ? `/api/camera_proxy/${entity_id}`
      : `/api/image_proxy/${entity_id}`;
    try {
      const r = await haFetch(haUrl, token, endpoint, { headers: {} });
      if (!r.ok) return res.status(502).end();
      res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
      const buf = Buffer.from(await r.arrayBuffer());
      res.send(buf);
    } catch (err) {
      res.status(500).end();
    }
  });

  // Generischer Bild-Proxy fuer beliebige relative HA-Pfade (z.B. "entity_picture"
  // Attribut von media_player-Entitaeten fuers Album-Cover -- anders aufgebaut als der
  // Kamera-Proxy oben, daher eigener, einfacherer Endpunkt).
  app.get('/api/ha/picture', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    const path = req.query.path;
    if (!haUrl || !token) return res.status(400).end();
    if (!path || !path.startsWith('/')) return res.status(400).end();
    try {
      const r = await haFetch(haUrl, token, path, { headers: {} });
      if (!r.ok) return res.status(502).end();
      res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
      const buf = Buffer.from(await r.arrayBuffer());
      res.send(buf);
    } catch (err) {
      res.status(500).end();
    }
  });

  // Update-Steuerung aus dem Webinterface
  app.get('/api/update/status', (req, res) => {
    if (!updater) return res.json({ ok: false, error: 'Updater nicht verfuegbar' });
    res.json({ ok: true, currentVersion: updater.currentVersion, ...updater.getState() });
  });

  // autoInstall=true ist der Ein-Klick-Weg: suchen, laden, installieren ohne weitere Rueckfrage.
  app.post('/api/update/check', (req, res) => {
    if (!updater) return res.status(400).json({ ok: false, error: 'Updater nicht verfuegbar' });
    updater.check(!!(req.body && req.body.autoInstall));
    res.json({ ok: true });
  });

  app.post('/api/update/install', (req, res) => {
    if (!updater) return res.status(400).json({ ok: false, error: 'Updater nicht verfuegbar' });
    const state = updater.getState();
    if (!state.downloaded) return res.status(400).json({ ok: false, error: 'Noch kein Update heruntergeladen' });
    res.json({ ok: true });
    setTimeout(() => updater.install(), 300); // Antwort erst rausschicken, dann App beenden/installieren
  });

  // Kommende Termine einer calendar-Entitaet (z.B. von einer Muellkalender-Integration wie
  // Abfall.io) -- HA's normaler /api/states liefert nur den GERADE laufenden Termin, fuer eine
  // Liste kommender Termine gibt es eine eigene REST-Route mit Zeitfenster.
  app.get('/api/ha/calendar-events', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    const entity_id = req.query.entity_id;
    const days = Math.max(1, Math.min(180, parseInt(req.query.days, 10) || 60));
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'nicht konfiguriert' });
    if (!entity_id) return res.status(400).json({ ok: false, error: 'entity_id erforderlich' });
    try {
      const start = new Date();
      const end = new Date(Date.now() + days * 86400000);
      const qs = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
      const r = await haFetch(haUrl, token, `/api/calendars/${entity_id}?${qs}`);
      if (!r.ok) return res.json({ ok: false, error: `HA antwortete mit Status ${r.status}` });
      const events = await r.json();
      const normalized = (Array.isArray(events) ? events : [])
        .map(e => ({
          summary: e.summary || e.message || '',
          start: (e.start && (e.start.dateTime || e.start.date)) || e.start || null
        }))
        .filter(e => e.start)
        .sort((a, b) => new Date(a.start) - new Date(b.start));
      res.json({ ok: true, events: normalized });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  // Vorhersagedaten fuer die "Wettervorhersage"-Karte. HA hat den Zugriffsweg im
  // Lauf der Zeit geaendert: aeltere Versionen liefern sie als Attribut "forecast"
  // am weather-Entity, neuere nur noch per Service-Aufruf "weather.get_forecasts"
  // mit Response-Daten -- wir versuchen beides, in dieser Reihenfolge.
  app.get('/api/ha/forecast', async (req, res) => {
    const haUrl = store.get('haUrl');
    const token = store.get('token');
    const entity_id = req.query.entity_id;
    const requestedType = req.query.type; // 'daily' | 'hourly' | 'twice_daily' -- optional, sonst Fallback-Reihenfolge
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'nicht konfiguriert' });
    if (!entity_id) return res.status(400).json({ ok: false, error: 'entity_id erforderlich' });
    try {
      // 1) Alter Weg: Attribut "forecast" direkt am weather-Entity (manche Integrationen
      // liefern es noch, obwohl im HA-Core als deprecated markiert). Gilt unabhaengig vom
      // gewuenschten Typ, da dieser Weg keine Typ-Auswahl kennt.
      const stateRes = await haFetch(haUrl, token, `/api/states/${entity_id}`);
      if (stateRes.ok) {
        const state = await stateRes.json();
        const attrForecast = state.attributes && state.attributes.forecast;
        if (Array.isArray(attrForecast) && attrForecast.length) {
          return res.json({ ok: true, forecast: attrForecast });
        }
      }

      // 2) Neuer Weg: Service "weather.get_forecasts" mit Response-Daten. HA packt die
      // Antwort je nach Version leicht unterschiedlich ein -- mehrere Formen probieren.
      // Ohne explizit gewaehlten Typ wird die alte Fallback-Reihenfolge probiert.
      const typesToTry = requestedType ? [requestedType] : ['daily', 'twice_daily', 'hourly'];
      let lastRaw = '';
      let lastStatus = 0;
      for (const type of typesToTry) {
        const svcRes = await haFetch(haUrl, token, `/api/services/weather/get_forecasts?return_response=true`, {
          method: 'POST',
          body: JSON.stringify({ entity_id, type })
        });
        lastStatus = svcRes.status;
        const text = await svcRes.text();
        lastRaw = text;
        if (!svcRes.ok) continue;
        let data = null;
        try { data = JSON.parse(text); } catch (e) { continue; }
        const forecast =
          (data.service_response && data.service_response[entity_id] && data.service_response[entity_id].forecast) ||
          (data.response && data.response[entity_id] && data.response[entity_id].forecast) ||
          (data[entity_id] && data[entity_id].forecast);
        if (Array.isArray(forecast) && forecast.length) {
          return res.json({ ok: true, forecast });
        }
      }
      res.json({
        ok: false,
        error: `Keine Vorhersagedaten gefunden (letzter Service-Status ${lastStatus}: ${lastRaw.slice(0, 200)})`
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  // --- Debug-Werkzeug fuer die Vorhersage-Karte: eigene URL/Token pro Anfrage (nicht
  // zwingend die gespeicherte Verbindung), zeigt jeden Versuch inkl. Rohantwort. ---
  app.get('/api/debug/weather-entities', async (req, res) => {
    const haUrl = req.query.haUrl || store.get('haUrl');
    const token = req.query.token || store.get('token');
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'haUrl und token erforderlich' });
    try {
      const r = await haFetch(haUrl, token, '/api/states');
      if (!r.ok) return res.json({ ok: false, error: `HA antwortete mit Status ${r.status}` });
      const states = await r.json();
      const entities = states
        .filter(s => s.entity_id.startsWith('weather.'))
        .map(s => ({ entity_id: s.entity_id, name: s.attributes.friendly_name || s.entity_id }));
      res.json({ ok: true, entities });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get('/api/debug/forecast', async (req, res) => {
    const haUrl = req.query.haUrl || store.get('haUrl');
    const token = req.query.token || store.get('token');
    const entity_id = req.query.entity_id;
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'haUrl und token erforderlich' });
    if (!entity_id) return res.status(400).json({ ok: false, error: 'entity_id erforderlich' });

    const steps = [];
    let finalForecast = null;

    try {
      // Schritt 1: Attribut "forecast" direkt am Entity (alter, evtl. noch aktiver Weg)
      const stateRes = await haFetch(haUrl, token, `/api/states/${entity_id}`);
      const stateText = await stateRes.text();
      let stateJson = null;
      try { stateJson = JSON.parse(stateText); } catch (e) { /* kein JSON */ }
      const attrForecast = stateJson && stateJson.attributes && stateJson.attributes.forecast;
      const attrFound = Array.isArray(attrForecast) && attrForecast.length > 0;
      steps.push({
        step: 'Attribut "forecast" am Entity (GET /api/states/<entity_id>)',
        status: stateRes.status,
        found: attrFound,
        count: attrFound ? attrForecast.length : 0,
        raw: stateText.slice(0, 3000)
      });
      if (attrFound) finalForecast = attrForecast;

      // Schritt 2: Service weather.get_forecasts fuer jeden bekannten Vorhersage-Typ
      for (const type of ['daily', 'twice_daily', 'hourly']) {
        const svcRes = await haFetch(haUrl, token, `/api/services/weather/get_forecasts?return_response=true`, {
          method: 'POST',
          body: JSON.stringify({ entity_id, type })
        });
        const text = await svcRes.text();
        let data = null;
        try { data = JSON.parse(text); } catch (e) { /* kein JSON */ }
        const forecast = data && (
          (data.service_response && data.service_response[entity_id] && data.service_response[entity_id].forecast) ||
          (data.response && data.response[entity_id] && data.response[entity_id].forecast) ||
          (data[entity_id] && data[entity_id].forecast)
        );
        const found = Array.isArray(forecast) && forecast.length > 0;
        steps.push({
          step: `Service weather.get_forecasts (type="${type}")`,
          status: svcRes.status,
          found,
          count: found ? forecast.length : 0,
          raw: text.slice(0, 3000)
        });
        if (!finalForecast && found) finalForecast = forecast;
      }

      res.json({ ok: true, steps, forecast: finalForecast || [] });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err), steps });
    }
  });

  // --- Zusaetzliche, eigenstaendige Dashboards (Unterdashboards) ------------------------
  app.get('/api/dashboards', (req, res) => {
    const list = store.get('dashboards') || [];
    res.json({ ok: true, dashboards: list.map(d => ({ id: d.id, name: d.name, type: d.type || 'cards' })) });
  });

  app.get('/api/dashboards/:id', (req, res) => {
    const list = store.get('dashboards') || [];
    const d = list.find(x => x.id === req.params.id);
    if (!d) return res.status(404).json({ ok: false, error: 'Dashboard nicht gefunden' });
    res.json({ ok: true, dashboard: d });
  });

  // Neues Dashboard anlegen -- type "cards" (Standard, wie bisher) oder "tracker"
  // (Kartenansicht mit Standort+Verlauf eines device_tracker, z.B. fuer ein GPS-Halsband).
  app.post('/api/dashboards', (req, res) => {
    const { name, type, trackerEntity } = req.body || {};
    const list = store.get('dashboards') || [];
    const id = 'db_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const entry = { id, name: (name || 'Dashboard').trim() || 'Dashboard', type: type === 'tracker' ? 'tracker' : 'cards', layout: [] };
    if (entry.type === 'tracker') entry.trackerEntity = trackerEntity || '';
    list.push(entry);
    store.set('dashboards', list);
    res.json({ ok: true, id });
  });

  // Bestehendes Dashboard speichern (Name, Karten-Layout, und/oder Tracker-Einstellungen)
  app.post('/api/dashboards/:id', (req, res) => {
    const list = store.get('dashboards') || [];
    const idx = list.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Dashboard nicht gefunden' });
    const { name, layout, trackerEntity, trackerIconDataUrl, trackerDefaultZoom, trackerShowZones, trackerAutoCenter } = req.body || {};
    if (name !== undefined) list[idx].name = name;
    if (layout !== undefined) list[idx].layout = layout;
    if (trackerEntity !== undefined) list[idx].trackerEntity = trackerEntity;
    if (trackerIconDataUrl !== undefined) list[idx].trackerIconDataUrl = trackerIconDataUrl;
    if (trackerDefaultZoom !== undefined) list[idx].trackerDefaultZoom = trackerDefaultZoom;
    if (trackerShowZones !== undefined) list[idx].trackerShowZones = trackerShowZones;
    if (trackerAutoCenter !== undefined) list[idx].trackerAutoCenter = trackerAutoCenter;
    store.set('dashboards', list);
    res.json({ ok: true });
    if (onConfigSaved) onConfigSaved();
  });

  app.post('/api/dashboards/:id/delete', (req, res) => {
    const list = (store.get('dashboards') || []).filter(x => x.id !== req.params.id);
    store.set('dashboards', list);
    res.json({ ok: true });
    if (onConfigSaved) onConfigSaved();
  });

  // Liest HA's Energie-Dashboard-Konfiguration aus (Netz-/Solar-/Batterie-Entitaeten,
  // wie im "Einstellungen -> Dashboards -> Energie" von HA hinterlegt) und schlaegt
  // daraus passende Live-Leistungssensoren vor. Bewusst best-effort: HA erlaubt hier
  // pro Quelle mehrere Statistik-IDs, wir nehmen jeweils die erste sinnvolle.
  app.get('/api/ha/energy-prefs', async (req, res) => {
    const haUrl = req.query.haUrl || store.get('haUrl');
    const token = req.query.token || store.get('token');
    if (!haUrl || !token) return res.status(400).json({ ok: false, error: 'nicht konfiguriert' });
    try {
      const prefs = await haWebsocketCommand(haUrl, token, { type: 'energy/get_prefs' });
      const sources = prefs.energy_sources || [];
      const gridSource = sources.find(s => s.type === 'grid');
      const solarSources = sources.filter(s => s.type === 'solar');
      const batterySources = sources.filter(s => s.type === 'battery');

      const gridConsumption = gridSource && gridSource.flow_from && gridSource.flow_from[0]
        ? gridSource.flow_from[0].stat_energy_from : '';
      const gridReturn = gridSource && gridSource.flow_to && gridSource.flow_to[0]
        ? gridSource.flow_to[0].stat_energy_to : '';
      const solar = solarSources[0] ? solarSources[0].stat_energy_from : '';
      const batteryIn = batterySources[0] ? batterySources[0].stat_energy_to : '';
      const batteryOut = batterySources[0] ? batterySources[0].stat_energy_from : '';

      res.json({
        ok: true,
        gridConsumption, gridReturn, solar, batteryIn, batteryOut,
        raw: prefs // fuer Debug-Zwecke, falls die Zuordnung nicht passt
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  // --- Screensaver-Hintergrundbild: als Base64-Data-URL hochgeladen, direkt neben der
  // Config-Datei auf der Platte gespeichert (kein separater Ordner noetig).
  function bgDir() { return path.dirname(store.path); }
  function bgFilePath(ext) { return path.join(bgDir(), 'screensaver-bg' + ext); }

  app.post('/api/screensaver/background', (req, res) => {
    const { dataUrl } = req.body || {};
    const match = dataUrl && dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!match) return res.status(400).json({ ok: false, error: 'Ungültiges Bildformat (JPEG, PNG oder WEBP erwartet)' });
    try {
      const oldExt = store.get('screensaverBgExt');
      if (oldExt) { try { fs.unlinkSync(bgFilePath(oldExt)); } catch (e) { /* gab es evtl. nicht mehr */ } }
      const ext = '.' + (match[1] === 'jpeg' ? 'jpg' : match[1]);
      fs.writeFileSync(bgFilePath(ext), Buffer.from(match[2], 'base64'));
      store.set('screensaverBgExt', ext);
      store.set('screensaverBgVersion', Date.now());
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get('/api/screensaver/background', (req, res) => {
    const ext = store.get('screensaverBgExt');
    if (!ext) return res.status(404).end();
    const filePath = bgFilePath(ext);
    if (!fs.existsSync(filePath)) return res.status(404).end();
    res.sendFile(filePath);
  });

  app.post('/api/screensaver/background/remove', (req, res) => {
    const ext = store.get('screensaverBgExt');
    if (ext) { try { fs.unlinkSync(bgFilePath(ext)); } catch (e) { /* gab es evtl. nicht mehr */ } }
    store.delete('screensaverBgExt');
    store.delete('screensaverBgVersion');
    res.json({ ok: true });
  });

  // --- Foto-Bereich-Karte: eigenes Bild pro Karte (nicht nur eine globale wie beim
  // Screensaver) -- Karten-ID (z.B. "photo:1712345678") wird fuer den Dateinamen bereinigt.
  function photoCardFilePath(cardId, ext) {
    const safeId = String(cardId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(bgDir(), 'photo-card-' + safeId + ext);
  }

  app.post('/api/photo-card/:cardId/background', (req, res) => {
    const cardId = req.params.cardId;
    const { dataUrl } = req.body || {};
    const match = dataUrl && dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!match) return res.status(400).json({ ok: false, error: 'Ungültiges Bildformat (JPEG, PNG oder WEBP erwartet)' });
    try {
      const oldExt = store.get('photoCardExt:' + cardId);
      if (oldExt) { try { fs.unlinkSync(photoCardFilePath(cardId, oldExt)); } catch (e) { /* gab es evtl. nicht mehr */ } }
      const ext = '.' + (match[1] === 'jpeg' ? 'jpg' : match[1]);
      fs.writeFileSync(photoCardFilePath(cardId, ext), Buffer.from(match[2], 'base64'));
      store.set('photoCardExt:' + cardId, ext);
      store.set('photoCardVersion:' + cardId, Date.now());
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  });

  app.get('/api/photo-card/:cardId/background', (req, res) => {
    const cardId = req.params.cardId;
    const ext = store.get('photoCardExt:' + cardId);
    if (!ext) return res.status(404).end();
    const filePath = photoCardFilePath(cardId, ext);
    if (!fs.existsSync(filePath)) return res.status(404).end();
    res.sendFile(filePath);
  });

  app.post('/api/photo-card/:cardId/background/remove', (req, res) => {
    const cardId = req.params.cardId;
    const ext = store.get('photoCardExt:' + cardId);
    if (ext) { try { fs.unlinkSync(photoCardFilePath(cardId, ext)); } catch (e) { /* gab es evtl. nicht mehr */ } }
    store.delete('photoCardExt:' + cardId);
    store.delete('photoCardVersion:' + cardId);
    res.json({ ok: true });
  });

  // --- Design-Import: eine JSON-Datei kann Farben UND Formen/Abstaende auf einen Schlag
  // ersetzen (statt alles einzeln einzustellen). Erwartetes Format siehe design-import.html
  // (Felder fuer dark/light je Farbe, plus cardRadius/cardShadow). Wird nur grob auf Struktur
  // geprueft -- die eigentlichen Werte landen 1:1 als CSS-Variablen im Client.
  const THEME_KEYS = ['bg', 'surface', 'panel2', 'cardBorder', 'text', 'muted'];
  function validTheme(t) {
    if (!t || typeof t !== 'object') return false;
    if (!t.dark || !t.light) return false;
    for (const mode of [t.dark, t.light]) {
      if (typeof mode !== 'object') return false;
      for (const k of THEME_KEYS) if (typeof mode[k] !== 'string') return false;
    }
    // Alles ab hier ist optional (Glas-Effekt + generisches Escape-Hatch fuer komplexere
    // Designs) -- wird nur auf Typ geprueft, wenn ueberhaupt vorhanden.
    const OPTIONAL_STRING_KEYS = ['cardRadius', 'cardShadow', 'cardBlur', 'cardSaturate',
      'cardHighlight', 'cardHighlightSide', 'pageBgImage', 'pageBgGradient', 'extraCss', 'name'];
    for (const k of OPTIONAL_STRING_KEYS) if (t[k] !== undefined && typeof t[k] !== 'string') return false;
    if (typeof t.extraCss === 'string' && t.extraCss.length > 20000) return false; // grobe Notbremse
    return true;
  }

  app.post('/api/theme/import', (req, res) => {
    const theme = req.body;
    if (!validTheme(theme)) {
      return res.status(400).json({ ok: false, error: 'Ungültiges Design-Format – dark/light mit bg, surface, panel2, cardBorder, text, muted (alle als Text) erforderlich.' });
    }
    store.set('customTheme', theme);
    res.json({ ok: true });
  });

  app.post('/api/theme/reset', (req, res) => {
    store.delete('customTheme');
    res.json({ ok: true });
  });

  // Der HTTP-Server haengt am app-Objekt, damit Tests ihn wieder schliessen koennen -- ohne das
  // bleibt der Node-Prozess nach einem Test ewig offen.
  app.server = app.listen(port, '0.0.0.0', () => {
    console.log(`Setup-Server laeuft auf Port ${port}`);
  });

  return app;
}

module.exports = { startServer };
