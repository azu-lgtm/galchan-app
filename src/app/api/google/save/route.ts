/**
 * Google Sheets保存API（台本スプレッドシート作成 + 動画管理シート追記）
 *
 * フロー:
 * 1. テンプレートスプレッドシートをコピーして新しいスプシを作成
 * 2. 台本シートにスクリプトデータを書き込む
 * 3. 商品スタイルなら商品リストシートに商品データを書き込む
 * 4. 動画管理シートに1行追記（テーマ・タイトル・概要欄・リンクなど）
 * 5. 新しいスプレッドシートのURLを返す
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import type { GalTopicCandidate, ScriptStyle, GalMaterials } from '@/lib/types'
import {
  copyScriptTemplate,
  fillScriptSheet,
  fillProductSheet,
  appendToManagementSheet,
  buildManagementRow,
} from '@/lib/google'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json(
      { error: 'Google OAuth未設定。GOOGLE_CLIENT_ID / GOOGLE_REFRESH_TOKEN を .env.local に設定してください。\nhttp://localhost:3001/api/oauth/authorize にアクセスして認証してください。' },
      { status: 503 },
    )
  }

  if (!process.env.SPREADSHEET_TEMPLATE_SCRIPT) {
    return NextResponse.json(
      { error: 'SPREADSHEET_TEMPLATE_SCRIPT が .env.local に未設定です。' },
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

    const serial = materials.serialNumber ?? 'tmp'
    // 【外ガル1】→ 外ガル1 → 台本名: 【外ガル1台本】
    const cleanSerial = serial.replace(/[【】]/g, '')
    const scriptName = serial ? serial.replace('】', '台本】') : '台本'

    // ── 1. テンプレートをコピーして新スプシ作成 ─────────────────────────────
    const { id: newSpreadsheetId, url: spreadsheetUrl } = await copyScriptTemplate(
      `${scriptName}`,
      style,
    )

    // ── 2. 台本シートにデータ書き込み ────────────────────────────────────────
    await fillScriptSheet(newSpreadsheetId, script)

    // ── 3. 商品スタイルなら商品リストシートにデータ書き込み ──────────────────
    if (style === 'product' && materials.productList && materials.productList.length > 0) {
      await fillProductSheet(newSpreadsheetId, materials.productList)
    }

    // ── 4. 動画管理シートに行追記 ────────────────────────────────────────────
    const managementRow = buildManagementRow(topic, style, materials, spreadsheetUrl)
    await appendToManagementSheet(managementRow)

    return NextResponse.json({
      success: true,
      spreadsheetUrl,
      message: `台本スプレッドシートを作成しました（${serial}）`,
    })
  } catch (err) {
    console.error('google/save error:', err)
    const msg = String(err)
    if (msg.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Google認証エラー。http://localhost:3001/api/oauth/authorize にアクセスして再認証してください。' },
        { status: 401 },
      )
    }
    return NextResponse.json(
      { error: 'Sheets保存に失敗しました: ' + msg },
      { status: 500 },
    )
  }
}
