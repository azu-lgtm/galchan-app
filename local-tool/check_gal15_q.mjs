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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
}

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

const ID = process.env.SPREADSHEET_ID_GALCHAN;
const labels = ['A:ワーカー', 'B:納品期限', 'C:納品', 'D:DL', 'E:投稿日', 'F:台本名', 'G:台本リンク', 'H:テーマ', 'I:サムネ', 'J:タイトル', 'K:概要欄', 'L:メタタグ', 'M:固定コメ', 'N:ワーカーメッセ', 'O:切り口', 'P:動画企画の型', 'Q:メモ'];

console.log('=== gal15 (row40) Q列 ===');
const r40 = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: '自分チャンネル・動画管理表!A40:Q40' });
const row40 = r40.data.values?.[0] || [];
console.log(`Q列値: "${(row40[16] || '').slice(0,200)}" (len=${(row40[16]||'').length})`);
console.log(`O列(切り口): "${(row40[14] || '').slice(0,80)}"`);
console.log(`P列(企画型): "${(row40[15] || '').slice(0,80)}"`);

console.log('\n=== gal16 (row41) 現状 ===');
const r41 = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: '自分チャンネル・動画管理表!A41:Q41' });
const row41 = r41.data.values?.[0] || [];
for (let i = 0; i < labels.length; i++) {
  const v = row41[i] || '';
  console.log(`${labels[i]}: "${v.slice(0, 80)}${v.length > 80 ? '...' : ''}" (len=${v.length})`);
}
