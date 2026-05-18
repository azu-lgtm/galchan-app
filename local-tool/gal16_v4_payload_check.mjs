// 自ガル16 v4 用 pre_save_gate ペイロード生成 + 実行
import { readFile, writeFile } from 'fs/promises';

const tsvPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル16台本】店舗別保存版_20260517.tsv';
const descPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】概要欄_20260517.md';
const pinPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】固定コメント_20260517.md';
const tagPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】メタタグ_20260517.md';
const wmPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】ワーカーメッセージ_20260517.md';

const script = await readFile(tsvPath, 'utf8');
const description = await readFile(descPath, 'utf8');
const pinComment = await readFile(pinPath, 'utf8');
const tagMd = await readFile(tagPath, 'utf8');
const wm = await readFile(wmPath, 'utf8');

const tags = (tagMd.match(/^\d+\.\s(.+)$/gm) || []).map(l => l.replace(/^\d+\.\s/, '').trim());

const payload = {
  channel: 'galchan',
  video_id: 'gal16',
  title: '【保存版 有益まとめ】業務スーパー・ドンキ・コストコ・ロピア…40代以降が絶対買うな危険食品＆逆に神食品まとめ【有益ガルちゃん】',
  thumbnails: [
    '国が警告！絶対買うな',
    '危険食品まとめ',
    '農水省が是正指示出した店も',
    '管理栄養士が家族に出さない'
  ],
  thumbnailTexts: [
    '国が警告！絶対買うな',
    '危険食品まとめ',
    '農水省が是正指示出した店も',
    '管理栄養士が家族に出さない'
  ],
  script,
  description,
  pinComment,
  tags,
  workerMessage: wm,
  productList: [], // v4出荷ではproductListは別データ・空でも可
  integrity_check_log_path: '.integrity-log/gal16_1779009950_c328a15fbd25.json'
};

await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/gal16_v4_payload.json', JSON.stringify(payload, null, 2), 'utf8');
console.log('✅ payload書き出し完了: gal16_v4_payload.json');
console.log('   script chars:', script.length);
console.log('   desc chars:', description.length);
console.log('   pin chars:', pinComment.length);
console.log('   tags:', tags.length, tags.join('/'));
