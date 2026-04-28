#!/usr/bin/env node
/**
 * 保存後に動画管理シートN列のワーカーメッセージ内 {SPREADSHEET_URL} を
 * 実際のスプシURLに置換する。
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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const MANAGEMENT_SPREADSHEET_ID = process.env.SPREADSHEET_ID_GALCHAN;
const SHEET_MANAGEMENT = '自分チャンネル・動画管理表';
const NEW_URL = 'https://docs.google.com/spreadsheets/d/1337fLo8LvUAYH7xauUHZRR_ju90pyBwD5WpBMXvTkXM/edit';

function getAuth() {
  const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return c;
}
const auth = getAuth();
const sheets = google.sheets({ version: 'v4', auth });

// 該当行を F列（台本名）で検索
const mgmt = await sheets.spreadsheets.values.get({
  spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
  range: `${SHEET_MANAGEMENT}!A:Q`,
});
const rows = mgmt.data.values || [];
const rowIdx = rows.findIndex(r => r && r[5] === '【自ガル11台本】');
if (rowIdx < 0) {
  console.error('❌ 動画管理シートに【自ガル11台本】行なし');
  process.exit(1);
}
const rowNum = rowIdx + 1;
const currentN = rows[rowIdx][13] || '';
console.log(`📍 該当行: row${rowNum}`);
console.log(`N列現状(先頭100字): ${currentN.slice(0, 100)}`);

const newWorker = currentN.replace('{SPREADSHEET_URL}', NEW_URL);
if (newWorker === currentN) {
  console.log('⚠️ {SPREADSHEET_URL} が見つからない・置換なし');
}

await sheets.spreadsheets.values.update({
  spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
  range: `${SHEET_MANAGEMENT}!N${rowNum}`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [[newWorker]] },
});
console.log(`✅ N${rowNum} 更新完了`);

// 読み戻し検証
const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
  range: `${SHEET_MANAGEMENT}!N${rowNum}`,
});
const after = verify.data.values?.[0]?.[0] || '';
console.log(`\n🔍 検証: URL埋込済み = ${after.includes(NEW_URL)}`);
console.log(`先頭200字: ${after.slice(0, 200)}`);
