# Gido (ギド)

**Gido** は、店舗案内（フロアガイド）やデジタルサイネージを表示するためのキオスク・サイネージアプリケーションです。
Electron + React + Vite + TypeScript で構築されており、店舗管理システム (BridgeGround) や CMS (WonderScreen) と連携して、常に最新の情報を表示します。

## 主な機能

1.  **フロアマップ表示機能**
    *   階層別のフロアマップ表示
    *   現在地アイコンの表示とカスタマイズ（サイズ、位置、アニメーション）
    *   画像表示の健全性監視（表示エラー時の自動リフレッシュ）

2.  **店舗リスト表示機能**
    *   BridgeGround API と連携したリアルタイムな店舗情報表示
    *   ジャンルごとの色分け表示（設定可能）
    *   長い店舗名やジャンル名の自動スクロール（Marquee）

3.  **デジタルサイネージ機能**
    *   WonderScreen CMS (WSP) と連携した動画・画像の再生
    *   スケジュールに基づいたコンテンツの自動切り替え
    *   縦型ディスプレイ（9:16）に最適化されたレイアウト

4.  **設定・管理機能**
    *   キーボードショートカット (`Ctrl+Alt+S`) による設定画面呼び出し
    *   現在地アイコン、フロアレイアウト、ジャンル設定のGUI変更
    *   **自動アップデート機能** (GitHub Releases連携)

## アーキテクチャと技術仕様

本アプリは Electron のマルチプロセスアーキテクチャを採用しています。

### 技術スタック
- **Frontend**: React 18, TypeScript, Vite
- **Backend (Electron)**: Electron, Node.js
- **Styling**: Tailwind CSS (v4), CSS Modules
- **State/Effect**: React Hooks, IPC (Inter-Process Communication)
- **Utilities**: `electron-log` (ログ管理), `electron-store` (設定永続化)

### 外部システム連携仕様

本アプリは、ローカルネットワーク内の外部サービスをポートスキャンによって自動検出し、連携します。
通信には **Server-Sent Events (SSE)** を採用し、データ更新の即時反映と通信の効率化を実現しています。

#### 1. 店舗データ連携 (BridgeGround)
店舗名、営業時間、ロゴ画像などの管理システムです。

*   **自動検出ポート範囲**: `8090` - `8099` (デフォルト)
*   **通信方式**:
    *   **SSE (Server-Sent Events)**: `/api/events` に接続し、サーバーからの変更通知 (`shops` イベント) を常時監視します。
    *   **データ更新フロー**:
        1.  サーバー側で店舗情報の変更が発生。
        2.  `shops` イベント経由で最新のJSONデータがプッシュ通知される。
        3.  アプリは受信データを即座に画面に反映し、同時にローカルストレージへキャッシュ保存。
        4.  **REST API ポーリング廃止**: 従来の「通知受信→全件再取得」の無駄な通信を廃止し、イベントデータのみで完結する効率的な設計となっています。
*   **オフライン対策**:
    *   アプリ起動時、サーバー接続前にまずローカルキャッシュを表示します。
    *   これにより、ネットワーク障害時でも前回の状態で即座に稼働を開始できます。

#### 2. サイネージ連携 (WonderScreen CMS / WSP)
動画や画像コンテンツの配信管理システムです。

*   **自動検出ポート範囲**: `8080` - `8089` (デフォルト)
*   **通信方式**:
    *   **SSE**: `/api/events` に接続し、タイムラインの変更 (`update`) やコンテンツ切り替え (`switch`) を監視します。
    *   **ローカルファイル再生**: CMSがローカルパス (`C:/...`) を返却する場合、Electronメインプロセス側でセキュリティ制限を調整し、`file://` プロトコルとして安全に読み込みます。

### 内部処理フロー

1.  **起動処理 (Main Process)**:
    *   二重起動防止、設定ファイルの読み込み。
    *   外部サービスのポートスキャン実行 (非同期)。
    *   フルスクリーンウィンドウの生成と最前面固定。

2.  **画面描画 (Renderer Process)**:
    *   Reactコンポーネントのマウント。
    *   `ShopCache` からの初期データ読み込み。
    *   SSE接続の確立とイベントリスナーの登録。

3.  **設定管理**:
    *   設定変更は IPC 通信 (`ipcRenderer.invoke`) を通じてメインプロセスへ送信。
    *   メインプロセスが JSON ファイル (`config.json`) に永続化し、即座にレンダラーへ反映通知を送ります。

## セットアップと実行

### 必須要件
- Node.js (v20以上推奨)
- npm
- **ImageMagick**: アイコン生成スクリプト (`npm run icon:gen`) を実行する場合に必要です。

### インストール

```bash
npm install
```

### 開発モード
ElectronアプリとVite開発サーバーを同時に起動します。

```bash
npm run electron:dev
```

### ビルド
Windows向けのインストーラー（.exe）を作成します。

```bash
npm run electron:build
```
成果物は `release/` ディレクトリに出力されます。

## ディレクトリ構成

```
Gido/
├── electron/           # Electronメインプロセス関連
│   ├── main.cjs        # エントリーポイント、ウィンドウ管理、IPC通信
│   ├── preload.cjs     # プリロードスクリプト (Context Bridge)
│   ├── updateChecker.cjs # 自動更新ロジック
│   └── logger.cjs      # ログ・通知設定
├── src/                # Reactレンダラープロセス (UI)
│   ├── api/            # 外部APIクライアント (SSE, Bridge, CMS)
│   ├── components/     # UIコンポーネント
│   ├── hooks/          # カスタムHooks (useBridgeEvents, useCurrentAsset等)
│   ├── repositories/   # データアクセ層 (Cache, Fetch)
│   ├── screens/        # 画面コンポーネント
│   └── types/          # TypeScript型定義
└── release/            # ビルド成果物 (git ignore)
```
