# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gido は、商業施設の**大型非タッチディスプレイ**用フロアガイド（デジタルサイネージ）アプリ。Tauri2（Rust）+ React19 + TypeScriptのWindows x64デスクトップ・キオスクアプリ（フルスクリーン・常時最前面・リサイズ不可）。画面左下に地図＋店舗リスト、右上に映像/画像のサイネージ枠を表示する。

同一STB上のBridge-Ground（ローカルキャッシュサーバ、`C:\dev\Bridge-Ground`）から店舗データを取得し、WonderScreen CMS（別プロダクト、wonder-screen-frontendのバックエンド）からサイネージ映像のタイムラインを取得する。

現バージョン: 1.8.17（`package.json`）。元Electron製で、Tauriへ移行済み（`feature/migration-to-tauri`ブランチ履歴）。

## Repository layout

- `src/api/` — Bridge-Ground/CMS向けAPIクライアント
- `src/screens/` — 画面（地図＋店舗リスト、サイネージ枠等）
- `src/components/` — UIコンポーネント
- `src/hooks/` — カスタムフック（`useCurrentAsset`でCMSのタイムライン同期等）
- `src/repositories/` — データ取得層
- `src/config/` — 設定（Bridge-Ground/CMSのベースURL解決等）
- `src/contexts/` — React Context
- `src/types/` — 型定義（`wsp.ts`にWonderScreen連携の型）
- `src/logs/` — ログ関連
- `src-tauri/` — Rust側（ウィンドウ管理、ファイルシステム、HTTPプロキシ、SSE、ログ、自動更新）
- `build/` — `runner.js`（PowerShellスクリプトのラッパー）、署名付きビルド・バージョン管理・地図アップロード用スクリプト
- `README.md` — アーキテクチャ・機能一覧の概要
- `CMS_API.md` — WonderScreen CMSのローカルAPI仕様（REST `/api/timeline`, `/api/current-timeline` + SSE `/api/timeline/stream`）

## Development commands

Docker不使用。Node + Rust + Tauri CLIのローカル環境で直接実行する。

```bash
npm run dev            # Viteのみ（ブラウザで見る場合）
npm run tauri:dev      # Tauri込みの開発実行（通常はこちら）
npm run build          # tsc -b && vite build
npm run lint           # eslint .
```

リリースビルド:
```bash
npm run tauri:build          # 署名なしビルド
npm run tauri:build:signed   # 署名付き（build/runner.js経由でsign-and-build.ps1を実行）
npm run tauri:release        # 署名付きビルド + GitHub Release管理まで一括
npm run bump:version         # バージョン更新（build/bump-version.ps1）
npm run media:upload         # 地図メディアのアップロード（build/runner.js経由）
```

## Known gotchas

- **Bridge-Groundは同一コンピュータ上で稼働している前提**。ベースURLはポート8090〜8099を自動探索する作りだが、既定は`http://localhost:8090`。開発時にBridge-Groundを別途起動していないとshop一覧が空になる。
- **WonderScreen CMSはポート8080番台想定**（`tauri.conf.json`のCSPで`localhost:8080`系がホワイトリストされている）。CMS未起動時はサイネージ枠が表示されないだけで、地図・店舗一覧側は動作する（両者は独立したデータソース）。
- **`tauri.conf.json`のCSP**にAPIサーバーのポートを追加する場合、ここを更新しないと`fetch`がブロックされる。
- **モール別レイアウト設定**が複数存在する（Sakai Kitahanada / Suzaka / Tsu-Minami等）。設定は`%LOCALAPPDATA%\com.tti.gido\settings.json`。動作確認時はどのモール向け設定で見ているか確認する。
- **CMS_API.mdのタイトルは「WonderScreen Local API」**だが、これはGido側が実装するローカルAPI仕様のドキュメントであり、WonderScreen CMS本体のAPIではない（命名がやや誤解を招く）。
- **署名鍵ファイル（`~/TAURI_KEY_PASSWORD.sh`・`.sh.pub`）は、コミット`46186ab`で誤ってgit管理下に追加され、Publicリポジトリの状態でpushされていた**（2026-07-14発覚）。`git-filter-repo`で全履歴・全ブランチ・全タグから完全に除去し、force pushで上書き済み（ローカルチェックアウトも再クローン済み）。`.gitignore`に`~/*`を追加し再混入を防止している。**鍵のローテーションは意図的に未実施**（現時点でこのリポジトリをcloneしているのは開発者本人のみのため優先度を下げている）。今後この鍵をコミットに含めないこと。ローテーションが必要になった場合、既存端末は現行の公開鍵しか信頼しないため、「旧鍵で署名しつつ新しい公開鍵を埋め込んだリリース」を経由する2段階の切り替えが必要になる点に注意。

