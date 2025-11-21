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
  getLocationIconSettings() {
    return ipcRenderer.invoke('get-location-icon-settings');
  },
  saveLocationIconSettings(settings) {
    return ipcRenderer.invoke('save-location-icon-settings', settings);
  },
  onLocationIconSettingsUpdated(callback) {
    const listener = (_event, updated) => callback(updated);
    ipcRenderer.on('location-icon-settings-updated', listener);

    return () => {
      ipcRenderer.removeListener('location-icon-settings-updated', listener);
    };
  },
  onOpenLocationIconSettings(callback) {
    const listener = () => callback();
    ipcRenderer.on('open-location-icon-settings', listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('open-location-icon-settings', listener);
    };
  },
});

contextBridge.exposeInMainWorld('wspApi', {
  getCurrentAsset() {
    return ipcRenderer.invoke('wsp:get-current-asset');
  },
  getCurrentTimeline() {
    return ipcRenderer.invoke('wsp:get-current-timeline');
  },
  getTimeline(hour) {
    return ipcRenderer.invoke('wsp:get-timeline', { hour });
  },
});
