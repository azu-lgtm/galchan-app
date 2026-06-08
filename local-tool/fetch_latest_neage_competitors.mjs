// 最新の競合「値上げ×買って後悔×ステルス値上げ×神商品」動画を取得（2026-06 最新）
import { readFile, writeFile } from 'fs/promises'

let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8')
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1)
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || !line.includes('=') || line.startsWith('#')) continue
  const eqIdx = line.indexOf('=')
  process.env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
}
const KEY = process.env.YOUTUBE_API_KEY
const BASE = 'https://www.googleapis.com/youtube/v3'
const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`); return r.json() }

const QUERIES = [
  '値上げ 買って後悔 ガルちゃん',
  'ステルス値上げ 商品 ガルちゃん',
  '物価高 買って後悔 神商品',
  '値上げ ひどい 商品 主婦',
  '物価高 これ買うな 神商品',
  '値上げ 高くなった お菓子',
  '買って正解 神商品 物価高 ガルちゃん',
  '値上げ 乗り換え 正解',
]
const since = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString()

const searchVideos = async (q) => {
  const u = `${BASE}/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=20&order=viewCount&publishedAfter=${since}&relevanceLanguage=ja&key=${KEY}`
  const j = await getJSON(u)
  return (j.items || []).map(it => ({ videoId: it.id.videoId, title: it.snippet.title, channelTitle: it.snippet.channelTitle, publishedAt: it.snippet.publishedAt, query: q }))
}
const videoStats = async (ids) => {
  if (!ids.length) return []
  const j = await getJSON(`${BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${KEY}`)
  return (j.items || []).map(v => ({ videoId: v.id, title: v.snippet.title, channelTitle: v.snippet.channelTitle, publishedAt: v.snippet.publishedAt, duration: v.contentDetails?.duration, view: Number(v.statistics?.viewCount || 0), like: Number(v.statistics?.likeCount || 0), comment: Number(v.statistics?.commentCount || 0) }))
}

const allHits = [], seen = new Set()
for (const q of QUERIES) {
  try { for (const x of await searchVideos(q)) { if (!seen.has(x.videoId)) { seen.add(x.videoId); allHits.push(x) } } }
  catch (e) { console.error(`err ${q}: ${e.message}`) }
}
const stats = []
for (let i = 0; i < allHits.length; i += 50) stats.push(...await videoStats(allHits.slice(i, i + 50).map(x => x.videoId)))
const long = stats.filter(v => {
  const m = (v.duration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return false
  return ((+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))) >= 240 // 4分以上=まとめ動画
}).sort((a, b) => b.view - a.view)

console.log(`=== 直近45日 値上げ/後悔/神商品 競合 TOP15 (4分以上) ===`)
for (const v of long.slice(0, 15)) console.log(`[${v.view.toLocaleString()}] ${v.channelTitle} | ${v.publishedAt.slice(0, 10)} | https://youtu.be/${v.videoId} | ${v.title}`)
await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/latest_neage_competitors.json', JSON.stringify({ since, count: long.length, videos: long }, null, 2))
console.log(`\nSaved: latest_neage_competitors.json (${long.length})`)
