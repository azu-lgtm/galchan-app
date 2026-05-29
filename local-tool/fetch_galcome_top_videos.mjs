// ガルこめちゃん【ガルちゃん有益スレ】 直近6ヶ月TOP動画 + コメント分析（2026-05-26 自ガル17ネタ深掘り）
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

const CHANNEL_ID = 'UC-rO9A_VllC58F-uqGHWjIg'
const UPLOADS_PLAYLIST = 'UU-rO9A_VllC58F-uqGHWjIg'
const CHANNEL_NAME = 'ガルこめちゃん【ガルちゃん有益スレ】'

// 直近6ヶ月
const SINCE = '2025-11-26T00:00:00Z'
const UNTIL = '2026-05-26T23:59:59Z'

async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

async function fetchUploadsAll(playlistId, maxItems = 200) {
  const out = []
  let pageToken = ''
  while (out.length < maxItems) {
    const u = `${BASE}/playlistItems?part=contentDetails,snippet&playlistId=${playlistId}&maxResults=50&pageToken=${pageToken}&key=${KEY}`
    const j = await getJSON(u)
    for (const it of (j.items ?? [])) {
      const pub = it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt
      if (!pub) continue
      out.push({
        videoId: it.contentDetails.videoId,
        publishedAt: pub,
        title: it.snippet.title,
      })
    }
    if (!j.nextPageToken) break
    pageToken = j.nextPageToken
    const oldest = out[out.length - 1]?.publishedAt
    if (oldest && new Date(oldest) < new Date(SINCE)) break
  }
  return out.filter(v => v.publishedAt >= SINCE && v.publishedAt <= UNTIL)
}

async function fetchVideoStats(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join(',')
    const u = `${BASE}/videos?part=snippet,statistics,contentDetails&id=${batch}&key=${KEY}`
    const j = await getJSON(u)
    for (const v of (j.items ?? [])) {
      out.push({
        videoId: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        publishedAt: v.snippet.publishedAt,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        thumbnails: v.snippet.thumbnails,
        duration: v.contentDetails?.duration,
        view: +v.statistics?.viewCount || 0,
        like: +v.statistics?.likeCount || 0,
        comment: +v.statistics?.commentCount || 0,
        tags: v.snippet.tags || [],
      })
    }
  }
  return out
}

async function fetchTopComments(videoId, max = 5) {
  try {
    const u = `${BASE}/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=${max}&key=${KEY}`
    const j = await getJSON(u)
    return (j.items ?? []).map(it => ({
      text: it.snippet.topLevelComment.snippet.textOriginal,
      author: it.snippet.topLevelComment.snippet.authorDisplayName,
      likeCount: it.snippet.topLevelComment.snippet.likeCount,
      publishedAt: it.snippet.topLevelComment.snippet.publishedAt,
      replyCount: it.snippet.totalReplyCount || 0,
    }))
  } catch (e) {
    return []
  }
}

function parseDuration(iso) {
  if (!iso) return 0
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)
}

