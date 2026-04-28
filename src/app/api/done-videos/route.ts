/**
 * 返信完了動画リスト管理 API（ガルch・健康chから完全移植）
 * GET   : 完了動画ID配列を返却
 * POST  : videoId を完了リストに追加
 * DELETE: 完了リストをクリア
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import {
  getDoneVideosFromStore,
  addDoneVideoToStore,
  clearDoneVideosFromStore,
} from '@/lib/kv'

export const runtime = 'nodejs'

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  const ids = await getDoneVideosFromStore()
  return NextResponse.json({ ids })
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  const { videoId } = await req.json()
  if (!videoId) return NextResponse.json({ error: 'videoId必須' }, { status: 400 })
  await addDoneVideoToStore(videoId)
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  await clearDoneVideosFromStore()
  return NextResponse.json({ ok: true })
}
