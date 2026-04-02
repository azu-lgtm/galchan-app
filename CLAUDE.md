# galchan-app プロジェクト設定

## プロジェクト概要
ガルちゃんYouTubeチャンネル運営ツール。台本生成・分析・ネタ出しを自動化。

## Auto-PDCA 共通ルール（全チャンネル横断）
> 以下のファイルに Detector / Post Tracker / video-history / Playbook / スーパーバイザーの共通ルールを定義。
> このプロジェクト固有のルールは本ファイル、共通ルールは `_共通/` を参照。
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\_共通\pdca-rules.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\_共通\video-history-format.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\_共通\supervisor-checklist.md`

## ポート
- 開発サーバー: **3001**

## 台本生成の基盤（2026-03-26更新）

### フォーマットルール（Single Source of Truth）
`C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\台本ルール\台本生成ルール.md`
> TSVフォーマット・登場人物・SE配置・禁止事項・固定文の正。

### 分析原本（トーン・構造・戦略の根拠）
| ファイル | 内容 | 場所 |
|---|---|---|
| 勝ちパターン統合版_20260325 | 構造・サムネ・感情動線・Aポジション | 分析結果/ |
| 競合台本構造分析_20260325 | 文字起こし10本の構造詳細 | 分析結果/_原本保管/ |
| 台本構成分析_20260325 | キャラ運用・テンポ・感情動線 | 分析結果/_原本保管/ |
| 競合網羅分析_20260325 | サムネ×タイトル・視聴者心理（490行） | 分析結果/_原本保管/ |
> ベースパス: `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\`

### 競合文字起こし（トーンの手本）
`C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\競合分析\台本文字起こし\`（32本）
> 台本のトーンは競合文字起こしを直接参照して吸収する。自チャンネル台本はフォーマット・固定文の参照のみ。

### 分析原本の動的ファイル検索ルール（全スキル共通）
> **日付入りファイル名はハードコードしない。** 常にGlobで最新を取得する。

| ファイル | 検索パターン | 場所 |
|---|---|---|
| 勝ちパターン統合版 | `勝ちパターン統合版_*.md` | `分析結果/` |
| 競合台本構造分析 | `競合台本構造分析_*.md` | `分析結果/_原本保管/` |
| 台本構成分析 | `台本構成分析_*.md` | `分析結果/_原本保管/` |
| 競合網羅分析 | `競合網羅分析_*.md` | `分析結果/_原本保管/` |

**検索手順:** Globで `ベースパス/パターン` を検索 → ファイル名の `_YYYYMMDD` 部分で降順ソート → 最新1件を使用。
**ベースパス:** `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\`
**0件の場合:** エラーとしてユーザーに報告し、スキルを停止する。

### 要点
- 登場人物: **ナレーション / タイトル / イッチ / スレ民1〜6**
- ヘッダー行なし、コロンなし、シーン転換なし、第N話マーカーなし
- SE: 8-12発言ごとに1回、SE1/SE2交互
- ナレーションは冒頭とエンディングのみ
- 同じ話者の連続発言禁止（イントロ・エンディングのナレーション除く）
- **トピック間はぶつ切り**（接続語なし）
- **公的機関の引用は検証済みデータのみ。捏造絶対禁止**

## スキル一覧（2026-03-26 v2）
| スキル | 用途 | 主な変更点（v2） |
|---|---|---|
| `/galchan-analyze` | 自チャンネル+競合分析 | データ鮮度チェック追加、エージェント3→2に統合、品質ゲート追加 |
| `/galchan-patterns` | 勝ちパターン更新 | 変更なし |
| `/galchan-ideas` | ネタ出し | Yahoo知恵袋・X追加、パイプラインデータフロー対応、品質ゲート追加 |
| `/galchan-script` | 台本生成 | リサーチソース拡充（ガルちゃんweb/知恵袋/X）、品質ゲート追加 |
| `/galchan-review` | 台本レビュー | 変更なし |
| `/galchan-detector` | 週次異常検知 | 前週比で再生数・視聴時間・登録者を比較。動画別CTR・維持率チェック |
| `/galchan-post-tracker` | 投稿後トラッキング | 48h未満=初動、48h以降=フル判定。video-historyに自動連携 |
| `/galchan-video-history` | 投稿履歴管理 | 動画ごとの成績テーブル（Playbookの材料） |

## 単体タスク実行時の参照フロー（必須）
> フルパイプラインの一部タスクだけ依頼された場合でも、以下の参照フローを必ず回してから生成する。

| タスク | 必須参照先 |
|---|---|
| サムネ/タイトル案 | 運用知見(S系) → 勝ちパターン統合版(Part2サムネ法則) → 競合100万超サムネ実例と比較 |
| ネタ出し | 運用知見 → 勝ちパターン → 過去ネタ一覧 → video-history |
| 台本生成/修正 | 台本生成ルール.md → 運用知見(C系) → 競合文字起こし2本 |
| レビュー | 上記すべて |

**フロー:** 参照先読み込み → 生成 → 参照先の基準でセルフチェック → 出す
**気づきの即時保存:** やりとりの中で出た気づきは、ユーザーに言われなくても即座に適切なファイルに追記する（運用知見/勝ちパターン/MEMORY等）

## パイプライン（推奨実行順序 — データフロー付き）
```
/galchan-analyze → 出力ファイルパスを次に渡す
  ↓
/galchan-patterns → 勝ちパターン統合版を更新
  ↓
/galchan-ideas [analyze出力パス] → テーマ+スコアリング根拠を次に渡す
  ↓
/galchan-script [テーマ] → 台本TSVパスを次に渡す
  ↓
/galchan-review [台本TSVパス]
```
> 各ステップは品質ゲートを通過してから次に進む。単独実行も可能（分析原本のみで動く）。

## スプレッドシート保存
- テンプレートコピー方式（空のテンプレートをコピーして台本を書き込む）
- テンプレートID: `.env.local` の `SPREADSHEET_TEMPLATE_SCRIPT` / `SPREADSHEET_TEMPLATE_SCRIPT_PRODUCTS`
- 文字数の自動計算・SE挿入の見やすさがメリット

## Googleアカウント（このプロジェクト関連のみ）
| 用途 | アカウント |
|---|---|
| YouTube（ガルちゃんch） | ガルちゃんアカウント（1）garuchanneru226@gmail.com |
| OAuth Client | あずきアカウント（3）のGCP |
| スプレッドシート・Drive | ガルちゃんアカウント（1）garuchanneru226@gmail.com |

## 環境変数（.env.localに設定）
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — GCPプロジェクト
- GOOGLE_REFRESH_TOKEN — ガルちゃんアカウント（1）
- SPREADSHEET_ID_GALCHAN — 台本管理スプレッドシート
- SPREADSHEET_TEMPLATE_SCRIPT — 台本テンプレート（通常）
- SPREADSHEET_TEMPLATE_SCRIPT_PRODUCTS — 台本テンプレート（商品系）
- FOLDER_ID_GALCHAN — Google Drive TSV保存先
- GEMINI_API_KEY — Gemini API
- KV_REST_API_URL / KV_REST_API_TOKEN — Vercel KV
- YMMP_OUTPUT_DIR / YMMP_TEMPLATE_PATH — YMM4ローカル
- VOICEVOX_URL — http://localhost:50021
