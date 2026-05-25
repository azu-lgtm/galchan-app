import { readFile } from 'fs/promises'

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
if (!KEY) throw new Error('YOUTUBE_API_KEY not set')

const BASE = 'https://www.googleapis.com/youtube/v3'

async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

async function videoInfo(videoId) {
  const u = `${BASE}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${KEY}`
  const j = await getJSON(u)
  const v = j.items?.[0]
  if (!v) return null
  return {
    videoId,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    description: v.snippet.description,
    tags: v.snippet.tags,
    viewCount: v.statistics?.viewCount,
    likeCount: v.statistics?.likeCount,
    commentCount: v.statistics?.commentCount,
    duration: v.contentDetails?.duration,
  }
}

async function channelByHandle(handle) {
  const h = handle.replace(/^@/, '')
  const u = `${BASE}/channels?part=snippet,statistics,contentDetails,brandingSettings&forHandle=${encodeURIComponent(h)}&key=${KEY}`
  const j = await getJSON(u)
  return j.items?.[0] ?? null
}

async function channelById(channelId) {
  const u = `${BASE}/channels?part=snippet,statistics,contentDetails,brandingSettings&id=${channelId}&key=${KEY}`
  const j = await getJSON(u)
  return j.items?.[0] ?? null
}

async function recentVideos(channelId, maxResults = 8) {
  const chU = `${BASE}/channels?part=contentDetails&id=${channelId}&key=${KEY}`
  const chJ = await getJSON(chU)
  const uploads = chJ.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) return []
  const plU = `${BASE}/playlistItems?part=snippet,contentDetails&playlistId=${uploads}&maxResults=${maxResults}&key=${KEY}`
  const plJ = await getJSON(plU)
  const ids = plJ.items?.map(it => it.contentDetails.videoId) ?? []
  if (!ids.length) return []
  const vU = `${BASE}/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${KEY}`
  const vJ = await getJSON(vU)
  return vJ.items?.map(v => ({
    id: v.id,
    title: v.snippet.title,
    publishedAt: v.snippet.publishedAt,
    viewCount: v.statistics?.viewCount,
    duration: v.contentDetails?.duration,
  })) ?? []
}

function summary(ch) {
  if (!ch) return null
  return {
    channelId: ch.id,
    title: ch.snippet.title,
    customUrl: ch.snippet.customUrl,
    description: ch.snippet.description,
    publishedAt: ch.snippet.publishedAt,
    country: ch.snippet.country,
    subscriberCount: ch.statistics?.subscriberCount,
    videoCount: ch.statistics?.videoCount,
    viewCount: ch.statistics?.viewCount,
    keywords: ch.brandingSettings?.channel?.keywords,
  }
}

async function main() {
  console.log('=== URL #1: video nM8F_Ixe4rM ===')
  const v = await videoInfo('nM8F_Ixe4rM')
  console.log(JSON.stringify(v, null, 2))

  if (v?.channelId) {
    console.log('\n=== URL #1 channel info ===')
    const ch1 = await channelById(v.channelId)
    console.log(JSON.stringify(summary(ch1), null, 2))
    console.log('\n=== URL #1 channel recent 8 videos ===')
    const r1 = await recentVideos(v.channelId, 8)
    console.log(JSON.stringify(r1, null, 2))
  }

  console.log('\n=== URL #2: handle @lgirls-life-yueki ===')
  const ch2 = await channelByHandle('lgirls-life-yueki')
  console.log(JSON.stringify(summary(ch2), null, 2))

  if (ch2?.id) {
    console.log('\n=== URL #2 channel recent 8 videos ===')
    const r2 = await recentVideos(ch2.id, 8)
    console.log(JSON.stringify(r2, null, 2))
  }
}

main().catch(e => { console.error('ERR:', e?.message ?? e); process.exit(1) })
