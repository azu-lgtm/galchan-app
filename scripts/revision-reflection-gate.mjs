#!/usr/bin/env node
/**
 * 修正反映漏れ検査ゲート（ガル/健康ch共通汎用版）
 *
 * azuレビュー反映後に必ず通すゲート。
 * Obsidian全MD＋スプシ台本シート＋動画管理表 row を旧ワードで grep し残存検出。
 * 残存0件確認できないと修正完了報告できない（ゼロトレランス）。
 *
 * 使い方:
 *   node scripts/revision-reflection-gate.mjs --video=gal15 --feedback="markdown表/箇条書きテキスト"
 *   node scripts/revision-reflection-gate.mjs --video=gal15 --feedback-file=path/to/azu_msg.txt
 *   node scripts/revision-reflection-gate.mjs --video=gal15 --old="旧1,旧2" --new="新1,新2"
 *
 * feedback テキストから自動抽出するパターン:
 *   - markdown表  | 旧 | 新 |
 *   - 「旧」→「新」型
 *   - 「旧」 から 「新」 型
 *   - X→Y 型（バッククオート/ブロック内）
 *
 * 動画コード:
 *   - ガルch: gal1〜gal99（自ガル1〜自ガル99）
 *   - 健康ch: kenkou1〜kenkou99 / gaiken1〜gaiken99（外健1〜外健99）
 *
 * 2026-05-13 自ガル15「修正反映漏れ事故」恒久対策として導入
 */
import { readFile, readdir } from 'fs/promises';
import { google } from 'googleapis';
import path from 'path';

// ============== 引数パース ==============
const argv = process.argv.slice(2);
function getArg(name) {
  const idx = argv.findIndex(a => a.startsWith(`--${name}=`));
  return idx >= 0 ? argv[idx].split('=').slice(1).join('=') : null;
}

const videoCode = getArg('video');
let feedbackText = getArg('feedback') || '';
const feedbackFile = getArg('feedback-file');
if (feedbackFile) feedbackText = await readFile(feedbackFile, 'utf8');
const oldStr = getArg('old');
const newStr = getArg('new');

if (!videoCode) {
  console.error('❌ --video=<gal15|kenkou62|gaiken63 等> 必須');
  process.exit(2);
}

// ============== ch判定 ==============
const ch = videoCode.match(/^gal\d+$/) ? 'galchan'
  : videoCode.match(/^(kenkou|gaiken|gai|jiken|health|sotokenkou)\d+$/) ? 'health'
  : null;
if (!ch) {
  console.error(`❌ 動画コード解析失敗: ${videoCode}（gal15 / kenkou62 / gaiken63 等の形式で）`);
  process.exit(2);
}

// ============== 動画コード→プレフィックス変換 ==============
function codeToPrefix(code) {
  if (code.match(/^gal(\d+)$/)) return `【自ガル${code.slice(3)}`;
  if (code.match(/^kenkou(\d+)$/)) return `【外健${code.slice(6)}`;
  if (code.match(/^gaiken(\d+)$/)) return `【外健${code.slice(6)}`;
  return code;
}

