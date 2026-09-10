const {
  defaultCardType, defaultSize, sizeToSpan, clampSpan, resolveSpan, buildCard,
  CARD_TYPES, ICONS, domainsForType, minSpanFor
} = DashboardRender;
const $ = id => document.getElementById(id);

const params = new URLSearchParams(location.search);
const DASHBOARD_ID = params.get('dashboard') || 'main'; // 'main' = normales Dashboard, sonst Unterdashboard-ID

// Die Uhr war frueher nur im Screensaver waehlbar. Seit die Kopfzeile entfaellt, ist sie der
// einzige Weg, Uhrzeit und Datum aufs Dashboard zu bekommen -- und zwar dort, wo der Nutzer
// sie haben will, statt fest oben in einer Leiste.
const PICKER_TYPES = Object.keys(CARD_TYPES);

// Feste, bildschirmgrosse Arbeitsflaeche: 4 Spalten x MAX_ROWS Zeilen a 14vh -- entspricht
// in etwa dem, was auf dem echten Wall Display ohne Scrollen sichtbar ist. Karten koennen
// nicht mehr darueber hinaus platziert werden -- nichts kann mehr "nach unten verschwinden".
const MAX_ROWS = 6;

let currentLayout = []; // [{ entity_id, order, card_type, cols, rows, x, y, settings }]
let statesById = {};
let historyCache = {};
let forecastCache = {};
let allEntities = [];
let allDashboards = []; // [{id,name}] fuer Navigations-Karten
let currentSunEntity = '';
let settingsEntityId = null;
let settingsFields = {};
let settingsThresholds = [];
let pickerType = null;
let duplicateSourceId = null; // gesetzt waehrend "Karte kopieren"-Ablauf
let isDirty = false; // true sobald ungespeicherte Aenderungen vorliegen -> eigene Verlassen-Warnung
function markDirty() { isDirty = true; }

async function loadAll() {
  const [configRes, entitiesRes, dashboardsRes] = await Promise.all([
    fetch('/api/config').then(r => r.json()),
    fetch('/api/entities').then(r => r.json()),
    fetch('/api/dashboards').then(r => r.json()).catch(() => ({ ok: false }))
  ]);
  allDashboards = dashboardsRes.ok ? dashboardsRes.dashboards : [];
  currentSunEntity = configRes.sunEntity || '';
  DashboardRender.applyCustomTheme(configRes.customTheme || DashboardRender.DEFAULT_THEME);
  allEntities = entitiesRes.ok ? entitiesRes.entities : [];

  if (DASHBOARD_ID === 'main') {
    $('title').textContent = 'Wall Display – Karten einrichten (' + (configRes.title || 'Wall Display') + ')';
    currentLayout = (configRes.layout || []).length
      ? configRes.layout.map(l => ({ ...l }))
      : (configRes.entities || []).map((id, i) => ({ entity_id: id, order: i }));
  } else {
    const dRes = await fetch(`/api/dashboards/${DASHBOARD_ID}`).then(r => r.json());
    const dash = dRes.ok ? dRes.dashboard : { name: 'Dashboard', layout: [] };
    $('title').textContent = 'Unterdashboard einrichten (' + (dash.name || 'Dashboard') + ')';
    currentLayout = (dash.layout || []).map(l => ({ ...l }));
  }
  assignMissingPositions();
  await refreshStates();
}

// Weist jeder Karte ohne feste Position (z.B. aus einer alten Konfiguration vor diesem
// Umbau) automatisch die erste freie Stelle zu, damit von Anfang an alles innerhalb der
// festen Arbeitsflaeche liegt.
function assignMissingPositions() {
  currentLayout.forEach(entry => {
    if (!Number.isInteger(entry.x) || !Number.isInteger(entry.y)) {
      const type = entry.card_type || defaultCardType(entry.entity_id, statesById[entry.entity_id]);
      const span = clampSpan(entry.cols && entry.rows ? { cols: entry.cols, rows: entry.rows } : sizeToSpan(defaultSize(type)), type);
      const pos = findFreeSpot(span.cols, span.rows, type);
      entry.cols = span.cols;
      entry.rows = span.rows;
      entry.x = pos.x;
      entry.y = pos.y;
    }
  });
}

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

