#!/usr/bin/env node
/**
 * 自ガル12保存スクリプト（save_gal11.mjsの構造を流用）
 * pre_save_gate.mjs通過後→/api/google/save経由で新規スプシ作成+動画管理シート追記
 *
 * 構造:
 * - productList: 大手代替13件のみ（PB13件はアフィなしのためproductListに入れない）
 *   → 概要欄/固定コメに掲載されているアフィリンクと整合
 * - 動画内ではPB13件も紹介するが、アフィリンクは大手13件のみ
 */
import { readFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';

const tsvPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル12台本】ドンキ_20260427.tsv';
const descMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル12】概要欄.md';
const pinMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル12】固定コメント.md';
const workerMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル12】ワーカーメッセージ.md';

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n+/, '').replace(/^#\s+.*\n/, '').trim();
}

const script = await readFile(tsvPath, 'utf8');
const desc = stripFrontmatter(await readFile(descMdPath, 'utf8'));
const pin = stripFrontmatter(await readFile(pinMdPath, 'utf8'));
const worker = stripFrontmatter(await readFile(workerMdPath, 'utf8'));

// 概要欄から大手代替13商品を抽出（■で始まる商品名+Amazon/楽天URL）
// 概要欄には大手代替13件のみアフィリンク付きで掲載されている
const descRaw = await readFile(descMdPath, 'utf8');
const productBlocks = descRaw.split(/^■\s+/m).slice(1);
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

console.log(`📦 productList抽出（大手代替）: ${productList.length}件`);
productList.forEach((p, i) => console.log(`   ${i+1}. ${p.name}`));

// サムネ10要素（上段/下段/左4商品/左白枠/右4商品/右白枠）
// 台本v2のサムネ文言構造に準拠
const thumbnailParts = [
  '上段: 元ドンキ店員も買わない',
  '下段: 主婦は絶対カゴに入れるな',
  '左商品1: マンゴーグミ',
  '左商品2: 焼き貝ひも',
  '左商品3: ハンディファン',
  '左商品4: 4Kテレビ',
  '左白枠: 12万個回収も…',
  '右商品1: 焼き芋',
  '右商品2: ごまにんにく',
  '右商品3: 卵かけ風ご飯のたれ',
  '右商品4: ハトムギ化粧水',
  '右白枠: こっちは買って正解',
];
const thumbnailCombined = thumbnailParts.join(' / ');

const payload = {
  topic: {
    title: '元ドンキ店員も買わない×ドンキで絶対カゴに入れるな13選＋代わりに買うべき神商品',
    description: 'ドンキで絶対カゴに入れるな日用品ワースト13（ランキング形式カウントダウン）と、代わりに買うべきPB良品13件+大手代替13件のハイブリッド型。1位は焼き貝ひもカビ回収（公式A確度・意外性重視）',
    angle: '元店員警告×ランキング形式カウントダウン+ネガポジペア型ハイブリッド（PB良品+大手代替）',
    emotionWords: ['警告', 'ゾッとした', '後悔', '家族の食卓', 'カゴに入れるな'],
    source: 'ドンキ公式リコール+消費者庁+NITE+LDK+ガルちゃんスレ',
    category: '注意喚起×PB良品+大手代替ハイブリッド型',
  },
  style: 'product',
  script,
  materials: {
    titles: [
      '【元ドンキ店員も買わない】ドンキで絶対カゴに入れるな13選＋代わりに買うべき神商品',
    ],
    thumbnails: [thumbnailCombined],
    description: desc,
    metaTags: 'ガルちゃんまとめ,元店員,ゾッとした,有益,失敗回避',
    pinComment: pin,
    workerMessage: worker,
    productList,
    serialNumber: '【自ガル12】',
    managementMemo: '【企画理由】自ガル11(ホームセンター)CTR高水準達成後、店舗縛り×元店員権威武装を踏襲しドンキへ展開。ハイブリッド構造（ネガ13選×ポジPB良品13+大手代替13）で「ドンキ全否定じゃない・選んで買えば良い」のバランス感でガル民納得感最大化。1位を焼き貝ひもカビ回収（公式A確度・意外性）に配置・マンゴーグミ約12万袋回収を2位に・通う習慣はランキング外・最後のまとめ\n【セッション記録】Obsidian: 08_ai_chat_memo/galchan-app/セッション_20260427_自ガル12完遂.md\n【媒体】ドンキ公式お知らせ自主回収/消費者庁リコールDB/NITEリチウムイオン電池統計/Francfranc公式/LDK食品ランキング+LDK the Beauty/ヒット商品大賞2025/ガルちゃんスレ\n【競合】ガル姫「ドンキ買って後悔」系動画群/聖徳太子ch等 ドンキ全ジャンル横断扱い競合 部分空き=ハイブリッド型でAポジ独占',
  },
};

// ── Gate ───────────────
await writeFile('/tmp/gal12_payload.json', JSON.stringify(payload, null, 2));
console.log('🔒 Running pre_save_gate.mjs...');
await new Promise((resolve, reject) => {
  const p = spawn('node', ['C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/pre_save_gate.mjs', '/tmp/gal12_payload.json', '--channel=galchan'], { stdio: 'inherit' });
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

// 保存結果をJSONに残す
await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_result_gal12.json', JSON.stringify(json, null, 2));
