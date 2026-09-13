// Erzeugt renderer/shared/mdi-pfade.js aus @mdi/js.
//
// Home Assistant gibt das Symbol einer Entität nur als NAMEN zurück ("mdi:weather-sunny"), nie
// als Zeichnung. Wer den Namen anzeigen will, braucht die Zeichnung -- und die liegt in
// @mdi/js. Das Paket selbst ist eine Entwicklungsabhängigkeit und wird NICHT mitgeliefert;
// hier entsteht daraus eine einzige Datei mit `name -> Pfad`, die im Repo liegt.
//
// Warum nicht zur Laufzeit aus dem Paket lesen: Der Renderer hat kein `require` (nodeIntegration
// ist aus, und das soll so bleiben). Warum nicht von einem CDN: Ein Wandpanel muss auch dann
// funktionieren, wenn das Internet weg ist -- Home Assistant steht ja im selben Haus.
//
// Aufruf:  node .scratch/karten-design/mdi-erzeugen.js

const fs = require('fs');
const path = require('path');

const mdi = require('@mdi/js');
const ZIEL = path.resolve(__dirname, '..', '..', 'renderer', 'shared', 'mdi-pfade.js');

// @mdi/js exportiert `mdiWeatherSunny`. Home Assistant schreibt `mdi:weather-sunny`.
function zuHaName(exportName) {
  return exportName
    .replace(/^mdi/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/^-/, '')
    .toLowerCase();
}

const paare = Object.keys(mdi)
  .filter(k => k.startsWith('mdi') && typeof mdi[k] === 'string')
  .map(k => [zuHaName(k), mdi[k]])
  .sort((a, b) => (a[0] < b[0] ? -1 : 1));

const inhalt = '// ERZEUGTE DATEI -- nicht von Hand ändern.\n'
  + '// Erzeugt von .scratch/karten-design/mdi-erzeugen.js aus @mdi/js ' + require('@mdi/js/package.json').version + '.\n'
  + '//\n'
  + '// Die Zeichenwege aller Material-Design-Symbole, unter den Namen, die Home Assistant\n'
  + '// verwendet ("mdi:weather-sunny" -> "weather-sunny"). Lizenz: Pictogrammers Free License,\n'
  + '// siehe node_modules/@mdi/js/LICENSE.\n'
  + '//\n'
  + '// Wird NICHT beim Start geladen, sondern erst, wenn eine Karte wirklich ein\n'
  + '// Home-Assistant-Symbol anzeigen soll -- siehe mdiSymbol() in dashboard-render.js.\n'
  + 'window.MDI_PFADE = ' + JSON.stringify(Object.fromEntries(paare)) + ';\n';

fs.writeFileSync(ZIEL, inhalt, 'utf8');
console.log('geschrieben:', ZIEL);
console.log('Symbole:', paare.length, '| Groesse:', (inhalt.length / 1024 / 1024).toFixed(2), 'MB');
