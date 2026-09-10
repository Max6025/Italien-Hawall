const {
  defaultCardType, defaultSize, sizeToSpan, clampSpan, resolveSpan, buildCard,
  CARD_TYPES, ICONS, domainsForType, minSpanFor
} = DashboardRender;
const $ = id => document.getElementById(id);

const PICKER_TYPES = Object.keys(CARD_TYPES).filter(t => t !== 'navigate'); // Screensaver: Uhr zusaetzlich erlaubt, Navigation nicht

let currentLayout = []; // [{ entity_id, order, card_type, cols, rows, settings }]
let statesById = {};
let historyCache = {};
let forecastCache = {};
let allEntities = [];
let currentSunEntity = '';
let settingsEntityId = null;
let settingsFields = {};
let settingsThresholds = [];
let pickerType = null;
let isDirty = false; // true sobald ungespeicherte Aenderungen vorliegen -> eigene Verlassen-Warnung
function markDirty() { isDirty = true; }

async function loadAll() {
  const [configRes, entitiesRes] = await Promise.all([
    fetch('/api/config').then(r => r.json()),
    fetch('/api/entities').then(r => r.json())
  ]);
  currentLayout = (configRes.screensaverLayout || []).map(l => ({ ...l }));
  currentSunEntity = configRes.sunEntity || '';
  DashboardRender.applyCustomTheme(configRes.customTheme || DashboardRender.DEFAULT_THEME);
  allEntities = entitiesRes.ok ? entitiesRes.entities : [];
  updateBgPreview(configRes.screensaverBackground, configRes.screensaverBgVersion);
  await refreshStates();
}

// --- Screensaver-Hintergrundbild -------------------------------------------------------
function updateBgPreview(hasBg, version) {
  const editGrid = $('ssEditGrid');
  if (hasBg) {
    $('bgPreview').src = `/api/screensaver/background?v=${version}`;
    $('bgPreview').style.display = 'inline-block';
    $('bgNoneText').style.display = 'none';
    $('bgRemoveBtn').style.display = 'inline-block';
    editGrid.style.backgroundImage = `url(/api/screensaver/background?v=${version})`;
    editGrid.classList.add('has-bg-image');
  } else {
    $('bgPreview').style.display = 'none';
    $('bgNoneText').style.display = 'inline';
    $('bgRemoveBtn').style.display = 'none';
    editGrid.style.backgroundImage = '';
    editGrid.classList.remove('has-bg-image');
  }
}

$('bgUploadBtn').addEventListener('click', () => $('bgFileInput').click());

$('bgFileInput').addEventListener('change', async () => {
  const file = $('bgFileInput').files[0];
  if (!file) return;
  const resultEl = $('bgResult');
  resultEl.textContent = 'Lade hoch...';
  resultEl.style.color = 'var(--muted)';
  try {
    const dataUrl = await resizeImageFile(file, 1920);
    const r = await fetch('/api/screensaver/background', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl })
    });
    const data = await r.json();
    if (data.ok) {
      resultEl.textContent = 'Gespeichert.';
      resultEl.style.color = '#7fd68a';
      updateBgPreview(true, Date.now());
    } else {
      resultEl.textContent = 'Fehler: ' + data.error;
      resultEl.style.color = '#ff8a8a';
    }
  } catch (e) {
    resultEl.textContent = 'Fehler: ' + e.message;
    resultEl.style.color = '#ff8a8a';
  }
  $('bgFileInput').value = '';
});

