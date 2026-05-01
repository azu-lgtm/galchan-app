#!/usr/bin/env node
/**
 * 自ガル13台本 会話型語尾リライト (2026-05-01・GPTs指針反映)
 * レポート型「〜だ。」「〜なんだ。」「〜したんだ。」を会話型「〜だよ。」「〜なのよね。」「〜したのよ。」等に変換
 */
import { readFile, writeFile } from 'fs/promises';

const TSV_PATH = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル13台本】ダイエット_20260429.tsv';

let content = await readFile(TSV_PATH, 'utf8');

// 高頻度パターン置換 (安全な変換のみ)
const replacements = [
  // 進行形+んだ → 会話型
  ['言ってるんだ。', '言ってるよ。'],
  ['証言してるんだ。', '証言してるよね。'],
  ['報告されてるんだ。', '報告されてるんだって。'],
  ['注目されてるんだ。', '注目されてるみたい。'],
  ['なってるんだ。', 'なってるよね。'],
  ['出てるんだ。', '出てるみたい。'],
  ['減ってるんだ。', '減ってるみたい。'],
  ['連動してるんだ。', '連動してるみたい。'],
  ['儀式化するんだ。', '儀式化するの。'],

  // 動詞+んだ系
  ['判明したんだ。', '判明したのよ。'],
  ['撤廃したんだ。', '撤廃したのよ。'],
  ['真似したんだ。', '真似したわ。'],
  ['いったんだ。', 'いったのよ。'],
  ['行ったんだ。', '行ったの。'],

  // なるんだ → なるんだって/なるみたい
  ['なるんだ。', 'なるみたい。'],
  ['太りやすくなるんだ。', '太りやすくなるんだって。'],

  // 〜なんだ。→ 〜なんだよね/〜なのよ
  ['本当に怖い', '本当に怖いよね'],
  ['構造なんだ。', '構造なの。'],
  ['ことなんだ。', 'ことなんだよね。'],
  ['コツなんだ。', 'コツなのよ。'],
  ['負担なんだ', '負担なのよ'],

  // 〜だ。終止形 → 〜だよ。/ 〜なの。
  ['都市伝説系。', '都市伝説系。'], // already OK
  ['昔ながらの食養生。', '昔ながらの食養生だよね。'],
  ['食べないだけ系。', '食べないだけ系。'], // OK as is (declarative・問題提起)
  ['朝抜き、昼サラダだけ、みたいな極端な食事制限。', '朝抜き、昼サラダだけ、みたいな極端な食事制限ね。'],

  // 〜だ。 末尾→ 〜だよね/〜なの
  ['事実だ。', '事実だよ。'],
  ['だ。', 'だよ。'].slice(0, 0),  // skip - dangerous

  // 「〜してる」「〜だ」連発の柔らかな修正
  ['消費カロリーが高いんだ。', '消費カロリーが高いんだって。'],
  ['それくらい大事な関節だ。', 'それくらい大事な関節なの。'],
  ['本当に怖いんだ。', '本当に怖いよね。'],
];

let count = 0;
for (const [old, neu] of replacements) {
  if (!old || !neu) continue;
  const before = content;
  content = content.split(old).join(neu);
  const occurrences = (before.length - content.length) / (old.length - neu.length);
  if (Math.abs(before.length - content.length) > 0) count++;
}

// "[X]だ。" 行末特定パターン → "[X]だよ。"(safe whitelist)
// これは context-sensitive なのでスキップ・手動修正に委任

await writeFile(TSV_PATH, content, 'utf8');
console.log(`✅ 会話型リライト完了: ${count} パターン適用`);
console.log(`保存先: ${TSV_PATH}`);
