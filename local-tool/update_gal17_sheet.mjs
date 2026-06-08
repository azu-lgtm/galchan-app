/**
 * 自ガル17 台本ファクト修正(L74/L95/L108)を既存スプシに反映。
 * 新規作成せず、既存スプシの「台本」シートA4:Cのみ再書き込み（動画管理row非変更）。
 * fillScriptSheet (src/lib/google.ts) のロジックを忠実に複製（SEは10発話ごとに再計算）。
 */
import { readFile } from 'fs/promises';
import { google } from 'googleapis';

const SPREADSHEET_ID = '10pcb2fGb_BQy5IayodTGRSvxsbsKsWhouq8IqiqTGt0';
const tsvPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル17台本】物価高で手放して正解だったもの_20260607.tsv';

// .env.local を手動パース
const envText = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);
client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: client });

// ── fillScriptSheet ロジック複製 ──
const script = await readFile(tsvPath, 'utf8');
const NO_SE_SPEAKERS = new Set(['ナレーション', 'タイトル']);
const SE_INTERVAL = 10;
let utteranceCount = 0, seIndex = 0;
const lines = script.split('\n').filter(l => l.trim());
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
    if (utteranceCount >= SE_INTERVAL) { se = seIndex % 2 === 0 ? 'SE1' : 'SE2'; seIndex++; utteranceCount = 0; }
  }
  rows.push([speaker, text, se]);
}

console.log('🚀 既存スプシ台本シート再書き込み...');
console.log('   spreadsheet:', SPREADSHEET_ID, '/ rows:', rows.length);

await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: '台本!A4:C1000' });
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: '台本!A4',
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: rows },
});

// ── 読み戻し検証 ──
// 冒頭: L1=row4, L2(タイトルコール)=row5, L3a=row6, L3b=row7, L4(責任転嫁)=row8
const introCheck = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '台本!A4:C8' });
const iv = introCheck.data.values || [];
console.log('\n📖 読み戻し検証（冒頭 row4-8）:');
['row4','row5(タイトルコール)','row6(L3a)','row7(L3b)','row8(責任転嫁)'].forEach((label,i)=>{
  const r = iv[i] || [];
  console.log(`  ${label}:`, `${r[0]||''} | ${(r[1]||'').slice(0,48)}`);
});

// 既存ファクト修正3行（L3a/L3b挿入で+1シフト: row78/99/112）
const check = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '台本!A75:C113' });
const vals = check.data.values || [];
const at = (sheetRow) => { const r = vals[sheetRow - 75] || []; return `${r[0]||''} | ${(r[1]||'').slice(0,40)}`; };
console.log('\n📖 読み戻し検証（既存ファクト修正箇所・+1シフト後）:');
console.log('  row78(扇風機):', at(78));
console.log('  row99(きのこ):', at(99));
console.log('  row112(マヨ):', at(112));
console.log('\n✅ 台本シート更新完了');
