# Electron → Tauri 2 移行マニュアル

> **対象**: Gido / Grain-Link プロジェクト（Toei Techno International Inc.）
> **Tauri バージョン**: 2.x
> **作成日**: 2026-02-27

---

## 目次

1. [概要](#1-概要)
2. [前提条件・環境構築](#2-前提条件環境構築)
3. [プロジェクト構成の変更](#3-プロジェクト構成の変更)
4. [package.json の移行](#4-packagejson-の移行)
5. [Rust バックエンド (src-tauri) の構築](#5-rust-バックエンドsrc-tauriの構築)
6. [Vite 設定の変更](#6-vite-設定の変更)
7. [IPC 通信の移行](#7-ipc-通信の移行)
8. [ファイルシステム操作の移行](#8-ファイルシステム操作の移行)
9. [ロギングの移行](#9-ロギングの移行)
10. [自動アップデートの移行](#10-自動アップデートの移行)
11. [プロセス制御の移行](#11-プロセス制御の移行)
12. [HTTP 通信の移行](#12-http-通信の移行)
13. [ウィンドウ管理の移行](#13-ウィンドウ管理の移行)
14. [セキュリティ設定 (CSP・Capabilities)](#14-セキュリティ設定cspcapabilities)
15. [ビルド・リリースの移行](#15-ビルドリリースの移行)
16. [CI/CD (GitHub Actions) の移行](#16-cicd-github-actionsの移行)
17. [移行チェックリスト](#17-移行チェックリスト)
18. [トラブルシューティング](#18-トラブルシューティング)

---

## 1. 概要

### 移行の目的

Electron から Tauri 2 への移行により、以下を実現する:

- **バイナリサイズの大幅削減**: ~150MB → ~5-10MB
- **メモリ使用量の削減**: Chromium 同梱不要（OS の WebView を利用）
- **セキュリティの向上**: Capabilities ベースの権限管理
- **起動速度の改善**: 軽量な Rust バックエンド

### アーキテクチャの変化

```
【Electron】                          【Tauri 2】
┌─────────────────────┐               ┌─────────────────────┐
│  Main Process (Node) │               │  Rust Backend        │
│  - electron/main.cjs │               │  - src-tauri/main.rs │
│  - electron/preload  │               │  - Cargo.toml        │
│  - IPC: ipcMain      │               │  - IPC: #[command]   │
└──────────┬──────────┘               └──────────┬──────────┘
           │ contextBridge                        │ invoke()
┌──────────▼──────────┐               ┌──────────▼──────────┐
│  Renderer (Chromium)  │               │  WebView (OS native) │
│  - React + Vite       │               │  - React + Vite      │
│  - window.electronAPI │               │  - @tauri-apps/api   │
└───────────────────────┘               └──────────────────────┘
```

### 実績

| 項目 | Gido | Grain-Link |
|------|------|------------|
| 移行元 | Electron 39.x | ― (Tauri で新規開発) |
| 移行先 | Tauri 2.x | Tauri 2.x |
| フロントエンド | React 19 + Vite 7 + Tailwind 4 | React 19 + Vite 7 + Tailwind 4 |
| バックエンド | Rust (main.rs) | Rust (main.rs) |

---

## 2. 前提条件・環境構築

### 必要なツール

| ツール | バージョン | 用途 |
|--------|-----------|------|
| **Node.js** | 20+ | フロントエンドビルド |
| **Rust** | 1.56+ (stable) | Tauri バックエンド |
| **npm** | 10+ | パッケージ管理 |
| **Tauri CLI** | 2.x | Tauri ビルド・開発 |

### Rust のインストール

```bash
# Windows (PowerShell)
winget install Rustlang.Rustup

# または公式インストーラ
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# ツールチェインの確認
rustup show
rustc --version
cargo --version
```

### Windows 固有の要件

Windows で Tauri をビルドするには以下が必要:

- **Visual Studio Build Tools** (C++ デスクトップ開発ワークロード)
- **WebView2** (Windows 10/11 には標準搭載)

```powershell
# WebView2 の確認
Get-ItemProperty -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
```

### Tauri CLI のインストール

```bash
# devDependencies に追加（推奨）
npm install -D @tauri-apps/cli@^2.10.0

# グローバルインストール（任意）
cargo install tauri-cli --version "^2.0.0"
```

---

## 3. プロジェクト構成の変更

### Electron の構成（移行前）

```
project/
├── electron/
│   ├── main.cjs          # メインプロセス
│   ├── preload.cjs        # preload スクリプト
│   └── modules/           # Node.js モジュール群
├── src/                   # React フロントエンド
├── build/                 # ビルドリソース
├── package.json           # main: "electron/main.cjs"
└── vite.config.ts
```

### Tauri の構成（移行後）

```
project/
├── src-tauri/             # ★ 新規作成
│   ├── src/
│   │   └── main.rs        # Rust バックエンド（electron/main.cjs の代替）
│   ├── capabilities/
│   │   └── default.json   # 権限定義
│   ├── gen/               # 自動生成（gitignore）
│   ├── icons/
│   │   └── icon.ico
│   ├── Cargo.toml         # Rust 依存関係
│   ├── build.rs           # ビルドスクリプト
│   └── tauri.conf.json    # Tauri 設定ファイル
├── src/                   # React フロントエンド（変更あり）
├── build/                 # ビルドリソース
├── package.json           # scripts 変更、依存関係変更
└── vite.config.ts         # server.port 変更
```

### 初期セットアップ

```bash
# 既存プロジェクトに Tauri を追加
npx tauri init

# 対話式で以下を設定:
# - App name: Gido (or Grain Link)
# - Window title: Gido
# - Frontend dev URL: http://localhost:1420
# - Frontend build dir: ../dist
# - Dev command: npm run dev
# - Build command: npm run build
```

---

## 4. package.json の移行

### 削除する依存関係 (Electron 関連)

```json
// ★ これらを全て削除
{
  "dependencies": {
    "electron-log": "^5.4.3",
    "electron-updater": "^6.6.2",
    "nodemailer": "^7.0.10",
    "semver": "^7.7.3"
  },
  "devDependencies": {
    "concurrently": "^9.1.2",
    "cross-env": "^7.0.3",
    "electron": "^39.2.2",
    "electron-builder": "^26.0.12",
    "sharp": "^0.34.5",
    "to-ico": "^1.1.5",
    "wait-on": "^8.0.1"
  }
}
```

### 追加する依存関係 (Tauri 関連)

```json
{
  "dependencies": {
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "@tauri-apps/plugin-http": "^2.5.7",
    "@tauri-apps/plugin-process": "^2.0.0",
    "@tauri-apps/plugin-updater": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/api": "^2.10.1",
    "@tauri-apps/cli": "^2.10.0"
  }
}
```

### scripts の変更

```json
{
  "scripts": {
    // ★ 変更なし
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",

    // ★ 削除: Electron 系
    // "electron:dev": "cross-env NODE_ENV=development concurrently \"npm:dev\" \"npm:electron:start\"",
    // "electron:start": "wait-on http://localhost:5173 && electron .",
    // "electron:build": "npm run build && electron-builder",

    // ★ 追加: Tauri 系
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "desktop:dev": "tauri dev",
    "desktop:build": "tauri build"
  }
}
```

### "main" フィールドの削除

```diff
- "main": "electron/main.cjs",
```

Tauri ではフロントエンドのエントリーポイントは `vite.config.ts` で管理されるため、package.json の `main` フィールドは不要。

### "build" (electron-builder) フィールドの削除

`electron-builder` の設定ブロック全体を削除する。ビルド設定は `src-tauri/tauri.conf.json` に移行する。

---

## 5. Rust バックエンド (src-tauri) の構築

### Cargo.toml

```toml
[package]
name = "gido"                    # アプリ名 (小文字)
version = "1.5.0"                # package.json と同期
description = "Gido - Floor guide display system"
authors = ["Toei Techno International Inc."]
license = "UNLICENSED"
edition = "2021"
rust-version = "1.56"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-fs = "2"
tauri-plugin-process = "2"
tauri-plugin-dialog = "2"
tauri-plugin-http = "2"
tauri-plugin-updater = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.11", features = ["blocking", "json"] }
dirs = "5.0"
chrono = "0.4"

[profile.release]
codegen-units = 1       # 最適化のためシングルユニット
lto = true              # リンク時最適化
strip = true            # デバッグシンボル除去
opt-level = "z"         # サイズ最適化
```

**Grain-Link 固有の追加依存関係:**
```toml
zip = "2.1"  # ZIP アーカイブ処理（メディア同期用）
```

**Gido 固有の追加依存関係:**
```toml
sysinfo = "0.33"  # システム情報取得（CPU/メモリ/GPU監視用）
```

### build.rs

```rust
fn main() {
    tauri_build::build()
}
```

### tauri.conf.json

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "com.tti.gido",
  "productName": "Gido",
  "version": "1.5.0",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Gido",
        "width": 1920,
        "height": 1080,
        "resizable": false,
        "fullscreen": true,
        "decorations": false,
        "transparent": false,
        "alwaysOnTop": true,
        "visible": true
      }
    ],
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["**"]
      },
      "csp": "...",
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "icon": ["icons/icon.ico"],
    "publisher": "Toei Techno International Inc.",
    "copyright": "© 2026 Toei Techno International Inc."
  },
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
      ],
      "dialog": false,
      "pubkey": "<公開鍵>"
    }
  }
}
```

### main.rs の基本構造

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};

// 1. レスポンス型を定義
#[derive(Serialize, Deserialize)]
struct MyResponse {
    success: bool,
    message: String,
}

// 2. コマンドを定義 (#[tauri::command] で修飾)
#[tauri::command]
fn my_command(param: String) -> Result<MyResponse, String> {
    Ok(MyResponse {
        success: true,
        message: format!("Received: {}", param),
    })
}

// 3. main() でプラグインとコマンドを登録
fn main() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            my_command,
            // ... 他のコマンド
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {});
}
```

---

## 6. Vite 設定の変更

### 変更前 (Electron)

```typescript
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api":  { target: "http://localhost:8080", changeOrigin: true },
      "/file": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
});
```

### 変更後 (Tauri)

```typescript
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,               // ★ Tauri のログを表示するため
  server: {
    port: 1420,                     // ★ tauri.conf.json の devUrl と一致させる
    strictPort: true,               // ★ ポート占有時にエラーにする
    proxy: {
      "/api":  { target: "http://localhost:8090", changeOrigin: true },
    },
  },
  envPrefix: ["VITE_", "TAURI_"],   // ★ Tauri 環境変数を許可
  build: {
    target: process.env.TAURI_PLATFORM == "windows"
      ? "chrome105" : "safari13",   // ★ プラットフォーム別ターゲット
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
```

### 主な変更点

| 項目 | Electron | Tauri |
|------|----------|-------|
| `base` | `'./'` (相対パス) | 不要（デフォルト `'/'`） |
| `server.port` | `5173`（デフォルト） | `1420`（Tauri 規約） |
| `clearScreen` | 不要 | `false`（Tauri ログ表示） |
| `envPrefix` | `"VITE_"` のみ | `["VITE_", "TAURI_"]` |
| `build.target` | 不要 | プラットフォーム別に指定 |

---

## 7. IPC 通信の移行

### Electron の IPC パターン

```
┌─────────────┐  contextBridge   ┌──────────────┐  ipcMain.handle  ┌───────────┐
│  Renderer    │ ───────────────► │  Preload     │ ───────────────► │  Main     │
│  React       │  window.        │  preload.cjs │  ipcRenderer.   │  main.cjs │
│              │  electronAPI    │              │  invoke()        │           │
└─────────────┘                  └──────────────┘                  └───────────┘
```

**Electron (Preload - 公開側):**
```javascript
// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getFloor: () => ipcRenderer.invoke('get-floor'),
  setFloor: (floor) => ipcRenderer.send('set-floor', floor),
  onFloorChanged: (cb) => ipcRenderer.on('floor-changed', (_, floor) => cb(floor)),
});
```

**Electron (Main - 処理側):**
```javascript
// electron/main.cjs
const { ipcMain } = require('electron');

ipcMain.handle('get-floor', async () => {
  return settings.floor || '1F';
});
```

**Electron (Renderer - 呼び出し側):**
```typescript
// src/components/SomeComponent.tsx
const floor = await window.electronAPI.getFloor();
```

### Tauri の IPC パターン

```
┌─────────────┐    invoke()     ┌───────────────┐
│  WebView     │ ──────────────► │  Rust Backend  │
│  React       │  @tauri-apps/  │  main.rs       │
│              │  api/core      │  #[command]    │
└─────────────┘                 └───────────────┘
```

**Tauri (Rust - 処理側):**
```rust
// src-tauri/src/main.rs

#[tauri::command]
fn get_settings() -> Result<String, String> {
    let path = get_settings_path()?;
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))
}

#[tauri::command]
fn save_settings(json: String) -> Result<String, String> {
    let _: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    let path = get_settings_path()?;
    fs::write(&path, &json)
        .map_err(|e| format!("Failed to write settings: {}", e))?;
    Ok(json)
}
```

**Tauri (TypeScript - 呼び出し側):**
```typescript
// src/utils/settings.ts
import { invoke } from '@tauri-apps/api/core';

export async function loadSettings(): Promise<GidoSettings> {
  const json = await invoke<string>('get_settings');
  return JSON.parse(json) as GidoSettings;
}

export async function saveAllSettings(settings: GidoSettings): Promise<void> {
  const json = JSON.stringify(settings, null, 2);
  await invoke('save_settings', { json });
}
```

### 移行のポイント

| Electron | Tauri | 備考 |
|----------|-------|------|
| `ipcRenderer.invoke('channel', data)` | `invoke('command_name', { data })` | 引数はオブジェクトで渡す |
| `ipcRenderer.send('channel', data)` | `invoke('command_name', { data })` | 全て invoke に統一 |
| `ipcRenderer.on('event', cb)` | `listen('event-name', cb)` | `@tauri-apps/api/event` |
| `window.electronAPI.xxx()` | `invoke('xxx')` | preload 不要 |
| `contextBridge.exposeInMainWorld` | 不要 | Tauri は直接 invoke |

### window.electronAPI の型定義の削除

Electron では `global.d.ts` に `ElectronAPI` インターフェースを定義していたが、Tauri では不要:

```typescript
// ★ 削除: src/types/global.d.ts の ElectronAPI, UpdaterAPI, AppInfoAPI 等
// ★ 代わりに、各 invoke 呼び出しでジェネリクスで型指定:
const result = await invoke<{ success: boolean; path: string }>('save_image_file', { ... });
```

---

## 8. ファイルシステム操作の移行

### アプローチ: Rust コマンド vs Tauri FS プラグイン

Tauri では2つの方法がある:

| 方法 | 用途 | 例 |
|------|------|-----|
| **Rust コマンド** | バイナリデータ操作、複雑なロジック | 画像の読み書き、ZIP 展開 |
| **FS プラグイン** | テキストファイルの簡易操作 | settings.json の読み書き |

### 方法1: Rust コマンド（推奨: バイナリデータ）

```rust
// src-tauri/src/main.rs

/// ディレクトリパス取得ヘルパー
fn get_app_data_dir() -> Result<PathBuf, String> {
    dirs::data_local_dir()
        .ok_or_else(|| "Failed to get local data directory".to_string())
        .map(|d| d.join("com.tti.gido"))  // アプリ識別子に合わせる
}

/// 画像保存
#[tauri::command]
fn save_image_file(filename: String, data: Vec<u8>) -> Result<SaveImageResponse, String> {
    let images_dir = get_app_data_dir()?.join("images");
    fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    // パストラバーサル防止
    let safe_name = std::path::Path::new(&filename)
        .file_name()
        .ok_or_else(|| "Invalid filename".to_string())?
        .to_string_lossy()
        .to_string();

    let file_path = images_dir.join(&safe_name);
    fs::write(&file_path, &data)
        .map_err(|e| format!("Failed to write: {}", e))?;

    Ok(SaveImageResponse {
        success: true,
        path: file_path.to_string_lossy().to_string(),
    })
}

/// 画像読み取り（バイト配列で返す）
#[tauri::command]
fn read_image_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path)
        .map_err(|e| format!("Failed to read: {}", e))
}
```

**フロントエンド側:**
```typescript
import { invoke } from '@tauri-apps/api/core';

// 画像保存（Uint8Array → Array<number> に変換して渡す）
const response = await invoke<{ success: boolean; path: string }>(
  'save_image_file',
  { filename: 'shop-logo.png', data: Array.from(imageBytes) }
);
```

### 方法2: FS プラグイン（テキストファイル）

```typescript
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/api/path';

// 設定ファイルの読み書き
const content = await readTextFile('settings.json', {
  baseDir: BaseDirectory.AppLocalData,
});

await writeTextFile('settings.json', JSON.stringify(data, null, 2), {
  baseDir: BaseDirectory.AppLocalData,
});
```

### ローカルファイルの表示 (asset プロトコル)

Electron では `file://` プロトコルでローカルファイルを直接表示できたが、Tauri では `asset://` プロトコルを使用する:

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';

// ローカルファイルパスを asset URL に変換
const assetUrl = convertFileSrc('C:\\Users\\user\\AppData\\Local\\com.tti.gido\\images\\logo.png');
// → "https://asset.localhost/C%3A%5CUsers%5C..."

// <img> タグで使用
<img src={assetUrl} alt="logo" />
```

### データ保存先の対応

| Electron | Tauri | 実際のパス (Windows) |
|----------|-------|---------------------|
| `app.getPath('userData')` | `dirs::data_local_dir().join("com.tti.gido")` | `%LOCALAPPDATA%\com.tti.gido` |
| `app.getPath('appData')` | `BaseDirectory.AppLocalData` | 同上 |
| `app.getPath('temp')` | `std::env::temp_dir()` | `%TEMP%` |

---

## 9. ロギングの移行

### Electron のロギング

```javascript
// electron-log パッケージ
const log = require('electron-log');
log.info('Application started');

// Renderer からは preload 経由
window.logger.info('Component mounted');
```

### Tauri のロギング

**Rust 側 (ファイル書き込み):**
```rust
#[tauri::command]
fn write_log(
    level: String,
    tag: String,
    message: String,
    context: Option<String>,
) -> Result<LogResponse, String> {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
    let context_str = context.unwrap_or_default();

    let log_entry = if context_str.is_empty() {
        format!("[{}] [{}] [{}] {}\n", timestamp, level, tag, message)
    } else {
        format!("[{}] [{}] [{}] {} | {}\n", timestamp, level, tag, message, context_str)
    };

    let log_file_path = get_log_file_path()?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    file.write_all(log_entry.as_bytes())
        .map_err(|e| format!("Failed to write log: {}", e))?;

    Ok(LogResponse {
        success: true,
        message: format!("Logged to {}", log_file_path.display()),
    })
}
```

**TypeScript 側 (デュアル出力: コンソール + ファイル):**
```typescript
// src/logs/logging.ts
import { invoke } from '@tauri-apps/api/core';

const logToFile = async (
  level: 'debug' | 'info' | 'warn' | 'error',
  tag: string,
  message: string,
  context?: Record<string, unknown>,
) => {
  try {
    const contextStr = context ? JSON.stringify(context) : undefined;
    await invoke('write_log', {
      level: level.toUpperCase(),
      tag,
      message,
      context: contextStr,
    });
  } catch {
    // 無限ループ防止: ファイル書き込み失敗時はコンソールのみ
    console.error('[logging] Failed to write log to file');
  }
};

export function logInfo(tag: string, message: string, context?: Record<string, unknown>) {
  console.info(`[${tag}] ${message}`, context);
  logToFile('info', tag, message, context);
}

export function logError(tag: string, message: string, context?: Record<string, unknown>) {
  console.error(`[${tag}] ${message}`, context);
  logToFile('error', tag, message, context);
}
```

### ログファイルの保存先

```
%LOCALAPPDATA%/com.tti.gido/logs/gido-2026-02-27.log
```

フォーマット例:
```
[2026-02-27 10:30:15.123] [INFO] [UPDATER] Checking for app updates
[2026-02-27 10:30:16.456] [ERROR] [DATA_SYNC] Failed to fetch shops | {"url":"http://localhost:8090/api/shops","status":500}
```

---

## 10. 自動アップデートの移行

### Electron の自動アップデート

```javascript
// electron-updater
const { autoUpdater } = require('electron-updater');

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 's-yoshida-33',
  repo: 'Gido',
});

autoUpdater.on('update-available', (info) => { ... });
autoUpdater.on('download-progress', (progress) => { ... });
autoUpdater.on('update-downloaded', () => { ... });

autoUpdater.checkForUpdatesAndNotify();
```

### Tauri の自動アップデート

**1. 署名鍵の生成:**
```bash
npx tauri signer generate -w ~/.tauri/myapp.key
# 公開鍵が表示される → tauri.conf.json の pubkey に設定
```

**2. tauri.conf.json 設定:**
```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/s-yoshida-33/Gido/releases/latest/download/latest.json"
      ],
      "dialog": false,
      "pubkey": "<生成された公開鍵>"
    }
  }
}
```

**3. TypeScript 実装:**
```typescript
// src/hooks/useAutoUpdate.ts
import { check } from '@tauri-apps/plugin-updater';
import type { Update, DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export const useAutoUpdate = () => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    status: 'idle', progress: 0, message: '',
  });

  useEffect(() => {
    const checkForUpdates = async () => {
      setUpdateStatus({ status: 'checking', progress: 0, message: 'アップデートを確認中...' });

      // タイムアウト付きチェック
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Update check timeout')), 30000)
      );
      const update = await Promise.race([check(), timeoutPromise]);

      if (update) {
        await downloadAndInstall(update);
      } else {
        setUpdateStatus({ status: 'uptodate', progress: 0, message: '最新バージョンです' });
      }
    };
    checkForUpdates();
  }, []);

  const downloadAndInstall = async (update: Update) => {
    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event: DownloadEvent) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength ?? 0;
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          const progress = contentLength > 0
            ? Math.min(Math.round((downloaded / contentLength) * 100), 99) : 0;
          setUpdateStatus({ status: 'downloading', progress, message: `ダウンロード中...` });
          break;
        case 'Finished':
          setUpdateStatus({ status: 'ready', progress: 100, message: '再起動します...' });
          break;
      }
    });

    // インストール後に再起動
    await relaunch();
  };

  return { updateStatus };
};
```

**4. latest.json のフォーマット (GitHub Release に配置):**
```json
{
  "version": "1.5.0",
  "notes": "リリースノート",
  "pub_date": "2026-02-27T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<署名>",
      "url": "https://github.com/s-yoshida-33/Gido/releases/download/v1.5.0/GidoSetup-x64-1.5.0.msi.zip"
    }
  }
}
```

### 主な違い

| 項目 | Electron (electron-updater) | Tauri (plugin-updater) |
|------|---------------------------|----------------------|
| 署名 | コード署名証明書 (任意) | minisign 必須 |
| フォーマット | GitHub Releases 自動 | latest.json 手動管理 |
| 進捗 | `download-progress` イベント | `DownloadEvent` コールバック |
| インストール | 自動 (バックグラウンド) | `downloadAndInstall()` 明示呼出 |
| 再起動 | `autoUpdater.quitAndInstall()` | `relaunch()` |

---

## 11. プロセス制御の移行

### Electron

```javascript
// メインプロセス
const { app } = require('electron');
app.quit();
app.relaunch();

