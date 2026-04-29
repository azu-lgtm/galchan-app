#!/usr/bin/env node
/**
 * 自ガル13 payload構築（pre_save_gate前確認用）
 * 修正後のTSV/材料MDを再パースしてsave_payload_gal13.jsonを再生成する。
 */
import { readFile, writeFile } from 'fs/promises';

const tsvPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル13台本】ダイエット_20260429.tsv';
const materialsPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル13台本】ダイエット_20260429_materials.md';

function extractCodeBlock(md, headingRegex) {
  const lines = md.split('\n');
  let inSection = false;
  let inFence = false;
  const collected = [];
  for (const line of lines) {
    if (!inSection && headingRegex.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && !inFence && /^```/.test(line)) {
      inFence = true;
      continue;
    }
    if (inSection && inFence && /^```$/.test(line)) {
      return collected.join('\n').trim();
    }
    if (inSection && inFence) {
      collected.push(line);
    }
  }
  return '';
}

const script = await readFile(tsvPath, 'utf8');
const matMd = await readFile(materialsPath, 'utf8');

const titleBlock = extractCodeBlock(matMd, /^## YouTubeタイトル/);
const thumbBlock = extractCodeBlock(matMd, /^## サムネ確定情報/);
const metaBlock = extractCodeBlock(matMd, /^## メタタグ/);
const descBlock = extractCodeBlock(matMd, /^## 概要欄/);
const pinBlock = extractCodeBlock(matMd, /^## 固定コメント/);
const workerBlock = extractCodeBlock(matMd, /^## ワーカーメッセージ/);
const memoBlock = extractCodeBlock(matMd, /^## 動画管理シートメモ/);

// 概要欄から ■ で始まる商品ブロックを抽出
const productBlocks = descBlock.split(/^■\s+/m).slice(1);
const productList = productBlocks.map(block => {
  const lines = block.split('\n');
  const nameAndUrl = lines[0].trim();
  // "商品名: URL" 形式
  const colonIdx = nameAndUrl.indexOf(':');
  const name = colonIdx > 0 ? nameAndUrl.substring(0, colonIdx).trim() : nameAndUrl;
  const amazonUrl = colonIdx > 0 ? nameAndUrl.substring(colonIdx + 1).trim() : '';
  // 楽天は固定コメから探す
  const rakutenMatch = pinBlock.match(new RegExp(`■\\s+${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}[\\s\\S]*?楽天:\\s*(\\S+)`));
  const rakutenLink = rakutenMatch ? rakutenMatch[1] : '';
  return {
    name,
    category: 'ポジ',
    scriptQuote: '',
    amazonLink: amazonUrl,
    rakutenLink,
  };
}).filter(p => p.name && !p.name.startsWith('※') && !p.name.includes('紹介した商品全'));

const payload = {
  topic: {
    title: '40〜50代主婦が痩せないこのダイエット5NG＋本当に痩せた5OK',
    description: '医師・公的機関警告ベースの5NG（個人輸入/短期減量/食べないだけ/過度な糖質制限/サプリガジェット）と、台所の家庭の知恵5OK（よく噛む/お酢/麦ごはん/梅干しレンチン/緑茶コーヒー）の逆順カウントダウン型',
    angle: '医師・公的機関警告×台所の家庭の知恵×逆順カウントダウン',
    emotionWords: ['警告', '後悔', '家計', '更年期', '家庭の知恵'],
    source: 'ガルちゃんスレ + 厚労省/国民生活センター/農研機構/ミツカン公式',
    category: '注意喚起×代替ハイブリッド型',
  },
  style: 'product',
  script,
  materials: {
    titles: [titleBlock],
    thumbnails: [thumbBlock],
    description: descBlock,
    metaTags: metaBlock,
    pinComment: pinBlock,
    workerMessage: workerBlock,
    productList,
    serialNumber: '【自ガル13】',
    managementMemo: memoBlock,
  },
};

const outPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal13.json';
await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`✅ payload保存: ${outPath}`);
console.log(`   productList: ${productList.length}件`);
console.log(`   description: ${descBlock.length}字`);
console.log(`   pinComment: ${pinBlock.length}字`);
console.log(`   workerMessage: ${workerBlock.length}字`);
console.log(`   metaTags: ${metaBlock}`);