// Verkleinert ein Bild vor dem Hochladen auf max. maxDim Pixel (laengste Seite) und komprimiert
// als JPEG -- Fotos direkt vom Handy koennen sonst 8-15MB gross sein und das Upload-Limit
// sprengen; als Screensaver-Hintergrund reicht die Aufloesung des Displays voellig.
function resizeImageFile(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$('bgRemoveBtn').addEventListener('click', async () => {
  await fetch('/api/screensaver/background/remove', { method: 'POST' });
  updateBgPreview(false);
  $('bgResult').textContent = 'Entfernt.';
  $('bgResult').style.color = 'var(--muted)';
});

async function refreshStates() {
  const r = await fetch('/api/ha/states');
  const data = await r.json();
  if (data.ok) statesById = Object.fromEntries(data.states.map(s => [s.entity_id, s]));
  applyTheme();
  await render();
}

function applyTheme() {
  if (!currentSunEntity) { document.body.classList.remove('light-theme'); return; }
  const s = statesById[currentSunEntity];
  if (!s) return;
  const isDay = s.state === 'above_horizon' || s.state === 'on';
  document.body.classList.toggle('light-theme', isDay);
}

async function ensureHistory(entityId) {
  if (historyCache[entityId]) return historyCache[entityId];
  try {
    const r = await fetch(`/api/ha/history?entity_id=${encodeURIComponent(entityId)}&hours=24`);
    const data = await r.json();
    historyCache[entityId] = data.ok ? data.series : [];
  } catch (e) {
    historyCache[entityId] = [];
  }
  return historyCache[entityId];
}

let clockTicker = null;
async function ensureForecast(entityId, forecastType) {
  const cacheKey = `${entityId}:${forecastType || 'auto'}`;
  if (forecastCache[cacheKey]) return forecastCache[cacheKey];
  try {
    const typeParam = forecastType ? `&type=${encodeURIComponent(forecastType)}` : '';
    const r = await fetch(`/api/ha/forecast?entity_id=${encodeURIComponent(entityId)}${typeParam}`);
    const data = await r.json();
    if (data.ok && Array.isArray(data.forecast) && data.forecast.length) {
      forecastCache[cacheKey] = { forecast: data.forecast, error: '' };
      return forecastCache[cacheKey];
    }
    return { forecast: [], error: data.error || 'Keine Vorhersagedaten' };
  } catch (e) {
    return { forecast: [], error: String(e.message || e) };
  }
}
let wasteCache = {};
async function ensureWasteEvents(entityId) {
  if (wasteCache[entityId]) return wasteCache[entityId];
  try {
    const r = await fetch(`/api/ha/calendar-events?entity_id=${encodeURIComponent(entityId)}&days=60`);
    const data = await r.json();
    if (data.ok && Array.isArray(data.events) && data.events.length) {
      wasteCache[entityId] = { events: data.events, error: '' };
      return wasteCache[entityId];
    }
    return { events: [], error: data.error || 'Keine Termine gefunden' };
  } catch (e) {
    return { events: [], error: String(e.message || e) };
  }
}
async function render() {
  const grid = $('ssEditGrid');
  grid.innerHTML = '';
  for (const entry of currentLayout) {
    const type = entry.card_type || 'sensor';
    const state = (type === 'clock' || type === 'energy') ? null : statesById[entry.entity_id];
    const span = resolveSpan(entry, type);
    let history, forecast, forecastError, energy, waste, wasteError;
    if (type === 'graph' || type === 'gauge') history = await ensureHistory(entry.entity_id);
    if (type === 'forecast') { const fr = await ensureForecast(entry.entity_id, (entry.settings || {}).forecastType); forecast = fr.forecast; forecastError = fr.error; }
    if (type === 'waste') { const wr = await ensureWasteEvents(entry.entity_id); waste = wr.events; wasteError = wr.error; }
    if (type === 'energy') {
      const es = entry.settings || {};
      energy = {
        grid: statesById[es.gridEntity], gridReturn: statesById[es.gridReturnEntity],
        solar: statesById[es.solarEntity], battery: statesById[es.batteryEntity],
        batterySoc: statesById[es.batterySocEntity]
      };
    }
    const card = buildCard(entry.entity_id, state, type, span, {
      editable: true,
      freeMove: true,
      history,
      forecast,
      forecastError,
      energy,
      waste,
      wasteError,
      settings: entry.settings || {},
      callbacks: {
        onRemove: removeEntity,
        onChangeType: changeType,
        onResizeStart: onResizeStart,
        onOpenSettings: openSettings,
        onMoveStart: onMoveStart,
        onDuplicate: duplicateCard
      }
    });
    grid.appendChild(card);
  }
  const addTile = document.createElement('div');
  addTile.className = 'card add-tile';
  addTile.textContent = '+';
  addTile.addEventListener('click', openPicker);
  grid.appendChild(addTile);

  if (!clockTicker) {
    clockTicker = setInterval(() => {
      document.querySelectorAll('#ssEditGrid .card.type-clock').forEach(DashboardRender.renderClockNow);
    }, 15000);
  }
}

// Freie Positionierung: findet die erste freie Stelle im 4-Spalten-Raster fuer eine
// neue Karte gegebener Groesse (scannt zeilenweise von oben).
function findFreeSpot(cols, rows) {
  const GRID_COLS = 4;
  const occupied = new Set();
  currentLayout.forEach(e => {
    const ex = e.x || 0, ey = e.y || 0, ew = e.cols || 1, eh = e.rows || 1;
    for (let xx = ex; xx < ex + ew; xx++) {
      for (let yy = ey; yy < ey + eh; yy++) occupied.add(xx + ',' + yy);
    }
  });
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x <= GRID_COLS - cols; x++) {
      let free = true;
      for (let xx = x; xx < x + cols && free; xx++) {
        for (let yy = y; yy < y + rows && free; yy++) {
          if (occupied.has(xx + ',' + yy)) free = false;
        }
      }
      if (free) return { x, y };
    }
  }
  return { x: 0, y: 60 };
}