## Branches & deploy flow

- 作業は `dev` を起点に `hotfix/<内容>` または `feature/<内容>` ブランチを作成して行う（git worktreeで作業ディレクトリを分けるのが基本、`C:\dev\floor-guide-Issue\#000.md`参照）
- 作業完了後はそのブランチをpushしてPRを作成し、`dev`へのマージが完了した時点で対応するIssueをクローズする
- 過去は`dev`に直接作業・pushする運用だったが、複数リポジトリ・複数タスクの並行作業に対応するため上記のブランチ運用に移行した
- **デフォルトブランチは`main`ではなく`release`**（2026-07-10にリネーム）。`release`への**push**がGitHub Actions（`.github/workflows/build-release.yml`）の本番リリーストリガーになっている。
- **本番リリース手順**:
  1. `dev`で`npm run bump:version`を実行し、`package.json`のバージョンを先に上げる（**これを忘れると次のステップでワークフローが失敗する**、4.のガード参照）
  2. `dev` → `release` へPRを作成・マージ（`gh pr create --base release --head dev` → `gh pr merge`）
  3. `release`へのpushをトリガーに、GitHub Actionsが署名付きビルド（`npm run tauri:release`）→ S3アップロード（`dl.tti.ninja/public/gido/releases/`、`.exe`/`.exe.sig`/`latest.json`）→ タグ`vX.Y.Z`作成 → GitHub Release作成、まで自動実行する
  4. ワークフロー冒頭の「Check version not already released」ステップが、同名タグ（`vX.Y.Z`）が既に存在する場合はジョブを失敗させる（1.のバージョン上げ忘れによる既存リリース・S3成果物の無言上書きを防ぐガード）
- **2026-07-10以前はタグ（`v*`）のpushがリリーストリガーだった**（デフォルトブランチは当時`main`）。「デフォルトブランチへのpushでリリース」という一般的な形に統一するため変更した（Grain-Linkでの移行を横展開）。

## Architecture

```
Bridge-Ground（同一STB、:8090）──shops/news/specials/genres/floors + SSE──► 地図＋店舗リスト画面
WonderScreen CMS（:8080番台）────映像タイムライン + SSE（switch/update）───► サイネージ枠（右上）
```

- 2つの外部データソース（Bridge-Ground、WonderScreen CMS）は互いに独立しており、どちらか片方が落ちても他方は動作継続する。
- Rust側はCORS回避のためのHTTPプロキシ、SSEクライアント、ファイルログ、Tauri Updaterプラグインによる自動更新を担う。

## Code conventions

- ESLint（`npm run lint`）に従う。
- コミットメッセージは変更内容が明確に伝わるものにする。複数ファイルの変更を1コミットにまとめても構わない。

## Project context

Gidoは「フロアガイド」製品群（Gido-Touch/Gido-Touch-Mini/Grain-Link/Bridge-Ground/portal-cms）の大型非タッチ版。他の5リポジトリと合わせて`s-yoshida-33`配下でホストされている姉妹プロジェクト。WonderScreen CMS（別プロダクト、`TTI-DCS/wonder-screen-frontend`）とはAPI連携のみで、コードの共有関係はない。ワークフロー運用ルールは`C:\dev\floor-guide-Issue\#000.md`を参照。