// ============== 旧→新ペア抽出 ==============
function parseFeedbackPairs(text) {
  const pairs = [];
  const seen = new Set();
  function add(o, n) {
    if (!o || !n || o === n) return;
    const key = `${o}|||${n}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ old: o, new: n });
  }
  // --old / --new 優先
  if (oldStr && newStr) {
    const olds = oldStr.split(',').map(s => s.trim());
    const news = newStr.split(',').map(s => s.trim());
    olds.forEach((o, i) => add(o, news[i] || ''));
    return pairs;
  }
  // markdown表 | 旧 | 新 |（ヘッダー行/区切り行は除外）
  const tableRe = /\|\s*([^|\n]+?)\s*\|\s*([^|\n]+?)\s*\|/g;
  let m;
  while ((m = tableRe.exec(text)) !== null) {
    const o = m[1].trim().replace(/^\*\*|\*\*$/g, '').replace(/^「|」$/g, '');
    const n = m[2].trim().replace(/^\*\*|\*\*$/g, '').replace(/^「|」$/g, '');
    if (!o || !n) continue;
    if (/^[#旧現状\-=]+$/.test(o) || /^[#新改善案修正後\-=]+$/.test(n)) continue;
    if (o.includes('---') || n.includes('---')) continue;
    if (o.length < 2 || n.length < 2) continue;
    if (o.length > 100 || n.length > 100) continue;
    add(o, n);
  }
  // 「旧」→「新」型・「旧」 → 「新」型
  const arrowRe = /「([^」\n]{2,80})」\s*[→⇒]\s*「([^」\n]{2,80})」/g;
  while ((m = arrowRe.exec(text)) !== null) add(m[1].trim(), m[2].trim());
  // 旧 → 新（記号囲みなし・控えめに）
  const plainArrowRe = /^[\s・\-*]*([^\n→⇒]{3,40})\s*→\s*([^\n→⇒]{3,40})\s*$/gm;
  while ((m = plainArrowRe.exec(text)) !== null) {
    const o = m[1].trim();
    const n = m[2].trim();
    if (o.match(/^[#=\-|]+$/) || n.match(/^[#=\-|]+$/)) continue;
    add(o, n);
  }
  return pairs;
}

// ============== 関連MDファイル探索 ==============
async function findVideoFiles(code, ch) {
  const dir = ch === 'galchan'
    ? 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本'
    : 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/健康雑学/自分動画/自社台本';
  const prefix = codeToPrefix(code);
  const files = await readdir(dir);
  return files
    .filter(f => f.startsWith(prefix) && f.endsWith('.md') && !f.startsWith('_BOTSU_'))
    .map(f => path.join(dir, f));
}

// ============== ファイル残存検査 ==============
async function checkFile(filePath, pairs) {
  const content = await readFile(filePath, 'utf8');
  const lines = content.split('\n');
  const hits = [];
  pairs.forEach(p => {
    lines.forEach((line, i) => {
      if (line.includes(p.old)) {
        hits.push({ file: path.basename(filePath), line: i + 1, old: p.old, snippet: line.trim().slice(0, 100) });
      }
    });
  });
  return hits;
}

// ============== env ロード ==============
const envPath = ch === 'galchan'
  ? 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local'
  : 'C:/Users/meiek/Desktop/ClaudeCode-projects/youtube-health-app/youtube-health-app/.env.local';
const envRaw = await readFile(envPath, 'utf8');
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

// ============== Sheets API ==============
const c = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
c.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const sheets = google.sheets({ version: 'v4', auth: c });

const MGMT_SS_ID = ch === 'galchan' ? process.env.SPREADSHEET_ID_GALCHAN : process.env.SPREADSHEET_ID_HEALTH;
const MGMT_SHEET_NAME = ch === 'galchan' ? '自分チャンネル・動画管理表' : '動画管理表'; // 健康chの正確なシート名は要更新

// ============== 動画コード→スプシID/行 動的取得 ==============
async function resolveVideoSheet(code) {
  if (!MGMT_SS_ID) return null;
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: MGMT_SS_ID, range: `${MGMT_SHEET_NAME}!A1:G200` });
    const rows = res.data.values || [];
    const prefix = codeToPrefix(code);
    for (let i = 0; i < rows.length; i++) {
      const f = (rows[i][5] || '').toString();
      if (f.startsWith(prefix)) {
        const g = (rows[i][6] || '').toString();
        const m = g.match(/spreadsheets\/d\/([^/]+)/);
        if (m) return { scriptSheetId: m[1], managementRow: i + 1 };
      }
    }
  } catch (e) {
    console.error(`⚠️ 動画管理表参照失敗: ${e.message}`);
  }
  return null;
}

// ============== メイン ==============
console.log(`📋 修正反映漏れ検査ゲート`);
console.log(`   動画: ${videoCode}（ch=${ch}・prefix=${codeToPrefix(videoCode)}）`);

const pairs = parseFeedbackPairs(feedbackText);
console.log(`\n🔍 抽出ペア: ${pairs.length}件`);
pairs.forEach((p, i) => console.log(`   ${i + 1}. 「${p.old}」 → 「${p.new}」`));

if (pairs.length === 0) {
  console.error('\n❌ 旧→新ペアが抽出できなかった。--feedback テキスト/--feedback-file/--old --new いずれか指定');
  console.error('   テキストに「| 旧 | 新 |」「「旧」→「新」」「旧 → 新」型のいずれかが必要');
  process.exit(2);
}

const files = await findVideoFiles(videoCode, ch);
console.log(`\n📂 対象ファイル: ${files.length}件`);
files.forEach(f => console.log(`   ${path.basename(f)}`));

let totalResidual = 0;
const allHits = [];
console.log('\n=== ファイル別残存検査 ===');
for (const file of files) {
  const hits = await checkFile(file, pairs);
  hits.forEach(h => {
    console.log(`❌ ${h.file}:${h.line} 残存「${h.old}」: ${h.snippet}`);
    totalResidual++;
    allHits.push(h);
  });
}
if (totalResidual === 0) console.log('✅ Obsidian全MD残存0件');

// ============== スプシ検査 ==============
const sheetCfg = await resolveVideoSheet(videoCode);
if (sheetCfg) {
  console.log(`\n📊 動画スプシ取得: scriptId=${sheetCfg.scriptSheetId} / managementRow=${sheetCfg.managementRow}`);

  // 台本シート
  const scriptRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetCfg.scriptSheetId, range: '台本!A1:C300' });
  const scriptRows = scriptRes.data.values || [];
  console.log(`\n=== スプシ台本シート (${scriptRows.length}行) 残存検査 ===`);
  let scriptHits = 0;
  pairs.forEach(p => {
    scriptRows.forEach((row, i) => {
      const line = (row || []).join('\t');
      if (line.includes(p.old)) {
        console.log(`❌ 台本シート Row ${i + 1} 残存「${p.old}」: ${line.slice(0, 100)}`);
        totalResidual++;
        scriptHits++;
      }
    });
  });
  if (scriptHits === 0) console.log('✅ スプシ台本シート残存0件');

  // 動画管理表 row
  if (MGMT_SS_ID && sheetCfg.managementRow) {
    const mgmtRes = await sheets.spreadsheets.values.get({ spreadsheetId: MGMT_SS_ID, range: `${MGMT_SHEET_NAME}!A${sheetCfg.managementRow}:N${sheetCfg.managementRow}` });
    const mgmtRow = (mgmtRes.data.values || [[]])[0] || [];
    const mgmtFlat = mgmtRow.join('\n');
    console.log(`\n=== 動画管理表 row ${sheetCfg.managementRow} 残存検査 ===`);
    let mgmtHits = 0;
    pairs.forEach(p => {
      if (mgmtFlat.includes(p.old)) {
        console.log(`❌ 動画管理表 row ${sheetCfg.managementRow} 残存「${p.old}」`);
        totalResidual++;
        mgmtHits++;
      }
    });
    if (mgmtHits === 0) console.log('✅ 動画管理表残存0件');
  }
} else {
  console.warn(`\n⚠️ 動画スプシID未解決（動画管理表に未登録の可能性）。スプシ検査スキップ`);
}

// ============== 読み上げ風語尾連発検出（ガルchのみ・2026-05-13追加） ==============
// azu指摘「セリフが何とか発表・何とかの話の連発で不自然」「同じのを頻繁に使うとか淡々と述べるチャンネルじゃない」
// 詳細: ガルちゃんねる/DB/rules/語り口テンプレ.md
if (ch === 'galchan' && sheetCfg) {
  const NARRATION_KEYWORDS = {
    '発表系': { keys: ['発表してた', '発表内容', '発表してる', '発表されてた', '公式の発表', '正式発表', 'メーカー発表'], threshold: 3 },
    '報告系': { keys: ['報告されてる', '報告書', '事故報告', '報告もある', '件報告', 'って報告', 'も報告'], threshold: 3 },
    '警告系': { keys: ['警告してた', '警告してる', '警告を強めてる', '警告を出してる'], threshold: 2 },
    '公表系': { keys: ['公表してる', '公表されてる', '公表してた'], threshold: 2 },
    '可能性系': { keys: ['可能性が高い', 'の可能性', '可能性って'], threshold: 2 },
    '言われている系': { keys: ['と言われている', 'と紹介されている', 'と書かれている', 'と説明されている'], threshold: 1 },
    'の話系（事実情報）': { keys: ['発表内容って', 'って数字って話', 'って件って話'], threshold: 1 },
    '出してきた系（不自然な日本語・azu指摘2026-05-13）': { keys: ['出してきた', '出してきて', '出してたんだって', 'って数字出して', '通達出してきた'], threshold: 2 },
  };

  const scriptRes2 = await sheets.spreadsheets.values.get({ spreadsheetId: sheetCfg.scriptSheetId, range: '台本!A4:C300' });
  const scriptFlat = (scriptRes2.data.values || []).flat().join('\n');

  console.log('\n=== 読み上げ風語尾連発検査（ガルch・語り口テンプレ.md準拠） ===');
  let narrationViolations = 0;
  Object.entries(NARRATION_KEYWORDS).forEach(([groupName, { keys, threshold }]) => {
    let count = 0;
    const hits = [];
    keys.forEach(k => {
      const re = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = scriptFlat.match(re);
      if (matches) {
        count += matches.length;
        hits.push(`${k}×${matches.length}`);
      }
    });
    if (count >= threshold) {
      console.log(`⚠️ 「${groupName}」 ${count}回検出（上限${threshold}回）→ 読み上げ風NG・要リライト [${hits.join(', ')}]`);
      narrationViolations++;
    } else if (count > 0) {
      console.log(`✅ 「${groupName}」 ${count}回（上限${threshold}回以内）`);
    }
  });

  if (narrationViolations > 0) {
    console.log(`\n⚠️ 読み上げ風語尾WARN: ${narrationViolations}グループ・語り口テンプレ.md参照して修正推奨`);
    totalResidual += narrationViolations;
  } else {
    console.log('✅ 読み上げ風語尾連発なし');
  }
}

// ============== 判定 ==============
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📊 総残存数: ${totalResidual}件`);
if (totalResidual === 0) {
  console.log('✅ 残存0件・修正完了報告OK');
  process.exit(0);
}
console.error(`❌ 残存検出${totalResidual}件・報告NG・修正やり直し`);
process.exit(1);
