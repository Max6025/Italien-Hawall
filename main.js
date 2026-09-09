const { app, BrowserWindow, globalShortcut, ipcMain, screen, session } = require('electron');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const { startServer } = require('./server/setup-server');
const { Controller } = require('./control/controller');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const store = new Store({ name: 'config' });
// Bewusst ein anderer Port als bei HA Wall Display (8787), damit beide Anwendungen auf
// demselben Gerät nebeneinander laufen können -- siehe docs/adr/0001-...
const SETUP_PORT = 8788;

let controller = null;

// Erkennt, ob dieser Start direkt auf ein Update folgt (Version hat sich seit dem letzten
// bekannten Start geaendert) -- dann wird nach dem Start kurz eine Erfolgs-Anzeige gezeigt,
// statt sofort ins normale Dashboard zu springen.
const lastKnownVersion = store.get('lastKnownVersion');
const currentVersion = app.getVersion();
const isPostUpdateLaunch = !!lastKnownVersion && lastKnownVersion !== currentVersion;
store.set('lastKnownVersion', currentVersion);

let mainWindow = null;
let updateState = { checking: false, available: false, downloaded: false, version: null, progress: 0, error: null };

// GitHub wird ausschliesslich auf ausdruecklichen Wunsch gefragt: kein Abruf beim Start, kein
// Intervall im Hintergrund. Ausgeloest wird eine Suche nur ueber "Nach Updates suchen" in der
// Einrichtungsoberflaeche. autoDownload darf deshalb an bleiben -- es greift erst nach einer
// Suche, und eine Suche gibt es nur auf Knopfdruck.
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;

// Ein Druck genuegt: suchen, laden und installieren laufen ohne weitere Rueckfrage durch.
// Auch dann, wenn gerade ein Anzeigefenster laeuft -- die Unterbrechung ist gewollt in Kauf
// genommen, weil der Anstoss vom Nutzer selbst kam.
let installWhenDownloaded = false;

autoUpdater.on('checking-for-update', () => {
  updateState = { ...updateState, checking: true, error: null };
});
autoUpdater.on('update-available', (info) => {
  updateState = { ...updateState, checking: false, available: true, version: info.version };
});
autoUpdater.on('update-not-available', () => {
  updateState = { ...updateState, checking: false, available: false, downloaded: false };
});
autoUpdater.on('download-progress', (p) => {
  updateState = { ...updateState, progress: Math.round(p.percent) };
});
autoUpdater.on('update-downloaded', (info) => {
  updateState = { ...updateState, checking: false, downloaded: true, version: info.version, progress: 100 };
  if (installWhenDownloaded) {
    installWhenDownloaded = false;
    updater.install();
  }
});
autoUpdater.on('error', (err) => {
  updateState = { ...updateState, checking: false, error: String((err && err.message) || err) };
});

const updater = {
  currentVersion: app.getVersion(),
  getState: () => updateState,
  // autoInstall: bei true wird nach dem Herunterladen sofort installiert (der Ein-Klick-Weg
  // aus der Einrichtungsoberflaeche).
  check: (autoInstall = false) => {
    installWhenDownloaded = !!autoInstall;
    return autoUpdater.checkForUpdates().catch(err => {
      installWhenDownloaded = false;
      updateState = { ...updateState, checking: false, error: String(err.message || err) };
    });
  },
  install: () => {
    if (!updateState.downloaded) return;
    // Update-Bildschirm auf dem Wall Display zeigen, dann still (ohne Assistent,
    // ohne Admin-Abfrage -- perMachine:false + Silent-Flag) installieren und neu starten.
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, 'renderer', 'updating.html')).catch(() => {});
    }
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true); // isSilent, isForceRunAfter
    }, 1200);
  }
};

function getLocalIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

function hasConfig() {
  return !!(store.get('haUrl') && store.get('token'));
}

