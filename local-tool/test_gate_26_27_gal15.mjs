#!/usr/bin/env node
/**
 * 新ガード26（テーマ/店舗整合・FAIL/WARN 2段階）+ 27（自作自演型）+ 28（論理矛盾）を
 * 自ガル15の実データで検証。
 * 期待: 26 FAIL（ダイソー/楽天/100均/メルカリ）+ WARN（無印/ヨドバシ/ビック）/ 27 FAIL（L245/L249）/ 28 FAIL（L127）
 */
import { readFile } from 'fs/promises';

const TEST_SCRIPT_MD = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル15台本】Amazon危険商品_20260512.md';
const TEST_DESCRIPTION_MD = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル15】概要欄_20260512.md';
const TEST_PIN_MD = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル15】固定コメント_20260512.md';

const script = await readFile(TEST_SCRIPT_MD, 'utf8');
const description = await readFile(TEST_DESCRIPTION_MD, 'utf8');
const pinComment = await readFile(TEST_PIN_MD, 'utf8');

const title = '【消費者庁・NITE警告】Amazonで売れてる危険商品20選＋神商品10選';
const thumbnails = {
  upper: '国が警告！絶対買うな',
  lower: 'Amazonの危険商品＆神商品',
  frame1: '火災・健康被害事例',
  frame2: '私もポチってた…',
};

// ─── ガード26新版（FAIL/WARN 2段階）───
const ECOMMERCE = {
  Amazon: /(Amazon|アマゾン)/i,
  楽天: /(楽天市場|楽天)/,
  Yahoo: /(Yahoo!?\s*ショッピング|ヤフーショッピング)/i,
};
const HUNDREDYEN = {
  ダイソー: /ダイソー/,
  セリア: /セリア/,
  キャンドゥ: /キャンドゥ/,
  スリーコインズ: /(3COINS|3コインズ|スリーコインズ)/i,
  百均: /(百均|100均|百円ショップ|100円ショップ)/,
};
const WAREHOUSE = { コストコ: /コストコ/ };
const FLEAMARKET = { メルカリ: /メルカリ/ };
const RETAIL_OK = {
  ヨドバシ: /(ヨドバシカメラ|ヨドバシ)/,
  ビックカメラ: /(ビックカメラ|ビック)/,
  ヤマダ電機: /(ヤマダ電機|ヤマダ)/,
  エディオン: /エディオン/,
  無印良品: /無印良品|無印/,
  ロフト: /(ロフト|LOFT)/,
  ハンズ: /(東急ハンズ|ハンズ)/,
  しまむら: /しまむら/,
  ニトリ: /ニトリ/,
  カインズ: /カインズ/,
  ドンキ: /(ドン・キホーテ|ドンキホーテ|ドンキ)/,
};
const ALL_FAIL_STORES = { ...ECOMMERCE, ...HUNDREDYEN, ...WAREHOUSE, ...FLEAMARKET };

const themeText = [title, thumbnails.upper, thumbnails.lower, thumbnails.frame1, thumbnails.frame2].join(' ');
const themeStores = [];
for (const [name, rx] of Object.entries(ALL_FAIL_STORES)) {
  if (rx.test(themeText)) themeStores.push(name);
}
console.log(`\n📌 テーマ店舗: ${themeStores.join(', ')}`);

const bodyText = [script, description, pinComment].join('\n');

