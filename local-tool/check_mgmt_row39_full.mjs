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

const r2 = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.SPREADSHEET_ID_GALCHAN,
  range: '自分チャンネル・動画管理表!A39:Z39',
});
const row = r2.data.values?.[0] || [];

console.log('=== row39 K列(概要欄) 全文 アフィパターン検索 ===');
const affiPatterns = [
  /amazon\.co\.jp\/dp\//i,
  /tag=garuchannel/i,
  /search\.rakuten\.co\.jp/i,
  /item\.rakuten\.co\.jp/i,
  /amzn\.to/i,
  /a\.r10\.to/i,
];

let foundTotal = 0;
['K','M','N'].forEach((colName) => {
  const idx = cols.indexOf(colName);
  const text = (row[idx]||'').toString();
  console.log(`\n--- ${colName}列 全${text.length}字 ---`);
  let foundLocal = 0;
  for (const p of affiPatterns) {
    const matches = text.match(new RegExp(p.source, p.flags + 'g'));
    if (matches) {
      console.log(`  ⚠️ ${p}: ${matches.length}件`);
      matches.slice(0, 5).forEach(m => console.log(`     → ${m}`));
      foundLocal += matches.length;
    }
  }
  if (foundLocal === 0) console.log('  ✅ アフィリンクなし');
  foundTotal += foundLocal;
});

console.log(`\n総検出: ${foundTotal}件`);
