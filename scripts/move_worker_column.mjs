// 動画管理表の「ワーカーへメッセージ」列（P列）を「固定コメント」列（M列）の隣に移動
// M=固定コメ / N=(ワーカー新) / O=視聴維持率 / P=切り口 / Q=動画企画型

import { google } from 'googleapis'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
  if (m && !line.trim().startsWith('#')) {
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    process.env[m[1]] = val
  }
}

const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI)
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
const sheets = google.sheets({ version: 'v4', auth })

const mgmtSheetId = process.env.SPREADSHEET_ID_GALCHAN

// Find sheet tab "自分チャンネル・動画管理表"
const meta = await sheets.spreadsheets.get({ spreadsheetId: mgmtSheetId })
const targetSheet = meta.data.sheets.find(s => s.properties.title === '自分チャンネル・動画管理表')
if (!targetSheet) {
  console.error('動画管理表シート見つからず')
  process.exit(1)
}
const sheetId = targetSheet.properties.sheetId
console.log('対象シートID:', sheetId)

// Verify current header at row 10
const headerCheck = await sheets.spreadsheets.values.get({ spreadsheetId: mgmtSheetId, range: '自分チャンネル・動画管理表!A10:S10' })
console.log('現状ヘッダー (row10):')
headerCheck.data.values?.[0]?.forEach((v, i) => {
  console.log(`  ${String.fromCharCode(65 + i)} (idx ${i}): ${v}`)
})

// Move column P (index 15) before column N (index 13)
// Using moveDimension: source startIndex=15, endIndex=16; destinationIndex=13
const res = await sheets.spreadsheets.batchUpdate({
  spreadsheetId: mgmtSheetId,
  requestBody: {
    requests: [
      {
        moveDimension: {
          source: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 15, // P (0-indexed)
            endIndex: 16,
          },
          destinationIndex: 13, // N
        },
      },
    ],
  },
})
console.log('✅ moveDimension 実行完了')

// Verify new header
const afterCheck = await sheets.spreadsheets.values.get({ spreadsheetId: mgmtSheetId, range: '自分チャンネル・動画管理表!A10:S10' })
console.log('\n移動後ヘッダー (row10):')
afterCheck.data.values?.[0]?.forEach((v, i) => {
  console.log(`  ${String.fromCharCode(65 + i)} (idx ${i}): ${v}`)
})
