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

const NEW_ID = '1I_pPfbCbQhEjaGR9T_9-qpSY88kbBvF4YpFJGUTgxXQ';

console.log('===== 新スプシのシート一覧 =====');
const meta = await sheets.spreadsheets.get({ spreadsheetId: NEW_ID });
for (const s of meta.data.sheets) {
  console.log(`- ${s.properties.title} (id=${s.properties.sheetId})`);
}

console.log('\n===== 新スプシの「商品リスト」 A1:E20 =====');
try {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: NEW_ID, range: '商品リスト!A1:E20' });
  for (const r of (res.data.values || [])) {
    console.log(JSON.stringify(r));
  }
} catch (e) {
  console.log('商品リストエラー:', e.message);
}

console.log('\n===== 動画管理シート row37 全列 =====');
const mgmt = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.SPREADSHEET_ID_GALCHAN,
  range: '自分チャンネル・動画管理表!A37:Q37',
});
const row = mgmt.data.values?.[0] || [];
const labels = ['A:ワーカー', 'B:納品期限', 'C:納品', 'D:DL', 'E:投稿日', 'F:台本名', 'G:台本リンク', 'H:テーマ', 'I:サムネ', 'J:タイトル', 'K:概要欄', 'L:メタタグ', 'M:固定コメ', 'N:ワーカーメッセ', 'O:切り口', 'P:動画企画の型', 'Q:メモ'];
for (let i = 0; i < labels.length; i++) {
  const v = row[i] || '';
  console.log(`${labels[i]}: "${v.slice(0, 80)}${v.length > 80 ? '...' : ''}" (len=${v.length})`);
}
