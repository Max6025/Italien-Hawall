const $ = id => document.getElementById(id);

async function load() {
  const [configRes, sunEntitiesRes, textEntitiesRes] = await Promise.all([
    fetch('/api/config').then(r => r.json()),
    fetch('/api/entities?domain=sun').then(r => r.json()),
    fetch('/api/entities?domain=input_text').then(r => r.json())
  ]);
  const sunSelect = $('sunEntity');
  if (sunEntitiesRes.ok) {
    sunEntitiesRes.entities.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.entity_id;
      opt.textContent = e.name;
      if (e.entity_id === configRes.sunEntity) opt.selected = true;
      sunSelect.appendChild(opt);
    });
  }
  const notifySelect = $('notifyEntity');
  if (textEntitiesRes.ok) {
    textEntitiesRes.entities.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.entity_id;
      opt.textContent = e.name;
      if (e.entity_id === configRes.notifyEntity) opt.selected = true;
      notifySelect.appendChild(opt);
    });
  }
  $('batteryThreshold').value = configRes.batteryThreshold || 20;
  $('nightEnabled').checked = !!configRes.nightModeEnabled;
  $('nightStart').value = configRes.nightStart || '23:00';
  $('nightEnd').value = configRes.nightEnd || '06:30';
  $('nightForceOn').checked = !!configRes.nightModeForceOn;
  $('motionEnabled').checked = !!configRes.motionWakeEnabled;
  $('motionThreshold').value = configRes.motionThreshold || 34;
  $('screensaverSeconds').value = configRes.screensaverSeconds || 0;

  // Kalendersteuerung
  $('calEnabled').checked = !!configRes.calendarEnabled;
  $('calKeywords').value = configRes.calendarKeywords || '';
  $('calLead').value = configRes.calendarLeadMinutes || 0;
  $('calTrail').value = configRes.calendarTrailMinutes || 0;

  const calSelect = $('calEntity');
  calSelect.innerHTML = '<option value="">– kein Kalender ausgewählt –</option>';
  const calRes = await fetch('/api/entities?domain=calendar').then(r => r.json()).catch(() => ({ ok: false }));
  if (calRes.ok && calRes.entities.length) {
    calRes.entities.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.entity_id;
      opt.textContent = `${e.name} (${e.entity_id})`;
      if (e.entity_id === configRes.calendarEntity) opt.selected = true;
      calSelect.appendChild(opt);
    });
  } else {
    calSelect.innerHTML = '<option value="">– keine Kalender in Home Assistant gefunden –</option>';
  }

  // Ankunftsschirm
  $('welcomeEnabled').checked = !!configRes.welcomeEnabled;
  $('welcomeHeading').value = configRes.welcomeHeading || '';
  $('welcomeText').value = configRes.welcomeText || '';
  $('welcomeCaption').value = configRes.welcomeCaption || '';
  $('welcomeHours').value = configRes.welcomeHours === undefined ? 5 : configRes.welcomeHours;

  const bildSelect = $('welcomeImageEntity');
  bildSelect.innerHTML = '<option value="">– kein Bild –</option>';
  const bildRes = await fetch('/api/entities?domain=image').then(r => r.json()).catch(() => ({ ok: false }));
  if (bildRes.ok && bildRes.entities.length) {
    bildRes.entities.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.entity_id;
      opt.textContent = `${e.name} (${e.entity_id})`;
      if (e.entity_id === configRes.welcomeImageEntity) opt.selected = true;
      bildSelect.appendChild(opt);
    });
  } else {
    bildSelect.innerHTML = '<option value="">– keine Bild-Entitäten in Home Assistant gefunden –</option>';
  }

  $('codeState').textContent = configRes.hasSetupCode
    ? 'Es ist ein Zugangscode gesetzt. Leer lassen, um ihn nicht zu ändern.'
    : 'Es ist noch KEIN Zugangscode gesetzt – diese Seite ist derzeit für jeden im Netzwerk offen.';

  refreshCalStatus();
}

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

