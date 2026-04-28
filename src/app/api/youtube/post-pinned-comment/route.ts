/**
 * YouTube 固定コメント投稿 API
 * POST /api/youtube/post-pinned-comment
 *
 * Body JSON: { videoId: string, commentText: string }
 *
 * 仕組み:
 * 1. commentThreads.insert で自分のチャンネルからコメント投稿
 * 2. comments.setModerationStatus は他人のコメント用なので使わない
 *    → 投稿者自身のコメントは Studio UI で「固定」可能だが、公式 API でのピン留めは不可
 *    → そのため Studio リンクを返して手動ピン留めを案内
 *
 * 注意: 動画が public または unlisted の間のみコメント可能。
 *       privacyStatus='private' の間はコメント不可（YouTube の仕様）。
 *       → 動画を unlisted にしてからコメント投稿 → ピン留め → 公開の運用が必要。
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

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  let body: { videoId: string; commentText: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 })
  }

  const { videoId, commentText } = body
  if (!videoId || !commentText) {
    return NextResponse.json(
      { error: 'videoId / commentText は必須' },
      { status: 400 },
    )
  }

  try {
    const auth = getAuth()
    const youtube = google.youtube({ version: 'v3', auth })

    const res = await youtube.commentThreads.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: {
            snippet: {
              textOriginal: commentText,
            },
          },
        },
      },
    })

    const commentId = res.data.id
    const studioUrl = `https://studio.youtube.com/video/${videoId}/comments`
    const watchUrl = `https://youtu.be/${videoId}`

    return NextResponse.json({
      success: true,
      commentId,
      videoId,
      studioUrl,
      watchUrl,
      message: `✅ コメント投稿完了。Studioでピン留めしてください（公式APIでは自動ピン留め不可）。`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('post-pinned-comment error:', message)
    return NextResponse.json(
      { error: `コメント投稿失敗: ${message}` },
      { status: 500 },
    )
  }
}
