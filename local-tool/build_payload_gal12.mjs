#!/usr/bin/env node
/**
 * 自ガル12 payload構築のみ実行（gate前確認用）
 */
import { readFile, writeFile } from 'fs/promises';

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

await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal12.json', JSON.stringify(payload, null, 2));
console.log(`✅ payload保存: save_payload_gal12.json`);
console.log(`   productList: ${productList.length}件`);
console.log(`   description: ${desc.length}字`);
console.log(`   pinComment: ${pin.length}字`);
console.log(`   workerMessage: ${worker.length}字`);
console.log(`   thumbnail要素: ${thumbnailParts.length}個`);