const failViolations = [];
for (const [name, rx] of Object.entries(ALL_FAIL_STORES)) {
  if (themeStores.includes(name)) continue;
  const matches = bodyText.match(new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g'));
  if (matches && matches.length > 0) {
    if (name === '楽天' || name === 'Yahoo') {
      const stripped = bodyText
        .replace(/https?:\/\/[^\s]*rakuten\.co\.jp[^\s]*/g, '')
        .replace(/https?:\/\/a\.r10\.to[^\s]*/g, '')
        .replace(/https?:\/\/[^\s]*yahoo\.co\.jp[^\s]*/g, '');
      const nonUrlMatches = stripped.match(rx);
      if (!nonUrlMatches || nonUrlMatches.length === 0) continue;
      failViolations.push(`${name}(本文/概要欄言及${nonUrlMatches.length}件・URL除く)`);
    } else {
      failViolations.push(`${name}(${matches.length}件)`);
    }
  }
}

const warnNotes = [];
for (const [name, rx] of Object.entries(RETAIL_OK)) {
  const matches = bodyText.match(new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g'));
  if (matches && matches.length > 0) warnNotes.push(`${name}(${matches.length}件)`);
}

console.log('\n══ ガード26: テーマ/店舗整合（FAIL/WARN 2段階）══');
if (failViolations.length > 0) {
  console.log(`❌ FAIL（期待通り）: ${failViolations.join(', ')}`);
} else {
  console.log('🟢 PASS（FAILなし）');
}
if (warnNotes.length > 0) {
  console.log(`⚠️  WARN（azu許容・販売店舗例示）: ${warnNotes.join(', ')}`);
}

// ─── ガード27 ───
const POSITIVE_PHRASES = /嬉しい|助かる|ありがとう(?:ござい)?|見て(?:て)?(?:嬉しい|よかった|本当に)|あって(?:本当に)?よかった|有益|参考になる|勉強になる|定期的に(?:チェック|見て|来て)|習慣がついて|頼り(?:にして|になる)|お世話になっ|信頼できる|大好き|応援|励みになる|救われ/;
const CHANNEL_REFS = /(このチャンネル|ガールズちゃんねる|ガルちゃんねる|ガルch|当チャンネル|チャンネル登録してよかった)/;
const lines = script.split('\n');
const ch27Violations = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  if (/^(?:※\s*)?ナレ(?:ーション)?\b/.test(line) || /^(?:※\s*)?ナレ\s*[:：\t]/.test(line)) continue;
  const tabFirst = line.split('\t')[0]?.trim();
  if (tabFirst && /^ナレ(?:ーション)?$/.test(tabFirst)) continue;
  if (CHANNEL_REFS.test(line) && POSITIVE_PHRASES.test(line)) {
    ch27Violations.push(`L${i + 1}: ${line.trim().slice(0, 70)}`);
  }
}
console.log('\n══ ガード27: 自作自演型コメント ══');
if (ch27Violations.length > 0) {
  console.log(`❌ FAIL（期待通り）: ${ch27Violations.length}件`);
  ch27Violations.forEach(v => console.log(`   ${v}`));
} else {
  console.log('🟢 PASS');
}

// ─── ガード28: 論理矛盾検出（除外パターン付き）───
const LOGIC_PATTERNS = [
  { rx: /(安(?:い|さ|価))[^\n。]{0,30}?(疑わ(?:ない|なく)|安心|信頼(?:できる|して)|大丈夫|油断|問題ない|心配(?:ない|なく))/, label: '安い+疑わない/安心系' },
  { rx: /(疑わ(?:ない|なく)|安心|信頼(?:できる|して)|大丈夫|油断|問題ない|心配(?:ない|なく))[^\n。]{0,30}?(安(?:い|さ|価)|低価格|格安)/, label: '疑わない/安心+安い系' },
  { rx: /(高(?:い|さ|価)|高価|高級)[^\n。]{0,30}?(疑(?:う|わ)|危険|不安|怪しい|信用できない|信頼できない)/, label: '高い+疑う/危険系' },
  { rx: /(疑(?:う|わ)|危険|不安|怪しい|信用できない|信頼できない)[^\n。]{0,30}?(高(?:い|さ|価)|高価|高級)/, label: '疑う/危険+高い系' },
];
const EXEMPTION_PATTERNS = [
  /(\d+\s*倍|\d+\s*割|多少|少し)?\s*(高(?:く|い)|割高).{0,40}?(結局|実は|むしろ|逆に|でも|長期では)\s*(安|お得|得|コスパ)/,
  /(結局|実は|むしろ|長期では|トータル)\s*(?:は|で)?\s*安/,
  /(値段|お金|価格)で(?:は)?測れない/,
  /家族の(安心|安全|健康)/,
  /(安心|安全|命)は(値段|お金|価格)/,
  /長い目で見れば/,
];
const logicViolations = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  if (EXEMPTION_PATTERNS.some(rx => rx.test(line))) continue;
  for (const { rx, label } of LOGIC_PATTERNS) {
    if (rx.test(line)) {
      logicViolations.push(`L${i + 1} [${label}]: ${line.trim().slice(0, 80)}`);
      break;
    }
  }
}
console.log('\n══ ガード28: 論理矛盾検出 ══');
if (logicViolations.length > 0) {
  console.log(`❌ FAIL（期待通り）: ${logicViolations.length}件`);
  logicViolations.forEach(v => console.log(`   ${v}`));
} else {
  console.log('🟢 PASS');
}

// ─── ガード29: 概要欄冒頭タイトル禁止 ───
const stripSym = s => s.replace(/[【】「」『』\s　、。！？・]/g, '');
const head = description.split('\n').slice(0, 3).join('\n');
let ch29Violation = null;
if (head.includes(title)) {
  ch29Violation = `タイトル全文一致: 「${title}」`;
} else {
  const titleCore = stripSym(title);
  const headCore = stripSym(head);
  if (titleCore.length >= 15) {
    for (let i = 0; i <= titleCore.length - 15; i++) {
      const snippet = titleCore.substring(i, i + 15);
      if (headCore.includes(snippet)) {
        ch29Violation = `タイトル核心15字一致: 「${snippet}」`;
        break;
      }
    }
  }
}
console.log('\n══ ガード29: 概要欄冒頭タイトル禁止 ══');
if (ch29Violation) {
  console.log(`❌ FAIL（期待通り）: ${ch29Violation}`);
  console.log(`   概要欄L1: ${head.split('\n')[0].slice(0, 80)}`);
} else {
  console.log('🟢 PASS');
}
