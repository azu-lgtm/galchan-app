/**
 * YouTube 投稿後トラッキング
 * ─ 投稿直後〜48時間の2段階+Reporting APIでパフォーマンスを追跡
 *
 * Stage 1（初動: 投稿後〜24時間）: 再生数・いいね・コメント（Data API v3、即時反映）
 *   + Reporting API のCSVがあればCTRも取得（翌日から利用可能）
 * Stage 2（フル判定: 48時間後〜）: CTR・維持率・インプレッション（Analytics API v2）
 */
import { google } from 'googleapis'
import { getAuth } from './youtube-analytics'

// ── 型定義 ──────────────────────────────────

export interface RecentVideo {
  videoId: string
  title: string
  publishedAt: string
  hoursAgo: number
}

export interface EarlyStats {
  views: number
  likes: number
  comments: number
  /** 投稿からの経過時間 */
  hoursAgo: number
  /** Reporting API から取得したCTR（翌日以降に利用可能、なければ null） */
  reportingCtr: number | null
  reportingImpressions: number | null
}

export interface FullStats extends EarlyStats {
  impressions: number | null
  impressionsCtr: number | null
  averageViewPercentage: number | null
  averageViewDuration: number | null
  subscribersGained: number | null
}

export type TrackingStage = 'early' | 'full'

export interface PostTrackingResult {
  stage: TrackingStage
  video: RecentVideo
  stats: EarlyStats | FullStats
  channelAverage: {
    viewsPerVideo48h: number | null
  }
  alerts: PostAlert[]
  summary: string
}

export interface PostAlert {
  severity: 'good' | 'warning' | 'critical'
  message: string
}

// ── メイン関数 ──────────────────────────────────

/**
 * 最新の投稿動画を自動検出してトラッキングする
 * - 48時間以内: Stage 1（初動チェック）
 * - 48時間以降: Stage 2（フル判定）
 * - 7日以上前: トラッキング対象なし
 */
export async function trackLatestVideo(): Promise<PostTrackingResult | null> {
  const auth = getAuth()
  const youtube = google.youtube({ version: 'v3', auth })

  // 最新動画を取得
  const channelRes = await youtube.channels.list({
    part: ['contentDetails'],
    mine: true,
  })
  const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) throw new Error('アップロード用プレイリストが見つかりません')

  const playlistRes = await youtube.playlistItems.list({
    part: ['snippet'],
    playlistId: uploadsPlaylistId,
    maxResults: 5,
  })

  const videos = playlistRes.data.items ?? []
  if (videos.length === 0) return null

  // 7日以内の最新動画を探す
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const latest = videos.find(v => {
    const published = new Date(v.snippet?.publishedAt ?? '')
    return published > sevenDaysAgo
  })

  if (!latest) return null

  const videoId = latest.snippet?.resourceId?.videoId ?? ''
  const publishedAt = latest.snippet?.publishedAt ?? ''
  const hoursAgo = Math.round((now.getTime() - new Date(publishedAt).getTime()) / (1000 * 60 * 60))

  const video: RecentVideo = {
    videoId,
    title: latest.snippet?.title ?? '',
    publishedAt,
    hoursAgo,
  }

  // Stage判定: 48時間未満 → early, 48時間以上 → full
  const stage: TrackingStage = hoursAgo < 48 ? 'early' : 'full'

  if (stage === 'early') {
    return await runEarlyCheck(youtube, video)
  } else {
    return await runFullCheck(auth, youtube, video)
  }
}

/**
 * 特定の動画IDを指定してトラッキングする
 */
export async function trackVideo(videoId: string): Promise<PostTrackingResult | null> {
  const auth = getAuth()
  const youtube = google.youtube({ version: 'v3', auth })

  const videoRes = await youtube.videos.list({
    part: ['snippet', 'statistics'],
    id: [videoId],
  })

  const item = videoRes.data.items?.[0]
  if (!item) return null

  const now = new Date()
  const publishedAt = item.snippet?.publishedAt ?? ''
  const hoursAgo = Math.round((now.getTime() - new Date(publishedAt).getTime()) / (1000 * 60 * 60))

  const video: RecentVideo = {
    videoId,
    title: item.snippet?.title ?? '',
    publishedAt,
    hoursAgo,
  }

  const stage: TrackingStage = hoursAgo < 48 ? 'early' : 'full'

  if (stage === 'early') {
    return await runEarlyCheck(youtube, video)
  } else {
    return await runFullCheck(auth, youtube, video)
  }
}

// ── Reporting API からCTRを取得 ──────────────────────────────────

