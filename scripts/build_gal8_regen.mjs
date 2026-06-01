import { readFile, writeFile } from 'fs/promises';

const TSV = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/外注台本/【自ガル8台本】更年期セルフケア習慣_20260411_v2.tsv';
const OUT_MD = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/台本/【自ガル8台本】.md';
const PAYLOAD = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal8.json';
const URL = 'https://docs.google.com/spreadsheets/d/11Vulc9rWw-RnRcoi_jbWgs58h8pff_Aa4RWO1gBPhnc/edit';

// TSV読み → script/MD再生成（title/thumbは既設定なので変更しない）
const tsv = await readFile(TSV, 'utf8');
const rows = tsv.split('\n').map(l => l.replace(/\r$/, ''));
const lines = rows.filter(l => l.trim());
let bodyChars = 0;
const scriptLines = [];
let mdBody = '';
for (const line of lines) {
  const cols = line.split('\t');
  const sp = (cols[0] || '').trim();
  const tx = (cols[1] || '').trim();
  const se = (cols[2] || '').trim();
  if (!sp) continue;
  bodyChars += tx.length;
  scriptLines.push(se ? `${sp}\t${tx}\t${se}` : `${sp}\t${tx}`);
  mdBody += `**${sp}**　${tx}${se ? `　\`${se}\`` : ''}\n\n`;
}
const scriptStr = scriptLines.join('\n') + '\n';

const payload = JSON.parse(await readFile(PAYLOAD, 'utf8'));
payload.script = scriptStr;
await writeFile(PAYLOAD, JSON.stringify(payload, null, 2), 'utf8');

const title = payload.materials.titles[0];
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

${mdBody}`;
await writeFile(OUT_MD, md, 'utf8');

console.log(`OK regen: ${lines.length}行 / 本文${bodyChars}字`);
