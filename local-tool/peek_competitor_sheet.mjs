import { readFile, writeFile } from 'fs/promises'
import { google } from 'googleapis'

let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8')
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1)
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || !line.includes('=') || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  let v = line.slice(eq + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env[line.slice(0, eq).trim()] = v
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID_GALCHAN
const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
const sheets = google.sheets({ version: 'v4', auth })

const sheetNames = ['競合チャンネル・動画管理表', '競合チャンネル・動画管理表 のコピー']
const trunc = (s, n=120) => {
  const t = (s ?? '').toString().replace(/\r?\n/g, ' / ').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}

let out = ''
for (const name of sheetNames) {
  out += `\n===== Sheet: "${name}" =====\n`
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${name}'!A1:AC100`,
  })
  const rows = r.data.values ?? []
  out += `Total rows fetched: ${rows.length}\n`
  out += `Max cols seen: ${Math.max(0, ...rows.map(r => r.length))}\n\n`

  out += '--- Rows 1-5 (truncated 120ch/cell) ---\n'
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    out += `Row ${i+1}: [${rows[i].map(c => trunc(c)).map(c => JSON.stringify(c)).join(', ')}]\n`
  }

  // identify non-empty rows
  const nonEmpty = rows
    .map((r, i) => ({ r, i: i + 1 }))
    .filter(x => x.r.some(c => (c ?? '').toString().trim() !== ''))

  out += `\nNon-empty rows: ${nonEmpty.length} (indices: ${nonEmpty.map(x => x.i).join(',')})\n\n`
  out += '--- All non-empty rows from row 3+ — A,B,C,D,E,F,G,H short view (col 1-8) ---\n'
  for (const { r, i } of nonEmpty) {
    if (i < 3) continue
    const slice = r.slice(0, 12).map(c => trunc(c, 80))
    out += `R${i}: [${slice.map(c => JSON.stringify(c)).join(', ')}]\n`
  }
}

await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/discord-hub/.tmp/competitor_sheet_peek.txt', out, 'utf8')
console.log(out.slice(0, 8000))
console.log('\n... full output saved to .tmp/competitor_sheet_peek.txt')
