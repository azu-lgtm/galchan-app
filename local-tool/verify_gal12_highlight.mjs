#!/usr/bin/env node
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
console.log(`シート名: ${scriptSheet.properties.title}, sheetId: ${scriptSheet.properties.sheetId}`);

// 修正対象18行のB列の背景色を確認
const tsvRows = [13, 22, 33, 35, 48, 56, 61, 68, 69, 70, 82, 91, 102, 119, 132, 143, 159, 177];
const sheetRows = tsvRows.map(r => r + 3);

console.log(`\n対象18行のB列セル背景色を確認:`);
for (const sheetRow of sheetRows) {
  const range = `台本!B${sheetRow}`;
  const data = await sheets.spreadsheets.get({
    spreadsheetId: SS_ID,
    ranges: [range],
    includeGridData: true,
  });
  const rowData = data.data.sheets[0].data[0].rowData?.[0];
  const cell = rowData?.values?.[0];
  const bg = cell?.userEnteredFormat?.backgroundColor || cell?.effectiveFormat?.backgroundColor;
  const value = (cell?.formattedValue || '').slice(0, 40);
  console.log(`B${sheetRow}: bg=${JSON.stringify(bg)} | "${value}"`);
}
