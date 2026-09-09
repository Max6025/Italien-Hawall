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
  if (!dashboards.length) {
    list.innerHTML = '<p class="note">Noch keine Unterdashboards angelegt.</p>';
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
      <button class="delete-link" data-id="${d.id}">Löschen</button>
    `;
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
