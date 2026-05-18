// 自ガル16 v4 最終QA簡易チェッカー
import { readFile } from 'fs/promises';

const tsvPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル16台本】店舗別保存版_20260517.tsv';
const mdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16台本】店舗別保存版_20260517.md';
const descPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】概要欄_20260517.md';
const pinPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】固定コメント_20260517.md';
const tagPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】メタタグ_20260517.md';

const tsv = await readFile(tsvPath, 'utf8');
const desc = await readFile(descPath, 'utf8');
const pin = await readFile(pinPath, 'utf8');
const tag = await readFile(tagPath, 'utf8');

const lines = tsv.split(/\r?\n/).filter(l => l.length > 0);
console.log('=== TSV基本指標 ===');
console.log('総行数:', lines.length);

let bodyChars = 0;
let over70 = 0;
const over70List = [];
let under30 = 0;
const under30List = [];
let se1 = 0, se2 = 0, itch = 0;
let prevSpeaker = '';
let consec = 0;
const consecList = [];

for (let i = 0; i < lines.length; i++) {
  const cols = lines[i].split('\t');
  const sp = cols[0] || '';
  const body = cols[1] || '';
  const seCol = cols[2] || '';
  bodyChars += body.length;
  if (body.length > 70) {
    over70++;
    over70List.push(`L${i+1} ${sp} (${body.length}字): ${body.slice(0, 60)}`);
  }
  if (body.length < 30 && sp !== 'イッチ' && sp !== 'タイトル') {
    under30++;
    under30List.push(`L${i+1} ${sp} (${body.length}字): ${body}`);
  }
  if (seCol === 'SE1') se1++;
  if (seCol === 'SE2') se2++;
  if (sp === 'イッチ') itch++;
  // スレ民同士の連続だけNG（ナレーション/タイトル除外）
  if (sp === prevSpeaker && sp !== 'ナレーション' && sp !== 'タイトル' && sp !== '') {
    consec++;
    consecList.push(`L${i+1}: ${sp} 連続`);
  }
  prevSpeaker = sp;
}

console.log('本文文字数(日本語含む全文字):', bodyChars);
console.log('70字超:', over70);
if (over70List.length > 0) over70List.forEach(l => console.log('  ', l));
console.log('30字未満(イッチ・タイトル除く):', under30);
if (under30List.length > 0) under30List.forEach(l => console.log('  ', l));
console.log('SE1:', se1, 'SE2:', se2, 'total_SE:', se1+se2);
console.log('イッチ出現:', itch);
console.log('連続話者(同speaker隣接):', consec);
if (consecList.length > 0) consecList.forEach(l => console.log('  ', l));

console.log('\n=== 禁止語チェック（v4 TSV内） ===');
const banned = [
  { word: 'PB', desc: '略語PB残存' },
  { word: 'プライベートブランド', desc: '略語の和訳語残存(自社ブランドへ統一)' },
  { word: 'コスパ', desc: 'コスパ表現残存(値段以上/家計に助かる/割に合う)' },
  { word: 'ロティサリーチキン', desc: '実名残存(抽象化済のはず)' },
  { word: '73店舗', desc: '旧店舗数残存(74店舗が正)' },
  { word: '3年間で', desc: '旧期間残存(約3年3か月が正)' },
  { word: '全ロット回収', desc: '旧表現残存(賞味期限内ロット回収が正)' },
  { word: '是正命令', desc: '法的呼称誤り(是正指示が正)' },
  { word: 'ガル民', desc: 'ガル民呼称(主語ぼかし型へ)' },
  { word: '知恵袋', desc: '引用元明示' },
  { word: 'Twitter', desc: '引用元明示' },
  { word: 'インスタで', desc: '引用元明示' },
  { word: 'SNSで', desc: '引用元明示' },
  { word: 'OEM', desc: 'アルファベット略語' },
  { word: 'NB', desc: 'アルファベット略語' },
  { word: 'HC', desc: 'アルファベット略語' },
  { word: 'EC', desc: 'アルファベット略語' },
];
for (const b of banned) {
  const count = (tsv.match(new RegExp(b.word, 'g')) || []).length;
  console.log(`  "${b.word}": ${count} 件 ${count === 0 ? '✅' : '❌ ' + b.desc}`);
}

console.log('\n=== 自作自演型コメ（C10） ===');
// このチャンネル+ポジ評価語
const channelRefs = ['このチャンネル', 'ガルちゃんねる', 'ガールズちゃんねる', 'ガルch'];
const positives = ['嬉しい', '助かる', 'ありがとう', '有益', '見てよかった', '習慣がついて', '頼り', 'お世話になっ', '応援', '励みになる', '救われ'];
// 行ごとに探す（ナレーション除外）
let selfPraise = 0;
for (let i = 0; i < lines.length; i++) {
  const cols = lines[i].split('\t');
  const sp = cols[0] || '';
  const body = cols[1] || '';
  if (sp === 'ナレーション' || sp === 'タイトル') continue;
  for (const ref of channelRefs) {
    if (body.includes(ref)) {
      for (const pos of positives) {
        if (body.includes(pos)) {
          selfPraise++;
          console.log(`  ❌ L${i+1} ${sp}: "${body.slice(0, 50)}"`);
        }
      }
    }
  }
}
console.log(`自作自演型検出: ${selfPraise} 件 ${selfPraise === 0 ? '✅' : '❌'}`);