async function ensureHistory(entityId, stunden) {
  if (historyCache[entityId]) return historyCache[entityId];
  try {
    const r = await fetch(`/api/ha/history?entity_id=${encodeURIComponent(entityId)}&hours=${Number(stunden) > 0 ? Number(stunden) : 24}`);
    const data = await r.json();
    historyCache[entityId] = data.ok ? data.series : [];
  } catch (e) {
    historyCache[entityId] = [];
  }
  return historyCache[entityId];
}

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

// Prueft, ob eine Karte geometrisch eine Foto-Bereich-Karte ueberlappt (fuer den
// automatischen Glas-Effekt) -- nur relevant fuer Kartentypen, die das ueberhaupt duerfen.
function findOverlappingPhoto(entry) {
  if (!DashboardRender.canOverlayOnPhoto(entry.card_type)) return null;
  return currentLayout.find(o =>
    o.card_type === 'photo' && o.entity_id !== entry.entity_id &&
    rectsOverlap(entry.x || 0, entry.y || 0, entry.cols || 1, entry.rows || 1, o.x || 0, o.y || 0, o.cols || 1, o.rows || 1)
  ) || null;
}

async function render() {
  const grid = $('grid');
  grid.innerHTML = '';
  for (const entry of currentLayout) {
    const state = statesById[entry.entity_id];
    const type = entry.card_type || defaultCardType(entry.entity_id, state);
    const span = resolveSpan(entry, type);
    let history, forecast, forecastError, energy, waste, wasteError;
    if (type === 'graph' || type === 'gauge') history = await ensureHistory(entry.entity_id, (entry.settings || {}).graphHours);
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
      apiBase: '',
      photoVersion: type === 'photo' ? (entry.settings || {}).photoVersion : null,
      onPhoto: !!findOverlappingPhoto(entry),
      settings: entry.settings || {},
      callbacks: {
        onRemove: removeEntity,
        onChangeType: changeType,
        onResizeStart: onResizeStart,
        onOpenSettings: openSettings,
        onDuplicate: duplicateCard,
        onMoveStart: onMoveStart
      }
    });
    grid.appendChild(card);
  }
  const addTile = document.createElement('div');
  addTile.className = 'card add-tile';
  addTile.textContent = '+';
  addTile.addEventListener('click', openPicker);
  grid.appendChild(addTile);
}

// --- Feste Arbeitsflaeche: Kollisionspruefung + freie Platzsuche, begrenzt auf 4xMAX_ROWS ---
function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

function collidesAt(entityId, x, y, cols, rows, type) {
  const others = currentLayout.filter(l => l.entity_id !== entityId);
  return others.some(o => {
    if (!rectsOverlap(x, y, cols, rows, o.x || 0, o.y || 0, o.cols || 1, o.rows || 1)) return false;
    // Erlaubte Ueberlappung: eine Foto-Bereich-Karte mit einer dafuer zugelassenen Karte
    // (z.B. Media Player, Wetter) -- in beide Richtungen geprueft, je nachdem wer "die
    // Foto-Karte" von beiden ist.
    if (o.card_type === 'photo' && DashboardRender.canOverlayOnPhoto(type)) return false;
    if (type === 'photo' && DashboardRender.canOverlayOnPhoto(o.card_type)) return false;
    return true;
  });
}

function findFreeSpot(cols, rows, type) {
  for (let y = 0; y <= MAX_ROWS - rows; y++) {
    for (let x = 0; x <= 4 - cols; x++) {
      if (!collidesAt(null, x, y, cols, rows, type)) return { x, y };
    }
  }
  return { x: 0, y: Math.max(0, MAX_ROWS - rows) }; // kein Platz mehr frei -- letzte Zeile als Notloesung
}

