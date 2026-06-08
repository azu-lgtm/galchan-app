/**
 * 自ガル17 置き型エアコン詐欺ネタ追加（azu指示 2026-06-08）を反映。
 * TSVを正としてスプシ台本シート再書き込み＋Obsidian MD台本全文ブロック再生成（SE完全同期）。
 * fillScriptSheet (src/lib/google.ts) のSE再計算ロジックを忠実複製。
 * バリデーション（連続話者・70字超）も実施。
 */
import { readFile, writeFile } from 'fs/promises';
import { google } from 'googleapis';

const SPREADSHEET_ID = '10pcb2fGb_BQy5IayodTGRSvxsbsKsWhouq8IqiqTGt0';
const TSV = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル17台本】物価高で手放して正解だったもの_20260607.tsv';
const MD = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/台本/【自ガル17台本】物価高で手放して正解だったもの_20260607.md';

// .env.local 手動パース
const envText = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) { let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; }
}
const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: client });

// ── SE再計算（fillScriptSheet複製）──
const script = await readFile(TSV, 'utf8');
const NO_SE = new Set(['ナレーション', 'タイトル']);
const SE_INTERVAL = 10;
let uc = 0, si = 0;
const rows = [];
for (const line of script.split('\n').filter(l => l.trim())) {
  const p = line.split('\t');
  if (p.length < 2) continue;
  const speaker = p[0].trim(), text = p[1].trim();
  if (!speaker || !text) continue;
  let se = '';
  if (!NO_SE.has(speaker)) { uc++; if (uc >= SE_INTERVAL) { se = si % 2 === 0 ? 'SE1' : 'SE2'; si++; uc = 0; } }
  rows.push([speaker, text, se]);
}

// ── バリデーション ──
let prevSpeaker = null, consecutive = 0, longLines = 0;
const issues = [];
rows.forEach((r, i) => {
  const [sp, tx] = r;
  if (sp === prevSpeaker) { consecutive++; issues.push(`連続話者 row${i + 4}: ${sp}`); }
  prevSpeaker = sp;
  const len = tx.replace(/\s/g, '').length;
  if (len > 70) { longLines++; issues.push(`70字超 row${i + 4}(${len}字): ${tx.slice(0, 20)}…`); }
});
console.log('🔍 バリデーション:');
console.log('  総行数:', rows.length, '（intro含む全話者）');
console.log('  連続話者:', consecutive, '件');
console.log('  70字超:', longLines, '件');
if (issues.length) { console.log('  ⚠️ 詳細:'); issues.forEach(x => console.log('    -', x)); }
else console.log('  ✅ 連続話者0・70字超0');

// ── スプシ再書き込み ──
console.log('\n🚀 スプシ台本シート再書き込み...');
await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: '台本!A4:C1000' });
await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: '台本!A4', valueInputOption: 'USER_ENTERED', requestBody: { values: rows } });

// ── MD台本全文ブロック再生成（SE完全同期）──
const md = await readFile(MD, 'utf8');
const blockText = rows.map(([sp, tx, se]) => se ? `${sp}\t${tx}\t${se}` : `${sp}\t${tx}`).join('\n');
// 「## 台本全文…」見出し直後の ``` … ``` を置換
const re = /(##\s*台本全文[^\n]*\n+```\n)[\s\S]*?(\n```)/;
if (!re.test(md)) { console.error('❌ MD台本全文コードブロックが見つからない'); process.exit(1); }
const newMd = md.replace(re, `$1${blockText}$2`);
await writeFile(MD, newMd, 'utf8');
console.log('✅ MD台本全文ブロック再生成完了（SE同期）');

// ── 読み戻し検証（置き型エアコンブロック）──
const check = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: '台本!A4:C300' });
const v = check.data.values || [];
const aircon = v.map((r, i) => ({ row: i + 4, sp: r[0], tx: r[1] || '' })).filter(x => x.tx.includes('置くだけ') || x.tx.includes('エアコン') || x.tx.includes('ただのファン') || x.tx.includes('かわいそう'));
console.log('\n📖 読み戻し検証（置き型エアコンブロック）:');
aircon.forEach(x => console.log(`  row${x.row}: ${x.sp} | ${x.tx.slice(0, 44)}`));
console.log('\n  シート総データ行:', v.length, '/ rows書込:', rows.length);
console.log('✅ 完了');
