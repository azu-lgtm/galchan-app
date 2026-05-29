// ポジ訴求型 TOP動画の深掘り分析 + 自ガル過去動画比較
import { readFile, writeFile } from 'fs/promises'

let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8')
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1)
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || !line.includes('=') || line.startsWith('#')) continue
  const eqIdx = line.indexOf('=')
  const k = line.slice(0, eqIdx).trim()
  let v = line.slice(eqIdx + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env[k] = v
}

const KEY = process.env.YOUTUBE_API_KEY
const BASE = 'https://www.googleapis.com/youtube/v3'

async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

async function topComments(id, max = 10) {
  try {
    const u = `${BASE}/commentThreads?part=snippet&videoId=${id}&maxResults=${max}&order=relevance&textFormat=plainText&key=${KEY}`
    const j = await getJSON(u)
    return (j.items ?? []).map(it => {
      const c = it.snippet.topLevelComment.snippet
      return {
        author: c.authorDisplayName,
        text: c.textDisplay.replace(/\n/g, ' ').slice(0, 200),
        like: c.likeCount,
      }
    })
  } catch (e) { return [{ error: e.message }] }
}

const data = JSON.parse(await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/competitor_recent_30days.json', 'utf8'))

// ポジ訴求型のみ
const positives = data.longform.filter(v => v.types.includes('ポジ訴求'))
positives.sort((a, b) => b.view - a.view)
// 重複除去（同一videoId）
const seen = new Set()
const unique = []
for (const v of positives) {
  if (seen.has(v.videoId)) continue
  seen.add(v.videoId)
  unique.push(v)
}
console.log(`ポジ訴求型 ユニーク${unique.length}本（TOP5深掘り）\n`)

const top5 = unique.slice(0, 8)  // 念のため8本
const enriched = []
for (const v of top5) {
  console.log(`-- ${v.view.toLocaleString()}👁 ${v.title} --`)
  const cs = await topComments(v.videoId, 10)
  enriched.push({ ...v, top_comments: cs })
  cs.forEach((c, i) => {
    if (c.error) return console.log(`  ! ${c.error}`)
    console.log(`  ${i+1}. [${c.like}👍] ${c.author}: ${c.text?.slice(0, 100)}`)
  })
  console.log()
}

// 自ガル過去動画ポジ訴求型のチェック
const MY_VIDEOS = [
  { id: 'vYTm-d5BoqE', name: '自ガル16 保存版6店舗' },
  { id: 'VExg0JpBFZ8', name: '自ガル15 Amazon警告' },
  { id: '02-YeRIpMBU', name: '自ガル14 100均' },
  { id: '8M4Y0NAgZNY', name: '自ガル13 ダイエット' },
  { id: 'S8Pts00X8MY', name: '自ガル12 ドンキ' },
  { id: 'OgMMrZUksKU', name: '自ガル11 ホムセン' },
  { id: 'oXyqX0glVEc', name: '自ガル10 売り場のプロ' },
  { id: '31VmWyezy3w', name: '自ガル4+5+6+9 保存版総集編' },
]

async function getVideo(id) {
  const u = `${BASE}/videos?part=snippet,statistics,contentDetails&id=${id}&key=${KEY}`
  const j = await getJSON(u)
  const v = j.items?.[0]
  if (!v) return null
  return {
    id, title: v.snippet.title,
    publishedAt: v.snippet.publishedAt,
    view: +v.statistics?.viewCount || 0,
    like: +v.statistics?.likeCount || 0,
    comment: +v.statistics?.commentCount || 0,
    duration: v.contentDetails?.duration,
  }
}

console.log('\n== 自ガル過去動画 統計 ==')
const myStats = []
for (const v of MY_VIDEOS) {
  const s = await getVideo(v.id)
  myStats.push({ ...v, ...s })
  console.log(`${v.name}: ${s.view.toLocaleString()}👁 💬${s.comment} 👍${s.like} - ${s.title.slice(0, 60)}`)
}

await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/positive_deep_dive.json',
  JSON.stringify({ positive_top: enriched, my_videos: myStats }, null, 2), 'utf8')
console.log('\n✅ 保存: positive_deep_dive.json')
