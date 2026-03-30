/**
 * YouTube Detector（異常検知）
 * ─ 前週比でチャンネル指標の変動を検知し、アラートを生成
 * ─ 共通ロジック: ガルちゃん/健康ゆる雑学の両チャンネルで使い回し可能
 */
import { fetchChannelAnalytics, fetchVideoAnalytics } from './youtube-analytics'
import type { ChannelAnalytics, VideoAnalytics } from './youtube-analytics'

// ── 閾値設定 ──────────────────────────────────
export interface DetectorThresholds {
  /** 再生数の前週比低下率（%）。これを超えたらアラート */
  viewsDropPercent: number
  /** 視聴時間の前週比低下率（%） */
  watchTimeDropPercent: number
  /** 登録者純増が前週比でこの割合以上減ったらアラート（%） */
  subscriberDropPercent: number
  /** 個別動画: CTRがこの値未満ならアラート（%） */
  ctrFloor: number
  /** 個別動画: 視聴維持率がこの値未満ならアラート（%） */
  retentionFloor: number
}

export const DEFAULT_THRESHOLDS: DetectorThresholds = {
  viewsDropPercent: 20,
  watchTimeDropPercent: 20,
  subscriberDropPercent: 30,
  ctrFloor: 3.0,
  retentionFloor: 30.0,
}

// ── アラート型 ──────────────────────────────────
export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface DetectorAlert {
  severity: AlertSeverity
  metric: string
  message: string
  thisWeek: number
  lastWeek: number
  changePercent: number
}

export interface WeeklyComparison {
  period: {
    thisWeek: { start: string; end: string }
    lastWeek: { start: string; end: string }
  }
  channel: {
    thisWeek: { views: number; watchTimeMinutes: number; subscriberNet: number }
    lastWeek: { views: number; watchTimeMinutes: number; subscriberNet: number }
  }
  alerts: DetectorAlert[]
  videoAlerts: VideoAlert[]
  summary: string
}

export interface VideoAlert {
  videoId: string
  title: string
  metric: string
  value: number
  threshold: number
  severity: AlertSeverity
  message: string
}

// ── メインロジック ──────────────────────────────────

/**
 * 前週比を計算してアラートを生成する
 */
export async function runDetector(
  thresholds: DetectorThresholds = DEFAULT_THRESHOLDS,
): Promise<WeeklyComparison> {
  // 過去14日分を取得して、前半7日(先週) / 後半7日(今週) に分ける
  const channel = await fetchChannelAnalytics(14)
  const videos = await fetchVideoAnalytics(30)

  const { thisWeekData, lastWeekData } = splitWeeks(channel)
  const alerts = detectChannelAlerts(thisWeekData, lastWeekData, thresholds)
  const videoAlerts = detectVideoAlerts(videos, thresholds)

  const allAlerts = [...alerts, ...videoAlerts.map(va => ({
    severity: va.severity,
    metric: va.metric,
    message: va.message,
    thisWeek: va.value,
    lastWeek: va.threshold,
    changePercent: 0,
  }))]

  const criticalCount = allAlerts.filter(a => a.severity === 'critical').length
  const warningCount = allAlerts.filter(a => a.severity === 'warning').length

  let summary: string
  if (criticalCount > 0) {
    summary = `🚨 重大アラート ${criticalCount}件、警告 ${warningCount}件。早急に確認が必要です。`
  } else if (warningCount > 0) {
    summary = `⚠️ 警告 ${warningCount}件。注視が必要です。`
  } else {
    summary = `✅ 異常なし。前週比で大きな変動はありません。`
  }

  return {
    period: {
      thisWeek: { start: thisWeekData.startDate, end: thisWeekData.endDate },
      lastWeek: { start: lastWeekData.startDate, end: lastWeekData.endDate },
    },
    channel: {
      thisWeek: {
        views: thisWeekData.views,
        watchTimeMinutes: thisWeekData.watchTimeMinutes,
        subscriberNet: thisWeekData.subscriberNet,
      },
      lastWeek: {
        views: lastWeekData.views,
        watchTimeMinutes: lastWeekData.watchTimeMinutes,
        subscriberNet: lastWeekData.subscriberNet,
      },
    },
    alerts,
    videoAlerts,
    summary,
  }
}

