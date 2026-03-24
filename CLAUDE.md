# galchan-app プロジェクト設定

## プロジェクト概要
ガルちゃんYouTubeチャンネル運営ツール。台本生成・分析・ネタ出しを自動化。

## ポート
- 開発サーバー: **3001**

## 台本ルールの正（Single Source of Truth）
`C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\台本ルール\台本生成ルール.md`

> このファイルだけが台本フォーマットの正。他の場所に台本ルールを書かない。
> 外注完成台本（_done.tsv）のフォーマットに完全準拠。

### 要点（詳細は台本生成ルール.mdを参照）
- 登場人物: **ナレーション / タイトル / イッチ / スレ民1〜6**
- ヘッダー行なし、コロンなし、シーン転換なし、第N話マーカーなし
- SE: 10行に1回、SE1/SE2交互
- ナレーションは冒頭とエンディングのみ
- 同じ話者の連続発言禁止（イントロ・エンディングのナレーション除く）

## スキル一覧
| スキル | 用途 | エージェント |
|---|---|---|
| `/galchan-analyze` | 自チャンネル+競合分析 | 自チャンネル分析官 / 競合スカウト / トレンドウォッチャー（並列） |
| `/galchan-patterns` | 勝ちパターン更新 | 単体（analyze結果を使う） |
| `/galchan-ideas` | ネタ出し | ガルちゃんトレンド / 競合ギャップ / 公的機関スキャナー（並列） |
| `/galchan-script` | 台本生成 | リサーチ3エージェント並列 → メイン直接生成 → バリデーター → レビュアー |
| `/galchan-review` | 台本レビュー | 単体（+ validate_script.py自動チェック） |

## パイプライン（推奨実行順序）
```
/galchan-analyze → /galchan-patterns → /galchan-ideas → /galchan-script → /galchan-review
```

## Googleアカウント（このプロジェクト関連のみ）
| 用途 | アカウント |
|---|---|
| YouTube（ガルちゃんch） | ガルちゃんアカウント（1）garuchanneru226@gmail.com |
| OAuth Client | あずきアカウント（3）のGCP |
| スプレッドシート・Drive | ガルちゃんアカウント（1）garuchanneru226@gmail.com |

## 環境変数（.envに設定）
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — GCPプロジェクト
- GOOGLE_REFRESH_TOKEN — ガルちゃんアカウント（1）
- SPREADSHEET_ID_GALCHAN — 台本管理スプレッドシート
- FOLDER_ID_GALCHAN — Google Drive TSV保存先
- GEMINI_API_KEY — Gemini API
- KV_REST_API_URL / KV_REST_API_TOKEN — Vercel KV
- YMMP_OUTPUT_DIR / YMMP_TEMPLATE_PATH — YMM4ローカル
- VOICEVOX_URL — http://localhost:50021
