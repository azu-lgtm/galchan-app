import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.platform !== 'win32') {
    return NextResponse.json({ error: 'Obsidian操作はWindows環境でのみ動作します' }, { status: 503 })
  }

  try {
    const { filePath } = await req.json() as { filePath: string }
    const fs = await import('fs')

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'ファイルが見つかりません: ' + filePath }, { status: 404 })
    }

    let content = fs.readFileSync(filePath, 'utf-8')

    // frontmatter の status: 未投稿 → 投稿済み
    content = content.replace(/^status: 未投稿$/m, 'status: 投稿済み')
    // tags の 未投稿 → 投稿済み
    content = content.replace(/\b未投稿\b/g, '投稿済み')

    fs.writeFileSync(filePath, content, 'utf-8')

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'ファイル更新エラー: ' + msg }, { status: 500 })
  }
}
