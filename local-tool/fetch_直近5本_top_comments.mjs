// 直近5本の動画統計＋トップコメント比較（保存版動画の真因分析用）
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

const VIDEOS = [
  { id: 'vYTm-d5BoqE', name: '自ガル16 保存版6店舗' },
  { id: 'VExg0JpBFZ8', name: '自ガル15 Amazon警告' },
  { id: '02-YeRIpMBU', name: '自ガル14 100均' },
  { id: '8M4Y0NAgZNY', name: '自ガル13 ダイエット' },
  { id: 'S8Pts00X8MY', name: '自ガル12 ドンキ' },
  { id: 'OgMMrZUksKU', name: '自ガル11 ホムセン' },
  { id: 'oXyqX0glVEc', name: '自ガル10 売り場のプロ' },
  { id: '31VmWyezy3w', name: '自ガル4+5+6+9 保存版総集編(4/22)' },
]

async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

async function stats(id) {
  const u = `${BASE}/videos?part=snippet,statistics,contentDetails&id=${id}&key=${KEY}`
  const j = await getJSON(u)
  const v = j.items?.[0]
  if (!v) return null
  return {
    id, title: v.snippet.title.slice(0, 60),
    publishedAt: v.snippet.publishedAt,
    duration: v.contentDetails?.duration,
    view: +v.statistics?.viewCount || 0,
    like: +v.statistics?.likeCount || 0,
    comment: +v.statistics?.commentCount || 0,
  }
}

async function topComments(id, max = 5) {
  try {
    const u = `${BASE}/commentThreads?part=snippet&videoId=${id}&maxResults=${max}&order=relevance&textFormat=plainText&key=${KEY}`
    const j = await getJSON(u)
    return (j.items ?? []).map(it => {
      const c = it.snippet.topLevelComment.snippet
      return {
        author: c.authorDisplayName,
        text: c.textDisplay.replace(/\n/g, ' '),
        like: c.likeCount,
        publishedAt: c.publishedAt,
      }
    })
  } catch (e) { return [{ error: e.message }] }
}

async function main() {
  const out = []
  for (const v of VIDEOS) {
    const s = await stats(v.id)
    const cs = await topComments(v.id, 5)
    out.push({ ...v, stats: s, top_comments: cs })
    console.log(`-- ${v.name} (${v.id}) --`)
    console.log(JSON.stringify(s, null, 2))
    console.log(`コメント上位${cs.length}件:`)
    cs.forEach((c, i) => console.log(`  ${i + 1}. [${c.like}👍] ${c.author}: ${c.text?.slice(0, 100)}`))
    console.log()
  }
  await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/直近8本_top_comments.json', JSON.stringify(out, null, 2), 'utf8')
}

main().catch(e => { console.error('ERR:', e?.message ?? e); process.exit(1) })
