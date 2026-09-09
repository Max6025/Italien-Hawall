// Kalender-Abruf gegen die Home-Assistant-REST-API.
//
// Dieses Modul kennt weder Bildschirme noch Zeitpläne -- es beantwortet genau eine Frage:
// "Welche Anzeigefenster ergeben sich aus dem Kalender?" Die Entscheidung, was mit diesen
// Fenstern passiert, trifft der Controller.
//
// Warum Abrufen statt Benachrichtigen: siehe docs/adr/0002-kalender-abrufen-statt-benachrichtigen.md

const MS_PER_MINUTE = 60 * 1000;

// Die REST-Route lautet /api/calendars/<entity_id>?start=&end= -- ohne "/events"-Suffix.
function eventsUrl(haUrl, entity, from, to) {
  const base = String(haUrl || '').replace(/\/+$/, '');
  const q = `start=${encodeURIComponent(from.toISOString())}&end=${encodeURIComponent(to.toISOString())}`;
  return `${base}/api/calendars/${encodeURIComponent(entity)}?${q}`;
}

function parseKeywords(raw) {
  return String(raw || '')
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);
}

// Ein Treffer ist ein Eintrag, dessen TITEL eines der Keywords enthält. Die Beschreibung wird
// bewusst nie durchsucht: dort landen Notizen, in denen das Wort zufällig vorkommt.
function isMatch(event, keywords) {
  const title = String((event && event.summary) || '').toLowerCase();
  if (!title) return false;
  return keywords.some(k => title.includes(k));
}

// Ganztages-Einträge liefert Home Assistant als { date: "2026-06-03" } -- und das Enddatum ist
// AUSSCHLIESSEND. Ein Termin vom 3. bis 7. Juni hat also end.date = "2026-06-08". Wer das
// übersieht, schaltet das Panel einen Tag zu früh ab.
function toDate(part) {
  if (!part) return null;
  if (part.dateTime) {
    const d = new Date(part.dateTime);
    return isNaN(d.getTime()) ? null : d;
  }
  if (part.date) {
    // Als lokale Mitternacht lesen, nicht als UTC -- sonst verschiebt sich der Tag je Zeitzone.
    const [y, m, d] = String(part.date).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return null;
}

// Wandelt einen Treffer in ein Anzeigefenster: Start und Ende, verschoben um Vorlauf/Nachlauf.
function toWindow(event, leadMinutes, trailMinutes) {
  const start = toDate(event.start);
  const end = toDate(event.end);
  if (!start || !end || end <= start) return null;
  return {
    title: String(event.summary || '').trim(),
    start: new Date(start.getTime() - leadMinutes * MS_PER_MINUTE),
    end: new Date(end.getTime() + trailMinutes * MS_PER_MINUTE)
  };
}

/**
 * Holt die Anzeigefenster für den angegebenen Zeitraum.
 *
 * Wirft bei Netzwerk- oder HTTP-Fehlern -- der Aufrufer entscheidet, was ein Fehler bedeutet.
 * Dieses Modul gibt niemals stillschweigend eine leere Liste zurück, wenn der Abruf scheiterte:
 * "keine Termine" und "nicht erreichbar" dürfen nicht dasselbe Ergebnis liefern, sonst schaltet
 * ein Netzausfall das Panel ab.
 */
async function fetchWindows(cfg, options = {}) {
  const { haUrl, token, entity, keywords, leadMinutes = 0, trailMinutes = 0 } = cfg;
  if (!haUrl || !token || !entity) throw new Error('Kalender ist nicht vollständig konfiguriert');

  const words = parseKeywords(keywords);
  if (!words.length) return [];

  const now = options.now || new Date();
  // Fenster großzügig wählen: 2 Tage zurück fängt laufende mehrtägige Termine ein,
  // 30 Tage voraus reicht für die Statusanzeige "nächster Treffer".
  const from = new Date(now.getTime() - 2 * 24 * 60 * MS_PER_MINUTE);
  const to = new Date(now.getTime() + 30 * 24 * 60 * MS_PER_MINUTE);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  let res;
  try {
    res = await fetch(eventsUrl(haUrl, entity, from, to), {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Home Assistant antwortete mit HTTP ${res.status}`);
  }
  const events = await res.json();
  if (!Array.isArray(events)) throw new Error('Unerwartete Antwort von Home Assistant');

  return events
    .filter(e => isMatch(e, words))
    .map(e => toWindow(e, Number(leadMinutes) || 0, Number(trailMinutes) || 0))
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

function activeWindow(windows, now = new Date()) {
  return (windows || []).find(w => now >= w.start && now < w.end) || null;
}

function nextWindow(windows, now = new Date()) {
  return (windows || []).find(w => w.start > now) || null;
}

module.exports = { fetchWindows, activeWindow, nextWindow, parseKeywords, isMatch, toDate, toWindow };
