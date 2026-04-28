#!/usr/bin/env node
/**
 * 自ガル12台本スプシの「台本」シート（A4以降）を修正済みTSVで上書き
 * 2026-04-28 ユーザー指摘（ガル民呼称/個人の感想/断定しない/語尾偏り）反映
 */
import { readFile } from 'fs/promises';
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

const SS_ID = '1I_pPfbCbQhEjaGR9T_9-qpSY88kbBvF4YpFJGUTgxXQ';
const TSV_PATH = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル12台本】ドンキ_20260427.tsv';

console.log('===== シート一覧確認 =====');
const meta = await sheets.spreadsheets.get({ spreadsheetId: SS_ID });
for (const s of meta.data.sheets) {
  console.log(`- ${s.properties.title} (id=${s.properties.sheetId}, rows=${s.properties.gridProperties.rowCount})`);
}

console.log('\n===== 台本シート現状確認 (A1:C5) =====');
let scriptSheetName = null;
for (const candidate of ['台本', 'Sheet1', '台本シート']) {
  try {
    const head = await sheets.spreadsheets.values.get({ spreadsheetId: SS_ID, range: `${candidate}!A1:C5` });
    if (head.data.values) {
      scriptSheetName = candidate;
      console.log(`✅ シート発見: "${candidate}"`);
      for (const r of head.data.values) console.log(JSON.stringify(r));
      break;
    }
  } catch (e) {
    // continue
  }
}
if (!scriptSheetName) {
  console.error('❌ 台本シートが見つからない');
  process.exit(1);
}

// TSV読み込み・パース
const tsvRaw = await readFile(TSV_PATH, 'utf8');
const lines = tsvRaw.split('\n').filter(l => l.length > 0);
console.log(`\n📄 修正済みTSV: ${lines.length}行`);

// 各行を [話者, 本文, SE] に分解
const rows = lines.map(line => {
  const cols = line.split('\t');
  return [cols[0] || '', cols[1] || '', cols[2] || ''];
});

console.log(`\n===== 台本シート更新前の行数確認 =====`);
const before = await sheets.spreadsheets.values.get({ spreadsheetId: SS_ID, range: `${scriptSheetName}!A1:C300` });
console.log(`既存行数: ${(before.data.values || []).length}`);

// A4以降に書き込み（行1-3はヘッダーと仮定）
// まず既存A4:C300をクリア
console.log(`\n🗑 既存範囲クリア: ${scriptSheetName}!A4:C300`);
await sheets.spreadsheets.values.clear({ spreadsheetId: SS_ID, range: `${scriptSheetName}!A4:C300` });

// 修正版を書き込み
const writeRange = `${scriptSheetName}!A4:C${4 + rows.length - 1}`;
console.log(`✏️ 書き込み: ${writeRange}`);
await sheets.spreadsheets.values.update({
  spreadsheetId: SS_ID,
  range: writeRange,
  valueInputOption: 'RAW',
  requestBody: { values: rows },
});

console.log(`\n✅ 完了: ${rows.length}行書き込み`);

// 読み戻し検証
console.log('\n===== 読み戻し検証 (先頭3行+末尾3行) =====');
const after = await sheets.spreadsheets.values.get({ spreadsheetId: SS_ID, range: `${scriptSheetName}!A1:C${4 + rows.length - 1}` });
const got = after.data.values || [];
console.log(`取得行数: ${got.length}`);
console.log('--- 先頭5行 ---');
got.slice(0, 5).forEach((r, i) => console.log(`L${i + 1}: ${JSON.stringify(r)}`));
console.log('--- 末尾5行 ---');
got.slice(-5).forEach((r, i) => console.log(`L${got.length - 5 + i + 1}: ${JSON.stringify(r)}`));

// ガル民/個人の感想/断定しない の混入チェック
const flat = got.flat().join('\n');
const violations = [];
if (/ガル民/.test(flat)) violations.push('ガル民');
if (/個人の感想/.test(flat)) violations.push('個人の感想');
if (/公的裏取り/.test(flat)) violations.push('公的裏取り');
if (/断定しない/.test(flat)) violations.push('断定しない');
if (/これ事実ね/.test(flat)) violations.push('これ事実ね');

if (violations.length > 0) {
  console.error(`\n❌ 違反検出: ${violations.join(', ')}`);
  process.exit(1);
}
console.log('\n✅ 違反語: なし（クリーン）');
