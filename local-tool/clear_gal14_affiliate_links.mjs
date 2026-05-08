#!/usr/bin/env node
/**
 * 自ガル14 アフィリンク削除（100均テーマ・アフィ運用なし）
 * - 商品リストシート D列(Amazon)/E列(楽天)を空にする
 * - 動画管理シート row39 のアフィリンク関連列を確認・削除
 * - 商品名/価格/メーカー（A-C列）は維持
 *
 * ユーザー指示「商品リストに残ってる諸々。けして」（2026-05-09）
 */
import { readFile } from 'fs/promises';
import { google } from 'googleapis';

// ── env読込 ──
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

// ── 自ガル14スプシ ──
const SPREADSHEET_ID = '1s3iszJhzs5Iu1UDX-RG12GevF9ilpwqmzMbyXl3uGSE';

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

// ── スプシのシート一覧確認 ──
console.log('🔍 スプシのシート一覧確認...');
const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
const sheetNames = meta.data.sheets.map(s => s.properties.title);
console.log(`  シート一覧: ${sheetNames.join(' / ')}`);

// ── ステップ1: 商品リストシート D/E列を確認&クリア ──
console.log('\n■ ステップ1: 商品リストシート D列(Amazon)/E列(楽天)クリア');

// 削除前読み取り
const before = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '商品リスト!A1:E100',
});
const beforeRows = before.data.values || [];
console.log(`  読込行数: ${beforeRows.length}行`);
console.log(`  ヘッダー: ${JSON.stringify(beforeRows[0])}`);

let deleteCellCount = 0;
const productRows = [];
for (let i = 1; i < beforeRows.length; i++) {
  const r = beforeRows[i] || [];
  const name = (r[1] || '').trim();
  if (!name) continue;
  const hasAmazon = r[3] && /^https?:\/\//.test(r[3]);
  const hasRakuten = r[4] && /^https?:\/\//.test(r[4]);
  if (hasAmazon) deleteCellCount++;
  if (hasRakuten) deleteCellCount++;
  productRows.push({ rowNum: i + 1, name, hasAmazon, hasRakuten });
}
console.log(`  商品行数: ${productRows.length}件 / 削除予定セル数: ${deleteCellCount}セル`);

// クリア用values生成（商品行数分・空配列）
const clearValues = productRows.map(() => ['', '']);
const clearRangeStart = productRows[0].rowNum;
const clearRangeEnd = productRows[productRows.length - 1].rowNum;

console.log(`  → ${clearRangeStart}〜${clearRangeEnd}行のD/E列を空にする...`);
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: `商品リスト!D${clearRangeStart}:E${clearRangeEnd}`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: clearValues },
});
console.log('  ✅ D/E列クリア完了');

// ── ステップ2: 動画管理シート row39 確認 ──
console.log('\n■ ステップ2: 動画管理シート row39 確認');
let mgmtSheetName = sheetNames.find(n => n.includes('動画管理') || n === '動画管理');
if (!mgmtSheetName) {
  // 自ガル14は新規スプシなので動画管理シートは別スプシ。本スプシには存在しないはず
  console.log('  動画管理シート無し（自ガル14専用スプシ・動画管理は別スプシ）→ スキップ');
} else {
  console.log(`  動画管理シート発見: ${mgmtSheetName}`);
  const r39 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${mgmtSheetName}!A39:Z39`,
  });
  console.log(`  row39: ${JSON.stringify(r39.data.values || [])}`);
}

// ── ステップ3: 検証（読戻し） ──
console.log('\n■ ステップ3: 検証（読戻し）');
const after = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: '商品リスト!A1:E100',
});
const afterRows = after.data.values || [];

let okCount = 0;
let ngCount = 0;
console.log('  商品リスト残存確認:');
for (let i = 1; i < afterRows.length; i++) {
  const r = afterRows[i] || [];
  const name = (r[1] || '').trim();
  if (!name) continue;
  const amazon = r[3] || '';
  const rakuten = r[4] || '';
  const hasAffiliate = /^https?:\/\//.test(amazon) || /^https?:\/\//.test(rakuten);
  if (hasAffiliate) {
    ngCount++;
    console.log(`    Row${i + 1}: ❌ ${name} (Amazon:"${amazon}" 楽天:"${rakuten}")`);
  } else {
    okCount++;
    console.log(`    Row${i + 1}: ✅ ${name} (D/E列とも空)`);
  }
}

console.log(`\n結果: ${okCount}件 クリア確認 / ${ngCount}件 残存`);
if (ngCount > 0) {
  console.error('❌ アフィリンク残存あり');
  process.exit(1);
}
console.log('🟢 スプシD/E列クリア完了');
