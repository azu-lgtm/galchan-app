import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import type { GalTopicCandidate } from '@/lib/types'

export const runtime = 'nodejs'

const CATEGORY_LABEL: Record<string, string> = {
  galchan:     'ガルちゃんネタ',
  trends:      'トレンドネタ',
  competitors: '競合ネタ',
}

export function buildTopicMd(topic: GalTopicCandidate): { fileName: string; content: string } {
  const date = new Date().toISOString().slice(0, 10)
  const category = topic.category ?? 'galchan'
  const categoryLabel = CATEGORY_LABEL[category] ?? category

  const safeTitle = topic.title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50)

  const fileName = `${date}_${safeTitle}.md`
  const sourceUrlLine = topic.sourceUrl ? `\nsourceUrl: "${topic.sourceUrl}"` : ''

  const content = `---
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
  return { fileName, content }
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { topic } = await req.json() as { topic: GalTopicCandidate }
    const { fileName, content } = buildTopicMd(topic)

    // ── ローカルWindows: ファイルシステムに直接保存 ──────────────────────────
    if (process.platform === 'win32') {
      const vaultPath = process.env.OBSIDIAN_VAULT_PATH
      if (vaultPath) {
        const fs = await import('fs')
        const path = await import('path')
        const dir = path.join(vaultPath, 'ネタ候補')
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const filePath = path.join(dir, fileName)
        fs.writeFileSync(filePath, content, 'utf-8')
        return NextResponse.json({ ok: true, filePath, fileName })
      }
    }

    // ── Vercel等: MDコンテンツをそのまま返す（フロントでダウンロード）───────
    return NextResponse.json({ ok: true, fileName, content, downloadMode: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'エラー: ' + msg }, { status: 500 })
  }
}
