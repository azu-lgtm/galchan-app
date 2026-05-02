#!/usr/bin/env node
/**
 * 自ガル13 商品リストシート D=Amazon / E=楽天 列分割書込（v2 2026-05-02）
 * payload.materials.productList から amazonLink/rakutenLink を読んで
 * D列にAmazon URL単独 / E列に楽天 URL単独を書込む
 * ヘッダー(row1) D/E列も「Amazonリンク」「楽天リンク」に書換
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

const SPREADSHEET_ID = '1qGeJNnlxE5FusANna1riNN2_fFeGlDkky1BIm41bGXk';
const PAYLOAD_PATH = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal13.json';

const payload = JSON.parse(await readFile(PAYLOAD_PATH, 'utf8'));
const productList = payload.materials.productList;
if (!Array.isArray(productList) || productList.length === 0) {
  console.error('❌ productList空');
  process.exit(1);
}

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

// ヘッダー(row1) D/E列を分割形式に書換
console.log('🔧 ヘッダー row1 D/E列を「Amazonリンク」「楽天リンク」に書換');
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: '商品リスト!D1:E1',
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [['Amazonリンク', '楽天リンク']] },
});

// 既存D列を読み戻して順序確認
const cur = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '商品リスト!A2:E100',
});
const curRows = cur.data.values || [];
console.log(`現在の商品リスト行数: ${curRows.filter(r => r[1]).length}件`);
console.log(`payload productList: ${productList.length}件`);

// 商品名で照合してD/E列に分割書込
const deValues = [];
for (let i = 0; i < curRows.length; i++) {
  const sheetName = (curRows[i][1] || '').trim();
  const p = productList[i];
  if (!sheetName) {
    deValues.push(['', '']);
    continue;
  }
  if (!p) {
    console.warn(`⚠️ Row${i + 2} シート商品名「${sheetName}」だがpayloadに対応商品なし`);
    deValues.push(['', '']);
    continue;
  }
  if (sheetName !== p.name.trim()) {
    console.warn(`⚠️ Row${i + 2} 商品名不一致: シート「${sheetName}」 vs payload「${p.name}」`);
  }
  const az = p.amazonLink && /^https?:\/\//.test(p.amazonLink) ? p.amazonLink : '';
  const rk = p.rakutenLink && /^https?:\/\//.test(p.rakutenLink) ? p.rakutenLink : '';
  deValues.push([az, rk]);
}

await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: `商品リスト!D2:E${1 + deValues.length}`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: deValues },
});

console.log(`\n✅ D/E列書込完了 (${deValues.length}行)`);
console.log('読戻検証実行中...');

const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '商品リスト!A2:E100',
});
const verifyRows = verify.data.values || [];
let okCount = 0, ngCount = 0;
for (let i = 0; i < verifyRows.length; i++) {
  const r = verifyRows[i];
  if (!r[1]) continue;
  const hasAmazon = r[3] && /^https?:\/\//.test(r[3]);
  const hasRakuten = r[4] && /^https?:\/\//.test(r[4]);
  const ok = hasAmazon && hasRakuten;
  if (ok) okCount++; else ngCount++;
  console.log(`Row${i + 2}: ${ok ? '✅' : '❌'} ${r[1]} (Amazon:${hasAmazon ? '✓' : '×'} 楽天:${hasRakuten ? '✓' : '×'})`);
}
console.log(`\n結果: ${okCount}/${okCount + ngCount}件 D/E両リンク埋込`);
if (ngCount > 0) {
  console.error(`❌ ${ngCount}件 リンク欠落`);
  process.exit(1);
}
