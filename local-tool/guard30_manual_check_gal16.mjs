// 自ガル16 ガード30被り検出 手動再現スクリプト（再レビュー専用）
import { readFile } from 'fs/promises';

const mgmtPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/動画管理リスト.md';
const scriptPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/tsv_input/【自ガル16台本】店舗別保存版_20260517.tsv';
const mgmt = await readFile(mgmtPath, 'utf8');
const script = await readFile(scriptPath, 'utf8');

const newTitle = '【保存版 有益まとめ】業務スーパー・ドンキ・コストコ・ロピア…40代以降が絶対買うな危険食品＆逆に神食品まとめ【有益ガルちゃん】';
const newThumbs = ['国が警告！絶対買うな', '危険食品まとめ', '農水省が是正命令出した店も', '管理栄養士が家族に出さない'];

const rows = mgmt.split('\n').map(l => l.trim())
  .filter(l => l.startsWith('|') && l.endsWith('|'))
  .map(l => l.slice(1, -1).split('|').map(c => c.trim()))
  .filter(cols => cols.length >= 4 && !cols[0].includes('投稿日') && !cols[0].includes('---'))
  .filter(cols => cols[3] && cols[3].length >= 5)
  .filter(cols => !cols.join(' ').includes('【テスト】') && !cols[1].includes('テスト台本'));

const recent = rows.slice(-10).map(c => ({ title: c[3], theme: c[2], script: c[1] }));
const matomeRow = rows.find(c => c[1] && c[1].includes('下記') && c[1].includes('まとめ'));
if (matomeRow && !recent.some(v => v.title === matomeRow[3])) {
  recent.push({ title: matomeRow[3] || matomeRow[1], theme: matomeRow[2], script: matomeRow[1] });
}

console.log('# 比較対象動画:', recent.length, '本');
for (const r of recent) console.log('  -', (r.script || '').slice(0, 30), '|', (r.title || '').slice(0, 50));

const EXEMPT = new Set(['消費者庁', '国民生活センター', 'NITE', '農林水産省', '厚生労働省', '経済産業省', '警察庁', '有益', 'ガルちゃん', 'ガルちゃんねる', '40代', '50代', '40代以降', '40代主婦', '40代女性', '失敗回避', '後悔回避', '保存版', '総集編', '注意喚起', '比較系', '暴露系', '危険', '警告', '注意', 'ゾッとした', '後悔']);

const SPLIT_RE = new RegExp('[【】「」『』\\s　、。！？・×+()\\[\\]｜/\\\\,.!?\\-:：;＆…&]+', 'u');

function extract(s) {
  if (!s) return new Set();
  const tokens = s.split(SPLIT_RE);
  const result = new Set();
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (/^[\d]+$/.test(t)) continue;
    if (EXEMPT.has(t)) continue;
    result.add(t);
  }
  return result;
}

function match(newW, pastW) {
  let cnt = 0; const matched = [];
  for (const w of newW) {
    for (const pw of pastW) {
      if (w === pw || (w.length >= 4 && pw.includes(w)) || (pw.length >= 4 && w.includes(pw))) {
        cnt++; matched.push(w); break;
      }
    }
  }
  return { cnt, matched };
}

console.log('\n## 軸1: タイトル被り');
const nW = extract(newTitle);
console.log('  新タイトル核ワード(' + nW.size + '):', [...nW].slice(0, 30).join('/'));
let fail1 = 0;
for (const past of recent) {
  const pW = extract(past.title);
  const m = match(nW, pW);
  if (m.cnt >= 3) { console.log(`  ❌ ${m.cnt}個一致 [${m.matched.slice(0, 5).join('/')}] vs 「${past.title.slice(0, 40)}…」`); fail1++; }
  else if (m.cnt > 0) console.log(`  ⚪ ${m.cnt}個一致 [${m.matched.slice(0, 3).join('/')}] vs 「${past.title.slice(0, 40)}…」`);
}

console.log('\n## 軸2: サムネ被り');
const tW = extract(newThumbs.join(' / '));
console.log('  サムネ核ワード(' + tW.size + '):', [...tW].slice(0, 30).join('/'));
let fail2 = 0;
for (const past of recent) {
  const pW = extract(past.title);
  const m = match(tW, pW);
  if (m.cnt >= 3) { console.log(`  ❌ ${m.cnt}個一致 [${m.matched.slice(0, 5).join('/')}] vs 「${past.title.slice(0, 40)}…」`); fail2++; }
  else if (m.cnt > 0) console.log(`  ⚪ ${m.cnt}個一致 [${m.matched.slice(0, 3).join('/')}] vs 「${past.title.slice(0, 40)}…」`);
}

console.log('\n## 軸3: 構成素材被り（台本本文 vs 過去動画タイトル核ワード）');
const sW = extract(script);
let fail3 = 0;
for (const past of recent) {
  const pW = extract(past.title);
  let cnt = 0; const matched = [];
  for (const pw of pW) {
    for (const sw of sW) {
      if (pw === sw || (pw.length >= 4 && sw.includes(pw)) || (sw.length >= 4 && pw.includes(sw))) {
        cnt++; matched.push(pw); break;
      }
    }
  }
  if (cnt >= 3) { console.log(`  ❌ ${cnt}個一致 [${matched.slice(0, 5).join('/')}] vs 「${past.title.slice(0, 40)}…」`); fail3++; }
  else if (cnt > 0) console.log(`  ⚪ ${cnt}個一致 [${matched.slice(0, 3).join('/')}] vs 「${past.title.slice(0, 40)}…」`);
}

console.log('\n# 集計');
console.log(`軸1 FAIL: ${fail1} / 軸2 FAIL: ${fail2} / 軸3 FAIL: ${fail3}`);
console.log(fail1 + fail2 + fail3 === 0 ? '✅ ガード30 PASS' : '❌ ガード30 FAIL');