// Karte per Griff frei verschieben -- Position bleibt danach exakt dort liegen
// (keine automatische Neuanordnung wie im normalen Editor).
function onMoveStart(entityId, cardEl, startEvent) {
  const entry = currentLayout.find(l => l.entity_id === entityId);
  if (!entry) return;
  const grid = $('ssEditGrid');
  const gridRect = grid.getBoundingClientRect();
  const cs = getComputedStyle(grid);
  const colGap = parseFloat(cs.columnGap) || 0;
  const rowGap = parseFloat(cs.rowGap) || 0;
  const rowH = parseFloat(cs.gridAutoRows) || 100;
  const colW = (gridRect.width - colGap * 3) / 4;

  const cols = entry.cols || 1;
  const startGX = entry.x || 0;
  const startGY = entry.y || 0;
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;
  cardEl.classList.add('moving');

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const deltaCols = Math.round(dx / (colW + colGap));
    const deltaRows = Math.round(dy / (rowH + rowGap));
    const newX = Math.max(0, Math.min(4 - cols, startGX + deltaCols));
    const newY = Math.max(0, startGY + deltaRows);
    const rows = entry.rows || 1;
    if (collidesAt(entityId, newX, newY, cols, rows)) return; // Position bliebe kollidierend -- Karte "klebt" an der letzten gueltigen Stelle
    entry.x = newX;
    entry.y = newY;
    cardEl.style.gridColumn = `${newX + 1} / span ${cols}`;
    cardEl.style.gridRow = `${newY + 1} / span ${rows}`;
    cardEl.dataset.x = newX;
    cardEl.dataset.y = newY;
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    cardEl.classList.remove('moving');
    markDirty();
    render();
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function removeEntity(id) {
  currentLayout = currentLayout.filter(l => l.entity_id !== id);
  markDirty();
  render();
}

// --- Karte kopieren: gleicher Typ/Groesse/Einstellungen, nur neue Entitaet abfragen ----
let duplicateSourceId = null;
function duplicateCard(id) {
  const entry = currentLayout.find(l => l.entity_id === id);
  if (!entry) return;
  duplicateSourceId = id;
  const type = entry.card_type || 'sensor';
  $('picker').classList.add('show');
  showEntityStep(type);
  $('pickerTitle').textContent = CARD_TYPES[type].label + ' kopieren – neue Entität wählen';
}

function changeType(id, newType) {
  const entry = currentLayout.find(l => l.entity_id === id);
  if (!entry) return;
  entry.card_type = newType;
  const span = clampSpan(sizeToSpan(defaultSize(newType)), newType);
  entry.cols = span.cols;
  entry.rows = span.rows;
  delete entry.size;
  entry.settings = {};
  markDirty();
  render();
}

// --- Freies Groessenziehen (Ecke unten rechts) -----------------------------------------
function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function collidesAt(entityId, x, y, cols, rows) {
  const others = currentLayout.filter(l => l.entity_id !== entityId);
  return others.some(o => rectsOverlap(x, y, cols, rows, o.x || 0, o.y || 0, o.cols || 1, o.rows || 1));
}

// Verhindert, dass eine Karte beim Groesserziehen eine andere ueberdeckt: schrumpft
// die gewuenschte Groesse (erst Breite, dann Hoehe) solange, bis sie kollisionsfrei ist.
function clampAgainstOthers(entityId, x, y, cols, rows, type) {
  const min = minSpanFor(type);
  let c = cols, r = rows;
  while (c > min.cols && collidesAt(entityId, x, y, c, r)) c--;
  while (r > min.rows && collidesAt(entityId, x, y, c, r)) r--;
  return { cols: c, rows: r };
}

function onResizeStart(entityId, cardEl, startEvent) {
  const entry = currentLayout.find(l => l.entity_id === entityId);
  if (!entry) return;
  const type = entry.card_type || 'sensor';
  const grid = $('ssEditGrid');
  const gridRect = grid.getBoundingClientRect();
  const cs = getComputedStyle(grid);
  const colGap = parseFloat(cs.columnGap) || 0;
  const rowGap = parseFloat(cs.rowGap) || 0;
  const rowH = parseFloat(cs.gridAutoRows) || 100;
  const colW = (gridRect.width - colGap * 3) / 4;

  const startCols = parseInt(cardEl.dataset.cols, 10) || 1;
  const startRows = parseInt(cardEl.dataset.rows, 10) || 1;
  const fixedX = entry.x || 0;
  const fixedY = entry.y || 0;
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;
  const wasDraggable = cardEl.draggable;
  cardEl.draggable = false;
  cardEl.classList.add('resizing');

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const deltaCols = Math.round(dx / (colW + colGap));
    const deltaRows = Math.round(dy / (rowH + rowGap));
    let span = clampSpan({ cols: startCols + deltaCols, rows: startRows + deltaRows }, type);
    const clampedX = Math.min(fixedX, 4 - span.cols);
    span = clampAgainstOthers(entityId, clampedX, fixedY, span.cols, span.rows, type);
    cardEl.style.gridColumn = `${clampedX + 1} / span ${span.cols}`;
    cardEl.style.gridRow = `${fixedY + 1} / span ${span.rows}`;
    cardEl.dataset.cols = span.cols;
    cardEl.dataset.rows = span.rows;
    entry.cols = span.cols;
    entry.rows = span.rows;
    entry.x = clampedX;
    delete entry.size;
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    cardEl.draggable = wasDraggable;
    cardEl.classList.remove('resizing');
    markDirty();
    render();
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// --- Karten-Einstellungen ---------------------------------------------------------------
function settingsFieldsForType(type) {
  const withSuffix = ['gauge', 'graph', 'wind', 'rain', 'temperature', 'sensor', 'pressure'];
  return { name: true, suffix: withSuffix.includes(type), gaugeExtras: type === 'gauge', forecastType: type === 'forecast', energyEntities: type === 'energy', mediaPlayerOpts: type === 'media_player' };
}

function renderThresholdList() {
  const list = $('thresholdList');
  if (!list) return;
  list.innerHTML = '';
  settingsThresholds.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'threshold-row';
    row.innerHTML = `
      <span style="font-size:1.2vh; color:var(--muted);">ab</span>
      <input type="number" step="any" value="${t.value ?? ''}" class="thr-value">
      <input type="color" value="${t.color || '#4f7cff'}" class="thr-color">
      <button type="button" class="remove-threshold">×</button>
    `;
    row.querySelector('.thr-value').addEventListener('input', e => { t.value = e.target.value; });
    row.querySelector('.thr-color').addEventListener('input', e => { t.color = e.target.value; });
    row.querySelector('.remove-threshold').addEventListener('click', () => {
      settingsThresholds.splice(i, 1);
      renderThresholdList();
    });
    list.appendChild(row);
  });
}

