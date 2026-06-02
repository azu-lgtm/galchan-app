import { readFile, writeFile } from 'fs/promises';

const TSV = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/外注台本/【自ガル8台本】更年期セルフケア習慣_20260411_v2.tsv';

let tsv = await readFile(TSV, 'utf8');
let rows = tsv.split('\n').map(l => l.replace(/\r$/, ''));

// azu指示: テンプレ感の出るエンディング6行 → 登録誘導なし3行に差替（「最後までご視聴〜」は残す）
const endOld = [
  'ナレーション\t私自身も、良かれと思って続けてた習慣がいくつもあって、見直すのに時間がかかりました。',
  'ナレーション\t思い当たる習慣があったら、まずは一つだけ見直すところから始めてみてくださいね。',
  'ナレーション\tあなたが逆効果だったかもってなったセルフケアがあれば、ぜひコメントで教えてください。',
  'ナレーション\tこのチャンネルでは後悔しないための失敗回避をテーマに',
  'ナレーション\t知らないと損する情報や私の体験談を交えてお話ししています。',
  'ナレーション\t少しでも参考になったら高評価・チャンネル登録していただけると嬉しいです!!',
];
const endNew = [
  'ナレーション\t良かれと思って続けてたことほど、やめるのに勇気がいるんですよね。',
  'ナレーション\t思い当たる習慣があったら、まずは一つだけゆるく見直してみてください。',
  'ナレーション\tあなたが逆効果だったかもって気づいたセルフケアも、コメントで教えてくださいね。',
];

const startIdx = rows.findIndex(r => r === endOld[0]);
if (startIdx < 0) throw new Error('エンディング開始行が見つからない: ' + endOld[0]);
for (let i = 0; i < endOld.length; i++) {
  if (rows[startIdx + i] !== endOld[i]) {
    throw new Error(`エンディング行${i}不一致:\n 期待[${endOld[i]}]\n 実  [${rows[startIdx + i]}]`);
  }
}
rows.splice(startIdx, endOld.length, ...endNew);

await writeFile(TSV, rows.join('\n'), 'utf8');
console.log(`OK エンディング差替: 6行→3行（登録誘導なし版・「最後までご視聴〜」は残存）`);
console.log(`差替後の末尾5行:`);
for (const r of rows.filter(l => l.trim()).slice(-5)) console.log('  ' + r);
