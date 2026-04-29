#!/usr/bin/env node
/**
 * TSV を読み込んで本文セクションを Obsidian台本MDに統合する
 */
import { readFile, writeFile } from 'fs/promises';

const TSV_PATH = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル13台本】ダイエット_20260429.tsv';
const OBSIDIAN_MD = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル13台本】ダイエット_20260429.md';

const tsv = await readFile(TSV_PATH, 'utf8');
const lines = tsv.split('\n').filter(l => l.includes('\t'));

let body = '';
for (const line of lines) {
  const [speaker, text, se] = line.split('\t');
  body += `**${speaker}**: ${text || ''}\n\n`;
  if (se && se.trim()) body += `> SE: ${se.trim()}\n\n`;
}

const wordCount = lines.reduce((acc, l) => acc + (l.split('\t')[1] || '').length, 0);

const md = await readFile(OBSIDIAN_MD, 'utf8');

// 既存に「## 台本本文」がなければ追加、あれば置換
const SECTION_HEADER = '\n\n---\n\n## 台本本文（TSV読み上げ用・話者付き）\n\n';
const existingIdx = md.indexOf('## 台本本文');
let newMd;
if (existingIdx === -1) {
  newMd = md.trimEnd() + SECTION_HEADER + body + `\n---\n\n## 統計\n- 本文文字数: ${wordCount.toLocaleString()}字\n- 行数: ${lines.length}行\n`;
} else {
  newMd = md.slice(0, existingIdx) + SECTION_HEADER.trim() + '\n\n' + body + `\n---\n\n## 統計\n- 本文文字数: ${wordCount.toLocaleString()}字\n- 行数: ${lines.length}行\n`;
}

await writeFile(OBSIDIAN_MD, newMd, 'utf8');
console.log(`✅ 台本本文を統合: ${OBSIDIAN_MD}`);
console.log(`   本文文字数: ${wordCount.toLocaleString()}字 / ${lines.length}行`);
