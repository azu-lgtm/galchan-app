#!/usr/bin/env node
/**
 * pre_save_gate.mjs ガード21・22 動作テスト
 * 1. v3修正済みTSV → PASS期待
 * 2. v2違反TSV（ガル民等を含む合成データ） → FAIL期待
 */
import { readFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';

const TSV_V3 = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル12台本】ドンキ_20260427.tsv';

async function runGate(payload, label) {
  const tmpPath = `C:/Users/meiek/AppData/Local/Temp/gate_test_${label}.json`;
  await writeFile(tmpPath, JSON.stringify(payload, null, 2));
  return new Promise((resolve) => {
    const out = [];
    const p = spawn('node', [
      'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/pre_save_gate.mjs',
      tmpPath,
      '--channel=galchan',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', d => out.push(d.toString()));
    p.stderr.on('data', d => out.push(d.toString()));
    p.on('exit', code => resolve({ code, output: out.join('') }));
  });
}

const v3Script = await readFile(TSV_V3, 'utf8');

// -------- 共通ペイロード雛形 --------
const basePayload = {
  topic: {
    title: 'テスト・ガル民呼称検出',
    description: 'テスト',
    angle: 'テスト',
    emotionWords: ['テスト'],
    source: 'テスト',
    category: 'テスト',
  },
  style: 'product',
  materials: {
    titles: ['【元ドンキ店員】テスト10選'],
    thumbnails: ['上段: テスト'],
    description: 'テスト概要欄',
    metaTags: 'テスト',
    pinComment: 'テスト固定コメ',
    workerMessage: 'テストワーカーメッセージ',
    productList: [
      { name: 'テスト商品', category: 'ポジ', scriptQuote: 'テスト', amazonLink: 'https://amzn.to/test', rakutenLink: 'https://rakuten.co.jp/test' },
    ],
    serialNumber: '【テスト】',
    managementMemo: 'テスト',
  },
};

// -------- テスト1: v3 TSV → 違反語ゼロ・ガード21/22 PASS期待 --------
console.log('========== テスト1: v3 TSV (修正済み) ==========');
const v3Payload = { ...basePayload, script: v3Script };
const r1 = await runGate(v3Payload, 'v3');
console.log(`exit code: ${r1.code}`);
const guard21Match = r1.output.match(/ガル民呼称＋引用元明示＋法的免責フレーム[^\n]*/);
const guard22aMatch = r1.output.match(/主語ぼかし型フレーズ連発[^\n]*/);
const guard22bMatch = r1.output.match(/旧式語尾比率[^\n]*/);
console.log(`ガード21: ${guard21Match?.[0] || '(未検出)'}`);
console.log(`ガード22A: ${guard22aMatch?.[0] || '(未検出)'}`);
console.log(`ガード22B: ${guard22bMatch?.[0] || '(未検出)'}`);

// -------- テスト2: 違反TSV合成 → ガード21がFAILすること期待 --------
console.log('\n========== テスト2: 違反TSV (ガル民/個人の感想/SNSで) ==========');
const violationLines = [
  'ナレーション\t皆さんこんにちは！今回は、',
  'タイトル\tテスト動画',
  'スレ民1\tガル民の体験談として、こんなことがあったわよ。',
  'スレ民2\t個人の感想だけど、私の肌だと合わなかったの。',
  'スレ民3\t知恵袋でこんな声があってさ、よく見かけるのよ。',
  'スレ民4\tだから危険食品とは断定しないけど、注意して。',
  'スレ民5\tガルちゃんでも話題になってたわよ。',
  'スレ民6\t公的裏取り済の情報よ、これ事実ね。',
];
const violationScript = violationLines.join('\n');
const violationPayload = { ...basePayload, script: violationScript };
const r2 = await runGate(violationPayload, 'violation');
console.log(`exit code: ${r2.code} (期待: 1=FAIL)`);
const failMatches = r2.output.match(/❌[^\n]*/g) || [];
console.log(`FAIL検出 ${failMatches.length}件:`);
failMatches.slice(0, 5).forEach(m => console.log(`  ${m}`));

console.log('\n===== サマリー =====');
console.log(`v3 修正済み: exit ${r1.code} ${r1.code === 0 ? '✅ PASS' : '❌ FAIL'}`);
console.log(`違反合成: exit ${r2.code} ${r2.code === 1 ? '✅ FAIL検出（期待通り）' : '⚠️ ' + (r2.code === 0 ? '見逃し' : 'エラー')}`);
