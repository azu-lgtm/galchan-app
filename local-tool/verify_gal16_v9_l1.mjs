#!/usr/bin/env node
/**
 * 自ガル16 v9 台本シートの冒頭ナレL1だけ読み戻し確認
 */
import { google } from 'googleapis';
import { readFile } from 'fs/promises';

let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1);
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || !line.includes('=') || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  let v = line.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[line.slice(0, eq).trim()] = v;
}

const SPREADSHEET_ID = '1fmEuE-hm3dHN479LYL31g9VBYi2PncOiQyBwkPJ91Ls';
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth });

const r = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '台本!A4:C6',
});
console.log('🔍 台本シート L1-L3:');
for (const row of r.data.values || []) {
  console.log('  speaker:', row[0]);
  console.log('  text:', row[1]);
  console.log('  SE:', row[2] || '(空)');
  console.log('  ---');
}
