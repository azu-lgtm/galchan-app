/**
 * 投稿後トラッキング API
 * GET /api/youtube/post-tracker          — 最新動画を自動検出
 * GET /api/youtube/post-tracker?id=xxx   — 特定動画を指定
 * GET /api/youtube/post-tracker?save=true — Obsidianに保存
 *
 * 認証: ガルちゃんアカウント(1) の GOOGLE_REFRESH_TOKEN
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { trackLatestVideo, trackVideo, formatPostTrackingReport, type FullStats } from '@/lib/youtube-post-tracker'
import { addEntry, updateMetrics } from '@/lib/youtube-video-history'

const TRACKER_MD_PATH =
  'C:\\Users\\meiek\\Dropbox\\アプリ\\remotely-save\\obsidian\\02_youtube\\ガルちゃんねる\\自分動画\\投稿後トラッキング.md'

export async function GET(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('id')
  const save = searchParams.get('save') === 'true'

  try {
    const result = videoId
      ? await trackVideo(videoId)
      : await trackLatestVideo()

    if (!result) {
      return NextResponse.json({
        message: '7日以内に投稿された動画がありません。',
        result: null,
      })
    }

    const report = formatPostTrackingReport(result)

    // video-history に自動連携
    const publishDate = result.video.publishedAt.split('T')[0]
    addEntry(result.video.videoId, result.video.title, publishDate)

    if (result.stage === 'full') {
      const full = result.stats as FullStats
      updateMetrics(result.video.videoId, {
        views48h: full.views,
        ctr: full.impressionsCtr,
        retention: full.averageViewPercentage,
        subscribersGained: full.subscribersGained,
        likes: full.likes,
        comments: full.comments,
      })
    }

    if (save) {
      const { existsSync, readFileSync, writeFileSync } = await import('fs')

      // 蓄積型: 既存ファイルがあれば日時付きセクションとして先頭に追記
      const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      const separator = `\n---\n\n`
      const dated = `<!-- ${timestamp} -->\n${report}`

      if (existsSync(TRACKER_MD_PATH)) {
        const existing = readFileSync(TRACKER_MD_PATH, 'utf-8')
        writeFileSync(TRACKER_MD_PATH, dated + separator + existing, 'utf-8')
      } else {
        writeFileSync(TRACKER_MD_PATH, dated, 'utf-8')
      }
    }

    return NextResponse.json({
      ...result,
      report,
      savedTo: save ? TRACKER_MD_PATH : undefined,
      message: save
        ? `トラッキングレポートを保存しました`
        : `投稿後${result.video.hoursAgo}時間 — ${result.stage === 'early' ? '初動チェック' : 'フル判定'}完了`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Post tracker error:', message)
    return NextResponse.json(
      { error: `トラッキングエラー: ${message}` },
      { status: 500 },
    )
  }
}
