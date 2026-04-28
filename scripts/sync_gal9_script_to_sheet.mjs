// 自ガル9 圧縮版台本をスプシ台本シートに同期
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

const scriptSheetId = '1vzAeBpDJXOBzKyNhiBWA1xEcVA1vPGOLZZNtNehTgNg'
const mdPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自ガル9台本】ドラッグストア_v3.md'

// Read Obsidian md
const md = fs.readFileSync(mdPath, 'utf8')
const lines = md.split('\n').filter(l => l.length > 0 || true) // keep all
// Remove trailing empty lines
while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()

// Parse TSV: each line is speaker\ttext\tSE
const rows = lines.map(line => {
  const parts = line.split('\t')
  return [parts[0] || '', parts[1] || '', parts[2] || '']
})

console.log(`パースした行数: ${rows.length}`)

// Script sheet structure: header rows 1-3 + content rows 4+
// Row 3 of script has "台本" header. Content starts row 4.
// Current state before sync = rows 4-231 approx (old 228 lines)
// New content = rows 4-(4+237-1) = 4-240

// Step 1: Clear existing content (rows 4-300 to be safe)
await sheets.spreadsheets.values.clear({
  spreadsheetId: scriptSheetId,
  range: '台本!A4:C300',
})
console.log('✅ 既存台本内容クリア')

// Step 2: Write new content starting row 4
const startRow = 4
const endRow = startRow + rows.length - 1
await sheets.spreadsheets.values.update({
  spreadsheetId: scriptSheetId,
  range: `台本!A${startRow}:C${endRow}`,
  valueInputOption: 'RAW',
  requestBody: { values: rows },
})
console.log(`✅ 台本シート 行${startRow}-${endRow}に${rows.length}行書き込み`)

// Step 3: Verify — read back and count
const verifyRange = await sheets.spreadsheets.values.get({
  spreadsheetId: scriptSheetId,
  range: `台本!A${startRow}:C${endRow}`,
})
const verifyRows = verifyRange.data.values || []
console.log(`書き戻し検証: ${verifyRows.length}行読み戻し`)

// Check first 3 and last 3 rows
console.log('\n=== 最初の3行 ===')
verifyRows.slice(0, 3).forEach((r, i) => {
  console.log(`Row ${startRow + i}: [${r[0]}] [${(r[1] || '').slice(0, 50)}] [${r[2] || ''}]`)
})

console.log('\n=== 最後の3行 ===')
verifyRows.slice(-3).forEach((r, i) => {
  const rn = startRow + verifyRows.length - 3 + i
  console.log(`Row ${rn}: [${r[0]}] [${(r[1] || '').slice(0, 50)}] [${r[2] || ''}]`)
})

// Character count
const verifyChars = verifyRows.reduce((sum, r) => sum + (r[0]?.length || 0) + (r[1]?.length || 0) + (r[2]?.length || 0), 0)
console.log(`\n書き戻し文字数（全列合計）: ${verifyChars}`)
