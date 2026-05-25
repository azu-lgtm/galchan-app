/**
 * azu判断「案A」反映: URL #2 (@lgirls-life-yueki) 重複処理
 *  - Row 39 (俺が誤って追加した重複) を削除
 *  - Row 32 (既存・@lgirls-life-yueki) はそのまま
 *  - Row 33 に空白行挿入 → J=動画URL / K=サムネ要約 / L=タイトル のみ埋める
 *    (URL #1のRow 29→Row 30 と同じパターン)
 *
 * 削除→挿入の順序:
 *  1) Row 39 削除 → 後続行 上にシフト
 *  2) Row 33 に空白行挿入 → 後続行 下にシフト
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

const SHEET_NAME = '競合チャンネル・動画管理表'
const SHEET_ID = 366488006

// 操作前確認
console.log('=== 操作前 Row 32 + Row 39 ===')
const before = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `'${SHEET_NAME}'!A30:L40`,
})
for (let i = 0; i < (before.data.values?.length ?? 0); i++) {
  const cells = before.data.values[i].slice(0, 12).map(c => (c ?? '').toString().replace(/\n/g, ' / ').slice(0, 50))
  console.log(`R${30 + i}: ${JSON.stringify([cells[1], cells[2], cells[3]])}`)
}

// === Step 1: 旧Row 39 削除 ===
console.log('\n=== Step 1: Row 39 削除（重複） ===')
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: {
    requests: [{
      deleteDimension: {
        range: { sheetId: SHEET_ID, dimension: 'ROWS', startIndex: 38, endIndex: 39 },
      },
    }],
  },
})
console.log('✅ Row 39 deleted')

// === Step 2: Row 33 の位置に空白行を挿入 ===
console.log('\n=== Step 2: Row 33 の位置に空白行を挿入 ===')
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: {
    requests: [{
      insertDimension: {
        range: { sheetId: SHEET_ID, dimension: 'ROWS', startIndex: 32, endIndex: 33 },
        inheritFromBefore: false,
      },
    }],
  },
})
console.log('✅ Row 33 inserted')

// === Step 3: 新Row 33 に J/K/L 書き込み ===
console.log('\n=== Step 3: 新Row 33 に動画リンク/サムネ/タイトル書き込み ===')
const subRow = [
  '', '', '', '', '', '', '', '', '', // A-I 空
  'https://youtu.be/A_ILsxCO7Z4',  // J: 動画リンク (89,836再生のHKCWV27Pau4ではなく、サムネ実物確認済のA_ILsxCO7Z4=67,654再生)
  'みんな騙されてる、払わなくていいお金（家電延長保証2700円のぼったくり、ドコモ/au/SoftBank/楽天Mobile魔法の1言で解決、結婚式/葬式の慣習）', // K
  '【有益スレ】知らないと一生カモにされる。実は払わなくていいお金まとめ', // L
]
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: `'${SHEET_NAME}'!A33:L33`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [subRow] },
})
console.log('✅ Row 33 filled')

// === Step 4: 読み戻し検証 ===
console.log('\n=== Step 4: 読み戻し検証（Row 32-34 + Row 38付近） ===')
const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `'${SHEET_NAME}'!A32:L40`,
})
for (let i = 0; i < (verify.data.values?.length ?? 0); i++) {
  const rowNum = 32 + i
  const cells = verify.data.values[i].slice(0, 12).map(c => (c ?? '').toString().replace(/\n/g, ' / ').slice(0, 50))
  console.log(`R${rowNum}: B=${JSON.stringify(cells[1])} C=${JSON.stringify(cells[2])} J=${JSON.stringify(cells[9])}`)
}

const rows = verify.data.values ?? []
const r32 = rows[0] ?? []
const r33 = rows[1] ?? []
const checks = [
  ['Row 32 = @lgirls-life-yueki 既存維持', r32[2] === '有益ガールズライフ'],
  ['Row 33 A-I 空白', (r33[0] || '') === '' && (r33[2] || '') === ''],
  ['Row 33 J = 動画URL', (r33[9] || '').includes('A_ILsxCO7Z4')],
  ['Row 33 L = 動画タイトル', (r33[11] || '').includes('知らないと一生カモ')],
  ['Row 39 重複行 消えてる', !rows.some(r => r[2] === '有益ガールズライフ' && r[3] === '3.16万')],
]
console.log('\n=== 整合性チェック ===')
for (const [name, ok] of checks) console.log(`${ok ? '✅' : '❌'} ${name}`)
const allOk = checks.every(c => c[1])
console.log(allOk ? '\n🎉 全PASS' : '\n⚠️ FAILあり')
