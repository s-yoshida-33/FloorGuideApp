// electron/main.cjs
// Electron main process entry point

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { checkForUpdates } = require('./updateChecker.cjs');

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
 * Adds a "Help" menu with a "Check for updates" item.
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
          label: 'Check for updates',
          click: () => {
            // Manual check: show dialogs even when there is no update or on error
            checkForUpdates(true);
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

  // Automatic update check on startup (non-interactive)
  // If you want to limit the frequency, add your own "last check" logic.
  checkForUpdates(false);

  // On macOS, re-create a window when the dock icon is clicked
  // and there are no other open windows.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Quit the app when all windows are closed.
 * On macOS, typical behavior is to keep the app running until Cmd+Q.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
