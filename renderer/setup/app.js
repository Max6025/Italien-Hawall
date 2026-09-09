const $ = id => document.getElementById(id);

let haUrl = '';
let token = '';
let hadTokenAlready = false;

async function load() {
  const configRes = await fetch('/api/config').then(r => r.json()).catch(() => null);
  if (!configRes) return;
  if (configRes.haUrl) {
    $('haUrl').value = configRes.haUrl;
    haUrl = configRes.haUrl;
    $('connectedUrl').textContent = configRes.haUrl;
    $('connectionStatus').style.display = 'block';
  }
  if (configRes.title) $('title').value = configRes.title;
  hadTokenAlready = !!configRes.hasToken;
  if (hadTokenAlready) {
    $('tokenFieldWrap').style.display = 'none';
    $('newTokenBtn').style.display = 'inline-block';
    $('saveBtn').disabled = false; // Verbindung besteht bereits -- Speichern (z.B. neuer Titel) sofort moeglich
  }
}

$('newTokenBtn').addEventListener('click', () => {
  $('tokenFieldWrap').style.display = 'block';
  $('newTokenBtn').style.display = 'none';
  $('token').value = '';
  $('token').focus();
});

$('testBtn').addEventListener('click', async () => {
  haUrl = $('haUrl').value.trim();
  const tokenInput = $('token').value.trim();
  // Token-Feld ist evtl. ausgeblendet (bereits eingerichtet) -- dann alten Token behalten
  token = tokenInput || (hadTokenAlready ? '__keep__' : '');
  const resultEl = $('testResult');
  resultEl.textContent = 'Teste...';
  resultEl.className = 'result';
  try {
    const r = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ haUrl, token: tokenInput || undefined })
    });
    const data = await r.json();
    if (data.ok || (!tokenInput && hadTokenAlready)) {
      resultEl.textContent = data.ok ? 'Verbindung erfolgreich.' : 'Ungeprüft (bestehender Token wird beibehalten).';
      resultEl.className = 'result ok';
      $('saveBtn').disabled = false;
    } else {
      resultEl.textContent = 'Fehler: ' + data.error;
      resultEl.className = 'result err';
      $('saveBtn').disabled = true;
    }
  } catch (err) {
    resultEl.textContent = 'Fehler: ' + err.message;
    resultEl.className = 'result err';
  }
});

$('saveBtn').addEventListener('click', async () => {
  const resultEl = $('saveResult');
  const tokenInput = $('token').value.trim();
  const body = {
    haUrl: $('haUrl').value.trim(),
    title: $('title').value.trim() || 'Wall Display'
  };
  if (tokenInput) body.token = tokenInput; // leer lassen = bestehenden Token serverseitig behalten
  const r = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (data.ok) {
    resultEl.innerHTML = 'Gespeichert. Das Wall Display startet das Dashboard. ' +
      'Karten jetzt einrichten: <a href="editor.html">weiter</a>.';
    resultEl.className = 'result ok';
    $('tokenFieldWrap').style.display = 'none';
    $('newTokenBtn').style.display = 'inline-block';
    hadTokenAlready = true;
    $('connectedUrl').textContent = body.haUrl;
    $('connectionStatus').style.display = 'block';
  } else {
    resultEl.textContent = 'Fehler: ' + data.error;
    resultEl.className = 'result err';
  }
});

load();
