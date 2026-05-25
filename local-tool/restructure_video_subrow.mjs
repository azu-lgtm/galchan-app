/**
 * azu指示反映:
 *  - URL#1の動画はチャンネル(@yuueki-angel = Row 29)が既に登録済なので、
 *    Row 29の1個下(=Row 30)に空白行を挿入して、その行に動画リンク/サムネ/タイトルだけ埋める
 *  - 旧Row 38(誤って作ったチャンネル重複行)は削除する
 *  - Row 39(有益ガールズライフ新規チャンネル)は維持
 *
 * 手順:
 *  1) 旧Row 38(重複)を削除 → Row 39の有益ガールズライフはRow 38に上がる
 *  2) Row 30の位置に空白行を挿入 → 有益ガールズライフはRow 39に戻る
 *  3) 新Row 30に動画リンク(J)/サムネ(K)/タイトル(L)を書き込む
 *  4) 読み戻し検証
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
const SHEET_ID = 366488006 // メタ取得済 (id=366488006)

console.log('=== 操作前 確認 ===')
{
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A38:L39`,
  })
  console.log('Row 38-39 (操作前):')
  for (let i = 0; i < (r.data.values?.length ?? 0); i++) {
    const cells = r.data.values[i].slice(0, 12).map(c => (c ?? '').toString().replace(/\n/g, ' / ').slice(0, 60))
    console.log(`  R${38 + i}: ${JSON.stringify(cells)}`)
  }
}

// === Step 1: 旧Row 38(=index 37 in 0-based)を削除 ===
console.log('\n=== Step 1: Row 38 を削除（重複チャンネル行） ===')
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: {
    requests: [{
      deleteDimension: {
        range: {
          sheetId: SHEET_ID,
          dimension: 'ROWS',
          startIndex: 37, // 0-based → Row 38
          endIndex: 38,
        },
      },
    }],
  },
})
console.log('✅ Row 38 deleted (有益ガールズライフはRow 38に上がる)')

// === Step 2: Row 30の位置(=index 29)に空白行を挿入 ===
console.log('\n=== Step 2: Row 30 の位置に空白行を挿入 ===')
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: SPREADSHEET_ID,
  requestBody: {
    requests: [{
      insertDimension: {
        range: {
          sheetId: SHEET_ID,
          dimension: 'ROWS',
          startIndex: 29, // 0-based → Row 30
          endIndex: 30,
        },
        inheritFromBefore: false,
      },
    }],
  },
})
console.log('✅ Row 30 inserted (有益ガールズライフはRow 39に戻る)')

// === Step 3: 新Row 30 に J/K/L のみ書き込み ===
console.log('\n=== Step 3: 新Row 30 に動画リンク/サムネ/タイトル書き込み ===')
const subRow = [
  '', '', '', '', '', '', '', '', '', // A-I 空
  'https://youtu.be/nM8F_Ixe4rM?si=Zb0mUVLVn5d5b1xU',  // J: 動画リンク
  'ちょちょいと作る、美味しすぎる簡単料理（総集編）（〇〇ラップで冷凍上手、〇〇のタレが万能過ぎるw、〇〇チョッパーめっちゃ使える、手抜きなのに家族に好評）', // K
  '【有益スレ】料理がマジで楽になった⋯便利すぎるテクニックをガルちゃん民が伝授！［総集編］【ガルちゃん2chスレまとめ】', // L
]
await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: `'${SHEET_NAME}'!A30:L30`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [subRow] },
})
console.log('✅ Row 30 filled (J/K/L)')

// === Step 4: 読み戻し検証 ===
console.log('\n=== Step 4: 読み戻し検証 ===')
const verify = await sheets.spreadsheets.values.get({
  spreadsheetId: SPREADSHEET_ID,
  range: `'${SHEET_NAME}'!A29:L40`,
})
const rows = verify.data.values ?? []
for (let i = 0; i < rows.length; i++) {
  const rowNum = 29 + i
  const cells = rows[i].slice(0, 12).map(c => (c ?? '').toString().replace(/\n/g, ' / ').slice(0, 60))
  console.log(`R${rowNum}: ${JSON.stringify(cells)}`)
}

// 整合性ハードチェック
console.log('\n=== 整合性チェック ===')
const r29 = rows[0] ?? []
const r30 = rows[1] ?? []
const r39 = rows[10] ?? []
const checks = []
checks.push(['Row 29 = @yuueki-angel チャンネル維持', r29[2] === '有益天使ガルちゃんまとめ'])
checks.push(['Row 30 A-I 空白', (r30[0] || '') === '' && (r30[1] || '') === '' && (r30[2] || '') === ''])
checks.push(['Row 30 J = 動画URL', (r30[9] || '').includes('nM8F_Ixe4rM')])
checks.push(['Row 30 L = 動画タイトル', (r30[11] || '').includes('料理がマジで楽')])
checks.push(['Row 39 = 有益ガールズライフ', r39[2] === '有益ガールズライフ'])
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`)
}
const allOk = checks.every(c => c[1])
console.log(allOk ? '\n🎉 全PASS' : '\n⚠️ FAILあり')