// ── 内部ヘルパー ──────────────────────────────────

interface WeekData {
  startDate: string
  endDate: string
  views: number
  watchTimeMinutes: number
  subscriberNet: number
}

function splitWeeks(channel: ChannelAnalytics): {
  thisWeekData: WeekData
  lastWeekData: WeekData
} {
  const daily = channel.daily
  const midpoint = Math.floor(daily.length / 2)

  const lastWeekDays = daily.slice(0, midpoint)
  const thisWeekDays = daily.slice(midpoint)

  return {
    lastWeekData: aggregateDays(lastWeekDays),
    thisWeekData: aggregateDays(thisWeekDays),
  }
}

function aggregateDays(
  days: ChannelAnalytics['daily'],
): WeekData {
  let views = 0
  let watchTimeMinutes = 0
  let subscriberGained = 0

  for (const d of days) {
    views += d.views
    watchTimeMinutes += d.estimatedMinutesWatched
    subscriberGained += d.subscribersGained
  }

  return {
    startDate: days[0]?.date ?? '',
    endDate: days[days.length - 1]?.date ?? '',
    views,
    watchTimeMinutes,
    subscriberNet: subscriberGained,
  }
}

function calcChangePercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function detectChannelAlerts(
  thisWeek: WeekData,
  lastWeek: WeekData,
  thresholds: DetectorThresholds,
): DetectorAlert[] {
  const alerts: DetectorAlert[] = []

  // 再生数
  const viewsChange = calcChangePercent(thisWeek.views, lastWeek.views)
  if (viewsChange <= -thresholds.viewsDropPercent) {
    alerts.push({
      severity: viewsChange <= -thresholds.viewsDropPercent * 1.5 ? 'critical' : 'warning',
      metric: '再生数',
      message: `再生数が前週比 ${viewsChange.toFixed(1)}% 減少（${lastWeek.views.toLocaleString()} → ${thisWeek.views.toLocaleString()}）`,
      thisWeek: thisWeek.views,
      lastWeek: lastWeek.views,
      changePercent: Math.round(viewsChange * 10) / 10,
    })
  }

  // 視聴時間
  const watchChange = calcChangePercent(thisWeek.watchTimeMinutes, lastWeek.watchTimeMinutes)
  if (watchChange <= -thresholds.watchTimeDropPercent) {
    alerts.push({
      severity: watchChange <= -thresholds.watchTimeDropPercent * 1.5 ? 'critical' : 'warning',
      metric: '視聴時間',
      message: `視聴時間が前週比 ${watchChange.toFixed(1)}% 減少（${lastWeek.watchTimeMinutes.toLocaleString()}分 → ${thisWeek.watchTimeMinutes.toLocaleString()}分）`,
      thisWeek: thisWeek.watchTimeMinutes,
      lastWeek: lastWeek.watchTimeMinutes,
      changePercent: Math.round(watchChange * 10) / 10,
    })
  }

  // 登録者純増
  const subChange = calcChangePercent(thisWeek.subscriberNet, lastWeek.subscriberNet)
  if (subChange <= -thresholds.subscriberDropPercent) {
    alerts.push({
      severity: 'warning',
      metric: '登録者純増',
      message: `登録者純増が前週比 ${subChange.toFixed(1)}% 減少（+${lastWeek.subscriberNet} → +${thisWeek.subscriberNet}）`,
      thisWeek: thisWeek.subscriberNet,
      lastWeek: lastWeek.subscriberNet,
      changePercent: Math.round(subChange * 10) / 10,
    })
  }

  // 好調アラート（info）
  if (viewsChange >= 20) {
    alerts.push({
      severity: 'info',
      metric: '再生数',
      message: `再生数が前週比 +${viewsChange.toFixed(1)}% 増加！好調です。`,
      thisWeek: thisWeek.views,
      lastWeek: lastWeek.views,
      changePercent: Math.round(viewsChange * 10) / 10,
    })
  }

  return alerts
}