interface ReportingData {
  impressions: number
  ctr: number
}

/**
 * Reporting API（CSV）から特定動画のCTRを取得する
 * ジョブ未作成やCSV未生成の場合は null を返す
 */
async function fetchReportingCtr(videoId: string): Promise<ReportingData | null> {
  try {
    const auth = getAuth()
    const { token } = await auth.getAccessToken()
    if (!token) return null

    const headers = { Authorization: `Bearer ${token}` }

    // ジョブ一覧から reach レポートを探す
    const listRes = await fetch('https://youtubereporting.googleapis.com/v1/jobs', { headers })
    if (!listRes.ok) return null

    const listData = await listRes.json()
    const reachJob = (listData.jobs ?? []).find(
      (j: { reportTypeId: string }) => j.reportTypeId === 'channel_reach_basic_a1'
    )
    if (!reachJob) return null

    // 直近レポートを取得
    const reportsRes = await fetch(
      `https://youtubereporting.googleapis.com/v1/jobs/${reachJob.id}/reports`,
      { headers }
    )
    if (!reportsRes.ok) return null

    const reportsData = await reportsRes.json()
    const reports = (reportsData.reports ?? [])
      .filter((r: { startTime: string }) => r.startTime)
      .sort((a: { startTime: string }, b: { startTime: string }) =>
        b.startTime.localeCompare(a.startTime)
      )
      .slice(0, 7) // 直近7日分

    if (reports.length === 0) return null

    // CSVをダウンロードして該当動画のデータを探す
    let totalImpressions = 0
    let totalViewsFromCtr = 0

    for (const report of reports) {
      const csvRes = await fetch(report.downloadUrl, { headers })
      if (!csvRes.ok) continue

      const csvText = await csvRes.text()
      const lines = csvText.trim().split('\n')
      if (lines.length < 2) continue

      const header = lines[0].split(',')
      const videoIdx = header.indexOf('video_id')
      const impIdx = header.indexOf('video_thumbnail_impressions')
      const ctrIdx = header.indexOf('video_thumbnail_impressions_ctr')
      if (videoIdx < 0 || impIdx < 0) continue

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',')
        if (cols[videoIdx] === videoId) {
          const imp = parseInt(cols[impIdx], 10) || 0
          const ctr = ctrIdx >= 0 ? (parseFloat(cols[ctrIdx]) || 0) : 0
          totalImpressions += imp
          totalViewsFromCtr += imp * ctr
        }
      }
    }

    if (totalImpressions === 0) return null

    return {
      impressions: totalImpressions,
      ctr: Math.round((totalViewsFromCtr / totalImpressions) * 100 * 100) / 100,
    }
  } catch {
    return null
  }
}

// ── Stage 1: 初動チェック ──────────────────────────────────

async function runEarlyCheck(
  youtube: ReturnType<typeof google.youtube>,
  video: RecentVideo,
): Promise<PostTrackingResult> {
  // Data API v3: リアルタイム統計（即時反映）
  const statsRes = await youtube.videos.list({
    part: ['statistics'],
    id: [video.videoId],
  })

  const stats = statsRes.data.items?.[0]?.statistics
  const views = Number(stats?.viewCount ?? 0)
  const likes = Number(stats?.likeCount ?? 0)
  const comments = Number(stats?.commentCount ?? 0)

  // Reporting API: 翌日以降ならCTRが取れる可能性あり
  const reportingData = await fetchReportingCtr(video.videoId)

  const earlyStats: EarlyStats = {
    views,
    likes,
    comments,
    hoursAgo: video.hoursAgo,
    reportingCtr: reportingData?.ctr ?? null,
    reportingImpressions: reportingData?.impressions ?? null,
  }

  const alerts: PostAlert[] = []

  // Reporting API のCTRが取れた場合（翌日以降）
  if (reportingData) {
    if (reportingData.ctr < 2.0) {
      alerts.push({
        severity: 'critical',
        message: `CTR ${reportingData.ctr}%（Reporting API）— サムネ・タイトルの変更を強く推奨。`,
      })
    } else if (reportingData.ctr < 4.0) {
      alerts.push({
        severity: 'warning',
        message: `CTR ${reportingData.ctr}%（Reporting API）— 平均以下。サムネの改善余地あり。`,
      })
    } else {
      alerts.push({
        severity: 'good',
        message: `CTR ${reportingData.ctr}%（Reporting API）— 良好。`,
      })
    }
  }

  // 投稿後の経過時間に応じた初動の目安
  if (video.hoursAgo >= 6) {
    if (views < 50) {
      alerts.push({
        severity: 'critical',
        message: `投稿${video.hoursAgo}時間で再生数 ${views}回。初動が非常に弱いです。サムネ・タイトルの変更を検討。`,
      })
    } else if (views < 200) {
      alerts.push({
        severity: 'warning',
        message: `投稿${video.hoursAgo}時間で再生数 ${views}回。やや弱め。サムネ・タイトルの微調整を検討。`,
      })
    } else {
      alerts.push({
        severity: 'good',
        message: `投稿${video.hoursAgo}時間で再生数 ${views}回。順調です。`,
      })
    }
  }

  const summary = alerts.length > 0
    ? alerts.map(a => {
      const icon = a.severity === 'critical' ? '🚨' : a.severity === 'warning' ? '⚠️' : '✅'
      return `${icon} ${a.message}`
    }).join('\n')
    : `投稿${video.hoursAgo}時間経過。再生数 ${views}回。${reportingData ? `CTR ${reportingData.ctr}%` : 'CTRは翌日以降に取得可能。'}`

  return {
    stage: 'early',
    video,
    stats: earlyStats,
    channelAverage: { viewsPerVideo48h: null },
    alerts,
    summary,
  }
}

