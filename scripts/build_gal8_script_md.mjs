import { readFile, writeFile } from 'fs/promises';

const TSV = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/外注台本/【自ガル8台本】更年期セルフケア習慣_20260411_v2.tsv';
const OUT = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/台本/【自ガル8台本】.md';
const PAYLOAD = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal8.json';
const URL = 'https://docs.google.com/spreadsheets/d/11Vulc9rWw-RnRcoi_jbWgs58h8pff_Aa4RWO1gBPhnc/edit';

const tsv = await readFile(TSV, 'utf8');
const payload = JSON.parse(await readFile(PAYLOAD, 'utf8'));
const title = payload.materials.titles[0];

const lines = tsv.split('\n').filter(l => l.trim());
let bodyChars = 0;
let body = '';
for (const line of lines) {
  const cols = line.split('\t');
  const speaker = (cols[0] || '').trim();
  const text = (cols[1] || '').trim();
  const se = (cols[2] || '').trim();
  if (!speaker) continue;
  bodyChars += text.length;
  body += `**${speaker}**　${text}${se ? `　\`${se}\`` : ''}\n\n`;
}

const md = `---
updated: 2026-06-01
tags: [galchan, script]
source: ${URL}
---

# 【自ガル8台本】${title}

> スプシ（読み取り専用コピー）: ${URL}
> 最終取得: 2026-06-01
> 本文 ${bodyChars}字 / ${lines.length}行（v2 TSVから自動生成）

---

${body}`;

await writeFile(OUT, md, 'utf8');
console.log(`OK 書き込み完了: ${OUT}`);
console.log(`   ${lines.length}行 / 本文${bodyChars}字 / MD全体${md.length}字`);
