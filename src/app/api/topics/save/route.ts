import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { isDropboxAvailable, dropboxUpload, dropboxDownloadSafe } from '@/lib/dropbox'
import type { GalTopicCandidate } from '@/lib/types'

export const runtime = 'nodejs'

const CATEGORY_LABEL: Record<string, string> = {
  galchan:     'ガルちゃんネタ',
  trends:      'トレンドネタ',
  competitors: '競合ネタ',
}

const SHARED_FILE = 'ネタ候補/未投稿ネタ.md'

/** チェックリスト1行を生成 */
function buildChecklistLine(topic: GalTopicCandidate, date: string): string {
  const categoryLabel = CATEGORY_LABEL[topic.category ?? 'galchan'] ?? (topic.category ?? '')
  const urlPart = topic.sourceUrl ? `　🔗 ${topic.sourceUrl}` : ''
  return `- [ ] **${topic.title}**（${categoryLabel}）${date}${urlPart}\n`
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { topic } = await req.json() as { topic: GalTopicCandidate }
    const date = new Date().toISOString().slice(0, 10)
    const line = buildChecklistLine(topic, date)

    // ── ローカルWindows: 共有ファイルに追記 ──────────────────────────────────
    if (process.platform === 'win32') {
      const vaultPath = process.env.OBSIDIAN_VAULT_PATH
      if (vaultPath) {
        const fs = await import('fs')
        const path = await import('path')
        const dir = path.join(vaultPath, 'ネタ候補')
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const filePath = path.join(dir, '未投稿ネタ.md')
        const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '# ネタ候補 未投稿リスト\n\n'
        fs.writeFileSync(filePath, existing + line, 'utf-8')
        return NextResponse.json({ ok: true, filePath: `local:${filePath}`, topicTitle: topic.title })
      }
    }

    // ── Dropbox: 共有ファイルに追記 ──────────────────────────────────────────
    if (isDropboxAvailable()) {
      const existing = await dropboxDownloadSafe(SHARED_FILE)
      const base = existing.trim() ? existing : '# ネタ候補 未投稿リスト\n\n'
      await dropboxUpload(SHARED_FILE, base + line)
      return NextResponse.json({
        ok: true,
        dropboxMode: true,
        filePath: `dropbox:${SHARED_FILE}`,
        topicTitle: topic.title,
      })
    }

    // ── フォールバック: ブラウザダウンロード（個別MD）────────────────────────
    const categoryLabel = CATEGORY_LABEL[topic.category ?? 'galchan'] ?? ''
    const safeTitle = topic.title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 50)
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
    return NextResponse.json({ ok: true, fileName, content, downloadMode: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'エラー: ' + msg }, { status: 500 })
  }
}
