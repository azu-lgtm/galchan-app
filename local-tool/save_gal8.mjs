#!/usr/bin/env node
/**
 * 自ガル8 既存スプシ上書き保存スクリプト
 * - 既存台本スプシ(11Vulc9rWw...)の「台本」「商品リスト」シートを上書き
 * - 管理スプシの動画管理表 row31 の H〜N列を更新
 * 事前に pre_save_gate.mjs 全通過済み前提
 * 安全チェック: 台本シート存在 + row31がgal8 を確認してから書き込む
 */
import { google } from 'googleapis';
import { readFile, writeFile } from 'fs/promises';

// ── .env.local 読み込み ──
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
const MGMT_SS = process.env.SPREADSHEET_ID_GALCHAN;
const MGMT_SHEET = '自分チャンネル・動画管理表';
const PAYLOAD = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal8.json';
const SCRIPT_URL = `https://docs.google.com/spreadsheets/d/${SCRIPT_SS}/edit`;

if (!MGMT_SS) throw new Error('SPREADSHEET_ID_GALCHAN 未設定');

const payload = JSON.parse(await readFile(PAYLOAD, 'utf8'));
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth });

// ── 安全チェック1: 台本スプシのシート確認 ──
const ssInfo = await sheets.spreadsheets.get({ spreadsheetId: SCRIPT_SS, fields: 'sheets.properties.title' });
const sheetNames = ssInfo.data.sheets.map(s => s.properties.title);
console.log('📋 台本スプシ シート:', sheetNames.join(', '));
if (!sheetNames.includes('台本')) throw new Error('「台本」シートが存在しない・中断');

// ── 安全チェック2: 管理シート row31 が自ガル8か ──
const rowCheck = await sheets.spreadsheets.values.get({ spreadsheetId: MGMT_SS, range: `${MGMT_SHEET}!F31:J31` });
const f31 = rowCheck.data.values?.[0]?.[0] || '';
console.log('📋 管理row31 F列(台本名):', f31);
console.log('📋 管理row31 J列(旧タイトル):', rowCheck.data.values?.[0]?.[4] || '(空)');
if (!f31.includes('自ガル8')) throw new Error(`row31が自ガル8じゃない（F列=${f31}）・中断`);

// ── 台本シート上書き（TSVの既存SE列を使用・自動生成しない）──
const lines = payload.script.split('\n').filter(l => l.trim());
const scriptRows = [];
for (const line of lines) {
  const p = line.split('\t');
  if (p.length < 2) continue;
  const sp = p[0].trim(), tx = p[1].trim(), se = (p[2] || '').trim();
  if (!sp || !tx) continue;
  scriptRows.push([sp, tx, se]);
}
await sheets.spreadsheets.values.clear({ spreadsheetId: SCRIPT_SS, range: '台本!A4:C2000' });
await sheets.spreadsheets.values.update({
  spreadsheetId: SCRIPT_SS, range: '台本!A4', valueInputOption: 'USER_ENTERED',
  requestBody: { values: scriptRows },
});
const seCount = scriptRows.filter(r => r[2]).length;
console.log(`✅ 台本シート上書き ${scriptRows.length}行（SE ${seCount}箇所）`);

// ── 商品リスト上書き ──
if (sheetNames.includes('商品リスト') && payload.materials.productList?.length) {
  const prods = payload.materials.productList;
  const prodRows = prods.map((p, i) => [
    i + 1, p.name, '',
    (p.amazonLink && /^https?:\/\//.test(p.amazonLink)) ? p.amazonLink : '',
    (p.rakutenLink && /^https?:\/\//.test(p.rakutenLink)) ? p.rakutenLink : '',
  ]);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SCRIPT_SS, range: '商品リスト!D1:E1', valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['Amazonリンク', '楽天リンク']] },
  });
  await sheets.spreadsheets.values.clear({ spreadsheetId: SCRIPT_SS, range: '商品リスト!A2:Z1000' });
  await sheets.spreadsheets.values.clear({ spreadsheetId: SCRIPT_SS, range: '商品リスト!G1:Z1' });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SCRIPT_SS, range: '商品リスト!A2', valueInputOption: 'USER_ENTERED',
    requestBody: { values: prodRows },
  });
  console.log(`✅ 商品リスト上書き ${prodRows.length}件`);
}

// ── 管理シート row31 の H〜N列更新 ──
const worker = (payload.materials.workerMessage || '').replace(/\{SPREADSHEET_URL\}/g, SCRIPT_URL);
const mgmtRow = [
  payload.topic.title,              // H テーマ
  payload.materials.thumbnails[0],  // I サムネ
  payload.materials.titles[0],      // J タイトル
  payload.materials.description,    // K 概要欄
  payload.materials.metaTags,       // L メタタグ
  payload.materials.pinComment,     // M 固定コメント
  worker,                           // N ワーカーへメッセージ
];
await sheets.spreadsheets.values.update({
  spreadsheetId: MGMT_SS, range: `${MGMT_SHEET}!H31:N31`, valueInputOption: 'USER_ENTERED',
  requestBody: { values: [mgmtRow] },
});
console.log('✅ 管理シート row31 H〜N列更新（テーマ/サムネ/タイトル/概要欄/メタタグ/固定コメ/ワーカー）');

const result = {
  savedAt: 'gal8-overwrite',
  scriptSpreadsheet: SCRIPT_URL,
  scriptRows: scriptRows.length,
  seCount,
  productCount: payload.materials.productList?.length || 0,
  title: payload.materials.titles[0],
  thumb: payload.materials.thumbnails[0],
};
await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_result_gal8.json', JSON.stringify(result, null, 2));
console.log('\n🟢 保存完了');
console.log(`📄 ${SCRIPT_URL}`);
