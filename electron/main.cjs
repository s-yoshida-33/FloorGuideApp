// electron/main.cjs
// Electron main process entry point (with startup patch window)

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { pathToFileURL } = require('url');
const {
  initAutoUpdater,
  checkForUpdates,
  oneClickUpdate,
} = require('./updateChecker.cjs');
const logger = require('./logger.cjs');

const isDev = !app.isPackaged;

let patchWindow = null;
let mainWindow = null;

// Default location icon settings (for both speech bubble and location pin)
const DEFAULT_LOCATION_ICON_SETTINGS = {
  speechBubble: {
    enabled: true,
    anchorVertical: 'top',
    anchorHorizontal: 'left',
    offsetX: 40,
    offsetY: 40,
    size: 75,
  },
  location: {
    enabled: true,
    anchorVertical: 'top',
    anchorHorizontal: 'left',
    offsetX: 40,
    offsetY: 40,
    size: 36,
  },
};

// Default ShopList layout (columns and rows per column for each floor)
const DEFAULT_FLOOR_LAYOUT = {
  '1F': { columns: 3, rowsPerCol: 20 },
  '2F': { columns: 2, rowsPerCol: 19 },
  '3F': { columns: 3, rowsPerCol: 20 },
  '4F': { columns: 2, rowsPerCol: 18 },
};

// Prevent multiple instances from starting with a single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

// On the second launch, it only brings existing windows to the front
app.on('second-instance', () => {
  const win = mainWindow || patchWindow || BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// Determine base renderer URL (Vite dev server or built production files)
const rendererBaseUrl = isDev
  ? 'http://localhost:5173/'
  : `file://${path.join(__dirname, '../dist/index.html')}`;

/**
 * Settings utilities (for persistent configuration: floor + location icons)
 */
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  const base = {
    floor: '1F',
    locationIcons: DEFAULT_LOCATION_ICON_SETTINGS,
    floorLayout: DEFAULT_FLOOR_LAYOUT,
  };

  try {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) {
      logger.debug('Settings file does not exist, using defaults');
      return base;
    }

    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);

    const merged = {
      floor: typeof parsed.floor === 'string' ? parsed.floor : base.floor,
      locationIcons: parsed.locationIcons
        ? {
            // Do a shallow merge to keep future extensibility
            speechBubble: {
              ...base.locationIcons.speechBubble,
              ...(parsed.locationIcons.speechBubble || {}),
            },
            location: {
              ...base.locationIcons.location,
              ...(parsed.locationIcons.location || {}),
            },
          }
        : base.locationIcons,
      floorLayout: parsed.floorLayout
        ? {
            ...base.floorLayout,
            ...parsed.floorLayout,
          }
        : base.floorLayout,
    };

    logger.debug('Settings loaded', {
      floor: merged.floor,
    });

    return merged;
  } catch (error) {
    logger.error('Failed to load settings, using defaults', {
      error: error?.message,
    });
    // Fallback to base defaults on any error
    return base;
  }
}

function saveSettings(partial) {
  const current = loadSettings();
  const next = {
    ...current,
    ...partial,
  };

  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8');
    logger.info('Settings saved', {
      floor: next.floor,
    });
  } catch (error) {
    logger.error('Failed to save settings', {
      error: error?.message,
    });
  }

  return next;
}

/**
 * Broadcast floor changes to renderer processes
 */
function broadcastFloor(floor) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:floor-changed', floor);
  }
}

/**
 * Broadcast floor layout changes to renderer processes
 */
function broadcastFloorLayout(floorLayout) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:floor-layout-changed', floorLayout);
  }
}

/**
 * Update floor layout (per floor) and notify renderer
 * partialLayout: { columns?: number; rowsPerCol?: number }
 */
function updateFloorLayout(floor, partialLayout) {
  const current = loadSettings();
  const prevLayout = current.floorLayout || DEFAULT_FLOOR_LAYOUT;
  const prevForFloor = prevLayout[floor] || DEFAULT_FLOOR_LAYOUT[floor] || {};

  const nextFloorLayout = {
    ...prevLayout,
    [floor]: {
      ...prevForFloor,
      ...partialLayout,
    },
  };

  const next = saveSettings({ floorLayout: nextFloorLayout });

  logger.info('Floor layout updated', {
    floor,
    columns: next.floorLayout[floor].columns,
    rowsPerCol: next.floorLayout[floor].rowsPerCol,
  });

  broadcastFloorLayout(next.floorLayout);
}

/**
 * Broadcast location icon settings changes to renderer processes
 */
function broadcastLocationIconSettings(locationIcons) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('location-icon-settings-updated', locationIcons);
  }
}

/**
 * Update floor setting and notify renderer
 */
