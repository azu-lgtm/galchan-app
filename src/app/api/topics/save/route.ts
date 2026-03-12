import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import type { GalTopicCandidate } from '@/lib/types'

export const runtime = 'nodejs'

const CATEGORY_LABEL: Record<string, string> = {
  galchan:     'ガルちゃんネタ',
  trends:      'トレンドネタ',
  competitors: '競合ネタ',
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.platform !== 'win32') {
    return NextResponse.json({ error: 'Obsidian保存はWindows環境でのみ動作します' }, { status: 503 })
  }

  const vaultPath = process.env.OBSIDIAN_VAULT_PATH
  if (!vaultPath) {
    return NextResponse.json({ error: 'OBSIDIAN_VAULT_PATH が未設定です' }, { status: 503 })
  }

  try {
    const { topic } = await req.json() as { topic: GalTopicCandidate }
    const fs = await import('fs')
    const path = await import('path')

    const date = new Date().toISOString().slice(0, 10)
    const category = topic.category ?? 'galchan'
    const categoryLabel = CATEGORY_LABEL[category] ?? category

    // ファイル名をサニタイズ（OS非対応文字を除去）
    const safeTitle = topic.title
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50)

    const fileName = `${date}_${safeTitle}.md`
    const dir = path.join(vaultPath, 'ネタ候補')

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const filePath = path.join(dir, fileName)

    const content = `---
date: ${date}
category: ${categoryLabel}
status: 未投稿
topic: "${topic.title.replace(/"/g, '\\"')}"
angle: "${topic.angle.replace(/"/g, '\\"')}"
tags: [ガルちゃん, ${categoryLabel}, 未投稿]
---

# ${topic.title}

## 概要
${topic.description}

## 切り口
${topic.angle}

## 感情ワード
${topic.emotionWords.map(w => `- ${w}`).join('\n')}
${topic.source ? `\n## 参考\n${topic.source}` : ''}

---
*保存日: ${date}*
`

    fs.writeFileSync(filePath, content, 'utf-8')

    return NextResponse.json({ ok: true, filePath })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'ファイル書き込みエラー: ' + msg }, { status: 500 })
  }
}
