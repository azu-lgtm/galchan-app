import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { isDropboxAvailable, dropboxDownload, dropboxUpload } from '@/lib/dropbox'

export const runtime = 'nodejs'

function applyPostedStatus(content: string): string {
  return content
    .replace(/^status: 未投稿$/m, 'status: 投稿済み')
    .replace(/\b未投稿\b/g, '投稿済み')
    .replace(/tags: \[([^\]]*?)未投稿([^\]]*?)\]/g, (_, a, b) => `tags: [${a}投稿済み${b}]`)
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { filePath, mdContent } = await req.json() as { filePath: string; mdContent?: string }

    // ── Dropboxモード ──────────────────────────────────────────────────────────
    if (filePath.startsWith('dropbox:') && isDropboxAvailable()) {
      const relativePath = filePath.replace('dropbox:', '')
      const content = await dropboxDownload(relativePath)
      const updated = applyPostedStatus(content)
      await dropboxUpload(relativePath, updated)
      return NextResponse.json({ ok: true, dropboxMode: true })
    }

    // ── ダウンロードモード: 更新済みMDをブラウザに返してダウンロードさせる ──
    if (filePath.startsWith('download:') && mdContent) {
      const updated = applyPostedStatus(mdContent)
      const fileName = filePath.replace('download:', '')
      return NextResponse.json({ ok: true, downloadMode: true, content: updated, fileName })
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

    return NextResponse.json({ ok: true, skipped: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'ファイル更新エラー: ' + msg }, { status: 500 })
  }
}
