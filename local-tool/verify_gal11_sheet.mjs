#!/usr/bin/env node
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

const NEW_SPREADSHEET_ID = '1337fLo8LvUAYH7xauUHZRR_ju90pyBwD5WpBMXvTkXM';

function getAuth() {
  const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return c;
}
const auth = getAuth();
const sheets = google.sheets({ version: 'v4', auth });

// シート一覧取得
const meta = await sheets.spreadsheets.get({ spreadsheetId: NEW_SPREADSHEET_ID, fields: 'sheets.properties' });
console.log('📋 シート一覧:');
for (const s of meta.data.sheets) {
  console.log(`  - ${s.properties.title} (sheetId: ${s.properties.sheetId})`);
}

// 台本シート先頭確認
const script = await sheets.spreadsheets.values.get({ spreadsheetId: NEW_SPREADSHEET_ID, range: '台本!A1:C10' });
console.log('\n📜 台本シート 先頭10行:');
for (const row of (script.data.values || [])) {
  console.log(' ', JSON.stringify(row));
}

// 商品リストシート全件確認
try {
  const products = await sheets.spreadsheets.values.get({ spreadsheetId: NEW_SPREADSHEET_ID, range: '商品リスト!A1:F50' });
  console.log('\n🛍 商品リストシート:');
  for (const row of (products.data.values || [])) {
    console.log(' ', JSON.stringify(row));
  }
} catch (e) {
  console.log('\n⚠️ 商品リストシート取得失敗:', e.message);
}
