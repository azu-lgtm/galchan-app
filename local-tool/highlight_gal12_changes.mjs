#!/usr/bin/env node
/**
 * 自ガル12台本スプシの主要修正18行をB列黄色背景に塗りつぶし
 * 修正内容: ガル民呼称13行 + 個人の感想2行 + これ事実ね1行 + 断定しない2行
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

// 「台本」シートのIDを取得
const meta = await sheets.spreadsheets.get({ spreadsheetId: SS_ID });
const scriptSheet = meta.data.sheets.find(s => s.properties.title === '台本');
if (!scriptSheet) {
  console.error('❌ 台本シートが見つからない');
  process.exit(1);
}
const sheetId = scriptSheet.properties.sheetId;

// 修正対象のTSV行番号 → スプシ行番号（+3 for headers）
const tsvRows = [13, 22, 33, 35, 48, 56, 61, 68, 69, 70, 82, 91, 102, 119, 132, 143, 159, 177];
const sheetRowsZeroIdx = tsvRows.map(r => r + 3 - 1); // 0-indexed for API

console.log(`🎨 修正18行をB列に黄色背景塗りつぶし開始`);
console.log(`対象スプシ行: ${tsvRows.map(r => r + 3).join(', ')}`);

// バッチリクエスト: B列セル（columnIndex=1）に黄色背景
const requests = sheetRowsZeroIdx.map(rowIdx => ({
  repeatCell: {
    range: {
      sheetId,
      startRowIndex: rowIdx,
      endRowIndex: rowIdx + 1,
      startColumnIndex: 1, // B列
      endColumnIndex: 2,
    },
    cell: {
      userEnteredFormat: {
        backgroundColor: { red: 1.0, green: 0.95, blue: 0.6 }, // 薄い黄色
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
