#!/usr/bin/env node
/**
 * Vercel KV (gc:prompts) と data/prompts-galchan.json の comment_reply.content を比較
 * KVが古ければユーザーが「設定タブ → リセット」を押す必要がある
 */
import { readFile } from 'fs/promises';

let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8');
// BOMスキップ
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1);
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || !line.includes('=') || line.startsWith('#')) continue;
  const eqIdx = line.indexOf('=');
  const k = line.slice(0, eqIdx).trim();
  let v = line.slice(eqIdx + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[k] = v;
}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
if (!KV_URL || !KV_TOKEN) {
  console.error('KV credentials not found in .env.local');
  process.exit(1);
}

const res = await fetch(KV_URL, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${KV_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(['GET', 'gc:prompts']),
  cache: 'no-store',
});
const data = await res.json();
const kvPrompts = data.result ? (typeof data.result === 'string' ? JSON.parse(data.result) : data.result) : null;

const jsonRaw = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/data/prompts-galchan.json', 'utf8');
const jsonPrompts = JSON.parse(jsonRaw);

const kvComment = kvPrompts?.comment_reply?.content ?? '';
const jsonComment = jsonPrompts?.comment_reply?.content ?? '';

console.log('===== Vercel KV (gc:prompts) =====');
console.log(`KV存在: ${kvPrompts ? 'YES' : 'NO（未設定・jsonがフォールバック）'}`);
console.log(`KV comment_reply.content 長さ: ${kvComment.length} 文字`);
console.log(`json comment_reply.content 長さ: ${jsonComment.length} 文字`);
console.log('');

if (!kvPrompts) {
  console.log('→ KV未設定なので jsonがフォールバックで使われる。問題なし。');
  process.exit(0);
}

if (kvComment === jsonComment) {
  console.log('→ KV と json は完全一致。問題なし。');
} else {
  console.log('⚠️ KV と json が異なる！');
  console.log('');

  // 主要キーワードの有無比較
  const checkPhrases = [
    'AIっぽい',
    '貴重なご意見',
    '参考になります',
    '今後とも',
    '〜しましたよ',
    'AI事務的フレーズ全面禁止',
    '距離感の分散ルール',
    '分量を相手に合わせる',
    '感謝コメ',
  ];

  console.log('===== 主要キーワード KV vs json =====');
  for (const p of checkPhrases) {
    const inKv = kvComment.includes(p);
    const inJson = jsonComment.includes(p);
    const mark = inKv === inJson ? '=' : (inJson ? '⬆json側のみ' : '⬇KV側のみ');
    console.log(`${mark}\t"${p}"\tKV:${inKv ? 'YES' : 'NO'} / json:${inJson ? 'YES' : 'NO'}`);
  }

  console.log('');
  console.log('json側にあってKV側にないフレーズ → KVが古い → リセット必要');
}
