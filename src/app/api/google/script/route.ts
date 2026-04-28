/**
 * 動画タイトルから台本テキストを取得 API（ガルch版）
 * - 動画管理シート(SPREADSHEET_ID_GALCHAN)のJ列(動画タイトル)を検索
 * - G列(台本リンク)から台本スプシを開いて 台本!A4:B1000 を読み込み、タブ区切りで返却
 *
 * 健康ch版はGoogleDocsだったが、ガルch版はGoogleSheetsを参照する。
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { findScriptByVideoTitle } from '@/lib/google'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const videoTitle = req.nextUrl.searchParams.get('videoTitle')
  if (!videoTitle) {
    return NextResponse.json({ error: 'videoTitleが必要です' }, { status: 400 })
  }

  try {
    const found = await findScriptByVideoTitle(videoTitle)

    if (!found) {
      return NextResponse.json({ script: null, docUrl: null })
    }

    return NextResponse.json({
      script: found.script || null,
      docUrl: found.docUrl,
      docTitle: found.docTitle,
    })
  } catch (error) {
    console.error('Script fetch error:', error)
    return NextResponse.json(
      { error: '台本の取得に失敗しました' },
      { status: 500 },
    )
  }
}
