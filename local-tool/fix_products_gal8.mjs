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

const SCRIPT_SS = '11Vulc9rWw-RnRcoi_jbWgs58h8pff_Aa4RWO1gBPhnc';
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth });

// F列以降（備考の古いメモ・G/H列の古いリンク・余分ヘッダー）を全クリア
await sheets.spreadsheets.values.clear({ spreadsheetId: SCRIPT_SS, range: '商品リスト!F1:Z1000' });
console.log('✅ 商品リスト F1:Z1000 クリア（古い備考・重複リンク・余分列を削除）');

// 確認読み戻し
const r = await sheets.spreadsheets.values.get({ spreadsheetId: SCRIPT_SS, range: '商品リスト!A1:H15' });
const rows = r.data.values || [];
console.log('\n=== 修正後 商品リスト A1:H15 ===');
for (const [i, row] of rows.entries()) {
  const cells = (row || []).map((c, j) => `${String.fromCharCode(65 + j)}="${(c || '').slice(0, 30)}"`);
  console.log(`R${i + 1}: ${cells.join(' | ')}`);
}