// Erzwingt Querformat-Darstellung: falls Windows den Bildschirm dreht (z.B. Surface Go 2
// Rotationssensor), wird der Seiteninhalt per CSS gegengedreht, damit die App immer wie im
// Querformat aussieht -- ein echtes OS-Rotationssperren gibt es unter Windows fuer normale
// Anwendungen nicht, das hier ist die praktikable Kompensation auf App-Ebene.
let insertedCssKey = null;
async function applyOrientationLock() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const angle = display.rotation || 0; // 0, 90, 180, 270

  try {
    if (insertedCssKey) {
      await mainWindow.webContents.removeInsertedCSS(insertedCssKey).catch(() => {});
      insertedCssKey = null;
    }
    if (angle === 0) return;

    const { width, height } = display.size;
    const compensate = (360 - angle) % 360;
    let css = `html { transform: rotate(${compensate}deg); transform-origin: center center; }`;
    if (angle === 90 || angle === 270) {
      css += `html { position: fixed; top: 50%; left: 50%; width: ${height}px; height: ${width}px;
        margin-top: -${width / 2}px; margin-left: -${height / 2}px; }`;
    }
    insertedCssKey = await mainWindow.webContents.insertCSS(css);
  } catch (e) {
    // Bildschirmwechsel wird nicht als kritisch behandelt
  }
}

function createWindow() {
  // Kamera-Zugriff automatisch erlauben -- wird ausschliesslich lokal fuer die
  // Annaeherungserkennung genutzt (Frame-Differenz im Renderer), es wird nichts
  // gespeichert oder irgendwohin uebertragen. Ohne diesen Handler wuerde Electron
  // im Kiosk-Modus (kein sichtbarer Berechtigungsdialog moeglich) den Zugriff blockieren.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media');
  });

  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    frame: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Nach einem Update: der Ladekreis ("Update wird installiert") laeuft nahtlos weiter,
  // auch waehrend/nach dem Neustart -- kein Sprung ins Leere. Erst wenn die App wirklich
  // wieder laeuft, wird kurz "Erfolgreich auf Version X aktualisiert" gezeigt, danach geht
  // es automatisch zur normalen Ansicht (update-success.html ruft dafuer reloadView() auf).
  if (isPostUpdateLaunch) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'updating.html'));
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.loadFile(path.join(__dirname, 'renderer', 'update-success.html'), {
        search: `version=${encodeURIComponent(currentVersion)}`
      });
    }, 1800); // kurze Ueberbrueckung, bis der lokale Server & alles bereit ist
  } else {
    loadCurrentView();
  }

  mainWindow.webContents.on('did-finish-load', applyOrientationLock);

  // Wartungs-Shortcut: Kiosk verlassen / App beenden fuer Vor-Ort-Wartung
  globalShortcut.register('Control+Alt+Q', () => {
    app.quit();
  });

  // Not-Ausstieg aus der Kalendersteuerung: pausiert den Waechter, damit das Panel bedienbar
  // bleibt. Einer von drei Wegen -- die anderen beiden sind die Tipp-Geste in der oberen linken
  // Ecke des Dashboards und der Schalter in der Setup-Oberflaeche. Ein Geraet, das sich selbst
  // abschalten kann, braucht mehr als einen Ausweg, und eine Tastenkombination hilft auf einem
  // Touch-Panel ohne Tastatur nicht weiter.
  globalShortcut.register('Control+Alt+W', () => {
    if (controller) controller.pause();
  });
}

function loadCurrentView() {
  if (!mainWindow) return;
  if (hasConfig()) {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'dashboard.html'), {
      search: `port=${SETUP_PORT}`
    });
  } else {
    const ips = getLocalIps();
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'waiting.html'), {
      search: `ips=${encodeURIComponent(ips.join(','))}&port=${SETUP_PORT}`
    });
  }
}

// Wird vom lokalen Setup-Server aufgerufen, sobald eine Konfiguration gespeichert wurde
function onConfigSaved() {
  loadCurrentView();
}

