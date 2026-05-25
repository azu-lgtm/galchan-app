/**
 * azu判断「案D」反映:
 *  Row 29 (@yuueki-angel) はそのまま残し、登録者数/動画本数/素材を最新値に上書き
 *  D29: 4.1万 → 4.29万
 *  I29: 351 → 414
 *  G29: イラスト人 → いらすとや系イラスト人 / 白枠4枚（ピンク背景）
 */
import { readFile } from 'fs/promises'
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

const SHEET = '競合チャンネル・動画管理表'

// 操作前
const before = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `'${SHEET}'!A29:L29`,
})
console.log('=== 操作前 Row 29 ===')
console.log(JSON.stringify(before.data.values?.[0]?.map(c => (c ?? '').toString().slice(0, 80)), null, 2))

// 3セル個別更新
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: `'${SHEET}'!D29`, values: [['4.29万']] },
      { range: `'${SHEET}'!G29`, values: [['いらすとや系イラスト人 / 白枠4枚（ピンク背景）']] },
      { range: `'${SHEET}'!I29`, values: [['414']] },
    ],
  },
})
console.log('\n✅ Updated D29 / G29 / I29')

// 読み戻し
const after = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `'${SHEET}'!A29:L29`,
})
console.log('\n=== 操作後 Row 29 ===')
console.log(JSON.stringify(after.data.values?.[0]?.map(c => (c ?? '').toString().slice(0, 80)), null, 2))

const r = after.data.values?.[0] ?? []
const checks = [
  ['C29 名前維持', r[2] === '有益天使ガルちゃんまとめ'],
  ['D29 = 4.29万', r[3] === '4.29万'],
  ['G29 = 詳細素材', r[6]?.includes('いらすとや') && r[6]?.includes('白枠4枚')],
  ['I29 = 414', r[8] === '414'],
  ['B29 = チャンネルURL維持', r[1]?.includes('@yuueki-angel')],
]
console.log('\n=== 整合性チェック ===')
for (const [name, ok] of checks) console.log(`${ok ? '✅' : '❌'} ${name}`)
const allOk = checks.every(c => c[1])
console.log(allOk ? '\n🎉 全PASS' : '\n⚠️ FAILあり')

// Row 30 (サブ行) も影響受けてないか確認
const sub = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `'${SHEET}'!A30:L30`,
})
const sr = sub.data.values?.[0] ?? []
console.log('\n=== Row 30 サブ行 維持確認 ===')
const subOk = (sr[0] || '') === '' && (sr[2] || '') === '' && (sr[9] || '').includes('nM8F_Ixe4rM')
console.log(`${subOk ? '✅' : '❌'} Row 30 サブ行（A-I空白・J=動画URL）維持`)