// ── Stage 2: フル判定 ──────────────────────────────────

async function runFullCheck(
  auth: ReturnType<typeof getAuth>,
  youtube: ReturnType<typeof google.youtube>,
  video: RecentVideo,
): Promise<PostTrackingResult> {
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth })

  // Data API v3: リアルタイム統計
  const statsRes = await youtube.videos.list({
    part: ['statistics'],
    id: [video.videoId],
  })

  const stats = statsRes.data.items?.[0]?.statistics
  const views = Number(stats?.viewCount ?? 0)
  const likes = Number(stats?.likeCount ?? 0)
  const comments = Number(stats?.commentCount ?? 0)

  // Analytics API v2: CTR・維持率（48時間以降に反映される指標）
  const publishDate = video.publishedAt.split('T')[0]
  const endDate = new Date().toISOString().split('T')[0]

  let impressions: number | null = null
  let impressionsCtr: number | null = null
  let averageViewPercentage: number | null = null
  let averageViewDuration: number | null = null
  let subscribersGained: number | null = null

  try {
    const analyticsRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: publishDate,
      endDate,
      metrics: 'views,averageViewDuration,averageViewPercentage,subscribersGained',
      filters: `video==${video.videoId}`,
    })
    const row = analyticsRes.data.rows?.[0]
    if (row) {
      averageViewDuration = Math.round(Number(row[1]))
      averageViewPercentage = Number(Number(row[2]).toFixed(1))
      subscribersGained = Number(row[3])
    }
  } catch (err) {
    console.error('Full analytics query failed:', err)
  }

  try {
    const impressionsRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: publishDate,
      endDate,
      metrics: 'impressions,impressionsCtr',
      filters: `video==${video.videoId}`,
    })
    const row = impressionsRes.data.rows?.[0]
    if (row) {
      impressions = Number(row[0])
      impressionsCtr = Number((Number(row[1]) * 100).toFixed(2))
    }
  } catch (err) {
    console.error('Impressions query failed:', err)
  }

  // チャンネル平均を取得（直近30日の動画別平均）
  let channelAvgViews48h: number | null = null
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const avgRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate,
      metrics: 'views',
      dimensions: 'video',
      sort: '-views',
      maxResults: 10,
    })
    const rows = avgRes.data.rows ?? []
    if (rows.length > 0) {
      const totalViews = rows.reduce((sum, row) => sum + Number(row[1]), 0)
      channelAvgViews48h = Math.round(totalViews / rows.length)
    }
  } catch {
    // 平均取得失敗は無視
  }

  // Reporting API CTR（翌日以降に利用可能）
  const reportingData = await fetchReportingCtr(video.videoId)

  const fullStats: FullStats = {
    views,
    likes,
    comments,
    hoursAgo: video.hoursAgo,
    reportingCtr: reportingData?.ctr ?? null,
    reportingImpressions: reportingData?.impressions ?? null,
    impressions,
    impressionsCtr,
    averageViewPercentage,
    averageViewDuration,
    subscribersGained,
  }

  // アラート生成
  const alerts: PostAlert[] = []

  if (impressionsCtr !== null) {
    if (impressionsCtr < 2.0) {
      alerts.push({ severity: 'critical', message: `CTR ${impressionsCtr}% — サムネ・タイトルが刺さっていない可能性。` })
    } else if (impressionsCtr < 4.0) {
      alerts.push({ severity: 'warning', message: `CTR ${impressionsCtr}% — 平均以下。サムネの改善余地あり。` })
    } else {
      alerts.push({ severity: 'good', message: `CTR ${impressionsCtr}% — 良好。` })
    }
  }

  if (averageViewPercentage !== null) {
    if (averageViewPercentage < 20) {
      alerts.push({ severity: 'critical', message: `視聴維持率 ${averageViewPercentage}% — 冒頭で大量離脱。構成の見直しが必要。` })
    } else if (averageViewPercentage < 35) {
      alerts.push({ severity: 'warning', message: `視聴維持率 ${averageViewPercentage}% — やや低め。中盤のテンポ改善を検討。` })
    } else {
      alerts.push({ severity: 'good', message: `視聴維持率 ${averageViewPercentage}% — 良好。` })
    }
  }

  if (channelAvgViews48h !== null) {
    const ratio = views / channelAvgViews48h
    if (ratio < 0.5) {
      alerts.push({ severity: 'critical', message: `再生数 ${views}回はチャンネル平均の${Math.round(ratio * 100)}%。テーマ選びを振り返る。` })
    } else if (ratio < 0.8) {
      alerts.push({ severity: 'warning', message: `再生数 ${views}回はチャンネル平均のやや下（${Math.round(ratio * 100)}%）。` })
    } else {
      alerts.push({ severity: 'good', message: `再生数 ${views}回。チャンネル平均の${Math.round(ratio * 100)}%で順調。` })
    }
  }

  const criticals = alerts.filter(a => a.severity === 'critical').length
  const warnings = alerts.filter(a => a.severity === 'warning').length

  let summary: string
  if (criticals > 0) {
    summary = `🚨 投稿後${video.hoursAgo}時間 — 重大アラート ${criticals}件。改善アクションが必要。`
  } else if (warnings > 0) {
    summary = `⚠️ 投稿後${video.hoursAgo}時間 — 警告 ${warnings}件。注視が必要。`
  } else {
    summary = `✅ 投稿後${video.hoursAgo}時間 — 順調です。`
  }

  return {
    stage: 'full',
    video,
    stats: fullStats,
    channelAverage: { viewsPerVideo48h: channelAvgViews48h },
    alerts,
    summary,
  }
}

