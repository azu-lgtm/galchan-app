# /galchan-video-history — 投稿履歴管理

動画ごとの成績を蓄積・管理する。Playbookの材料になるデータベース。

## 実行ゲート（DB読み込み確認・必須）

> このスキルの実行前にDB/logs/の必要ファイルを読み込む。
> 1つでも読めなければ即停止してユーザーに報告する。

**ベースパス:** `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\`

**必須読み込み:**
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\logs\video-history.md`

**確認:** 上記ファイルを全て読み込んだか？ → Yes: 次のステップへ / No: 停止してユーザーに報告

---

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

---

## 完走後メタチェック（自動実行）

> スキル完走後に自動で実行する軽量チェック。問題があればユーザーに報告する。

### チェック項目
1. **ルールとの矛盾**: 今回の実行中にDB/rules/のルールと矛盾する判断をしなかったか？
2. **ルールの不足**: 今回の実行で「こういうルールがあれば迷わなかった」という場面はなかったか？
3. **ログ→ルール昇格候補**: DB/logs/運用知見.mdの知見を今回も参照した場合、ルール化すべきほど頻繁に使われていないか？
4. **数値基準のズレ**: 今回の実行結果が、DB/rules/の数値基準と大きくズレていないか？

### 報告フォーマット
問題がなければ報告不要（サイレント）。問題があった場合のみ：

```
⚠️ メタチェック検出:
- [矛盾/不足/昇格候補/基準ズレ]: 内容
- 推奨アクション: ...
```

→ ユーザーが承認したらDB/rules/を更新する。承認なしに更新しない。