// Sperrt Windows-eigene Rand-Wischgesten (Action Center, Task-Ansicht, Widgets, Taskleiste-
// Reveal), die auf einem Touch-Geraet sonst VOR unserer App zugreifen und die Geste komplett
// schlucken -- das ist derselbe Grund, warum eigene Wisch-Gesten im Dashboard nicht ankommen.
// Registry-Aenderungen, nur fuer den aktuellen Benutzer (HKCU), best-effort/still bei Fehlern
// (z.B. auf Nicht-Windows-Systemen zum Testen). Laeuft nur EINMAL (siehe Store-Flag), danach
// wird der Explorer-Prozess einmalig neu gestartet, damit es sofort greift.
function applyWindowsKioskLockdown() {
  if (process.platform !== 'win32') return;
  if (store.get('kioskLockdownApplied')) return;
  const cmds = [
    'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\EdgeUI" /v AllowEdgeSwipe /t REG_DWORD /d 0 /f',
    'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ImmersiveShell\\EdgeUi" /v DisableTLcorner /t REG_DWORD /d 1 /f',
    'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ImmersiveShell\\EdgeUi" /v DisableTRcorner /t REG_DWORD /d 1 /f',
    'reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v DisableNotificationCenter /t REG_DWORD /d 1 /f',
    'reg add "HKCU\\Software\\Policies\\Microsoft\\Dsh" /v AllowNewsAndInterests /t REG_DWORD /d 0 /f',
    'reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarDa /t REG_DWORD /d 0 /f'
  ];
  const runAll = cmds.map(c => new Promise(resolve => exec(c, { timeout: 5000 }, () => resolve())));
  Promise.all(runAll).then(() => {
    store.set('kioskLockdownApplied', true);
    // Explorer neu starten, damit die Aenderungen sofort ohne Geraete-Neustart greifen
    exec('taskkill /f /im explorer.exe', { timeout: 5000 }, () => {
      exec('start explorer.exe', { timeout: 5000 }, () => {});
    });
  });
}

// Schiebt den aktuellen Steuerungszustand an die geladene Seite. Das Dashboard blendet daraus
// die Fehlerseite ein bzw. aus -- ein Seitenwechsel wuerde das Dashboard neu laden und dabei
// jedes Mal alle Home-Assistant-Daten neu holen.
function pushControlState(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('control-state', state);
  }
}

app.whenReady().then(() => {
  createWindow();

  controller = new Controller({
    store,
    logDir: app.getPath('userData'),
    onStateChange: pushControlState
  });
  controller.start();

  startServer({ port: SETUP_PORT, store, onConfigSaved, getLocalIps, updater, controller });
  applyWindowsKioskLockdown();

  // Auto-Start bei Windows-Anmeldung aktivieren
  app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });

  // Bewusst KEIN updater.check() hier: GitHub wird nur auf Knopfdruck gefragt.

  screen.on('display-metrics-changed', (event, display, changedMetrics) => {
    if (changedMetrics.includes('rotation') || changedMetrics.includes('bounds')) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setBounds(screen.getPrimaryDisplay().bounds);
      }
      applyOrientationLock();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (controller) controller.stop();
});

ipcMain.handle('reload-view', () => loadCurrentView());

// Die Tipp-Geste im Dashboard (fuenfmal in die obere linke Ecke) landet hier.
ipcMain.handle('pause-panel-control', (event, minutes) => {
  if (!controller) return { ok: false };
  return { ok: true, pausedUntil: controller.pause(minutes) };
});

ipcMain.handle('get-control-state', () => (controller ? controller.getState() : null));

// Bildschirmhelligkeit ueber Windows WMI regeln (funktioniert fuer eingebaute Displays wie
// beim Surface Go 2, die DDC/CI bzw. WmiMonitorBrightnessMethods unterstuetzen). Wird fuer
// den Nachtmodus genutzt, um die Helligkeit zusaetzlich zum schwarzen Bildschirm zu senken.
// Schlaegt auf nicht unterstuetzter Hardware oder Nicht-Windows-Systemen einfach still fehl --
// das schwarze Overlay allein reicht dann weiterhin als Nachtmodus-Effekt aus.
ipcMain.handle('set-brightness', (event, percent) => {
  if (process.platform !== 'win32') return Promise.resolve({ ok: false });
  const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const cmd = `powershell -NoProfile -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${value})"`;
  return new Promise((resolve) => {
    exec(cmd, { timeout: 5000 }, (err) => {
      resolve({ ok: !err });
    });
  });
});
