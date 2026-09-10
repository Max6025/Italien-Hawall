const $ = id => document.getElementById(id);

async function loadState() {
  const r = await fetch('/api/config');
  const config = await r.json();
  DashboardRender.applyCustomTheme(config.customTheme || DashboardRender.DEFAULT_THEME);
  if (config.customTheme) {
    $('currentThemeInfo').style.display = 'block';
    $('currentThemeInfo').querySelector('.result').textContent =
      'Aktuell ist ein eigenes Design aktiv' + (config.customTheme.name ? `: "${config.customTheme.name}"` : '') + '.';
    $('themeResetBtn').style.display = 'inline-block';
  } else {
    $('currentThemeInfo').style.display = 'none';
    $('themeResetBtn').style.display = 'none';
  }
}

$('themeUploadBtn').addEventListener('click', () => $('themeFileInput').click());

$('themeFileInput').addEventListener('change', async () => {
  const file = $('themeFileInput').files[0];
  if (!file) return;
  const resultEl = $('themeResult');
  resultEl.textContent = 'Lese Datei...';
  resultEl.className = 'result';
  try {
    const text = await file.text();
    let theme;
    try {
      theme = JSON.parse(text);
    } catch (e) {
      resultEl.textContent = 'Fehler: Datei ist kein gültiges JSON.';
      resultEl.className = 'result err';
      $('themeFileInput').value = '';
      return;
    }
    const r = await fetch('/api/theme/import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(theme)
    });
    const data = await r.json();
    if (data.ok) {
      resultEl.textContent = 'Design übernommen.';
      resultEl.className = 'result ok';
      await loadState();
    } else {
      resultEl.textContent = 'Fehler: ' + data.error;
      resultEl.className = 'result err';
    }
  } catch (e) {
    resultEl.textContent = 'Fehler: ' + e.message;
    resultEl.className = 'result err';
  }
  $('themeFileInput').value = '';
});

$('themeResetBtn').addEventListener('click', async () => {
  await fetch('/api/theme/reset', { method: 'POST' });
  $('themeResult').textContent = 'Auf Standard-Design zurückgesetzt.';
  $('themeResult').className = 'result ok';
  await loadState();
});

loadState();
