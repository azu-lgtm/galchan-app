// 自ガル16 v13 azu指摘3項目（L91/L92/L94/L132/L133/L167/L168）スプシ反映検証
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

// 台本 row1=header / row2=spacer / row3=空 / row4=script L1 を想定
// 実際の対応関係を確認するため row4=L1 から始まると仮定: sheetRow = scriptLine + 3
const checks = [
  { scriptLine: 91, expected: '4つ目の店舗がロピア、ここは表示の問題で国の指摘が入った話があるよ' },
  { scriptLine: 92, expected: '2024年6月に農林水産省が、食品表示のルール違反として正式に発表したんだって' },
  { scriptLine: 94, expected: 'お店の名前が公表されるレベルだから、普段買ってる側としてはかなり重く感じるよね' },
  { scriptLine: 132, expected: '国産ゆず風味のぽん酢は、安いのに大手メーカー品より好みって家族で言ってる' },
  { scriptLine: 133, expected: '鍋の季節はぽん酢、夏は白だしの冷やしうどんって感じで、季節ごとに使い分けやすいんだよね' },
  { scriptLine: 167, expected: '私は今夜帰ったら、冷凍庫の冷凍野菜と子供のおやつだけは表示を見直すつもり' },
  { scriptLine: 168, expected: '買い物前に一度リストを見ておくだけでも、店で迷う時間が減りそうだよね' },
]

console.log('=== 自ガル16 v13 azu指摘 スプシ反映検証 ===\n')

// 台本全体を取得して L列(発言列)を特定
const r = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: '台本!A1:E200',
})
const rows = r.data.values || []
console.log(`台本総行数: ${rows.length}`)
console.log(`row1 (header): ${JSON.stringify(rows[0])}`)
console.log(`row4 (L1?): ${JSON.stringify(rows[3])}`)
console.log('')

let allPass = true
for (const c of checks) {
  // row4=L1 と仮定: sheetRowIndex = scriptLine + 2 (0-based)
  const idx = c.scriptLine + 2
  const row = rows[idx]
  const cells = row || []
  // 発言列を探す（通常は2列目=B列）
  const speech = cells[1] || ''
  const match = speech === c.expected
  if (!match) allPass = false
  console.log(`${match ? '✅' : '❌'} L${c.scriptLine} (sheetRow ${idx + 1})`)
  if (!match) {
    console.log(`   expected: ${c.expected}`)
    console.log(`   actual:   ${speech}`)
  }
}
console.log(`\n=== 結果: ${allPass ? '🟢 全件PASS' : '🔴 FAIL あり'} ===`)
