// 値上げ/ステルス値上げ/買って後悔/神商品系で「本当に伸びてる」競合(高再生)を特定
import { readFile, writeFile } from 'fs/promises'
let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8')
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1)
for (const r of env.split(/\r?\n/)) { const t = r.trim(); if (!t || !t.includes('=') || t.startsWith('#')) continue; const i = t.indexOf('='); process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '') }
const KEY = process.env.YOUTUBE_API_KEY, BASE = 'https://www.googleapis.com/youtube/v3'
const gj = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`); return r.json() }

const QUERIES = [
  '値上げ 買って後悔 ガルちゃん', 'ステルス値上げ 商品 ガルちゃん', '物価高 買って後悔 ガルちゃん',
  '物価高 神商品 ガルちゃん', '買って正解 神商品 ガルちゃん', '二度と買わない 商品 ガルちゃん',
  '値上げ 高くなった ガルちゃん', '物価高 やめて正解 ガルちゃん', 'ケチるな 買うべき ガルちゃん',
  '物価高 安く買えて良かった ガルちゃん',
]
// 🚨リサーチ基準(azu 2026-06-08): 直近3〜6ヶ月 × 最低10万再生以上のみ対象
// feedback_competitor_research_standard_10man_3to6months.md 準拠
const MIN_VIEWS = 100000
const since = new Date(Date.now() - 183 * 24 * 3600 * 1000).toISOString() // 直近6ヶ月
const search = async (q) => {
  const j = await gj(`${BASE}/search?part=snippet&type=video&q=${encodeURIComponent(q)}&maxResults=25&order=viewCount&publishedAfter=${since}&relevanceLanguage=ja&key=${KEY}`)
  return (j.items || []).map(it => ({ videoId: it.id.videoId, title: it.snippet.title, channelTitle: it.snippet.channelTitle, publishedAt: it.snippet.publishedAt }))
}
const stats = async (ids) => { if (!ids.length) return []; const j = await gj(`${BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${KEY}`); return (j.items || []).map(v => ({ videoId: v.id, title: v.snippet.title, channelTitle: v.snippet.channelTitle, publishedAt: v.snippet.publishedAt, duration: v.contentDetails?.duration, view: Number(v.statistics?.viewCount || 0) })) }

const hits = [], seen = new Set()
for (const q of QUERIES) { try { for (const x of await search(q)) if (!seen.has(x.videoId)) { seen.add(x.videoId); hits.push(x) } } catch (e) { console.error(q, e.message) } }
const st = []
for (let i = 0; i < hits.length; i += 50) st.push(...await stats(hits.slice(i, i + 50).map(x => x.videoId)))
const long = st.filter(v => {
  if (v.view < MIN_VIEWS) return false // 🚨10万再生未満は除外（基準）
  const m = (v.duration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); if (!m) return false
  return ((+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))) >= 300
}).sort((a, b) => b.view - a.view)
console.log('=== 直近6ヶ月 × 10万再生以上 値上げ/後悔/神商品 競合 (再生順) ===')
for (const v of long.slice(0, 20)) console.log(`[${v.view.toLocaleString()}] ${v.channelTitle} | ${v.publishedAt.slice(0, 10)} | https://youtu.be/${v.videoId} | ${v.title}`)
await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/topviews_neage_competitors.json', JSON.stringify({ since, count: long.length, videos: long }, null, 2))
console.log(`\nSaved: topviews_neage_competitors.json (${long.length})`)