function openSettings(entityId) {
  const entry = currentLayout.find(l => l.entity_id === entityId);
  if (!entry) return;
  const type = entry.card_type || 'sensor';
  const state = type === 'clock' ? null : statesById[entityId];
  const attrs = (state && state.attributes) || {};
  const settings = entry.settings || {};
  const fields = settingsFieldsForType(type);
  settingsEntityId = entityId;
  settingsFields = fields;
  settingsThresholds = (settings.thresholds || []).map(t => ({ ...t }));

  $('settingsTitle').textContent = 'Einstellungen: ' + (settings.name || attrs.friendly_name || (type === 'clock' ? 'Uhr' : type === 'energy' ? 'Energiefluss' : entityId));

  let html = `<label>Anzeigename (leer = Standard${attrs.friendly_name ? ': ' + attrs.friendly_name : ''})</label>
    <input type="text" id="setName" value="${settings.name || ''}" placeholder="${attrs.friendly_name || (type === 'clock' ? 'Uhr' : type === 'energy' ? 'Energiefluss' : entityId)}">`;
  if (fields.suffix) {
    html += `<label>Einheit / Suffix (leer = automatisch${attrs.unit_of_measurement ? ': ' + attrs.unit_of_measurement : ''})</label>
      <input type="text" id="setSuffix" value="${settings.suffix || ''}" placeholder="${attrs.unit_of_measurement || ''}">`;
  }
  if (fields.gaugeExtras) {
    html += `
      <div class="row2">
        <div><label>Min (leer = automatisch)</label><input type="number" step="any" id="setMin" value="${settings.min ?? ''}"></div>
        <div><label>Max (leer = automatisch)</label><input type="number" step="any" id="setMax" value="${settings.max ?? ''}"></div>
      </div>
      <label>Farbschwellen (z.B. ab 10 grün, ab 28 gelb)</label>
      <div id="thresholdList"></div>
      <button type="button" class="add-threshold" id="addThresholdBtn">+ Schwelle hinzufügen</button>
    `;
  }
  if (fields.forecastType) {
    html += `<label>Vorhersage-Art</label>
      <select id="setForecastType">
        <option value="daily" ${settings.forecastType !== 'hourly' ? 'selected' : ''}>Täglich</option>
        <option value="hourly" ${settings.forecastType === 'hourly' ? 'selected' : ''}>Stündlich</option>
      </select>`;
  }
  if (fields.energyEntities) {
    html += `
      <button type="button" id="autoLoadEnergyBtn" style="margin-bottom:1rem;">Automatisch aus HA-Energie-Konfiguration laden</button>
      <div id="autoLoadResult" class="result"></div>
      <label>Netzbezug (Leistung, W/kW)</label>
      <input type="text" id="setGrid" list="entityList" value="${settings.gridEntity || ''}" placeholder="sensor.netzbezug_leistung">
      <label>Netzeinspeisung (optional)</label>
      <input type="text" id="setGridReturn" list="entityList" value="${settings.gridReturnEntity || ''}" placeholder="sensor.einspeisung_leistung">
      <label>Solar-Erzeugung (optional)</label>
      <input type="text" id="setSolar" list="entityList" value="${settings.solarEntity || ''}" placeholder="sensor.pv_leistung">
      <label>Batterie-Leistung (optional, negativ = lädt)</label>
      <input type="text" id="setBattery" list="entityList" value="${settings.batteryEntity || ''}" placeholder="sensor.batterie_leistung">
      <label>Batterie-Ladezustand % (optional)</label>
      <input type="text" id="setBatterySoc" list="entityList" value="${settings.batterySocEntity || ''}" placeholder="sensor.batterie_soc">
      <datalist id="entityList">
        ${allEntities.map(e => `<option value="${e.entity_id}">${e.name}</option>`).join('')}
      </datalist>
    `;
  }
  if (fields.mediaPlayerOpts) {
    html += `<label><input type="checkbox" id="setMediaArtBg" style="width:auto; margin-right:0.5rem;" ${settings.mediaArtBg !== false ? 'checked' : ''}>Album-Cover als Kartenhintergrund (weichgezeichnet)</label>
      <label><input type="checkbox" id="setMediaShowSource" style="width:auto; margin-right:0.5rem;" ${settings.mediaShowSource !== false ? 'checked' : ''}>Quellenauswahl anzeigen (falls vom Gerät unterstützt)</label>
      <label><input type="checkbox" id="setMediaShowProgress" style="width:auto; margin-right:0.5rem;" ${settings.mediaShowProgress !== false ? 'checked' : ''}>Fortschrittsbalken anzeigen (falls vom Gerät unterstützt)</label>`;
  }
  $('settingsBody').innerHTML = html;

  if (fields.gaugeExtras) {
    renderThresholdList();
    $('addThresholdBtn').addEventListener('click', () => {
      settingsThresholds.push({ value: '', color: '#4f7cff' });
      renderThresholdList();
    });
  }

  if (fields.energyEntities) {
    $('autoLoadEnergyBtn').addEventListener('click', async () => {
      const resultEl = $('autoLoadResult');
      resultEl.textContent = 'Lade HA-Energie-Konfiguration (kann kurz dauern)...';
      resultEl.className = 'result';
      try {
        const r = await fetch('/api/ha/energy-prefs');
        const data = await r.json();
        if (!data.ok) {
          resultEl.textContent = 'Fehler: ' + data.error;
          resultEl.className = 'result err';
          return;
        }
        if (data.gridConsumption) $('setGrid').value = data.gridConsumption;
        if (data.gridReturn) $('setGridReturn').value = data.gridReturn;
        if (data.solar) $('setSolar').value = data.solar;
        if (data.batteryOut) $('setBattery').value = data.batteryOut;
        resultEl.textContent = 'Übernommen. Bitte prüfen, ob die Entitäten passen (ggf. Leistungssensor statt Statistik-ID nachtragen) und speichern.';
        resultEl.className = 'result ok';
      } catch (e) {
        resultEl.textContent = 'Fehler: ' + e.message;
        resultEl.className = 'result err';
      }
    });
  }

  $('settingsModal').classList.add('show');
}

