/**
 * YouTube Analytics API v2 + YouTube Data API v3
 * ─ CTR・視聴維持率・再生数・登録者増などを取得
 * ─ OAuth: ガルちゃんアカウント(1) のリフレッシュトークンで認証
 */
import { google } from 'googleapis'

export function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return client
}

export interface ChannelAnalytics {
  period: { start: string; end: string }
  totals: {
    views: number
    estimatedMinutesWatched: number
    subscribersGained: number
    subscribersLost: number
  }
  daily: Array<{
    date: string
    views: number
    estimatedMinutesWatched: number
    subscribersGained: number
  }>
}

export interface VideoAnalytics {
  videoId: string
  title: string
  publishedAt: string
  totalViews: number
  likes: number
  comments: number
  analytics: {
    views: number
    estimatedMinutesWatched: number
    averageViewDuration: number
    averageViewPercentage: number
    subscribersGained: number
    likes: number
    comments: number
  } | null
  impressions: {
    impressions: number
    impressionsCtr: number
  } | null
}

/**
 * チャンネル全体の日別データを取得（過去N日）
 */
export async function fetchChannelAnalytics(days: number = 90): Promise<ChannelAnalytics> {
  const auth = getAuth()
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth })

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  const startDate = formatDate(start)
  const endDate = formatDate(end)

  // チャンネル全体の日別データ
  const res = await ytAnalytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
    dimensions: 'day',
    sort: 'day',
  })

  const rows = res.data.rows ?? []
  let totalViews = 0
  let totalMinutes = 0
  let totalSubGained = 0
  let totalSubLost = 0

  const daily = rows.map((row: (string | number)[]) => {
    const views = Number(row[1])
    const minutes = Number(row[2])
    const subGained = Number(row[3])
    const subLost = Number(row[4])
    totalViews += views
    totalMinutes += minutes
    totalSubGained += subGained
    totalSubLost += subLost
    return {
      date: String(row[0]),
      views,
      estimatedMinutesWatched: Math.round(minutes),
      subscribersGained: subGained,
    }
  })

  return {
    period: { start: startDate, end: endDate },
    totals: {
      views: totalViews,
      estimatedMinutesWatched: Math.round(totalMinutes),
      subscribersGained: totalSubGained,
      subscribersLost: totalSubLost,
    },
    daily,
  }
}

/**
 * 動画一覧を取得し、各動画のアナリティクスデータを付与
 */
export async function fetchVideoAnalytics(days: number = 30): Promise<VideoAnalytics[]> {
  const auth = getAuth()
  const youtube = google.youtube({ version: 'v3', auth })
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth })

  // 自チャンネルの動画一覧を取得
  const channelRes = await youtube.channels.list({
    part: ['contentDetails'],
    mine: true,
  })
  const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) throw new Error('アップロード用プレイリストが見つかりません')

  // 直近の動画を取得（最大50）
  const playlistRes = await youtube.playlistItems.list({
    part: ['snippet'],
    playlistId: uploadsPlaylistId,
    maxResults: 50,
  })

  const videos = playlistRes.data.items ?? []
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  const startDate = formatDate(start)
  const endDate = formatDate(end)

  // 各動画のリアルタイム統計を取得
  const videoIds = videos.map(v => v.snippet?.resourceId?.videoId).filter(Boolean) as string[]
  const statsRes = await youtube.videos.list({
    part: ['statistics'],
    id: videoIds,
  })
  const statsMap = new Map(
    statsRes.data.items?.map(v => [v.id!, v.statistics!]) ?? []
  )

  // 動画別アナリティクスを一括取得
  let analyticsMap = new Map<string, VideoAnalytics['analytics']>()
  let impressionsMap = new Map<string, VideoAnalytics['impressions']>()

  try {
    // 動画別の基本メトリクス
    const analyticsRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments',
      dimensions: 'video',
      sort: '-views',
      maxResults: 50,
    })
    for (const row of analyticsRes.data.rows ?? []) {
      analyticsMap.set(String(row[0]), {
        views: Number(row[1]),
        estimatedMinutesWatched: Math.round(Number(row[2])),
        averageViewDuration: Math.round(Number(row[3])),
        averageViewPercentage: Number(Number(row[4]).toFixed(1)),
        subscribersGained: Number(row[5]),
        likes: Number(row[6]),
        comments: Number(row[7]),
      })
    }
  } catch (err) {
    console.error('Video analytics query failed:', err)
  }

  try {
    // インプレッション・CTR（YouTube Analytics API v2）
    const impressionsRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'impressions,impressionsCtr',
      dimensions: 'video',
      sort: '-impressions',
      maxResults: 50,
    })
    for (const row of impressionsRes.data.rows ?? []) {
      impressionsMap.set(String(row[0]), {
        impressions: Number(row[1]),
        impressionsCtr: Number((Number(row[2]) * 100).toFixed(2)), // 小数→%に変換
      })
    }
  } catch (err) {
    // チャンネルの規模によってはインプレッションデータが取得できない場合がある
    console.error('Impressions query failed (may not be available for this channel):', err)
  }

  // 結果を組み立て
  return videos.map(v => {
    const videoId = v.snippet?.resourceId?.videoId ?? ''
    const stats = statsMap.get(videoId)
    return {
      videoId,
      title: v.snippet?.title ?? '',
      publishedAt: v.snippet?.publishedAt ?? '',
      totalViews: Number(stats?.viewCount ?? 0),
      likes: Number(stats?.likeCount ?? 0),
      comments: Number(stats?.commentCount ?? 0),
      analytics: analyticsMap.get(videoId) ?? null,
      impressions: impressionsMap.get(videoId) ?? null,
    }
  })
}

