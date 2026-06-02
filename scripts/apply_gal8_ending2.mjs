import { readFile, writeFile } from 'fs/promises';

const TSV = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/外注台本/【自ガル8台本】更年期セルフケア習慣_20260411_v2.tsv';

let tsv = await readFile(TSV, 'utf8');
let rows = tsv.split('\n').map(l => l.replace(/\r$/, ''));

// azu指示: コメント誘導の後・締めの前に 柔らか登録誘導1行を挿入
const anchorLine = 'ナレーション\tあなたが逆効果だったかもって気づいたセルフケアも、コメントで教えてくださいね。';
const newLine = 'ナレーション\t少しでも参考になったら、また見に来られるようにチャンネル登録しておいてくださいね。';

if (rows.some(r => r.includes('また見に来られるように'))) {
  throw new Error('既に登録誘導が入ってる・中断');
}
const idx = rows.findIndex(r => r === anchorLine);
if (idx < 0) throw new Error('アンカー行(コメント誘導)が見つからない: ' + anchorLine);

rows.splice(idx + 1, 0, newLine);

await writeFile(TSV, rows.join('\n'), 'utf8');
console.log('OK 登録誘導1行挿入（柔らか版・コメント誘導の後）');
console.log('差替後の末尾6行:');
for (const r of rows.filter(l => l.trim()).slice(-6)) console.log('  ' + r);
