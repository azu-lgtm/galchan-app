import { readFile, writeFile } from 'fs/promises';

const TSV = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/外注台本/【自ガル8台本】更年期セルフケア習慣_20260411_v2.tsv';
const OUT_MD = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/台本/【自ガル8台本】.md';
const PAYLOAD = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/save_payload_gal8.json';
const URL = 'https://docs.google.com/spreadsheets/d/11Vulc9rWw-RnRcoi_jbWgs58h8pff_Aa4RWO1gBPhnc/edit';

const NEW_TITLE = '【有益ガルちゃん】40代以降が更年期を悪化させてたNG習慣11選＋本当にやるべきセルフケア';
const NEW_THUMB = '上段: 更年期真っ只中の / 下段: 女医もやってる乗り越え方 / 商品実写: 命の母+スタバディカフェ+ソイチェック / キャラ: いらすとや焦り顔(右下) / 背景: 薄ピンク放射状 / 配色: 赤+黒縁+白フチ(医療警告)';

// ===== 1. TSV読込 =====
let tsv = await readFile(TSV, 'utf8');
let rows = tsv.split('\n').map(l => l.replace(/\r$/, ''));

// ① 冒頭ナレ差し替え（A豆乳）
const oldNarr = '実は私も良かれと思って続けてた習慣があって、知った時はかなりハッとしました。';
const newNarr = '実は私、更年期にいいと思って毎日飲んでた豆乳が、6割の人には効きにくい体質があるって知って、コップを持つ手が止まりました。';
let narrHit = 0;
rows = rows.map(r => { if (r.includes(oldNarr)) { narrHit++; return r.replace(oldNarr, newNarr); } return r; });
if (narrHit !== 1) throw new Error(`①冒頭ナレ置換失敗: ${narrHit}件ヒット（1件のはず）`);

// ② 導入圧縮（旧6行→新2行）
const introOld = [
  'スレ民1\t何がダメだったのか、できれば一個ずつ順番に教えてほしいんだけどな。',
  'スレ民2\t更年期のセルフケアって、いったい何が正解なのか本当に分かんないの。',
  'スレ民4\tネットで調べても記事によって書いてること全然違うし、結局何信じればいいのって感じ。',
  'スレ民3\t私もほてりとのぼせが止まらなくて、気づけばもう3年目になるんだ。',
  'スレ民2\t色々試してるけど、良くなってるか悪化してるのかも分かんないんだよね。',
  'スレ民4\t私はまず、朝のコーヒーの話からじっくり聞きたいなって思ってる。',
];
const introNew = [
  'スレ民4\t何がダメだったのか、まず朝のコーヒーの話から一個ずつ聞きたいな。',
  'スレ民3\t私もほてりとのぼせが3年目で、何が正解かもう分かんないんだ。',
];
const startIdx = rows.findIndex(r => r === introOld[0]);
if (startIdx < 0) throw new Error('②導入開始行が見つからない: ' + introOld[0]);
for (let i = 0; i < introOld.length; i++) {
  if (rows[startIdx + i] !== introOld[i]) {
    throw new Error(`②導入行${i}不一致:\n 期待[${introOld[i]}]\n 実  [${rows[startIdx + i]}]`);
  }
}
rows.splice(startIdx, introOld.length, ...introNew);

// TSV書き戻し
await writeFile(TSV, rows.join('\n'), 'utf8');

// ===== 2. script文字列 + MD本文生成 =====
const lines = rows.filter(l => l.trim());
let bodyChars = 0;
const scriptLines = [];
let mdBody = '';
for (const line of lines) {
  const cols = line.split('\t');
  const speaker = (cols[0] || '').trim();
  const text = (cols[1] || '').trim();
  const se = (cols[2] || '').trim();
  if (!speaker) continue;
  bodyChars += text.length;
  scriptLines.push(se ? `${speaker}\t${text}\t${se}` : `${speaker}\t${text}`);
  mdBody += `**${speaker}**　${text}${se ? `　\`${se}\`` : ''}\n\n`;
}
const scriptStr = scriptLines.join('\n') + '\n';

// ===== 3. payload更新 =====
const payload = JSON.parse(await readFile(PAYLOAD, 'utf8'));
payload.topic.title = NEW_TITLE;
payload.materials.titles = [NEW_TITLE];
payload.materials.thumbnails = [NEW_THUMB];
payload.script = scriptStr;
await writeFile(PAYLOAD, JSON.stringify(payload, null, 2), 'utf8');

// ===== 4. 台本MD再生成 =====
const md = `---
updated: 2026-06-01
tags: [galchan, script]
source: ${URL}
---

# 【自ガル8台本】${NEW_TITLE}

> スプシ（読み取り専用コピー）: ${URL}
> 最終取得: 2026-06-01
> 本文 ${bodyChars}字 / ${lines.length}行（v2 TSVから自動生成）

---

${mdBody}`;
await writeFile(OUT_MD, md, 'utf8');

console.log(`OK 反映完了`);
console.log(`  TSV ${lines.length}行 / 本文${bodyChars}字`);
console.log(`  thumb parts: ${NEW_THUMB.split(' / ').length}`);
console.log(`  title: ${NEW_TITLE}`);
