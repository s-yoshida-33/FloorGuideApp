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

const isDev = !app.isPackaged;

let patchWindow = null;
let mainWindow = null;

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
 * Settings utilities (for persistent floor configuration)
 */
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const settingsPath = getSettingsPath();
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { floor: '1F' };
  }
}

function saveSettings(partial) {
  const settingsPath = getSettingsPath();
  const current = loadSettings();
  const next = { ...current, ...partial };
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2));
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
 * Update floor setting and notify renderer
 */
function updateFloorSetting(floor) {
  const next = saveSettings({ floor });
  broadcastFloor(next.floor);
}

/**
 * Simple HTTP GET helper that retrieves JSON from a given URL.
 */
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}`));
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
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
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
  } catch {
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
    patchWindow.focus();
    return;
  }

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
    if (patchWindow) patchWindow.show();
  });

  patchWindow.on('closed', () => {
    patchWindow = null;
  });
}

/**
 * Create the main application window (fullscreen UI).
 */
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
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
    broadcastFloor(settings.floor);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Build application menu including floor setting and manual update entries.
 */
function createAppMenu() {
  const settings = loadSettings();

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
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for updates (manual)',
          click: () => {
            checkForUpdates(true); // manual check
          },
        },
        {
          label: 'Update now (one click)',
          click: () => {
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
  return settings.floor;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
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
      return null;
    }

    const tl = json.current_timeline;
    const assets = tl.media_assets || [];
    if (!Array.isArray(assets) || assets.length === 0) {
      return null;
    }

    const asset = assets[0];

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
    console.error('[wsp:get-current-asset] failed:', error);
    return null;
  }
});

/**
 * IPC handler: return raw /current-timeline JSON.
 */
ipcMain.handle('wsp:get-current-timeline', async () => {
  try {
    const json = await httpGetJson('http://127.0.0.1:8081/current-timeline');
    return json || null;
  } catch (error) {
    console.error('[wsp:get-current-timeline] failed:', error);
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
    return json || null;
  } catch (error) {
    console.error('[wsp:get-timeline] failed:', error);
    return null;
  }
});

/**
 * App ready event.
 */
app.whenReady().then(() => {
  createPatchWindow();
  createAppMenu();

  // Initialize autoUpdater with patch + main window references
  initAutoUpdater({
    getPatchWindow: () => patchWindow,
    createMainWindow,
  });

  // Startup update check (silent, handled inside updateChecker)
  checkForUpdates(false);

  app.on('activate', () => {
    if (process.platform !== 'darwin') return;

    // macOS: recreate main window if no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

/**
 * Quit when all windows are closed.
 * Except macOS where apps usually stay active.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
