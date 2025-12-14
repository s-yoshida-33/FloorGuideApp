# Gido (Floor Guide & Signage System)

Gidoは、フロアガイド表示とデジタルサイネージ機能を統合したElectronアプリケーションです。
商業施設等の大型ディスプレイでの運用を想定し、フロアマップ、店舗リスト、プロモーション動画などを効率的に表示・管理できます。

## 概要

本システムは以下の役割を担います：

1.  **フロアガイド**: 階層ごとのマップ表示と現在地アイコンのオーバーレイ表示。
2.  **店舗案内**: フロアごとの店舗リストを動的に表示。外部システム (BridgeGround) との連携が可能。
3.  **デジタルサイネージ**: WonderScreen CMS (WSP) と連携し、動画や静止画コンテンツをスケジュール再生。
4.  **統合管理**: 専用の設定画面により、フロア切り替え、レイアウト調整、画像アセット、ジャンル・ショップ設定、接続設定などを一元管理。

## 主要機能

### 1. フロアガイド表示
- SVG形式のフロアマップを表示。
- `react-zoom-pan-pinch` によるスムーズな操作（必要に応じて）。
- **現在地アイコン**: マップ上の任意の位置に「現在地ピン」や「吹き出し」を表示。アニメーションや位置調整が可能。

### 2. 店舗リスト表示 (`ShopList`)
- 各フロアの店舗情報をリスト形式で表示。
- **データ連携**: BridgeGround API (`/api/shops`) から店舗データを取得・同期。
- **リアルタイム更新**: SSE (`/api/events`) により、データの変更を即座に検知して反映。
- **レイアウト調整**: フロアごとに列数や1列あたりの行数を設定可能。

### 3. デジタルサイネージ (`VerticalVideoSlot`)
- 画面右上のエリアで動画や画像を再生。
- **CMS連携**: WonderScreen CMS (`/current-timeline`) から再生すべきコンテンツ情報をリアルタイムに取得。
- **リアルタイム更新**: SSE (`/api/events`) により、スケジュール切り替えやデータ更新を即座に反映。
- 対応フォーマット: mp4, webm, jpg, png など。

### 4. 設定・管理機能
- **統合設定画面**: アプリケーション内からアクセス可能な設定UI。
    - **フロア設定**: 表示するフロアの切り替え。
    - **画像設定**: フロアマップや営業時間画像の差し替え（ドラッグ&ドロップ対応）。
    - **レイアウト設定**: 店舗リストの行数・列数調整。
    - **アイコン設定**: 現在地アイコンの表示/非表示、位置、サイズ、アニメーション設定。
    - **ジャンル設定**: ジャンル名の英語表記、配色（文字色・背景色）、表示順序の設定。
    - **ショップ設定**: 店舗ごとのジャンルメモ表示件数の制御（特定店舗のみ表示数を制限するなど）。
- **永続化**: 設定内容はユーザーデータ領域の `settings.json` に保存され、再起動後も維持されます。

### 5. 自動更新とバージョン管理
- **自動更新**: `electron-updater` を使用し、GitHub Releases 経由での自動アップデートに対応。起動時にパッチ画面 (`PatchScreen`) を表示し、更新チェックと適用を行います。
- **バージョン情報**: 設定メニューから現在のバージョンと最新バージョンを確認し、リリースノートを表示できます。

### 6. 監視・通知機能
- **Slack通知**: 環境変数 `SLACK_WEBHOOK_URL` を設定することで、アプリケーションのエラーや状態変化（アラート発生/復旧）をSlackチャンネルに通知できます。

## 技術スタック