function clampAgainstOthers(entityId, x, y, cols, rows, type) {
  const min = minSpanFor(type);
  let c = cols, r = rows;
  while (c > min.cols && (x + c > 4 || collidesAt(entityId, x, y, c, r, type))) c--;
  while (r > min.rows && (y + r > MAX_ROWS || collidesAt(entityId, x, y, c, r, type))) r--;
  return { cols: c, rows: r };
}

function removeEntity(id) {
  currentLayout = currentLayout.filter(l => l.entity_id !== id);
  markDirty();
  render();
}

function changeType(id, newType) {
  const entry = currentLayout.find(l => l.entity_id === id);
  if (!entry) return;
  entry.card_type = newType;
  const span = clampAgainstOthers(id, entry.x || 0, entry.y || 0, sizeToSpan(defaultSize(newType)).cols, sizeToSpan(defaultSize(newType)).rows, newType);
  entry.cols = span.cols;
  entry.rows = span.rows;
  delete entry.size;
  entry.settings = {};
  markDirty();
  render();
}

// --- Karte kopieren: gleicher Typ/Groesse/Einstellungen, nur neue Entitaet abfragen ----
function duplicateCard(id) {
  const entry = currentLayout.find(l => l.entity_id === id);
  if (!entry) return;
  duplicateSourceId = id;
  const type = entry.card_type || defaultCardType(id, statesById[id]);
  $('picker').classList.add('show');
  showEntityStep(type);
  $('pickerTitle').textContent = CARD_TYPES[type].label + ' kopieren – neue Entität wählen';
}

