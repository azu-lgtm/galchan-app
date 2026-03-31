/**
 * YouTube Analytics API エンドポイント
 * GET /api/youtube/analytics?days=90&save=true
 *
 * - days: 取得期間（デフォルト90）
 * - save: trueの場合、Obsidianのアナリティクス.mdを上書き更新
 *
 * 必要な認証: ガルちゃんアカウント(1) の GOOGLE_REFRESH_TOKEN
 * 必要なスコープ: yt-analytics.readonly, youtube.readonly
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import {
  fetchChannelAnalytics,
  fetchVideoAnalytics,
  formatAsObsidianMarkdown,
} from '@/lib/youtube-analytics'
import { writeAnalyticsToSheet } from '@/lib/google'

const ANALYTICS_MD_PATH =
  'C:\\Users\\meiek\\Dropbox\\アプリ\\remotely-save\\obsidian\\02_youtube\\ガルちゃんねる\\自分動画\\アナリティクス.md'

export async function GET(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '90', 10)
  const save = searchParams.get('save') === 'true'

  try {
    const [channel, videos] = await Promise.all([
      fetchChannelAnalytics(days),
      fetchVideoAnalytics(30),
    ])

    const markdown = formatAsObsidianMarkdown(channel, videos)

    // Obsidian + スプレッドシートに保存
    if (save) {
      const { existsSync, readFileSync, writeFileSync } = await import('fs')

      // 最新データは上書き（いつでも最新を見れるように）
      writeFileSync(ANALYTICS_MD_PATH, markdown, 'utf-8')

      // スナップショットを蓄積（PDCA用の変化追跡）
      const HISTORY_PATH = ANALYTICS_MD_PATH.replace('アナリティクス.md', 'アナリティクス履歴.md')
      const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      const snapshot = `<!-- ${timestamp} -->\n${markdown}\n---\n\n`

      if (existsSync(HISTORY_PATH)) {
        const existing = readFileSync(HISTORY_PATH, 'utf-8')
        writeFileSync(HISTORY_PATH, snapshot + existing, 'utf-8')
      } else {
        writeFileSync(HISTORY_PATH, `# アナリティクス履歴\n> 取得ごとのスナップショットを蓄積。PDCAの変化追跡用。\n\n---\n\n${snapshot}`, 'utf-8')
      }

      await writeAnalyticsToSheet(channel, videos)
    }

    return NextResponse.json({
      channel,
      videos,
      markdown: save ? undefined : markdown,
      savedTo: save ? ANALYTICS_MD_PATH : undefined,
      message: save
        ? `アナリティクス.md + スプレッドシート「アナリティクス」シートを更新しました`
        : 'データを取得しました（save=true で Obsidian + スプシ に保存）',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('YouTube Analytics API error:', message)
    return NextResponse.json(
      { error: `YouTube Analytics API エラー: ${message}` },
      { status: 500 },
    )
  }
}
