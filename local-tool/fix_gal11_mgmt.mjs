#!/usr/bin/env node
/**
 * 自ガル11 動画管理シート row36 のO-Q列を修正
 * buildManagementRow が列ズレしてるバグの修復
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

const MANAGEMENT_SPREADSHEET_ID = process.env.SPREADSHEET_ID_GALCHAN;
const SHEET_MANAGEMENT = '自分チャンネル・動画管理表';

function getAuth() {
  const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return c;
}
const auth = getAuth();
const sheets = google.sheets({ version: 'v4', auth });

// 該当行取得
const mgmt = await sheets.spreadsheets.values.get({
  spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
  range: `${SHEET_MANAGEMENT}!A:Q`,
});
const rows = mgmt.data.values || [];
const rowIdx = rows.findIndex(r => r && r[5] === '【自ガル11台本】');
if (rowIdx < 0) {
  console.error('❌ 【自ガル11台本】の行なし');
  process.exit(1);
}
const rowNum = rowIdx + 1;
console.log(`📍 該当行: row${rowNum}`);
console.log(`現状 O列: "${rows[rowIdx][14] || '(空)'}"`);
console.log(`現状 P列: "${rows[rowIdx][15] || '(空)'}"`);
console.log(`現状 Q列: "${rows[rowIdx][16] || '(空)'}"`);

// 正しい列順で更新
const OPQ = [
  '元ホームセンター店員警告・ランキング形式カウントダウン+ネガポジペア型',  // O 切り口
  '商品',  // P 動画企画の型
  '【企画理由】自ガル10(食品詐欺)でCTR8.8%達成後、食品系被り回避+40代以降女性が日常的に行く店×失敗/危険/後悔回避の軸で店舗縛り（ホームセンター）×元店員権威武装を採用。消費者庁リコール6件武装（カインズサーキュレーター/星テック電気敷毛布/電気こたつ等）でランキング形式1位意外性フック\n【セッション記録】Obsidian: 08_ai_chat_memo/galchan-app/セッション_20260424_自ガル11完遂.md\n【媒体】消費者庁リコール情報サイト/NITE配線器具事故統計/日本照明工業会LED電球適合器具案内/カインズ公式自主回収情報/ガルちゃんweb掲示板\n【競合】ガル姫「買って後悔した日用品」系動画群 / 聖徳太子ch等 ホームセンター真正面扱い競合12ch完全空き=Aポジ独占',  // Q メモ
];

await sheets.spreadsheets.values.update({
  spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
  range: `${SHEET_MANAGEMENT}!O${rowNum}:Q${rowNum}`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [OPQ] },
});
console.log(`✅ O-Q列更新完了`);

// 検証
const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
  range: `${SHEET_MANAGEMENT}!O${rowNum}:Q${rowNum}`,
});
const after = verify.data.values?.[0] || [];
console.log(`\n🔍 検証`);
console.log(`  O列: "${(after[0] || '').slice(0, 60)}..."`);
console.log(`  P列: "${after[1] || ''}"`);
console.log(`  Q列: "${(after[2] || '').slice(0, 60)}..."`);
