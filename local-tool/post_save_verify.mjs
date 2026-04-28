#!/usr/bin/env node
/**
 * スプシ保存後の読み戻し検証（自ガル<N>共通）
 *
 * 使い方:
 *   node post_save_verify.mjs <newSpreadsheetId> <serialNumber> [--desc-md=...] [--pin-md=...] [--wm-md=...]
 *   例: node post_save_verify.mjs 1337fLo8... 【自ガル11】
 *
 * 検証項目:
 * 1. 商品リストシート全行にD列（商品リンク）が埋まっているか
 * 2. 動画管理シート該当row の F-Q列に空欄なし
 * 3. N列ワーカーメッセージにプレースホルダー残存なし（強化検出）
 * 4. 🆕 動画管理シート row{N} の K/M/N列とローカルMD（概要欄/固定コメ/ワーカー）の同期検証
 *    （--desc-md / --pin-md / --wm-md でローカルMDパス指定時のみ実施）
 * 5. 🆕 動画管理シート row{N} の F列（台本名）に長文テキスト混入検出（100字超 or 改行3+でWARN）
 * 1つでもNGなら exit 1
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

const NEW_SPREADSHEET_ID = process.argv[2];
const SERIAL = process.argv[3];
if (!NEW_SPREADSHEET_ID || !SERIAL) {
  console.error('usage: node post_save_verify.mjs <spreadsheetId> <serialNumber> [--desc-md=path] [--pin-md=path] [--wm-md=path]');
  process.exit(1);
}
const SCRIPT_NAME = SERIAL.replace('】', '台本】');

// 🆕 オプショナル: ローカルMD同期検証用パス（--desc-md / --pin-md / --wm-md）
function getOptArg(name) {
  const found = process.argv.find(a => a.startsWith(`--${name}=`));
  return found ? found.split('=').slice(1).join('=') : null;
}
const DESC_MD_PATH = getOptArg('desc-md');
const PIN_MD_PATH  = getOptArg('pin-md');
const WM_MD_PATH   = getOptArg('wm-md');

const MANAGEMENT_SPREADSHEET_ID = process.env.SPREADSHEET_ID_GALCHAN;
const SHEET_MANAGEMENT = '自分チャンネル・動画管理表';

function getAuth() {
  const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return c;
}
const auth = getAuth();
const sheets = google.sheets({ version: 'v4', auth });

let failCount = 0;
function fail(msg) {
  console.error(`❌ FAIL: ${msg}`);
  failCount++;
}
function pass(msg) {
  console.log(`✅ ${msg}`);
}

// ── 1. 商品リストシートD列全埋め検証 ───────────────
const products = await sheets.spreadsheets.values.get({
  spreadsheetId: NEW_SPREADSHEET_ID,
  range: '商品リスト!A2:D100',
});
const prodRows = products.data.values || [];
const prodCount = prodRows.filter(r => r[1]).length;  // 商品名があるか
const linkedCount = prodRows.filter(r => r[1] && r[3] && /https?:\/\//.test(r[3])).length;
if (prodCount === 0) {
  fail(`商品リストシートが空`);
} else if (linkedCount < prodCount) {
  fail(`商品リストD列 アフィリンク抜け: ${prodCount - linkedCount}/${prodCount}件欠落`);
} else {
  pass(`商品リスト ${prodCount}件・全件アフィリンク設置済`);
}

// ── 2. 動画管理シート行のF-Q列空欄チェック ───────────────
const mgmt = await sheets.spreadsheets.values.get({
  spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
  range: `${SHEET_MANAGEMENT}!A:Q`,
});
const mgmtRows = mgmt.data.values || [];
const rowIdx = mgmtRows.findIndex(r => r && r[5] === SCRIPT_NAME);
if (rowIdx < 0) {
  fail(`動画管理シートに ${SCRIPT_NAME} の行なし`);
} else {
  const row = mgmtRows[rowIdx];
  const rowNum = rowIdx + 1;
  const requiredCols = [
    { idx: 5, label: 'F(台本名)' },
    { idx: 6, label: 'G(台本リンク)' },
    { idx: 7, label: 'H(テーマ)' },
    { idx: 8, label: 'I(サムネ)' },
    { idx: 9, label: 'J(タイトル)' },
    { idx: 10, label: 'K(概要欄)' },
    { idx: 11, label: 'L(メタタグ)' },
    { idx: 12, label: 'M(固定コメント)' },
    { idx: 13, label: 'N(ワーカーメッセージ)' },
    { idx: 14, label: 'O(切り口)' },
    { idx: 15, label: 'P(動画企画の型)' },
    { idx: 16, label: 'Q(メモ)' },
  ];
  const emptyCols = requiredCols.filter(c => !row[c.idx] || String(row[c.idx]).trim() === '');
  if (emptyCols.length > 0) {
    fail(`動画管理row${rowNum} 空欄列: ${emptyCols.map(c => c.label).join(', ')}`);
  } else {
    pass(`動画管理row${rowNum} F-Q列すべて入力済`);
  }

  // N列 プレースホルダー検出（強化・2026-04-25 自ガル11事故受け）
  // 検出パターン: {SPREADSHEET_URL} / {{...}} / {[A-Z_]+} / PLACEHOLDER_GAL\d+ / TODO等
  const workerMsg = row[13] || '';
  const placeholderPatterns = [
    /\{SPREADSHEET_URL\}/,
    /\{\{.*\}\}/,
    /\{[A-Z_]{3,}\}/,                  // {SPREADSHEET_URL}, {SCRIPT_URL}, {VIDEO_TITLE}等の汎用
    /PLACEHOLDER_GAL\d+/i,              // PLACEHOLDER_GAL11, PLACEHOLDER_GAL12 等
    /PLACEHOLDER[_-]?[A-Z0-9]+/i,       // PLACEHOLDER_XXX, PLACEHOLDER-XXX
    /<PLACEHOLDER>/i,
    /<<.*?>>/,                          // <<URL>> 等
  ];
  let placeholderHit = null;
  for (const p of placeholderPatterns) {
    const m = workerMsg.match(p);
    if (m) { placeholderHit = m[0]; break; }
  }
  if (placeholderHit) {
    fail(`動画管理N列 PLACEHOLDER残存: 「${placeholderHit}」 ← save後に update-materials API再実行で実URL差替必須`);
  } else if (workerMsg.includes('https://docs.google.com/spreadsheets/')) {
    pass('動画管理N列 実スプシURL埋込済（PLACEHOLDER残存なし）');
  } else if (workerMsg.length > 0) {
    console.log(`⚠️ 警告: N列ワーカーメッセージにスプシURLが含まれていない（PLACEHOLDERでもない）。意図的か確認推奨`);
  }

  // 🆕 5. F列（台本名）に長文テキスト混入検出（動画管理シート row34「下記4本まとめ」事件再発防止）
  const fCol = row[5] || '';
  const fColLines = fCol.split('\n').length;
  if (fCol.length > 100 || fColLines >= 4) {
    console.log(`⚠️ 警告: 動画管理row${rowNum} F列(台本名)に長文テキスト混入の可能性: ${fCol.length}字/${fColLines}行。F列は台本名のみ・不定型データ要確認`);
  } else {
    pass(`動画管理row${rowNum} F列(台本名)長文混入なし（${fCol.length}字/${fColLines}行）`);
  }

  // 🆕 4. K/M/N列とローカルMDの同期検証（オプション・--desc-md/--pin-md/--wm-md指定時のみ）
  if (DESC_MD_PATH || PIN_MD_PATH || WM_MD_PATH) {
    const { readFile: _rf } = await import('fs/promises');
    const cmpHead = (sheet, md, label) => {
      const sNorm = String(sheet || '').replace(/\s+/g, '').slice(0, 100);
      const mNorm = String(md || '').replace(/\s+/g, '').slice(0, 100);
      if (sNorm.length === 0 && mNorm.length === 0) {
        pass(`${label} 両側空（同期OK）`);
        return;
      }
      if (sNorm !== mNorm) {
        fail(`${label} 同期漏れ: スプシ先頭100字「${sNorm.slice(0, 60)}...」≠ ローカルMD先頭100字「${mNorm.slice(0, 60)}...」 ← update-materials API再実行で同期必須`);
      } else {
        pass(`${label} スプシ⇔ローカルMD 先頭100字一致`);
      }
    };
    if (DESC_MD_PATH) {
      try {
        const md = await _rf(DESC_MD_PATH, 'utf8');
        cmpHead(row[10], md, 'K列(概要欄)');
      } catch (e) {
        fail(`概要欄MD読込失敗: ${DESC_MD_PATH}`);
      }
    }
    if (PIN_MD_PATH) {
      try {
        const md = await _rf(PIN_MD_PATH, 'utf8');
        cmpHead(row[12], md, 'M列(固定コメント)');
      } catch (e) {
        fail(`固定コメントMD読込失敗: ${PIN_MD_PATH}`);
      }
    }
    if (WM_MD_PATH) {
      try {
        const md = await _rf(WM_MD_PATH, 'utf8');
        cmpHead(row[13], md, 'N列(ワーカーメッセージ)');
      } catch (e) {
        fail(`ワーカーメッセージMD読込失敗: ${WM_MD_PATH}`);
      }
    }
  } else {
    console.log('ℹ️ K/M/N列⇔ローカルMD同期検証スキップ（--desc-md/--pin-md/--wm-md未指定）');
  }
}

// ── 3. 概要欄アフィリンク密度 ───────────────
if (rowIdx >= 0) {
  const desc = mgmtRows[rowIdx][10] || '';
  const affCount = (desc.match(/tag=garuchannel22-22/g) || []).length;
  if (affCount < Math.floor(prodCount * 0.5)) {
    fail(`概要欄アフィリンク不足: ${affCount}件 < productList${prodCount}件の50%`);
  } else {
    pass(`概要欄アフィリンク ${affCount}件（productList${prodCount}件）`);
  }
}

if (failCount > 0) {
  console.error(`\n🔴 ${failCount}件のFAIL。修正してください。`);
  process.exit(1);
}
console.log('\n🟢 全検証PASS');
