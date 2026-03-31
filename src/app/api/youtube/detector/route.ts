/**
 * YouTube Detector API エンドポイント
 * GET /api/youtube/detector?save=true
 *
 * - save: trueの場合、Obsidianにレポートを保存
 *
 * 認証: ガルちゃんアカウント(1) の GOOGLE_REFRESH_TOKEN
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { runDetector, formatDetectorReport, DEFAULT_THRESHOLDS } from '@/lib/youtube-detector'

const DETECTOR_MD_PATH =
  'C:\\Users\\meiek\\Dropbox\\アプリ\\remotely-save\\obsidian\\02_youtube\\ガルちゃんねる\\自分動画\\Detectorレポート.md'

export async function GET(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const save = searchParams.get('save') === 'true'

  try {
    const result = await runDetector(DEFAULT_THRESHOLDS)
    const report = formatDetectorReport(result)

    if (save) {
      const { existsSync, readFileSync, writeFileSync } = await import('fs')

      // 蓄積型: 日時付きセクションとして先頭に追記
      const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      const separator = `\n---\n\n`
      const dated = `<!-- ${timestamp} -->\n${report}`

      if (existsSync(DETECTOR_MD_PATH)) {
        const existing = readFileSync(DETECTOR_MD_PATH, 'utf-8')
        writeFileSync(DETECTOR_MD_PATH, dated + separator + existing, 'utf-8')
      } else {
        writeFileSync(DETECTOR_MD_PATH, dated, 'utf-8')
      }
    }

    return NextResponse.json({
      ...result,
      report,
      savedTo: save ? DETECTOR_MD_PATH : undefined,
      message: save
        ? `Detectorレポートを保存しました: ${DETECTOR_MD_PATH}`
        : 'Detector実行完了（save=true で Obsidian に保存）',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('YouTube Detector error:', message)
    return NextResponse.json(
      { error: `Detector エラー: ${message}` },
      { status: 500 },
    )
  }
}
