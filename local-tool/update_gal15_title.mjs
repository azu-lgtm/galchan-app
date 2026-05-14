/**
 * 自ガル15 タイトル変更反映
 * - 台本シート: タイトル行のB列を新タイトルで更新
 * - 動画管理表 row40: H列(テーマ)・J列(タイトル)を新タイトルで更新（末尾【有益ガルちゃん】付き）
 */
import { google } from 'googleapis';
import { readFile } from 'fs/promises';

let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1);
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || !line.includes('=') || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  let v = line.slice(eq+1).trim();
  if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v = v.slice(1,-1);
  process.env[line.slice(0,eq).trim()] = v;
}
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth });

// 自ガル15 台本シートID（status.md記載）
const scriptSheetId = '1Fdep87AOlSTT578tw2PTfkDYgJRTb8sMwyVyT1rkqrc';
const mgmtSheetId = process.env.SPREADSHEET_ID_GALCHAN;

// 新タイトル（J案・azu確定 2026-05-14）
const newTitleCore = '【消費者庁・NITE警告】Amazonで売れてる危険商品20選＋神商品10選';
const newTitleFull = newTitleCore + '【有益ガルちゃん】';

console.log('===自ガル15タイトル変更反映===');
console.log('新タイトル(本体)', newTitleCore.length, '字');
console.log('新タイトル(末尾【有益ガルちゃん】付き):', newTitleFull.length, '字');
console.log();

// 1. 台本シートのタイトル行を検索
console.log('--- 1. 台本シート タイトル行検索 ---');
const scriptRes = await sheets.spreadsheets.values.get({
  spreadsheetId: scriptSheetId,
  range: 'A1:C20',
});
let titleRowIdx = -1;
scriptRes.data.values?.forEach((row, i) => {
  if (row[0] === 'タイトル') titleRowIdx = i + 1;
});
if (titleRowIdx < 0) {
  console.error('❌ 台本シート B列「タイトル」行が見つかりません');
  process.exit(1);
}
console.log(`タイトル行発見: row${titleRowIdx}`);
const beforeScript = (scriptRes.data.values?.[titleRowIdx-1]?.[1] || '');
console.log(`現状値: ${beforeScript.slice(0, 100)}`);

// 2. 台本シート タイトル行B列を更新（本体のみ・スプシ内タイトル）
await sheets.spreadsheets.values.update({
  spreadsheetId: scriptSheetId,
  range: `B${titleRowIdx}`,
  valueInputOption: 'RAW',
  requestBody: { values: [[newTitleCore]] },
});
console.log(`✅ 台本シート B${titleRowIdx} 更新完了`);
console.log();

// 3. 動画管理表 row40 H列・J列を更新（末尾【有益ガルちゃん】付き）
console.log('--- 3. 動画管理表 row40 H列・J列 更新 ---');
await sheets.spreadsheets.values.update({
  spreadsheetId: mgmtSheetId,
  range: '自分チャンネル・動画管理表!H40',
  valueInputOption: 'RAW',
  requestBody: { values: [[newTitleFull]] },
});
console.log('✅ H40(テーマ) 更新完了');

await sheets.spreadsheets.values.update({
  spreadsheetId: mgmtSheetId,
  range: '自分チャンネル・動画管理表!J40',
  valueInputOption: 'RAW',
  requestBody: { values: [[newTitleFull]] },
});
console.log('✅ J40(タイトル) 更新完了');
console.log();

// 4. 書き戻し検証
console.log('--- 4. 書き戻し検証 ---');
const verifyScript = await sheets.spreadsheets.values.get({
  spreadsheetId: scriptSheetId,
  range: `B${titleRowIdx}`,
});
console.log(`台本シート B${titleRowIdx}:`, verifyScript.data.values?.[0]?.[0]);
console.log('  一致:', verifyScript.data.values?.[0]?.[0] === newTitleCore ? '✅' : '❌');

const verifyMgmt = await sheets.spreadsheets.values.get({
  spreadsheetId: mgmtSheetId,
  range: '自分チャンネル・動画管理表!H40:J40',
});
const mgmtRow = verifyMgmt.data.values?.[0] || [];
console.log(`管理表 H40:`, mgmtRow[0]);
console.log('  一致:', mgmtRow[0] === newTitleFull ? '✅' : '❌');
console.log(`管理表 J40:`, mgmtRow[2]);
console.log('  一致:', mgmtRow[2] === newTitleFull ? '✅' : '❌');

console.log('\n🟢 タイトル変更反映完了');
