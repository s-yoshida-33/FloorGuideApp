// electron/main.cjs
// Electron main process entry point (with startup patch window)

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const {
  initAutoUpdater,
  checkForUpdates,
  oneClickUpdate,
} = require('./updateChecker.cjs');

const isDev = !app.isPackaged;

let patchWindow = null;
let mainWindow = null;

// Determine base renderer URL (Vite dev server or built production files)
const rendererBaseUrl = isDev
  ? 'http://localhost:5173/'
  : `file://${path.join(__dirname, '../dist/index.html')}`;

/**
 * Create the small startup patch window.
 * This window appears first and shows update progress.
 */
function createPatchWindow() {
  patchWindow = new BrowserWindow({
    width: 480,
    height: 260,
    resizable: false,
    frame: false,
    show: false,
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Build application menu including manual update entries.
 */
function createAppMenu() {
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
 * App ready event.
 * - Show patch window.
 * - Initialize auto-updater.
 * - Automatically check for updates.
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
