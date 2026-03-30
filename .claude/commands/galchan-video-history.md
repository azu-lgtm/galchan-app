# /galchan-video-history — 投稿履歴管理

動画ごとの成績を蓄積・管理する。Playbookの材料になるデータベース。

## 手順

### 1. devサーバー確認

- `localhost:3001` が起動しているか確認する
- 起動していなければ `npm run dev` で起動（バックグラウンド）

### 2. 現在の履歴を確認

`GET http://localhost:3001/api/youtube/video-history`

未取得の動画だけ見る場合:
`GET http://localhost:3001/api/youtube/video-history?unfetched=true`

### 3. 新しい動画を登録（Post Tracker から自動連携）

```
POST http://localhost:3001/api/youtube/video-history
Body: { "action": "add", "videoId": "xxx", "title": "タイトル", "publishDate": "2026-03-30" }
```

### 4. 48時間後の指標を更新

```
POST http://localhost:3001/api/youtube/video-history
Body: { "action": "update-metrics", "videoId": "xxx", "metrics": { "views48h": 1200, "ctr": 4.2, "retention": 35.0, "subscribersGained": 5, "likes": 40, "comments": 3 } }
```

### 5. 週次の7日再生数を更新

```
POST http://localhost:3001/api/youtube/video-history
Body: { "action": "update-weekly", "videoId": "xxx", "views7d": 5000 }
```

### 6. 結果の解釈

- **metrics_fetched: false** の動画が3件以上 → スーパーバイザーが警告を出す
- 判定が「❌不調」の動画が続く → Playbookの失敗パターンに記録
- 判定が「✅好調」の動画 → Playbookの成功パターンに記録

### 7. 推奨アクション

- 未取得の動画があれば `/galchan-post-tracker` で指標を取得
- 履歴がたまったら `/galchan-patterns` で勝ちパターンを更新
