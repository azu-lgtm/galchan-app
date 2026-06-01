#!/usr/bin/env node
/**
 * 自ガル8 保存後の読み戻し検証
 * スプシに書いた内容を読み返して 化け/行数/タイトル/サムネ/反映 を確認
 */
import { google } from 'googleapis';
import { readFile } from 'fs/promises';

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

const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth });

// ── 台本シート読み戻し ──
const sc = await sheets.spreadsheets.values.get({ spreadsheetId: SCRIPT_SS, range: '台本!A4:C2000' });
const rows = sc.data.values || [];
console.log('=== 台本シート ===');
console.log('行数:', rows.length, '（期待280）');
console.log('L1:', JSON.stringify(rows[0]));
console.log('L2:', JSON.stringify(rows[1]));
console.log('末尾:', JSON.stringify(rows[rows.length - 1]));

const garbled = /[̀-ͯ-]|[ŋɂ]|□/;
let garbHit = 0;
for (const r of rows) if (r.some(c => garbled.test(c || ''))) garbHit++;
console.log('化け行数:', garbHit, '（期待0）');

const allText = rows.map(r => r[1] || '').join('\n');
console.log('--- 反映チェック ---');
console.log('① 冒頭ナレ豆乳(コップを持つ手が止まりました):', allText.includes('コップを持つ手が止まりました'));
console.log('② 導入圧縮(まず朝のコーヒーの話から一個ずつ聞きたいな):', allText.includes('まず朝のコーヒーの話から一個ずつ聞きたいな'));
console.log('③ 旧導入残存NG(ネットで調べても記事によって):', allText.includes('ネットで調べても記事によって'));
console.log('④ 旧冒頭ナレ残存NG(良かれと思って続けてた習慣があって):', allText.includes('良かれと思って続けてた習慣があって'));
console.log('⑤ 語尾修正(全然違ったよ):', allText.includes('全然違ったよ'));
console.log('⑥ エンディング(最後までご視聴ありがとうございました):', allText.includes('最後までご視聴ありがとうございました'));

// ── 管理row31読み戻し ──
const mg = await sheets.spreadsheets.values.get({ spreadsheetId: MGMT_SS, range: `${MGMT_SHEET}!H31:N31` });
const m = mg.data.values?.[0] || [];
console.log('\n=== 管理シート row31 ===');
console.log('H テーマ:', (m[0] || '').slice(0, 50));
console.log('I サムネ:', (m[1] || '').slice(0, 70));
console.log('J タイトル:', m[2]);
console.log('K 概要欄:', (m[3] || '').length, '字');
console.log('L メタタグ:', m[4]);
console.log('M 固定コメ:', (m[5] || '').length, '字');
console.log('N ワーカー:', (m[6] || '').length, '字 / URL置換OK:', !(m[6] || '').includes('{SPREADSHEET_URL}'));
console.log('--- サムネ反映チェック ---');
console.log('I 更年期真っ只中:', (m[1] || '').includes('更年期真っ只中'));
console.log('I 女医もやってる乗り越え方:', (m[1] || '').includes('女医もやってる乗り越え方'));
console.log('I 旧26選残存NG:', (m[1] || '').includes('26選'));
console.log('J タイトル11選:', (m[2] || '').includes('11選'));
console.log('J 旧26選残存NG:', (m[2] || '').includes('26選'));
