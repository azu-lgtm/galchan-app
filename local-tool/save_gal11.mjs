#!/usr/bin/env node
/**
 * 自ガル11保存スクリプト
 * pre_save_gate.mjs通過後→/api/google/save経由で新規スプシ作成+動画管理シート追記
 */
import { readFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';

const tsvPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル11台本】ホームセンター_20260424.tsv';
const descMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル11】概要欄.md';
const pinMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル11】固定コメント.md';
const workerMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル11】ワーカーメッセージ.md';

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n+/, '').replace(/^#\s+.*\n/, '').trim();
}

const script = await readFile(tsvPath, 'utf8');
const desc = stripFrontmatter(await readFile(descMdPath, 'utf8'));
const pin = stripFrontmatter(await readFile(pinMdPath, 'utf8'));
const worker = stripFrontmatter(await readFile(workerMdPath, 'utf8'));

// 固定コメント.mdから18商品抽出（■で始まる商品名+Amazon/楽天URLパース）
const pinRaw = await readFile(pinMdPath, 'utf8');
const productBlocks = pinRaw.split(/^■\s+/m).slice(1);
const productList = productBlocks.map(block => {
  const lines = block.split('\n');
  const name = lines[0].trim();
  const amazonLine = lines.find(l => l.startsWith('Amazon:')) || '';
  const rakutenLine = lines.find(l => l.startsWith('楽天:')) || '';
  return {
    name,
    category: 'ポジ',
    scriptQuote: '',
    amazonLink: amazonLine.replace(/^Amazon:\s*/, '').trim(),
    rakutenLink: rakutenLine.replace(/^楽天:\s*/, '').trim(),
  };
}).filter(p => p.name && !p.name.startsWith('※'));

console.log(`📦 productList抽出: ${productList.length}件`);

// サムネ6要素（上段/下段/白枠1-4）
const thumbnailParts = [
  '上段: 元ホームセンター店員が警告',
  '下段: 絶対これ買うな',
  '白枠1: 電球で天井が焦げた',
  '白枠2: 踏み台で骨折1ヶ月ギプス',
  '白枠3: 20年働いた私は家族に絶対すすめない',
  '白枠4: 安物家具より正解の10年',
];
const thumbnailCombined = thumbnailParts.join(' / ');

const payload = {
  topic: {
    title: '元ホームセンター店員警告×絶対買うな10選+代わりに買うべき14選',
    description: 'カインズ/DCM/コーナン等で絶対買うな日用品ワースト10（ランキング形式カウントダウン）と、代わりに買うべき神商品14選を元店員視点で警告',
    angle: '元ホームセンター店員警告・ランキング形式カウントダウン+ネガポジペア型',
    emotionWords: ['警告', 'ゾッとした', '後悔', '家族の命'],
  },
  style: 'product',
  script,
  materials: {
    titles: [
      '【元ホームセンター店員が警告】絶対買うな10選と代わりに買うべき商品14選',
    ],
    thumbnails: [thumbnailCombined],
    description: desc,
    metaTags: 'ガルちゃんまとめ,元店員,ゾッとした,有益,失敗回避',
    pinComment: pin,
    workerMessage: worker,
    productList,
    serialNumber: '【自ガル11】',
    managementMemo: '【企画理由】自ガル10(食品詐欺)でCTR8.8%達成後、食品系被り回避+40代以降女性が日常的に行く店×失敗/危険/後悔回避の軸で店舗縛り（ホームセンター）×元店員権威武装を採用。消費者庁リコール6件武装（カインズサーキュレーター/星テック電気敷毛布/電気こたつ等）でランキング形式1位意外性フック\n【セッション記録】Obsidian: 08_ai_chat_memo/galchan-app/セッション_20260424_自ガル11完遂.md\n【媒体】消費者庁リコール情報サイト/NITE配線器具事故統計/日本照明工業会LED電球適合器具案内/カインズ公式自主回収情報/ガルちゃんweb掲示板\n【競合】ガル姫「買って後悔した日用品」系動画群 / 聖徳太子ch等 ホームセンター真正面扱い競合12ch完全空き=Aポジ独占',
  },
};

// ── Gate ───────────────
await writeFile('/tmp/gal11_payload.json', JSON.stringify(payload, null, 2));
console.log('🔒 Running pre_save_gate.mjs...');
await new Promise((resolve, reject) => {
  const p = spawn('node', ['C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/pre_save_gate.mjs', '/tmp/gal11_payload.json', '--channel=galchan'], { stdio: 'inherit' });
  p.on('exit', code => code === 0 ? resolve() : reject(new Error(`Gate failed with exit ${code}`)));
});

console.log('\n🟢 Gate通過、/api/google/saveへPOSTする');

// ── /api/google/save へPOST ───────────────
const res = await fetch('http://localhost:3001/api/google/save', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'gc_auth_token=authenticated',
  },
  body: JSON.stringify(payload),
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));

if (!json.success) {
  console.error('❌ 保存失敗');
  process.exit(1);
}
console.log('\n🟢 保存完了');
console.log('📄 新スプシURL:', json.spreadsheetUrl);