const REASON_TEXT = {
  'nicht-konfiguriert': 'Kalendersteuerung ist aus oder unvollständig – der Bildschirm bleibt an.',
  'karenzzeit': 'Karenzzeit nach dem Start – es wird vorerst nicht abgeschaltet.',
  'pause': 'Pausiert – der Bildschirm bleibt an.',
  'nachtsperre': 'Nachtsperre aktiv – der Bildschirm bleibt aus.',
  'anzeigefenster': 'Ein passender Termin läuft – der Bildschirm ist an.',
  'kein-treffer': 'Kein passender Termin – der Bildschirm ist aus.'
};

async function refreshCalStatus() {
  const el = $('calStatus');
  const res = await fetch('/api/calendar/state').then(r => r.json()).catch(() => ({ ok: false }));
  if (!res.ok || !res.state) { el.textContent = 'Status nicht verfügbar.'; return; }
  const s = res.state;
  const lines = [];
  lines.push(`<strong>Bildschirm ist ${s.panelOn ? 'an' : 'aus'}.</strong> ${REASON_TEXT[s.reason] || ''}`);
  if (s.activeWindow) {
    lines.push(`Laufender Treffer: „${s.activeWindow.title}“ bis ${fmt(s.activeWindow.end)}`);
  }
  if (s.nextWindow) {
    lines.push(`Nächster Treffer: „${s.nextWindow.title}“ ab ${fmt(s.nextWindow.start)}`);
  } else if (s.configured) {
    lines.push('Kein weiterer Treffer in den nächsten 30 Tagen.');
  }
  if (s.pausedUntil) lines.push(`Pause läuft bis ${fmt(new Date(s.pausedUntil).toISOString())}.`);
  if (s.error) lines.push(`<span style="color:#f28b82">Home Assistant nicht erreichbar: ${s.error.message}</span>`);
  else if (s.lastPollOk) lines.push(`Zuletzt erfolgreich abgerufen: ${fmt(s.lastPollOk)}`);
  el.innerHTML = lines.join('<br>');
}

async function saveCalendar() {
  const resultEl = $('saveCalResult');
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calendarEnabled: $('calEnabled').checked,
      calendarEntity: $('calEntity').value,
      calendarKeywords: $('calKeywords').value,
      calendarLeadMinutes: parseInt($('calLead').value, 10) || 0,
      calendarTrailMinutes: parseInt($('calTrail').value, 10) || 0
    })
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Gespeichert.';
    resultEl.className = 'result ok';
    setTimeout(refreshCalStatus, 1200); // dem sofortigen Neuabruf kurz Zeit geben
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
  }
}

$('saveCalBtn').addEventListener('click', saveCalendar);

$('saveWelcomeBtn').addEventListener('click', async () => {
  const resultEl = $('saveWelcomeResult');
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      welcomeEnabled: $('welcomeEnabled').checked,
      welcomeHeading: $('welcomeHeading').value,
      welcomeText: $('welcomeText').value,
      welcomeImageEntity: $('welcomeImageEntity').value,
      welcomeCaption: $('welcomeCaption').value,
      welcomeHours: parseInt($('welcomeHours').value, 10) || 0
    })
  });
  const data = await r.json();
  resultEl.textContent = data.ok ? 'Gespeichert.' : 'Fehler: ' + data.error;
  resultEl.className = data.ok ? 'result ok' : 'result err';
});

