/**
 * 自チャンネル動画一覧 API（ガルch・健康chから完全移植）
 * - APIキーのみで動画一覧取得（OAuth不要）
 * - 環境変数: YOUTUBE_CHANNEL_ID_GALCHAN
 */
import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getOwnerChannelVideos } from '@/lib/youtube-galchan'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const channelId = process.env.YOUTUBE_CHANNEL_ID_GALCHAN
  if (!channelId) {
    return NextResponse.json(
      { error: 'YOUTUBE_CHANNEL_ID_GALCHAN が設定されていません' },
      { status: 500 },
    )
  }

  try {
    const videos = await getOwnerChannelVideos(channelId, 30)

    const result = videos.map((v: {
      id: string
      snippet: { title: string; publishedAt: string; thumbnails: { medium: { url: string } } }
      statistics: { commentCount: string }
    }) => ({
      id: v.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      commentCount: v.statistics?.commentCount ?? '0',
      thumbnailUrl: v.snippet.thumbnails?.medium?.url ?? '',
    }))

    return NextResponse.json({ videos: result })
  } catch (error) {
    console.error('Channel videos API error:', error)
    return NextResponse.json(
      { error: '動画一覧の取得に失敗しました' },
      { status: 500 },
    )
  }
}
