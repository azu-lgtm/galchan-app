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
