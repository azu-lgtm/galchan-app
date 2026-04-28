// ----------------------------------------------------------------------------
// 自ガル9 スプレッドシート保存スクリプト
//   - テンプレSPREADSHEET_TEMPLATE_SCRIPT_PRODUCTSをDrive APIでコピー
//   - 「台本」シートに台本TSV（話者/本文/SE）を行4から書き込み
//   - 「商品リスト」シートに商品TSV（6列）を行1から書き込み
//   - 書き込み後、values.getで読み戻し→文字化けゲート＋NFC一致確認
//   - メイン管理スプシの「自分チャンネル・動画管理表」に1行追加
// ----------------------------------------------------------------------------
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// .env.local を手動ロード
const envPath = fileURLToPath(new URL('../.env.local', import.meta.url));
const envText = readFileSync(envPath, 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const SCRIPT_PATH = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル9台本】ドラッグストア_v3.md';
const PRODUCTS_PATH = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル9】商品リスト_Sheet2.tsv';
const OUTLINE_PATH = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル9】概要欄.md';
const TAGS_PATH = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル9】メタタグ.md';
const PINNED_PATH = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル9】固定コメント.md';

const TITLE_OF_VIDEO = '【40代以降は注意】ドラストで毎日使ってた商品が全部根拠なしだった…代わりに買うべき本物リスト(イブ/紅麹/シミ消しクリーム/EMS美顔器/ヘアカラー)【ガルちゃんまとめ】';
const THEME = 'ドラストの危ない常備品';
const SHEET_TITLE = '【自ガル9台本】';

const TEMPLATE_ID = process.env.SPREADSHEET_TEMPLATE_SCRIPT_PRODUCTS;
const MAIN_SS_ID = process.env.SPREADSHEET_ID_GALCHAN;
const FOLDER_ID = process.env.FOLDER_ID_GALCHAN;

// ----- 認証 -----
const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: oauth2 });
const drive = google.drive({ version: 'v3', auth: oauth2 });

// ----- ユーティリティ -----

// UTF-8 Bufferで明示的に読む（mojibake回避）
function readUtf8(p) {
  const buf = readFileSync(p);
  return buf.toString('utf8').normalize('NFC');
}

// 台本.mdから本文行（タブ区切り3列）だけを抽出
function parseScriptMd(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (line.startsWith('## ') || line.startsWith('# ') || line.startsWith('---')) {
      // 本文以降のメタログに到達したら終了
      if (rows.length > 0) break;
      continue;
    }
    if (line.trim() === '') continue;
    const cells = line.split('\t');
    // 1列目が話者っぽい行のみ（ナレーション/タイトル/イッチ/スレ民N）
    if (/^(ナレーション|タイトル|イッチ|スレ民[1-9])$/.test(cells[0])) {
      const speaker = cells[0];
      const body = (cells[1] || '').replace(/[\r\n]+$/, '');
      const se = (cells[2] || '').replace(/[\r\n]+$/, '');
      rows.push([speaker, body, se]);
    }
  }
  return rows;
}

function parseTsv(text) {
  return text.replace(/\r\n/g, '\n').trimEnd().split('\n').map(l => l.split('\t'));
}

// 文字化けゲート: 致命的な文字が含まれていないか
function detectGarbage(values) {
  const findings = { ufffd: 0, combiningMarks: 0, cp1252: 0, samples: [] };
  const cp1252Re = /[âãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/;
  const ng = ['ŋ', 'ɂ', '□'];
  const flat = [];
  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < (values[r]?.length || 0); c++) {
      const v = String(values[r][c] ?? '');
      flat.push(v);
      if (v.includes('\uFFFD')) {
        findings.ufffd++;
        if (findings.samples.length < 5) findings.samples.push(`(${r+1},${c+1}) U+FFFD: ${v.slice(0,40)}`);
      }
      if (/[\u0300-\u036F]/.test(v)) {
        findings.combiningMarks++;
        if (findings.samples.length < 5) findings.samples.push(`(${r+1},${c+1}) Combining: ${v.slice(0,40)}`);
      }
      if (cp1252Re.test(v) || ng.some(x => v.includes(x))) {
        findings.cp1252++;
        if (findings.samples.length < 5) findings.samples.push(`(${r+1},${c+1}) CP1252化け: ${v.slice(0,40)}`);
      }
    }
  }
  return findings;
}

