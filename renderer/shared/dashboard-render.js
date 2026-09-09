(function (global) {
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.2-1.6l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.7-1.6L13.4 2h-2.8l-.4 2.8a7 7 0 0 0-2.7 1.6l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .2 1.6l-2 1.6 2 3.4 2.3-1a7 7 0 0 0 2.7 1.6l.4 2.8h2.8l.4-2.8a7 7 0 0 0 2.7-1.6l2.3 1 2-3.4-2-1.6c.1-.5.2-1 .2-1.6z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v6h6"/><path d="M20 20v-6h-6"/><path d="M5 15a8 8 0 0 0 14-3M19 9a8 8 0 0 0-14 3"/></svg>',
    climate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M4 7l16 10M20 7L4 17"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-4 10.5c.5.5.8 1 .8 1.7V16h6.4v-1.8c0-.7.3-1.2.8-1.7A6 6 0 0 0 12 2z"/></svg>',
    cover: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h18M6 4v10M18 4v10M6 20l3-3M18 20l-3-3"/></svg>',
    switch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v10"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/></svg>',
    button: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18a8 8 0 0 1 16 0"/><path d="M12 18l4-6"/></svg>',
    graph: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16l4-5 4 3 8-9"/></svg>',
    temperature: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>',
    wind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 16h15a3 3 0 1 1-3 3"/><path d="M3 12h9"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15.5a4.5 4.5 0 0 1 .5-8.98A6 6 0 0 1 19 8.5a4 4 0 0 1-1 7.9H7z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/></svg>',
    radar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 12V4"/><path d="M12 12l6.5 3.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
    fan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.6"/><path d="M12 12c0-4 2-7 4-7s2 3-1 5M12 12c-4 0-7 2-7 4s3 2 5-1M12 12c0 4-2 7-4 7s-2-3 1-5M12 12c4 0 7-2 7-4s-3-2-5 1"/></svg>',
    sensor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 0 0-5 5v7a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"/><circle cx="12" cy="18" r="2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    pressure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 13L16 9"/><path d="M12 5v1.5M5 13h1.5M17.5 13H19M7 7.5l1 1M17 7.5l-1 1"/></svg>',
    select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 12h8M15 9l3 3-3 3"/></svg>',
    navigate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="3"/></svg>',
    forecast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 18a4 4 0 0 1 .5-7.97A5.5 5.5 0 0 1 18 11.5 3.5 3.5 0 0 1 17.5 18H7z"/><path d="M8 21l1-2M12 21l1-2M16 21l1-2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
    sunny: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
    cloudy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 18a4 4 0 0 1 .5-7.97A5.5 5.5 0 0 1 18 11.5 3.5 3.5 0 0 1 17.5 18H7z"/></svg>',
    snowy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 12a4 4 0 0 1 .5-7.97A5.5 5.5 0 0 1 18 5.5 3.5 3.5 0 0 1 17.5 12H7z"/><path d="M8 16v4M12 16v4M16 16v4M7 18l2 2M17 18l-2 2M11 18l-2 2M13 18l2 2"/></svg>',
    storm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 12a4 4 0 0 1 .5-7.97A5.5 5.5 0 0 1 18 5.5 3.5 3.5 0 0 1 17.5 12H7z"/><path d="M13 13l-3 5h3l-2 4"/></svg>',
    fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10h13M4 14h16M6 18h12"/></svg>',
    sun2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M4.5 4.5l1.8 1.8M17.7 17.7l1.8 1.8M2.5 12h2.5M19 12h2.5M4.5 19.5l1.8-1.8M17.7 6.3l1.8-1.8"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M6 6l6 4 6-4M6 12l6 4 6-4M4 20h16"/></svg>',
    home2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/></svg>',
    battery2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="16" height="10" rx="1.5"/><path d="M21 11v4"/><path d="M8 13h3l-1 2h3l-4 4v-3H7z" fill="currentColor" stroke="none"/></svg>',
    mediaPlayer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M9 8.5v5l4.5-2.5z" fill="currentColor" stroke="none"/><path d="M4 20h16"/></svg>',
    lockClosed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    lockOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.4-2"/></svg>',
    fan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12c0-3 1-6 4-6a3 3 0 1 1-1 5.8"/><path d="M12 12c3 0 6 1 6 4a3 3 0 1 1-5.8-1"/><path d="M12 12c0 3-1 6-4 6a3 3 0 1 1 1-5.8"/><path d="M12 12c-3 0-6-1-6-4a3 3 0 1 1 5.8 1"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
    vacuum: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><circle cx="11" cy="11" r="2.4" fill="currentColor" stroke="none"/><path d="M16.5 16.5L21 21"/></svg>',
    humidity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3.5v5c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5v-5L12 3z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6M14 11v6"/></svg>',
    shieldOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3.5v5c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5v-5L12 3z" opacity="0.4"/></svg>',
    dockIcon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19h16M6 19v-3a6 6 0 0 1 12 0v3"/></svg>',
    power: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77 0"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4l14 8-14 8z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/></svg>',
    skipPrev: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="2.5" height="16"/><path d="M19 4v16l-11-8z"/></svg>',
    skipNext: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="17.5" y="4" width="2.5" height="16"/><path d="M5 4v16l11-8z"/></svg>',
    volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>',
    volumeMute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h3.5L16 18h6M2 18h3.5L11 11"/><path d="M18 6h4v0M18 6l3-3M18 6l3 3M18 18h4M18 18l3-3M18 18l3 3"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    repeatOne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><path d="M11 9h1v4"/></svg>',
    generic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'
  };
  const DOMAIN_LABEL = { light: 'Licht', switch: 'Schalter', climate: 'Klima', cover: 'Rollläden', fan: 'Lüfter', sensor: 'Sensoren', button: 'Taster', input_button: 'Taster', scene: 'Szenen', script: 'Skripte' };

  // Kartentypen-Katalog: id -> { label, defaultSize (Preset fuer NEUE Karten) }
  const CARD_TYPES = {
    light:  { label: 'Lampe (Dimmer)', defaultSize: 'md' },
    switch: { label: 'Schalter',       defaultSize: 'sm' },
    button: { label: 'Taster',         defaultSize: 'sm' },
    gauge:  { label: 'Gauge',          defaultSize: 'md' },
    graph:  { label: 'Verlauf',        defaultSize: 'lg' },
    temperature: { label: 'Temperatur', defaultSize: 'lg' },
    wind:   { label: 'Wind',           defaultSize: 'lg' },
    rain:   { label: 'Regen',          defaultSize: 'lg' },
    radar:  { label: 'Regenradar',     defaultSize: 'lg' },
    climate:{ label: 'Klima',          defaultSize: 'md' },
    cover:  { label: 'Rollladen',      defaultSize: 'md' },
    sensor: { label: 'Sensor (Text)',  defaultSize: 'sm' },
    clock:  { label: 'Uhr',            defaultSize: 'md' },
    pressure: { label: 'Luftdruck',    defaultSize: 'lg' },
    select: { label: 'Auswahl',        defaultSize: 'md' },
    navigate: { label: 'Dashboard wechseln', defaultSize: 'sm' },
    forecast: { label: 'Wettervorhersage', defaultSize: 'xl' },
    energy: { label: 'Energiefluss', defaultSize: 'xl' },
    media_player: { label: 'Media Player', defaultSize: 'lg' },
    lock: { label: 'Schloss', defaultSize: 'sm' },
    fan: { label: 'Ventilator', defaultSize: 'md' },
    vacuum: { label: 'Saugroboter', defaultSize: 'md' },
    humidity: { label: 'Luftfeuchtigkeit', defaultSize: 'lg' },
    alarm: { label: 'Alarmanlage', defaultSize: 'md' },
    waste: { label: 'Mülltermine', defaultSize: 'lg' },
    photo: { label: 'Foto-Bereich', defaultSize: 'xl' },
    quicktiles: { label: 'Schnellzugriff', defaultSize: 'lg' }
  };

  // Welche Domains zu welchem Kartentyp passen -- Grundlage fuer den "erst Typ,
  // dann Entitaet"-Ablauf beim Hinzufuegen. null = keine Einschraenkung, [] = keine
  // Entitaet noetig (z.B. Uhr).
  function domainsForType(type) {
    switch (type) {
      case 'light': return ['light'];
      case 'switch': return ['switch', 'input_boolean', 'fan', 'light', 'binary_sensor'];
      case 'button': return ['button', 'input_button', 'scene', 'script'];
      case 'climate': return ['climate'];
      case 'cover': return ['cover'];
      case 'radar': return ['camera', 'image'];
      case 'gauge': case 'graph': case 'temperature': case 'wind': case 'rain': case 'pressure': case 'humidity':
        return NUMERIC_DOMAINS;
      case 'sensor': return [...NUMERIC_DOMAINS, 'binary_sensor'];
      case 'select': return ['input_select', 'select'];
      case 'forecast': return ['weather'];
      case 'media_player': return ['media_player'];
      case 'lock': return ['lock'];
      case 'fan': return ['fan'];
      case 'vacuum': return ['vacuum'];
      case 'alarm': return ['alarm_control_panel'];
      case 'waste': return ['calendar'];
      case 'clock': case 'navigate': case 'energy': case 'photo': case 'quicktiles': return [];
      default: return null;
    }
  }

  // Umkehrung von allowedCardTypes: welche Kartentypen passen zu einer bereits
  // vorhandenen Entitaet (fuer das Typ-Dropdown auf existierenden Karten).
  function typesForEntity(entity_id) {
    const domain = domainOf(entity_id);
    return Object.keys(CARD_TYPES).filter(t => {
      if (t === 'clock' || t === 'navigate' || t === 'energy') return false;
      const doms = domainsForType(t);
      return doms === null || doms.includes(domain);
    });
  }

  // Freies Groessenmodell: jede Karte hat cols (1-4) x rows (1-4), per Drag im Editor
  // frei einstellbar. Presets bleiben als Kurzwahl-Buttons UND als Fallback fuer alte
  // Configs erhalten.
  const SIZE_PRESETS = { sm: { cols: 1, rows: 1 }, md: { cols: 2, rows: 1 }, lg: { cols: 2, rows: 2 }, xl: { cols: 4, rows: 2 } };
  function sizeToSpan(sizeStr) { return SIZE_PRESETS[sizeStr] || SIZE_PRESETS.sm; }

  // Mindestgroessen pro Kartentyp -- verhindert kaputte/zu enge Darstellung beim freien
  // Ziehen (z.B. darf "Verlauf" nicht schmaler als 2 Spalten werden).
  const MIN_SPAN = {
    graph: { cols: 2, rows: 2 },
    radar: { cols: 2, rows: 2 },
    climate: { cols: 2, rows: 1 },
    cover: { cols: 2, rows: 1 },
    light: { cols: 2, rows: 1 },
    forecast: { cols: 2, rows: 1 },
    energy: { cols: 2, rows: 2 },
    media_player: { cols: 2, rows: 2 },
    photo: { cols: 3, rows: 2 },
    quicktiles: { cols: 2, rows: 1 }
  };
  function minSpanFor(type) { return MIN_SPAN[type] || { cols: 1, rows: 1 }; }

  // Kartentypen, die auf einer Foto-Bereich-Karte "andocken" duerfen (ueberlappen statt zu
  // kollidieren) -- bekommen dort automatisch einen durchscheinenden Glas-Effekt.
  const PHOTO_OVERLAY_TYPES = ['media_player', 'forecast'];
  function canOverlayOnPhoto(type) { return PHOTO_OVERLAY_TYPES.includes(type); }

  function clampSpan(span, type) {
    const min = minSpanFor(type);
    return {
      cols: Math.max(min.cols, Math.min(4, span.cols || min.cols)),
      rows: Math.max(min.rows, Math.min(4, span.rows || min.rows))
    };
  }

  // Ermittelt cols/rows aus einem Layout-Eintrag: neue Eintraege haben cols/rows direkt,
  // alte nur ein `size`-Preset (sm/md/lg/xl) -- beides wird unterstuetzt.
  function resolveSpan(entry, type) {
    const base = (entry && entry.cols && entry.rows)
      ? clampSpan({ cols: entry.cols, rows: entry.rows }, type)
      : clampSpan(sizeToSpan((entry && entry.size) || defaultSize(type)), type);
    if (entry && Number.isInteger(entry.x) && Number.isInteger(entry.y)) {
      return { ...base, x: entry.x, y: entry.y };
    }
    return base;
  }

  const PRESS_DOMAINS = { button: 'press', input_button: 'press', scene: 'turn_on', script: 'turn_on' };
  const TOGGLE_DOMAINS = ['light', 'switch', 'input_boolean', 'fan'];
  const NUMERIC_DOMAINS = ['sensor', 'number', 'input_number'];

  function domainOf(entity_id) { return entity_id.split('.')[0]; }

  function isNumeric(state) {
    return state != null && state.state !== undefined && state.state !== '' && !isNaN(parseFloat(state.state));
  }

  // Temperatur-Erkennung: primaer ueber device_class/Einheit, zusaetzlich ueber den
  // Namen -- manche Integrationen (z.B. manche Wetterstationen/Vorlagen) setzen weder
  // device_class noch eine erkennbare Einheit korrekt.
  function isTemperature(entity_id, attrs) {
    const unit = attrs.unit_of_measurement;
    if (attrs.device_class === 'temperature' || unit === '°C' || unit === '°F') return true;
    const name = ((attrs.friendly_name || '') + ' ' + (entity_id || '')).toLowerCase();
    return /temperat/.test(name) || /\btemp\b/.test(name);
  }

  function isWind(entity_id, attrs) {
    if (attrs.device_class === 'wind_speed') return true;
    const name = ((attrs.friendly_name || '') + ' ' + (entity_id || '')).toLowerCase();
    return /wind/.test(name);
  }

  function isRain(entity_id, attrs) {
    if (attrs.device_class === 'precipitation' || attrs.device_class === 'precipitation_intensity') return true;
    if (attrs.unit_of_measurement === 'mm' || attrs.unit_of_measurement === 'mm/h') return true;
    const name = ((attrs.friendly_name || '') + ' ' + (entity_id || '')).toLowerCase();
    return /regen|niederschlag|rain/.test(name);
  }

  function isPressure(entity_id, attrs) {
    if (attrs.device_class === 'atmospheric_pressure' || attrs.device_class === 'pressure') return true;
    const unit = attrs.unit_of_measurement;
    if (unit === 'hPa' || unit === 'mbar' || unit === 'mmHg' || unit === 'inHg' || unit === 'Pa') return true;
    const name = ((attrs.friendly_name || '') + ' ' + (entity_id || '')).toLowerCase();
    return /luftdruck|pressure|barometer/.test(name);
  }

  function isHumidity(entity_id, attrs) {
    if (attrs.device_class === 'humidity') return true;
    const name = ((attrs.friendly_name || '') + ' ' + (entity_id || '')).toLowerCase();
    return attrs.unit_of_measurement === '%' && /feucht|humid/.test(name);
  }

  // Welcher Kartentyp passt standardmaessig zu dieser Entitaet
  function defaultCardType(entity_id, state) {
    const domain = domainOf(entity_id);
    const attrs = (state && state.attributes) || {};
    if (domain === 'climate') return 'climate';
    if (domain === 'cover') return 'cover';
    if (domain === 'camera' || domain === 'image') return 'radar';
    if (domain === 'weather') return 'forecast';
    if (domain === 'media_player') return 'media_player';
    if (domain === 'lock') return 'lock';
    if (domain === 'vacuum') return 'vacuum';
    if (domain === 'alarm_control_panel') return 'alarm';
    if (domain === 'calendar') return 'waste';
    if (domain === 'fan') return 'fan';
    if (domain === 'input_select' || domain === 'select') return 'select';
    if (PRESS_DOMAINS[domain]) return 'button';
    if (domain === 'light') return attrs.brightness !== undefined ? 'light' : 'switch';
    if (domain === 'switch' || domain === 'input_boolean') return 'switch';
    if (domain === 'binary_sensor') return 'switch';
    if (NUMERIC_DOMAINS.includes(domain) && isTemperature(entity_id, attrs)) return 'temperature';
    if (NUMERIC_DOMAINS.includes(domain) && isWind(entity_id, attrs)) return 'wind';
    if (NUMERIC_DOMAINS.includes(domain) && isRain(entity_id, attrs)) return 'rain';
    if (NUMERIC_DOMAINS.includes(domain) && isPressure(entity_id, attrs)) return 'pressure';
    if (NUMERIC_DOMAINS.includes(domain) && isHumidity(entity_id, attrs)) return 'humidity';
    if (NUMERIC_DOMAINS.includes(domain) && isNumeric(state)) return 'gauge';
    return 'sensor';
  }

  // Welche Kartentypen darf man fuer diese Entitaet manuell waehlen
  function allowedCardTypes(entity_id, state) {
    const domain = domainOf(entity_id);
    const attrs = (state && state.attributes) || {};
    if (domain === 'climate') return ['climate'];
    if (domain === 'cover') return ['cover'];
    if (domain === 'camera' || domain === 'image') return ['radar'];
    if (domain === 'weather') return ['forecast'];
    if (domain === 'media_player') return ['media_player'];
    if (domain === 'input_select' || domain === 'select') return ['select'];
    if (PRESS_DOMAINS[domain]) return ['button'];
    if (domain === 'light') return ['light', 'switch'];
    if (domain === 'switch' || domain === 'input_boolean' || domain === 'fan') return ['switch'];
    if (domain === 'binary_sensor') return ['switch', 'sensor'];
    if (NUMERIC_DOMAINS.includes(domain)) {
      const base = ['gauge', 'graph', 'sensor'];
      if (isRain(entity_id, attrs)) return ['rain', ...base];
      if (isWind(entity_id, attrs)) return ['wind', ...base];
      if (isTemperature(entity_id, attrs)) return ['temperature', ...base];
      if (isPressure(entity_id, attrs)) return ['pressure', ...base];
      return base;
    }
    return ['sensor'];
  }

  function defaultSize(cardType) { return (CARD_TYPES[cardType] || {}).defaultSize || 'sm'; }

  function fmt(val, unit) { return unit ? `${val} ${unit}` : `${val}`; }

  // Ordnet einem Kalender-Termin-Titel eine Farbe nach deutscher Tonnenart zu -- rein
  // stichwortbasiert, damit es ohne Konfiguration mit den gaengigen Muellkalender-
  // Integrationen (z.B. Abfall.io) funktioniert.
  function wasteColor(summary) {
    const s = (summary || '').toLowerCase();
    if (/bio/.test(s)) return '#6b8e23';
    if (/papier|pappe|blau/.test(s)) return '#4f7cff';
    if (/gelb|verpackung|wertstoff/.test(s)) return '#f0b429';
    if (/glas/.test(s)) return '#22c55e';
    if (/sperrm/.test(s)) return '#ef4444';
    if (/rest/.test(s)) return '#6b7280';
    return '#9ca3af';
  }

  // Formatiert ein Datum relativ ("Heute", "Morgen", sonst Wochentag + Datum)
  function wasteDateLabel(dateStr) {
    const d = new Date(dateStr);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / 86400000);
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }

  // HA-Wetterzustand (z.B. "partlycloudy", "pouring") auf eines unserer Icons abbilden
  function conditionIcon(condition) {
    const c = (condition || '').toLowerCase();
    if (c.includes('clear') || c === 'sunny') return 'sunny';
    if (c.includes('snow') || c.includes('hail')) return 'snowy';
    if (c.includes('lightning') || c.includes('thunder')) return 'storm';
    if (c.includes('rain') || c.includes('pouring') || c.includes('drizzle')) return 'rain';
    if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return 'fog';
    if (c.includes('cloud')) return 'cloudy';
    return 'cloudy';
  }

  // Aktualisiert Uhrzeit/Datum einer Uhr-Karte -- wird beim Bauen einmal aufgerufen
  // und kann von aussen periodisch erneut aufgerufen werden (Karte bleibt bestehen).
  function renderClockNow(card) {
    const now = new Date();
    const timeEl = card.querySelector('.clock-time');
    const dateEl = card.querySelector('.clock-date');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  }

  // Farbverlauf blau (kalt) -> rot (warm) je nach Temperaturwert, fuer die Temperatur-Karte
  function tempGradient(value, unit) {
    if (value === null || value === undefined || isNaN(value)) return 'linear-gradient(155deg, #4a4d57, #2a2d34)';
    let celsius = value;
    if (unit === '°F') celsius = (value - 32) * 5 / 9;
    const clamped = Math.max(-10, Math.min(35, celsius));
    const t = (clamped + 10) / 45;
    const hue = 210 - t * 210;
    return `linear-gradient(155deg, hsl(${hue.toFixed(0)},70%,55%), hsl(${hue.toFixed(0)},65%,30%))`;
  }

  // Ermittelt Wertebereich [min,max] fuer den Gauge-Ring, falls in den Karten-Einstellungen
  // keins vorgegeben ist: bei %/Batterie/Feuchtigkeit fest 0-100, bei Temperatur ein
  // sinnvoller Bereich, sonst aus dem beobachteten Verlauf der letzten 24h.
  function gaugeRange(attrs, history) {
    const unit = attrs.unit_of_measurement;
    const dc = attrs.device_class;
    if (unit === '%' || dc === 'battery' || dc === 'humidity') return [0, 100];
    if (dc === 'temperature') return [-10, 40];
    if (history && history.length > 1) {
      const vals = history.map(p => p.v);
      let min = Math.min(...vals), max = Math.max(...vals);
      if (min === max) { min -= 1; max += 1; }
      return [min, max];
    }
    return null;
  }

  // Farbe je nach Schwellenwerten (z.B. ab 10 gruen, ab 28 gelb): es gilt die hoechste
  // Schwelle, deren Wert <= aktuellem Messwert ist; darunter greift die Basisfarbe.
  function thresholdColor(value, thresholds, baseColor) {
    const fallback = baseColor || 'var(--on-card-strong)';
    if (value === null || value === undefined || isNaN(value) || !thresholds || !thresholds.length) return fallback;
    const sorted = [...thresholds].filter(t => t && t.value !== '' && t.value !== null && !isNaN(t.value))
      .sort((a, b) => Number(a.value) - Number(b.value));
    let color = fallback;
    for (const t of sorted) { if (value >= Number(t.value)) color = t.color; }
    return color;
  }

  // Gauge-Bogen 1:1 nach der vom Nutzer bereitgestellten Vorlage: derselbe Pfad/dieselbe
  // Kruemmung wie im Original-Template, mit pathLength=100-Trick fuer den Fuellstand in %.
  // Text liegt als HTML-Overlay ueber dem Bogen (nicht im SVG) -- dadurch greift dieselbe
  // fluide Container-Query-Typografie wie bei allen anderen Karten.
  const GAUGE_ARC_PATH = 'M 49.7 220.9 A 124 124 0 1 1 250.3 220.9';

  function gaugeSvg2(pct, valueText, unit, title, color) {
    const known = pct !== null && pct !== undefined && !isNaN(pct);
    const clamped = known ? Math.max(0, Math.min(100, pct)) : 0;
    return `
      <svg viewBox="0 0 288 243" class="gauge-svg" preserveAspectRatio="xMidYMid meet">
        <path pathLength="100" d="${GAUGE_ARC_PATH}" fill="none" stroke="var(--on-card-track)" stroke-width="13" stroke-linecap="round"/>
        <path pathLength="100" d="${GAUGE_ARC_PATH}" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"
          stroke-dasharray="${clamped} 100" opacity="${known ? 1 : 0.35}"/>
      </svg>
      <div class="gauge-content">
        ${title ? `<div class="gauge-title">${String(title).toUpperCase()}</div>` : ''}
        <div class="gauge-value">${valueText}${unit ? `<span class="gauge-unit">${unit}</span>` : ''}</div>
      </div>`;
  }

  // Glaettet rohe, verrauschte Sensordaten in eine ueberschaubare Anzahl Buckets
  // (Mittelwert je Zeitfenster) -- rohe Rohwerte mit einzelnen Extremspitzen sehen
  // sonst wie chaotisches Gezacke aus statt einen Trend erkennen zu lassen.
  function downsample(series, buckets) {
    if (series.length <= buckets) return series.map(p => p.v);
    const out = [];
    const bucketSize = series.length / buckets;
    for (let i = 0; i < buckets; i++) {
      const start = Math.floor(i * bucketSize);
      const end = Math.max(Math.floor((i + 1) * bucketSize), start + 1);
      const slice = series.slice(start, end);
      out.push(slice.reduce((s, p) => s + p.v, 0) / slice.length);
    }
    return out;
  }

  // Weiche Kurve statt scharfer Geradenzuege zwischen den Punkten
  function smoothPath(points) {
    if (points.length < 3) return `M ${points.map(p => p.join(',')).join(' L ')}`;
    let d = `M ${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      d += ` Q ${x0.toFixed(1)},${y0.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    const last = points[points.length - 1];
    d += ` L ${last[0].toFixed(1)},${last[1].toFixed(1)}`;
    return d;
  }

  function sparklineSvg(series, gradId) {
    if (!series || series.length < 2) {
      return { svg: '<div class="graph-empty">Keine Verlaufsdaten</div>', caption: '' };
    }
    const smoothed = downsample(series, 36);
    const min = Math.min(...smoothed), max = Math.max(...smoothed);
    const range = (max - min) || 1;
    const w = 100, h = 36;
    const points = smoothed.map((v, i) => {
      const x = (i / (smoothed.length - 1)) * w;
      const y = h - ((v - min) / range) * h * 0.85 - h * 0.05; // etwas Luft oben/unten
      return [x, y];
    });
    const linePath = smoothPath(points);
    const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;
    const id = `sg${gradId || 0}`;
    const svg = `<svg viewBox="0 0 ${w} ${h}" class="sparkline" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--on-card-med)"/>
          <stop offset="100%" stop-color="transparent"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${id})" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="var(--on-card-strong)" stroke-width="2.2" vector-effect="non-scaling-stroke"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    const values = series.map(p => p.v);
    const rawMin = Math.min(...values), rawMax = Math.max(...values);
    const fmtN = n => Number.isInteger(n) ? n : Math.round(n * 10) / 10;
    return { svg, caption: `${fmtN(rawMin)} – ${fmtN(rawMax)}` };
  }

  // opts: { editable, callbacks: {...}, history, settings, apiBase }
  // span: entweder {cols, rows} ODER ein Preset-String (sm/md/lg/xl, Altbestand)
  function buildCard(entity_id, state, cardType, span, opts) {
    opts = opts || {};
    const editable = !!opts.editable;
    const cb = opts.callbacks || {};
    const settings = opts.settings || {};
    const attrs = (state && state.attributes) || {};
    const domain = domainOf(entity_id);
    const name = (settings.name && String(settings.name).trim()) || attrs.friendly_name || entity_id;
    const dis = editable ? 'disabled' : '';
    const type = cardType || defaultCardType(entity_id, state);
    const spanObj = (span && typeof span === 'object') ? span : sizeToSpan(span || defaultSize(type));
    const { cols, rows } = clampSpan(spanObj, type);
    const hasFixedPos = spanObj && Number.isInteger(spanObj.x) && Number.isInteger(spanObj.y);

    const card = document.createElement('div');
    card.dataset.entityId = entity_id;
    card.className = `card type-${type}`;
    if (opts.onPhoto) card.classList.add('card-on-photo');
    if (hasFixedPos) {
      card.style.gridColumn = `${spanObj.x + 1} / span ${cols}`;
      card.style.gridRow = `${spanObj.y + 1} / span ${rows}`;
      card.dataset.x = spanObj.x;
      card.dataset.y = spanObj.y;
    } else {
      card.style.gridColumn = `span ${cols}`;
      card.style.gridRow = `span ${rows}`;
    }
    card.dataset.cols = cols;
    card.dataset.rows = rows;

    if (type === 'climate') {
      const cur = attrs.current_temperature;
      const target = attrs.temperature;
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.climate}</span><span class="badge">${state ? state.state : '–'}</span></div>
        <div class="name">${name}</div>
        <div class="value">${target !== undefined ? target + '°C' : (cur !== undefined ? cur + '°C' : (state ? state.state : ''))}</div>
        <div class="controls">
          <button data-act="temp-down" ${dis}>−</button>
          <button data-act="temp-up" ${dis}>+</button>
        </div>`;
      if (!editable && cb.onSetTemp) {
        card.querySelector('[data-act="temp-up"]').addEventListener('click', () => cb.onSetTemp(entity_id, (target || 20) + 0.5));
        card.querySelector('[data-act="temp-down"]').addEventListener('click', () => cb.onSetTemp(entity_id, (target || 20) - 0.5));
      }
    } else if (type === 'light') {
      const isOn = state && state.state === 'on';
      const pct = Math.round((attrs.brightness || 0) / 255 * 100);
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.light}</span><span class="badge">${isOn ? 'ON' : 'OFF'}</span></div>
        <div class="name">${name}</div>
        <div class="value">${pct}%</div>
        <div class="controls slider-row">
          <button data-act="toggle" ${dis}>⏻</button>
          <input type="range" min="0" max="100" step="5" value="${pct}" data-act="slider" ${dis}>
        </div>`;
      if (!editable) {
        const slider = card.querySelector('[data-act="slider"]');
        if (cb.onSetBrightness) {
          slider.addEventListener('change', () => cb.onSetBrightness(entity_id, parseInt(slider.value, 10)));
        }
        if (cb.onToggle) {
          card.querySelector('[data-act="toggle"]').addEventListener('click', () => cb.onToggle('light', entity_id, state ? state.state : 'off'));
        }
      }
    } else if (type === 'cover') {
      const pos = attrs.current_position;
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.cover}</span><span class="badge">${state ? state.state : '–'}</span></div>
        <div class="name">${name}</div>
        <div class="value">${pos !== undefined ? pos + '%' : ''}</div>
        <div class="controls">
          <button data-act="open" ${dis}>▲</button>
          <button data-act="stop" ${dis}>⏸</button>
          <button data-act="close" ${dis}>▼</button>
        </div>`;
      if (!editable && cb.onCover) {
        card.querySelector('[data-act="open"]').addEventListener('click', () => cb.onCover(entity_id, 'open_cover'));
        card.querySelector('[data-act="stop"]').addEventListener('click', () => cb.onCover(entity_id, 'stop_cover'));
        card.querySelector('[data-act="close"]').addEventListener('click', () => cb.onCover(entity_id, 'close_cover'));
      }
    } else if (type === 'switch') {
      const isOn = state && state.state === 'on';
      const isReadOnly = domain === 'binary_sensor';
      card.classList.add(isOn ? 'on' : 'off');
      card.innerHTML = `<span class="icon">${ICONS[domain] || ICONS.switch}</span><span class="name">${name}</span><span class="badge">${isOn ? 'An' : 'Aus'}</span>`;
      if (!editable && !isReadOnly && cb.onToggle) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => cb.onToggle(domain, entity_id, state ? state.state : 'off'));
      }
    } else if (type === 'button') {
      card.innerHTML = `<span class="icon">${ICONS.button}</span><span class="name">${name}</span><span class="badge">Drücken</span>`;
      if (!editable && cb.onPress) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          card.classList.add('pressed');
          setTimeout(() => card.classList.remove('pressed'), 300);
          cb.onPress(domain, entity_id);
        });
      }
    } else if (type === 'temperature') {
      const unit = (settings.suffix !== undefined && settings.suffix !== '') ? settings.suffix : (attrs.unit_of_measurement || '°C');
      const rawVal = state ? state.state : null;
      const numVal = rawVal !== null ? parseFloat(rawVal) : NaN;
      card.style.background = tempGradient(isNaN(numVal) ? null : numVal, attrs.unit_of_measurement);
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.temperature}</span></div>
        <div class="name">${name}</div>
        <div class="value">${isNaN(numVal) ? (rawVal ?? '–') : numVal}${unit}</div>`;
    } else if (type === 'wind') {
      const unit = (settings.suffix !== undefined && settings.suffix !== '') ? settings.suffix : (attrs.unit_of_measurement || 'km/h');
      const val = state ? state.state : '–';
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.wind}</span></div>
        <div class="name">${name}</div>
        <div class="value">${fmt(val, unit)}</div>`;
    } else if (type === 'rain') {
      const unit = (settings.suffix !== undefined && settings.suffix !== '') ? settings.suffix : (attrs.unit_of_measurement || 'mm');
      const val = state ? state.state : '–';
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.rain}</span></div>
        <div class="name">${name}</div>
        <div class="value">${fmt(val, unit)}</div>`;
    } else if (type === 'pressure') {
      const unit = (settings.suffix !== undefined && settings.suffix !== '') ? settings.suffix : (attrs.unit_of_measurement || 'hPa');
      const val = state ? state.state : '–';
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.pressure}</span></div>
        <div class="name">${name}</div>
        <div class="value">${fmt(val, unit)}</div>`;
    } else if (type === 'radar') {
      const base = opts.apiBase || '';
      const bust = Math.floor(Date.now() / 300000); // Bild max. alle 5 Min neu laden
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.radar}</span><span class="name">${name}</span></div>
        <div class="radar-wrap"><img src="${base}/api/ha/media?entity_id=${encodeURIComponent(entity_id)}&t=${bust}" alt="${name}"></div>`;
    } else if (type === 'gauge') {
      const unit = (settings.suffix !== undefined && settings.suffix !== '') ? settings.suffix : attrs.unit_of_measurement;
      const rawVal = state ? state.state : null;
      const numVal = rawVal !== null ? parseFloat(rawVal) : NaN;
      const range = (settings.min !== undefined && settings.min !== '' && settings.max !== undefined && settings.max !== '')
        ? [Number(settings.min), Number(settings.max)]
        : gaugeRange(attrs, opts.history);
      let pct = null;
      if (range && !isNaN(numVal)) pct = ((numVal - range[0]) / (range[1] - range[0])) * 100;
      const displayVal = rawVal === null || rawVal === undefined ? '–' : (isNaN(numVal) ? rawVal : numVal);
      const color = thresholdColor(numVal, settings.thresholds, settings.baseColor);
      card.innerHTML = gaugeSvg2(pct, displayVal, unit, name, color);
    } else if (type === 'graph') {
      const val = state ? state.state : '–';
      const unit = (settings.suffix !== undefined && settings.suffix !== '') ? settings.suffix : attrs.unit_of_measurement;
      const { svg, caption } = sparklineSvg(opts.history, entity_id.replace(/[^a-z0-9]/gi, ''));
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.graph}</span><span class="badge">${fmt(val, unit)}</span></div>
        <div class="name">${name}</div>
        <div class="graph-wrap">${svg}</div>
        ${caption ? `<div class="graph-caption">${caption}${unit ? ' ' + unit : ''}</div>` : ''}`;
    } else if (type === 'clock') {
      card.innerHTML = `<div class="clock-time">--:--</div><div class="clock-date">-</div>`;
      renderClockNow(card);
    } else if (type === 'energy') {
      const en = opts.energy || {};
      const numOf = s => { const v = s && parseFloat(s.state); return (v === undefined || isNaN(v)) ? null : v; };
      const toW = (v, unit) => (v === null ? null : (unit === 'kW' ? v * 1000 : v));
      const unitOf = s => s && s.attributes && s.attributes.unit_of_measurement;
      const gridW = toW(numOf(en.grid), unitOf(en.grid));
      const gridRetW = toW(numOf(en.gridReturn), unitOf(en.gridReturn));
      const solarW = toW(numOf(en.solar), unitOf(en.solar));
      const battRaw = toW(numOf(en.battery), unitOf(en.battery));
      const battSoc = en.batterySoc ? parseFloat(en.batterySoc.state) : null;
      const battCharging = battRaw !== null && battRaw < 0;
      const battW = battRaw !== null ? Math.abs(battRaw) : null;
      const fmtW = v => v === null ? '–' : (v >= 1000 ? (v / 1000).toFixed(2) + ' kW' : Math.round(v) + ' W');
      const homeW = (solarW || 0) + (gridW || 0) - (gridRetW || 0) + (battCharging ? -(battW || 0) : (battW || 0));
      const hasSolar = en.solar !== undefined;
      const hasBattery = en.battery !== undefined;
      const solarActive = solarW !== null && solarW > 5;
      const gridActive = (gridW !== null && gridW > 5) || (gridRetW !== null && gridRetW > 5);
      const battActive = battW !== null && battW > 5;
      card.innerHTML = `
        <div class="ef-wrap">
          <svg class="ef-lines" viewBox="0 0 300 220" preserveAspectRatio="none">
            ${hasSolar ? `<path class="ef-path ${solarActive ? 'active' : ''}" d="M150,50 L150,108"/>` : ''}
            <path class="ef-path ${gridActive ? 'active' : ''}" d="M58,110 L140,110"/>
            ${hasBattery ? `<path class="ef-path ${battActive ? 'active' : ''} ${battCharging ? 'reverse' : ''}" d="M242,110 L160,110"/>` : ''}
          </svg>
          ${hasSolar ? `
          <div class="ef-node ef-solar">
            <span class="ef-icon">${ICONS.sun2}</span>
            <span class="ef-val">${fmtW(solarW)}</span>
            <span class="ef-label">Solar</span>
          </div>` : ''}
          <div class="ef-node ef-grid">
            <span class="ef-icon">${ICONS.grid}</span>
            <span class="ef-val">${fmtW(gridW)}</span>
            <span class="ef-label">Netz${gridRetW !== null && gridRetW > 5 ? ` (↑${fmtW(gridRetW)})` : ''}</span>
          </div>
          <div class="ef-node ef-home">
            <span class="ef-icon">${ICONS.home2}</span>
            <span class="ef-val">${fmtW(homeW)}</span>
            <span class="ef-label">${settings.name || 'Haus'}</span>
          </div>
          ${hasBattery ? `
          <div class="ef-node ef-battery">
            <span class="ef-icon">${ICONS.battery2}</span>
            <span class="ef-val">${fmtW(battW)}${battSoc !== null ? ' · ' + Math.round(battSoc) + '%' : ''}</span>
            <span class="ef-label">${battW !== null ? (battCharging ? 'Lädt' : 'Entlädt') : 'Batterie'}</span>
          </div>` : ''}
        </div>`;
    } else if (type === 'media_player') {
      const st = state ? state.state : 'off';
      const isPlaying = st === 'playing';
      const isOff = st === 'off' || st === 'unavailable';
      const title = attrs.media_title || '';
      const artist = attrs.media_artist || '';
      const picture = attrs.entity_picture;
      const base = opts.apiBase || '';
      const pictureUrl = picture ? `${base}/api/ha/picture?path=${encodeURIComponent(picture)}` : '';
      const volume = attrs.volume_level !== undefined ? Math.round(attrs.volume_level * 100) : null;
      const isMuted = !!attrs.is_volume_muted;
      const hasShuffle = attrs.shuffle !== undefined;
      const hasRepeat = attrs.repeat !== undefined;
      const showArtBg = settings.mediaArtBg !== false; // Standard an -- per Karten-Einstellung abschaltbar
      const sourceList = Array.isArray(attrs.source_list) ? attrs.source_list : [];
      const showSource = settings.mediaShowSource !== false && sourceList.length > 1;
      const duration = attrs.media_duration; // Sekunden, nur vorhanden wenn die Quelle das liefert
      const position = attrs.media_position;
      const showProgress = settings.mediaShowProgress !== false && typeof duration === 'number' && duration > 0 && typeof position === 'number';
      const fmtTime = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${String(sec).padStart(2, '0')}`; };
      const progressPct = showProgress ? Math.min(100, Math.round((position / duration) * 100)) : 0;
      card.classList.add('has-art-bg');
      card.innerHTML = `
        ${pictureUrl && showArtBg ? `<div class="mp-bg" style="background-image:url('${pictureUrl}')"></div><div class="mp-scrim"></div>` : ''}
        <button class="mp-power ${!isOff ? 'active' : ''}" data-act="power" ${dis}>${ICONS.power}</button>
        <div class="mp-wrap2">
          <div class="mp-art2">${pictureUrl ? `<img src="${pictureUrl}" alt="">` : ICONS.mediaPlayer}</div>
          <div class="mp-title2">${title || name}</div>
          <div class="mp-artist2">${artist || (isOff ? 'Aus' : st === 'idle' ? 'Bereit' : st)}</div>
          ${showProgress ? `
          <div class="mp-progress2">
            <span class="mp-time">${fmtTime(position)}</span>
            <div class="mp-progress-track"><div class="mp-progress-fill" style="width:${progressPct}%"></div></div>
            <span class="mp-time">${fmtTime(duration)}</span>
          </div>` : ''}
          <div class="mp-controls2">
            ${hasShuffle ? `<button class="mp-btn-sm ${attrs.shuffle ? 'active' : ''}" data-act="shuffle" ${dis}>${ICONS.shuffle}</button>` : '<span class="mp-btn-spacer"></span>'}
            <button class="mp-btn-md" data-act="prev" ${dis}>${ICONS.skipPrev}</button>
            <button class="mp-btn-lg" data-act="playpause" ${dis}>${isPlaying ? ICONS.pause : ICONS.play}</button>
            <button class="mp-btn-md" data-act="next" ${dis}>${ICONS.skipNext}</button>
            ${hasRepeat ? `<button class="mp-btn-sm ${attrs.repeat !== 'off' ? 'active' : ''}" data-act="repeat" ${dis}>${attrs.repeat === 'one' ? ICONS.repeatOne : ICONS.repeat}</button>` : '<span class="mp-btn-spacer"></span>'}
          </div>
          ${volume !== null ? `
          <div class="mp-volume2">
            <span class="mp-vol-icon" data-act="mute" ${dis}>${isMuted ? ICONS.volumeMute : ICONS.volume}</span>
            <input type="range" min="0" max="100" value="${volume}" data-act="volume" ${dis}>
          </div>` : ''}
          ${showSource ? `
          <select class="mp-source" data-act="source" ${dis}>
            ${sourceList.map(s => `<option value="${s}" ${s === attrs.source ? 'selected' : ''}>${s}</option>`).join('')}
          </select>` : ''}
        </div>`;
      if (!editable && cb.onMediaControl) {
        const act = (name, handler) => { const el = card.querySelector(`[data-act="${name}"]`); if (el) el.addEventListener('click', e => { e.stopPropagation(); handler(); }); };
        act('prev', () => cb.onMediaControl(entity_id, 'media_previous_track'));
        act('next', () => cb.onMediaControl(entity_id, 'media_next_track'));
        act('playpause', () => cb.onMediaControl(entity_id, isPlaying ? 'media_pause' : 'media_play'));
        act('shuffle', () => cb.onMediaControl(entity_id, 'shuffle_set', { shuffle: !attrs.shuffle }));
        act('power', () => cb.onMediaControl(entity_id, isOff ? 'turn_on' : 'turn_off'));
        act('repeat', () => {
          const next = attrs.repeat === 'off' ? 'all' : attrs.repeat === 'all' ? 'one' : 'off';
          cb.onMediaControl(entity_id, 'repeat_set', { repeat: next });
        });
        act('mute', () => cb.onMediaControl(entity_id, 'volume_mute', { is_volume_muted: !isMuted }));
        const volSlider = card.querySelector('[data-act="volume"]');
        if (volSlider) {
          volSlider.addEventListener('click', e => e.stopPropagation());
          volSlider.addEventListener('change', () => cb.onMediaControl(entity_id, 'volume_set', { volume_level: parseInt(volSlider.value, 10) / 100 }));
        }
        const sourceSelect = card.querySelector('[data-act="source"]');
        if (sourceSelect) {
          sourceSelect.addEventListener('click', e => e.stopPropagation());
          sourceSelect.addEventListener('change', () => cb.onMediaControl(entity_id, 'select_source', { source: sourceSelect.value }));
        }
      }
    } else if (type === 'lock') {
      const s = state ? state.state : '';
      const isLocked = s === 'locked';
      const busy = s === 'locking' || s === 'unlocking';
      const label = { locked: 'Verriegelt', unlocked: 'Entriegelt', locking: 'Verriegelt…', unlocking: 'Entriegelt…', jammed: 'Blockiert' }[s] || (s || '–');
      card.innerHTML = `<span class="icon">${isLocked ? ICONS.lockClosed : ICONS.lockOpen}</span><span class="name">${name}</span><span class="badge">${label}</span>`;
      if (!editable && !busy && cb.onLockToggle) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => cb.onLockToggle(entity_id, s));
      }
    } else if (type === 'fan') {
      const isOn = state && state.state === 'on';
      const pct = attrs.percentage !== undefined && attrs.percentage !== null ? attrs.percentage : (isOn ? 100 : 0);
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.fan}</span><span class="badge">${isOn ? 'AN' : 'AUS'}</span></div>
        <div class="name">${name}</div>
        <div class="value">${isOn ? pct + '%' : '–'}</div>
        <div class="controls slider-row">
          <button data-act="toggle" ${dis}>⏻</button>
          <input type="range" min="0" max="100" step="10" value="${pct}" data-act="slider" ${dis}>
        </div>`;
      if (!editable) {
        const slider = card.querySelector('[data-act="slider"]');
        if (cb.onFanSpeed) slider.addEventListener('change', () => cb.onFanSpeed(entity_id, parseInt(slider.value, 10)));
        if (cb.onToggle) card.querySelector('[data-act="toggle"]').addEventListener('click', () => cb.onToggle('fan', entity_id, state ? state.state : 'off'));
      }
    } else if (type === 'vacuum') {
      const s = state ? state.state : 'docked';
      const isCleaning = s === 'cleaning';
      const label = { docked: 'Docke', cleaning: 'Reinigt', paused: 'Pausiert', returning: 'Fährt zur Basis', idle: 'Bereit', error: 'Fehler' }[s] || s;
      const battery = attrs.battery_level !== undefined ? attrs.battery_level + '%' : '';
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.vacuum}</span></div>
        <div class="name">${name}</div>
        <div class="value" style="font-size:clamp(1vh,7cqmin,1.8vh);">${label}${battery ? ' · ' + battery : ''}</div>
        <div class="controls" style="display:flex; gap:0.6vh; margin-top:0.4vh;">
          <button data-act="startpause" ${dis}>${isCleaning ? ICONS.pause : ICONS.play}</button>
          <button data-act="dock" ${dis}>${ICONS.dockIcon}</button>
        </div>`;
      if (!editable && cb.onVacuumControl) {
        const spBtn = card.querySelector('[data-act="startpause"]');
        const dockBtn = card.querySelector('[data-act="dock"]');
        if (spBtn) spBtn.addEventListener('click', e => { e.stopPropagation(); cb.onVacuumControl(entity_id, isCleaning ? 'pause' : 'start'); });
        if (dockBtn) dockBtn.addEventListener('click', e => { e.stopPropagation(); cb.onVacuumControl(entity_id, 'return_to_base'); });
      }
    } else if (type === 'humidity') {
      const unit = (settings.suffix !== undefined && settings.suffix !== '') ? settings.suffix : '%';
      const val = state ? state.state : '–';
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.humidity}</span></div>
        <div class="name">${name}</div>
        <div class="value">${fmt(val, unit)}</div>`;
    } else if (type === 'alarm') {
      const s = state ? state.state : 'disarmed';
      const isArmed = s.startsWith('armed');
      const label = { disarmed: 'Unscharf', armed_home: 'Scharf (Zuhause)', armed_away: 'Scharf (Abwesend)', armed_night: 'Scharf (Nacht)', pending: 'Ausstehend…', triggered: 'ALARM!', arming: 'Aktiviert…' }[s] || s;
      card.innerHTML = `
        <div class="row"><span class="icon">${isArmed ? ICONS.shield : ICONS.shieldOff}</span></div>
        <div class="name">${name}</div>
        <div class="value" style="font-size:clamp(1vh,7cqmin,1.8vh); ${s === 'triggered' ? 'color:#ef4444;' : ''}">${label}</div>
        <div class="controls" style="display:flex; gap:0.5vh; margin-top:0.4vh; flex-wrap:wrap;">
          <button data-act="home" ${dis} style="flex:1; font-size:1.1vh;">Zuhause</button>
          <button data-act="away" ${dis} style="flex:1; font-size:1.1vh;">Abwesend</button>
          <button data-act="disarm" ${dis} style="flex:1; font-size:1.1vh;">Unscharf</button>
        </div>`;
      if (!editable && cb.onAlarmControl) {
        const act = (n, svc) => { const el = card.querySelector(`[data-act="${n}"]`); if (el) el.addEventListener('click', e => { e.stopPropagation(); cb.onAlarmControl(entity_id, svc); }); };
        act('home', 'alarm_arm_home');
        act('away', 'alarm_arm_away');
        act('disarm', 'alarm_disarm');
      }
    } else if (type === 'waste') {
      const events = (opts.waste || []).slice(0, 4);
      const next = events[0];
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.trash}</span><span class="name">${name}</span></div>
        ${next ? `
          <div class="waste-next">
            <span class="waste-dot" style="background:${wasteColor(next.summary)}"></span>
            <div>
              <div class="waste-next-title">${next.summary}</div>
              <div class="waste-next-date">${wasteDateLabel(next.start)}</div>
            </div>
          </div>
          <div class="waste-list">
            ${events.slice(1).map(e => `
              <div class="waste-item">
                <span class="waste-dot" style="background:${wasteColor(e.summary)}"></span>
                <span class="waste-item-title">${e.summary}</span>
                <span class="waste-item-date">${wasteDateLabel(e.start)}</span>
              </div>`).join('')}
          </div>` : `<div class="graph-empty">${opts.wasteError || 'Keine Termine gefunden'}</div>`}`;
    } else if (type === 'photo') {
      const base = opts.apiBase || '';
      const cardId = entity_id; // z.B. "photo:1712345678" -- eindeutig pro Karte
      const pictureUrl = opts.photoVersion
        ? `${base}/api/photo-card/${encodeURIComponent(cardId)}/background?v=${opts.photoVersion}`
        : '';
      card.classList.add('photo-card');
      if (pictureUrl) {
        card.style.backgroundImage = `url('${pictureUrl}')`;
      }
      if (settings.name) {
        card.innerHTML = `<div class="photo-card-label">${settings.name}</div>`;
      } else if (!pictureUrl) {
        card.innerHTML = `<div class="photo-card-empty">Kein Bild – in den Karten-Einstellungen hochladen</div>`;
      }
    } else if (type === 'quicktiles') {
      const tiles = Array.isArray(settings.tiles) ? settings.tiles : [];
      const statesById = opts.statesById || {};
      card.classList.add('quicktiles-card');
      card.innerHTML = `
        ${settings.name ? `<div class="qt-title">${settings.name}</div>` : ''}
        <div class="qt-row">
          ${tiles.map(t => {
            const st = statesById[t.mediaPlayerEntity];
            const isActive = !!(st && st.state === 'playing' && st.attributes && st.attributes.source === t.source);
            const bg = t.imageDataUrl ? ` style="background-image:url('${t.imageDataUrl}')"` : '';
            return `<button class="qt-tile ${isActive ? 'active' : ''}" data-tile-id="${t.id}" ${dis}${bg}>
              ${!t.imageDataUrl ? `<span class="qt-tile-label">${t.label || t.source || '?'}</span>` : ''}
            </button>`;
          }).join('')}
          ${!tiles.length ? `<div class="graph-empty">Noch keine Kacheln – in den Karten-Einstellungen hinzufügen</div>` : ''}
        </div>`;
      if (!editable && cb.onQuickTile) {
        tiles.forEach(t => {
          const el = card.querySelector(`[data-tile-id="${t.id}"]`);
          if (el) el.addEventListener('click', e => { e.stopPropagation(); cb.onQuickTile(t.mediaPlayerEntity, t.source); });
        });
      }
    } else if (type === 'select') {
      const options = attrs.options || [];
      const current = state ? state.state : '';
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.select}</span></div>
        <div class="name">${name}</div>
        <select class="select-input" ${dis}>
          ${options.map(o => `<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`).join('')}
        </select>`;
      if (!editable && cb.onSelectOption) {
        const sel = card.querySelector('.select-input');
        sel.addEventListener('click', e => e.stopPropagation());
        sel.addEventListener('change', () => cb.onSelectOption(domain, entity_id, sel.value));
      }
    } else if (type === 'navigate') {
      const targetName = settings.targetDashboardName || 'Dashboard';
      card.innerHTML = `<span class="icon">${ICONS.navigate}</span><span class="name">${targetName}</span>`;
      if (!editable && cb.onNavigate && settings.targetDashboardId) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => cb.onNavigate(settings.targetDashboardId));
      }
    } else if (type === 'forecast') {
      const isHourly = settings.forecastType === 'hourly';
      const days = (opts.forecast || []).slice(0, isHourly ? 6 : 5);
      const dayFmt = d => {
        const dt = new Date(d.datetime || d.date || d);
        return isHourly ? dt.toLocaleTimeString('de-DE', { hour: '2-digit' }) : dt.toLocaleDateString('de-DE', { weekday: 'short' });
      };
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS.forecast}</span><span class="name">${name}</span></div>
        <div class="forecast-row">
          ${days.length ? days.map(d => `
            <div class="forecast-day">
              <div class="fc-label">${dayFmt(d)}</div>
              <span class="fc-icon">${ICONS[conditionIcon(d.condition)] || ICONS.cloudy}</span>
              <div class="fc-temps"><span class="fc-hi">${d.temperature !== undefined ? Math.round(d.temperature) + '°' : '–'}</span>${d.templow !== undefined ? `<span class="fc-lo">${Math.round(d.templow)}°</span>` : ''}</div>
            </div>`).join('') : `<div class="graph-empty">${opts.forecastError || 'Keine Vorhersagedaten'}</div>`}
        </div>`;
    } else {
      // sensor / Fallback -- Wert ist primaer (gross), Name nur kleine Bildunterschrift
      const val = state ? state.state : '–';
      const unit = (settings.suffix !== undefined && settings.suffix !== '') ? settings.suffix : attrs.unit_of_measurement;
      card.innerHTML = `
        <div class="row"><span class="icon">${ICONS[domain] || ICONS.sensor}</span></div>
        <div class="name">${name}</div>
        <div class="value">${fmt(val, unit)}</div>`;
    }

    if (editable) {
      card.classList.add('editable');

      const handle = document.createElement('div');
      handle.className = 'drag-handle';
      handle.textContent = '⋮⋮';
      handle.draggable = false;
      card.appendChild(handle);

      if (opts.freeMove) {
        // Screensaver: Griff verschiebt die Karte frei auf feste x/y-Positionen statt
        // sie in eine Liste einzusortieren -- Position bleibt danach fix liegen.
        card.draggable = false;
        handle.style.cursor = 'grab';
        if (cb.onMoveStart) {
          handle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            cb.onMoveStart(entity_id, card, e);
          });
        }
      } else {
        card.draggable = true;
      }

      const removeBtn = document.createElement('div');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => { e.stopPropagation(); if (cb.onRemove) cb.onRemove(entity_id); });
      card.appendChild(removeBtn);

      const settingsBtn = document.createElement('div');
      settingsBtn.className = 'settings-btn';
      settingsBtn.innerHTML = ICONS.settings;
      settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); if (cb.onOpenSettings) cb.onOpenSettings(entity_id); });
      card.appendChild(settingsBtn);

      if (type !== 'clock' && type !== 'navigate' && type !== 'energy') {
        const copyBtn = document.createElement('div');
        copyBtn.className = 'copy-btn';
        copyBtn.innerHTML = ICONS.copy;
        copyBtn.title = 'Karte kopieren';
        copyBtn.addEventListener('click', (e) => { e.stopPropagation(); if (cb.onDuplicate) cb.onDuplicate(entity_id); });
        card.appendChild(copyBtn);
      }

      const editBar = document.createElement('div');
      editBar.className = 'edit-bar';

      const types = typesForEntity(entity_id);
      if (types.length > 1) {
        const select = document.createElement('select');
        select.className = 'type-select';
        types.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = (CARD_TYPES[t] || {}).label || t;
          opt.selected = t === type;
          select.appendChild(opt);
        });
        select.addEventListener('click', e => e.stopPropagation());
        select.addEventListener('change', () => { if (cb.onChangeType) cb.onChangeType(entity_id, select.value); });
        editBar.appendChild(select);
      }
      card.appendChild(editBar);

      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.draggable = false;
      resizeHandle.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M22 22H16M22 22V16M22 22L14 14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
      card.appendChild(resizeHandle);
      if (cb.onResizeStart) {
        resizeHandle.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          cb.onResizeStart(entity_id, card, e);
        });
      }
    }

    return card;
  }

  // Wendet ein importiertes Design (siehe /setup/design-import.html) als CSS-Variablen auf
  // :root an -- ueberschreibt Farben UND Formen/Abstaende. theme=null setzt alles wieder auf
  // die eingebauten Standardwerte aus dashboard.css zurueck (per removeProperty).
  const CUSTOM_THEME_VARS = {
    dark: { bg: '--bg', surface: '--surface', panel2: '--panel2', cardBorder: '--card-border', text: '--text', muted: '--muted' },
    light: { bg: '--bg', surface: '--surface', panel2: '--panel2', cardBorder: '--card-border', text: '--text', muted: '--muted' }
  };
  function applyCustomTheme(theme) {
    const sheetId = 'hawall-custom-theme';
    const existing = document.getElementById(sheetId);
    if (existing) existing.remove();
    if (!theme) return;
    const toCss = (obj, selector) => {
      const decls = Object.entries(CUSTOM_THEME_VARS.dark).map(([k, v]) => obj[k] ? `${v}: ${obj[k]};` : '').join(' ');
      return `${selector} { ${decls} }`;
    };
    const styleEl = document.createElement('style');
    styleEl.id = sheetId;
    let css = toCss(theme.dark || {}, ':root');
    css += ' ' + toCss(theme.light || {}, 'body.light-theme');
    if (theme.cardRadius) css += ` .card, .wizard { border-radius: ${theme.cardRadius} !important; }`;
    if (theme.cardShadow) css += ` .card { box-shadow: ${theme.cardShadow} !important; }`;
    // Glas-Effekt: Weichzeichner + Saettigungs-Boost hinter der Karte (das "Milchglas"-Gefuehl),
    // optionale Lichtkante oben/links (Specular Highlight) -- alles einzeln optional, ein
    // Design kann nur Farben setzen und den Rest weglassen.
    if (theme.cardBlur) {
      const sat = theme.cardSaturate || '100%';
      css += ` :root { --card-blur: blur(${theme.cardBlur}) saturate(${sat}); }`;
    }
    if (theme.cardHighlight) css += ` :root { --card-highlight: ${theme.cardHighlight}; }`;
    if (theme.cardHighlightSide) css += ` :root { --card-highlight-side: ${theme.cardHighlightSide}; }`;
    // Seitenhintergrund: Bild und/oder Verlauf hinter allem -- Glas-Effekte wirken erst richtig,
    // wenn dahinter etwas Farbiges zum Durchscheinen liegt statt eines flachen Einheitstons.
    if (theme.pageBgImage) css += ` :root { --page-bg-image: url('${theme.pageBgImage}'); }`;
    if (theme.pageBgGradient) css += ` body { background: ${theme.pageBgGradient}; }`;
    // Escape Hatch fuer alles, was die strukturierten Felder oben nicht abdecken -- macht das
    // Design-Import-System generell "komplexeres Design"-faehig statt nur die vordefinierten
    // Stellschrauben zu erlauben. Wird roh als CSS angehaengt (letztes Wort, ueberschreibt alles).
    if (theme.extraCss) css += ` ${theme.extraCss}`;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  global.DashboardRender = {
    ICONS, DOMAIN_LABEL, CARD_TYPES, TOGGLE_DOMAINS, PRESS_DOMAINS,
    defaultCardType, allowedCardTypes, defaultSize, buildCard,
    sizeToSpan, minSpanFor, clampSpan, resolveSpan, thresholdColor,
    domainsForType, typesForEntity, renderClockNow, canOverlayOnPhoto, applyCustomTheme
  };
})(window);
