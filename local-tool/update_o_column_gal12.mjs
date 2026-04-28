#!/usr/bin/env node
/**
 * 自ガル12 動画管理シート row37 O列入力
 * O列（視聴維持率ピークの内容/切り口メモ）を埋める
 *
 * 注意: 台本ルール.mdではO列=「視聴維持率ピークの内容」、P列=「切り口」だが、
 * ユーザー指示でO列に切り口テキストを入力する（P列は既に短縮版あり、O列に詳細版を入れる位置付け）
 */
import { readFile } from 'fs/promises';
import { google } from 'googleapis';

const envRaw = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
for (const line of envRaw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[k] = v;
}

const MGMT_ID = process.env.SPREADSHEET_ID_GALCHAN;
const SHEET = '自分チャンネル・動画管理表';
const O_VALUE = '元ドンキ店員警告×店舗縛り×ランキング+1位匂わせ+ハイブリッド型（PB良品+大手代替）';

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

const mgmt = await sheets.spreadsheets.values.get({ spreadsheetId: MGMT_ID, range: `${SHEET}!A:Q` });
const rows = mgmt.data.values || [];
const idx = rows.findIndex(r => r && r[5] === '【自ガル12台本】');
if (idx < 0) { console.error('❌ row not found'); process.exit(1); }
const rowNum = idx + 1;

await sheets.spreadsheets.values.update({
  spreadsheetId: MGMT_ID,
  range: `${SHEET}!O${rowNum}`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [[O_VALUE]] },
});
console.log(`✅ O${rowNum} 入力完了`);

const v = await sheets.spreadsheets.values.get({ spreadsheetId: MGMT_ID, range: `${SHEET}!O${rowNum}` });
const after = v.data.values?.[0]?.[0] || '';
console.log(`🔍 検証: 「${after}」`);
console.log(`同期OK: ${after === O_VALUE}`);
