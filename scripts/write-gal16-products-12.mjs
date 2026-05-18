// 自ガル16 商品リスト拡張 (4件→12件・神商品のみ)
// 既存4行を維持し、12行構成に書き換える
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

// 神商品12件・6店舗×2神商品
// A=No / B=商品名 / C=型番(代表例) / D=Amazonリンク / E=楽天リンク
const products = [
  // 業務スーパー神商品2件 (PB・店舗購入)
  ['1', '業務スーパー ダブルチーズケーキ', '', '※業務スーパー店舗で購入（PB商品・通販非対応）', '※業務スーパー店舗で購入（PB商品・通販非対応）'],
  ['2', '業務スーパー 冷凍讃岐うどん', '', '※業務スーパー店舗で購入（PB商品・通販非対応）', '※業務スーパー店舗で購入（PB商品・通販非対応）'],
  // ドンキ神商品2件
  ['3', 'ドン・キホーテ 素煎りミックスナッツデラックス 315g', '', 'https://www.amazon.co.jp/dp/B0DFY5MR17', 'https://search.rakuten.co.jp/search/mall/%E6%83%85%E7%86%B1%E4%BE%A1%E6%A0%BC+%E7%B4%A0%E7%85%8E%E3%82%8A%E3%83%9F%E3%83%83%E3%82%AF%E3%82%B9%E3%83%8A%E3%83%83%E3%83%84%E3%83%87%E3%83%A9%E3%83%83%E3%82%AF%E3%82%B9/'],
  ['4', '花畑牧場 カマンベール 90g×6個', '', 'https://www.amazon.co.jp/dp/B0F2GVJBF5', 'https://search.rakuten.co.jp/search/mall/%E8%8A%B1%E7%95%91%E7%89%A7%E5%A0%B4+%E3%82%AB%E3%83%9E%E3%83%B3%E3%83%99%E3%83%BC%E3%83%AB/'],
  // コストコ神商品2件
  ['5', 'カークランドシグネチャー オーガニックダイストマト 411g×8缶', '', 'https://www.amazon.co.jp/dp/B00AFC5GY8', 'https://item.rakuten.co.jp/24exp/b00c95co9e/'],
  ['6', 'コストコ ディナーロール 36個入', '', '※コストコ店舗で購入（会員制・PB商品）', '※コストコ店舗で購入（会員制・PB商品）'],
  // ロピア神商品2件 (PB・店舗購入)
  ['7', 'ロピア にん肉塩', '', '※ロピア店舗で購入（PB商品・通販非対応）', '※ロピア店舗で購入（PB商品・通販非対応）'],
  ['8', 'ロピア 精肉(国産牛切り落とし等)', '', '※ロピア店舗で購入（PB商品・通販非対応）', '※ロピア店舗で購入（PB商品・通販非対応）'],
  // イオン神商品2件
  ['9', 'トップバリュ 餃子', '', '※イオン店舗で購入（PB商品・通販非対応）', '※イオン店舗で購入（PB商品・通販非対応）'],
  ['10', 'トップバリュ ベストプライス 味付けぽん酢 600ml', '', 'https://www.amazon.co.jp/s?k=%E3%83%88%E3%83%83%E3%83%97%E3%83%90%E3%83%AA%E3%83%A5+%E5%91%B3%E4%BB%98%E3%81%91%E3%81%BD%E3%82%93%E9%85%A2', 'https://item.rakuten.co.jp/ehac/4549741605083-12/'],
  // カルディ神商品2件
  ['11', 'もへじ サラダの旨たれ 290ml', '', 'https://www.amazon.co.jp/dp/B0D8G2V1DB', 'https://search.rakuten.co.jp/search/mall/%E3%82%82%E3%81%B8%E3%81%98+%E3%82%B5%E3%83%A9%E3%83%80%E3%81%AE%E6%97%A8%E3%81%9F%E3%82%8C/'],
  ['12', 'ラ・プレッツィオーザ ダイストマト缶 400g', '', 'https://www.amazon.co.jp/s?k=%E3%83%A9%E3%83%BB%E3%83%97%E3%83%AC%E3%83%83%E3%83%84%E3%82%A3%E3%82%AA%E3%83%BC%E3%82%B6+%E3%83%88%E3%83%9E%E3%83%88%E7%BC%B6', 'https://search.rakuten.co.jp/search/mall/%E3%83%A9%E3%83%BB%E3%83%97%E3%83%AC%E3%83%83%E3%83%84%E3%82%A3%E3%82%AA%E3%83%BC%E3%82%B6+%E3%83%88%E3%83%9E%E3%83%88%E7%BC%B6/'],
]

// header + 12 rows
const headerRow = ['No.', '商品名', '型番（代表例）', 'Amazonリンク', '楽天リンク']
const values = [headerRow, ...products]

// First clear existing rows A1:E20 (cover old 5 + buffer)
console.log('Step 1: Clear existing 商品リスト A1:E20')
await sheets.spreadsheets.values.clear({
  spreadsheetId,
  range: '商品リスト!A1:E20',
})
console.log('  -> cleared')

console.log('Step 2: Write 13 rows (header + 12 products) to A1:E13')
const updRes = await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: '商品リスト!A1:E13',
  valueInputOption: 'RAW',
  requestBody: { values },
})
console.log(`  -> updated ${updRes.data.updatedCells} cells (${updRes.data.updatedRows} rows × ${updRes.data.updatedColumns} cols)`)

// Read back for verification
console.log('\nStep 3: Read back A1:E13 for verification')
const readBack = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: '商品リスト!A1:E13',
})
const rows = readBack.data.values ?? []
console.log(`  -> ${rows.length} rows`)
rows.forEach((row, i) => {
  console.log(`  Row ${i + 1}: [${row[0]}] ${row[1]} | D=${(row[3] ?? '').slice(0, 50)}... | E=${(row[4] ?? '').slice(0, 50)}...`)
})

// Check for garbage chars
console.log('\nStep 4: Garbage character check')
const allText = JSON.stringify(rows)
const garbageRegex = /[̀-ͯ฀-๿�]|PLACEHOLDER|TODO|XXX/g
const matches = allText.match(garbageRegex)
if (matches) {
  console.log('  ⚠️ Garbage chars detected:', matches)
} else {
  console.log('  ✅ No garbage / no PLACEHOLDER residues')
}

// Check row count
console.log('\nStep 5: Row count check')
if (rows.length === 13) {
  console.log('  ✅ 13 rows confirmed (1 header + 12 products)')
} else {
  console.log(`  ⚠️ Expected 13 rows, got ${rows.length}`)
}

console.log('\n=== DONE ===')
