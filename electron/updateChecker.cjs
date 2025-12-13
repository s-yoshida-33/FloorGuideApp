// electron/updateChecker.cjs
// Auto-update logic using electron-updater (CommonJS)

const { dialog, app } = require('electron');
const { autoUpdater } = require('electron-updater');

let getPatchWindow = null;
let createMainWindow = null;

/**
 * Initialize autoUpdater event handlers.
 * This handles startup patch flow and sends progress updates to PatchWindow.
 */
function initAutoUpdater(opts) {
  getPatchWindow = opts.getPatchWindow;
  createMainWindow = opts.createMainWindow;

  // Automatically download updates when available
  autoUpdater.autoDownload = true;
  // We call quitAndInstall manually
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'checking',
      message: 'Checking for updates…',
    });
  });

  autoUpdater.on('update-available', (info) => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'available',
      message: `Downloading update ${info.version}…`,
    });
  });

  autoUpdater.on('update-not-available', () => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'none',
      message: 'You are running the latest version. Launching app…',
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      speed: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'downloaded',
      message: 'Update downloaded. Restarting…',
    });

    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 1000);
  });

  autoUpdater.on('error', (err) => {
    const win = getPatchWindow && getPatchWindow();
    if (!win) return;

    win.webContents.send('update-status', {
      state: 'error',
      message: `Update error: ${err?.message ?? err}`,
    });
  });
}

/**
 * Check for updates.
 * - isManual = false → startup patch mode
 * - isManual = true → manual check with dialogs
 */
async function checkForUpdates(isManual = false) {
  const patchWindowExists = getPatchWindow && getPatchWindow();

  // Startup patch mode
  if (!isManual && patchWindowExists) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    
    // Set timeout to prevent freezing (30 seconds)
    let timeoutCleared = false;
    const timeout = setTimeout(() => {
      if (timeoutCleared) return;
      timeoutCleared = true;
      
      const win = getPatchWindow && getPatchWindow();
      if (win) {
        win.webContents.send('update-status', {
          state: 'error',
          message: 'Update check timed out. Launching app…',
        });
        
        // Removed automatic transition here as well, relying on renderer to handle error state
      }
    }, 30000); // 30 seconds timeout
    
    // Clear timeout when update check completes
    const clearTimeoutOnComplete = () => {
      if (!timeoutCleared) {
        timeoutCleared = true;
        clearTimeout(timeout);
      }
    };
    
    // Use once to avoid duplicate handlers
    autoUpdater.once('error', clearTimeoutOnComplete);
    autoUpdater.once('update-not-available', clearTimeoutOnComplete);
    autoUpdater.once('update-available', clearTimeoutOnComplete);
    
    autoUpdater.checkForUpdates();
    return;
  }

  // Manual mode (dialog-based)
  try {
    autoUpdater.autoDownload = false;

    const checking = dialog.showMessageBox({
      type: 'info',
      title: 'Check for updates',
      message: 'Checking for updates…',
    });

    const result = await autoUpdater.checkForUpdates();

    if (!result || !result.updateInfo) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Check for updates',
        message: 'Failed to get update info.',
      });
      return;
    }

    const updateInfo = result.updateInfo;

    if (!updateInfo.version || updateInfo.version === app.getVersion()) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Check for updates',
        message: `You are running the latest version.`,
      });
      return;
    }

    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update available',
      message: `New version ${updateInfo.version} is available.\n\nDownload and install now?`,
      buttons: ['Download & install', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response !== 0) return;

    await dialog.showMessageBox({
      type: 'info',
      title: 'Update',
      message: 'Downloading update… Please wait.',
    });

    autoUpdater.autoDownload = true;

    autoUpdater.once('update-downloaded', async () => {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: 'Update downloaded. Restart now?',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) autoUpdater.quitAndInstall();
    });

    autoUpdater.once('error', async (err) => {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Update error',
        message: 'Error during update.',
        detail: String(err),
      });
    });

    await autoUpdater.downloadUpdate();
  } catch (err) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Update check failed',
      message: 'Failed to check for updates.',
      detail: String(err),
    });
  }
}

/**
 * One-click update (via menu)
 */
async function oneClickUpdate() {
  try {
    autoUpdater.autoDownload = true;

    const checking = dialog.showMessageBox({
      type: 'info',
      title: 'Update',
      message: 'Checking for updates…',
    });

    autoUpdater.once('update-not-available', async () => {
      await checking;
      await dialog.showMessageBox({
        type: 'info',
        title: 'Update',
        message: 'You are already on the latest version.',
      });
    });

    autoUpdater.once('update-available', async () => {
      await checking;
      await dialog.showMessageBox({
        type: 'info',
        title: 'Update',
        message: 'Downloading update…',
      });
    });

    autoUpdater.once('update-downloaded', async () => {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: 'Update downloaded. Restart now?',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });

      if (response === 0) autoUpdater.quitAndInstall();
    });

    autoUpdater.once('error', async (err) => {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Update error',
        message: 'Error during update.',
        detail: String(err),
      });
    });

    autoUpdater.checkForUpdates();
  } catch (err) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Update',
      message: 'Failed to start update process.',
      detail: String(err),
    });
  }
}

/**
 * Get latest version info without downloading
 */
async function getLatestVersionInfo() {
  try {
    autoUpdater.autoDownload = false;
    const result = await autoUpdater.checkForUpdates();
    
    if (!result || !result.updateInfo) {
      return null;
    }
    
    return {
      version: result.updateInfo.version,
      releaseDate: result.updateInfo.releaseDate,
      releaseNotes: result.updateInfo.releaseNotes,
    };
  } catch (err) {
    return null;
  }
}

module.exports = {
  initAutoUpdater,
  checkForUpdates,
  oneClickUpdate,
  getLatestVersionInfo,
};
