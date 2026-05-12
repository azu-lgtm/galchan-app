#!/usr/bin/env node
/**
 * 自ガル15保存スクリプト
 * 事前に pre_save_gate.mjs 通過必須
 * /api/google/save 経由で新規スプシ作成+動画管理シート追記
 *
 * 注: アフィリンクあり（神商品10選）のため --skip-affiliate-check は付けない
 */
import { readFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';

const payloadPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal15.json';

const payload = JSON.parse(await readFile(payloadPath, 'utf8'));

console.log('🔒 Running pre_save_gate.mjs...');
await new Promise((resolve, reject) => {
  const p = spawn('node', [
    'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/pre_save_gate.mjs',
    payloadPath,
    '--channel=galchan',
  ], { stdio: 'inherit' });
  p.on('exit', code => code === 0 ? resolve() : reject(new Error(`Gate failed with exit ${code}`)));
});

console.log('\n🟢 Gate通過、/api/google/saveへPOSTする');

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

if (!json.success) {
  console.error('❌ 保存失敗');
  process.exit(1);
}
console.log('\n🟢 保存完了');
console.log('📄 新スプシURL:', json.spreadsheetUrl);

await writeFile(
  'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_result_gal15.json',
  JSON.stringify(json, null, 2),
);
