#!/usr/bin/env node
/**
 * 既存スプシ(1CKiLiAYg...)の「台本」シートをv12 TSVで上書きする
 * row1-3はテンプレートヘッダーなのでrow4以降を上書き（src/lib/google.ts の fillScriptSheet と同じロジック）
 */
import { readFile } from 'fs/promises';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env.local 簡易パース
function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (let line of content.split('\n')) {
    line = line.replace(/\r$/, '');  // Windows CRLF対応
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) {
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  }
  console.log(`📦 env loaded: GOOGLE_CLIENT_ID=${process.env.GOOGLE_CLIENT_ID ? '[set]' : '[MISSING]'} / REFRESH=${process.env.GOOGLE_REFRESH_TOKEN ? '[set]' : '[MISSING]'}`);
}
loadEnv(path.join(__dirname, '..', '.env.local'));

const SPREADSHEET_ID = '1CKiLiAYgM0JY4B1Lb8UuGQFgINggStcrQCJN9WA6ygM';
const SHEET_NAME = '台本';

function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

async function main() {
  // payload からscript取得
  const payload = JSON.parse(await readFile('save_payload_v12.json', 'utf8'));
  const script = payload.script;

  // SE自動付与（fillScriptSheetと同じロジック・が、TSVに既にSE列がある場合はそれを尊重）
  // v12 TSVは既に末尾SE1/SE2が入っているので、TSVをそのまま3列に分解
  const lines = script.split('\n').filter(l => l.trim());
  const rows = [];
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const speaker = parts[0].trim();
    const text = parts[1].trim();
    const se = (parts[2] || '').trim();
    if (!speaker || !text) continue;
    rows.push([speaker, text, se]);
  }

  console.log(`📊 行数: ${rows.length}`);

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. 既存range A4:C1000 をクリア
  console.log(`🧹 ${SHEET_NAME}!A4:C1000 をクリア中...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A4:C1000`,
  });
  console.log('✅ クリア完了');

  // 2. v12 TSVを書き込み
  console.log(`📝 ${SHEET_NAME}!A4 から書き込み中...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A4`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  });
  console.log('✅ 書き込み完了');

  // 3. 読み戻し検証
  console.log('\n🔍 読み戻し検証中...');
  const verify = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A4:C${4 + rows.length - 1}`,
  });
  const writtenRows = verify.data.values || [];
  console.log(`   書き込み行数: ${writtenRows.length} / 期待: ${rows.length}`);
  console.log(`   先頭行: ${writtenRows[0]?.join(' | ')}`);
  console.log(`   末尾行: ${writtenRows[writtenRows.length - 1]?.join(' | ')}`);

  // 文字化けチェック
  const garbled = /[̀-ͯ-]|[ŋɂ]/;
  const garbledRows = writtenRows.filter(r => r.some(cell => garbled.test(cell || '')));
  if (garbledRows.length > 0) {
    console.error(`❌ 文字化け検出: ${garbledRows.length}行`);
    process.exit(1);
  }
  console.log('✅ 文字化けなし');

  console.log('\n🟢 既存スプシ「台本」シート v12 上書き完了');
  console.log(`📄 https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
