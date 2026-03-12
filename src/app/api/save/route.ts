/**
 * 保存ファイル生成API
 * - idea.md     : Obsidian ネタ保存
 * - script.txt  : Obsidian 台本保存
 * - materials.json : スプシ・動画管理連携データ
 * - csv.tsv     : YMM4連携（話者/本文/空欄/SE）
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import type { GalTopicCandidate, ScriptStyle, GalMaterials, SavedFiles } from '@/lib/types'
import { SCRIPT_STYLE_LABELS } from '@/lib/types'

export const runtime = 'nodejs'

// ── SE マッピング ──────────────────────────────────────────────────────────────
const SE_MAP: Record<string, string> = {
  ナレーション: '',
  タイトル: 'se_title',
  イッチ: 'se_main',
  スレ民1: 'se_reply',
  スレ民2: 'se_reply',
  スレ民3: 'se_reply',
  スレ民4: 'se_reply',
  スレ民5: 'se_reply',
  スレ民6: 'se_reply',
}

// ── TSV生成 ───────────────────────────────────────────────────────────────────
function scriptToTsv(script: string): string {
  const lines = script.split('\n').filter((l) => l.trim())
  const rows: string[] = []

  for (const line of lines) {
    const match = line.match(/^【(.+?)】(.+)$/)
    if (!match) continue
    const speaker = match[1].trim()
    const text = match[2].trim()
    const se = SE_MAP[speaker] ?? ''
    rows.push(`${speaker}\t${text}\t\t${se}`)
  }

  return rows.join('\n')
}

// ── idea.md 生成 ──────────────────────────────────────────────────────────────
function buildIdeaMd(
  topic: GalTopicCandidate,
  style: ScriptStyle,
  serialNumber?: string,
): string {
  const date = new Date().toISOString().slice(0, 10)
  const styleLabel = SCRIPT_STYLE_LABELS[style]

  return `---
date: ${date}
style: ${styleLabel}
serial: ${serialNumber ?? ''}
tags: [ネタ, ガルちゃん, ${styleLabel}]
---

# ${topic.title}

## 概要
${topic.description}

## 切り口
${topic.angle}

## 感情ワード
${topic.emotionWords.map((w) => `- ${w}`).join('\n')}
${topic.source ? `\n## 参考\n${topic.source}` : ''}
`
}

// ── script.txt 生成 ───────────────────────────────────────────────────────────
function buildScriptTxt(
  script: string,
  topic: GalTopicCandidate,
  style: ScriptStyle,
  materials: GalMaterials,
): string {
  const date = new Date().toISOString().slice(0, 10)
  const styleLabel = SCRIPT_STYLE_LABELS[style]

  const titleSection = materials.titles
    .map((t, i) => `タイトル案${i + 1}：${t}`)
    .join('\n')

  return `---
date: ${date}
style: ${styleLabel}
serial: ${materials.serialNumber ?? ''}
---

# ${topic.title}

${titleSection}

---

${script}
`
}

// ── materials.json 生成 ───────────────────────────────────────────────────────
function buildMaterialsJson(
  topic: GalTopicCandidate,
  style: ScriptStyle,
  materials: GalMaterials,
): string {
  const date = new Date().toISOString().slice(0, 10)
  const obj = {
    date,
    serialNumber: materials.serialNumber ?? '',
    style: SCRIPT_STYLE_LABELS[style],
    topicTitle: topic.title,
    titles: materials.titles,
    thumbnails: materials.thumbnails,
    description: materials.description,
    metaTags: materials.metaTags,
    pinComment: materials.pinComment,
    productList: materials.productList ?? [],
  }
  return JSON.stringify(obj, null, 2)
}

// ── Obsidian管理ファイル生成（Dataview対応フロントマター）──────────────────────
function buildObsidianMasterMd(
  topic: GalTopicCandidate,
  style: ScriptStyle,
  script: string,
  materials: GalMaterials,
): string {
  const date = new Date().toISOString().slice(0, 10)
  const styleLabel = SCRIPT_STYLE_LABELS[style]
  const serial = materials.serialNumber ?? ''

  const productSection = materials.productList && materials.productList.length > 0
    ? `\n## 商品リスト\n\n| 商品名 | カテゴリ | Amazonリンク |\n|---|---|---|\n` +
      materials.productList.map((p) =>
        `| ${p.name} | ${p.category} | ${p.amazonLink || '（未入力）'} |`
      ).join('\n') + '\n'
    : ''

  return `---
serial: "${serial}"
date: ${date}
style: ${styleLabel}
topic: "${topic.title}"
titles:
${materials.titles.map((t) => `  - "${t}"`).join('\n')}
thumbnails:
${materials.thumbnails.map((t) => `  - "${t}"`).join('\n')}
tags: [ガルちゃん, ${styleLabel}]
status: 下書き
---

# ${topic.title}

## タイトル案
${materials.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## サムネ文言
${materials.thumbnails.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## 概要欄
${materials.description}

## タグ
${materials.metaTags}

## 固定コメント
${materials.pinComment}
${productSection}
## 台本

${script}
`
}

// ── メインハンドラ ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const {
      topic,
      style,
      script,
      materials,
    }: {
      topic: GalTopicCandidate
      style: ScriptStyle
      script: string
      materials: GalMaterials
    } = await req.json()

    const files: SavedFiles = {
      ideaMd: buildIdeaMd(topic, style, materials.serialNumber),
      scriptTxt: buildScriptTxt(script, topic, style, materials),
      materialsJson: buildMaterialsJson(topic, style, materials),
      csvTsv: scriptToTsv(script),
    }

    // Windows ローカル環境の場合はObsidianに書き込む
    if (process.platform === 'win32' && process.env.OBSIDIAN_VAULT_PATH) {
      try {
        const { writeFileSync, mkdirSync } = await import('fs')
        const { join } = await import('path')
        const vaultPath = process.env.OBSIDIAN_VAULT_PATH
        const serial = materials.serialNumber?.replace(/[【】]/g, '') ?? 'tmp'
        // タイトルのファイル名に使えない文字を除去
        const safeTitle = topic.title.replace(/[\\/:*?"<>|【】]/g, '').slice(0, 40)
        const dir = join(vaultPath, 'ガルちゃん')

        mkdirSync(dir, { recursive: true })

        // 1ファイルに全データをまとめたマスターファイル（Dataview対応）
        const masterMd = buildObsidianMasterMd(topic, style, script, materials)
        writeFileSync(join(dir, `${serial}_${safeTitle}.md`), masterMd, 'utf-8')
      } catch (e) {
        console.warn('Obsidian local write skipped:', e)
      }
    }

    return NextResponse.json({ success: true, files })
  } catch (err) {
    console.error('save error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
