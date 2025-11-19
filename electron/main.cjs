// electron/main.cjs
// Electron main process entry point

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { checkForUpdates, oneClickUpdate } = require('./updateChecker.cjs');

const isDev = !app.isPackaged;

let mainWindow = null;

/**
 * Create the main application window.
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      // Disable Node integration in renderer for security
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // In development, load Vite dev server
    mainWindow.loadURL('http://localhost:5173/');
    // mainWindow.webContents.openDevTools(); // Uncomment if you want devtools
  } else {
    // In production, load the built index.html file
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  // When the window is closed, dereference the window object
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Create and set the application menu.
 * Adds both manual check and one-click update entries.
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
            // Manual check: always show a result dialog
            checkForUpdates(true);
          },
        },
        {
          label: 'Update now (one click)',
          click: () => {
            // One-click update flow
            oneClickUpdate();
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * App ready event
 */
app.whenReady().then(() => {
  createWindow();
  createAppMenu();

  // Automatic update check on startup:
  // - If a newer version exists -> show "Update available" dialog
  // - If already latest -> do nothing (no dialog)
  // - If error -> do nothing (no dialog)
  checkForUpdates(false);

  app.on('activate', () => {
    // On macOS it is common to re-create a window when the dock icon is clicked
    // and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Quit the app when all windows are closed.
 * On macOS, apps typically stay open until the user quits explicitly with Cmd+Q.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
