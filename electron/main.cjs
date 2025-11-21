// electron/main.cjs
// Electron main process entry point (with startup patch window)

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
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

ipcMain.handle('settings:get-floor', () => {
  const settings = loadSettings();
  return settings.floor;
});

/**
 * App ready event.
 * - Show patch window.
 * - Initialize auto-updater.
 * - Automatically check for updates.
 */

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

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
