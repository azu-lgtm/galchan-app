#!/usr/bin/env node
/**
 * 動画管理シートの現状を確認する（自ガル12保存用）
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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.SPREADSHEET_ID_GALCHAN,
  range: '自分チャンネル・動画管理表!A:G',
});
const rows = res.data.values || [];
console.log('Total rows:', rows.length);
console.log('Last 5 rows (F=台本名, G=台本リンク):');
const start = Math.max(0, rows.length - 5);
for (let i = start; i < rows.length; i++) {
  const r = rows[i];
  console.log(`row${i+1}: F="${r?.[5] || ''}" G="${(r?.[6] || '').slice(0, 60)}"`);
}

// 自ガル12があるか確認
const idx = rows.findIndex(r => r && r[5] === '【自ガル12台本】');
console.log('\n自ガル12 already exists at row:', idx >= 0 ? idx + 1 : 'NOT FOUND');
