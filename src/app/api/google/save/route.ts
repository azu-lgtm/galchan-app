import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import type { GalTopicCandidate, ScriptStyle, GalMaterials } from '@/lib/types'
import { SCRIPT_STYLE_LABELS } from '@/lib/types'
import {
  ensureSheets,
  appendManagementRow,
  appendScriptRow,
  appendProductRows,
} from '@/lib/google'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json(
      { error: 'Google OAuth未設定。GOOGLE_CLIENT_ID / GOOGLE_REFRESH_TOKEN を .env.local に設定してください。' },
      { status: 503 },
    )
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

    const date = new Date().toISOString().slice(0, 10)
    const serial = materials.serialNumber ?? ''
    const styleLabel = SCRIPT_STYLE_LABELS[style]

    // シートが存在しない場合は作成（初回のみ）
    await ensureSheets()

    // ── 管理シートに追記 ──────────────────────────────────────────────────────
    await appendManagementRow([
      serial,
      date,
      styleLabel,
      topic.title,
      materials.titles[0] ?? '',
      materials.titles[1] ?? '',
      materials.titles[2] ?? '',
      materials.thumbnails[0] ?? '',
      materials.thumbnails[1] ?? '',
      materials.thumbnails[2] ?? '',
      materials.description,
      materials.metaTags,
      materials.pinComment,
    ])

    // ── 台本シートに追記 ──────────────────────────────────────────────────────
    await appendScriptRow([serial, date, styleLabel, topic.title, script])

    // ── 商品リストシートに追記（商品スタイルのみ）────────────────────────────
    if (style === 'product' && materials.productList && materials.productList.length > 0) {
      const productRows = materials.productList.map((p) => [
        serial,
        date,
        p.name,
        p.category,
        p.scriptQuote,
        p.amazonLink,
        p.rakutenLink,
      ])
      await appendProductRows(productRows)
    }

    return NextResponse.json({
      success: true,
      message: `スプレッドシートに保存しました（${serial}）`,
    })
  } catch (err) {
    console.error('google/save error:', err)
    const msg = String(err)
    if (msg.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Google認証エラー。GOOGLE_REFRESH_TOKENを再取得してください。' },
        { status: 401 },
      )
    }
    return NextResponse.json(
      { error: 'Sheets保存に失敗しました: ' + msg },
      { status: 500 },
    )
  }
}