- **Core**: [Electron](https://www.electronjs.org/) (v39)
- **Frontend**: [React](https://react.dev/) (v19), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4), CSS Modules
- **State/Effect**: React Hooks, IPC (Inter-Process Communication)
- **Components**: 
    - `framer-motion`: アニメーション
    - `react-zoom-pan-pinch`: マップ操作
- **Utilities**: 
    - `electron-log`: ロギング
    - `electron-store` (相当の自前実装): 設定保存

## セットアップと実行

### 必須要件
- Node.js (v20以上推奨)
- npm
- **ImageMagick**: アイコン生成スクリプト (`npm run icon:gen`) を実行する場合に必要です。パスが通っている必要があります。

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
│   ├── api/            # 外部APIクライアント
│   ├── assets/         # 静的リソース (デフォルトマップ、アイコン等)
│   ├── components/     # UIコンポーネント
│   │   ├── GenreSettingsTab.tsx # ジャンル設定
│   │   ├── ShopSettingsTab.tsx  # ショップ設定
│   │   └── ...
│   ├── config/         # アプリケーション設定定数
│   ├── hooks/          # カスタムHooks
│   ├── logs/           # ログ出力ユーティリティ
│   ├── repositories/   # データ取得ロジック
│   ├── screens/        # 画面コンポーネント (GidoApp, SettingsScreen, VersionInfo等)
│   ├── types/          # TypeScript型定義
│   └── styles/         # グローバルスタイル、フォント
├── public/             # 静的ファイル
└── release/            # ビルド成果物 (git ignore)
```

## 外部連携仕様 (API)

本アプリは、設定されたポート範囲をスキャンして外部サービスを自動検出します。
本アプリでは、すべての外部データ連携において **Server-Sent Events (SSE)** を利用したイベント駆動型の更新を採用しています。
ポーリングによる定期的なリクエストは行わず、サーバー側からの変更通知 (`update` イベント等) をトリガーにして最新データを取得します。

### 1. 店舗データ連携 (BridgeGround)
旧 BridgeWebPopper は **BridgeGround** に名称変更され、SSEによるリアルタイム通知機能が強化されました。
- **エンドポイント**: `/api/shops` (データ取得), `/api/events` (SSE接続)
- **ポート探索範囲**: `8090` - `8099` (デフォルト設定)
- **データ形式**: JSON
- **挙動**: 
    - 起動時にポート範囲をスキャンし、BridgeGround を検出。
    - `/api/events` に SSE 接続を確立し、`update` イベントを監視。
    - イベント受信時およびアプリ起動時に `/api/shops` から最新の店舗データを取得。

### 2. サイネージ連携 (WonderScreen CMS)
- **エンドポイント**: 
    - `/current-timeline`: 現在再生すべきコンテンツ情報
    - `/api/events`: SSE (Server-Sent Events) によるリアルタイム更新通知
- **ポート探索範囲**: `8080` - `8089` (デフォルト設定)
- **ローカルファイルアクセス**: CMSがローカルパス (`C:/...`) を返す場合、Electron側で `file://` プロトコルに変換して読み込みます。
- **挙動**:
    - `/api/events` に SSE 接続し、`switch` (コンテンツ切り替え) や `update` (プレイリスト更新) イベントを監視。
    - イベント受信時に即座に画面上のコンテンツを切り替えます。定期ポーリングは行いません。

## 設定ファイル (`settings.json`)

アプリケーションの設定は `AppData` 配下の `settings.json` に保存されます。

**保存場所の例 (Windows):**
`C:\Users\{ユーザー名}\AppData\Roaming\Gido\settings.json`

**主な設定項目:**
```json
{
  "floor": "1F",
  "locationIcons": {
    "speechBubble": { "enabled": true, "xPercent": 50, "yPercent": 40, ... },
    "location": { "enabled": true, "xPercent": 50, "yPercent": 50, ... }
  },
  "floorLayout": {
    "1F": { "columns": 3, "rowsPerCol": 20 }
  },
  "imageSettings": {
    "floorMaps": { "1F": "file:///path/to/custom/map.svg" },
    "openTimeImage": "file:///path/to/image.svg"
  },
  "genreMappings": {
    "ファッション": {
      "labelEn": "Fashion",
      "headerTextColor": "#ffffff",
      "headerBorderColor": "#ff0000",
      "rowBackgroundColor": "rgba(255,255,255,0.1)"
    }
  },
  "shopSettings": {
    "shop-id-123": {
      "genreMemoMaxItems": 3
    }
  },
  "portRanges": {
    "bridge": { "min": 8090, "max": 8099 },
    "cms": { "min": 8080, "max": 8089 }
  }
}
```

## トラブルシューティング

### 画面が表示されない / 真っ白になる
- ログファイルを確認してください。
  - Windows: `C:\Users\{ユーザー名}\AppData\Roaming\Gido\logs\`
- 開発者ツール (`Ctrl+Shift+I` または `F12`、またはメニューから) を開き、コンソールエラーを確認してください。

### 店舗データや動画が表示されない
- 外部APIサーバー (BridgeGround/CMS) が起動しているか確認してください。
- ポート番号が設定された範囲内 (`8080-8089`, `8090-8099`) であるか確認してください。
- ファイアウォール設定を確認してください。

### Slack通知が届かない
- 環境変数 `SLACK_WEBHOOK_URL` が正しく設定されているか確認してください。
- `electron/logger.cjs` のログを確認し、Webhook送信エラーが出ていないか確認してください。

### 設定をリセットしたい
- アプリケーションを終了し、`settings.json` を削除してから再起動してください。デフォルト設定で再生成されます。
