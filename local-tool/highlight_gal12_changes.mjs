#!/usr/bin/env node
/**
 * 自ガル12台本スプシの主要修正18行をB列黄色背景に塗りつぶし
 * 修正内容: ガル民呼称13行 + 個人の感想2行 + これ事実ね1行 + 断定しない2行
 *
 * 2026-04-28 追加更新: コスメ2行削除（旧L62-63）後、TSV L62以降の修正行は-2シフト
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

const SS_ID = '1I_pPfbCbQhEjaGR9T_9-qpSY88kbBvF4YpFJGUTgxXQ';

const meta = await sheets.spreadsheets.get({ spreadsheetId: SS_ID });
const scriptSheet = meta.data.sheets.find(s => s.properties.title === '台本');
if (!scriptSheet) {
  console.error('❌ 台本シートが見つからない');
  process.exit(1);
}
const sheetId = scriptSheet.properties.sheetId;

// コスメ2行削除後のTSV行番号 → スプシ行番号
// 削除前TSV: L13, L22, L33, L35, L48, L56, L61, L68, L69, L70, L82, L91, L102, L119, L132, L143, L159, L177
// 削除後TSV: L62以降(=L62, 63削除)が-2シフト
const tsvRows = [13, 22, 33, 35, 48, 56, 61, 66, 67, 68, 80, 89, 100, 117, 130, 141, 157, 175];
const sheetRowsZeroIdx = tsvRows.map(r => r + 3 - 1);

console.log(`🎨 修正18行をB列に黄色背景塗りつぶし開始（削除後シフト適用済み）`);
console.log(`対象スプシ行: ${tsvRows.map(r => r + 3).join(', ')}`);

// まず台本シート全体のB列背景色をリセット（既存の塗りつぶしクリア）
console.log('🗑 既存塗りつぶしクリア（B4:B220）');
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SS_ID,
  requestBody: {
    requests: [{
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 3,
          endRowIndex: 220,
          startColumnIndex: 1,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 1, blue: 1 },
          },
        },
        fields: 'userEnteredFormat.backgroundColor',
      },
    }],
  },
});

// 新しい行に黄色適用
const requests = sheetRowsZeroIdx.map(rowIdx => ({
  repeatCell: {
    range: {
      sheetId,
      startRowIndex: rowIdx,
      endRowIndex: rowIdx + 1,
      startColumnIndex: 1,
      endColumnIndex: 2,
    },
    cell: {
      userEnteredFormat: {
        backgroundColor: { red: 1.0, green: 0.95, blue: 0.6 },
      },
    },
    fields: 'userEnteredFormat.backgroundColor',
  },
}));

await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SS_ID,
  requestBody: { requests },
});

console.log(`✅ 18行のB列セルを黄色背景に塗りつぶし完了`);
console.log(`📋 https://docs.google.com/spreadsheets/d/${SS_ID}/edit`);
