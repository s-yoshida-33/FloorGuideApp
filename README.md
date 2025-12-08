# Gido (Floor Guide & Signage System)

Gidoは、フロアガイド表示とデジタルサイネージ機能を統合したElectronアプリケーションです。
商業施設等のタッチパネルやディスプレイでの運用を想定し、フロアマップ、店舗リスト、プロモーション動画などを効率的に表示・管理できます。

## 概要

本システムは以下の役割を担います：

1.  **フロアガイド**: 階層ごとのマップ表示と現在地アイコンのオーバーレイ表示。
2.  **店舗案内**: フロアごとの店舗リストを動的に表示。外部システム (Bridge Web Popper) との連携が可能。
3.  **デジタルサイネージ**: WonderScreen CMS (WSP) と連携し、動画や静止画コンテンツをスケジュール再生。
4.  **統合管理**: 専用の設定画面により、フロア切り替え、レイアウト調整、画像アセットの管理、接続設定などを一元管理。

## 主要機能

### 1. フロアガイド表示
- SVG形式のフロアマップを表示。
- `react-zoom-pan-pinch` によるスムーズな操作（必要に応じて）。
- **現在地アイコン**: マップ上の任意の位置に「現在地ピン」や「吹き出し」を表示。アニメーションや位置調整が可能。

### 2. 店舗リスト表示 (`ShopList`)
- 各フロアの店舗情報をリスト形式で表示。
- **データ連携**: Bridge Web Popper API (`/api/shops`) から店舗データを定期的に取得・同期。
- **レイアウト調整**: フロアごとに列数や1列あたりの行数を設定可能。

### 3. デジタルサイネージ (`VerticalVideoSlot`)
- 画面右上のエリアで動画や画像を再生。
- **CMS連携**: WonderScreen CMS (`/current-timeline`) から再生すべきコンテンツ情報をリアルタイムに取得。
- 対応フォーマット: mp4, webm, jpg, png など。

### 4. 設定・管理機能
- **統合設定画面**: アプリケーション内からアクセス可能な設定UI。
    - **フロア設定**: 表示するフロアの切り替え。
    - **画像設定**: フロアマップや営業時間画像の差し替え（ドラッグ&ドロップ対応）。
    - **レイアウト設定**: 店舗リストの行数・列数調整。
    - **アイコン設定**: 現在地アイコンの表示/非表示、位置、サイズ、アニメーション設定。
- **永続化**: 設定内容はユーザーデータ領域の `settings.json` に保存され、再起動後も維持されます。

### 5. 自動更新
- `electron-updater` を使用し、GitHub Releases 経由での自動アップデートに対応。
- 起動時にパッチ画面 (`PatchScreen`) を表示し、更新チェックと適用を行います。

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
│   └── logger.cjs      # ログ設定
├── src/                # Reactレンダラープロセス (UI)
│   ├── api/            # 外部APIクライアント
│   ├── assets/         # 静的リソース (デフォルトマップ、アイコン等)
│   ├── components/     # UIコンポーネント (ShopList, Settings等)
│   ├── config/         # アプリケーション設定定数
│   ├── hooks/          # カスタムHooks
│   ├── repositories/   # データ取得ロジック
│   ├── screens/        # 画面コンポーネント (GidoApp, SettingsScreen等)
│   ├── types/          # TypeScript型定義
│   └── styles/         # グローバルスタイル、フォント
├── public/             # 静的ファイル
└── release/            # ビルド成果物 (git ignore)
```

## 外部連携仕様 (API)

本アプリは、設定されたポート範囲をスキャンして外部サービスを自動検出します。

### 1. 店舗データ連携 (Bridge Web Popper)
- **エンドポイント**: `/api/shops`
- **ポート探索範囲**: `8090` - `8099` (デフォルト設定)
- **データ形式**: JSON
- **挙動**: 起動時および定期的に上記ポート範囲をスキャンし、応答があったポートに接続して店舗データを取得します。

### 2. サイネージ連携 (WonderScreen CMS)
- **エンドポイント**: 
    - `/current-timeline`: 現在再生すべきコンテンツ情報
    - `/api/events`: SSE (Server-Sent Events) によるリアルタイム更新通知
- **ポート探索範囲**: `8080` - `8089` (デフォルト設定)
- **ローカルファイルアクセス**: CMSがローカルパス (`C:/...`) を返す場合、Electron側で `file://` プロトコルに変換して読み込みます。

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
- 外部APIサーバー (Bridge/CMS) が起動しているか確認してください。
- ポート番号が設定された範囲内 (`8080-8089`, `8090-8099`) であるか確認してください。
- ファイアウォール設定を確認してください。

### 設定をリセットしたい
- アプリケーションを終了し、`settings.json` を削除してから再起動してください。デフォルト設定で再生成されます。
