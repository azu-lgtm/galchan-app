#!/usr/bin/env node
/**
 * ガル10台本を既存スプシ（1oYLcPKn...）に上書き+列幅設定
 * pre_save_gate.mjs 通過後のみ実行
 */
import { readFile, writeFile } from 'fs/promises';
import { google } from 'googleapis';
import { spawn } from 'child_process';

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

const SPREADSHEET_ID = '1oYLcPKnEqFw1lkYvh23NbQUCp8KHOJ3JWZqChsymc9A';
const MANAGEMENT_SPREADSHEET_ID = process.env.SPREADSHEET_ID_GALCHAN;
const SHEET_MANAGEMENT = '自分チャンネル・動画管理表';

const tsvPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル10台本】商品詐欺_20260420.tsv';
const productTsvPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル10】商品リスト_Sheet2.tsv';
const descMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル10】概要欄.md';
const pinMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル10】固定コメント.md';
const workerMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル10】ワーカーメッセージ.md';

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n+/, '').replace(/^#\s+.*\n/, '').trim();
}
const script = await readFile(tsvPath, 'utf8');
const desc = stripFrontmatter(await readFile(descMdPath, 'utf8'));
const pin = stripFrontmatter(await readFile(pinMdPath, 'utf8'));
const worker = stripFrontmatter(await readFile(workerMdPath, 'utf8'));
const productRaw = await readFile(productTsvPath, 'utf8');

const productList = productRaw.split('\n').slice(1).filter(l => l.trim()).map(line => {
  const [name, maker, kind, memo, amazon, rakuten] = line.split('\t');
  return {
    name: name || '',
    category: kind || '',
    scriptQuote: memo || '',
    amazonLink: amazon && amazon !== '-' ? amazon : '',
    rakutenLink: rakuten && rakuten !== '-' ? rakuten : '',
  };
});

// サムネ文言（上段/下段/白枠4枚）を6要素で構成
const thumbnailParts = [
  '上段: 元店員が暴露',
  '下段: 絶対これ食べるな',
  '白枠1: 値段据え置きで中身だけ減らされてた',
  '白枠2: 〇〇って書いてあるのに入ってない',
  '白枠3: 仕入れ担当の私は毎日棚に戻してた',
  '白枠4: 〇〇を外したら体重が勝手に戻った',
];
const thumbnailCombined = thumbnailParts.join(' / ');

const payload = {
  topic: {
    title: '売り場のプロが選ばない食品・お菓子・飲料25選（元店員暴露）',
    description: '40代以降が毎週カゴに入れてた食品の改悪・買収・ステルス値上げを元店員視点で暴露',
    angle: '元店員の内部告発・ネガポジペア型',
    emotionWords: ['衝撃', '告発', 'ゾッとした', '後悔'],
  },
  style: 'product',
  script,
  materials: {
    titles: [
      '【衝撃の告発】40代以降が知らずにカゴに入れてた…売り場のプロが選ばない食品・お菓子・飲料25選（カントリーマァム/ハーゲンダッツ/爽健美茶/辛ラーメン）【有益ガルちゃん】',
    ],
    thumbnails: [thumbnailCombined],
    description: desc,
    metaTags: 'ガルちゃんまとめ,衝撃の告発,消費者庁,有益,ゾッとした',
    pinComment: pin,
    workerMessage: worker,
    productList,
    serialNumber: '【自ガル10】',
    managementMemo: '【企画理由】消費者庁 機能性表示食品撤回ラッシュ（3月単月728件）+ガルちゃんスレ「ティファール取っ手リコール」+517票の主婦熱量から着想。食品詐欺の実例多数・代替30品でアフィ収益両立可\n【セッション記録】Obsidian: 08_ai_chat_memo/galchan-app/セッション_20260420_14-21時_自ガル10完遂_最終.md\n【媒体】消費者庁公式（景表法措置命令・機能性表示食品撤回DB）/厚労省食品衛生法回収情報/ガルちゃんweb掲示板\n【競合】ガル姫「消費者庁が名指しで警告しているもの」101万再生 / ガルねこにゃん「もう絶対買わない！改悪ばかり」6.6万',
  },
};

// ── Gate ───────────────
await writeFile('/tmp/gal10_payload.json', JSON.stringify(payload, null, 2));
console.log('🔒 Running pre_save_gate.mjs...');
await new Promise((resolve, reject) => {
  const p = spawn('node', ['C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/pre_save_gate.mjs', '/tmp/gal10_payload.json', '--channel=galchan'], { stdio: 'inherit' });
  p.on('exit', code => code === 0 ? resolve() : reject(new Error(`Gate failed with exit ${code}`)));
});

// ── Auth ───────────────
function getAuth() {
  const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return c;
}
const auth = getAuth();
const sheets = google.sheets({ version: 'v4', auth });