function detectVideoAlerts(
  videos: VideoAnalytics[],
  thresholds: DetectorThresholds,
): VideoAlert[] {
  const alerts: VideoAlert[] = []

  // 直近7日以内に投稿された動画のみチェック
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  for (const v of videos) {
    if (!v.publishedAt) continue
    const publishedDate = new Date(v.publishedAt)
    if (publishedDate < sevenDaysAgo) continue

    // CTR チェック
    if (v.impressions && v.impressions.impressionsCtr < thresholds.ctrFloor) {
      alerts.push({
        videoId: v.videoId,
        title: v.title,
        metric: 'CTR',
        value: v.impressions.impressionsCtr,
        threshold: thresholds.ctrFloor,
        severity: v.impressions.impressionsCtr < thresholds.ctrFloor * 0.5 ? 'critical' : 'warning',
        message: `「${v.title.slice(0, 30)}」のCTRが ${v.impressions.impressionsCtr}%（基準: ${thresholds.ctrFloor}%）`,
      })
    }

    // 視聴維持率チェック
    if (v.analytics && v.analytics.averageViewPercentage < thresholds.retentionFloor) {
      alerts.push({
        videoId: v.videoId,
        title: v.title,
        metric: '視聴維持率',
        value: v.analytics.averageViewPercentage,
        threshold: thresholds.retentionFloor,
        severity: v.analytics.averageViewPercentage < thresholds.retentionFloor * 0.5 ? 'critical' : 'warning',
        message: `「${v.title.slice(0, 30)}」の視聴維持率が ${v.analytics.averageViewPercentage}%（基準: ${thresholds.retentionFloor}%）`,
      })
    }
  }

  return alerts
}

/**
 * Detector結果をMarkdownレポートに変換
 */
export function formatDetectorReport(result: WeeklyComparison): string {
  const { period, channel, alerts, videoAlerts, summary } = result

  let md = `# Detector レポート\n`
  md += `> ${summary}\n\n`

  md += `## 期間比較\n`
  md += `- 今週: ${period.thisWeek.start} 〜 ${period.thisWeek.end}\n`
  md += `- 先週: ${period.lastWeek.start} 〜 ${period.lastWeek.end}\n\n`

  md += `## チャンネル指標\n\n`
  md += `| 指標 | 先週 | 今週 | 変化率 |\n`
  md += `|---|---|---|---|\n`

  const viewsChange = calcChangePercent(channel.thisWeek.views, channel.lastWeek.views)
  const watchChange = calcChangePercent(channel.thisWeek.watchTimeMinutes, channel.lastWeek.watchTimeMinutes)
  const subChange = calcChangePercent(channel.thisWeek.subscriberNet, channel.lastWeek.subscriberNet)

  md += `| 再生数 | ${channel.lastWeek.views.toLocaleString()} | ${channel.thisWeek.views.toLocaleString()} | ${viewsChange >= 0 ? '+' : ''}${viewsChange.toFixed(1)}% |\n`
  md += `| 視聴時間(分) | ${channel.lastWeek.watchTimeMinutes.toLocaleString()} | ${channel.thisWeek.watchTimeMinutes.toLocaleString()} | ${watchChange >= 0 ? '+' : ''}${watchChange.toFixed(1)}% |\n`
  md += `| 登録者純増 | +${channel.lastWeek.subscriberNet} | +${channel.thisWeek.subscriberNet} | ${subChange >= 0 ? '+' : ''}${subChange.toFixed(1)}% |\n\n`

  if (alerts.length > 0) {
    md += `## チャンネルアラート\n\n`
    for (const a of alerts) {
      const icon = a.severity === 'critical' ? '🚨' : a.severity === 'warning' ? '⚠️' : '📈'
      md += `- ${icon} **${a.metric}**: ${a.message}\n`
    }
    md += '\n'
  }

  if (videoAlerts.length > 0) {
    md += `## 動画別アラート\n\n`
    for (const va of videoAlerts) {
      const icon = va.severity === 'critical' ? '🚨' : '⚠️'
      md += `- ${icon} **${va.metric}**: ${va.message}\n`
    }
    md += '\n'
  }

  if (alerts.length === 0 && videoAlerts.length === 0) {
    md += `異常は検知されませんでした。\n`
  }

  return md
}
