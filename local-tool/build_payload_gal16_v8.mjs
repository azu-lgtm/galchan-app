import fs from 'fs';
import path from 'path';

const base = String.raw`C:\Users\meiek\Dropbox\アプリ\remotely-save\obsidian\02_youtube\ガルちゃんねる\自分動画\自社台本`;
const tsvPath = String.raw`C:\Users\meiek\Desktop\ClaudeCode-projects\galchan-app\local-tool\tsv_input\【自ガル16台本】店舗別保存版_20260517.tsv`;

const tsv = fs.readFileSync(tsvPath, 'utf8');
const desc = fs.readFileSync(path.join(base, '【自ガル16】概要欄_20260517.md'), 'utf8');
const pin = fs.readFileSync(path.join(base, '【自ガル16】固定コメント_20260517.md'), 'utf8');
const worker = fs.readFileSync(path.join(base, '【自ガル16】ワーカーメッセージ_20260517.md'), 'utf8');

const thumbnailSpec = '上段: 国が警告！絶対買うな / 下段: 危険食品まとめ / 白枠1: 農水省が是正指示出した店も / 白枠2: 原材料を見直したい / 白枠3: (画像のみ・文言なし) / 白枠4: (画像のみ・文言なし)';

const payload = {
  channel: 'galchan',
  video_id: 'gal16',
  topic: {
    title: '【保存版 有益まとめ】店舗別6店舗で40代以降が絶対買うな食品＆逆に神食品まとめ【有益ガルちゃん】',
    description: '店舗別6店舗で40代以降が絶対買うな危険食品+逆に神食品まとめ、消費者庁・農林水産省・国民生活センター公式データ軸×店舗別ネガポジペア型',
    angle: '店舗別×公的データ軸×ネガポジペア型（24商品）',
    emotionWords: ['消費者庁', '農林水産省', '4万5648個', '64万5994パック', '神食品', '無添加'],
    source: 'ガルちゃんスレ + 消費者庁/農林水産省関東農政局/国民生活センター + 各店舗公式発表',
    category: '注意喚起×代替ネガポジペア型(店舗別6店舗)'
  },
  style: 'product',
  title: '【保存版 有益まとめ】店舗別6店舗で40代以降が絶対買うな食品＆逆に神食品まとめ【有益ガルちゃん】',
  script: tsv,
  description: desc,
  pinComment: pin,
  thumbnails: [thumbnailSpec],
  thumbnailTexts: [thumbnailSpec],
  tags: ['ガルちゃんまとめ', 'ロピア', '保存版', '有益', '業務スーパー'],
  workerMessage: worker,
  productList: [],
  materials: {
    titles: ['【保存版 有益まとめ】店舗別6店舗で40代以降が絶対買うな食品＆逆に神食品まとめ【有益ガルちゃん】'],
    thumbnails: [thumbnailSpec],
    description: desc,
    metaTags: 'ガルちゃんまとめ,ロピア,保存版,有益,業務スーパー',
    pinComment: pin,
    workerMessage: worker,
    productList: []
  },
  integrity_check_log_path: '.integrity-log/gal16_1779079972_37dcb1ed00f3.json'
};

const outPath = String.raw`C:\Users\meiek\Desktop\ClaudeCode-projects\galchan-app\local-tool\save_payload_gal16_v8.json`;
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

console.log('OK save_payload_gal16_v8.json');
console.log('script chars: ' + tsv.length);
console.log('description chars: ' + desc.length);
console.log('pinComment chars: ' + pin.length);
console.log('worker chars: ' + worker.length);
