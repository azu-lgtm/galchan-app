#!/usr/bin/env node
/**
 * 自ガル15台本スプシの「台本」シート（A4以降）を修正済みTSVで上書き
 * 2026-05-12 azu AIレビュー3点反映（注意喚起/カンマ追加/格安電気圧力鍋）
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

const SS_ID = '1Fdep87AOlSTT578tw2PTfkDYgJRTb8sMwyVyT1rkqrc';
const TSV_PATH = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル15台本】Amazon危険商品_20260512.tsv';

const scriptSheetName = '台本';

const tsvRaw = await readFile(TSV_PATH, 'utf8');
const lines = tsvRaw.split('\n').filter(l => l.length > 0);
console.log(`📄 修正済みTSV: ${lines.length}行`);

const rows = lines.map(line => {
  const cols = line.split('\t');
  return [cols[0] || '', cols[1] || '', cols[2] || ''];
});

console.log(`🗑 既存範囲クリア: ${scriptSheetName}!A4:C300`);
await sheets.spreadsheets.values.clear({ spreadsheetId: SS_ID, range: `${scriptSheetName}!A4:C300` });

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
const after = await sheets.spreadsheets.values.get({ spreadsheetId: SS_ID, range: `${scriptSheetName}!A1:C${4 + rows.length - 1}` });
const got = after.data.values || [];
console.log(`取得行数: ${got.length}`);

const flat = got.flat().join('\n');
const violations = [];
if (/紅麹/.test(flat)) violations.push('紅麹（永久ブラックリスト）');
if (/中華製の電気圧力鍋/.test(flat)) violations.push('中華製の電気圧力鍋（削除対象残存）');
if (/67817台/.test(flat)) violations.push('67817台（カンマなし）');
if (/警告って大事じゃない/.test(flat)) violations.push('警告って大事じゃない（旧表現残存）');

if (violations.length > 0) {
  console.error(`\n❌ 違反検出: ${violations.join(', ')}`);
  process.exit(1);
}
console.log('\n✅ 違反語: なし（azu AIレビュー3点修正クリーン反映）');