$('showWelcomeBtn').addEventListener('click', async () => {
  const resultEl = $('showWelcomeResult');
  const r = await fetch('/api/welcome/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const data = await r.json();
  resultEl.textContent = data.ok
    ? 'Zurückgesetzt. Läuft gerade ein Termin, erscheint der Ankunftsschirm gleich auf dem Display.'
    : 'Fehler: ' + data.error;
  resultEl.className = data.ok ? 'result ok' : 'result err';
});

$('calPauseBtn').addEventListener('click', async () => {
  await fetch('/api/calendar/pause', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  refreshCalStatus();
});

$('calResumeBtn').addEventListener('click', async () => {
  await fetch('/api/calendar/resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  refreshCalStatus();
});

// Vorschau gegen die AKTUELLEN Eingabefelder, nicht gegen das Gespeicherte -- so laesst sich eine
// Keyword-Aenderung pruefen, bevor man sie festschreibt.
$('calPreviewBtn').addEventListener('click', async () => {
  const el = $('calPreview');
  el.className = 'result';
  el.textContent = 'Suche Treffer …';
  const q = new URLSearchParams({
    entity: $('calEntity').value,
    keywords: $('calKeywords').value,
    lead: String(parseInt($('calLead').value, 10) || 0),
    trail: String(parseInt($('calTrail').value, 10) || 0)
  });
  const res = await fetch('/api/calendar/preview?' + q).then(r => r.json()).catch(() => ({ ok: false, error: 'Netzwerkfehler' }));
  if (!res.ok) { el.className = 'result err'; el.textContent = 'Fehler: ' + res.error; return; }
  if (!res.windows.length) { el.className = 'result'; el.textContent = 'Keine Treffer in den nächsten 30 Tagen.'; return; }
  el.className = 'result ok';
  el.innerHTML = res.windows.map(w => `„${w.title}“: ${fmt(w.start)} – ${fmt(w.end)}`).join('<br>');
});

$('saveCodeBtn').addEventListener('click', async () => {
  const resultEl = $('saveCodeResult');
  const code = $('setupCode').value;
  if (!code) { resultEl.className = 'result'; resultEl.textContent = 'Kein Code eingegeben – unverändert.'; return; }
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setupCode: code })
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Code gespeichert. Alle angemeldeten Geräte müssen ihn neu eingeben.';
    resultEl.className = 'result ok';
    $('setupCode').value = '';
    $('codeState').textContent = 'Es ist ein Zugangscode gesetzt. Leer lassen, um ihn nicht zu ändern.';
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
  }
});

$('saveBtn').addEventListener('click', async () => {
  const resultEl = $('saveResult');
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sunEntity: $('sunEntity').value })
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Gespeichert.';
    resultEl.className = 'result ok';
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
  }
});

$('saveNotifyBtn').addEventListener('click', async () => {
  const resultEl = $('saveNotifyResult');
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notifyEntity: $('notifyEntity').value })
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Gespeichert.';
    resultEl.className = 'result ok';
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
  }
});

$('saveBatteryBtn').addEventListener('click', async () => {
  const resultEl = $('saveBatteryResult');
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batteryThreshold: parseInt($('batteryThreshold').value, 10) || 20 })
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Gespeichert.';
    resultEl.className = 'result ok';
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
  }
});

$('saveNightBtn').addEventListener('click', async () => {
  const resultEl = $('saveNightResult');
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nightModeEnabled: $('nightEnabled').checked,
      nightStart: $('nightStart').value || '23:00',
      nightEnd: $('nightEnd').value || '06:30',
      nightModeForceOn: $('nightForceOn').checked
    })
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Gespeichert.';
    resultEl.className = 'result ok';
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
  }
});

$('saveMotionBtn').addEventListener('click', async () => {
  const resultEl = $('saveMotionResult');
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motionWakeEnabled: $('motionEnabled').checked, motionThreshold: parseInt($('motionThreshold').value, 10) })
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Gespeichert.';
    resultEl.className = 'result ok';
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
  }
});

$('saveScreensaverBtn').addEventListener('click', async () => {
  const resultEl = $('saveScreensaverResult');
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ screensaverSeconds: parseInt($('screensaverSeconds').value, 10) || 0 })
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Gespeichert.';
    resultEl.className = 'result ok';
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
  }
});

load();
// Status live halten, solange die Seite offen ist
setInterval(refreshCalStatus, 10000);