// Renderer（preload経由）
window.electronAPI.quitApp();
```

### Tauri

```typescript
import { exit, relaunch } from '@tauri-apps/plugin-process';

// アプリ終了
await exit(0);

// アプリ再起動
await relaunch();
```

---

## 12. HTTP 通信の移行

### CORS 問題への対処

ブラウザベースの WebView では CORS 制約を受ける。Tauri では2つの方法で回避できる:

### 方法1: Rust プロキシコマンド

```rust
// src-tauri/src/main.rs
#[tauri::command]
fn fetch_shops_proxy(url: String) -> Result<FetchResponse, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Client build error: {}", e))?;

    let response = client
        .get(&url)
        .header("Cache-Control", "no-cache")
        .send()
        .map_err(|e| format!("HTTP error: {}", e))?;

    Ok(FetchResponse {
        status: response.status().as_u16(),
        body: response.text().map_err(|e| format!("Body read error: {}", e))?,
    })
}
```

```typescript
// フロントエンドからの呼び出し
const result = await invoke<{ status: number; body: string }>('fetch_shops_proxy', {
  url: 'http://localhost:8090/api/shops',
});
const shops = JSON.parse(result.body);
```

### 方法2: Tauri HTTP プラグイン

```typescript
import { fetch } from '@tauri-apps/plugin-http';

