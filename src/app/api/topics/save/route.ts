import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { dropboxUpload, isDropboxAvailable } from '@/lib/dropbox'
import type { GalTopicCandidate } from '@/lib/types'

export const runtime = 'nodejs'

const CATEGORY_LABEL: Record<string, string> = {
  galchan:     'ガルちゃんネタ',
  trends:      'トレンドネタ',
  competitors: '競合ネタ',
}

function buildContent(topic: GalTopicCandidate, date: string, categoryLabel: string): string {
  const sourceUrlLine = topic.sourceUrl ? `\nsourceUrl: "${topic.sourceUrl}"` : ''
  return `---
date: ${date}
category: ${categoryLabel}
status: 未投稿
topic: "${topic.title.replace(/"/g, '\\"')}"
angle: "${topic.angle.replace(/"/g, '\\"')}"${sourceUrlLine}
tags: [ガルちゃん, ${categoryLabel}, 未投稿]
---

# ${topic.title}

## 概要
${topic.description}

## 切り口
${topic.angle}

## 感情ワード
${topic.emotionWords.map(w => `- ${w}`).join('\n')}
${topic.source ? `\n## 参考元\n${topic.source}` : ''}
${topic.sourceUrl ? `\n## ネタ元リンク\n${topic.sourceUrl}` : ''}

---
*保存日: ${date}*
`
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { topic } = await req.json() as { topic: GalTopicCandidate }
    const date = new Date().toISOString().slice(0, 10)
    const category = topic.category ?? 'galchan'
    const categoryLabel = CATEGORY_LABEL[category] ?? category

    const safeTitle = topic.title
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50)

    const fileName = `${date}_${safeTitle}.md`
    const content = buildContent(topic, date, categoryLabel)

    // ── Dropbox経由（Vercel等）──────────────────────────────────────────────
    if (isDropboxAvailable()) {
      await dropboxUpload(`ネタ候補/${fileName}`, content)
      return NextResponse.json({ ok: true, filePath: `dropbox:ネタ候補/${fileName}` })
    }

    // ── ローカルWindows ──────────────────────────────────────────────────────
    if (process.platform === 'win32') {
      const vaultPath = process.env.OBSIDIAN_VAULT_PATH
      if (!vaultPath) {
        return NextResponse.json({ error: 'OBSIDIAN_VAULT_PATH が未設定です' }, { status: 503 })
      }
      const fs = await import('fs')
      const path = await import('path')
      const dir = path.join(vaultPath, 'ネタ候補')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const filePath = path.join(dir, fileName)
      fs.writeFileSync(filePath, content, 'utf-8')
      return NextResponse.json({ ok: true, filePath })
    }

    return NextResponse.json(
      { error: 'Obsidian保存には DROPBOX_APP_KEY / DROPBOX_REFRESH_TOKEN の設定が必要です' },
      { status: 503 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'ファイル書き込みエラー: ' + msg }, { status: 500 })
  }
}
