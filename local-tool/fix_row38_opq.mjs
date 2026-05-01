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

const payload = JSON.parse(await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal13.json', 'utf8'));
const angle = 'ハイブリッド10NG+10OK×医師・公的機関警告×家庭の知恵';
const styleLabel = '商品';
const memo = payload.materials.managementMemo || '';

await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: process.env.SPREADSHEET_ID_GALCHAN,
  requestBody: {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: '自分チャンネル・動画管理表!O38', values: [[angle]] },
      { range: '自分チャンネル・動画管理表!P38', values: [[styleLabel]] },
      { range: '自分チャンネル・動画管理表!Q38', values: [[memo]] },
    ],
  },
});

console.log('✅ row38 O/P/Q 補正完了');
console.log('  O(切り口):', angle);
console.log('  P(動画企画の型):', styleLabel);
console.log('  Q(メモ):', memo.slice(0, 80) + (memo.length > 80 ? '…' : ''));
