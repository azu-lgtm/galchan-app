#!/usr/bin/env node
/**
 * 自ガル12台本スプシの「台本」シート（A4以降）を修正済みTSVで上書き
 * 2026-04-28 ユーザー指摘（ガル民呼称/個人の感想/断定しない/語尾偏り）反映
 * 2026-04-28 追加: コスメ2行削除後の215行版に対応・既存B4:C300クリアして再書き込み
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

const scriptSheetName = '台本';

const tsvRaw = await readFile(TSV_PATH, 'utf8');
const lines = tsvRaw.split('\n').filter(l => l.length > 0);
console.log(`📄 修正済みTSV: ${lines.length}行`);

const rows = lines.map(line => {
  const cols = line.split('\t');
  return [cols[0] || '', cols[1] || '', cols[2] || ''];
});

// 既存範囲（A4:C300）を完全クリアしてから書き込み（古いデータ残存防止）
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
if (/ガル民/.test(flat)) violations.push('ガル民');
if (/個人の感想/.test(flat)) violations.push('個人の感想');
if (/公的裏取り/.test(flat)) violations.push('公的裏取り');
if (/断定しない/.test(flat)) violations.push('断定しない');
if (/これ事実ね/.test(flat)) violations.push('これ事実ね');
if (/CICAトナーパッド/.test(flat)) violations.push('CICAトナーパッド（コスメ混入）');

if (violations.length > 0) {
  console.error(`\n❌ 違反検出: ${violations.join(', ')}`);
  process.exit(1);
}
console.log('\n✅ 違反語: なし（クリーン・コスメ2行削除済）');
