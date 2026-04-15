import { google } from 'googleapis'
import { readFileSync } from 'fs'

// Load .env.local manually
const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const SPREADSHEET_ID = '11Vulc9rWw-RnRcoi_jbWgs58h8pff_Aa4RWO1gBPhnc'
const TSV_PATH = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/台本/【自ガル8台本】更年期セルフケア習慣_20260411_商品リスト.tsv'

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
)
oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
const sheets = google.sheets({ version: 'v4', auth: oauth2 })

const tsv = readFileSync(TSV_PATH, 'utf8').trimEnd()
const rows = tsv.split('\n').map(line => line.split('\t'))
console.log(`TSV rows: ${rows.length} (header + ${rows.length - 1} products)`)

// Build rows with No. column prepended (skip header's first cell)
const headerOut = ['No.', ...rows[0]]
const dataOut = rows.slice(1).map((r, i) => [i + 1, ...r])
const all = [headerOut, ...dataOut]

// List sheets in the spreadsheet first
const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
console.log('Sheets:', meta.data.sheets.map(s => s.properties.title).join(' | '))

const SHEET = process.env.TARGET_SHEET || '商品リスト'

// Add the sheet if missing
const existing = meta.data.sheets.map(s => s.properties.title)
if (!existing.includes(SHEET)) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
  })
  console.log(`Added sheet: ${SHEET}`)
} else {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET}!A1:H1000`,
  })
  console.log('Cleared existing data.')
}

// Write new data
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: `${SHEET}!A1`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: all },
})
console.log(`Wrote ${all.length} rows.`)

// Read back for verification
const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `${SHEET}!A1:H${all.length}`,
})
const got = verify.data.values || []
console.log(`Verified: ${got.length} rows back`)
console.log('First product row:', got[1]?.slice(0, 5).join(' | '))
console.log('Last product row:', got[got.length - 1]?.slice(0, 5).join(' | '))