// --- Karte frei verschieben (Griff) -- bleibt danach exakt an der Stelle liegen ---------
function onMoveStart(entityId, cardEl, startEvent) {
  const entry = currentLayout.find(l => l.entity_id === entityId);
  if (!entry) return;
  const grid = $('grid');
  const gridRect = grid.getBoundingClientRect();
  const cs = getComputedStyle(grid);
  const colGap = parseFloat(cs.columnGap) || 0;
  const rowGap = parseFloat(cs.rowGap) || 0;
  const rowH = parseFloat(cs.gridAutoRows) || 100;
  const colW = (gridRect.width - colGap * 3) / 4;

  const cols = entry.cols || 1;
  const rows = entry.rows || 1;
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
    const newY = Math.max(0, Math.min(MAX_ROWS - rows, startGY + deltaRows));
    if (collidesAt(entityId, newX, newY, cols, rows, entry.card_type)) return; // bliebe kollidierend -- Karte "klebt"
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

// --- Freies Groessenziehen (Ecke unten rechts) -- begrenzt auf Bildschirm + Kollision ---
function onResizeStart(entityId, cardEl, startEvent) {
  const entry = currentLayout.find(l => l.entity_id === entityId);
  if (!entry) return;
  const type = entry.card_type || defaultCardType(entityId, statesById[entityId]);
  const grid = $('grid');
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
  cardEl.classList.add('resizing');

  function onMove(ev) {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const deltaCols = Math.round(dx / (colW + colGap));
    const deltaRows = Math.round(dy / (rowH + rowGap));
    let span = clampSpan({ cols: startCols + deltaCols, rows: startRows + deltaRows }, type);
    span = clampAgainstOthers(entityId, fixedX, fixedY, span.cols, span.rows, type);
    cardEl.style.gridColumn = `${fixedX + 1} / span ${span.cols}`;
    cardEl.style.gridRow = `${fixedY + 1} / span ${span.rows}`;
    cardEl.dataset.cols = span.cols;
    cardEl.dataset.rows = span.rows;
    entry.cols = span.cols;
    entry.rows = span.rows;
    delete entry.size;
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    cardEl.classList.remove('resizing');
    markDirty();
    render();
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// --- Karten-Einstellungen ----------------------------------------------------------------
function settingsFieldsForType(type) {
  // humidity und climate fehlten hier, obwohl beide settings.suffix lesen -- das Feld war im
  // Editor schlicht nicht erreichbar.
  const withSuffix = ['gauge', 'graph', 'wind', 'rain', 'temperature', 'sensor', 'pressure', 'humidity', 'climate'];
  return {
    name: type !== 'navigate',
    suffix: withSuffix.includes(type),
    gaugeExtras: type === 'gauge',
    navigateTarget: type === 'navigate',
    forecastType: type === 'forecast',
    energyEntities: type === 'energy',
    mediaPlayerOpts: type === 'media_player',
    photoUpload: type === 'photo',
    quickTiles: type === 'quicktiles',
    gateOpts: type === 'gate',
    climateOpts: type === 'climate',
    graphOpts: type === 'graph',
    coverOpts: type === 'cover'
  };
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
  const state = statesById[entityId];
  const attrs = (state && state.attributes) || {};
  const type = entry.card_type || defaultCardType(entityId, state);
  const settings = entry.settings || {};
  const fields = settingsFieldsForType(type);
  settingsEntityId = entityId;
  settingsFields = fields;
  settingsThresholds = (settings.thresholds || []).map(t => ({ ...t }));

  $('settingsTitle').textContent = 'Einstellungen: ' + (settings.name || attrs.friendly_name || entityId);

  let html = '';
  if (fields.name) {
    html += `<label>Anzeigename (leer = Name aus Home Assistant${attrs.friendly_name ? ': ' + attrs.friendly_name : ''})</label>
      <input type="text" id="setName" value="${settings.name || ''}" placeholder="${attrs.friendly_name || entityId}">`;
  }
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
  if (fields.navigateTarget) {
    html += `<label>Ziel-Dashboard</label>
      <select id="setTarget">
        <option value="main" ${settings.targetDashboardId === 'main' || !settings.targetDashboardId ? 'selected' : ''}>Hauptdashboard</option>
        ${allDashboards.map(d => `<option value="${d.id}" ${settings.targetDashboardId === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
      </select>
      <label>Angezeigter Name (leer = Dashboard-Name)</label>
      <input type="text" id="setName" value="${settings.name || ''}" placeholder="${settings.targetDashboardName || 'Dashboard'}">`;
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
  if (fields.photoUpload) {
    html += `
      <label>Bild</label>
      <div class="bg-upload-bar" id="photoUploadBar" style="display:flex; align-items:center; gap:0.8vh;">
        <img id="photoPreview" class="bg-preview" style="display:none; height:5vh; border-radius:6px;">
        <span id="photoNoneText" style="font-size:1.2vh; color:var(--muted);">Kein Bild gesetzt</span>
        <input type="file" id="photoFileInput" accept="image/png,image/jpeg,image/webp" style="display:none;">
        <button type="button" id="photoUploadBtn">Bild wählen</button>
        <button type="button" id="photoRemoveBtn" style="display:none; background:#6c757d;">Entfernen</button>
        <span id="photoResult" style="font-size:1.2vh;"></span>
      </div>
      <p style="font-size:1.1vh; color:var(--muted);">Auf diesem Foto dürfen Media-Player- und Wetter-Karten überlappend platziert werden (bekommen dabei automatisch einen Glas-Effekt).</p>
    `;
  }
  if (fields.quickTiles) {
    html += `
      <label>Kacheln</label>
      <div id="qtTileList"></div>
      <button type="button" id="qtAddTileBtn" style="margin-top:0.6rem;">+ Kachel hinzufügen</button>
      <datalist id="mpEntityList">
        ${allEntities.filter(e => e.domain === 'media_player').map(e => `<option value="${e.entity_id}">${e.name}</option>`).join('')}
      </datalist>
    `;
  }
  if (fields.graphOpts) {
    const stunden = settings.graphHours || 24;
    const wahl = [[1,'1 Stunde'],[6,'6 Stunden'],[12,'12 Stunden'],[24,'24 Stunden'],[48,'2 Tage'],[168,'7 Tage']];
    html += `
      <label>Zeitraum</label>
      <select id="graphHours">
        ${wahl.map(([v, txt]) => `<option value="${v}" ${Number(stunden) === v ? 'selected' : ''}>${txt}</option>`).join('')}
      </select>
      <p style="font-size:1.1vh; color:var(--muted); margin:0.4vh 0 1vh;">
        War bisher fest auf 24 Stunden verdrahtet.</p>
      <label>Y-Achse</label>
      <div class="row2">
        <div><label style="font-size:1.1vh;">Untergrenze</label>
          <input type="number" id="graphMin" placeholder="automatisch" value="${settings.graphMin ?? ''}"></div>
        <div><label style="font-size:1.1vh;">Obergrenze</label>
          <input type="number" id="graphMax" placeholder="automatisch" value="${settings.graphMax ?? ''}"></div>
      </div>
      <p style="font-size:1.1vh; color:var(--muted); margin:0.4vh 0 1vh;">
        Leer lassen für automatische Skalierung.</p>
    `;
  }

  if (fields.coverOpts) {
    html += `
      <label style="display:flex; align-items:center; gap:0.6vh; margin-top:0.8rem;">
        <input type="checkbox" id="coverPosition" style="width:auto; margin:0;" ${settings.coverPosition === false ? '' : 'checked'}>
        Positionsregler anzeigen
      </label>
      <label style="display:flex; align-items:center; gap:0.6vh; margin-top:0.4rem;">
        <input type="checkbox" id="coverTilt" style="width:auto; margin:0;" ${settings.coverTilt ? 'checked' : ''}>
        Neigungsregler anzeigen
      </label>
      <p style="font-size:1.1vh; color:var(--muted); margin:0.4vh 0 1vh;">
        Beide erscheinen nur, wenn das Gerät sie laut Home Assistant auch beherrscht.</p>
    `;
  }

  if (fields.climateOpts) {
    html += `
      <label style="display:flex; align-items:center; gap:0.6vh; margin-top:0.8rem;">
        <input type="checkbox" id="climateModes" style="width:auto; margin:0;" ${settings.climateModes === false ? '' : 'checked'}>
        Betriebsarten anzeigen (Heizen, Kühlen, Aus …)
      </label>
      <label style="display:flex; align-items:center; gap:0.6vh; margin-top:0.4rem;">
        <input type="checkbox" id="climatePresets" style="width:auto; margin:0;" ${settings.climatePresets ? 'checked' : ''}>
        Voreinstellungen anzeigen (Eco, Komfort …)
      </label>
      <p style="font-size:1.1vh; color:var(--muted); margin:0.4vh 0 1vh;">
        Schrittweite, Grenzwerte und Betriebsarten kommen vom Gerät selbst – die Karte zeigt nur,
        was es wirklich kann.</p>
    `;
  }

  if (fields.gateOpts) {
    html += `
      <label>Meldetext</label>
      <input type="text" id="gateMessage" placeholder="Tor dauerhaft offen" value="${(settings.gateMessage || '').replace(/"/g, '&quot;')}">
      <p style="font-size:1.1vh; color:var(--muted); margin:0.4vh 0 1vh;">
        Erscheint oben auf der Karte, solange die gewählte Karten-Entität an ist.</p>
      <label>Knöpfe</label>
      <div id="gateBtnList"></div>
      <button type="button" id="gateAddBtn" style="margin-top:0.6rem;">+ Knopf hinzufügen</button>
      <datalist id="gateEntityList">
        ${allEntities.map(e => `<option value="${e.entity_id}">${e.name}</option>`).join('')}
      </datalist>
    `;
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

  if (fields.photoUpload) {
    const cardId = entityId;
    if (settings.photoVersion) {
      $('photoPreview').src = `/api/photo-card/${encodeURIComponent(cardId)}/background?v=${settings.photoVersion}`;
      $('photoPreview').style.display = 'inline-block';
      $('photoNoneText').style.display = 'none';
      $('photoRemoveBtn').style.display = 'inline-block';
    }
    $('photoUploadBtn').addEventListener('click', () => $('photoFileInput').click());
    $('photoFileInput').addEventListener('change', async () => {
      const file = $('photoFileInput').files[0];
      if (!file) return;
      const resultEl = $('photoResult');
      resultEl.textContent = 'Lade hoch...';
      resultEl.style.color = 'var(--muted)';
      try {
        const dataUrl = await resizeImageFile(file, 1920);
        const r = await fetch(`/api/photo-card/${encodeURIComponent(cardId)}/background`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl })
        });
        const data = await r.json();
        if (data.ok) {
          settings.photoVersion = Date.now();
          markDirty();
          resultEl.textContent = 'Gespeichert.';
          resultEl.style.color = '#7fd68a';
          $('photoPreview').src = `/api/photo-card/${encodeURIComponent(cardId)}/background?v=${settings.photoVersion}`;
          $('photoPreview').style.display = 'inline-block';
          $('photoNoneText').style.display = 'none';
          $('photoRemoveBtn').style.display = 'inline-block';
        } else {
          resultEl.textContent = 'Fehler: ' + data.error;
          resultEl.style.color = '#ff8a8a';
        }
      } catch (e) {
        resultEl.textContent = 'Fehler: ' + e.message;
        resultEl.style.color = '#ff8a8a';
      }
      $('photoFileInput').value = '';
    });
    $('photoRemoveBtn').addEventListener('click', async () => {
      await fetch(`/api/photo-card/${encodeURIComponent(cardId)}/background/remove`, { method: 'POST' });
      delete settings.photoVersion;
      markDirty();
      $('photoPreview').style.display = 'none';
      $('photoNoneText').style.display = 'inline';
      $('photoRemoveBtn').style.display = 'none';
      $('photoResult').textContent = '';
    });
  }

  if (fields.graphOpts) {
    $('graphHours').addEventListener('change', () => { settings.graphHours = parseInt($('graphHours').value, 10); markDirty(); });
    const zahlOderWeg = (id, feld) => $(id).addEventListener('input', () => {
      const v = $(id).value.trim();
      if (v === '') delete settings[feld]; else settings[feld] = parseFloat(v);
      markDirty();
    });
    zahlOderWeg('graphMin', 'graphMin');
    zahlOderWeg('graphMax', 'graphMax');
  }

  if (fields.coverOpts) {
    $('coverPosition').addEventListener('change', () => { settings.coverPosition = $('coverPosition').checked; markDirty(); });
    $('coverTilt').addEventListener('change', () => { settings.coverTilt = $('coverTilt').checked; markDirty(); });
  }

  if (fields.climateOpts) {
    $('climateModes').addEventListener('change', () => { settings.climateModes = $('climateModes').checked; markDirty(); });
    $('climatePresets').addEventListener('change', () => { settings.climatePresets = $('climatePresets').checked; markDirty(); });
  }

  if (fields.gateOpts) {
    if (!Array.isArray(settings.gateButtons)) settings.gateButtons = [];
    $('gateMessage').addEventListener('input', () => { settings.gateMessage = $('gateMessage').value; markDirty(); });

    function renderGateRows() {
      const list = $('gateBtnList');
      list.innerHTML = settings.gateButtons.map((b, i) => `
        <div style="display:flex; align-items:center; gap:0.6vh; margin-bottom:0.6vh;">
          <input type="text" class="gate-label-input" data-idx="${i}" placeholder="Beschriftung, z.B. Tor vorne" value="${(b.label || '').replace(/"/g, '&quot;')}" style="flex:1;">
          <input type="text" class="gate-entity-input" data-idx="${i}" list="gateEntityList" placeholder="input_button.xxx" value="${(b.entity || '').replace(/"/g, '&quot;')}" style="flex:1.4;">
          <button type="button" class="gate-up-btn" data-idx="${i}" style="width:auto; padding:0 1vh; margin:0; flex-shrink:0;" title="nach oben">↑</button>
          <button type="button" class="gate-remove-btn" data-idx="${i}" style="width:auto; padding:0 1.2vh; margin:0; background:#dc3545; flex-shrink:0;">×</button>
        </div>
      `).join('') || `<p style="font-size:1.1vh; color:var(--muted);">Noch keine Knöpfe.</p>`;

      list.querySelectorAll('.gate-label-input').forEach(el => el.addEventListener('input', () => {
        settings.gateButtons[+el.dataset.idx].label = el.value; markDirty();
      }));
      list.querySelectorAll('.gate-entity-input').forEach(el => el.addEventListener('input', () => {
        settings.gateButtons[+el.dataset.idx].entity = el.value; markDirty();
      }));
      list.querySelectorAll('.gate-remove-btn').forEach(el => el.addEventListener('click', () => {
        settings.gateButtons.splice(+el.dataset.idx, 1); markDirty(); renderGateRows();
      }));
      list.querySelectorAll('.gate-up-btn').forEach(el => el.addEventListener('click', () => {
        const i = +el.dataset.idx;
        if (i === 0) return;
        const [w] = settings.gateButtons.splice(i, 1);
        settings.gateButtons.splice(i - 1, 0, w);
        markDirty(); renderGateRows();
      }));
    }
    renderGateRows();
    $('gateAddBtn').addEventListener('click', () => {
      settings.gateButtons.push({ label: '', entity: '' });
      markDirty(); renderGateRows();
    });
  }

  if (fields.quickTiles) {
    if (!Array.isArray(settings.tiles)) settings.tiles = [];
    function renderTileRows() {
      const list = $('qtTileList');
      list.innerHTML = settings.tiles.map((t, i) => `
        <div style="display:flex; align-items:center; gap:0.6vh; margin-bottom:0.6vh;">
          <img class="qt-thumb" src="${t.imageDataUrl || ''}" style="width:4vh; height:4vh; border-radius:6px; object-fit:cover; background:var(--bg); flex-shrink:0; display:${t.imageDataUrl ? 'block' : 'none'};">
          <button type="button" class="qt-img-btn" data-idx="${i}" style="width:auto; padding:0 1vh; margin:0; flex-shrink:0;">Bild</button>
          <input type="text" class="qt-mp-input" data-idx="${i}" list="mpEntityList" placeholder="media_player.xxx" value="${t.mediaPlayerEntity || ''}" style="flex:1.4;">
          <input type="text" class="qt-source-input" data-idx="${i}" placeholder="Quelle, z.B. Netflix" value="${t.source || ''}" style="flex:1;">
          <button type="button" class="qt-remove-btn" data-idx="${i}" style="width:auto; padding:0 1.2vh; margin:0; background:#dc3545; flex-shrink:0;">×</button>
        </div>
      `).join('') || `<p style="font-size:1.1vh; color:var(--muted);">Noch keine Kacheln.</p>`;
      list.querySelectorAll('.qt-mp-input').forEach(el => el.addEventListener('input', () => { settings.tiles[+el.dataset.idx].mediaPlayerEntity = el.value; markDirty(); }));
      list.querySelectorAll('.qt-source-input').forEach(el => el.addEventListener('input', () => {
        const t = settings.tiles[+el.dataset.idx]; t.source = el.value; t.label = el.value; markDirty();
      }));
      list.querySelectorAll('.qt-remove-btn').forEach(el => el.addEventListener('click', () => {
        settings.tiles.splice(+el.dataset.idx, 1); markDirty(); renderTileRows();
      }));
      list.querySelectorAll('.qt-img-btn').forEach(el => el.addEventListener('click', () => {
        const idx = +el.dataset.idx;
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/png,image/jpeg,image/webp';
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files[0];
          if (!file) return;
          settings.tiles[idx].imageDataUrl = await resizeImageFile(file, 200);
          markDirty();
          renderTileRows();
        });
        fileInput.click();
      }));
    }
    renderTileRows();
    $('qtAddTileBtn').addEventListener('click', () => {
      settings.tiles.push({ id: 'tile_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), mediaPlayerEntity: '', source: '', label: '' });
      markDirty();
      renderTileRows();
    });
  }

  $('settingsModal').classList.add('show');
}

// Verkleinert ein Bild vor dem Hochladen auf max. maxDim Pixel (laengste Seite) und
// komprimiert als JPEG -- siehe screensaver.js fuer dieselbe Logik/Begruendung.
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

$('settingsCancel').addEventListener('click', () => $('settingsModal').classList.remove('show'));

$('settingsSave').addEventListener('click', () => {
  const entry = currentLayout.find(l => l.entity_id === settingsEntityId);
  if (!entry) return;
  const settings = { ...(entry.settings || {}) };
  if (settingsFields.name) {
    const nameV = ($('setName') && $('setName').value.trim()) || '';
    if (nameV) settings.name = nameV; else delete settings.name;
  }
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
  if (settingsFields.navigateTarget) {
    const targetSel = $('setTarget');
    const targetId = targetSel ? targetSel.value : 'main';
    const targetName = targetId === 'main' ? 'Hauptdashboard' : ((allDashboards.find(d => d.id === targetId) || {}).name || 'Dashboard');
    settings.targetDashboardId = targetId;
    settings.targetDashboardName = targetName;
    const nameV = ($('setName') && $('setName').value.trim()) || '';
    if (nameV) settings.name = nameV; else delete settings.name;
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

// --- Picker: erst Kartentyp, dann passende Entitaet (oder Ziel-Dashboard bei Navigation) ---
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
      if (t === 'navigate') addNavigateCard();
      else if (t === 'energy') addEnergyCard();
      else if (t === 'photo') addPhotoCard();
      else if (t === 'quicktiles') addQuickTilesCard();
      else showEntityStep(t);
    });
    grid.appendChild(tile);
  });
}

function addNavigateCard() {
  const span = clampSpan(sizeToSpan(defaultSize('navigate')), 'navigate');
  const pos = findFreeSpot(span.cols, span.rows, 'navigate');
  currentLayout.push({
    entity_id: 'navigate:' + Date.now(), order: currentLayout.length, card_type: 'navigate',
    cols: span.cols, rows: span.rows, x: pos.x, y: pos.y,
    settings: { targetDashboardId: 'main', targetDashboardName: 'Hauptdashboard' }
  });
  markDirty();
  $('picker').classList.remove('show');
  render();
}

function addEnergyCard() {
  const span = clampSpan(sizeToSpan(defaultSize('energy')), 'energy');
  const pos = findFreeSpot(span.cols, span.rows, 'energy');
  const id = 'energy:' + Date.now();
  currentLayout.push({
    entity_id: id, order: currentLayout.length, card_type: 'energy',
    cols: span.cols, rows: span.rows, x: pos.x, y: pos.y, settings: {}
  });
  markDirty();
  $('picker').classList.remove('show');
  render();
  openSettings(id); // gleich die Entitaeten abfragen, da die Karte sonst leer ist
}

function addPhotoCard() {
  const span = clampSpan(sizeToSpan(defaultSize('photo')), 'photo');
  const pos = findFreeSpot(span.cols, span.rows, 'photo');
  const id = 'photo:' + Date.now();
  currentLayout.push({
    entity_id: id, order: currentLayout.length, card_type: 'photo',
    cols: span.cols, rows: span.rows, x: pos.x, y: pos.y, settings: {}
  });
  markDirty();
  $('picker').classList.remove('show');
  render();
  openSettings(id); // gleich das Bild hochladen, da die Karte sonst leer ist
}

function addQuickTilesCard() {
  const span = clampSpan(sizeToSpan(defaultSize('quicktiles')), 'quicktiles');
  const pos = findFreeSpot(span.cols, span.rows, 'quicktiles');
  const id = 'quicktiles:' + Date.now();
  currentLayout.push({
    entity_id: id, order: currentLayout.length, card_type: 'quicktiles',
    cols: span.cols, rows: span.rows, x: pos.x, y: pos.y, settings: { tiles: [] }
  });
  markDirty();
  $('picker').classList.remove('show');
  render();
  openSettings(id); // gleich Kacheln anlegen, da die Karte sonst leer ist
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
      const pos = findFreeSpot(span.cols, span.rows, pickerType);
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
  const url = DASHBOARD_ID === 'main' ? '/api/config' : `/api/dashboards/${DASHBOARD_ID}`;
  const body = DASHBOARD_ID === 'main'
    ? { entities: layout.map(l => l.entity_id), layout }
    : { layout };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.textContent = 'Gespeichert – Wall Display aktualisiert sich automatisch.';
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
