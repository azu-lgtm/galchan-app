/**
 * Playbook API
 * GET /api/youtube/playbook           — Playbook生成（プレビュー）
 * GET /api/youtube/playbook?save=true — Obsidianに保存
 *
 * 認証: ガルちゃんアカウント(1)
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { generatePlaybook, savePlaybook } from '@/lib/youtube-playbook'

export async function GET(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const save = searchParams.get('save') === 'true'

  try {
    const report = save ? savePlaybook() : generatePlaybook()

    return NextResponse.json({
      report,
      saved: save,
      message: save ? 'Playbookを保存しました' : 'Playbookを生成しました（save=true で保存）',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Playbook error:', message)
    return NextResponse.json({ error: `Playbookエラー: ${message}` }, { status: 500 })
  }
}
