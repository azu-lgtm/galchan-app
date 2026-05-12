#!/usr/bin/env node
/**
 * 自ガル15スプシ実体読み戻し検証
 * 反映漏れキーワード（中華製/韓国コスメ/マジ大事じゃない/旧冒頭ナレ等）の残存を検出
 * 2026-05-12 azu指摘・反映漏れ全件検証
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
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
}

const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

const SS_ID = '1Fdep87AOlSTT578tw2PTfkDYgJRTb8sMwyVyT1rkqrc';

const meta = await sheets.spreadsheets.get({ spreadsheetId: SS_ID });
const sheetNames = meta.data.sheets.map(s => s.properties.title);
console.log('Sheets:', sheetNames);

const res = await sheets.spreadsheets.values.get({ spreadsheetId: SS_ID, range: '台本!A1:C300' });
const rows = res.data.values || [];
console.log(`\n=== 台本シート ${rows.length}行 ===`);

const flat = rows.flat().join('\n');
const checks = [
  ['中華製LED電球（基本情報・要修正）', /中華製LED電球/],
  ['並行輸入韓国コスメ（基本情報・要修正）', /並行輸入韓国コスメ/],
  ['中華製電気圧力鍋（基本情報・要修正）', /中華製電気圧力鍋/],
  ['中華製キッチン家電（本文・要修正）', /中華製キッチン家電/],
  ['マジ大事じゃない（要修正→じゃん）', /マジ大事じゃない/],
  ['家族や自分の健康を守りたい方（要削除・冒頭から）', /家族や自分の健康を守りたい方/],
  ['今回は、Amazonで国が注意喚起（要削除・冒頭3行目）', /今回は、Amazonで国が注意喚起/],
  ['Amazonで国警告された（要修正→国が警告した）', /Amazonで国警告された/],
  ['L99 安い中華製でマーク偽装（azu判断待ち）', /安い中華製でマーク偽装/],
  ['L159 韓国コスメも人気で（azu判断待ち）', /韓国コスメも人気で/],
];

console.log('\n=== 残存違反語スキャン ===');
let residual = 0;
checks.forEach(([name, rx]) => {
  if (rx.test(flat)) {
    console.log(`❌ 残存: ${name}`);
    residual++;
  } else {
    console.log(`✅ なし: ${name}`);
  }
});

console.log(`\n📊 残存数: ${residual}/${checks.length}`);

console.log('\n=== 冒頭5行（A4-A8） ===');
rows.slice(3, 8).forEach((row, i) => {
  console.log(`Row ${4 + i}: [${(row[0] ?? '').padEnd(10)}] ${(row[1] ?? '').slice(0, 90)}`);
});

console.log(`\n=== L76相当箇所（スプシ Row 79=スレ民1冒頭）周辺 ===`);
rows.slice(75, 82).forEach((row, i) => {
  console.log(`Row ${76 + i}: [${(row[0] ?? '').padEnd(10)}] ${(row[1] ?? '').slice(0, 90)}`);
});
