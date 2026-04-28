const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!
const BASE_URL = 'https://www.googleapis.com/youtube/v3'

// ガルちゃん系競合チャンネル
export const GALCHAN_COMPETITOR_CHANNELS = [
  { handle: 'garuneko-nyan',    name: 'がるねこにゃん' },
  { handle: 'girls_penguin',    name: 'ガルペンギン' },
  { handle: 'garuenega',        name: 'がるえねが' },
  { handle: 'girlsch_island',   name: 'ガルちゃんアイランド' },
  { handle: 'GALnyan',          name: 'GALにゃん' },
  { handle: 'yuueki-angel',     name: '有益エンジェル' },
  { handle: 'girls-zarashi-ch', name: 'ガルざらしch' },
]

// 40代女性トレンド検索キーワード
const TREND_KEYWORDS = [
  '40代 女性 やめてよかった',
  '40代 後悔 しないために',
  '40代 女性 買ってよかった',
  '40代 生活 改善',
  '40代 ライフスタイル',
]

type RawVideo = {
  id: string
  snippet: {
    title: string
    channelTitle: string
    channelId: string
    publishedAt: string
  }
  statistics: { viewCount: string }
}

export type GalVideoItem = {
  id: string
  title: string
  channelTitle: string
  viewCount: string
  publishedAt: string
}

function mapVideo(v: RawVideo): GalVideoItem {
  return {
    id: v.id,
    title: v.snippet.title,
    channelTitle: v.snippet.channelTitle,
    viewCount: v.statistics?.viewCount ?? '0',
    publishedAt: v.snippet.publishedAt,
  }
}

async function getChannelIdByHandle(handle: string): Promise<string | null> {
  const url = new URL(`${BASE_URL}/channels`)
  url.searchParams.set('part', 'id')
  url.searchParams.set('forHandle', handle)
  url.searchParams.set('key', YOUTUBE_API_KEY)
  const res = await fetch(url.toString())
  if (!res.ok) return null
  const data = await res.json()
  return data.items?.[0]?.id ?? null
}

async function searchVideos(keyword: string, maxResults: number, publishedAfter: string): Promise<RawVideo[]> {
  const searchUrl = new URL(`${BASE_URL}/search`)
  searchUrl.searchParams.set('part', 'id')
  searchUrl.searchParams.set('q', keyword)
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('order', 'viewCount')
  searchUrl.searchParams.set('regionCode', 'JP')
  searchUrl.searchParams.set('relevanceLanguage', 'ja')
  searchUrl.searchParams.set('maxResults', String(maxResults))
  searchUrl.searchParams.set('publishedAfter', publishedAfter)
  searchUrl.searchParams.set('key', YOUTUBE_API_KEY)

  const res = await fetch(searchUrl.toString())
  if (!res.ok) return []
  const data = await res.json()

  const videoIds = data.items?.map((i: { id: { videoId: string } }) => i.id?.videoId).filter(Boolean).join(',')
  if (!videoIds) return []

  const videosUrl = new URL(`${BASE_URL}/videos`)
  videosUrl.searchParams.set('part', 'snippet,statistics')
  videosUrl.searchParams.set('id', videoIds)
  videosUrl.searchParams.set('key', YOUTUBE_API_KEY)

  const vRes = await fetch(videosUrl.toString())
  if (!vRes.ok) return []
  const vData = await vRes.json()
  return vData.items ?? []
}

async function getChannelRecentVideos(channelId: string, maxResults: number): Promise<RawVideo[]> {
  const chUrl = new URL(`${BASE_URL}/channels`)
  chUrl.searchParams.set('part', 'contentDetails')
  chUrl.searchParams.set('id', channelId)
  chUrl.searchParams.set('key', YOUTUBE_API_KEY)

  const chRes = await fetch(chUrl.toString())
  if (!chRes.ok) return []
  const chData = await chRes.json()
  const uploadsId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsId) return []

  const plUrl = new URL(`${BASE_URL}/playlistItems`)
  plUrl.searchParams.set('part', 'snippet')
  plUrl.searchParams.set('playlistId', uploadsId)
  plUrl.searchParams.set('maxResults', String(maxResults))
  plUrl.searchParams.set('key', YOUTUBE_API_KEY)

  const plRes = await fetch(plUrl.toString())
  if (!plRes.ok) return []
  const plData = await plRes.json()

  const videoIds = plData.items
    ?.map((i: { snippet: { resourceId: { videoId: string } } }) => i.snippet?.resourceId?.videoId)
    .filter(Boolean)
    .join(',')
  if (!videoIds) return []

  const vUrl = new URL(`${BASE_URL}/videos`)
  vUrl.searchParams.set('part', 'snippet,statistics')
  vUrl.searchParams.set('id', videoIds)
  vUrl.searchParams.set('key', YOUTUBE_API_KEY)

  const vRes = await fetch(vUrl.toString())
  if (!vRes.ok) return []
  const vData = await vRes.json()
  return vData.items ?? []
}

