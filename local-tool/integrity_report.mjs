#!/usr/bin/env node
/**
 * 整合性レポート生成（サムネ訴求 vs 台本実測）
 * 使い方: node integrity_report.mjs <台本MD> <サムネ訴求文字列>
 *
 * ユーザー承認ワークフロー（2026-04-21新設）:
 * 1. サムネ/タイトル先決定（秒数・回数確定）
 * 2. 台本にその値を盛り込む
 * 3. このスクリプトで整合性レポート生成
 * 4. ユーザー確認→OKなら進める
 */
import { readFile } from 'fs/promises';

const scriptPath = process.argv[2];
const thumbText = process.argv[3];
if (!scriptPath || !thumbText) {
  console.error('使い方: node integrity_report.mjs <台本MD> <サムネ訴求文字列>');
  process.exit(1);
}

const fullMd = await readFile(scriptPath, 'utf8');
// 【基本のやり方】セクションのみ抽出（冒頭ダイジェストや【よくある間違い】の「15秒」混入を防ぐ）
const basicSection = fullMd.match(/【基本のやり方】([\s\S]*?)(?=【よくある間違い】|【続けるコツ】|【1週間|【始める前)/);
const script = basicSection ? basicSection[1] : (fullMd.split(/^##\s*台本\s*$/m)[1] || fullMd);

// サムネ訴求時間抽出
const thumbMinMatch = thumbText.match(/(\d+)\s*分/);
const thumbSecMatch = thumbText.match(/(\d+)\s*秒/);
const thumbTotalSec = thumbMinMatch ? parseInt(thumbMinMatch[1]) * 60 : (thumbSecMatch ? parseInt(thumbSecMatch[1]) : null);

if (!thumbTotalSec) {
  console.error('サムネに分/秒の数字が見つかりません');
  process.exit(1);
}

// 台本から動作抽出
const rows = [];
let totalSec = 0;

// キープ/止める系
const keepPattern = /(\d+)\s*秒(?:キープ|止める)(?:[^。]*?反対側)?/g;
for (const m of script.matchAll(keepPattern)) {
  const num = parseInt(m[1]);
  rows.push({ type: 'stretch', text: m[0].slice(0, 50), seconds: num * 2 });
  totalSec += num * 2;
}

// 回数系（「右に/左に」等の明示動作指示のみ）
const repPattern = /右\s*に\s*(\d+)\s*回[、、]\s*左\s*に\s*(\d+)\s*回/g;
for (const m of script.matchAll(repPattern)) {
  const right = parseInt(m[1]);
  const left = parseInt(m[2]);
  const sec = (right + left) * 2;
  rows.push({ type: 'reps', text: m[0].slice(0, 50), seconds: sec });
  totalSec += sec;
}

// 合計記載の抽出
const totalStatementMatch = script.match(/合計\s*(?:およそ|約)?\s*(\d+)\s*分/) || script.match(/(\d+)\s*分で(?:合計|完結|完了|終わる|できる)/);
const statedTotal = totalStatementMatch ? totalStatementMatch[0] : '（記載なし）';

const diff = totalSec - thumbTotalSec;
const verdict = diff <= 0 ? '✅ 整合性が取れています（サムネ内完結）' : '❌ サムネ超過・修正必須';

console.log(`\n### ✅ 整合性レポート\n`);
console.log(`**サムネの訴求内容**`);
console.log(`- サムネ: ${thumbText}`);
console.log(`- 訴求時間: **${thumbMinMatch ? thumbMinMatch[1] + '分' : thumbSecMatch[1] + '秒'}（${thumbTotalSec}秒）**\n`);

console.log(`**台本の該当部分**`);
console.log(`| 動作/種別 | 台本該当 | 秒数・回数 |`);
console.log(`|---|---|---|`);
for (const r of rows) {
  console.log(`| ${r.type} | 「${r.text}」 | ${r.seconds}秒 |`);
}
console.log(`| 合計記載 | ${statedTotal} | — |\n`);

console.log(`**実測合計: ${totalSec}秒 = ${Math.floor(totalSec/60)}分${totalSec%60}秒**`);
console.log(`**サムネ訴求: ${thumbTotalSec}秒**`);
console.log(`**差: ${diff}秒${diff <= 0 ? '（サムネ内に収まる）' : '（超過）'}**\n`);

console.log(`### ${verdict}`);

process.exit(diff <= 0 ? 0 : 1);
