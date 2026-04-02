/**
 * 動画管理シートのサムネ・タイトル・概要欄を更新する
 * POST /api/google/update-materials
 * Body: { serialNumber: "【自ガル5】", titles: [...], thumbnails: [...], description: "..." }
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { google } from 'googleapis'

export const runtime = 'nodejs'
export const maxDuration = 15

const SHEET_MANAGEMENT = '自分チャンネル・動画管理表'

function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return client
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { serialNumber, titles, thumbnails, description, metaTags, pinComment, workerMessage } = body

    if (!serialNumber) {
      return NextResponse.json({ error: 'serialNumber は必須です' }, { status: 400 })
    }

    const auth = getAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const spreadsheetId = process.env.SPREADSHEET_ID_GALCHAN ?? ''

    // F列（台本名）を読み取って該当行を特定
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_MANAGEMENT}!F:F`,
    })

    const values = res.data.values ?? []
    // serialNumber "【自ガル5】" → "【自ガル5台本】" で検索
    const searchName = serialNumber.replace('】', '台本】')
    let rowIndex = -1
    for (let i = 0; i < values.length; i++) {
      if (values[i][0] && values[i][0].includes(searchName)) {
        rowIndex = i + 1 // 1-indexed
        break
      }
    }

    if (rowIndex < 0) {
      return NextResponse.json({
        error: `「${searchName}」が見つかりません`,
        searched: values.slice(0, 30).map(r => r[0]),
      }, { status: 404 })
    }

    // I列（サムネ）、J列（タイトル）、K列（概要欄）を更新
    const updates: { range: string; values: string[][] }[] = []

    if (thumbnails?.[0]) {
      updates.push({ range: `${SHEET_MANAGEMENT}!I${rowIndex}`, values: [[thumbnails[0]]] })
    }
    if (titles?.[0]) {
      updates.push({ range: `${SHEET_MANAGEMENT}!J${rowIndex}`, values: [[titles[0]]] })
    }
    if (description) {
      updates.push({ range: `${SHEET_MANAGEMENT}!K${rowIndex}`, values: [[description]] })
    }
    if (metaTags) {
      updates.push({ range: `${SHEET_MANAGEMENT}!L${rowIndex}`, values: [[metaTags]] })
    }
    if (pinComment) {
      updates.push({ range: `${SHEET_MANAGEMENT}!M${rowIndex}`, values: [[pinComment]] })
    }
    if (workerMessage) {
      updates.push({ range: `${SHEET_MANAGEMENT}!N${rowIndex}`, values: [[workerMessage]] })
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: '更新するデータがありません' }, { status: 400 })
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates,
      },
    })

    return NextResponse.json({
      message: `行${rowIndex}（${searchName}）を更新しました`,
      rowIndex,
      updated: {
        thumbnail: thumbnails?.[0] ?? null,
        title: titles?.[0] ?? null,
        description: description ? '更新済み' : null,
        metaTags: metaTags ? '更新済み' : null,
        pinComment: pinComment ? '更新済み' : null,
        workerMessage: workerMessage ? '更新済み' : null,
      },
    })
  } catch (e) {
    console.error('update-materials error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '更新に失敗しました' },
      { status: 500 }
    )
  }
}
