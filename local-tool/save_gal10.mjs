import { readFile } from 'fs/promises';

const tsvPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル10台本】商品詐欺_20260420.tsv';
const productTsvPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル10】商品リスト_Sheet2.tsv';
const descMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル10】概要欄.md';
const pinMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル10】固定コメント.md';
const workerMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル10】ワーカーメッセージ.md';

const script = await readFile(tsvPath, 'utf8');
const desc = await readFile(descMdPath, 'utf8');
const pin = await readFile(pinMdPath, 'utf8');
const worker = await readFile(workerMdPath, 'utf8');
const productRaw = await readFile(productTsvPath, 'utf8');

const productList = productRaw.split('\n').slice(1).filter(l => l.trim()).map(line => {
  const [name, maker, kind, memo] = line.split('\t');
  return {
    name: name || '',
    category: kind || '',
    scriptQuote: memo || '',
    amazonLink: '',
    rakutenLink: '',
  };
});

const payload = {
  topic: {
    title: '売り場のプロが選ばない食品・お菓子・飲料25選（元店員暴露）',
    description: '40代以降が毎週カゴに入れてた食品の改悪・買収・ステルス値上げを元店員視点で暴露。代替ブランドと末尾COOP OK例付き',
    angle: '元店員の内部告発・ネガポジペア型',
    emotionWords: ['衝撃', '告発', 'ゾッとした', '後悔'],
  },
  style: 'product',
  script,
  materials: {
    titles: [
      '【衝撃の告発】40代以降が知らずにカゴに入れてた…売り場のプロが選ばない食品・お菓子・飲料25選（カントリーマァム/ハーゲンダッツ/爽健美茶/辛ラーメン）【有益ガルちゃん】',
    ],
    thumbnails: [
      '元店員が暴露 / 絶対これ食べるな',
    ],
    description: desc,
    metaTags: 'ガルちゃんまとめ,衝撃の告発,消費者庁,有益,ゾッとした',
    pinComment: pin,
    workerMessage: worker,
    productList,
    serialNumber: '【自ガル10】',
  },
};

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