/** トレンドネタ: 直近3〜6ヶ月・10万再生以上 */
export async function getTrendTopics(): Promise<GalVideoItem[]> {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const publishedAfter = sixMonthsAgo.toISOString()

  const shuffled = [...TREND_KEYWORDS].sort(() => Math.random() - 0.5).slice(0, 3)
  const results = await Promise.allSettled(shuffled.map(kw => searchVideos(kw, 8, publishedAfter)))

  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  const highView = all.filter(v => parseInt(v.statistics?.viewCount ?? '0') >= 100000)
  const list = highView.length >= 5 ? highView : all

  return list
    .map(mapVideo)
    .sort((a, b) => parseInt(b.viewCount) - parseInt(a.viewCount))
    .slice(0, 10)
}

/** 競合ネタ: 直近3〜6ヶ月・3万再生以上 */
export async function getCompetitorTopics(): Promise<{ channelName: string; videos: GalVideoItem[] }[]> {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const cutoff = sixMonthsAgo.toISOString()

  const results = await Promise.allSettled(
    GALCHAN_COMPETITOR_CHANNELS.map(async (ch) => {
      const channelId = await getChannelIdByHandle(ch.handle)
      if (!channelId) return null
      const videos = await getChannelRecentVideos(channelId, 20)
      const filtered = videos
        .filter(v => {
          const views = parseInt(v.statistics?.viewCount ?? '0')
          const pub = v.snippet?.publishedAt ?? ''
          return views >= 30000 && pub >= cutoff
        })
        .sort((a, b) => parseInt(b.statistics?.viewCount ?? '0') - parseInt(a.statistics?.viewCount ?? '0'))
        .slice(0, 5)
      if (!filtered.length) return null
      return { channelName: ch.name, videos: filtered.map(mapVideo) }
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<{ channelName: string; videos: GalVideoItem[] }> =>
      r.status === 'fulfilled' && r.value !== null
    )
    .map(r => r.value)
}

// ── 自チャンネル動画一覧 / コメント取得・投稿（健康chから完全移植）────────────

/**
 * 自チャンネルの最新動画一覧を取得（コメント返信用・OAuth不要・APIキーのみ）
 * 健康ch getChannelVideosForOwner と同等
 */
export async function getOwnerChannelVideos(
  channelId: string,
  maxResults = 30,
) {
  // channels.list で uploadsPlaylistId 取得
  const channelUrl = new URL(`${BASE_URL}/channels`)
  channelUrl.searchParams.set('part', 'contentDetails')
  channelUrl.searchParams.set('id', channelId)
  channelUrl.searchParams.set('key', YOUTUBE_API_KEY)

  const channelRes = await fetch(channelUrl.toString(), { cache: 'no-store' })
  if (!channelRes.ok) throw new Error(`YouTube channel API error: ${channelRes.status}`)
  const channelData = await channelRes.json()
  const uploadsPlaylistId =
    channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) return []

  const playlistUrl = new URL(`${BASE_URL}/playlistItems`)
  playlistUrl.searchParams.set('part', 'snippet')
  playlistUrl.searchParams.set('playlistId', uploadsPlaylistId)
  playlistUrl.searchParams.set('maxResults', String(maxResults))
  playlistUrl.searchParams.set('key', YOUTUBE_API_KEY)

  const playlistRes = await fetch(playlistUrl.toString(), { cache: 'no-store' })
  if (!playlistRes.ok) throw new Error(`YouTube playlistItems API error: ${playlistRes.status}`)
  const playlistData = await playlistRes.json()

  const videoIds = playlistData.items
    ?.map((item: { snippet: { resourceId: { videoId: string } } }) => item.snippet?.resourceId?.videoId)
    .filter(Boolean)
    .join(',')
  if (!videoIds) return []

  const statsUrl = new URL(`${BASE_URL}/videos`)
  statsUrl.searchParams.set('part', 'snippet,statistics')
  statsUrl.searchParams.set('id', videoIds)
  statsUrl.searchParams.set('key', YOUTUBE_API_KEY)

  const statsRes = await fetch(statsUrl.toString(), { cache: 'no-store' })
  if (!statsRes.ok) return []
  const statsData = await statsRes.json()
  return statsData.items ?? []
}

/**
 * 自チャンネルの全コメント取得（OAuth必須・held/pendingコメント含む）
 * scope: youtube.force-ssl 必要
 */
export async function getVideoCommentsOwner(videoId: string, accessToken: string) {
  const url = new URL(`${BASE_URL}/commentThreads`)
  url.searchParams.set('part', 'snippet,replies')
  url.searchParams.set('videoId', videoId)
  url.searchParams.set('maxResults', '100')
  url.searchParams.set('order', 'time')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`YouTube comments API error: ${res.status} ${errBody}`)
  }
  const data = await res.json()
  return data.items ?? []
}

