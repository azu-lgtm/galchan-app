#!/usr/bin/env node
import { readFile } from 'fs/promises';
const tsv = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル16台本】店舗別保存版_20260517.tsv', 'utf8');
const lines = tsv.split('\n').filter(l => l.trim());
let totalChars = 0;
let maxLine = 0;
let over70 = 0;
for (const line of lines) {
  const parts = line.split('\t');
  if (parts.length < 2) continue;
  const text = parts[1].trim();
  totalChars += text.length;
  if (text.length > maxLine) maxLine = text.length;
  if (text.length > 70) over70++;
}
console.log(`総文字数: ${totalChars}字`);
console.log(`行数: ${lines.length}`);
console.log(`最大行: ${maxLine}字`);
console.log(`70字超: ${over70}行`);
