# /galchan-video-history — 投稿履歴管理

動画ごとの成績を蓄積・管理する。Playbookの材料になるデータベース。

## Step 0: 実行ゲート（必須・スキップ禁止）

> **⚠️ このステップを完了せずに次に進むことは絶対禁止。1ファイルでも読めなければ即停止。**

### 0-1. 必須ファイル読み込み（Readツールで実際に開く）
以下のファイルを **Readツールで1つずつ実際に開いて読む**。「記憶にある」「前に読んだ」は無効。毎回必ず読み直す。

| # | ファイル | フルパス |
|---|---------|---------|
| 1 | video-history.md | `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\logs\video-history.md` |

### 0-2. ゲートレポート出力（必須）
全ファイル読み込み後、以下を出力してからStep 1に進む。出力しないで進むことは禁止。

```
📋 ゲートレポート
- [ファイル名]: ✅ 読み込み済み（最終更新: YYYY-MM-DD、キーデータ: [ファイルから1つ具体的な数値や項目を引用]）
- ...
→ 全ファイル読み込み完了。Step 1 に進む。
```

### 0-3. 実行チェックリスト確認
`実行チェックリスト.md`（`C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\rules\実行チェックリスト.md`）を読み、本タスクに該当するタスクタイプ（A〜F）の必須チェック項目を把握する。

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

## Step 8: 実行ログ記録（必須・スキップ禁止）

以下の内容を `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\logs\実行ログ.md` の先頭（`<!-- 新しいログは先頭に追記する -->` の直後）に追記する。

```
### YYYY-MM-DD HH:MM | /galchan-video-history
- **タスクタイプ:** [A〜F]
- **読み込んだDB:** [実際に読んだファイル名のリスト]
- **主な出力:** [1行で概要]
- **違反検出:** なし / [具体的な違反内容]
- **品質スコア:** [該当する場合のみ]
- **次アクション:** [必要な場合のみ]
```

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
