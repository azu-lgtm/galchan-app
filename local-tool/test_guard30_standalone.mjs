#!/usr/bin/env node
/**
 * Guard 30 単体動作確認用テストスクリプト
 * pre_save_gate.mjs のGuard 30ロジックだけを取り出してテストする。
 * 2026-05-17 azu指示「ゲートも」受けて作成。
 */
import { readFile } from 'fs/promises';

const channel = 'galchan';
const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('Usage: node test_guard30_standalone.mjs <payload.json>');
  process.exit(2);
}

const payload = JSON.parse(await readFile(payloadPath, 'utf8'));
const materials = payload.materials || payload;
const script = payload.script;

console.log(`\n🔒 Guard 30 standalone test [${channel}] ${payloadPath}`);

function fail(label, detail) {
  console.error(`❌ FAIL: ${label}`);
  if (detail) console.error(`   詳細: ${detail}`);
  process.exit(1);
}
function pass(label) {
  console.log(`✅ ${label}`);
}

// ─── Guard 30 ロジック（pre_save_gate.mjs と同期） ───
const mgmtPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/動画管理リスト.md';
let mgmtContent = '';
try {
  mgmtContent = await readFile(mgmtPath, 'utf8');
} catch (e) {
  fail('動画管理リスト.md 読込失敗', mgmtPath);
}

const rows = mgmtContent.split('\n')
  .map(l => l.trim())
  .filter(l => l.startsWith('|') && l.endsWith('|'))
  .map(l => l.slice(1, -1).split('|').map(c => c.trim()))
  .filter(cols => cols.length >= 4)
  .filter(cols => !cols[0].includes('投稿日') && !cols[0].includes('---'))
  .filter(cols => cols[3] && cols[3].length >= 5);

const filteredRows = rows.filter(cols => {
  const allText = cols.join(' ');
  return !allText.includes('【テスト】') && !cols[1].includes('テスト台本');
});
const recentVideos = filteredRows.slice(-10).map(cols => ({
  title: cols[3] || '',
  theme: cols[2] || '',
  scriptName: cols[1] || '',
}));

const savingVideo = filteredRows.find(cols =>
  cols[3] && cols[3].includes('保存版') && cols[3].includes('総集編'));
if (savingVideo && !recentVideos.some(v => v.title === savingVideo[3])) {
  recentVideos.push({
    title: savingVideo[3] || '',
    theme: savingVideo[2] || '',
    scriptName: savingVideo[1] || '',
  });
}
const matomeRow = filteredRows.find(cols =>
  cols[1] && cols[1].includes('下記') && cols[1].includes('まとめ'));
if (matomeRow && !recentVideos.some(v => v.title === matomeRow[3])) {
  recentVideos.push({
    title: matomeRow[3] || matomeRow[1] || '',
    theme: matomeRow[2] || '',
    scriptName: matomeRow[1] || '',
  });
}

console.log(`\n📋 過去動画 ${recentVideos.length}本ロード:`);
recentVideos.forEach((v, i) => console.log(`  ${i+1}. ${v.title.slice(0, 60)}`));

const EXEMPT_WORDS = new Set([
  '消費者庁', '国民生活センター', 'NITE', '農林水産省', '厚生労働省', '経済産業省', '警察庁',
  '有益', 'ガルちゃん', 'ガルちゃんねる', '40代', '50代', '40代以降', '40代主婦', '40代女性',
  '失敗回避', '後悔回避', '保存版', '総集編',
  '注意喚起', '比較系', '暴露系',
  '危険', '警告', '注意', 'ゾッとした', '後悔',
]);
const extractCoreWords = (s) => {
  if (!s) return new Set();
  const tokens = s.split(/[【】「」『』\s　、。！？・×\+\(\)\[\]【】「」｜\/\\,.!?\-:：;]+/u);
  const result = new Set();
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (/^[\d]+$/.test(t)) continue;
    if (EXEMPT_WORDS.has(t)) continue;
    result.add(t);
  }
  return result;
};

const fails = [];

const newTitle = (payload.title || materials.title || '').trim();
console.log(`\n🆕 新動画タイトル: ${newTitle}`);
console.log(`🆕 新動画タイトル核ワード: [${[...extractCoreWords(newTitle)].join(', ')}]`);

if (newTitle) {
  const newTitleWords = extractCoreWords(newTitle);
  for (const past of recentVideos) {
    if (!past.title) continue;
    const pastWords = extractCoreWords(past.title);
    let matchCount = 0;
    const matched = [];
    for (const w of newTitleWords) {
      for (const pw of pastWords) {
        if (w === pw || (w.length >= 4 && pw.includes(w)) || (pw.length >= 4 && w.includes(pw))) {
          matchCount++;
          matched.push(w);
          break;
        }
      }
    }
    if (matchCount >= 3) {
      fails.push(`【軸1 タイトル被り】${matchCount}個一致: [${matched.slice(0, 5).join('/')}] vs 過去動画「${past.title.slice(0, 50)}…」`);
    }
  }
}

const newThumbs = payload.thumbnails || materials.thumbnails || [];
if (Array.isArray(newThumbs) && newThumbs.length > 0) {
  const thumbText = newThumbs.join(' / ');
  const thumbWords = extractCoreWords(thumbText);
  for (const past of recentVideos) {
    if (!past.title) continue;
    const pastWords = extractCoreWords(past.title);
    let matchCount = 0;
    const matched = [];
    for (const w of thumbWords) {
      for (const pw of pastWords) {
        if (w === pw || (w.length >= 4 && pw.includes(w)) || (pw.length >= 4 && w.includes(pw))) {
          matchCount++;
          matched.push(w);
          break;
        }
      }
    }
    if (matchCount >= 3) {
      fails.push(`【軸2 サムネ被り】${matchCount}要素一致: [${matched.slice(0, 5).join('/')}] vs 過去動画「${past.title.slice(0, 50)}…」`);
    }
  }
}

if (script && typeof script === 'string') {
  const scriptWords = extractCoreWords(script);
  for (const past of recentVideos) {
    if (!past.title) continue;
    const pastWords = extractCoreWords(past.title);
    let matchCount = 0;
    const matched = [];
    for (const pw of pastWords) {
      for (const sw of scriptWords) {
        if (pw === sw || (pw.length >= 4 && sw.includes(pw)) || (sw.length >= 4 && pw.includes(sw))) {
          matchCount++;
          matched.push(pw);
          break;
        }
      }
    }
    if (matchCount >= 3) {
      fails.push(`【軸3 構成素材被り】${matchCount}個一致: [${matched.slice(0, 5).join('/')}] vs 過去動画「${past.title.slice(0, 50)}…」`);
    }
  }
}

if (fails.length > 0) {
  fail(`過去動画被り検出 ${fails.length}件: 直近10本との3軸チェック違反`,
    `${fails.join('\n')}`);
}
pass(`過去動画被り検出 違反なし（直近${recentVideos.length}本と照合）`);
console.log(`\n🟢 PASS`);
