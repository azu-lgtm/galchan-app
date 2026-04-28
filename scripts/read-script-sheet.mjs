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

const target = process.argv[2]
const ids = {
  gal8: '11Vulc9rWw-RnRcoi_jbWgs58h8pff_Aa4RWO1gBPhnc',
  gal9: '1vzAeBpDJXOBzKyNhiBWA1xEcVA1vPGOLZZNtNehTgNg',
}
const spreadsheetId = ids[target] || target

// Get list of sheets
const meta = await sheets.spreadsheets.get({ spreadsheetId })
const sheetNames = meta.data.sheets.map(s => s.properties.title)
console.log('Sheets:', sheetNames)

// Read main script sheet (usually first) first 15 rows
const sheet1 = sheetNames[0]
const res = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: `${sheet1}!A1:C15`,
})
console.log(`=== ${sheet1} A1:C15 ===`)
;(res.data.values ?? []).forEach((row, i) => {
  console.log(`Row ${i + 1}: [${(row[0] ?? '').padEnd(8)}] ${(row[1] ?? '').slice(0, 100)}`)
})

// Read Sheet2 (products) row count
if (sheetNames.length > 1) {
  const sheet2 = sheetNames[1]
  const res2 = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheet2}!A1:F100`,
  })
  const rows2 = res2.data.values ?? []
  console.log(`=== ${sheet2} (${rows2.length} rows) ===`)
  rows2.slice(0, 3).forEach((row, i) => {
    console.log(`Row ${i + 1}:`, row.slice(0, 4).map(c => (c ?? '').slice(0, 40)))
  })
  console.log(`Last row ${rows2.length}:`, (rows2[rows2.length - 1] ?? []).slice(0, 4).map(c => (c ?? '').slice(0, 40)))
}
