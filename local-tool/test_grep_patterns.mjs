#!/usr/bin/env node
/**
 * ガード21/22のGrep正規表現を直接テスト（pre_save_gate.mjsの早期FAILを回避）
 */
import { readFile } from 'fs/promises';

const TSV_V3 = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル12台本】ドンキ_20260427.tsv';
const v3Script = await readFile(TSV_V3, 'utf8');

console.log('========== テスト1: v3修正済みTSV (期待: 全パターン0件) ==========');

const patterns = [
  // ガード21A: ガル民/ガルちゃん自己言及
  { re: /ガル民/g, label: 'A1. ガル民' },
  { re: /ガルちゃん民/g, label: 'A2. ガルちゃん民' },
  { re: /ガルちゃん(で|の|スレ|掲示板)/g, label: 'A3. ガルちゃん自己言及' },
  // ガード21B: 引用元明示
  { re: /知恵袋|Yahoo!?知恵袋|chiebukuro/g, label: 'B1. 知恵袋' },
  { re: /SNSで(も|は)?|インスタで(も|は)|Twitter(で|の)|ツイッター(で|の)|X(でも|では)/g, label: 'B2. SNS/Twitter' },
  { re: /掲示板で(も|は)?|コメント欄で(も|は)|口コミ(で|の)|ネット(でも|では)/g, label: 'B3. 掲示板/コメント欄/ネット' },
  // ガード21C: 法的免責フレーム
  { re: /個人の感想(として|だけど)/g, label: 'C1. 個人の感想' },
  { re: /公的裏取り(済|済み)/g, label: 'C2. 公的裏取り済' },
  { re: /カテゴリ批判|複数証言ベース|複数のスレで/g, label: 'C3. カテゴリ批判/複数証言' },
  { re: /これ事実ね/g, label: 'C4. これ事実ね' },
  { re: /とは断定しない|とは言わない/g, label: 'C5. とは断定しない' },
  // ガード22A: 主語ぼかし型連発
  { re: /よく聞く話|よく聞くわ|よく聞く/g, label: 'D1. よく聞く話/よく聞く' },
  { re: /あるあるだよね|あるある(?!の|は|な)/g, label: 'D2. あるあるだよね/あるある' },
  { re: /うちもそう|私もそう/g, label: 'D3. うちもそう/私もそう' },
  { re: /って人(いるよね|多い)/g, label: 'D4. って人いるよね/多い' },
  { re: /私の周りで(も|に)/g, label: 'D5. 私の周りでも/に' },
];

const v3Hits = [];
for (const p of patterns) {
  const matches = [...v3Script.matchAll(p.re)];
  if (matches.length > 0) {
    v3Hits.push({ ...p, count: matches.length, samples: matches.slice(0, 3).map(m => m[0]) });
  }
}

if (v3Hits.length === 0) {
  console.log('✅ v3 TSV: 全パターン違反0件（クリーン）');
} else {
  console.log('⚠️ v3 TSV にヒット:');
  v3Hits.forEach(h => console.log(`   ${h.label}: ${h.count}回 [${h.samples.join('/')}]`));
}

// 旧式語尾比率テスト（ガード22B）
const tsvLinesC = v3Script.split('\n').filter(l => l.includes('\t'));
const bodiesC = tsvLinesC.map(l => (l.split('\t')[1] ?? '').trim());
const speakersC = tsvLinesC.map(l => (l.split('\t')[0] ?? '').trim());
const isMainC = (i) => speakersC[i] !== 'ナレーション' && speakersC[i] !== 'タイトル' && bodiesC[i].length > 0;
const totalMainC = bodiesC.filter((_, i) => isMainC(i)).length;
const oldFashionedEnd = bodiesC.filter((b, i) =>
  isMainC(i) && /(?:よ|よね|わよね|わ|だわ)[。！？!?]?$/u.test(b)
).length;
const ratioOld = totalMainC > 0 ? (oldFashionedEnd / totalMainC) : 0;
console.log(`\n旧式語尾比率: ${oldFashionedEnd}/${totalMainC} = ${(ratioOld * 100).toFixed(1)}% (上限30%)`);
console.log(ratioOld <= 0.30 ? '✅ 上限内' : '❌ 超過');

console.log('\n========== テスト2: 違反TSV合成 (期待: 全パターンFAIL検出) ==========');
const violationScript = [
  'ナレーション\t皆さんこんにちは',
  'スレ民1\tガル民の体験談として、こんなことが起きたよ。',
  'スレ民2\t個人の感想だけど、私の肌だと合わなかったの。',
  'スレ民3\t知恵袋でこんな声があってさ、よく見かけるのよ。',
  'スレ民4\tだから危険食品とは断定しないけど、注意して。',
  'スレ民5\tガルちゃんでも話題になってたわよ。',
  'スレ民6\t公的裏取り済の情報よ、これ事実ね。',
  'スレ民1\tSNSでも見たし、Twitterでも投稿あった。',
  'スレ民2\tよく聞く話だね。',
  'スレ民3\tよく聞く話よ。',
  'スレ民4\tあるあるだよね。',
  'スレ民5\tあるあるだよね。',
].join('\n');

const violHits = [];
for (const p of patterns) {
  const matches = [...violationScript.matchAll(p.re)];
  if (matches.length > 0) {
    violHits.push({ ...p, count: matches.length, samples: matches.slice(0, 3).map(m => m[0]) });
  }
}

if (violHits.length > 0) {
  console.log(`✅ 違反検出 ${violHits.length}カテゴリ:`);
  violHits.forEach(h => console.log(`   ${h.label}: ${h.count}回 [${h.samples.join('/')}]`));
} else {
  console.log('❌ 違反検出ゼロ（バグ）');
}

console.log('\n===== サマリー =====');
console.log(`v3修正済み: ${v3Hits.length === 0 ? '✅ クリーン（全違反0）' : '⚠️ 違反残存'}`);
console.log(`違反TSV検出: ${violHits.length >= 8 ? '✅ 主要違反全て検出' : `⚠️ 検出${violHits.length}カテゴリ（漏れあり）`}`);
console.log(`旧式語尾比率: ${ratioOld <= 0.30 ? '✅ ' : '❌ '}${(ratioOld * 100).toFixed(1)}%`);
