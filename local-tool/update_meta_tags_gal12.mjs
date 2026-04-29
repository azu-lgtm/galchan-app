#!/usr/bin/env node
/**
 * 自ガル12 メタタグ L列再更新
 * 修正版メタタグ.mdの内容で動画管理シートL列を上書き
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

const META_MD = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル12】メタタグ.md';
const MGMT_ID = process.env.SPREADSHEET_ID_GALCHAN;
const SHEET = '自分チャンネル・動画管理表';

const md = await readFile(META_MD, 'utf8');
// 「1. ...」「2. ...」を抽出してカンマ連結
const tags = [];
for (const line of md.split('\n')) {
  const m = line.match(/^\d+\.\s+(.+?)\s*$/);
  if (m) tags.push(m[1].trim());
  if (tags.length >= 5) break;
}
const metaTags = tags.join(',');
console.log(`📦 メタタグ(${tags.length}個): ${metaTags}`);

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
  range: `${SHEET}!L${rowNum}`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [[metaTags]] },
});
console.log(`✅ L${rowNum} メタタグ更新完了`);

const v = await sheets.spreadsheets.values.get({ spreadsheetId: MGMT_ID, range: `${SHEET}!L${rowNum}` });
const after = v.data.values?.[0]?.[0] || '';
console.log(`🔍 検証: 「${after}」`);
console.log(`同期OK: ${after === metaTags}`);
