# WonderScreen Local API Documentation

WonderScreen は、外部アプリケーションとの連携のためにローカル REST API と Server-Sent Events (SSE) を提供します。

## 概要

- **ベース URL**: `http://localhost:8080` (デフォルト)
- **ポート**: 設定画面で変更可能
- **API モード**: 設定画面で有効/無効を切り替え可能

---

## REST API

### GET /api/timeline

現在のタイムライン全体を取得します。

#### レスポンス例

```json
{
  "count": 3,
  "retrieved_at": "2024-01-15T10:30:00.000Z",
  "current_time": "2024-01-15T10:30:00.000Z",
  "current_time_local": "2024-01-15 19:30:00",
  "status": {
    "initialized": true,
    "headless_mode": false,
    "updating_timeline": false,
    "schedule_id": "abc123",
    "current_item_index": 0,
    "next_item_index": 1,
    "scheduled_switch_time": "2024-01-15T10:31:00.000Z",
    "scheduled_switch_time_local": "19:31:00",
    "seconds_until_switch": 60.0
  },
  "timeline": [
    {
      "timeline_index": 0,
      "start_time": "2024-01-15T10:30:00.000Z",
      "end_time": "2024-01-15T10:31:00.000Z",
      "start_time_local": "19:30:00",
      "end_time_local": "19:31:00",
      "duration_seconds": 60,
      "schedule_id": "abc123",
      "event_id": "event1",
      "program_id": "program1",
      "program_item_index": 0,
      "is_current": true,
      "is_next": false,
      "remaining_seconds": 30.5,
      "elapsed_seconds": 29.5,
      "progress_percent": 49.2,
      "media_count": 1,
      "media": [
        {
          "id": "media-uuid-123",
          "name": "サンプル画像",
          "media_type": "image",
          "filename": "sample.jpg",
          "local_path": "C:/Users/.../assets/media-uuid-123.jpg",
          "duration": 60,
          "layer": {
            "x": 0,
            "y": 0,
            "width": 1920,
            "height": 1080,
            "sequence": 0
          }
        }
      ]
    }
  ]
}
```

#### フィールド説明

| フィールド           | 型     | 説明                          |
| -------------------- | ------ | ----------------------------- |
| `count`              | number | タイムラインアイテムの総数    |
| `retrieved_at`       | string | レスポンス取得時刻 (ISO 8601) |
| `current_time`       | string | 現在時刻 (UTC, ISO 8601)      |
| `current_time_local` | string | 現在時刻 (ローカル)           |
| `status`             | object | 再生状態情報                  |
| `timeline`           | array  | タイムラインアイテムの配列    |

##### status オブジェクト

| フィールド              | 型      | 説明                             |
| ----------------------- | ------- | -------------------------------- |
| `initialized`           | boolean | 初期化完了フラグ                 |
| `headless_mode`         | boolean | ヘッドレスモード有効フラグ       |
| `updating_timeline`     | boolean | タイムライン更新中フラグ         |
| `schedule_id`           | string  | 現在のスケジュール ID            |
| `current_item_index`    | number  | 現在再生中のアイテムインデックス |
| `next_item_index`       | number  | 次のアイテムインデックス         |
| `scheduled_switch_time` | string  | 次回切り替え予定時刻 (ISO 8601)  |
| `seconds_until_switch`  | number  | 次回切り替えまでの秒数           |

---

### GET /api/current-timeline

現在再生中のタイムラインアイテムの詳細情報を取得します。

#### レスポンス例

```json
{
  "retrieved_at": "2024-01-15T10:30:00.000Z",
  "current_timeline": {
    "timeline_index": 0,
    "start_time": "2024-01-15T10:30:00.000Z",
    "end_time": "2024-01-15T10:31:00.000Z",
    "schedule_id": "abc123",
    "data": {
      "schedule_id": "abc123",
      "event_id": "event1",
      "program_item_index": 0,
      "program_item_sequence": 1,
      "program_item_duration": 60,
      "start_time": "2024-01-15T10:30:00.000Z",
      "end_time": "2024-01-15T10:31:00.000Z",
      "generated_at": "2024-01-15T10:00:00.000Z",
      "media_names": ["サンプル画像.jpg"],
      "media_assets": [
        {
          "id": "media-uuid-123",
          "x": 0,
          "y": 0,
          "width": 1920,
          "height": 1080,
          "type": "image",
          "mediaType": "image",
          "sequence": 0,
          "duration": 60,
          "localPath": "C:/Users/.../assets/media-uuid-123.jpg"
        }
      ],
      "media_info": [
        {
          "id": "media-uuid-123",
          "filename": "sample.jpg"
        }
      ],
      "x_program": 0,
      "y_program": 0,
      "width_program": 1920,
      "height_program": 1080,
      "priority": "normal",
      "priority_value": 2,
      "timeline_index": 0
    },
    "start_time_local": "19:30:00",
    "end_time_local": "19:31:00"
  }
}
```

#### 再生中アイテムがない場合

```json
{
  "retrieved_at": "2024-01-15T10:30:00.000Z",
  "current_timeline": null
}
```

---

## Server-Sent Events (SSE)

### GET /api/timeline/stream

リアルタイムでタイムラインのコンテンツ切り替えイベントを受信するための SSE エンドポイントです。

- **URL**: `http://localhost:48080/api/timeline/stream`
- **キープアライブ**: `:keepalive` コメント（SSE コメント形式）

