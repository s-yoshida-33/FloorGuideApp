const fs = require('fs');
const path = require('path');
const os = require('os');

// アプリケーション名 (package.jsonのproductNameと一致させる)
const APP_NAME = 'Gido';

// 設定ファイルのパスを特定
// Windows: %APPDATA%/Gido/settings.json
// macOS: ~/Library/Application Support/Gido/settings.json
// Linux: ~/.config/Gido/settings.json
let userDataPath;
if (process.platform === 'win32') {
  userDataPath = path.join(process.env.APPDATA, APP_NAME);
} else if (process.platform === 'darwin') {
  userDataPath = path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
} else {
  userDataPath = path.join(os.homedir(), '.config', APP_NAME);
}

const settingsPath = path.join(userDataPath, 'settings.json');
const outputPath = path.join(__dirname, '../electron/default-settings.json');

console.log(`Looking for settings at: ${settingsPath}`);

try {
  if (!fs.existsSync(settingsPath)) {
    console.error(`Settings file not found at: ${settingsPath}`);
    console.error('Please run the application in development mode and save some settings first.');
    process.exit(1);
  }

  const raw = fs.readFileSync(settingsPath, 'utf8');
  const settings = JSON.parse(raw);
  
  // エクスポートする項目を抽出
  // ショップリストのレイアウト -> floorLayout
  // 現在地の位置やサイズ、アニメーション -> locationIcons
  const exportData = {
    locationIcons: settings.locationIcons,
    floorLayout: settings.floorLayout,
  };

  if (!exportData.locationIcons && !exportData.floorLayout) {
    console.warn('Warning: locationIcons and floorLayout are missing in source settings.');
  }

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  console.log(`Settings exported successfully to: ${outputPath}`);
  console.log('Exported data keys:', Object.keys(exportData));

} catch (error) {
  console.error('Failed to export settings:', error);
  process.exit(1);
}




