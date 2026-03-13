import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { dropboxUpload, dropboxDownload, isDropboxAvailable } from '@/lib/dropbox'

export const runtime = 'nodejs'

function applyPostedStatus(content: string): string {
  return content
    .replace(/^status: 未投稿$/m, 'status: 投稿済み')
    .replace(/\b未投稿\b/g, '投稿済み')
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { filePath } = await req.json() as { filePath: string }

    // ── Dropbox経由（Vercel等）──────────────────────────────────────────────
    if (isDropboxAvailable() && filePath.startsWith('dropbox:')) {
      const relativePath = filePath.replace('dropbox:', '')
      const current = await dropboxDownload(relativePath)
      const updated = applyPostedStatus(current)
      await dropboxUpload(relativePath, updated)
      return NextResponse.json({ ok: true })
    }

    // ── ローカルWindows ──────────────────────────────────────────────────────
    if (process.platform === 'win32') {
      const fs = await import('fs')
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'ファイルが見つかりません: ' + filePath }, { status: 404 })
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      fs.writeFileSync(filePath, applyPostedStatus(content), 'utf-8')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json(
      { error: 'この操作には DROPBOX_APP_KEY / DROPBOX_REFRESH_TOKEN の設定が必要です' },
      { status: 503 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'ファイル更新エラー: ' + msg }, { status: 500 })
  }
}
