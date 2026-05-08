import { google } from 'googleapis';
import { readFile } from 'fs/promises';
let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1);
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || !line.includes('=') || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  let v = line.slice(eq+1).trim();
  if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v = v.slice(1,-1);
  process.env[line.slice(0,eq).trim()] = v;
}
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth });

const cols = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

console.log('=== 動画管理シート ヘッダー(row10) ===');
const r = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.SPREADSHEET_ID_GALCHAN,
  range: '自分チャンネル・動画管理表!A10:Z10',
});
(r.data.values?.[0]||[]).forEach((v,i)=>console.log(`  ${cols[i]}: ${v}`));

console.log('\n=== row39 (自ガル14想定) フル内容 ===');
const r2 = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.SPREADSHEET_ID_GALCHAN,
  range: '自分チャンネル・動画管理表!A39:Z39',
});
const row = r2.data.values?.[0] || [];
row.forEach((v,i)=>{
  const val = (v||'').toString();
  console.log(`  ${cols[i]}: 長さ${val.length} | ${val.slice(0,200).replace(/\n/g,'⏎')}`);
});

// アフィリンク残存検出
console.log('\n=== アフィリンク残存検出 ===');
const affiPatterns = [
  /amazon\.co\.jp\/dp\//i,
  /tag=garuchannel/i,
  /search\.rakuten\.co\.jp/i,
  /item\.rakuten\.co\.jp/i,
];
let foundCount = 0;
row.forEach((v,i)=>{
  const val = (v||'').toString();
  for (const p of affiPatterns) {
    if (p.test(val)) {
      console.log(`  ⚠️ ${cols[i]}列にアフィパターン検出: ${p}`);
      foundCount++;
    }
  }
});
console.log(`残存セル: ${foundCount}件`);
