const $ = id => document.getElementById(id);

async function loadTrackerEntities() {
  try {
    const r = await fetch('/api/entities');
    const data = await r.json();
    const entities = data.ok ? data.entities : [];
    const trackers = entities.filter(e => e.domain === 'device_tracker' || e.domain === 'person');
    $('trackerEntityList').innerHTML = trackers.map(e => `<option value="${e.entity_id}">${e.name}</option>`).join('');
  } catch (e) { /* Entitaeten-Liste ist nur eine Eingabehilfe, kein hartes Erfordernis */ }
}

async function load() {
  const r = await fetch('/api/dashboards');
  const data = await r.json();
  const list = $('dashList');
  list.innerHTML = '';
  const dashboards = data.ok ? data.dashboards : [];

  // Das Hauptdashboard steht nicht in dieser Liste -- es liegt als 'layout' in der
  // Konfiguration. Waere es hier nicht aufgefuehrt, waere ausgerechnet das wichtigste
  // Dashboard das einzige, das man nicht mitnehmen kann.
  const haupt = document.createElement('div');
  haupt.className = 'dash-item';
  haupt.innerHTML = `
    <input type="text" value="Hauptdashboard" disabled>
    <span class="dash-type-badge">🏠 Start</span>
    <a class="edit-link" href="editor.html">Karten bearbeiten</a>
    <button class="export-link">Exportieren</button>
  `;
  haupt.querySelector('.export-link').addEventListener('click', () => exportieren('/api/dashboard-haupt/export', 'Hauptdashboard'));
  list.appendChild(haupt);

  if (!dashboards.length) {
    list.insertAdjacentHTML('beforeend', '<p class="note">Noch keine Unterdashboards angelegt.</p>');
    return;
  }
  dashboards.forEach(d => {
    const isTracker = d.type === 'tracker';
    const row = document.createElement('div');
    row.className = 'dash-item';
    row.innerHTML = `
      <input type="text" value="${d.name}" data-id="${d.id}">
      <span class="dash-type-badge">${isTracker ? '📍 Tracker' : '🃏 Karten'}</span>
      ${isTracker
        ? `<a class="edit-link" href="tracker-editor.html?dashboard=${encodeURIComponent(d.id)}">Einrichten</a>`
        : `<a class="edit-link" href="editor.html?dashboard=${encodeURIComponent(d.id)}">Karten bearbeiten</a>`}
      <button class="save-link" data-id="${d.id}">Name speichern</button>
      <button class="export-link" data-id="${d.id}">Exportieren</button>
      <button class="delete-link" data-id="${d.id}">Löschen</button>
    `;
    row.querySelector('.export-link').addEventListener('click', () => exportieren(`/api/dashboards/${d.id}/export`, d.name));
    row.querySelector('.save-link').addEventListener('click', async () => {
      const name = row.querySelector('input').value.trim();
      if (!name) return;
      await fetch(`/api/dashboards/${d.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      $('result').textContent = 'Name gespeichert.';
      $('result').className = 'result ok';
    });
    row.querySelector('.delete-link').addEventListener('click', async () => {
      if (!confirm(`"${d.name}" wirklich löschen? Alle Inhalte darin gehen verloren.`)) return;
      await fetch(`/api/dashboards/${d.id}/delete`, { method: 'POST' });
      load();
    });
    list.appendChild(row);
  });
}

// --- Aus- und Eingeben -------------------------------------------------------------------------

function dateinameFuer(name) {
  const rein = String(name || 'dashboard').toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (rein || 'dashboard') + '.json';
}

async function exportieren(pfad, name) {
  const el = $('result');
  el.className = 'result';
  el.textContent = 'Exportiere...';
  try {
    const r = await fetch(pfad);
    const data = await r.json();
    if (!data.ok) {
      el.className = 'result err';
      el.textContent = 'Fehler: ' + (data.error || 'unbekannt');
      return;
    }
    // Zwei Leerzeichen Einrueckung: Die Datei soll man lesen und in ein Chatfenster werfen
    // koennen. Kompakt gespeichert waere sie kleiner und unbrauchbar.
    const text = JSON.stringify(data.datei, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = dateinameFuer(name);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);

    el.className = 'result ok';
    // Die Hinweise NICHT verschlucken: Wer eine Foto-Karte exportiert, muss wissen, dass das
    // Bild nicht mitkommt -- sonst entdeckt er es erst auf dem anderen Geraet.
    el.innerHTML = 'Exportiert als <code>' + dateinameFuer(name) + '</code>.'
      + ((data.hinweise && data.hinweise.length)
        ? '<br><br>Nicht mit übertragen:<br>• ' + data.hinweise.join('<br>• ') : '');
  } catch (e) {
    el.className = 'result err';
    el.textContent = 'Fehler: ' + (e.message || e);
  }
}

async function einspielen(text) {
  const el = $('importResult');
  el.className = 'result';
  el.textContent = 'Prüfe...';
  let datei;
  try {
    datei = JSON.parse(text);
  } catch (e) {
    el.className = 'result err';
    el.textContent = 'Das ist kein gültiges JSON: ' + (e.message || e);
    return;
  }
  try {
    const r = await fetch('/api/dashboards/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datei })
    });
    const data = await r.json();
    if (!data.ok) {
      el.className = 'result err';
      el.innerHTML = 'Nicht eingespielt:<br>• ' + (data.fehler || ['unbekannter Fehler']).join('<br>• ');
      return;
    }
    el.className = 'result ok';
    el.innerHTML = `„${data.name}“ eingespielt, ${data.anzahl} Karte${data.anzahl === 1 ? '' : 'n'}.`
      + ((data.warnungen && data.warnungen.length)
        ? '<br><br>Angepasst:<br>• ' + data.warnungen.join('<br>• ') : '');
    $('importText').value = '';
    load();
  } catch (e) {
    el.className = 'result err';
    el.textContent = 'Fehler: ' + (e.message || e);
  }
}

$('importFileBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', () => {
  const datei = $('importFile').files[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = () => { $('importText').value = leser.result; einspielen(leser.result); };
  leser.readAsText(datei);
  $('importFile').value = '';
});
$('importBtn').addEventListener('click', () => {
  const text = $('importText').value.trim();
  if (!text) {
    $('importResult').className = 'result err';
    $('importResult').textContent = 'Nichts einzuspielen – Datei wählen oder Text einfügen.';
    return;
  }
  einspielen(text);
});

// Wer ein Dashboard von Grund auf schreiben lassen will, hat noch keines zum Exportieren --
// und damit auch die Anleitung nicht. Deshalb gibt es sie einzeln.
$('formatBtn').addEventListener('click', async () => {
  const el = $('importResult');
  try {
    const r = await fetch('/api/dashboard-format');
    const data = await r.json();
    const text = JSON.stringify(data.anleitung, null, 2);
    await navigator.clipboard.writeText(text);
    el.className = 'result ok';
    el.textContent = 'Anleitung kopiert. In einen Chat einfügen und beschreiben, was auf das Dashboard soll.';
  } catch (e) {
    el.className = 'result err';
    el.textContent = 'Kopieren ging nicht: ' + (e.message || e);
  }
});

document.querySelectorAll('input[name="newType"]').forEach(r => {
  r.addEventListener('change', () => {
    $('trackerFieldWrap').style.display = document.querySelector('input[name="newType"]:checked').value === 'tracker' ? 'block' : 'none';
  });
});

$('createBtn').addEventListener('click', async () => {
  const name = $('newName').value.trim();
  if (!name) return;
  const type = document.querySelector('input[name="newType"]:checked').value;
  const trackerEntity = $('newTrackerEntity').value.trim();
  if (type === 'tracker' && !trackerEntity) {
    $('result').textContent = 'Bitte eine Tracker-Entität angeben.';
    $('result').className = 'result err';
    return;
  }
  const r = await fetch('/api/dashboards', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, trackerEntity })
  });
  const data = await r.json();
  if (data.ok) {
    $('newName').value = '';
    $('newTrackerEntity').value = '';
    $('result').textContent = type === 'tracker'
      ? 'Angelegt – Zeitraum & Details findest du unter "Einrichten".'
      : 'Angelegt – jetzt "Karten bearbeiten" nutzen, um Inhalte hinzuzufügen.';
    $('result').className = 'result ok';
    load();
  } else {
    $('result').textContent = 'Fehler: ' + data.error;
    $('result').className = 'result err';
  }
});

loadTrackerEntities();
load();