$('settingsCancel').addEventListener('click', () => $('settingsModal').classList.remove('show'));

$('settingsSave').addEventListener('click', () => {
  const entry = currentLayout.find(l => l.entity_id === settingsEntityId);
  if (!entry) return;
  const settings = { ...(entry.settings || {}) };
  const nameV = ($('setName') && $('setName').value.trim()) || '';
  if (nameV) settings.name = nameV; else delete settings.name;
  if (settingsFields.suffix) {
    const v = ($('setSuffix') && $('setSuffix').value.trim()) || '';
    if (v) settings.suffix = v; else delete settings.suffix;
  }
  if (settingsFields.gaugeExtras) {
    const minV = $('setMin') ? $('setMin').value : '';
    const maxV = $('setMax') ? $('setMax').value : '';
    if (minV !== '') settings.min = minV; else delete settings.min;
    if (maxV !== '') settings.max = maxV; else delete settings.max;
    const cleaned = settingsThresholds.filter(t => t.value !== '' && t.value !== null && t.value !== undefined && !isNaN(t.value));
    if (cleaned.length) settings.thresholds = cleaned; else delete settings.thresholds;
  }
  if (settingsFields.forecastType) {
    settings.forecastType = $('setForecastType') ? $('setForecastType').value : 'daily';
  }
  if (settingsFields.energyEntities) {
    const grab = id => (($(id) && $(id).value.trim()) || '');
    const grid = grab('setGrid'), gridRet = grab('setGridReturn'), solar = grab('setSolar'),
      batt = grab('setBattery'), battSoc = grab('setBatterySoc');
    if (grid) settings.gridEntity = grid; else delete settings.gridEntity;
    if (gridRet) settings.gridReturnEntity = gridRet; else delete settings.gridReturnEntity;
    if (solar) settings.solarEntity = solar; else delete settings.solarEntity;
    if (batt) settings.batteryEntity = batt; else delete settings.batteryEntity;
    if (battSoc) settings.batterySocEntity = battSoc; else delete settings.batterySocEntity;
  }
  if (settingsFields.mediaPlayerOpts) {
    settings.mediaArtBg = $('setMediaArtBg') ? $('setMediaArtBg').checked : true;
    settings.mediaShowSource = $('setMediaShowSource') ? $('setMediaShowSource').checked : true;
    settings.mediaShowProgress = $('setMediaShowProgress') ? $('setMediaShowProgress').checked : true;
  }
  entry.settings = settings;
  markDirty();
  $('settingsModal').classList.remove('show');
  render();
});