function formatDuration(sec) {
  if (sec < 3600) return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  return `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

function classifyType(title) {
  const positive = /神\S|一生(使|愛用|リピ)|買って(よかった|正解|大正解)|リピ(してる|決定)|絶対これ|本当に良かった|最高だった|大正解|やっと辿り着いた|これは買い|超おすすめ|大満足|心から|有益|最強|大好き/
  const warning = /買うな|やめろ|やめとけ|カゴに入れるな|危険|絶対(買わない|避け|入れない)|ヤバい|やばい|地雷|失敗|後悔|捨てる|ゾッと|怖い|ガッカリ|騙され|警告/
  const compare = /vs|VS|どっち(が|を)|ガチ比較|比較|徹底比較/
  const archive = /保存版|総集編|まとめ|完全版|これだけ見て|決定版|永久保存/
  const expose = /元(店員|社員|スタッフ|プロ|職員)|業界の(闇|裏)|裏側|内部|秘密|語り|暴露|本音|現役/
  const store = /(業ス|業務スーパー|オーケー|OK|オーケーストア|カルディ|コストコ|ロピア|イオン|サミット|ライフ|マルエツ|ドンキ|ニトリ|ダイソー|セリア|キャンドゥ|ワークマン|3コインズ|スリコ|無印|しまむら|ユニクロ|ハンズ|ロフト|ヨドバシ|ビックカメラ|ヤマダ|アマゾン|楽天)/

  const tags = []
  if (positive.test(title)) tags.push('ポジ訴求')
  if (warning.test(title)) tags.push('警告')
  if (compare.test(title)) tags.push('比較')
  if (archive.test(title)) tags.push('保存版')
  if (expose.test(title)) tags.push('暴露')
  if (store.test(title)) {
    const m = title.match(store)
    if (m) tags.push(`店舗:${m[1]}`)
  }
  if (tags.length === 0) tags.push('その他')
  return tags
}

async function main() {
  console.log(`== ${CHANNEL_NAME} 直近6ヶ月 (${SINCE.slice(0, 10)}〜${UNTIL.slice(0, 10)}) ==`)
  console.log(`Channel ID: ${CHANNEL_ID} / Uploads playlist: ${UPLOADS_PLAYLIST}\n`)

  // チャンネル情報も取得
  const cu = `${BASE}/channels?part=snippet,statistics&id=${CHANNEL_ID}&key=${KEY}`
  const cj = await getJSON(cu)
  const ch = cj.items?.[0]
  console.log(`登録者: ${(+ch.statistics.subscriberCount).toLocaleString()} / 全動画: ${ch.statistics.videoCount} / 総再生: ${(+ch.statistics.viewCount).toLocaleString()}`)
  console.log(`チャンネル概要: ${(ch.snippet.description || '').slice(0, 200)}\n`)

  // アップロード一覧
  const vids = await fetchUploadsAll(UPLOADS_PLAYLIST, 200)
  console.log(`直近6ヶ月 アップロード ${vids.length}件 取得\n`)
  if (vids.length === 0) {
    console.log('動画なし。終了')
    return
  }

  // stats
  const stats = await fetchVideoStats(vids.map(v => v.videoId))

  // ショート除外（60秒以上）
  const longform = stats.filter(s => parseDuration(s.duration) >= 60)

  // enrich
  const enriched = longform.map(s => ({
    ...s,
    durationSec: parseDuration(s.duration),
    types: classifyType(s.title),
    engagement: s.view ? +(s.comment / s.view * 1000).toFixed(2) : 0, // コメント/1000再生
    likeRate: s.view ? +(s.like / s.view * 100).toFixed(2) : 0,
  })).sort((a, b) => b.view - a.view)

  console.log(`== ロングフォーム ${enriched.length}件 (60秒以上) ==\n`)

  // TOP15表示
  console.log('== 再生数TOP15 ==')
  for (const [i, v] of enriched.slice(0, 15).entries()) {
    console.log(`${(i + 1).toString().padStart(2)}. ${v.view.toLocaleString().padStart(7)}👁 💬${String(v.comment).padStart(4)} 👍${String(v.like).padStart(5)} | ${formatDuration(v.durationSec)} | ${v.publishedAt.slice(0, 10)} [${v.types.join(',')}]`)
    console.log(`    ${v.title}`)
  }

  // 型別集計
  const typeStat = {}
  for (const v of enriched) {
    for (const t of v.types) {
      if (!typeStat[t]) typeStat[t] = { count: 0, totalView: 0, totalComment: 0, videos: [] }
      typeStat[t].count++
      typeStat[t].totalView += v.view
      typeStat[t].totalComment += v.comment
      typeStat[t].videos.push({ id: v.videoId, title: v.title, view: v.view, comment: v.comment })
    }
  }
  console.log('\n== 型別サマリ ==')
  for (const t of Object.keys(typeStat).sort((a, b) => typeStat[b].totalView - typeStat[a].totalView)) {
    const s = typeStat[t]
    console.log(`${t.padEnd(12)}: ${s.count}本 / 平均${Math.round(s.totalView / s.count).toLocaleString()}再生 / 平均💬${Math.round(s.totalComment / s.count)}`)
  }

  // TOP10のコメント取得
  const top10 = enriched.slice(0, 10)
  console.log('\n== TOP10各動画のTOPコメント取得中... ==')
  for (const v of top10) {
    v.topComments = await fetchTopComments(v.videoId, 5)
    console.log(`  ${v.videoId}: ${v.topComments.length}件取得`)
  }

  // 保存
  const out = {
    channel: {
      id: CHANNEL_ID,
      title: CHANNEL_NAME,
      subscriberCount: +ch.statistics.subscriberCount,
      videoCount: +ch.statistics.videoCount,
      viewCount: +ch.statistics.viewCount,
      description: ch.snippet.description,
    },
    period: { since: SINCE, until: UNTIL },
    totalLongform: enriched.length,
    top15: enriched.slice(0, 15),
    typeStat,
    top10WithComments: top10,
  }
  await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/galcome_top_videos.json',
    JSON.stringify(out, null, 2), 'utf8')
  console.log('\n✅ JSON保存: galchan-app/local-tool/galcome_top_videos.json')
}

main().catch(e => { console.error('FATAL:', e?.message ?? e); process.exit(1) })
