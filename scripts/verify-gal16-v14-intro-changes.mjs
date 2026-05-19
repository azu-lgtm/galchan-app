// 自ガル16 v14 冒頭5行(L1-L5) スプシ反映検証
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

const checks = [
  { scriptLine: 1, expected: '業務スーパーやロピア、あなたが今日買い物に行ったそのお店、実は国がやり直しの指導を出したばかりの商品が並んでいるかもしれません。中には4万個以上回収されたあの野菜も…' },
  { scriptLine: 2, expected: '絶対買うな店舗別の要注意食品まとめと神商品' },
  { scriptLine: 3, expected: '今回は6店舗の危険な食品と、逆にみんながリピし続けてる神商品をセットでまとめました。知らないで家族に出すと後悔する、最新の食品事情を一緒に確認していきましょう' },
  { scriptLine: 4, expected: 'ロピアでおやつを買った後に農水省のニュースを見て、袋の裏を何度も確認した私のような経験、皆さんはありませんか？家族の健康を守りたい方は、ぜひチャンネル登録して最新情報をチェックしてくださいね！' },
  { scriptLine: 5, expected: 'それではいってみよう！！まずは、今まさに騒がれている業務スーパーのあの商品からです' },
]

console.log('=== 自ガル16 v14 冒頭5行(L1-L5) スプシ反映検証 ===\n')

const r = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: '台本!A4:C10',
})
const rows = r.data.values || []

let allPass = true
for (let i = 0; i < checks.length; i++) {
  const c = checks[i]
  const row = rows[i] || []
  const speech = row[1] || ''
  const match = speech === c.expected
  if (!match) allPass = false
  console.log(`${match ? '✅' : '❌'} L${c.scriptLine} (sheetRow ${i + 4}) [${row[0] || ''}]`)
  if (!match) {
    console.log(`   expected: ${c.expected}`)
    console.log(`   actual:   ${speech}`)
  }
}
console.log(`\n=== 結果: ${allPass ? '🟢 全件PASS' : '🔴 FAIL あり'} ===`)
