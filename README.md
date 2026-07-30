# Gido (Tauri版)

## 1. 概要

Gidoは、商業施設向けの店舗案内（フロアガイド）およびデジタルサイネージ再生用キオスクアプリケーションです。
ElectronからTauri 2へ移行したことにより、バイナリサイズの大幅削減（約150MBから5〜10MBへ）、メモリ使用量の削減、起動速度の改善を実現しています。

* **バージョン**: 1.5.0
* **ターゲットOS**: Windows (x64)
* **運用形態**: キオスクモード（フルスクリーン、常に最前面表示）

## 2. システム構成・技術スタック

本アプリケーションは、軽量なRustバックエンドとOSネイティブのWebViewを利用した2層構造を持ちます。

### **Backend (Tauri/Rust)**:
* Rust (1.56+)
* Tauri 2.x
* 主要クレート・プラグイン: `tauri-plugin-fs`, `tauri-plugin-process`, `tauri-plugin-dialog`, `tauri-plugin-http`, `tauri-plugin-updater`, `reqwest`, `sysinfo` (CPU/メモリ/GPU監視用)
* 役割: ウィンドウ管理、ローカルファイルシステム操作、外部APIのプロキシ通信（CORS回避）、ログ出力、自動アップデート。


### **Frontend (React)**:
* React 19, TypeScript
* ビルドツール: Vite 7 (ポート: `1420`)
* スタイリング: Tailwind CSS 4
* 役割: UI描画、SSEによるリアルタイムデータ受信。


* **IPC通信**: `@tauri-apps/api/core` の `invoke()` を使用してセキュアに通信。

## 3. 機能要件

* **フロアマップ表示**: SVGマップを描画し、現在地アイコンをオーバーレイ表示、画像の健全性を5分毎に監視し、破損時は自動リロード。
* **店舗リスト表示**: BridgeGroundからのデータに基づき、ジャンル別に自動レイアウトでグリッド表示。
* **デジタルサイネージ**: WonderScreen CMS配信 と連携し、画面右上の指定エリアでスケジュールされた動画/画像を再生。
* **統合設定 (Unified Settings)**: フロア、レイアウト、現在地アイコンのデザイン・アニメーション、画像をカスタマイズ可能なプレビュー付きモーダル画面。
* **Watchdog監視**: 2秒ごとにウィンドウ状態を監視し、最小化時や背面に回った際は強制的に最前面へ復帰（本番環境のみ）。

## 4. 画面仕様

* **GidoApp (メイン画面)**: 画面を `100vh` とし、上部に「フロアマップ（左）」と「サイネージ動画（右）」、下部に「店舗リスト（左）」と「販促画像（右）」を配置。
* **UnifiedSettingsScreen (設定画面)**: 左サイドバー（カテゴリタブ）、中央エリア（ズーム・パン可能なプレビュー）、右サイドバー（詳細設定フォーム）で構成。

## 5. データ構造と設定

設定ファイル (`settings.json`) は `%LOCALAPPDATA%\com.tti.gido` 配下に保存されます。

```json
{
  "floor": "1F",
  "floorLayout": { "1F": { "columns": 3, "rowsPerCol": 20 } },
  "locationIcons": { "speechBubble": {}, "location": {} },
  "genreMappings": { "ファッション": { "labelEn": "Fashion", "headerTextColor": "#00ade4" } },
  "imageSettings": { "floorMaps": { "1F": "file://..." } }
}

```

## 6. 外部システム連携・通信仕様

同一ネットワーク上の外部システムを自動検出します。
CORS制約を回避するため、Rustの `reqwest` を用いたプロキシコマンド (`fetch_shops_proxy` 等) を経由して通信します。

### **BridgeGround (店舗データ)**:
* プロトコル: SSE (エンドポイント: `/api/events`)
* ポート範囲: `8090 - 8099`
* 動作: `shops` イベント受信時に店舗リストを更新・キャッシュし、オフライン時は直近のキャッシュで動作（Stale-While-Revalidate）。


### **WonderScreen CMS / WSP (サイネージ)**:
* プロトコル: SSE (エンドポイント: `/api/events`)
* ポート範囲: `8080 - 8089`
* 動作: `switch` / `update` イベントでメディア切り替え。ローカルパスはTauriの `asset://` プロトコル経由で読み込み。



## 7. ロギング・エラーハンドリング

* **ログ形式**: `[YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [TAG] メッセージ | コンテキスト`
* 例: `[2026-02-27 10:30:16.456] [ERROR] [DATA_SYNC] Failed to fetch shops | {"url":"http://localhost:8090/api/shops","status":500}`


* **出力先**: `%LOCALAPPDATA%/com.tti.gido/logs/gido-YYYY-MM-DD.log` にRustコマンド（`write_log`）経由でファイル出力、開発時はコンソールにも出力。

## 8. 自動アップデート機能

`@tauri-apps/plugin-updater` を使用し、GitHub Releasesを参照して更新を行います。

* **フロー**: 
* 起動時に `check()` を実行します。
* 更新があれば `latest.json` と minisign による署名検証を行い、`downloadAndInstall()` でダウンロード後、`relaunch()` で再起動。
* パッチ画面を表示して進捗を可視化します。

## 9. 開発・ビルド・運用

* **開発起動**: `npm run tauri:dev`
* **ビルド**: `npm run tauri:build`（NSISインストーラー `.exe` または `.msi` を生成）
* **セキュリティ (Capabilities)**: 
* `capabilities/default.json` で許可されたファイルパス（`$APPDATA/com.tti.gido/**`）やURLへのアクセスのみを許可。
* CSP (`tauri.conf.json`) で `asset:` プロトコルを許可。
