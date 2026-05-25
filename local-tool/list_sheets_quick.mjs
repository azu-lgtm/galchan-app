import { readFile } from 'fs/promises'
import { google } from 'googleapis'

let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8')
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1)
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || !line.includes('=') || line.startsWith('#')) continue
  const eqIdx = line.indexOf('=')
  const k = line.slice(0, eqIdx).trim()
  let v = line.slice(eqIdx + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env[k] = v
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID_GALCHAN

async function tryAuth() {
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return auth
}

async function main() {
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID_GALCHAN not set')
  const authClient = await tryAuth()
  const sheets = google.sheets({ version: 'v4', auth: authClient })
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  console.log('Spreadsheet:', meta.data.properties?.title)
  console.log('Sheets:')
  for (const s of meta.data.sheets ?? []) {
    const p = s.properties
    console.log(`  - "${p.title}" (id=${p.sheetId}, rows=${p.gridProperties?.rowCount}, cols=${p.gridProperties?.columnCount})`)
  }
}

main().catch(e => { console.error('ERR:', e?.message ?? e); process.exit(1) })