/**
 * アナリティクスデータをObsidianのMarkdown形式に変換
 */
export function formatAsObsidianMarkdown(
  channel: ChannelAnalytics,
  videos: VideoAnalytics[],
): string {
  const today = new Date().toISOString().split('T')[0]
  const { totals, daily } = channel

  let md = `---
updated: ${today}
tags: [galchan, analytics]
---

# YouTubeアナリティクス
> 最終更新: ${today} / 過去${daily.length}日データ（API自動取得）

## チャンネル全体（過去${daily.length}日）
- 総再生回数: ${totals.views.toLocaleString()}
- 総視聴時間: ${totals.estimatedMinutesWatched.toLocaleString()} 分
- 登録者増加: +${totals.subscribersGained} / -${totals.subscribersLost}

## 日別推移

| 日付 | 再生数 | 視聴時間(分) | 登録者増 |
|---|---|---|---|
`

  for (const d of daily) {
    md += `| ${d.date} | ${d.views} | ${d.estimatedMinutesWatched} | +${d.subscribersGained} |\n`
  }

  md += `
## 動画別データ

> Analytics: 過去30日（API取得） / リアルタイム統計: ${today} 時点

| タイトル | 投稿日 | 総再生数(RT) | 高評価 | コメント | 30日再生 | 平均視聴(秒) | 視聴維持率(%) | インプレッション | CTR(%) | 登録者増 |
|---|---|---|---|---|---|---|---|---|---|---|
`

  for (const v of videos) {
    const a = v.analytics
    const imp = v.impressions
    const published = v.publishedAt ? v.publishedAt.split('T')[0] : '-'
    md += `| ${v.title.slice(0, 40)} | ${published} | ${v.totalViews.toLocaleString()} | ${v.likes} | ${v.comments} | ${a?.views ?? '-'} | ${a?.averageViewDuration ?? '-'} | ${a?.averageViewPercentage ?? '-'} | ${imp?.impressions?.toLocaleString() ?? '-'} | ${imp?.impressionsCtr ?? '-'} | ${a?.subscribersGained ? '+' + a.subscribersGained : '-'} |\n`
  }

  return md
}

/**
 * 視聴者属性（年齢・性別）を取得（直近28日）
 */
export async function fetchDemographics(days: number = 28): Promise<Array<{ ageGroup: string; gender: string; percentage: number }>> {
  const auth = getAuth()
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth })

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  try {
    const res = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: formatDate(start),
      endDate: formatDate(end),
      metrics: 'viewerPercentage',
      dimensions: 'ageGroup,gender',
      sort: '-viewerPercentage',
    })

    return (res.data.rows ?? []).map((row: (string | number)[]) => ({
      ageGroup: String(row[0]),
      gender: String(row[1]),
      percentage: Number(Number(row[2]).toFixed(1)),
    }))
  } catch (err) {
    console.error('Demographics query failed:', err)
    return []
  }
}

/**
 * トラフィックソースを取得（直近28日）
 */
export async function fetchTrafficSources(days: number = 28): Promise<Array<{ source: string; views: number; watchMinutes: number }>> {
  const auth = getAuth()
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth })

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  try {
    const res = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: formatDate(start),
      endDate: formatDate(end),
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'insightTrafficSourceType',
      sort: '-views',
    })

    return (res.data.rows ?? []).map((row: (string | number)[]) => ({
      source: String(row[0]),
      views: Number(row[1]),
      watchMinutes: Math.round(Number(row[2])),
    }))
  } catch (err) {
    console.error('Traffic sources query failed:', err)
    return []
  }
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}
