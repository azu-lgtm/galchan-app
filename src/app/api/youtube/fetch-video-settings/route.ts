/**
 * 勝ち動画の設定取得 API（読み取り専用・BANリスク0）
 * GET /api/youtube/fetch-video-settings?videoId=XXXX
 *
 * 仕組み: videos.list で snippet/status/contentDetails を取得
 * 用途: 勝ち動画（ガル=jLmLV-cqqOk）の設定を新動画にコピペ参照
 */
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'

function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return client
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')
  if (!videoId) {
    return NextResponse.json({ error: 'videoId クエリパラメータが必要' }, { status: 400 })
  }

  try {
    const auth = getAuth()
    const youtube = google.youtube({ version: 'v3', auth })

    const res = await youtube.videos.list({
      part: ['snippet', 'status', 'contentDetails', 'localizations'],
      id: [videoId],
    })

    const video = res.data.items?.[0]
    if (!video) {
      return NextResponse.json({ error: `videoId=${videoId} が見つからない` }, { status: 404 })
    }

    const snippet = video.snippet ?? {}
    const status = video.status ?? {}
    const contentDetails = video.contentDetails ?? {}

    return NextResponse.json({
      videoId,
      title: snippet.title,
      description: snippet.description,
      tags: snippet.tags ?? [],
      categoryId: snippet.categoryId,
      defaultLanguage: snippet.defaultLanguage,
      defaultAudioLanguage: snippet.defaultAudioLanguage,
      privacyStatus: status.privacyStatus,
      embeddable: status.embeddable,
      selfDeclaredMadeForKids: status.selfDeclaredMadeForKids,
      madeForKids: status.madeForKids,
      license: status.license,
      duration: contentDetails.duration,
      caption: contentDetails.caption,
      localizations: video.localizations ?? {},
      studioUrl: `https://studio.youtube.com/video/${videoId}/edit`,
      watchUrl: `https://youtu.be/${videoId}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('fetch-video-settings error:', message)
    return NextResponse.json(
      { error: `取得失敗: ${message}` },
      { status: 500 },
    )
  }
}
