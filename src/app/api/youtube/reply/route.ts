/**
 * YouTube コメント返信投稿 API（ガルch・健康chから完全移植）
 * scope: youtube.force-ssl 必須
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAccessToken } from '@/lib/google'
import { postCommentReply } from '@/lib/youtube-galchan'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  try {
    const { threadId, text } = await req.json()

    if (!threadId || !text) {
      return NextResponse.json({ error: 'threadIdとtextが必要です' }, { status: 400 })
    }

    const accessToken = await getAccessToken()
    const result = await postCommentReply(threadId, text, accessToken)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Reply API error:', error)
    return NextResponse.json(
      { error: '返信の投稿に失敗しました' },
      { status: 500 },
    )
  }
}
