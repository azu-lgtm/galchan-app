# /galchan-meta-pdca — パイプライン改善チェック（月1実行）

> パイプライン自体を改善するためのメタPDCA。
> 動画単位のPDCA（分析→制作→トラッキング）ではなく、「レシピ本自体を書き直す」作業。
> 3つの専門エージェントが並列でチェックし、DB/rules/の更新提案を出す。

## 実行タイミング
- **月1回**（月初の月曜日を推奨）
- 手動実行: `/galchan-meta-pdca`
- 前提: 直近1ヶ月で最低2本の動画が投稿されていること（データ不足では判断できない）

---

## Step 0: DB読み込み（実行ゲート）

以下を全て読み込む。1つでも読めなければ停止してユーザーに報告。

**DB/rules/（全7ファイル）:**
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\rules\戦略.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\rules\分析ルール.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\rules\ネタ出しルール.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\rules\サムネタイトルルール.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\rules\台本ルール.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\rules\トラッキング基準.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\rules\勝ちパターン.md`

**DB/logs/（全6ファイル）:**
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\logs\運用知見.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\logs\video-history.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\logs\投稿後トラッキング.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\logs\playbook.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\logs\ネタ候補.md`
- `C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\DB\logs\Detectorレポート.md`

---

## Step 1: 3専門エージェント並列チェック

**Agent tool で以下の3エージェントを同時に起動する（必ず並列）：**

### Agent A: YouTubeグロース専門家

DB/rules/ と DB/logs/ を全て読み込んだ上でチェック:

1. **数値基準の妥当性**
   - video-historyの直近1ヶ月の実績と、DB/rules/分析ルール.mdの基準を比較
   - CTR/維持率の閾値は実績に合っているか？（上方修正 or 下方修正が必要か）
   - 例: 平均CTRが7%超なら「6%以上=良好」は低すぎる → 引き上げ提案

2. **テーマバランス戦略の検証**
   - video-historyのテーマタイプ別成績を集計
   - DB/rules/戦略.mdのパワーパターンと実績が一致しているか？
   - 新しいパワーパターンが生まれていないか？

3. **競合環境の変化**
   - 勝ちパターン.mdの競合データが古くなっていないか
   - Aポジション（差別化軸）がまだ有効か

→ JSON形式で「更新提案リスト」を返す

### Agent B: 業務プロセス設計者

各スキルの実行ログと品質ゲートの結果を確認:

1. **フローの抜け・無駄**
   - 直近1ヶ月で品質ゲートに引っかかった回数・内容
   - スキップされがちなステップはないか
   - 新しいステップが必要になっていないか

2. **品質ゲートの形骸化チェック**
   - 常にパスしているゲートは基準が甘い可能性
   - 常に引っかかるゲートは基準が厳しすぎる or ルールが不明確

3. **データフローの整合性**
   - DB/rules/ の内容とスキル内の参照が一致しているか
   - 参照先のファイルが全て存在するか

→ JSON形式で「改善提案リスト」を返す

### Agent C: エンジニア（DB管理者）

DB自体の健全性をチェック:

1. **ルール層の鮮度**
   - DB/rules/ の各ファイルの `updated` 日付を確認
   - 30日以上更新されていないファイルがあれば警告

2. **ログ→ルール昇格の候補**
   - DB/logs/運用知見.md に3回以上参照されている知見はルール化すべき
   - 例: S006（感情むき出し）が毎回参照されるなら → サムネタイトルルール.mdに昇格

3. **重複・矛盾チェック**
   - DB/rules/ 内のファイル間で矛盾する記述がないか
   - CLAUDE.md とDB/rules/ の記述に齟齬がないか

4. **旧ファイルの残骸チェック**
   - DB移行前の旧パスにまだファイルが残っていないか
   - スキルが旧パスを参照していないか

→ JSON形式で「メンテナンス提案リスト」を返す

---

## Step 2: 統合レポート

3エージェントの結果を統合して以下を出力:

```markdown
# メタPDCAレポート（YYYY-MM-DD）

## サマリ
- 🟢/🟡/🔴 全体ステータス
- 検出した問題数: Critical X件 / Warning X件 / Info X件

## YouTubeグロース（Agent A）
### 数値基準の見直し提案
- ...
### テーマバランスの検証結果
- ...
### 競合環境の変化
- ...

## 業務プロセス（Agent B）
### フローの改善提案
- ...
### 品質ゲートの調整提案
- ...

## DB管理（Agent C）
### ルール層の鮮度
- ...
### ログ→ルール昇格候補
- ...
### 矛盾・重複
- ...

## 推奨アクション（優先順）
1. [Critical] ...
2. [Warning] ...
3. [Info] ...
```

---

## Step 3: ユーザー確認 → DB更新

- レポートをユーザーに提示
- **ユーザーの承認なしにDB/rules/を更新しない**
- 承認された項目のみ、該当するDB/rules/ファイルを更新
- 更新したファイルの `updated` 日付を更新
- 変更内容をDB/logs/運用知見.mdにも記録（「メタPDCA YYYY-MM-DD: ○○を変更」）

---

## Step 4: 完了報告

1. 更新したファイル一覧
2. 次回メタPDCAの推奨実行日（1ヶ月後）
3. 次回までに注視すべきポイント
