const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wallApi', {
  reloadView: () => ipcRenderer.invoke('reload-view'),
  setBrightness: (percent) => ipcRenderer.invoke('set-brightness', percent),
  // Kalendersteuerung: Zustand abfragen, Zustandswechsel abonnieren, Pause ausloesen.
  getControlState: () => ipcRenderer.invoke('get-control-state'),
  pausePanelControl: (minutes) => ipcRenderer.invoke('pause-panel-control', minutes),
  onControlState: (callback) => {
    const handler = (event, state) => callback(state);
    ipcRenderer.on('control-state', handler);
    return () => ipcRenderer.removeListener('control-state', handler);
  }
});
