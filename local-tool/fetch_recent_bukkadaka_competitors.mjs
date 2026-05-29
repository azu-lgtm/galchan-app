// 直近1ヶ月「物価高×買って正解/ケチるな」関連競合動画の網羅取得
// ガル系競合13ch + 関連検索キーワードで直接取得
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
if (!KEY) throw new Error('YOUTUBE_API_KEY missing')
const BASE = 'https://www.googleapis.com/youtube/v3'

async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

const QUERIES = [
  '物価高 買って正解 ガルちゃん',
  '物価高 安いの買って正解',
  '物価高 ケチるな',
  '安物買いの銭失い ガル',
  '物価高 神商品 主婦',
  'ケチって失敗 主婦',
  '高くても買って正解',
  '物価高 やめて正解 主婦',
]

// 公開日: 直近60日（バッファ含めて）
const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()

async function searchVideos(q) {
  const u = `${BASE}/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=20&order=viewCount&publishedAfter=${since}&relevanceLanguage=ja&key=${KEY}`
  const j = await getJSON(u)
  return (j.items || []).map(it => ({
    videoId: it.id.videoId,
    title: it.snippet.title,
    channelTitle: it.snippet.channelTitle,
    publishedAt: it.snippet.publishedAt,
    query: q,
  }))
}

async function videoStats(ids) {
  if (!ids.length) return []
  const u = `${BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${KEY}`
  const j = await getJSON(u)
  return (j.items || []).map(v => ({
    videoId: v.id,
    title: v.snippet.title,
    channelTitle: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    duration: v.contentDetails?.duration,
    view: Number(v.statistics?.viewCount || 0),
    like: Number(v.statistics?.likeCount || 0),
    comment: Number(v.statistics?.commentCount || 0),
  }))
}

const allHits = []
const seen = new Set()
for (const q of QUERIES) {
  console.log(`Search: ${q}`)
  try {
    const r = await searchVideos(q)
    for (const x of r) {
      if (seen.has(x.videoId)) continue
      seen.add(x.videoId)
      allHits.push(x)
    }
  } catch (e) {
    console.error(`  err: ${e.message}`)
  }
}
console.log(`Total unique: ${allHits.length}`)

// stats を 50件ずつ取得
const stats = []
for (let i = 0; i < allHits.length; i += 50) {
  const chunk = allHits.slice(i, i + 50).map(x => x.videoId)
  stats.push(...await videoStats(chunk))
}

// 動画長 ≥ 60秒 のみ
const long = stats.filter(v => {
  if (!v.duration) return false
  const m = v.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return false
  const sec = (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))
  return sec >= 60
}).sort((a, b) => b.view - a.view)

console.log(`\n=== 直近60日 物価高/節約関連 競合 TOP20 (60秒以上) ===`)
for (const v of long.slice(0, 20)) {
  console.log(`[${v.view.toLocaleString()}] ${v.channelTitle} | ${v.publishedAt.slice(0, 10)} | ${v.title}`)
}

await writeFile(
  'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/bukkadaka_competitors.json',
  JSON.stringify({ since, queries: QUERIES, count: long.length, videos: long }, null, 2)
)
console.log(`\nSaved: bukkadaka_competitors.json (${long.length} videos)`)
