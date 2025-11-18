const { app, BrowserWindow } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173/");
  } else {
    const indexPath = path.join(__dirname, "../dist/index.html");
    win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  createWindow();
});
