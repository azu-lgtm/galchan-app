// 自ガル16「保存版6店舗まとめ」動画の全コメント取得
// 自ガル17ネタ出しのインプット用
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
const CH = process.env.YOUTUBE_CHANNEL_ID_GALCHAN || 'UCC4g3nFOhyJFQCmHEr9cakA'
if (!KEY) throw new Error('YOUTUBE_API_KEY missing')

const BASE = 'https://www.googleapis.com/youtube/v3'

async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

// 1. 最新動画リストを取得して「保存版」回を特定
async function findHozonbanVideo() {
  const chU = `${BASE}/channels?part=contentDetails&id=${CH}&key=${KEY}`
  const chJ = await getJSON(chU)
  const uploads = chJ.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) throw new Error('uploads playlist not found')
  const plU = `${BASE}/playlistItems?part=snippet,contentDetails&playlistId=${uploads}&maxResults=10&key=${KEY}`
  const plJ = await getJSON(plU)
  const items = plJ.items ?? []
  // 「保存版」「6店舗」「店舗別」を含むものを優先
  let hit = items.find(it => /保存版|店舗別|6店舗/.test(it.snippet.title))
  if (!hit) hit = items[0]
  return {
    videoId: hit.contentDetails.videoId,
    title: hit.snippet.title,
    publishedAt: hit.snippet.publishedAt,
    all_recent: items.map(it => ({
      videoId: it.contentDetails.videoId,
      title: it.snippet.title,
      publishedAt: it.snippet.publishedAt,
    }))
  }
}

// 2. 動画の統計
async function videoStats(videoId) {
  const u = `${BASE}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${KEY}`
  const j = await getJSON(u)
  const v = j.items?.[0]
  return v ? {
    videoId,
    title: v.snippet.title,
    description: v.snippet.description,
    publishedAt: v.snippet.publishedAt,
    duration: v.contentDetails?.duration,
    viewCount: v.statistics?.viewCount,
    likeCount: v.statistics?.likeCount,
    commentCount: v.statistics?.commentCount,
    tags: v.snippet.tags,
  } : null
}

// 3. 全コメント取得（リプライ込み）
async function allComments(videoId) {
  const out = []
  let pageToken = ''
  let safety = 30 // 最大30ページ=3000件相当
  while (safety-- > 0) {
    const u = `${BASE}/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=100&order=relevance&textFormat=plainText&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`
    const j = await getJSON(u)
    for (const item of j.items ?? []) {
      const top = item.snippet.topLevelComment.snippet
      out.push({
        commentId: item.id,
        author: top.authorDisplayName,
        text: top.textDisplay,
        likeCount: top.likeCount,
        publishedAt: top.publishedAt,
        replyCount: item.snippet.totalReplyCount,
        replies: (item.replies?.comments ?? []).map(r => ({
          author: r.snippet.authorDisplayName,
          text: r.snippet.textDisplay,
          likeCount: r.snippet.likeCount,
          publishedAt: r.snippet.publishedAt,
        }))
      })
    }
    if (!j.nextPageToken) break
    pageToken = j.nextPageToken
  }
  return out
}

async function main() {
  console.log('--- find latest video ---')
  const found = await findHozonbanVideo()
  console.log(JSON.stringify(found, null, 2))

  console.log('\n--- video stats ---')
  const stats = await videoStats(found.videoId)
  console.log(JSON.stringify(stats, null, 2))

  console.log('\n--- comments (all) ---')
  const comments = await allComments(found.videoId)
  console.log(`comments collected: ${comments.length} (with ${comments.reduce((a,c)=>a+c.replies.length,0)} replies)`)

  const out = {
    fetched_at: new Date().toISOString(),
    target: found,
    video_stats: stats,
    comments,
  }
  const outPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/保存版動画_all_comments.json'
  await writeFile(outPath, JSON.stringify(out, null, 2), 'utf8')

  // テキストサマリも保存
  const txtPath = 'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/保存版動画_all_comments.txt'
  let lines = []
  lines.push(`# 保存版動画 コメント全件 (${comments.length}件)`)
  lines.push(`Video: ${stats.title}`)
  lines.push(`URL: https://youtu.be/${found.videoId}`)
  lines.push(`再生数: ${stats.viewCount} / いいね: ${stats.likeCount} / コメント: ${stats.commentCount}`)
  lines.push(`公開: ${stats.publishedAt}`)
  lines.push('')
  // いいね順にソート
  const sorted = [...comments].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
  sorted.forEach((c, i) => {
    lines.push(`## #${i + 1} ${c.author} [👍${c.likeCount} 💬${c.replyCount}]`)
    lines.push(c.text)
    if (c.replies.length) {
      c.replies.forEach(r => {
        lines.push(`  └ ${r.author} [👍${r.likeCount}]: ${r.text.replace(/\n/g, ' ')}`)
      })
    }
    lines.push('')
  })
  await writeFile(txtPath, lines.join('\n'), 'utf8')

  console.log(`\nSaved JSON: ${outPath}`)
  console.log(`Saved TXT:  ${txtPath}`)
}

main().catch(e => { console.error('ERR:', e?.message ?? e); process.exit(1) })
