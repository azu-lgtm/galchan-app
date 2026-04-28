#!/usr/bin/env node
/**
 * 自ガル12 商品リストシートD列補完
 * save_payload_gal12.json の productList から amazonLink/rakutenLink を取得し、
 * スプシ「商品リスト」シートのD列に「Amazon: ... / 楽天: ...」型で書き込む
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

const NEW_SS = '1I_pPfbCbQhEjaGR9T_9-qpSY88kbBvF4YpFJGUTgxXQ';
const PAYLOAD = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal12.json';

const payload = JSON.parse(await readFile(PAYLOAD, 'utf8'));
const products = payload.materials.productList || [];
console.log(`📦 productList: ${products.length}件`);

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

// 商品リストシート読込（B列商品名でマッチ）
const cur = await sheets.spreadsheets.values.get({
  spreadsheetId: NEW_SS,
  range: '商品リスト!A1:D100',
});
const curRows = cur.data.values || [];
console.log(`📊 既存行数: ${curRows.length}（ヘッダー含む）`);

// row2以降の商品名（B列）と payload.productList をマッチング
const updates = [];
for (let i = 1; i < curRows.length; i++) {
  const rowNum = i + 1;
  const name = (curRows[i][1] || '').trim();
  if (!name) continue;
  const p = products.find(x => x.name.trim() === name);
  if (!p) {
    console.log(`⚠️ row${rowNum} 「${name}」: payload中に該当なし・スキップ`);
    continue;
  }
  const link = `Amazon: ${p.amazonLink}\n楽天: ${p.rakutenLink}`;
  updates.push({ range: `商品リスト!D${rowNum}`, values: [[link]] });
  console.log(`📝 row${rowNum} 「${name}」: D列補完予定`);
}

if (updates.length === 0) {
  console.log('⚠️ 更新対象なし');
  process.exit(0);
}

// バッチ更新
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: NEW_SS,
  requestBody: {
    valueInputOption: 'USER_ENTERED',
    data: updates,
  },
});
console.log(`✅ ${updates.length}件のD列を更新`);

// 読み戻し検証
const after = await sheets.spreadsheets.values.get({
  spreadsheetId: NEW_SS,
  range: '商品リスト!A1:D100',
});
const afterRows = after.data.values || [];
const filledCount = afterRows.slice(1).filter(r => r[1] && r[3] && /https?:\/\//.test(r[3])).length;
const totalCount = afterRows.slice(1).filter(r => r[1]).length;
console.log(`\n🔍 検証: ${filledCount}/${totalCount}件・D列にリンク埋込済`);
if (filledCount < totalCount) {
  console.error(`❌ ${totalCount - filledCount}件 D列空欄残存`);
  process.exit(1);
}
console.log('🟢 商品リストD列 全件PASS');
