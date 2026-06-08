// 最新競合3本のコメント取得（relevance順=高評価/人気順）
import { readFile, writeFile } from 'fs/promises'

let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8')
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1)
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || !line.includes('=') || line.startsWith('#')) continue
  const i = line.indexOf('=')
  process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}
const KEY = process.env.YOUTUBE_API_KEY
const BASE = 'https://www.googleapis.com/youtube/v3'
const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`); return r.json() }

const VIDEOS = {
  GYZTiG4Oa8U: 'ステルス値上げが酷すぎる商品',
  BI0ZIGQCblE: '6月からの大幅値上げ9選',
  a0QZfLA_HQE: '冷凍食品ステルス値上げ味落ち',
}

const out = {}
for (const [id, title] of Object.entries(VIDEOS)) {
  const comments = []
  let pageToken = ''
  for (let page = 0; page < 3; page++) { // 最大300件
    const u = `${BASE}/commentThreads?part=snippet&videoId=${id}&maxResults=100&order=relevance&textFormat=plainText${pageToken ? `&pageToken=${pageToken}` : ''}&key=${KEY}`
    let j
    try { j = await getJSON(u) } catch (e) { console.error(`  ${id} page${page} err: ${e.message}`); break }
    for (const it of j.items || []) {
      const c = it.snippet.topLevelComment.snippet
      comments.push({ text: c.textDisplay.replace(/\n+/g, ' ').trim(), like: c.likeCount })
    }
    if (!j.nextPageToken) break
    pageToken = j.nextPageToken
  }
  comments.sort((a, b) => b.like - a.like)
  out[id] = { title, count: comments.length, comments }
  console.log(`\n=== ${title} (${id}) : ${comments.length}件 ===`)
  comments.slice(0, 25).forEach(c => console.log(`[♥${c.like}] ${c.text.slice(0, 90)}`))
}
await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/.competitor_subs/comments.json', JSON.stringify(out, null, 2))
console.log('\nSaved: .competitor_subs/comments.json')