const response = await fetch('https://api.github.com/repos/owner/repo/releases/latest');
const data = await response.json();
```

capabilities で許可する URL を指定:
```json
{
  "identifier": "http:default",
  "allow": [
    { "url": "https://api.github.com/**" },
    { "url": "https://github.com/**" }
  ]
}
```

### 方法の使い分け

| 方法 | 用途 | メリット |
|------|------|---------|
| Rust プロキシ | ローカル API (Bridge) | CORS 完全回避、タイムアウト制御 |
| HTTP プラグイン | 外部 API (GitHub等) | シンプル、capabilities で制御 |

---

## 13. ウィンドウ管理の移行

### Electron

```javascript
const { BrowserWindow } = require('electron');

const mainWindow = new BrowserWindow({
  width: 1920,
  height: 1080,
  resizable: false,
  fullscreen: true,
  frame: false,           // Tauri では decorations: false
  alwaysOnTop: true,
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
  },
});
```

### Tauri

`tauri.conf.json` で宣言的に設定:

```json
{
  "app": {
    "windows": [
      {
        "title": "Gido",
        "width": 1920,
        "height": 1080,
        "resizable": false,
        "fullscreen": true,
        "decorations": false,
        "transparent": false,
        "alwaysOnTop": true,
        "visible": true
      }
    ]
  }
}
```

### 対応表

| Electron (BrowserWindow) | Tauri (tauri.conf.json) |
|--------------------------|------------------------|
| `width` / `height` | `width` / `height` |
| `resizable` | `resizable` |
| `fullscreen` | `fullscreen` |
| `frame: false` | `decorations: false` |
| `alwaysOnTop` | `alwaysOnTop` |
| `transparent` | `transparent` |
| `show` | `visible` |
| `webPreferences.preload` | 不要 |

---

## 14. セキュリティ設定 (CSP・Capabilities)

### CSP (Content Security Policy)

Tauri では `tauri.conf.json` の `app.security.csp` で設定:

```json
{
  "csp": "default-src 'self' http://localhost:8090; img-src 'self' asset: https://asset.localhost http://asset.localhost http://localhost:8090 https: http: data: blob:; media-src 'self' asset: https://asset.localhost http://asset.localhost https: http: data: blob:; connect-src 'self' http://localhost:8090 http: https: ws:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; font-src 'self' https: data:;"
}
```

**重要なディレクティブ:**

| ディレクティブ | 目的 | 設定例 |
|---------------|------|--------|
| `img-src` | 画像読込許可 | `asset:` でローカルファイル表示 |
| `media-src` | 動画/音声許可 | `asset:` でローカル動画再生 |
| `connect-src` | API 接続許可 | Bridge API, WebSocket |
| `style-src` | スタイル許可 | `'unsafe-inline'` (Tailwind 用) |

### Capabilities (権限管理)

`src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:allow-read-dir",
    "process:default",
    "dialog:default",
    "updater:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://api.github.com/**" },
        { "url": "https://github.com/**" },
        { "url": "https://*.githubusercontent.com/**" }
      ]
    }
  ]
}
```

**ファイルシステムスコープ** (`tauri.conf.json` 内):
```json
{
  "identifier": "app-fs-scope",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:scope",
      "allow": [
        "$APPDATA/com.tti.gido/**",
        "$HOME/**"
      ]
    }
  ]
}
```

---

## 15. ビルド・リリースの移行

### Electron のビルド

```bash
# electron-builder でビルド
npm run build && electron-builder

