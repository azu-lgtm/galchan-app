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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[m[1]] = val
  }
}

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
)
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })

const sheets = google.sheets({ version: 'v4', auth })
const spreadsheetId = process.env.SPREADSHEET_ID_GALCHAN

// Read header row (row 10) + last few rows
const res = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: '自分チャンネル・動画管理表!A10:Z50',
})

const rows = res.data.values ?? []
console.log('=== 自分チャンネル・動画管理表 A10:Z30 ===')
rows.forEach((row, i) => {
  console.log(`Row ${10 + i}:`)
  row.forEach((cell, j) => {
    const col = String.fromCharCode(65 + j)
    const preview = (cell ?? '').toString().slice(0, 80)
    console.log(`  ${col}: ${preview}`)
  })
  console.log('---')
})
