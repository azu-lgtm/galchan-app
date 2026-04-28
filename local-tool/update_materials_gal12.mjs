#!/usr/bin/env node
/**
 * 自ガル12 update-materials 実行
 * /api/google/update-materials を叩いて動画管理シートK/M/N列をローカルMDで上書き
 */
import { readFile, writeFile } from 'fs/promises';

const descMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル12】概要欄.md';
const pinMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル12】固定コメント.md';
const workerMdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル12】ワーカーメッセージ.md';

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n+/, '').replace(/^#\s+.*\n/, '').trim();
}

const desc = stripFrontmatter(await readFile(descMdPath, 'utf8'));
const pin = stripFrontmatter(await readFile(pinMdPath, 'utf8'));
const worker = stripFrontmatter(await readFile(workerMdPath, 'utf8'));

console.log(`📦 K列(概要欄): ${desc.length}字`);
console.log(`📦 M列(固定コメ): ${pin.length}字`);
console.log(`📦 N列(ワーカー): ${worker.length}字`);
console.log(`   ワーカーメッセージ先頭150字:`);
console.log('   ' + worker.slice(0, 150).replace(/\n/g, '\n   '));

const body = {
  serialNumber: '【自ガル12】',
  description: desc,
  pinComment: pin,
  workerMessage: worker,
};

const res = await fetch('http://localhost:3001/api/google/update-materials', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'gc_auth_token=authenticated',
  },
  body: JSON.stringify(body),
});
const json = await res.json();
console.log('\n📤 update-materials結果:');
console.log(JSON.stringify(json, null, 2));

if (res.status !== 200) {
  console.error('❌ update-materials失敗');
  process.exit(1);
}
console.log('\n🟢 update-materials完了');
await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/update_materials_gal12_result.json', JSON.stringify(json, null, 2));