# 出力: release/GidoSetup-x64-1.4.4.exe (NSIS)
```

### Tauri のビルド

```bash
# 開発モード
npm run tauri:dev

# リリースビルド
npm run tauri:build

# 出力:
#   src-tauri/target/release/bundle/msi/GidoSetup-x64-1.5.0.msi
#   src-tauri/target/release/bundle/nsis/GidoSetup-x64-1.5.0.exe
```

### 署名付きビルド

```bash
# 環境変数に署名鍵を設定
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content ~/.tauri/myapp.key)
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-password"

# ビルド（.sig ファイルも自動生成）
npm run tauri:build
```

### NSIS インストーラーのカスタマイズ

タスクスケジューラへの自動登録など、カスタム処理が必要な場合:

```json
// tauri.conf.json
{
  "bundle": {
    "windows": {
      "nsis": {
        "installerHooks": "./nsis-hooks.nsh"
      }
    }
  }
}
```

```nsis
; src-tauri/nsis-hooks.nsh
!macro NSIS_HOOK_POSTINSTALL
  ; インストール後の処理（例: タスクスケジューラ登録）
  nsExec::ExecToLog 'schtasks /create /tn "Gido" /tr "\"$INSTDIR\Gido.exe\"" /sc onlogon /rl limited /f'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; アンインストール前の処理（例: タスクスケジューラ削除）
  nsExec::ExecToLog 'schtasks /delete /tn "Gido" /f'
