/**
 * video-history API
 * GET  /api/youtube/video-history              — 履歴一覧 + サマリー
 * GET  /api/youtube/video-history?unfetched=true — 未取得エントリのみ
 * POST /api/youtube/video-history               — エントリ追加 or 指標更新
 *
 * 認証: ガルちゃんアカウント(1) の GOOGLE_REFRESH_TOKEN
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import {
  readHistory,
  addEntry,
  updateMetrics,
  updateWeeklyViews,
  getUnfetchedEntries,
  formatHistorySummary,
  type MetricsUpdate,
} from '@/lib/youtube-video-history'

export async function GET(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unfetchedOnly = searchParams.get('unfetched') === 'true'

  const entries = unfetchedOnly ? getUnfetchedEntries() : readHistory()
  const summary = formatHistorySummary()

  return NextResponse.json({
    entries,
    total: entries.length,
    summary,
  })
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const { action, videoId, title, publishDate, metrics, views7d } = body

  switch (action) {
    case 'add': {
      if (!videoId || !title || !publishDate) {
        return NextResponse.json({ error: 'videoId, title, publishDate が必要です' }, { status: 400 })
      }
      const entries = addEntry(videoId, title, publishDate)
      return NextResponse.json({ message: 'エントリを追加しました', entries })
    }

    case 'update-metrics': {
      if (!videoId || !metrics) {
        return NextResponse.json({ error: 'videoId と metrics が必要です' }, { status: 400 })
      }
      const entries = updateMetrics(videoId, metrics as MetricsUpdate)
      return NextResponse.json({ message: '指標を更新しました', entries })
    }

    case 'update-weekly': {
      if (!videoId || views7d === undefined) {
        return NextResponse.json({ error: 'videoId と views7d が必要です' }, { status: 400 })
      }
      const entries = updateWeeklyViews(videoId, views7d)
      return NextResponse.json({ message: '7日再生数を更新しました', entries })
    }

    default:
      return NextResponse.json({ error: `不明なaction: ${action}。add / update-metrics / update-weekly を指定してください` }, { status: 400 })
  }
}
