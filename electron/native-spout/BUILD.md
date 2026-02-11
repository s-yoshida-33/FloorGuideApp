# electron-spout ネイティブモジュール ビルド手順

## 概要

Wonder Flow からの Spout フレーム受信に必要な `SpoutInput` クラスを含む
ネイティブモジュール (`electron-spout.node`) をビルドする手順です。

元の `electron-spout` (reitowo/electron-spout) は Spout **送信** (SpoutOutput) のみをサポートしており、
**受信** 機能がありません。このモジュールは `SpoutInput` クラスを追加して受信を可能にします。

## 前提条件

1. **Visual Studio 2022 以降** (C++ デスクトップ開発ワークロード)
2. **Node.js** (v20+)
3. **cmake-js** (`npm install -g cmake-js`)
4. **CMake** (3.25+)

> **注**: vcpkg は不要です。Spout2 SDK は CMake の FetchContent で自動ダウンロードされます。

## ビルド手順

### 1. ビルド実行

```powershell
cd electron\native-spout
cmake-js build
```

### 2. ビルド成果物の配置

```powershell
copy build\Release\electron-spout.node ..\electron-spout.node
```

## Electron バージョンの更新

親プロジェクトの Electron バージョンが変わった場合は、
`package.json` の `cmake-js.runtimeVersion` を合わせてください。

```json
{
  "cmake-js": {
    "runtimeVersion": "39.2.2"
  }
}
```

## SpoutOutput も含める場合

元の `electron-spout` の送信機能も必要な場合:

1. https://github.com/reitowo/electron-spout から `spout_output.h` と `spout_output.cpp` をコピー
2. ビルドオプションを追加:

```powershell
cmake-js build --CDINCLUDE_SPOUT_OUTPUT=ON
```

## 動作確認

ビルド後、アプリを起動してログに以下が表示されることを確認:

```
Spout: Loaded native module structure  { keys: ["SpoutInput"] }
Spout: SpoutInput (receiver) loaded successfully
```

以前のエラーログ（SpoutOutput使用時）:
```
Spout: No connection (pollReceiver returned false)  ← SpoutOutputは送信専用のため常にfalse
```
