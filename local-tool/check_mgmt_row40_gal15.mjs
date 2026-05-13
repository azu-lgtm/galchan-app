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

const cols = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

const headerRes = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.SPREADSHEET_ID_GALCHAN,
  range: '自分チャンネル・動画管理表!A10:T10',
});
console.log('=== ヘッダー(row10) ===');
(headerRes.data.values?.[0]||[]).forEach((v,i)=>console.log(`  ${cols[i]}: ${v}`));

const r2 = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.SPREADSHEET_ID_GALCHAN,
  range: '自分チャンネル・動画管理表!A40:T40',
});
console.log('\n=== row40(自ガル15)現状 ===');
(r2.data.values?.[0]||[]).forEach((v,i)=>console.log(`  ${cols[i]}: ${(v||'').toString().slice(0,100)}`));
