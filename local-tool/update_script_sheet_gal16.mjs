#!/usr/bin/env node
/**
 * 自ガル16 v9 既存スプシの「台本」シートのみ更新
 * (新スプシ作成は不要・row41も既存のまま)
 * v8で保存済み(spreadsheet=1fmEuE-hm3dHN479LYL31g9VBYi2PncOiQyBwkPJ91Ls)を冒頭ナレ修正で上書き
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

const SPREADSHEET_ID = '1fmEuE-hm3dHN479LYL31g9VBYi2PncOiQyBwkPJ91Ls';
const SCRIPT_TSV = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル16台本】店舗別保存版_20260517.tsv';

const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth });

const tsvText = await readFile(SCRIPT_TSV, 'utf8');
const lines = tsvText.split('\n').filter(l => l.trim());

// fillScriptSheet ロジック踏襲: A=話者, B=本文, C=SE / row4から / SE自動生成(10発話ごとSE1/SE2交互)
const NO_SE_SPEAKERS = new Set(['ナレーション', 'タイトル']);
const SE_INTERVAL = 10;
let utteranceCount = 0;
let seIndex = 0;
const rows = [];

for (const line of lines) {
  const parts = line.split('\t');
  if (parts.length < 2) continue;
  const speaker = parts[0].trim();
  const text = parts[1].trim();
  if (!speaker || !text) continue;

  let se = '';
  if (!NO_SE_SPEAKERS.has(speaker)) {
    utteranceCount++;
    if (utteranceCount >= SE_INTERVAL) {
      se = seIndex % 2 === 0 ? 'SE1' : 'SE2';
      seIndex++;
      utteranceCount = 0;
    }
  }
  rows.push([speaker, text, se]);
}

console.log(`📝 台本行数: ${rows.length}`);
console.log(`📝 L1冒頭ナレ: ${rows[0]?.[1]?.slice(0, 50)}...`);

// 既存clear (row4以降)
await sheets.spreadsheets.values.clear({
  spreadsheetId: SPREADSHEET_ID,
  range: '台本!A4:C2000',
});

// 新規書き込み (row4から)
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: '台本!A4',
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: rows },
});

console.log('✅ 台本シート更新完了');
console.log(`📄 https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
