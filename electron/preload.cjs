// electron/preload.cjs
// Preload script for Electron

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('updater', {
  onStatus(callback) {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
  onProgress(callback) {
    ipcRenderer.on('update-progress', (_event, data) => callback(data));
  },
});

contextBridge.exposeInMainWorld('appInfo', {
  getVersion() {
    return ipcRenderer.invoke('get-app-version');
  },
});

contextBridge.exposeInMainWorld('electronAPI', {
  getFloor() {
    return ipcRenderer.invoke('settings:get-floor');
  },
  onFloorChanged(callback) {
    ipcRenderer.on('settings:floor-changed', (_event, floor) => {
      callback(floor);
    });
  },
});
