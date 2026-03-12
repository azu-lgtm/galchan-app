/**
 * Google OAuth2 + Sheets helpers for galchan-app
 * Sheets/Drive操作 → 外注管理アカウント（5）で認証
 * OAuth Client → あずきアカウント（3）のGCP
 */
import { google } from 'googleapis'

function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return client
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID_GALCHAN ?? ''

// ── シート名定数 ───────────────────────────────────────────────────────────────
export const SHEET_MANAGEMENT = '管理シート'   // タイトル/概要欄/素材一覧
export const SHEET_SCRIPT     = '台本'         // 台本全文
export const SHEET_PRODUCTS   = '商品リスト'   // 商品リスト（Amazonリンク付き）

// ── 管理シートに1行追記 ────────────────────────────────────────────────────────
export async function appendManagementRow(row: string[]) {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_MANAGEMENT}!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}

// ── 台本シートに1行追記 ────────────────────────────────────────────────────────
export async function appendScriptRow(row: string[]) {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_SCRIPT}!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })
}

// ── 商品リストシートに複数行追記 ──────────────────────────────────────────────
export async function appendProductRows(rows: string[][]) {
  if (rows.length === 0) return
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_PRODUCTS}!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  })
}

// ── シートの存在確認・なければ作成 ────────────────────────────────────────────
export async function ensureSheets() {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const existing = (res.data.sheets ?? []).map((s) => s.properties?.title ?? '')
  const needed = [SHEET_MANAGEMENT, SHEET_SCRIPT, SHEET_PRODUCTS]
  const missing = needed.filter((name) => !existing.includes(name))

  if (missing.length === 0) return

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: missing.map((title) => ({
        addSheet: { properties: { title } },
      })),
    },
  })

  // ヘッダー行を追加
  const headerUpdates = []
  if (missing.includes(SHEET_MANAGEMENT)) {
    headerUpdates.push({
      range: `${SHEET_MANAGEMENT}!A1`,
      values: [['採番', '投稿日', 'スタイル', 'ネタタイトル', 'タイトル案1', 'タイトル案2', 'タイトル案3', 'サムネ1', 'サムネ2', 'サムネ3', '概要欄', 'タグ', '固定コメント']],
    })
  }
  if (missing.includes(SHEET_SCRIPT)) {
    headerUpdates.push({
      range: `${SHEET_SCRIPT}!A1`,
      values: [['採番', '投稿日', 'スタイル', 'ネタタイトル', '台本']],
    })
  }
  if (missing.includes(SHEET_PRODUCTS)) {
    headerUpdates.push({
      range: `${SHEET_PRODUCTS}!A1`,
      values: [['採番', '投稿日', '商品名', 'カテゴリ', '台本引用', 'Amazonリンク', '楽天リンク']],
    })
  }

  if (headerUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: headerUpdates,
      },
    })
  }
}
