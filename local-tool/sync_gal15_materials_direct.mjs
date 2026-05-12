#!/usr/bin/env node
/**
 * 自ガル15 動画管理表 row 40 概要欄/固定コメ/ワーカー直接同期
 * dev server起動なしで直接Sheets APIで書き戻し
 * 2026-05-12 azu反映漏れ修正
 */
import { readFile, writeFile } from 'fs/promises';
import { google } from 'googleapis';

const envRaw = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
for (const line of envRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
}

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

const MGMT_SS_ID = process.env.SPREADSHEET_ID_GALCHAN;
const ROW = 40;

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n+/, '').replace(/^#\s+.*\n/, '').trim();
}

const desc = stripFrontmatter(await readFile('C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル15】概要欄_20260512.md', 'utf8'));
const pin = stripFrontmatter(await readFile('C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル15】固定コメント_20260512.md', 'utf8'));
const worker = stripFrontmatter(await readFile('C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル15】ワーカーメッセージ_20260512.md', 'utf8'));

console.log(`📦 K列(概要欄): ${desc.length}字`);
console.log(`📦 M列(固定コメ): ${pin.length}字`);
console.log(`📦 N列(ワーカー): ${worker.length}字`);

// row 40 現状確認
console.log(`\n=== row ${ROW} 現状確認 ===`);
const before = await sheets.spreadsheets.values.get({
  spreadsheetId: MGMT_SS_ID,
  range: `自分チャンネル・動画管理表!A${ROW}:N${ROW}`,
});
const beforeRow = (before.data.values || [[]])[0] || [];
['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach((col, i) => {
  const v = (beforeRow[i] || '').slice(0, 60);
  console.log(`  ${col}: ${v}${(beforeRow[i] || '').length > 60 ? '...' : ''}`);
});

// 中華製/韓国コスメ等の残存検査（書き戻し前）
const beforeFlat = beforeRow.join('\n');
const checks = [
  ['中華製電気圧力鍋', /中華製電気圧力鍋/],
  ['中華製キッチン家電', /中華製キッチン家電/],
  ['並行輸入韓国コスメ', /並行輸入韓国コスメ/],
  ['国警告された', /国警告された/],
];
console.log('\n=== 書き戻し前・残存検査 ===');
checks.forEach(([name, rx]) => {
  console.log(rx.test(beforeFlat) ? `❌ 残存: ${name}` : `✅ なし: ${name}`);
});

// 書き戻し（K, M, N列・row 40）
console.log(`\n=== 書き戻し開始 ===`);
const updates = [
  { range: `自分チャンネル・動画管理表!K${ROW}`, values: [[desc]] },
  { range: `自分チャンネル・動画管理表!M${ROW}`, values: [[pin]] },
  { range: `自分チャンネル・動画管理表!N${ROW}`, values: [[worker]] },
];
const result = await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: MGMT_SS_ID,
  requestBody: {
    valueInputOption: 'RAW',
    data: updates,
  },
});
console.log('✅ batchUpdate完了:', result.data.totalUpdatedCells, 'cells');

// 書き戻し後の検証
console.log(`\n=== 書き戻し後の検証 ===`);
const after = await sheets.spreadsheets.values.get({
  spreadsheetId: MGMT_SS_ID,
  range: `自分チャンネル・動画管理表!K${ROW}:N${ROW}`,
});
const afterRow = (after.data.values || [[]])[0] || [];
const afterFlat = afterRow.join('\n');
checks.forEach(([name, rx]) => {
  console.log(rx.test(afterFlat) ? `❌ 残存: ${name}` : `✅ なし: ${name}`);
});

console.log(`\n📊 K40長さ: ${(afterRow[0] || '').length}字 / M40長さ: ${(afterRow[2] || '').length}字 / N40長さ: ${(afterRow[3] || '').length}字`);
