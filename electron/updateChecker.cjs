// electron/updateChecker.cjs
// Update helper using GitHub Releases API (CommonJS version)

const { app, dialog, shell } = require('electron');
const { gt } = require('semver');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// IMPORTANT: Set these to the repository where you create Releases.
const REPO_OWNER = 's-yoshida-33';
const REPO_NAME = 'FloorGuideApp';

const RELEASE_API_URL =
  `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

/**
 * Fetch JSON from GitHub Releases API.
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': `${REPO_NAME}-updater`,
            Accept: 'application/vnd.github+json',
          },
        },
        (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          });
        }
      )
      .on('error', reject);
  });
}

/**
 * Download a file to the given destination path.
 * Follows HTTP redirects (e.g. 302 from GitHub to S3) up to 5 times.
 */
function downloadFile(url, dest, redirectCount = 0) {
    const maxRedirects = 5;
  
    return new Promise((resolve, reject) => {
      https
        .get(
          url,
          {
            headers: {
              'User-Agent': `${REPO_NAME}-updater`,
            },
          },
          (res) => {
            const statusCode = res.statusCode || 0;
  
            // Handle redirects (301, 302, 303, 307, 308)
            if (
              statusCode >= 300 &&
              statusCode < 400 &&
              res.headers.location
            ) {
              res.resume(); // discard response data
  
              if (redirectCount >= maxRedirects) {
                return reject(
                  new Error('Too many redirects while downloading installer.')
                );
              }
  
              const redirectedUrl = res.headers.location;
              return resolve(
                downloadFile(redirectedUrl, dest, redirectCount + 1)
              );
            }
  
            // Non-OK status (and not a redirect)
            if (statusCode !== 200) {
              res.resume();
              return reject(
                new Error(`Download failed with status code ${statusCode}`)
              );
            }
  
            // Status 200 OK -> write to file
            const file = fs.createWriteStream(dest);
  
            res.pipe(file);
  
            file.on('finish', () => {
              file.close(() => resolve(dest));
            });
  
            file.on('error', (err) => {
              file.close(() => {
                fs.unlink(dest, () => {});
                reject(err);
              });
            });
          }
        )
        .on('error', (err) => {
          reject(err);
        });
    });
}

/**
 * Normalize version string (e.g. "v1.0.0" → "1.0.0").
 */
function normalizeVersion(v) {
  return v.trim().replace(/^v/, '');
}

/**
 * Pick Windows installer asset from a release.
 * Prefer .exe (NSIS) over .msi.
 */
function pickWindowsInstallerAsset(release) {
  const assets = release.assets || [];
  return (
    assets.find((a) => a.name.toLowerCase().endsWith('.exe')) ||
    assets.find((a) => a.name.toLowerCase().endsWith('.msi')) ||
    null
  );
}

/**
 * Manual update check with dialogs (Help -> Check for updates).
 */
async function checkForUpdates(isManual = false) {
  const currentVersion = app.getVersion();

  try {
    const release = await fetchJson(RELEASE_API_URL);

    if (release.draft) {
      if (isManual) {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Check for updates',
          message: 'No published release found (latest is a draft).',
        });
      }
      return;
    }

    const latest = normalizeVersion(release.tag_name);
    const current = normalizeVersion(currentVersion);

    if (gt(latest, current)) {
      const asset = pickWindowsInstallerAsset(release);

      const message = `A new version is available.\n\nCurrent: ${currentVersion}\nLatest: ${release.tag_name}`;

      const buttons = asset
        ? ['Download', 'Open release page', 'Later']
        : ['Open release page', 'Later'];

      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Update available',
        message,
        buttons,
        defaultId: 0,
        cancelId: buttons.length - 1,
      });

      if (asset) {
        if (response === 0) {
          // Open direct download URL in browser (manual flow)
          shell.openExternal(asset.browser_download_url);
        } else if (response === 1) {
          shell.openExternal(release.html_url);
        }
      } else {
        if (response === 0) {
          shell.openExternal(release.html_url);
        }
      }
    } else {
      if (isManual) {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Check for updates',
          message: `You are running the latest version (${currentVersion}).`,
        });
      }
    }
  } catch (err) {
    if (isManual) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Update check failed',
        message: 'Failed to check for updates.',
        detail: String(err),
      });
    }
  }
}

/**
 * One-click update:
 * - Triggered from a menu or a button in the UI (via IPC).
 * - User clicks once to start.
 * - App downloads the installer, runs it in silent mode (/S),
 *   and then quits.
 * - Installer is responsible for overwriting the app and starting
 *   the new version.
 */
async function oneClickUpdate() {
  const currentVersion = app.getVersion();

  try {
    const release = await fetchJson(RELEASE_API_URL);

    if (release.draft) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Update',
        message: 'No published release found (latest is a draft).',
      });
      return;
    }

    const latest = normalizeVersion(release.tag_name);
    const current = normalizeVersion(currentVersion);

    if (!gt(latest, current)) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Update',
        message: `You are already running the latest version (${currentVersion}).`,
      });
      return;
    }

    const asset = pickWindowsInstallerAsset(release);
    if (!asset) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Update',
        message:
          'No Windows installer (.exe or .msi) asset was found in the latest release.',
      });
      return;
    }

    // Confirmation dialog – this is the "one click" from the user.
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update',
      message:
        `A new version is available.\n\n` +
        `Current: ${currentVersion}\nLatest: ${release.tag_name}\n\n` +
        `The app will download the installer, quit, and update in the background.`,
      buttons: ['Update now', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });

    if (response !== 0) {
      return; // User canceled
    }

    // Download installer to a temporary folder.
    const tempDir = os.tmpdir();
    const installerPath = path.join(tempDir, asset.name);

    await downloadFile(asset.browser_download_url, installerPath);

    // Final message that the update is starting.
    await dialog.showMessageBox({
      type: 'info',
      title: 'Update',
      message:
        'The installer will now run and the application will quit.\n' +
        'Please wait for the update to finish.',
    });

    // Launch installer in silent mode and quit the app.
    // NOTE: /S is the standard silent flag for NSIS installers.
    const args = [];
    if (installerPath.toLowerCase().endsWith('.exe')) {
      args.push('/S');
    } else if (installerPath.toLowerCase().endsWith('.msi')) {
      // MSI typical silent flags
      args.push('/qn', '/norestart');
    }

    const child = spawn(installerPath, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    app.quit();
  } catch (err) {
    console.error('oneClickUpdate failed:', err);
    await dialog.showMessageBox({
      type: 'error',
      title: 'Update',
      message: 'Failed to perform one-click update.',
      detail: String(err),
    });
  }
}

module.exports = {
  checkForUpdates,
  oneClickUpdate,
};