/**
 * 公開動画のコメントをAPIキーのみで取得（競合分析用）
 */
export async function getPublicVideoComments(
  videoId: string,
  maxResults = 20,
  order: 'relevance' | 'time' = 'relevance',
) {
  const url = new URL(`${BASE_URL}/commentThreads`)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('videoId', videoId)
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('order', order)
  url.searchParams.set('key', YOUTUBE_API_KEY)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`YouTube public comments API error: ${res.status} ${errBody}`)
  }
  const data = await res.json()
  return (data.items ?? []).map((item: {
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: string
          textDisplay: string
          likeCount: number
          publishedAt: string
        }
      }
      totalReplyCount: number
    }
  }) => ({
    author: item.snippet.topLevelComment.snippet.authorDisplayName,
    text: item.snippet.topLevelComment.snippet.textDisplay
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim(),
    likeCount: item.snippet.topLevelComment.snippet.likeCount,
    replyCount: item.snippet.totalReplyCount,
    publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
  }))
}

/**
 * コメントへの返信投稿（OAuth必須）
 */
export async function postCommentReply(
  parentId: string,
  text: string,
  accessToken: string,
) {
  const url = new URL(`${BASE_URL}/comments`)
  url.searchParams.set('part', 'snippet')

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      snippet: {
        parentId,
        textOriginal: text,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`YouTube reply API error: ${JSON.stringify(err)}`)
  }
  return res.json()
}

/** ガルちゃん掲示板スクレイプ: 直近1ヶ月の40代スレッド */
export async function scrapeGirlsChannel(): Promise<{ title: string; comments: number; url: string }[]> {
  try {
    // date=m で1ヶ月以内に絞る
    const res = await fetch('https://girlschannel.net/topics/search/?q=40%E4%BB%A3&date=m', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return []
    const html = await res.text()

    const threads: { title: string; comments: number; url: string }[] = []

    // <li class="flc"><a href="/topics/NNNN/">...</a></li> の構造
    const liBlocks = html.match(/<li[^>]*class="flc"[\s\S]*?<\/li>/g) ?? []

    for (const block of liBlocks) {
      const urlMatch = block.match(/href="(\/topics\/\d+\/[^"]*)"/)
      const titleMatch = block.match(/<p[^>]*class="title"[^>]*>([^<]+)<\/p>/)
      const commentMatch = block.match(/<span>(\d+)コメント<\/span>/)
      if (urlMatch && titleMatch) {
        threads.push({
          title: titleMatch[1].trim(),
          comments: commentMatch ? parseInt(commentMatch[1]) : 0,
          url: 'https://girlschannel.net' + urlMatch[1],
        })
      }
    }

    return threads
      .sort((a, b) => b.comments - a.comments)
      .slice(0, 15)
  } catch {
    return []
  }
}