function updateFloorSetting(floor) {
  const next = saveSettings({ floor });
  logger.info('Floor updated', { floor: next.floor });
  broadcastFloor(next.floor);
}

/**
 * Simple HTTP GET helper that retrieves JSON from a given URL.
 */
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        const error = new Error(`HTTP ${res.statusCode}`);
        logger.warn('HTTP request failed', {
          url,
          statusCode: res.statusCode,
        });
        reject(error);
        res.resume();
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          logger.error('Failed to parse JSON response', {
            url,
            error: err?.message,
          });
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      logger.error('HTTP request error', {
        url,
        error: err?.message,
      });
      reject(err);
    });

    req.end();
  });
}

/**
 * Convert a Windows file path to a file:// URL string.
 */
function toFileUrl(winPath) {
  try {
    return pathToFileURL(winPath).toString();
  } catch (error) {
    logger.warn('Failed to convert path to file URL, using fallback', {
      error: error?.message,
      winPath,
    });
    const normalized = winPath.replace(/\\/g, '/');
    return `file:///${normalized}`;
  }
}

/**
 * Create the small startup patch window.
 * This window appears first and shows update progress.
 */
function createPatchWindow() {
  if (patchWindow && !patchWindow.isDestroyed()) {
    logger.debug('Patch window already exists, focusing');
    patchWindow.focus();
    return;
  }

  logger.info('Creating patch window');

  patchWindow = new BrowserWindow({
    resizable: false,
    frame: false,
    show: false,
    borderRadius: 24,
    backgroundColor: '#050608',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Use #patch hash so renderer can show PatchScreen instead of app UI
  patchWindow.loadURL(`${rendererBaseUrl}#patch`);

  patchWindow.once('ready-to-show', () => {
    if (patchWindow) {
      logger.info('Patch window ready to show');
      patchWindow.show();
    }
  });

  patchWindow.on('closed', () => {
    logger.info('Patch window closed');
    patchWindow = null;
  });
}

/**
 * Create the main application window (fullscreen UI).
 */
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    logger.debug('Main window already exists, focusing');
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(rendererBaseUrl);

  // Send current floor setting after renderer has finished loading
  const settings = loadSettings();
  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Main window finished loading, broadcasting settings', {
      floor: settings.floor,
    });
    broadcastFloor(settings.floor);
    broadcastLocationIconSettings(settings.locationIcons);
    broadcastFloorLayout(settings.floorLayout);
  });

  mainWindow.on('closed', () => {
    logger.info('Main window closed');
    mainWindow = null;
  });
}

/**
 * Build application menu including floor setting and manual update entries.
 */