#### 接続方法 (JavaScript)

```javascript
const eventSource = new EventSource("http://localhost:48080/api/timeline/stream");

// コンテンツ切り替え時
eventSource.addEventListener("item_changed", (e) => {
  const data = JSON.parse(e.data);
  console.log("Item changed:", data);
  console.log("Current:", data.current_media_name, data.current_media_type);
  console.log("Next:", data.next_media_id);
});

// エラー処理
eventSource.onerror = (e) => {
  console.error("SSE error:", e);
};

// 接続を閉じる
// eventSource.close();
```

---

### イベント一覧

| イベント名      | 説明                             |
| --------------- | -------------------------------- |
| `item_changed`  | コンテンツが切り替わった時       |

キープアライブは SSE コメント (`:keepalive`) として送信されます。

---

#### item_changed

コンテンツが切り替わった時に送信されます。現在再生中のメディアと次のメディアの情報を含みます。

```json
{
  "event_type": "item_changed",
  "current_media_id": "a1099f80-a156-47a1-9a72-fd4db783711f",
  "current_media_name": "サンプル画像",
  "current_media_type": "image",
  "current_media_local_path": "C:\\SignageData\\assets\\a1099f80-a156-47a1-9a72-fd4db783711f.jpg",
  "next_media_id": "a1099fbe-a53f-4e60-9631-40b5df38d186",
  "next_media_local_path": "C:\\SignageData\\assets\\a1099fbe-a53f-4e60-9631-40b5df38d186.mp4",
  "timeline_count": 2581,
  "timestamp": "2026-02-20T01:26:12.236837600+00:00"
}
```

| フィールド                | 型     | 説明                                   |
| ------------------------- | ------ | -------------------------------------- |
| `event_type`              | string | イベント種別 (`"item_changed"`)        |
| `current_media_id`        | string | 現在再生中のメディア ID (UUID)         |
| `current_media_name`      | string | 現在再生中のメディア名                 |
| `current_media_type`      | string | メディアタイプ (`"image"` / `"video"`) |
| `current_media_local_path`| string | ローカルファイルパス                   |
| `next_media_id`           | string | 次のメディア ID (UUID)                 |
| `next_media_local_path`   | string | 次のメディアのローカルファイルパス     |
| `timeline_count`          | number | タイムラインアイテムの総数             |
| `timestamp`               | string | イベント発生時刻 (ISO 8601)            |

#### SSE 生データ例

```
event:item_changed
data:{"event_type":"item_changed","current_media_id":"a1099f80-...","current_media_name":"サンプル画像","current_media_type":"image","current_media_local_path":"C:\\SignageData\\assets\\a1099f80-....jpg","next_media_id":"a1099fbe-...","next_media_local_path":"C:\\SignageData\\assets\\a1099fbe-....mp4","timeline_count":2581,"timestamp":"2026-02-20T01:26:12.236837600+00:00"}

:keepalive

event:item_changed
data:{"event_type":"item_changed","current_media_id":"a1099fbe-...","current_media_name":"動画コンテンツ","current_media_type":"video","current_media_local_path":"C:\\SignageData\\assets\\a1099fbe-....mp4","next_media_id":"a0d771aa-...","next_media_local_path":"C:\\SignageData\\assets\\a0d771aa-....mp4","timeline_count":2581,"timestamp":"2026-02-20T01:26:27.234999900+00:00"}
```

---

## 使用例

### cURL

```bash
# タイムライン取得
curl http://localhost:8080/api/timeline

# 現在再生中アイテム取得
curl http://localhost:8080/api/current-timeline

# SSE接続 (タイムラインストリーム)
curl -N http://localhost:48080/api/timeline/stream
```

### Python

```python
import requests
import sseclient

# REST API
response = requests.get('http://localhost:8080/api/current-timeline')
print(response.json())

# SSE (タイムラインストリーム)
response = requests.get('http://localhost:48080/api/timeline/stream', stream=True)
client = sseclient.SSEClient(response)
for event in client.events():
    print(f"Event: {event.event}, Data: {event.data}")
```

### C# (HttpClient)

```csharp
using System.Net.Http;
using System.Text.Json;

var client = new HttpClient();

// REST API
var response = await client.GetStringAsync("http://localhost:8080/api/current-timeline");
var data = JsonSerializer.Deserialize<JsonElement>(response);
Console.WriteLine(data);
```

---

## 注意事項

1. **CORS**: 全てのオリジンからのアクセスが許可されています
2. **ローカル接続のみ**: `localhost` でのみ接続可能です
3. **ポート競合**: 指定ポートが使用中の場合、サーバーは起動に失敗します
4. **SSE 接続維持**: クライアント側で再接続ロジックを実装することを推奨します

---

## トラブルシューティング

### 接続できない場合

1. 設定画面で API モードが有効になっているか確認
2. 指定ポートが他のアプリケーションで使用されていないか確認
3. ファイアウォール設定を確認

### SSE 接続が切断される場合

- ネットワーク不安定時に自動的に再接続するロジックを実装してください：

```javascript
function connectSSE() {
  const eventSource = new EventSource("http://localhost:48080/api/timeline/stream");

  eventSource.onerror = () => {
    eventSource.close();
    // 3秒後に再接続
    setTimeout(connectSSE, 3000);
  };

  eventSource.addEventListener("item_changed", (e) => {
    const data = JSON.parse(e.data);
    // 処理
  });
}

connectSSE();
```