// NFC一致チェック
function isNfcMatch(written, readback) {
  const w = (written || []).map(r => r.map(c => String(c ?? '').normalize('NFC')));
  const rb = (readback || []).map(r => r.map(c => String(c ?? '').normalize('NFC')));
  let mismatch = 0;
  const samples = [];
  for (let r = 0; r < Math.max(w.length, rb.length); r++) {
    const wr = w[r] || [];
    const rr = rb[r] || [];
    for (let c = 0; c < Math.max(wr.length, rr.length); c++) {
      const wv = (wr[c] || '').replace(/\r/g, '');
      const rv = (rr[c] || '').replace(/\r/g, '');
      if (wv !== rv) {
        mismatch++;
        if (samples.length < 5) samples.push(`row${r+1} col${c+1}: \nW=${wv.slice(0,60)}\nR=${rv.slice(0,60)}`);
      }
    }
  }
  return { mismatch, samples };
}

// ----- メイン -----
(async () => {
  // 1) テンプレをコピーして新規スプシ作成
  console.log('=== Step 1: テンプレコピー ===');
  const copy = await drive.files.copy({
    fileId: TEMPLATE_ID,
    requestBody: {
      name: SHEET_TITLE,
      parents: FOLDER_ID ? [FOLDER_ID] : undefined,
    },
    supportsAllDrives: true,
  });
  const NEW_SS_ID = copy.data.id;
  console.log('新規スプシ作成:', NEW_SS_ID);
  console.log('URL:', `https://docs.google.com/spreadsheets/d/${NEW_SS_ID}/edit`);

  // 新スプシのSheet情報取得
  const meta = await sheets.spreadsheets.get({ spreadsheetId: NEW_SS_ID });
  const sheetMap = {};
  for (const s of meta.data.sheets) {
    sheetMap[s.properties.title] = s.properties.sheetId;
  }
  console.log('Sheets:', Object.entries(sheetMap).map(([k,v]) => `${k}(gid=${v})`).join(' | '));

  // 2) 台本データ整形
  console.log('\n=== Step 2: 台本データ整形 ===');
  const scriptText = readUtf8(SCRIPT_PATH);
  const scriptRows = parseScriptMd(scriptText);
  console.log(`台本行数: ${scriptRows.length}`);
  const totalChars = scriptRows.reduce((s, r) => s + (r[1]?.length || 0), 0);
  console.log(`本文総文字数: ${totalChars}`);

  // 文字数列も付ける（テンプレに合わせて4列構成: 話者/本文/SE/文字数）
  const scriptRowsWithLen = scriptRows.map(r => [r[0], r[1], r[2], String(r[1]?.length || 0)]);

  // 3) 台本Sheet書き込み（既存テンプレヘッダー残し、行4から書く）
  console.log('\n=== Step 3: 台本Sheet書き込み ===');
  // まず既存のテンプレ仮データ（ナレーション「皆さんこんにちは...」など）をクリア
  await sheets.spreadsheets.values.clear({
    spreadsheetId: NEW_SS_ID,
    range: '台本!A4:D2000',
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: NEW_SS_ID,
    range: '台本!A4',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: scriptRowsWithLen },
  });
  console.log(`台本書き込み完了: ${scriptRowsWithLen.length}行 × 4列`);

  // 4) 商品リスト書き込み（指示通り6列フォーマット・ヘッダーごと上書き）
  console.log('\n=== Step 4: 商品リストSheet書き込み ===');
  const productsText = readUtf8(PRODUCTS_PATH);
  const productRows = parseTsv(productsText);
  console.log(`商品リスト行数: ${productRows.length} (ヘッダー含む)`);
  console.log(`列数: ${productRows[0]?.length}`);
  // 既存テンプレを全クリア
  await sheets.spreadsheets.values.clear({
    spreadsheetId: NEW_SS_ID,
    range: '商品リスト!A1:Z2000',
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: NEW_SS_ID,
    range: '商品リスト!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: productRows },
  });
  console.log(`商品リスト書き込み完了: ${productRows.length}行 × ${productRows[0].length}列`);

  // 5) 読み戻し検証＋文字化けゲート
  console.log('\n=== Step 5: 読み戻し検証＋文字化けゲート ===');
  const readScript = await sheets.spreadsheets.values.get({
    spreadsheetId: NEW_SS_ID,
    range: `台本!A4:D${4 + scriptRowsWithLen.length - 1}`,
  });
  const readProducts = await sheets.spreadsheets.values.get({
    spreadsheetId: NEW_SS_ID,
    range: `商品リスト!A1:F${productRows.length}`,
  });

  const scriptGarb = detectGarbage(readScript.data.values || []);
  const productGarb = detectGarbage(readProducts.data.values || []);
  const scriptNfc = isNfcMatch(scriptRowsWithLen, readScript.data.values);
  const productNfc = isNfcMatch(productRows, readProducts.data.values);

  console.log('\n--- 台本Sheet 文字化けチェック ---');
  console.log('U+FFFD:', scriptGarb.ufffd, '/ Combining marks:', scriptGarb.combiningMarks, '/ CP1252化け:', scriptGarb.cp1252);
  console.log('NFC不一致行数:', scriptNfc.mismatch);
  if (scriptGarb.samples.length) console.log('Garbage samples:', scriptGarb.samples);
  if (scriptNfc.samples.length) console.log('NFC mismatch samples:', scriptNfc.samples);

  console.log('\n--- 商品リスト 文字化けチェック ---');
  console.log('U+FFFD:', productGarb.ufffd, '/ Combining marks:', productGarb.combiningMarks, '/ CP1252化け:', productGarb.cp1252);
  console.log('NFC不一致行数:', productNfc.mismatch);
  if (productGarb.samples.length) console.log('Garbage samples:', productGarb.samples);
  if (productNfc.samples.length) console.log('NFC mismatch samples:', productNfc.samples);

  const fatal = (scriptGarb.ufffd + scriptGarb.combiningMarks + scriptGarb.cp1252
              + productGarb.ufffd + productGarb.combiningMarks + productGarb.cp1252
              + scriptNfc.mismatch + productNfc.mismatch);
  if (fatal > 0) {
    console.error('\n❌ 文字化けゲート不通過 -', fatal, '件問題あり。中断する。');
    console.log('スプシURL:', `https://docs.google.com/spreadsheets/d/${NEW_SS_ID}/edit`);
    process.exit(1);
  }
  console.log('\n✅ 文字化けゲート通過');

  // 6) メイン管理スプシに行追加
  console.log('\n=== Step 6: メイン管理スプシへ行追加 ===');
  // 概要欄/メタタグ/固定コメント読み込み
  const outlineText = readUtf8(OUTLINE_PATH);
  const tagsRaw = readUtf8(TAGS_PATH);
  // メタタグからカンマ区切り文字列だけ抽出
  const tagMatch = tagsRaw.match(/```\s*\n([\s\S]+?)\n```/);
  const tagsCsv = tagMatch ? tagMatch[1].trim() : '';
  const pinnedText = readUtf8(PINNED_PATH);

  const newScriptUrl = `https://docs.google.com/spreadsheets/d/${NEW_SS_ID}/edit`;
  // テンプレ行構造: A〜Q (空,空,空,空,投稿日,台本名,台本リンク,テーマ,サムネ,タイトル,概要欄,メタタグ,固定コメント,空,切り口,ワーカーへ,動画企画の型)
  const newRow = [
    '', '', '', '',
    '', // 投稿日（未投稿）
    SHEET_TITLE,
    newScriptUrl,
    THEME,
    '', // サムネ（未作成）
    TITLE_OF_VIDEO,
    outlineText,
    tagsCsv,
    pinnedText,
    '', // 視聴維持率
    '常識破壊×失敗回避', // 切り口
    '', // ワーカーへ
    '商品', // 動画企画の型
  ];

  // 既存末尾を確認して append
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: MAIN_SS_ID,
    range: '自分チャンネル・動画管理表!A:A',
  });
  const nextRow = (existing.data.values?.length || 0) + 1;
  console.log('追加先行:', nextRow);
  await sheets.spreadsheets.values.update({
    spreadsheetId: MAIN_SS_ID,
    range: `自分チャンネル・動画管理表!A${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [newRow] },
  });
  console.log('管理表 行追加完了');

  // 管理表 読み戻し検証
  const verifyMain = await sheets.spreadsheets.values.get({
    spreadsheetId: MAIN_SS_ID,
    range: `自分チャンネル・動画管理表!A${nextRow}:Q${nextRow}`,
  });
  const mainGarb = detectGarbage(verifyMain.data.values || []);
  console.log('\n--- 管理表 文字化けチェック ---');
  console.log('U+FFFD:', mainGarb.ufffd, '/ Combining marks:', mainGarb.combiningMarks, '/ CP1252化け:', mainGarb.cp1252);
  if (mainGarb.samples.length) console.log('Garbage samples:', mainGarb.samples);

  if (mainGarb.ufffd + mainGarb.combiningMarks + mainGarb.cp1252 > 0) {
    console.error('❌ 管理表で文字化け検出。要確認。');
  } else {
    console.log('✅ 管理表 文字化けなし');
  }

  // 結果サマリ JSON 出力
  console.log('\n=== RESULT_JSON ===');
  console.log(JSON.stringify({
    new_spreadsheet_id: NEW_SS_ID,
    new_spreadsheet_url: newScriptUrl,
    script_sheet_gid: sheetMap['台本'],
    products_sheet_gid: sheetMap['商品リスト'],
    script_rows: scriptRowsWithLen.length,
    script_total_chars: totalChars,
    product_rows: productRows.length,
    main_table_appended_row: nextRow,
    garbage_check: {
      script: scriptGarb,
      products: productGarb,
      main_table: mainGarb,
    },
    nfc_check: {
      script: { mismatch: scriptNfc.mismatch },
      products: { mismatch: productNfc.mismatch },
    },
  }, null, 2));
})();