function createAppMenu() {
  const settings = loadSettings();

  logger.info('Creating application menu', {
    initialFloor: settings.floor,
  });

  const layout = settings.floorLayout || DEFAULT_FLOOR_LAYOUT;

  const template = [
    {
      label: 'File',
      submenu: [
        {
          role: 'quit',
          label: 'Exit',
        },
      ],
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Floor 1F',
          type: 'radio',
          checked: settings.floor === '1F',
          click: () => updateFloorSetting('1F'),
        },
        {
          label: 'Floor 2F',
          type: 'radio',
          checked: settings.floor === '2F',
          click: () => updateFloorSetting('2F'),
        },
        {
          label: 'Floor 3F',
          type: 'radio',
          checked: settings.floor === '3F',
          click: () => updateFloorSetting('3F'),
        },
        {
          label: 'Floor 4F',
          type: 'radio',
          checked: settings.floor === '4F',
          click: () => updateFloorSetting('4F'),
        },
        { type: 'separator' },
        {
          label: 'ShopList layout...',
          click: () => {
            logger.info('ShopList layout settings menu clicked');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-floor-layout-settings');
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Location icon settings...',
          click: () => {
            logger.info('Location icon settings menu clicked');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-location-icon-settings');
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for updates (manual)',
          click: () => {
            logger.info('Manual update check requested');
            checkForUpdates(true); // manual check
          },
        },
        {
          label: 'Update now (one click)',
          click: () => {
            logger.info('One-click update requested');
            oneClickUpdate(); // one-click automatic update
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * IPC handlers for settings and app info.
 */
ipcMain.handle('settings:get-floor', () => {
  const settings = loadSettings();
  logger.debug('IPC settings:get-floor', { floor: settings.floor });
  return settings.floor;
});

ipcMain.handle('settings:get-floor-layout', () => {
  const settings = loadSettings();
  logger.debug('IPC settings:get-floor-layout');
  return settings.floorLayout || DEFAULT_FLOOR_LAYOUT;
});

ipcMain.handle('settings:save-floor-layout', (_event, floorLayout) => {
  logger.info('IPC settings:save-floor-layout');
  const settings = saveSettings({ floorLayout });
  broadcastFloorLayout(settings.floorLayout);
  return settings.floorLayout;
});

ipcMain.handle('get-app-version', () => {
  const version = app.getVersion();
  logger.debug('IPC get-app-version', { version });
  return version;
});

/**
 * IPC handlers for location icon settings.
 */
ipcMain.handle('get-location-icon-settings', () => {
  const settings = loadSettings();
  logger.debug('IPC get-location-icon-settings');
  return settings.locationIcons;
});

ipcMain.handle('save-location-icon-settings', (_event, locationIcons) => {
  logger.info('IPC save-location-icon-settings', {
    hasSpeechBubble: !!locationIcons?.speechBubble,
    hasLocation: !!locationIcons?.location,
  });
  const settings = saveSettings({ locationIcons });
  broadcastLocationIconSettings(settings.locationIcons);
  return settings.locationIcons;
});

/**
 * IPC handler for WSP current asset.
 * Uses /current-timeline, extracts the first media asset,
 * and returns a simplified object for the renderer.
 */
ipcMain.handle('wsp:get-current-asset', async () => {
  try {
    const json = await httpGetJson('http://127.0.0.1:8081/current-timeline');

    if (!json || !json.current_timeline) {
      logger.warn('wsp:get-current-asset: current_timeline is missing');
      return null;
    }

    const tl = json.current_timeline;
    const assets = tl.media_assets || [];
    if (!Array.isArray(assets) || assets.length === 0) {
      logger.warn('wsp:get-current-asset: media_assets is empty');
      return null;
    }

    const asset = assets[0];

    logger.info('wsp:get-current-asset: returning first asset', {
      assetId: asset.id,
      url: asset.url,
    });

    return {
      id: asset.id,
      src: toFileUrl(asset.url),
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      name:
        Array.isArray(tl.media_names) && tl.media_names.length > 0
          ? tl.media_names[0]
          : '',
      startTime: tl.start_time,
      endTime: tl.end_time,
    };
  } catch (error) {
    logger.error('wsp:get-current-asset failed', {
      error: error?.message,
    });
    return null;
  }
});

/**
 * IPC handler: return raw /current-timeline JSON.
 */
ipcMain.handle('wsp:get-current-timeline', async () => {
  try {
    const json = await httpGetJson('http://127.0.0.1:8081/current-timeline');
    logger.debug('wsp:get-current-timeline: success');
    return json || null;
  } catch (error) {
    logger.error('wsp:get-current-timeline failed', {
      error: error?.message,
    });
    return null;
  }
});

/**
 * IPC handler: return raw /timeline or /timeline?hour=... JSON.
 */
ipcMain.handle('wsp:get-timeline', async (_event, options) => {
  try {
    const hour =
      options && typeof options.hour === 'number' && !Number.isNaN(options.hour)
        ? options.hour
        : undefined;

    const baseUrl = 'http://127.0.0.1:8081/timeline';
    const url = hour != null ? `${baseUrl}?hour=${hour}` : baseUrl;

    const json = await httpGetJson(url);
    logger.debug('wsp:get-timeline: success', { hour });
    return json || null;
  } catch (error) {
    logger.error('wsp:get-timeline failed', {
      error: error?.message,
    });
    return null;
  }
});

/**
 * IPC handler to receive logs from renderer process.
 * The preload exposes window.logger which sends log-message IPC.
 */
ipcMain.on('log-message', (_event, payload) => {
  try {
    logger.logFromRenderer(payload || {});
  } catch (error) {
    logger.error('Failed to handle log-message IPC', {
      error: error?.message,
    });
  }
});

/**
 * Global error handlers for main process.
 */
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception in main process', {
    error: error?.message,
    stack: error?.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  logger.fatal('Unhandled promise rejection in main process', {
    reason: String(reason),
  });
});

/**
 * App ready event.
 */
app.whenReady().then(() => {
  logger.configureLogger();
  logger.info('Application starting', {
    env: process.env.NODE_ENV || 'production',
    isDev,
  });

  createPatchWindow();
  createAppMenu();

  // Initialize autoUpdater with patch + main window references
  initAutoUpdater({
    getPatchWindow: () => patchWindow,
    createMainWindow,
  });

  // Startup update check (silent, handled inside updateChecker)
  logger.info('Starting initial update check');
  checkForUpdates(false);

  app.on('activate', () => {
    if (process.platform !== 'darwin') return;

    // macOS: recreate main window if no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      logger.info('App activated on macOS with no windows, creating main window');
      createMainWindow();
    }
  });
});

/**
 * Quit when all windows are closed.
 * Except macOS where apps usually stay active.
 */
app.on('window-all-closed', () => {
  logger.info('All windows closed', { platform: process.platform });
  if (process.platform !== 'darwin') app.quit();
});
