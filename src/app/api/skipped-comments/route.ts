/**
 * スキップ済みコメント管理 API（ガルch・健康chから完全移植）
 * GET   : 全動画分のスキップ済みコメントIDマップを返却
 * POST  : 特定動画のスキップ済みコメントIDリストを上書き保存
 * DELETE: 特定動画 or 全体のスキップをクリア
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import {
  getSkippedCommentsFromStore,
  setSkippedCommentsForVideo,
  clearSkippedCommentsForVideo,
  clearAllSkippedComments,
} from '@/lib/kv'

export const runtime = 'nodejs'

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  const map = await getSkippedCommentsFromStore()
  return NextResponse.json({ map })
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  const { videoId, commentIds } = await req.json()
  if (!videoId || !Array.isArray(commentIds)) {
    return NextResponse.json({ error: 'videoIdとcommentIdsが必要です' }, { status: 400 })
  }
  await setSkippedCommentsForVideo(videoId, commentIds)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  const videoId = req.nextUrl.searchParams.get('videoId')
  if (videoId) {
    await clearSkippedCommentsForVideo(videoId)
  } else {
    await clearAllSkippedComments()
  }
  return NextResponse.json({ ok: true })
}