console.log('\n=== 論理整合性（C11） ===');
// 安い+疑わない/安心/信頼/大丈夫/油断
const lowPriceTrustWords = ['疑わない', '安心', '信頼', '大丈夫', '油断'];
const highPriceDoubtWords = ['疑う', '危険', '不安', '怪しい'];
let logicViolation = 0;
for (let i = 0; i < lines.length; i++) {
  const cols = lines[i].split('\t');
  const body = cols[1] || '';
  // 「安い」と疑わない系が近接
  if (body.includes('安い') && body.includes('から')) {
    for (const w of lowPriceTrustWords) {
      if (body.includes(w)) {
        // 除外例: 「結局安い」「長い目で見れば」「家族の安心は値段で測れない」
        if (!body.includes('結局安い') && !body.includes('長い目') && !body.includes('値段で測れない')) {
          logicViolation++;
          console.log(`  WARN L${i+1}: 安い+${w} → "${body.slice(0, 60)}"`);
        }
      }
    }
  }
}
console.log(`論理整合性違反候補: ${logicViolation} 件 ${logicViolation === 0 ? '✅' : 'WARN'}`);

console.log('\n=== 概要欄 ===');
console.log('概要欄文字数:', desc.length);
const titleCore = 'Amazonで売れてる危険商品';
const descLines = desc.split('\n');
console.log('L1:', descLines[0].slice(0, 80));
console.log('冒頭3行にタイトル核心混入チェック...');
const title = '【保存版 有益まとめ】業務スーパー・ドンキ・コストコ・ロピア…40代以降が絶対買うな危険食品＆逆に神食品まとめ【有益ガルちゃん】';
const head3 = descLines.slice(0, 3).join(' ');
const titleClean = title.replace(/[【】「」『』\s　、。！？・×+()｜/\\,.!?\-:：;＆…&]+/g, '');
console.log('  冒頭3行記号削除:', head3.replace(/[【】「」『』\s　、。！？・×+()｜/\\,.!?\-:：;＆…&]+/g, '').slice(0, 80));
// 15字以上の部分一致を探す
let titleMatch = false;
for (let len = 15; len <= 30 && len <= titleClean.length; len++) {
  for (let i = 0; i <= titleClean.length - len; i++) {
    const sub = titleClean.slice(i, i + len);
    const head3Clean = head3.replace(/[【】「」『』\s　、。！？・×+()｜/\\,.!?\-:：;＆…&]+/g, '');
    if (head3Clean.includes(sub)) {
      console.log(`  ❌ 冒頭3行にタイトル核心${len}字一致: "${sub}"`);
      titleMatch = true;
      break;
    }
  }
  if (titleMatch) break;
}
if (!titleMatch) console.log('  ✅ 冒頭3行にタイトル核心15字以上の連続一致なし');

console.log('\nAmazonアソシエイト表記:', desc.includes('Amazonアソシエイト') ? '✅' : '❌');
console.log('楽天アフィリエイト表記:', desc.includes('楽天アフィリエイト') ? '✅' : '❌');
console.log('個人の感想:', desc.includes('個人の感想') ? '✅' : '❌');
console.log('著作権:', desc.includes('著作権を侵害する意図で運営しておりません') ? '✅' : '❌');

console.log('\n=== 固定コメ ===');
const amazonCount = (pin.match(/amazon\.co\.jp/g) || []).length;
const rakutenCount = (pin.match(/rakuten\.co\.jp/g) || []).length;
console.log('Amazon URL数:', amazonCount, '楽天 URL数:', rakutenCount);
console.log('質問3個以上:', (pin.match(/^・/gm) || []).length >= 3 ? '✅' : '❌');
console.log('Amazonアソシエイト表記:', pin.includes('Amazonアソシエイト') ? '✅' : '❌');

console.log('\n=== メタタグ ===');
const tags = tag.match(/^\d+\.\s.+$/gm) || [];
console.log('タグ数:', tags.length);
tags.forEach(t => console.log('  ', t));
console.log('「元店員」混入:', tag.match(/^\d+\.\s.*元店員/m) ? '❌残存' : '✅なし');
console.log('「ロピア」含む:', tag.match(/^\d+\.\s.*ロピア/m) ? '✅' : '❌');

console.log('\n=== サムネ-本文整合 ===');
// 白枠左「農水省が是正指示」⇒本文に是正指示あり
const md = await readFile(mdPath, 'utf8');
const thumbnailLeft = '農水省が是正指示出した店も';
const thumbnailRight = '管理栄養士が家族に出さない';
console.log('白枠左:', thumbnailLeft, '→本文に「是正指示」:', tsv.includes('是正指示') ? '✅' : '❌');
console.log('白枠右:', thumbnailRight, '→本文に「管理栄養士」:', tsv.includes('管理栄養士') ? '✅' : '❌');
console.log('  本文の管理栄養士行:');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('管理栄養士')) console.log('    L' + (i+1) + ': ' + lines[i].slice(0, 80));
}

console.log('\n=== イントロ5行 / エンディング ===');
console.log('イントロ5行(L1-L5):');
for (let i = 0; i < 5; i++) console.log('  L' + (i+1) + ':', lines[i].slice(0, 60));
console.log('エンディング最終5行:');
for (let i = lines.length - 5; i < lines.length; i++) console.log('  L' + (i+1) + ':', lines[i].slice(0, 60));

console.log('\n=== 商品数チェック ===');
const products = [
  '中国産冷凍千切りピーマン','オリーブポマスオイル','ダブルチーズケーキ','冷凍讃岐うどん',
  '極上','カカオ','素煎りミックスナッツDX','花畑牧場',
  '丸焼き','モッツァロール','カークランド','ディナーロール',
  'スコーン','米','にん肉塩','焼鳥三昧',
  'チョコレート','カップ麺','餃子','ぽん酢',
  '無添加','パンダ杏仁','もへじ','ラ・プレッツィオーザ'
];
let productCount = 0;
for (const p of products) {
  if (tsv.includes(p)) productCount++;
  else console.log('  ❌ 未言及:', p);
}
console.log('24商品中の本文言及:', productCount, '/ 24');