// ── 1. 台本シート上書き ───────────────
const NO_SE_SPEAKERS = new Set(['ナレーション', 'タイトル']);
let u = 0, seI = 0;
const rows = [];
for (const line of script.split('\n').filter(l => l.trim())) {
  const parts = line.split('\t');
  if (parts.length < 2) continue;
  const speaker = parts[0].trim();
  const text = parts[1].trim();
  if (!speaker || !text) continue;
  let se = parts[2]?.trim() || '';
  if (!se && !NO_SE_SPEAKERS.has(speaker)) {
    u++;
    if (u >= 10) { se = seI % 2 === 0 ? 'SE1' : 'SE2'; seI++; u = 0; }
  }
  rows.push([speaker, text, se]);
}
await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: '台本!A4:C1000' });
await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: '台本!A4', valueInputOption: 'USER_ENTERED', requestBody: { values: rows } });
console.log(`✅ 台本 ${rows.length}行 更新`);

// ── 2. 商品リスト上書き（ポジのみ・アフィリンク付き） ───────────────
const productRows = productList.map((p, i) => [
  i + 1,
  p.name,
  '',
  p.amazonLink || p.rakutenLink || '',
]);
await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: '商品リスト!A2:D1000' });
await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: '商品リスト!A2', valueInputOption: 'USER_ENTERED', requestBody: { values: productRows } });
console.log(`✅ 商品リスト ${productRows.length}件 更新`);

// ── 3. 列幅設定（台本シート A=80 B=600 C=50） ───────────────
const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties' });
const scriptSheetId = meta.data.sheets.find(s => s.properties.title === '台本').properties.sheetId;
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: {
    requests: [
      { updateDimensionProperties: { range: { sheetId: scriptSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 80 }, fields: 'pixelSize' } },
      { updateDimensionProperties: { range: { sheetId: scriptSheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 600 }, fields: 'pixelSize' } },
      { updateDimensionProperties: { range: { sheetId: scriptSheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 50 }, fields: 'pixelSize' } },
    ],
  },
});
console.log(`✅ 台本シート 列幅設定 (A=80/B=600/C=50)`);

// ── 4. 動画管理シートの該当行を更新（F列=台本名で検索） ───────────────
const mgmt = await sheets.spreadsheets.values.get({ spreadsheetId: MANAGEMENT_SPREADSHEET_ID, range: `${SHEET_MANAGEMENT}!A:Q` });
const mgmtRows = mgmt.data.values || [];
const rowIdx = mgmtRows.findIndex(r => r && r[5] === '【自ガル10台本】');
if (rowIdx < 0) {
  console.error('❌ 動画管理シートに該当行なし・新規追加');
} else {
  const rowNum = rowIdx + 1;
  // I=サムネ（白枠4枚含む）・K=概要欄・M=固定コメ・P=ワーカー
  await sheets.spreadsheets.values.update({
    spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
    range: `${SHEET_MANAGEMENT}!I${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[thumbnailCombined]] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
    range: `${SHEET_MANAGEMENT}!K${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[desc]] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
    range: `${SHEET_MANAGEMENT}!M${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[pin]] },
  });
  // N列=ワーカーへメッセージ（実シート構造・2026-04-20訂正）
  await sheets.spreadsheets.values.update({
    spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
    range: `${SHEET_MANAGEMENT}!N${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[worker]] },
  });
  // 実シート構造 2026-04-21 訂正版: O=切り口/P=動画企画の型/Q=メモ/R=視聴維持率ピーク
  await sheets.spreadsheets.values.update({
    spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
    range: `${SHEET_MANAGEMENT}!O${rowNum}:R${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[
      '元店員の内部告発・ネガポジペア型',  // O 切り口
      '商品',  // P 動画企画の型
      payload.materials.managementMemo,  // Q メモ（4項目ラベル付き・自動注入）
      '',  // R 視聴維持率ピーク（投稿後アナリティクスで更新）
    ]] },
  });
  console.log(`✅ 動画管理シート row${rowNum} I/K/M/N/O/P/Q/R 列更新（新列構造・R視聴維持率は投稿後）`);
}

// ── 5. 保存後検証（読み戻し） ───────────────
const verify = await sheets.spreadsheets.values.get({ spreadsheetId: MANAGEMENT_SPREADSHEET_ID, range: `${SHEET_MANAGEMENT}!A${rowIdx+1}:Q${rowIdx+1}` });
const row = verify.data.values[0];
console.log('\n🔍 保存後検証（動画管理シート該当行）');
console.log(`  I列(サムネ): ${row[8]?.slice(0, 50)}${row[8]?.length > 50 ? '...' : ''} (${row[8]?.length || 0}字)`);
console.log(`  K列(概要欄): ${row[10]?.slice(0, 50)}... (${row[10]?.length || 0}字)`);
console.log(`  M列(固定コメ): ${row[12]?.slice(0, 50)}... (${row[12]?.length || 0}字)`);
console.log(`  N列(ワーカー): ${row[13]?.slice(0, 50)}... (${row[13]?.length || 0}字)`);
console.log(`\n🟢 完了 https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
