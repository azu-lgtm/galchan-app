#!/usr/bin/env node
/**
 * 整合性チェック実行ログを「実体ファイル」として記録する。
 * pre_save_gate.mjs ガード0a が読む証拠ファイルの生成器。
 *
 * azu指示 (2026-05-16・E ハイブリッド+外部ファイル証拠):
 * Claudeが payload に直接書く嘘ログを排除し、本スクリプト経由でしか証拠を残せない仕組み。
 *
 * 使い方:
 *   node record-integrity-check.mjs \
 *     --video=gal16 \
 *     --diff_check=passed \
 *     --grep_check=passed \
 *     --spreadsheet_readback=passed \
 *     --basic_info_and_body=passed \
 *     --final_confirmation=passed \
 *     --theme_consistency=passed \
 *     --misinformation=passed \
 *     --tail_naturalness=passed \
 *     --duplication=passed \
 *     --revision_gate_exit_code=0
 *
 * 出力:
 *   ./.integrity-log/<video_id>_<unix_timestamp>_<hash>.json
 *   標準出力にファイルパスを表示（payload.integrity_check_log_path にコピーして渡す）
 */
import { writeFile, mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = resolve(__dirname, '.integrity-log');

function getArg(name) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : null;
}

async function main() {
  const video_id = getArg('video');
  if (!video_id) {
    console.error('❌ --video=<video_id> 必須');
    process.exit(1);
  }

  // 5項目（修正完了報告チェックリスト）
  const checklist_5items = {
    diff_check: getArg('diff_check'),
    grep_check: getArg('grep_check'),
    spreadsheet_readback: getArg('spreadsheet_readback'),
    basic_info_and_body: getArg('basic_info_and_body'),
    final_confirmation: getArg('final_confirmation'),
  };

  // 4観点（azu指示）
  const four_aspects = {
    theme_consistency: getArg('theme_consistency'),
    misinformation: getArg('misinformation'),
    tail_naturalness: getArg('tail_naturalness'),
    duplication: getArg('duplication'),
  };

  // revision-reflection-gate.mjs exit code
  const revision_gate_exit_code_raw = getArg('revision_gate_exit_code');
  const revision_gate_exit_code = revision_gate_exit_code_raw === null
    ? null
    : Number(revision_gate_exit_code_raw);

  // 必須項目チェック
  const missing = [];
  for (const [k, v] of Object.entries(checklist_5items)) {
    if (v === null) missing.push(`--${k}=passed|failed`);
  }
  for (const [k, v] of Object.entries(four_aspects)) {
    if (v === null) missing.push(`--${k}=passed|failed`);
  }
  if (revision_gate_exit_code === null) missing.push('--revision_gate_exit_code=0');

  if (missing.length > 0) {
    console.error(`❌ 必須項目が欠落: ${missing.length}件`);
    missing.forEach(m => console.error(`   ${m}`));
    console.error('\n5項目+4観点+revision_gate_exit_code が全て必要。');
    process.exit(1);
  }

  // タイムスタンプ自動生成（嘘時刻NG）
  const now = new Date();
  const timestamp = now.toISOString();
  const unix = Math.floor(now.getTime() / 1000);

  // 中身のJSON
  const log = {
    video_id,
    timestamp,
    unix_timestamp: unix,
    checklist_5items,
    four_aspects,
    revision_gate_exit_code,
    recorded_by: 'record-integrity-check.mjs',
    note: 'pre_save_gate.mjs ガード0aから参照される証拠ログ。本ファイルを直接編集すると改ざん扱い。',
  };

  // ハッシュ生成（中身ベース・偽造しにくく）
  const hash = createHash('sha256').update(JSON.stringify(log)).digest('hex').slice(0, 12);
  log.content_hash = hash;

  // ファイル名: <video_id>_<unix_timestamp>_<hash>.json
  const filename = `${video_id}_${unix}_${hash}.json`;

  // ログディレクトリ確保
  await mkdir(LOG_DIR, { recursive: true });

  const filepath = resolve(LOG_DIR, filename);
  await writeFile(filepath, JSON.stringify(log, null, 2), 'utf8');

  console.log(`✅ 整合性チェックログ記録完了`);
  console.log(`   timestamp: ${timestamp}`);
  console.log(`   ファイル: ${filepath}`);
  console.log(``);
  console.log(`次のステップ: payload.integrity_check_log_path に以下のパスを設定して pre_save_gate.mjs を実行:`);
  console.log(`   "integrity_check_log_path": "${filepath.replace(/\\/g, '/')}"`);
  console.log(``);
  console.log(`または相対パス（推奨）:`);
  console.log(`   "integrity_check_log_path": ".integrity-log/${filename}"`);
}

main().catch(e => {
  console.error('Record error:', e);
  process.exit(1);
});
