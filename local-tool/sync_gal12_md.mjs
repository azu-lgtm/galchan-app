#!/usr/bin/env node
/**
 * 自ガル12台本v2 MDの台本本文テーブルを修正済みTSVで書き換え
 */
import { readFile, writeFile } from 'fs/promises';

const TSV = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル12台本】ドンキ_20260427.tsv';
const MD = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル12台本v2】ドンキ_20260427.md';

const tsv = (await readFile(TSV, 'utf8')).trim();
const md = await readFile(MD, 'utf8');

// テーブル区切り位置を特定
const headerLine = '| --- | ------ | ------------------------------------------------------------------- | --- |';
const headerIdx = md.indexOf(headerLine);
if (headerIdx < 0) throw new Error('テーブルヘッダー区切りが見つからない');

// テーブル後の行を見つける（最初の空行 → 次の "## " or 行頭まで）
const afterHeader = md.slice(headerIdx + headerLine.length);
// テーブル行は "| N |" で始まる
const tableEndMatch = afterHeader.match(/\n\n## /);
if (!tableEndMatch) throw new Error('テーブル末尾が見つからない');
const tableEndIdx = headerIdx + headerLine.length + tableEndMatch.index;

const before = md.slice(0, headerIdx + headerLine.length);
const after = md.slice(tableEndIdx);

// TSVから新テーブル生成
const tsvLines = tsv.split('\n');
const newRows = tsvLines.map((line, i) => {
  const cols = line.split('\t');
  const num = String(i + 1);
  const speaker = cols[0] || '';
  const text = cols[1] || '';
  const se = cols[2] || '';
  return `| ${num.padEnd(3)} | ${speaker.padEnd(6)} | ${text.padEnd(67)} | ${se.padEnd(3)} |`;
}).join('\n');

const newMd = before + '\n' + newRows + after;
await writeFile(MD, newMd, 'utf8');
console.log(`✅ MD更新完了: ${tsvLines.length}行のテーブル書き込み`);
console.log(`   ファイル: ${MD}`);