!macroend
```

---

## 16. CI/CD (GitHub Actions) の移行

### Electron の CI/CD

```yaml
# electron-builder ベース
- run: npm run electron:build
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Tauri の CI/CD

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

env:
  RUST_BACKTRACE: 1

jobs:
  create-release:
    runs-on: windows-latest
    permissions:
      contents: write
    outputs:
      release_version: ${{ steps.get_version.outputs.version }}
    steps:
      - uses: actions/checkout@v4

      - name: Get version from package.json
        id: get_version
        run: |
          $version = (Get-Content package.json | ConvertFrom-Json).version
          echo "version=$version" >> $env:GITHUB_OUTPUT

      - name: Create Release
        if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v1
        with:
          name: "Release v${{ steps.get_version.outputs.version }}"
          generate_release_notes: true
          token: ${{ secrets.GITHUB_TOKEN }}

  build:
    needs: create-release
    runs-on: windows-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-pc-windows-msvc

      # ★ Rust のビルドキャッシュ（ビルド時間短縮）
      - name: Cache Rust
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            src-tauri/target
          key: ${{ runner.os }}-cargo-${{ hashFiles('src-tauri/Cargo.lock') }}

      - name: Install dependencies
        run: npm ci

      - name: Build Tauri app (signed)
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        run: npm run tauri:build

      - name: Upload artifacts to release
        if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v1
        with:
          files: |
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/nsis/*.exe.sig
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/msi/*.msi.sig
          token: ${{ secrets.GITHUB_TOKEN }}
```

### GitHub Secrets の設定

| Secret 名 | 用途 |
|-----------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | アップデート署名用秘密鍵 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 秘密鍵のパスワード |

---

## 17. 移行チェックリスト

### Phase 1: プロジェクト構造

- [ ] `npx tauri init` で `src-tauri/` ディレクトリを生成
- [ ] `Cargo.toml` に必要な依存関係を追加
- [ ] `tauri.conf.json` をアプリ要件に合わせて設定
- [ ] `src-tauri/capabilities/default.json` に権限を定義
- [ ] `build.rs` を作成

### Phase 2: 依存関係

- [ ] Electron 関連パッケージを全て削除
- [ ] Tauri プラグインパッケージを追加
- [ ] `package.json` の scripts を更新
- [ ] `"main"` フィールドと `"build"` ブロックを削除

### Phase 3: Vite 設定

- [ ] `server.port` を `1420` に変更
- [ ] `clearScreen: false` を追加
- [ ] `envPrefix` に `"TAURI_"` を追加
- [ ] `build.target` をプラットフォーム別に設定

### Phase 4: IPC 移行

- [ ] `electron/main.cjs` の各 `ipcMain.handle` を Rust `#[tauri::command]` に変換
- [ ] `electron/preload.cjs` の `contextBridge` 呼出しを削除
- [ ] フロントエンドの `window.electronAPI.xxx()` を `invoke('xxx')` に置換
- [ ] `global.d.ts` から `ElectronAPI` 型定義を削除

### Phase 5: 機能移行

- [ ] ロギング: `electron-log` → Rust `write_log` コマンド
- [ ] 自動アップデート: `electron-updater` → `@tauri-apps/plugin-updater`
- [ ] プロセス制御: `app.quit()` → `exit()` / `relaunch()`
- [ ] ファイル操作: Node.js `fs` → Rust コマンド or FS プラグイン
- [ ] HTTP 通信: Electron の CORS 無視 → Rust プロキシ or HTTP プラグイン
- [ ] ダイアログ: `electron.dialog` → `@tauri-apps/plugin-dialog`

### Phase 6: セキュリティ

- [ ] CSP を設定 (`asset:` プロトコル、API エンドポイント許可)
- [ ] FS スコープを最小限に設定
- [ ] HTTP プラグインの URL ホワイトリストを設定

### Phase 7: ビルド・配布

- [ ] 署名鍵の生成 (`npx tauri signer generate`)
- [ ] NSIS フックの移行（必要な場合）
- [ ] `npm run tauri:build` でビルド確認
- [ ] `latest.json` の生成・配置を確認
- [ ] GitHub Actions ワークフローの更新

### Phase 8: クリーンアップ

- [ ] `electron/` ディレクトリを削除
- [ ] `scripts/` ディレクトリ内の Electron 用スクリプトを削除
- [ ] 不要な devDependencies を削除 (`concurrently`, `cross-env`, `wait-on` 等)
- [ ] `.gitignore` に `src-tauri/target/` と `src-tauri/gen/` を追加

---

## 18. トラブルシューティング

### ビルドエラー

| エラー | 原因 | 解決策 |
|--------|------|--------|
| `error: linker 'link.exe' not found` | Visual Studio Build Tools 未インストール | VS Build Tools (C++ ワークロード) をインストール |
| `error[E0433]: failed to resolve: use of undeclared crate` | Cargo.toml に依存関係不足 | 必要なクレートを `[dependencies]` に追加 |
| `Unresolved import '@tauri-apps/api/core'` | `@tauri-apps/api` 未インストール | `npm install -D @tauri-apps/api` |
| `Refused to load ... 'asset:'` | CSP 設定不足 | `img-src` / `media-src` に `asset:` を追加 |

### ランタイムエラー

| エラー | 原因 | 解決策 |
|--------|------|--------|
| `invoke() returned error: ...` | Rust コマンドの `Result::Err` | Rust 側のエラーメッセージを確認 |
| `window.__TAURI__ is undefined` | Tauri API が初期化されていない | `@tauri-apps/api` のバージョン確認 |
| `Permissions denied` | Capabilities 不足 | `capabilities/default.json` に権限追加 |
| `Asset protocol error` | FS スコープ外のパス | `tauri.conf.json` の `fs:scope` にパス追加 |

### パフォーマンス

| 問題 | 対策 |
|------|------|
| 初回ビルドが遅い | Rust のコンパイルは初回のみ遅い。2回目以降はキャッシュが効く |
| デバッグビルドが遅い | `[profile.dev]` で `opt-level = 0` を確認 |
| バイナリサイズが大きい | `[profile.release]` で `lto = true`, `strip = true`, `opt-level = "z"` |

### Electron 固有機能の代替

| Electron 機能 | Tauri での代替 |
|---------------|---------------|
| `BrowserWindow.loadURL()` | `tauri.conf.json` の `devUrl` / `frontendDist` |
| `globalShortcut` | Tauri のグローバルショートカットプラグイン |
| `Tray` | `tauri-plugin-tray` |
| `Menu` | Tauri メニュー API or カスタム右クリックメニュー |
| `shell.openExternal()` | `@tauri-apps/plugin-shell` の `open()` |
| `nativeImage` | Rust 側で画像処理 |
| `clipboard` | `@tauri-apps/plugin-clipboard-manager` |
| Node.js 直接利用 | 全て Rust コマンドに移行 |

---

## 参考リンク

- [Tauri 公式ドキュメント](https://v2.tauri.app/)
- [Tauri v2 Migration Guide](https://v2.tauri.app/start/migrate/from-tauri-1/)
- [Tauri GitHub](https://github.com/tauri-apps/tauri)
- [Gido リポジトリ](https://github.com/s-yoshida-33/Gido)
- [Grain-Link リポジトリ](https://github.com/s-yoshida-33/Grain-Link)