// --- Picker: erst Kartentyp (inkl. Uhr), dann passende Entitaet ------------------------
function openPicker() {
  duplicateSourceId = null;
  $('picker').classList.add('show');
  showTypeStep();
}

function showTypeStep() {
  pickerType = null;
  $('pickerTitle').textContent = 'Kartentyp wählen';
  $('entityStep').style.display = 'none';
  const grid = $('typeGrid');
  grid.style.display = 'grid';
  grid.innerHTML = '';
  PICKER_TYPES.forEach(t => {
    const tile = document.createElement('div');
    tile.className = 'type-tile';
    tile.innerHTML = `${ICONS[t] || ICONS.generic}<span>${CARD_TYPES[t].label}</span>`;
    tile.addEventListener('click', () => {
      if (t === 'clock') {
        addClockCard();
      } else if (t === 'energy') {
        addEnergyCard();
      } else {
        showEntityStep(t);
      }
    });
    grid.appendChild(tile);
  });
}

function addClockCard() {
  const span = clampSpan(sizeToSpan(defaultSize('clock')), 'clock');
  const pos = findFreeSpot(span.cols, span.rows);
  currentLayout.push({
    entity_id: 'clock:' + Date.now(), order: currentLayout.length, card_type: 'clock',
    cols: span.cols, rows: span.rows, x: pos.x, y: pos.y, settings: {}
  });
  markDirty();
  $('picker').classList.remove('show');
  render();
}

