import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { isDropboxAvailable, dropboxDownload, dropboxUpload } from '@/lib/dropbox'

export const runtime = 'nodejs'

/** チェックリスト行を投稿済みに変更 */
function markLineAsPosted(content: string, topicTitle: string): string {
  const escaped = topicTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return content.replace(
    new RegExp(`^- \\[ \\] \\*\\*${escaped}\\*\\*`, 'm'),
    `- [x] **${topicTitle}**`
  )
}

/** レガシー個別MDのstatus書き換え */
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
    const { filePath, topicTitle, mdContent } = await req.json() as {
      filePath: string
      topicTitle?: string
      mdContent?: string
    }

    // ── Dropboxモード（共有ファイル） ──────────────────────────────────────────
    if (filePath.startsWith('dropbox:') && isDropboxAvailable()) {
      const relativePath = filePath.replace('dropbox:', '')
      const content = await dropboxDownload(relativePath)
      const updated = topicTitle ? markLineAsPosted(content, topicTitle) : applyPostedStatus(content)
      await dropboxUpload(relativePath, updated)
      return NextResponse.json({ ok: true, dropboxMode: true })
    }

    // ── ローカルWindows（共有ファイル） ─────────────────────────────────────
    if (filePath.startsWith('local:') && process.platform === 'win32') {
      const realPath = filePath.replace('local:', '')
      const fs = await import('fs')
      if (!fs.existsSync(realPath)) {
        return NextResponse.json({ error: 'ファイルが見つかりません: ' + realPath }, { status: 404 })
      }
      const content = fs.readFileSync(realPath, 'utf-8')
      const updated = topicTitle ? markLineAsPosted(content, topicTitle) : applyPostedStatus(content)
      fs.writeFileSync(realPath, updated, 'utf-8')
      return NextResponse.json({ ok: true })
    }

    // ── ダウンロードモード（フォールバック個別MD） ────────────────────────────
    if (filePath.startsWith('download:') && mdContent) {
      const updated = applyPostedStatus(mdContent)
      const fileName = filePath.replace('download:', '')
      return NextResponse.json({ ok: true, downloadMode: true, content: updated, fileName })
    }

    return NextResponse.json({ ok: true, skipped: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'ファイル更新エラー: ' + msg }, { status: 500 })
  }
}
