// ポジ訴求型 全動画フル一覧 + 競合の業ス・ニトリ・ワークマン参入チェック
import { readFile, writeFile } from 'fs/promises'

const data = JSON.parse(await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/competitor_recent_30days.json', 'utf8'))

// dedup
const seen = new Set()
const unique = []
for (const v of data.longform) {
  if (seen.has(v.videoId)) continue
  seen.add(v.videoId)
  unique.push(v)
}

console.log(`総ユニーク: ${unique.length}本\n`)

// ポジ訴求のみ
const positives = unique.filter(v => v.types.includes('ポジ訴求'))
positives.sort((a, b) => b.view - a.view)
console.log(`== ポジ訴求型 全${positives.length}本 ==`)
for (const [i, v] of positives.entries()) {
  console.log(`${(i+1).toString().padStart(2)}. ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 25).padEnd(25)} | ${v.title.slice(0, 75)} (${v.publishedAt.slice(0, 10)})`)
}

// 業務スーパー言及
console.log('\n== 業務スーパー言及（全型） ==')
const ws = unique.filter(v => /業務スーパー|業ス|業スー/.test(v.title))
ws.sort((a, b) => b.view - a.view)
for (const v of ws) {
  console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)
}

// ニトリ言及
console.log('\n== ニトリ言及（全型） ==')
const nt = unique.filter(v => /ニトリ/.test(v.title))
nt.sort((a, b) => b.view - a.view)
for (const v of nt) {
  console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)
}

// ワークマン
console.log('\n== ワークマン言及 ==')
const wk = unique.filter(v => /ワークマン/.test(v.title))
wk.sort((a, b) => b.view - a.view)
for (const v of wk) console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)

// 100均
console.log('\n== 100均/ダイソー/セリア言及 ==')
const dn = unique.filter(v => /100均|ダイソー|セリア|キャンドゥ/.test(v.title))
dn.sort((a, b) => b.view - a.view)
for (const v of dn) console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)

// ドンキ
console.log('\n== ドンキ言及 ==')
const dk = unique.filter(v => /ドンキ|ドン.キホーテ|ドンキホーテ/.test(v.title))
dk.sort((a, b) => b.view - a.view)
for (const v of dk) console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)

// コストコ
console.log('\n== コストコ言及 ==')
const ct = unique.filter(v => /コストコ/.test(v.title))
ct.sort((a, b) => b.view - a.view)
for (const v of ct) console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)

// オーケー
console.log('\n== オーケーストア言及 ==')
const ok = unique.filter(v => /オーケー|OKストア|OK.+ストア/.test(v.title))
ok.sort((a, b) => b.view - a.view)
for (const v of ok) console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)

// Amazon
console.log('\n== Amazon言及 ==')
const am = unique.filter(v => /Amazon|アマゾン/.test(v.title))
am.sort((a, b) => b.view - a.view)
for (const v of am) console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)

// カルディ
console.log('\n== カルディ言及 ==')
const kd = unique.filter(v => /カルディ|KALDI/.test(v.title))
kd.sort((a, b) => b.view - a.view)
for (const v of kd) console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)

// 無印
console.log('\n== 無印良品言及 ==')
const mj = unique.filter(v => /無印/.test(v.title))
mj.sort((a, b) => b.view - a.view)
for (const v of mj) console.log(`  ${v.view.toString().padStart(6)}👁 [${v.types.join(',')}] ${v.channelTitle.slice(0, 20)} | ${v.title} (${v.publishedAt.slice(0, 10)})`)

// 「神◯◯」「リピ」「一生」「買って良かった」型タイトル分布
console.log('\n== ポジ訴求型タイトルパターン分布 ==')
const patterns = {
  '神○○': /神\S/,
  'リピ': /リピ(してる|確定|決定|買い)/,
  '一生(使|愛用|リピ)': /一生(使|愛用|リピ)/,
  '買って良かった/正解': /買って(良かった|よかった|正解|大正解)/,
  '本当に良かった/最高': /本当に良かった|本当によかった|最高|大満足/,
  '辿り着いた/絶対これ': /辿り着いた|絶対これ|これは買い|心から/,
  '助かった/超ラクに': /助かった|超ラクに|楽になった|大助かり|劇的に/,
}
for (const [name, re] of Object.entries(patterns)) {
  const hit = positives.filter(v => re.test(v.title))
  if (hit.length > 0) console.log(`  ${name}: ${hit.length}本 (合計${hit.reduce((s, v) => s + v.view, 0).toLocaleString()}再生)`)
}

// 動画長分布(ポジ訴求型)
console.log('\n== ポジ訴求型 動画長分布 ==')
const buckets = { '〜10分': 0, '10-15分': 0, '15-20分': 0, '20-25分': 0, '25-30分': 0, '30分超': 0 }
for (const v of positives) {
  const m = v.durationSec / 60
  if (m < 10) buckets['〜10分']++
  else if (m < 15) buckets['10-15分']++
  else if (m < 20) buckets['15-20分']++
  else if (m < 25) buckets['20-25分']++
  else if (m < 30) buckets['25-30分']++
  else buckets['30分超']++
}
for (const [k, c] of Object.entries(buckets)) console.log(`  ${k}: ${c}本`)
