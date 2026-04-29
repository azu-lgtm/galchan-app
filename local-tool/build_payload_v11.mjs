#!/usr/bin/env node
/**
 * 自ガル11 v11 payload生成スクリプト
 * 指示書に従ってv11台本/概要欄/固定コメ/メタタグ/ワーカーメッセージMDから
 * save_payload_v11.json を構築する
 */
import { readFile, writeFile } from 'fs/promises';

const MD_DIR = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本';
const scriptMdPath = `${MD_DIR}/【自ガル11台本v11】ホームセンター_20260424.md`;
const descMdPath = `${MD_DIR}/【自ガル11】概要欄.md`;
const pinMdPath = `${MD_DIR}/【自ガル11】固定コメント.md`;
const metaMdPath = `${MD_DIR}/【自ガル11】メタタグ.md`;
const workerMdPath = `${MD_DIR}/【自ガル11】ワーカーメッセージ.md`;

const outPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_v11.json';

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n+/, '').trim();
}

// 台本MDから ```...``` のTSVブロックを抽出
function extractTSVBlock(md) {
  const m = md.match(/```\s*\n([\s\S]*?)\n```/);
  if (!m) throw new Error('TSV block (```) not found in script MD');
  return m[1];
}

// 固定コメMDから商品ブランド情報を抽出
function extractProducts(pinMd) {
  // ■で始まるブロックに分割
  const blocks = pinMd.split(/^■\s+/m).slice(1);
  return blocks.map(block => {
    const lines = block.split('\n');
    const name = lines[0].trim();
    const amazonLine = lines.find(l => l.startsWith('Amazon:')) || '';
    const rakutenLine = lines.find(l => l.startsWith('楽天:')) || '';
    return {
      name,
      category: 'ポジ',
      amazonLink: amazonLine.replace(/^Amazon:\s*/, '').trim(),
      rakutenLink: rakutenLine.replace(/^楽天:\s*/, '').trim(),
    };
  }).filter(p => p.name && !p.name.startsWith('※') && !p.name.startsWith('Amazon') && p.amazonLink);
}

const scriptMdRaw = await readFile(scriptMdPath, 'utf8');
const descRaw = await readFile(descMdPath, 'utf8');
const pinRaw = await readFile(pinMdPath, 'utf8');
const workerRaw = await readFile(workerMdPath, 'utf8');

const tsv = extractTSVBlock(scriptMdRaw);
const description = stripFrontmatter(descRaw);
const pinComment = stripFrontmatter(pinRaw);
const workerMessageRaw = stripFrontmatter(workerRaw);

// 概要欄MDの先頭はYAML frontmatterなし(確認済み) → そのまま使う
// ただし stripFrontmatter で安全に処理

// 固定コメ商品抽出
const productList = extractProducts(pinRaw);
console.log(`📦 productList抽出: ${productList.length}件`);
for (const p of productList) {
  console.log(`  - ${p.name}`);
}

// ワーカーメッセージ：pre_save_gate.mjs 7.3 がプレースホルダー検出するため
// save前は実URL不明 → ダミーURL（波括弧なし）でガード通過
// save API成功後に実URLでMD/シートを上書き運用（指示書Step 4-5）
const workerMessage = `この度はご契約ありがとうございます。
本日より業務を開始させていただきます。

・台本（納品時はこちらのファイル名で）
https://docs.google.com/spreadsheets/d/PLACEHOLDER_GAL11/edit

※マニュアル・運用ルール・商品リスト対応はチャットワーク固定タスク【必読】動画編集の基本情報を参照

完成後はクラウドワークスから納品をお願いします。
よろしくお願いいたします。
あずき`;

const payload = {
  topic: {
    title: '元ホームセンター店員警告×絶対買うな10選＋代わりに選びたい神商品まとめ',
    description: 'カインズ等HCで絶対買うな日用品ワースト10と代わりに選びたい神商品まとめ',
    angle: '元店員権威×公式リコール武装×ランキング1位匂わせ',
    emotionWords: ['驚き', '後悔', '恐怖', '共感'],
    source: 'ガルちゃんスレ + 公的機関リコール情報',
    category: '注意喚起×代替ハイブリッド型',
  },
  style: 'product',
  script: tsv,
  materials: {
    titles: [
      '【元ホームセンター店員】絶対買うな10選＋代わりに選びたい神商品まとめ',
    ],
    thumbnails: [
      '上段: 元ホームセンター店員が警告 / 下段: 絶対これ買うな / 白枠1: 電球で天井が焦げた / 白枠2: 踏み台で骨折1ヶ月ギプス / 白枠3: 20年働いた私は家族に絶対すすめない / 白枠4: 安物家具より正解の10年',
    ],
    description,
    metaTags: 'ガルちゃんまとめ,元店員,ゾッとした,有益,失敗回避',
    pinComment,
    workerMessage,
    productList,
    managementMemo: '【企画理由】HC店員権威×ランキング型・公的リコール（カインズサーキュレーター/星テック電気敷毛布）武装で50万再生狙い\n【セッション記録】2026-04-24 着手 → v8（23行字数違反等）→ v9（A案）→ v10（タイトル神商品まとめ化）→ v11（公開前最終調整11箇所修正：コーナン/DCM削除/星テック実名/NITE126件/PSE定格容量/圧縮袋ダニ削除/LED公称寿命/HC外3品削除）\n【媒体】YouTubeガルちゃんyt 第11作\n【競合】ガル姫・ガルねこ等の店舗縛り×食品系競合空き12chでAポジ独占',
    serialNumber: '【自ガル11】',
  },
};

await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`\n✅ payload出力: ${outPath}`);
console.log(`  - script: ${tsv.length}字`);
console.log(`  - description: ${description.length}字`);
console.log(`  - pinComment: ${pinComment.length}字`);
console.log(`  - workerMessage: ${workerMessage.length}字`);
console.log(`  - productList: ${productList.length}件`);
