/**
 * Google OAuth2 + Drive + Sheets helpers for galchan-app
 * ─ 台本スプレッドシートをテンプレートからコピーして台本データを書き込む
 * ─ 動画管理シートに行を追記する
 * Sheets/Drive操作 → 外注管理アカウント（5）で認証
 * OAuth Client → あずきアカウント（3）のGCP
 */
import { google } from 'googleapis'
import type { GalMaterials, ScriptStyle } from './types'
import { SCRIPT_STYLE_LABELS } from './types'

function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return client
}

// ── 定数 ───────────────────────────────────────────────────────────────────────
const SPREADSHEET_ID_GALCHAN = process.env.SPREADSHEET_ID_GALCHAN ?? ''
const TEMPLATE_SCRIPT         = process.env.SPREADSHEET_TEMPLATE_SCRIPT ?? ''
const TEMPLATE_SCRIPT_PRODUCTS = process.env.SPREADSHEET_TEMPLATE_SCRIPT_PRODUCTS ?? ''

// 動画管理シートのシート名
const SHEET_MANAGEMENT = '自分チャンネル・動画管理表'

// ── テンプレートスプレッドシートをコピー ────────────────────────────────────────
/**
 * Drive API でテンプレートをコピーして新しいスプレッドシートを作成する
 * @param name  新しいスプレッドシートの名前
 * @param style スタイル（商品の場合は商品リスト有りテンプレートを使用）
 * @returns { id, url }
 */
export async function copyScriptTemplate(
  name: string,
  style: ScriptStyle,
): Promise<{ id: string; url: string }> {
  const auth = getAuth()
  const drive = google.drive({ version: 'v3', auth })

  const templateId = style === 'product' ? TEMPLATE_SCRIPT_PRODUCTS : TEMPLATE_SCRIPT

  const res = await drive.files.copy({
    fileId: templateId,
    requestBody: { name },
  })

  const id = res.data.id!
  const url = `https://docs.google.com/spreadsheets/d/${id}/edit`
  return { id, url }
}

// ── 台本シートにスクリプトデータを書き込む ────────────────────────────────────
/**
 * コピーしたスプレッドシートの「台本」シートにデータを書き込む
 * テンプレートのサンプル行（row4以降）をクリアして上書き
 */
export async function fillScriptSheet(spreadsheetId: string, script: string): Promise<void> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  // 台本を行ごとに解析（【話者名】テキスト 形式）
  const lines = script.split('\n').filter(l => l.trim())
  const rows: (string | number)[][] = []

  for (const line of lines) {
    const m = line.match(/^【(.+?)】(.*)$/)
    if (!m) continue
    const speaker = m[1].trim()
    const text = m[2].trim()
    rows.push([speaker, text, text.length])
  }

  // row4以降のテンプレートデータをクリア
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: '台本!A4:C1000',
  })

  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: '台本!A4',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    })
  }
}

// ── 商品リストシートに商品データを書き込む ────────────────────────────────────
/**
 * コピーしたスプレッドシートの「商品リスト」シートにデータを書き込む
 */
export async function fillProductSheet(
  spreadsheetId: string,
  products: NonNullable<GalMaterials['productList']>,
): Promise<void> {
  if (products.length === 0) return

  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const rows = products.map((p, i) => [
    i + 1,    // No.
    p.name,   // 商品名
    '',       // 型番（代表例）← 後で手動入力
    '',       // 商品リンク   ← 後で手動入力
  ])

  // row2以降のテンプレートデータをクリア
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: '商品リスト!A2:D1000',
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: '商品リスト!A2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  })
}

// ── 動画管理シートに1行追記 ────────────────────────────────────────────────────
/**
 * 動画管理シート（自分チャンネル・動画管理表）に1行追記する
 *
 * 列マッピング（row10ヘッダーに対応）:
 *   A: 外注依頼  ← 空（手動入力）
 *   B: 納品期限  ← 空（手動入力）
 *   C: 納品      ← 空（手動入力）
 *   D: ダウン    ← 空（手動入力）
 *   E: 投稿日    ← 空（手動入力）
 *   F: 台本名    ← 【外ガルN台本】
 *   G: 台本リンク← コピーしたスプレッドシートのURL
 *   H: テーマ    ← topic.title
 *   I: サムネ    ← thumbnails[0]
 *   J: タイトル  ← titles[0]
 *   K: 概要欄    ← description
 *   L: メタタグ  ← metaTags
 *   M: 固定コメント ← pinComment
 *   N: 視聴維持率ピークの内容 ← 空（手動入力）
 *   O: 切り口    ← topic.angle
 *   P: 動画企画の型 ← style label
 */
export async function appendToManagementSheet(row: (string | null)[]): Promise<void> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID_GALCHAN,
    range: `${SHEET_MANAGEMENT}!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
}

// ── 動画管理シート用の行を組み立てる ──────────────────────────────────────────
export function buildManagementRow(
  topic: { title: string; angle: string },
  style: ScriptStyle,
  materials: GalMaterials,
  scriptSpreadsheetUrl: string,
): (string | null)[] {
  const serial = materials.serialNumber ?? ''
  // 【外ガル1】→【外ガル1台本】
  const scriptName = serial ? serial.replace('】', '台本】') : '台本'
  const styleLabel = SCRIPT_STYLE_LABELS[style]

  return [
    null,                           // A: 外注依頼（手動）
    null,                           // B: 納品期限（手動）
    null,                           // C: 納品（手動）
    null,                           // D: ダウン（手動）
    null,                           // E: 投稿日（手動）
    scriptName,                     // F: 台本名
    scriptSpreadsheetUrl,           // G: 台本リンク
    topic.title,                    // H: テーマ
    materials.thumbnails[0] ?? '',  // I: サムネ
    materials.titles[0] ?? '',      // J: タイトル
    materials.description,          // K: 概要欄
    materials.metaTags,             // L: メタタグ
    materials.pinComment,           // M: 固定コメント
    null,                           // N: 視聴維持率ピーク（手動）
    topic.angle,                    // O: 切り口
    styleLabel,                     // P: 動画企画の型
  ]
}
