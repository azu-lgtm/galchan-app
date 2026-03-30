import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAuth } from '@/lib/youtube-analytics'

export const runtime = 'nodejs'
export const maxDuration = 30

interface ReachRow {
  date: string
  videoId: string
  impressions: number
  ctr: number
}

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  try {
    const auth = getAuth()
    const { token } = await auth.getAccessToken()
    if (!token) {
      return NextResponse.json({ error: 'アクセストークン取得失敗' }, { status: 401 })
    }

    const headers = { Authorization: `Bearer ${token}` }

    // ジョブ一覧から reach レポートのジョブIDを取得
    const listRes = await fetch('https://youtubereporting.googleapis.com/v1/jobs', { headers })
    if (!listRes.ok) {
      return NextResponse.json({ error: 'ジョブ一覧取得失敗' }, { status: listRes.status })
    }
    const listData = await listRes.json()
    const reachJob = (listData.jobs ?? []).find(
      (j: { reportTypeId: string }) => j.reportTypeId === 'channel_reach_basic_a1'
    )

    if (!reachJob) {
      return NextResponse.json({
        error: 'Reachレポートのジョブが未作成です。先に /api/youtube/reporting-setup を実行してください。',
        needsSetup: true,
      }, { status: 404 })
    }

    // レポート一覧取得
    const reportsRes = await fetch(
      `https://youtubereporting.googleapis.com/v1/jobs/${reachJob.id}/reports`,
      { headers }
    )
    if (!reportsRes.ok) {
      return NextResponse.json({ error: 'レポート一覧取得失敗' }, { status: reportsRes.status })
    }
    const reportsData = await reportsRes.json()
    const reports = reportsData.reports ?? []

    if (reports.length === 0) {
      return NextResponse.json({
        error: 'レポートがまだ生成されていません。ジョブ作成後1〜2日お待ちください。',
        jobId: reachJob.id,
        jobCreateTime: reachJob.createTime,
      }, { status: 404 })
    }

    // 直近28日分のレポートを集約
    const sortedReports = reports
      .filter((r: { startTime: string }) => r.startTime)
      .sort((a: { startTime: string }, b: { startTime: string }) =>
        b.startTime.localeCompare(a.startTime)
      )

    const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString()
    const recentReports = sortedReports.filter(
      (r: { startTime: string }) => r.startTime >= cutoff
    ).slice(0, 28)

    if (recentReports.length === 0) {
      recentReports.push(sortedReports[0])
    }

    // CSVダウンロード＆パース
    const allRows: ReachRow[] = []
    for (const report of recentReports) {
      const csvRes = await fetch(report.downloadUrl, { headers })
      if (!csvRes.ok) continue
      const csvText = await csvRes.text()
      const rows = parseReachCsv(csvText)
      allRows.push(...rows)
    }

    // 動画別に集約
    const videoMap: Record<string, { impressions: number; views_from_ctr: number; days: number }> = {}
    for (const row of allRows) {
      if (!videoMap[row.videoId]) {
        videoMap[row.videoId] = { impressions: 0, views_from_ctr: 0, days: 0 }
      }
      videoMap[row.videoId].impressions += row.impressions
      videoMap[row.videoId].views_from_ctr += row.impressions * row.ctr
      videoMap[row.videoId].days += 1
    }

    // CTRを再計算（加重平均）
    const videoReach = Object.entries(videoMap)
      .map(([videoId, data]) => ({
        videoId,
        impressions: data.impressions,
        ctr: data.impressions > 0 ? (data.views_from_ctr / data.impressions * 100) : 0,
        days: data.days,
      }))
      .sort((a, b) => b.impressions - a.impressions)

    // チャンネル全体の集計
    const totalImpressions = videoReach.reduce((sum, v) => sum + v.impressions, 0)
    const totalViewsFromCtr = Object.values(videoMap).reduce((sum, v) => sum + v.views_from_ctr, 0)
    const channelCtr = totalImpressions > 0 ? (totalViewsFromCtr / totalImpressions * 100) : 0

    return NextResponse.json({
      channel: {
        impressions: totalImpressions,
        ctr: Math.round(channelCtr * 10) / 10,
        reportCount: recentReports.length,
        latestReportDate: sortedReports[0]?.startTime?.split('T')[0] ?? '',
      },
      videos: videoReach.slice(0, 20),
      totalVideos: videoReach.length,
    })
  } catch (e) {
    console.error('reporting-fetch error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'レポート取得に失敗しました' },
      { status: 500 }
    )
  }
}

function parseReachCsv(csv: string): ReachRow[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',')
  const dateIdx = header.indexOf('date')
  const videoIdx = header.indexOf('video_id')
  const impIdx = header.indexOf('video_thumbnail_impressions')
  const ctrIdx = header.indexOf('video_thumbnail_impressions_ctr')

  if (videoIdx < 0 || impIdx < 0) return []

  const rows: ReachRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < header.length) continue
    rows.push({
      date: dateIdx >= 0 ? cols[dateIdx] : '',
      videoId: cols[videoIdx],
      impressions: parseInt(cols[impIdx], 10) || 0,
      ctr: ctrIdx >= 0 ? parseFloat(cols[ctrIdx]) || 0 : 0,
    })
  }
  return rows
}
