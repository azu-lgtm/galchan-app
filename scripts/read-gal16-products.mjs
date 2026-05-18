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

const spreadsheetId = '1fmEuE-hm3dHN479LYL31g9VBYi2PncOiQyBwkPJ91Ls'

// Get list of sheets
const meta = await sheets.spreadsheets.get({ spreadsheetId })
const sheetNames = meta.data.sheets.map(s => s.properties.title)
console.log('Sheets:', JSON.stringify(sheetNames))

// Try to find product list sheet
for (const sn of sheetNames) {
  if (sn.includes('商品') || sn.includes('product') || sn.toLowerCase().includes('product')) {
    console.log(`\n=== Product sheet found: ${sn} ===`)
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sn}!A1:F50`,
    })
    const rows = res.data.values ?? []
    console.log(`Total rows: ${rows.length}`)
    rows.forEach((row, i) => {
      console.log(`Row ${i + 1}:`, row.map(c => (c ?? '').slice(0, 60)))
    })
  }
}

// Also print first sheet structure to find row 41 context
const main = sheetNames[0]
console.log(`\n=== Main sheet: ${main} (rows 38-44 column A-F) ===`)
const main_res = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: `${main}!A38:N44`,
})
;(main_res.data.values ?? []).forEach((row, i) => {
  console.log(`Row ${38 + i}:`, (row ?? []).map(c => (c ?? '').slice(0, 40)))
})
