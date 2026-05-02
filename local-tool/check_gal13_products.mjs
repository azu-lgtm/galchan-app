#!/usr/bin/env node
/**
 * 自ガル13 商品リストシート 現状確認用（読み取り専用）
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

const SPREADSHEET_ID = process.argv[2] || '1qGeJNnlxE5FusANna1riNN2_fFeGlDkky1BIm41bGXk';

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '商品リスト!A1:F30',
});
console.log('=== 自ガル13 商品リストシート 現状 ===\n');
const rows = res.data.values || [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  console.log(`Row${i + 1}: A="${r[0] || ''}" | B="${r[1] || ''}" | C="${r[2] || ''}" | D="${(r[3] || '').slice(0, 80)}" | E="${(r[4] || '').slice(0, 80)}" | F="${(r[5] || '').slice(0, 80)}"`);
}
console.log(`\n総行数: ${rows.length}`);
