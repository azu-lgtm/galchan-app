#!/usr/bin/env node
/**
 * エンディングローテ検出ゲート（2026-04-30追加・自ガル13エンディング刷新を機に）
 *
 * 目的:
 *   過去3本(自ガル10/11/12)のエンディングと今回の自ガル13エンディングを比較し、
 *   テンプレ化(コピペ・フレーズ重複)を機械的に検出する。
 *
 * 判定軸:
 *   1. スレ民会話パートのフレーズ重複
 *   2. ナレ総括の文言重複
 *   3. 軽いオチの重複
 *
 * 使い方:
 *   node check_ending_rotation.mjs <現在のTSVファイルパス>
 *
 * 終了コード:
 *   0: PASS（重複なし）
 *   1: WARN（一部重複あり・要確認）
 *   2: FAIL（コピペレベルの重複・即修正）
 */

import { readFile } from 'fs/promises';
import path from 'path';

const TSV_INPUT_DIR = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input';

// 過去比較対象（直近3本）
const PAST_TSVS = [
  '【自ガル10台本】商品詐欺_20260420.tsv',
  '【自ガル11台本】ホームセンター_20260424.tsv',
  '【自ガル12台本】ドンキ_20260427.tsv',
];

// 固定文4行（ローテ対象外・除外）
const FIXED_PHRASES = [
  'このチャンネルでは後悔しないための失敗回避をテーマに',
  '知らないと損する情報や私の体験談を交えてお話ししています',
  '少しでも参考になったら高評価・チャンネル登録していただけると嬉しいです',
  '最後までご視聴ありがとうございました',
];

/**
 * TSVからエンディング部分（最後の20-25行）を抽出
 */
async function extractEnding(tsvPath) {
  const content = await readFile(tsvPath, 'utf8');
  const lines = content.split('\n').filter(l => l.includes('\t'));
  const endingLines = lines.slice(-25); // 最後の25行
  return endingLines
    .map(l => {
      const parts = l.split('\t');
      return { speaker: parts[0], text: parts[1] || '' };
    })
    .filter(({ text }) => {
      // 固定文除外
      return !FIXED_PHRASES.some(fp => text.includes(fp));
    });
}

/**
 * テキストを比較用の単語に分解（短いもの、記号は除外）
 */
function tokenize(text) {
  return text
    .replace(/[、。！？「」『』（）()・]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

/**
 * 2つのテキスト間の重複フレーズ抽出（3文字以上の連続一致）
 */
function findOverlappingPhrases(text1, text2, minLen = 6) {
  const overlaps = [];
  for (let i = 0; i <= text1.length - minLen; i++) {
    for (let len = minLen; i + len <= text1.length; len++) {
      const sub = text1.substring(i, i + len);
      if (text2.includes(sub) && !overlaps.some(o => o.includes(sub) || sub.includes(o))) {
        overlaps.push(sub);
        break;
      }
    }
  }
  return overlaps;
}

/**
 * 2つのエンディングの類似度を計算
 */
function calculateSimilarity(currentEnding, pastEnding) {
  const currentText = currentEnding.map(e => e.text).join('\n');
  const pastText = pastEnding.map(e => e.text).join('\n');

  const overlaps = findOverlappingPhrases(currentText, pastText, 6);

  // 重複フレーズ全体の文字数 / 現在エンディング全体の文字数
  const overlapChars = overlaps.reduce((sum, p) => sum + p.length, 0);
  const totalChars = currentText.length;
  const similarity = totalChars > 0 ? overlapChars / totalChars : 0;

  return { similarity, overlaps };
}

/**
 * エンディング軸抽出（簡易版）
 */
function extractAxes(ending) {
  return {
    hasSureminConversation: ending.some(e => e.speaker.startsWith('スレ民')),
    sureminLines: ending.filter(e => e.speaker.startsWith('スレ民')).length,
    narrationLines: ending.filter(e => e.speaker === 'ナレーション').length,
    keyPhrases: ending.map(e => e.text).filter(t => /笑$|よね$|だわ$|なんだ$/.test(t)).slice(0, 5),
  };
}

// ========== メイン処理 ==========

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node check_ending_rotation.mjs <TSVファイルパス>');
  process.exit(2);
}

const currentTsvPath = args[0];
console.log(`\n📊 エンディングローテ検出開始`);
console.log(`現在: ${path.basename(currentTsvPath)}`);
console.log(`過去比較対象: ${PAST_TSVS.length}本\n`);

const currentEnding = await extractEnding(currentTsvPath);
const currentAxes = extractAxes(currentEnding);

console.log(`▼ 現在エンディング軸`);
console.log(`  スレ民会話: ${currentAxes.sureminLines}行 / ナレ: ${currentAxes.narrationLines}行`);
console.log(`  キーフレーズ: ${currentAxes.keyPhrases.join(' / ').substring(0, 100)}\n`);

let maxSimilarity = 0;
let maxSimilarityFile = '';
const allOverlaps = [];

for (const pastFile of PAST_TSVS) {
  const pastPath = path.join(TSV_INPUT_DIR, pastFile);
  try {
    const pastEnding = await extractEnding(pastPath);
    const { similarity, overlaps } = calculateSimilarity(currentEnding, pastEnding);

    console.log(`▼ vs ${pastFile}`);
    console.log(`  類似度: ${(similarity * 100).toFixed(1)}%`);
    if (overlaps.length > 0) {
      console.log(`  重複フレーズ(top5):`);
      overlaps.slice(0, 5).forEach(o => console.log(`    - "${o}"`));
    }
    console.log('');

    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      maxSimilarityFile = pastFile;
    }
    allOverlaps.push({ file: pastFile, similarity, overlaps });
  } catch (e) {
    console.log(`  ⚠️ 読み込み失敗: ${e.message}\n`);
  }
}

// ========== 判定 ==========
console.log(`\n═══ 判定 ═══`);
console.log(`最大類似度: ${(maxSimilarity * 100).toFixed(1)}% (vs ${maxSimilarityFile})`);

if (maxSimilarity >= 0.5) {
  console.log(`❌ FAIL: コピペレベル重複 (50%以上)。即書き直し`);
  process.exit(2);
} else if (maxSimilarity >= 0.3) {
  console.log(`⚠️  WARN: 一部重複あり (30-50%)。要確認`);
  process.exit(1);
} else {
  console.log(`✅ PASS: 重複なし (30%未満)。テンプレ化なし`);
  process.exit(0);
}