/**
 * トラッキング結果をMarkdownレポートに変換
 */
export function formatPostTrackingReport(result: PostTrackingResult): string {
  const { stage, video, stats, alerts, summary } = result

  let md = `# 投稿後トラッキング（${stage === 'early' ? '初動' : 'フル判定'}）\n`
  md += `> ${summary}\n\n`

  md += `## 動画情報\n`
  md += `- **タイトル**: ${video.title}\n`
  md += `- **投稿日時**: ${video.publishedAt}\n`
  md += `- **経過時間**: ${video.hoursAgo}時間\n\n`

  md += `## 指標\n\n`
  md += `| 指標 | 値 |\n`
  md += `|---|---|\n`
  md += `| 再生数 | ${stats.views.toLocaleString()} |\n`
  md += `| いいね | ${stats.likes} |\n`
  md += `| コメント | ${stats.comments} |\n`

  if (stage === 'early') {
    const early = stats as EarlyStats
    if (early.reportingCtr !== null) md += `| CTR（Reporting API） | ${early.reportingCtr}% |\n`
    if (early.reportingImpressions !== null) md += `| インプレッション（Reporting API） | ${early.reportingImpressions.toLocaleString()} |\n`
    if (early.reportingCtr === null) md += `| CTR | 翌日以降に取得可能 |\n`
  }

  if (stage === 'full') {
    const full = stats as FullStats
    if (full.impressionsCtr !== null) md += `| CTR | ${full.impressionsCtr}% |\n`
    if (full.averageViewPercentage !== null) md += `| 視聴維持率 | ${full.averageViewPercentage}% |\n`
    if (full.averageViewDuration !== null) md += `| 平均視聴時間 | ${full.averageViewDuration}秒 |\n`
    if (full.impressions !== null) md += `| インプレッション | ${full.impressions.toLocaleString()} |\n`
    if (full.subscribersGained !== null) md += `| 登録者増 | +${full.subscribersGained} |\n`
  }

  md += '\n'

  if (alerts.length > 0) {
    md += `## 判定\n\n`
    for (const a of alerts) {
      const icon = a.severity === 'critical' ? '🚨' : a.severity === 'warning' ? '⚠️' : '✅'
      md += `- ${icon} ${a.message}\n`
    }
    md += '\n'
  }

  return md
}
