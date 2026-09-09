const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DASHBOARD_ID = params.get('dashboard');
let iconDataUrl = null;

if (!DASHBOARD_ID) {
  document.querySelector('.wizard').innerHTML = '<p class="result err">Kein Dashboard angegeben.</p>';
} else {
  init();
}

async function init() {
  const [dashRes, entRes] = await Promise.all([
    fetch(`/api/dashboards/${DASHBOARD_ID}`).then(r => r.json()),
    fetch('/api/entities').then(r => r.json())
  ]);
  if (!dashRes.ok) {
    document.querySelector('.wizard').innerHTML = '<p class="result err">Dashboard nicht gefunden.</p>';
    return;
  }
  const dash = dashRes.dashboard;
  $('pageTitle').textContent = `Tracker einrichten – ${dash.name}`;
  $('trackerEntity').value = dash.trackerEntity || '';
  $('defaultZoom').value = dash.trackerDefaultZoom || 16;
  $('autoCenter').checked = dash.trackerAutoCenter !== false;
  $('showZones').checked = !!dash.trackerShowZones;
  iconDataUrl = dash.trackerIconDataUrl || null;
  updateIconPreview();

  const trackers = (entRes.ok ? entRes.entities : []).filter(e => e.domain === 'device_tracker' || e.domain === 'person');
  $('trackerEntityList').innerHTML = trackers.map(e => `<option value="${e.entity_id}">${e.name}</option>`).join('');

  $('iconUploadBtn').addEventListener('click', () => $('iconFileInput').click());
  $('iconFileInput').addEventListener('change', async () => {
    const file = $('iconFileInput').files[0];
    if (!file) return;
    iconDataUrl = await resizeImageFile(file, 120);
    updateIconPreview();
    $('iconFileInput').value = '';
  });
  $('iconRemoveBtn').addEventListener('click', () => {
    iconDataUrl = null;
    updateIconPreview();
  });

  $('saveBtn').addEventListener('click', async () => {
    const trackerEntity = $('trackerEntity').value.trim();
    const r = await fetch(`/api/dashboards/${DASHBOARD_ID}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackerEntity,
        trackerIconDataUrl: iconDataUrl,
        trackerDefaultZoom: parseInt($('defaultZoom').value, 10) || 16,
        trackerAutoCenter: $('autoCenter').checked,
        trackerShowZones: $('showZones').checked
      })
    });
    const data = await r.json();
    if (data.ok) {
      $('result').textContent = 'Gespeichert – wird beim nächsten Aufruf des Unterdashboards auf dem Wall Display sichtbar.';
      $('result').className = 'result ok';
    } else {
      $('result').textContent = 'Fehler: ' + data.error;
      $('result').className = 'result err';
    }
  });
}

function updateIconPreview() {
  if (iconDataUrl) {
    $('iconPreview').src = iconDataUrl;
    $('iconPreview').style.display = 'inline-block';
    $('iconNoneText').style.display = 'none';
    $('iconRemoveBtn').style.display = 'inline-block';
  } else {
    $('iconPreview').style.display = 'none';
    $('iconNoneText').style.display = 'inline';
    $('iconRemoveBtn').style.display = 'none';
  }
}

// Verkleinert ein Bild vor dem Speichern auf max. maxDim Pixel (laengste Seite), komprimiert
// als JPEG -- gleiche Logik wie an anderen Upload-Stellen im Projekt.
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
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
