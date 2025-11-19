// electron/updateChecker.cjs
// Simple update checker using GitHub Releases API (CommonJS version)

const { app, dialog, shell } = require('electron');
const { gt } = require('semver');
const https = require('https');

const REPO_OWNER = 's-yoshida-33';
const REPO_NAME = 'FloorGuideApp';

const RELEASE_API_URL =
  `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

/**
 * Fetch JSON from GitHub Releases API
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': `${REPO_NAME}-updater`,
            'Accept': 'application/vnd.github+json'
          }
        },
        (res) => {
          let data = '';

          res.on('data', (chunk) => (data += chunk));
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
 * Normalize version string (e.g. "v1.0.0" → "1.0.0")
 */
function normalizeVersion(v) {
  return v.trim().replace(/^v/, '');
}

/**
 * Pick Windows installer asset
 */
function pickWindowsInstallerAsset(release) {
  return (
    release.assets.find((a) => a.name.toLowerCase().endsWith('.exe')) ||
    release.assets.find((a) => a.name.toLowerCase().endsWith('.msi')) ||
    null
  );
}

/**
 * Main update check function
 */
async function checkForUpdates(isManual = false) {
  const currentVersion = app.getVersion();

  try {
    const release = await fetchJson(RELEASE_API_URL);

    if (release.draft) {
      if (isManual) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Check for updates',
          message: 'No published release found (latest is a draft).'
        });
      }
      return;
    }

    const latest = normalizeVersion(release.tag_name);
    const current = normalizeVersion(currentVersion);

    if (gt(latest, current)) {
      const asset = pickWindowsInstallerAsset(release);

      const message =
        `A new version is available.\n\nCurrent: ${currentVersion}\nLatest: ${release.tag_name}`;

      const buttons = asset
        ? ['Download', 'Open release page', 'Later']
        : ['Open release page', 'Later'];

      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'Update available',
        message,
        buttons,
        defaultId: 0,
        cancelId: buttons.length - 1
      });

      if (asset) {
        if (response === 0) shell.openExternal(asset.browser_download_url);
        else if (response === 1) shell.openExternal(release.html_url);
      } else {
        if (response === 0) shell.openExternal(release.html_url);
      }
    } else {
      if (isManual) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Check for updates',
          message: `You are running the latest version (${currentVersion}).`
        });
      }
    }
  } catch (err) {
    if (isManual) {
      dialog.showMessageBox({
        type: 'error',
        title: 'Update check failed',
        message: 'Failed to check for updates.',
        detail: String(err)
      });
    }
  }
}

module.exports = { checkForUpdates };
