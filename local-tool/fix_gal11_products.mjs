#!/usr/bin/env node
/**
 * 自ガル11 商品リストシートにアフィリンクを書き足す
 */
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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const NEW_SPREADSHEET_ID = '1337fLo8LvUAYH7xauUHZRR_ju90pyBwD5WpBMXvTkXM';

const pinMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル11】固定コメント.md';
const pinRaw = await readFile(pinMdPath, 'utf8');
const productBlocks = pinRaw.split(/^■\s+/m).slice(1);
const productList = productBlocks.map(block => {
  const lines = block.split('\n');
  const name = lines[0].trim();
  const amazonLine = lines.find(l => l.startsWith('Amazon:')) || '';
  const rakutenLine = lines.find(l => l.startsWith('楽天:')) || '';
  return {
    name,
    amazonLink: amazonLine.replace(/^Amazon:\s*/, '').trim(),
    rakutenLink: rakutenLine.replace(/^楽天:\s*/, '').trim(),
  };
}).filter(p => p.name && !p.name.startsWith('※'));

console.log(`📦 ${productList.length}件読み込み`);

function getAuth() {
  const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return c;
}
const auth = getAuth();
const sheets = google.sheets({ version: 'v4', auth });

// 商品リストシートのA-D列を更新: No/商品名/型番/商品リンク
const rows = productList.map((p, i) => [
  i + 1,
  p.name,
  '',  // 型番は空欄（品番禁止ルール）
  p.amazonLink || p.rakutenLink || '',
]);

// clear + update
await sheets.spreadsheets.values.clear({ spreadsheetId: NEW_SPREADSHEET_ID, range: '商品リスト!A2:D100' });
await sheets.spreadsheets.values.update({
  spreadsheetId: NEW_SPREADSHEET_ID,
  range: '商品リスト!A2',
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: rows },
});
console.log(`✅ 商品リスト ${rows.length}件 更新（アフィリンク付き）`);

// 読み戻し検証
const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: NEW_SPREADSHEET_ID,
  range: '商品リスト!A1:D25',
});
console.log('\n🔍 読み戻し検証:');
for (const row of (verify.data.values || [])) {
  const linkDisplay = (row[3] || '').slice(0, 60);
  console.log(`  ${row[0] || ''}  ${row[1] || ''}  ${linkDisplay}${(row[3] || '').length > 60 ? '...' : ''}`);
}
