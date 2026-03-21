/**
 * 保存ファイル生成API
 * - idea.md     : Obsidian ネタ保存
 * - script.txt  : Obsidian 台本保存
 * - materials.json : スプシ・動画管理連携データ
 * - csv.tsv     : YMM4連携（A=話者 / B=本文 / C=SE）
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import type { GalTopicCandidate, ScriptStyle, GalMaterials, SavedFiles } from '@/lib/types'
import { SCRIPT_STYLE_LABELS } from '@/lib/types'
import { uploadTsvToDrive } from '@/lib/google'
import { dropboxUpload, isDropboxAvailable } from '@/lib/dropbox'

export const runtime = 'nodejs'

// ── SE除外話者 ────────────────────────────────────────────────────────────────
const NO_SE_SPEAKERS = new Set(['ナレーション', 'タイトル'])
const SE_INTERVAL = 10

// ── TSV変換（タブ区切り → 3列: A=話者 / B=本文 / C=SE）─────────────────────
// Gemini出力形式: 話者\t本文\t（3列目は空欄）
// SE列は自動付与（ナレーション/タイトル以外の10発言ごとにSE1→SE2交互）
// キーワード列は廃止（galchan_auto.pyでGemini APIが自動生成）
function scriptToTsv(script: string): string {
  const lines = script.split('\n').filter((l) => l.trim())
  const rows: string[] = []
  let utteranceCount = 0
  let seIndex = 0

  for (const line of lines) {
    const cols = line.split('\t')
    if (cols.length < 2) continue
    const speaker = cols[0].trim()
    const text = cols[1].trim()
    if (!speaker || !text) continue

    let se = ''
    if (!NO_SE_SPEAKERS.has(speaker)) {
      utteranceCount++
      if (utteranceCount >= SE_INTERVAL) {
        se = seIndex % 2 === 0 ? 'SE1' : 'SE2'
        seIndex++
        utteranceCount = 0
      }
    }
    rows.push(`${speaker}\t${text}\t${se}`)
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

// ── Obsidian管理ファイル生成（Dataview対応・動画管理シート列構成に対応）──────
function buildObsidianMasterMd(
  topic: GalTopicCandidate,
  style: ScriptStyle,
  script: string,
  materials: GalMaterials,
): string {
  const date = new Date().toISOString().slice(0, 10)
  const styleLabel = SCRIPT_STYLE_LABELS[style]
  const serial = materials.serialNumber ?? ''

  // 商品リストセクション（商品スタイル時のみ）
  const productSection = materials.productList && materials.productList.length > 0
    ? `\n## 商品リスト\n\n| No. | 商品名 | カテゴリ | 商品リンク |\n|---|---|---|---|\n` +
      materials.productList.map((p, i) =>
        `| ${i + 1} | ${p.name} | ${p.category} |  |`
      ).join('\n') + '\n'
    : ''

  // 動画管理シートの列構成に対応したフォーマット
  return `---
serial: "${serial}"
date: ${date}
style: ${styleLabel}
topic: "${topic.title}"
angle: "${topic.angle}"
titles:
${materials.titles.map((t) => `  - "${t}"`).join('\n')}
thumbnails:
${materials.thumbnails.map((t) => `  - "${t}"`).join('\n')}
tags: [ガルちゃん, ${styleLabel}]
status: 下書き
spreadsheet_url: ""
---

# ${topic.title}

## テーマ
${topic.title}

## 切り口
${topic.angle}

## 動画企画の型
${styleLabel}

## タイトル案
${materials.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## サムネ文言
${materials.thumbnails.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## 概要欄
${materials.description}

## メタタグ
${materials.metaTags}

## 固定コメント
${materials.pinComment}
${productSection}
## 台本リンク
（Sheetsに保存後にURLをここに入力）

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

    // TSVファイル名: 【自ガルN台本】タイトル_YYYYMMDD.tsv
    const serial = materials.serialNumber ?? '【自ガル0】'
    const scriptName = serial.replace('】', '台本】') // 【自ガル1台本】
    const safeTitle = topic.title.replace(/[\\/:*?"<>|【】]/g, '').trim().slice(0, 40)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const tsvFilename = `${scriptName}${safeTitle}_${dateStr}.tsv`

    const files: SavedFiles = {
      ideaMd: buildIdeaMd(topic, style, materials.serialNumber),
      scriptTxt: buildScriptTxt(script, topic, style, materials),
      materialsJson: buildMaterialsJson(topic, style, materials),
      csvTsv: scriptToTsv(script),
      tsvFilename,
    }

    // Obsidian保存: Windows→直接書き込み / Vercel→Dropbox経由
    const cleanSerial = serial.replace(/[【】]/g, '')
    const scriptFilename = tsvFilename.replace(/\.tsv$/, '.md')
    const masterMd = buildObsidianMasterMd(topic, style, script, materials)

    if (process.platform === 'win32' && process.env.OBSIDIAN_VAULT_PATH) {
      try {
        const { writeFileSync, mkdirSync } = await import('fs')
        const { join } = await import('path')
        const vaultPath = process.env.OBSIDIAN_VAULT_PATH

        // ① ガルネタフォルダ: マスターファイル（Dataview対応・全情報入り）
        const netatDir = join(vaultPath, 'ガルネタ')
        mkdirSync(netatDir, { recursive: true })
        writeFileSync(join(netatDir, `${cleanSerial}_${safeTitle}.md`), masterMd, 'utf-8')

        // ② 台本フォルダ: 台本テキストのみ（YMM4作業用・見やすい）
        const scriptDir = join(vaultPath, '台本')
        mkdirSync(scriptDir, { recursive: true })
        writeFileSync(join(scriptDir, scriptFilename), files.scriptTxt, 'utf-8')
      } catch (e) {
        console.warn('Obsidian local write skipped:', e)
      }
    } else if (isDropboxAvailable()) {
      // Vercel環境: Dropbox経由でObsidianに同期
      try {
        await dropboxUpload(`ガルネタ/${cleanSerial}_${safeTitle}.md`, masterMd)
        await dropboxUpload(`台本/${scriptFilename}`, files.scriptTxt)
      } catch (e) {
        console.warn('Dropbox Obsidian upload skipped:', e)
      }
    }

    // Google Drive へ TSV をアップロード（FOLDER_ID_GALCHAN が設定されている場合）
    let driveUrl: string | null = null
    if (process.env.FOLDER_ID_GALCHAN) {
      try {
        const { url } = await uploadTsvToDrive(tsvFilename, files.csvTsv)
        driveUrl = url
      } catch (e) {
        console.warn('Drive TSV upload skipped:', e)
      }
    }

    return NextResponse.json({ success: true, files, driveUrl })
  } catch (err) {
    console.error('save error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