function addEnergyCard() {
  const span = clampSpan(sizeToSpan(defaultSize('energy')), 'energy');
  const pos = findFreeSpot(span.cols, span.rows);
  const id = 'energy:' + Date.now();
  currentLayout.push({
    entity_id: id, order: currentLayout.length, card_type: 'energy',
    cols: span.cols, rows: span.rows, x: pos.x, y: pos.y, settings: {}
  });
  markDirty();
  $('picker').classList.remove('show');
  render();
  openSettings(id);
}

function showEntityStep(type) {
  pickerType = type;
  $('pickerTitle').textContent = CARD_TYPES[type].label + ' – Entität wählen';
  $('typeGrid').style.display = 'none';
  $('entityStep').style.display = 'block';
  $('pickerFilter').value = '';
  renderPickerList('');
  $('pickerFilter').focus();
}

$('pickerBack').addEventListener('click', () => { duplicateSourceId = null; showTypeStep(); });

function renderPickerList(query) {
  const q = query.toLowerCase();
  const existingIds = currentLayout.map(l => l.entity_id);
  const doms = domainsForType(pickerType);
  const list = allEntities
    .filter(e => !existingIds.includes(e.entity_id))
    .filter(e => doms === null || doms.includes(e.domain))
    .filter(e => e.name.toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q));
  const el = $('pickerList');
  el.innerHTML = '';
  if (!list.length) {
    el.innerHTML = '<p style="font-size:1.3vh; color:var(--muted);">Keine passenden Entitäten gefunden.</p>';
    return;
  }
  list.forEach(e => {
    const row = document.createElement('div');
    row.className = 'picker-item';
    row.innerHTML = `<span>${e.name}</span><span class="domain">${e.domain}</span>`;
    row.addEventListener('click', () => {
      const span = clampSpan(sizeToSpan(defaultSize(pickerType)), pickerType);
      const pos = findFreeSpot(span.cols, span.rows);
      let settings = {};
      if (duplicateSourceId) {
        const src = currentLayout.find(l => l.entity_id === duplicateSourceId);
        if (src) settings = JSON.parse(JSON.stringify(src.settings || {}));
      }
      currentLayout.push({
        entity_id: e.entity_id, order: currentLayout.length, card_type: pickerType,
        cols: span.cols, rows: span.rows, x: pos.x, y: pos.y, settings
      });
      duplicateSourceId = null;
      markDirty();
      $('picker').classList.remove('show');
      render();
    });
    el.appendChild(row);
  });
}

$('pickerFilter').addEventListener('input', e => renderPickerList(e.target.value));
$('pickerClose').addEventListener('click', () => { duplicateSourceId = null; $('picker').classList.remove('show'); });

$('saveBtn').addEventListener('click', async () => {
  const resultEl = $('saveResult');
  resultEl.textContent = 'Speichere...';
  resultEl.className = 'save-result';
  const layout = currentLayout.map((l, i) => ({ ...l, order: i }));
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screensaverLayout: layout
    })
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Gespeichert.';
    resultEl.className = 'save-result ok';
    isDirty = false;
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'save-result err';
  }
});

loadAll();
setInterval(refreshStates, 15000);

// --- Hilfe-Popup statt Fließtext, eigene Verlassen-Warnung statt Browser-Standarddialog ---
$('helpBtn').addEventListener('click', () => $('helpModal').classList.add('show'));
$('helpModalClose').addEventListener('click', () => $('helpModal').classList.remove('show'));

let pendingNavHref = null;
document.querySelectorAll('.hawall-nav-links a').forEach(a => {
  a.addEventListener('click', (e) => {
    if (isDirty) {
      e.preventDefault();
      pendingNavHref = a.getAttribute('href');
      $('leaveWarnModal').classList.add('show');
    }
  });
});
$('leaveWarnCancel').addEventListener('click', () => {
  $('leaveWarnModal').classList.remove('show');
  pendingNavHref = null;
});
$('leaveWarnConfirm').addEventListener('click', () => {
  $('leaveWarnModal').classList.remove('show');
  if (pendingNavHref) location.href = pendingNavHref;
});
