const $ = id => document.getElementById(id);

function connParams() {
  const p = new URLSearchParams();
  const haUrl = $('haUrl').value.trim();
  const token = $('token').value.trim();
  if (haUrl) p.set('haUrl', haUrl);
  if (token) p.set('token', token);
  return p;
}

$('loadEntitiesBtn').addEventListener('click', async () => {
  const resultEl = $('loadResult');
  resultEl.textContent = 'Lade...';
  resultEl.className = 'result';
  const params = connParams();
  const r = await fetch(`/api/debug/weather-entities?${params.toString()}`);
  const data = await r.json();
  if (!data.ok) {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
    return;
  }
  const sel = $('entitySelect');
  sel.innerHTML = '<option value="">-- weather-Entität wählen --</option>';
  data.entities.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.entity_id;
    opt.textContent = `${e.name} (${e.entity_id})`;
    sel.appendChild(opt);
  });
  resultEl.textContent = data.entities.length
    ? `${data.entities.length} weather-Entität(en) gefunden.`
    : 'Keine weather-Entitäten gefunden.';
  resultEl.className = 'result ok';
});

$('testBtn').addEventListener('click', async () => {
  const entity_id = $('entityManual').value.trim() || $('entitySelect').value;
  const summaryEl = $('summary');
  const stepsEl = $('steps');
  if (!entity_id) {
    summaryEl.innerHTML = '<span class="badge-fail">Bitte zuerst eine Entität wählen oder eingeben.</span>';
    stepsEl.innerHTML = '';
    return;
  }
  summaryEl.textContent = 'Teste...';
  stepsEl.innerHTML = '';

  const params = connParams();
  params.set('entity_id', entity_id);
  const r = await fetch(`/api/debug/forecast?${params.toString()}`);
  const data = await r.json();

  if (!data.ok && !data.steps) {
    summaryEl.innerHTML = `<span class="badge-fail">Fehler: ${data.error}</span>`;
    return;
  }

  const found = data.forecast && data.forecast.length > 0;
  summaryEl.innerHTML = found
    ? `<span class="badge-ok">✓ Vorhersage gefunden: ${data.forecast.length} Einträge</span>`
    : `<span class="badge-fail">✗ Keine Vorhersagedaten gefunden – siehe Schritte unten für den genauen Grund.</span>`;

  (data.steps || []).forEach(s => {
    const div = document.createElement('div');
    div.className = 'step';
    div.innerHTML = `
      <div class="step-head">
        <span>${s.step}</span>
        <span class="${s.found ? 'badge-ok' : 'badge-fail'}">${s.found ? `✓ ${s.count} gefunden` : '✗ nichts gefunden'} (HTTP ${s.status})</span>
      </div>
      <pre>${(s.raw || '').replace(/</g, '&lt;')}</pre>
    `;
    stepsEl.appendChild(div);
  });

  if (found) {
    const div = document.createElement('div');
    div.className = 'step';
    div.innerHTML = `<div class="step-head"><span>Verwendete Vorhersage (erste 2 Einträge)</span></div>
      <pre>${JSON.stringify(data.forecast.slice(0, 2), null, 2).replace(/</g, '&lt;')}</pre>`;
    stepsEl.appendChild(div);
  }
});
