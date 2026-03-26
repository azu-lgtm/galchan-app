# galchan-app プロジェクト設定

## プロジェクト概要
ガルちゃんYouTubeチャンネル運営ツール。台本生成・分析・ネタ出しを自動化。

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

### 要点
- 登場人物: **ナレーション / タイトル / イッチ / スレ民1〜6**
- ヘッダー行なし、コロンなし、シーン転換なし、第N話マーカーなし
- SE: 8-12発言ごとに1回、SE1/SE2交互
- ナレーションは冒頭とエンディングのみ
- 同じ話者の連続発言禁止（イントロ・エンディングのナレーション除く）
- **トピック間はぶつ切り**（接続語なし）
- **公的機関の引用は検証済みデータのみ。捏造絶対禁止**

## スキル一覧（分析原本準拠版 2026-03-26）
| スキル | 用途 | 分析原本の参照 |
|---|---|---|
| `/galchan-analyze` | 自チャンネル+競合分析 | 既存分析を読んでから差分を出す（積み上げ式） |
| `/galchan-patterns` | 勝ちパターン更新 | 分析原本4ファイル全て読み込み |
| `/galchan-ideas` | ネタ出し | 分析原本4ファイル + Aポジション照合 + CTR実績照合 |
| `/galchan-script` | 台本生成 | 分析原本4ファイル + 競合文字起こし2-3本（トーン吸収） |
| `/galchan-review` | 台本レビュー | 分析原本3ファイル + 競合文字起こし2本（トーン比較） |

## パイプライン（推奨実行順序）
```
/galchan-analyze → /galchan-patterns → /galchan-ideas → /galchan-script → /galchan-review
```

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
