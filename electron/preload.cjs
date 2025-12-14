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
  startupWaitCompleted() {
    ipcRenderer.send('startup-wait-completed');
  },
});

contextBridge.exposeInMainWorld('appInfo', {
  getVersion() {
    return ipcRenderer.invoke('get-app-version');
  },
  getLatestVersionInfo() {
    return ipcRenderer.invoke('get-latest-version-info');
  },
});

contextBridge.exposeInMainWorld('electronAPI', {
  getBridgeBaseUrl() {
    return ipcRenderer.invoke('get-bridge-base-url');
  },
  getFloor() {
    return ipcRenderer.invoke('settings:get-floor');
  },
  setFloor(floor) {
    ipcRenderer.send('menu:set-floor', floor);
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
  getFloorLayout() {
    return ipcRenderer.invoke('settings:get-floor-layout');
  },
  saveFloorLayout(layout) {
    return ipcRenderer.invoke('settings:save-floor-layout', layout);
  },
  onFloorLayoutChanged(callback) {
    const listener = (_event, layout) => callback(layout);
    ipcRenderer.on('settings:floor-layout-changed', listener);
    return () => {
      ipcRenderer.removeListener('settings:floor-layout-changed', listener);
    };
  },
  onOpenFloorLayoutSettings(callback) {
    const listener = () => callback();
    ipcRenderer.on('open-floor-layout-settings', listener);
    return () => {
      ipcRenderer.removeListener('open-floor-layout-settings', listener);
    };
  },
  onOpenFloorSettings(callback) {
    const listener = () => callback();
    ipcRenderer.on('open-floor-settings', listener);
    return () => {
      ipcRenderer.removeListener('open-floor-settings', listener);
    };
  },
  onOpenVersionInfo(callback) {
    const listener = () => callback();
    ipcRenderer.on('open-version-info', listener);
    return () => {
      ipcRenderer.removeListener('open-version-info', listener);
    };
  },
  onOpenSettings(callback) {
    const listener = () => callback();
    ipcRenderer.on('open-settings', listener);
    return () => {
      ipcRenderer.removeListener('open-settings', listener);
    };
  },
  getImageSettings() {
    return ipcRenderer.invoke('get-image-settings');
  },
  saveImageSettings(settings) {
    return ipcRenderer.invoke('save-image-settings', settings);
  },
  onImageSettingsUpdated(callback) {
    const listener = (_event, updated) => callback(updated);
    ipcRenderer.on('image-settings-updated', listener);
    return () => {
      ipcRenderer.removeListener('image-settings-updated', listener);
    };
  },
  getGenreMappings() {
    return ipcRenderer.invoke('get-genre-mappings');
  },
  saveGenreMappings(mappings) {
    return ipcRenderer.invoke('save-genre-mappings', mappings);
  },
  onGenreMappingsUpdated(callback) {
    const listener = (_event, updated) => callback(updated);
    ipcRenderer.on('genre-mappings-updated', listener);
    return () => {
      ipcRenderer.removeListener('genre-mappings-updated', listener);
    };
  },
  getShopSettings() {
    return ipcRenderer.invoke('get-shop-settings');
  },
  saveShopSettings(settings) {
    return ipcRenderer.invoke('save-shop-settings', settings);
  },
  onShopSettingsUpdated(callback) {
    const listener = (_event, updated) => callback(updated);
    ipcRenderer.on('shop-settings-updated', listener);
    return () => {
      ipcRenderer.removeListener('shop-settings-updated', listener);
    };
  },
  manualUpdateCheck() {
    ipcRenderer.send('menu:check-updates');
  },
  oneClickUpdate() {
    ipcRenderer.send('menu:one-click-update');
  },
  quitApp() {
    ipcRenderer.send('menu:quit');
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
  getCmsBaseUrl() {
    return ipcRenderer.invoke('cms:get-base-url');
  },
});

contextBridge.exposeInMainWorld('logger', {
  log(level, message, context) {
    // Basic safeguard so the app does not crash even if called incorrectly
    ipcRenderer.send('log-message', {
      level,
      message,
      context: context || {},
    });
  },
  info(message, context) {
    this.log('info', message, context);
  },
  warn(message, context) {
    this.log('warn', message, context);
  },
  error(message, context) {
    this.log('error', message, context);
  },
  debug(message, context) {
    this.log('debug', message, context);
  },
});