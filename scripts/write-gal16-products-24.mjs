// 自ガル16 商品リスト v12 拡張 (13行→25行・ヘッダ+神12+ネガ12=24商品)
// azu指示: ワーカー用に全24商品のアフィリンク/検索URL含めて反映
// アフィタグは「ポジ商品のみ」(feedback_affiliate_only_for_positive_products.md)
// ネガ商品はアフィタグなしの素検索URL or 店舗注記
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

// 神商品12件 (アフィタグ付き) + ネガ商品12件 (アフィタグなし or 店舗注記)
// A=No / B=商品名 / C=型番 / D=Amazonリンク / E=楽天リンク
const AFFI_TAG = '&tag=garuchannel22-22'

const products = [
  // === 神商品12件 (No.1-12) ===
  ['1', '業務スーパー ダブルチーズケーキ', '', 'https://www.amazon.co.jp/s?k=%E6%A5%AD%E5%8B%99%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC+%E3%83%80%E3%83%96%E3%83%AB%E3%83%81%E3%83%BC%E3%82%BA%E3%82%B1%E3%83%BC%E3%82%AD' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E6%A5%AD%E5%8B%99%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC+%E3%83%80%E3%83%96%E3%83%AB%E3%83%81%E3%83%BC%E3%82%BA%E3%82%B1%E3%83%BC%E3%82%AD/'],
  ['2', '業務スーパー 冷凍讃岐うどん', '', 'https://www.amazon.co.jp/s?k=%E6%A5%AD%E5%8B%99%E3%82%B9%E3%83%BC%E3%83%91%E3%83%BC+%E5%86%B7%E5%87%8D%E8%AE%83%E5%B2%90%E3%81%86%E3%81%A9%E3%82%93' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E5%86%B7%E5%87%8D%E8%AE%83%E5%B2%90%E3%81%86%E3%81%A9%E3%82%93/'],
  ['3', 'ドン・キホーテ 素煎りミックスナッツデラックス 315g', '', 'https://www.amazon.co.jp/s?k=%E7%B4%A0%E7%85%8E%E3%82%8A%E3%83%9F%E3%83%83%E3%82%AF%E3%82%B9%E3%83%8A%E3%83%83%E3%83%84' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E7%B4%A0%E7%85%8E%E3%82%8A%E3%83%9F%E3%83%83%E3%82%AF%E3%82%B9%E3%83%8A%E3%83%83%E3%83%84/'],
  ['4', '花畑牧場 カマンベール 90g×6個', '', 'https://www.amazon.co.jp/s?k=%E8%8A%B1%E7%95%91%E7%89%A7%E5%A0%B4+%E3%82%AB%E3%83%9E%E3%83%B3%E3%83%99%E3%83%BC%E3%83%AB' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E8%8A%B1%E7%95%91%E7%89%A7%E5%A0%B4+%E3%82%AB%E3%83%9E%E3%83%B3%E3%83%99%E3%83%BC%E3%83%AB/'],
  ['5', 'カークランドシグネチャー オーガニックダイストマト 411g×8缶', '', 'https://www.amazon.co.jp/s?k=%E3%82%AB%E3%83%BC%E3%82%AF%E3%83%A9%E3%83%B3%E3%83%89+%E3%82%AA%E3%83%BC%E3%82%AC%E3%83%8B%E3%83%83%E3%82%AF%E3%83%88%E3%83%9E%E3%83%88%E7%BC%B6' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E3%82%AA%E3%83%BC%E3%82%AC%E3%83%8B%E3%83%83%E3%82%AF%E3%83%88%E3%83%9E%E3%83%88%E7%BC%B6/'],
  ['6', 'コストコ ディナーロール 36個入', '', 'https://www.amazon.co.jp/s?k=%E3%82%B3%E3%82%B9%E3%83%88%E3%82%B3+%E3%83%87%E3%82%A3%E3%83%8A%E3%83%BC%E3%83%AD%E3%83%BC%E3%83%AB' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E3%82%B3%E3%82%B9%E3%83%88%E3%82%B3+%E3%83%87%E3%82%A3%E3%83%8A%E3%83%BC%E3%83%AD%E3%83%BC%E3%83%AB/'],
  ['7', 'ロピア にん肉塩', '', 'https://www.amazon.co.jp/s?k=%E3%83%AD%E3%83%94%E3%82%A2+%E3%81%AB%E3%82%93%E8%82%89%E5%A1%A9' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E3%81%AB%E3%82%93%E3%81%AB%E3%81%8F%E5%A1%A9/'],
  ['8', 'ロピア 焼鳥三昧（精肉系）', '', '※ロピア店頭で購入（生鮮精肉のため店頭限定）', '※ロピア店頭で購入（生鮮精肉のため店頭限定）'],
  ['9', 'トップバリュ 餃子（イオン）', '', 'https://www.amazon.co.jp/s?k=%E3%83%88%E3%83%83%E3%83%97%E3%83%90%E3%83%AA%E3%83%A5+%E9%A4%83%E5%AD%90' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E3%83%88%E3%83%83%E3%83%97%E3%83%90%E3%83%AA%E3%83%A5+%E9%A4%83%E5%AD%90/'],
  ['10', 'トップバリュ 味付けぽん酢・かつお風味白だし（イオン）', '', 'https://www.amazon.co.jp/s?k=%E3%83%88%E3%83%83%E3%83%97%E3%83%90%E3%83%AA%E3%83%A5+%E3%81%BD%E3%82%93%E9%85%A2' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E3%83%88%E3%83%83%E3%83%97%E3%83%90%E3%83%AA%E3%83%A5+%E3%81%BD%E3%82%93%E9%85%A2/'],
  ['11', 'もへじ サラダの旨たれ（カルディ）', '', 'https://www.amazon.co.jp/s?k=%E3%82%82%E3%81%B8%E3%81%98+%E3%82%B5%E3%83%A9%E3%83%80%E3%81%AE%E6%97%A8%E3%81%9F%E3%82%8C' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E3%82%82%E3%81%B8%E3%81%98+%E3%82%B5%E3%83%A9%E3%83%80%E3%81%AE%E6%97%A8%E3%81%9F%E3%82%8C/'],
  ['12', 'ラ・プレッツィオーザ トマト缶（カルディ）', '', 'https://www.amazon.co.jp/s?k=%E3%83%A9%E3%83%97%E3%83%AC%E3%83%83%E3%83%84%E3%82%A3%E3%82%AA%E3%83%BC%E3%82%B6+%E3%83%88%E3%83%9E%E3%83%88%E7%BC%B6' + AFFI_TAG, 'https://search.rakuten.co.jp/search/mall/%E3%83%A9%E3%83%97%E3%83%AC%E3%83%83%E3%83%84%E3%82%A3%E3%82%AA%E3%83%BC%E3%82%B6+%E3%83%88%E3%83%9E%E3%83%88%E7%BC%B6/'],

  // === ネガ商品12件 (No.13-24) アフィタグなし・素検索URL or 店舗注記 ===
  // 業ス危険2
  ['13', '業務スーパー 中国産冷凍千切りピーマン（2025/5/30リコール対象・4万5648個自主回収）', '', '※業務スーパー店舗で扱い（リコール対象・購入非推奨）', '※業務スーパー店舗で扱い（リコール対象・購入非推奨）'],
  ['14', '業務スーパー オリーブポマスオイル', '', 'https://www.amazon.co.jp/s?k=%E3%82%AA%E3%83%AA%E3%83%BC%E3%83%96%E3%83%9D%E3%83%9E%E3%82%B9%E3%82%AA%E3%82%A4%E3%83%AB', 'https://search.rakuten.co.jp/search/mall/%E3%82%AA%E3%83%AA%E3%83%BC%E3%83%96%E3%83%9D%E3%83%9E%E3%82%B9%E3%82%AA%E3%82%A4%E3%83%AB/'],
  // ドンキ危険2
  ['15', 'ドン・キホーテ 情熱価格 極上唐揚げ', '', '※ドン・キホーテ店舗で扱い（情熱価格PB・通販非対応）', '※ドン・キホーテ店舗で扱い（情熱価格PB・通販非対応）'],
  ['16', 'ドン・キホーテ 情熱価格 カカオスイーツ系（甘すぎない表示の罠）', '', '※ドン・キホーテ店舗で扱い（情熱価格PB・通販非対応）', '※ドン・キホーテ店舗で扱い（情熱価格PB・通販非対応）'],
  // コストコ危険2
  ['17', 'コストコ 「保存料不使用」表示係争中の惣菜チキン系（米国2026/1集団訴訟・ポリリン酸ナトリウム含有）', '', '※コストコ会員制店舗で扱い（係争中・購入非推奨）', '※コストコ会員制店舗で扱い（係争中・購入非推奨）'],
  ['18', 'コストコ モッツァロール（2025/11/21・賞味期限内ロット回収発表）', '', '※コストコ会員制店舗で扱い（回収対象ロットあり・購入非推奨）', '※コストコ会員制店舗で扱い（回収対象ロットあり・購入非推奨）'],
  // ロピア危険2
  ['19', 'ロピア スコーン/あげもち等18商品（2024/6/11農水省関東農政局是正指示・74店舗・約3年3か月で64万5994パック）', '', '※ロピア店舗で扱い（農水省是正指示対象・購入非推奨）', '※ロピア店舗で扱い（農水省是正指示対象・購入非推奨）'],
  ['20', 'ロピア 米加工品系（主婦失敗報告多数）', '', '※ロピア店舗で扱い（米加工品系・店頭購入のみ）', '※ロピア店舗で扱い（米加工品系・店頭購入のみ）'],
  // イオン危険2
  ['21', 'トップバリュ チョコ・自社ブランド全般（満足度26.2%）', '', 'https://www.amazon.co.jp/s?k=%E3%83%88%E3%83%83%E3%83%97%E3%83%90%E3%83%AA%E3%83%A5+%E3%83%81%E3%83%A7%E3%82%B3', 'https://search.rakuten.co.jp/search/mall/%E3%83%88%E3%83%83%E3%83%97%E3%83%90%E3%83%AA%E3%83%A5+%E3%83%81%E3%83%A7%E3%82%B3/'],
  ['22', 'トップバリュ ベストプライス カップ麺系（最安自社ブランド・スープ薄/人工感）', '', 'https://www.amazon.co.jp/s?k=%E3%83%99%E3%82%B9%E3%83%88%E3%83%97%E3%83%A9%E3%82%A4%E3%82%B9+%E3%82%AB%E3%83%83%E3%83%97%E9%BA%BA', 'https://search.rakuten.co.jp/search/mall/%E3%83%99%E3%82%B9%E3%83%88%E3%83%97%E3%83%A9%E3%82%A4%E3%82%B9+%E3%82%AB%E3%83%83%E3%83%97%E9%BA%BA/'],
  // カルディ危険2
  ['23', 'カルディ 「無添加」表示菓子（一部添加物非該当だけで無添加表示・実は香料等含有）', '', 'https://www.amazon.co.jp/s?k=%E3%82%AB%E3%83%AB%E3%83%87%E3%82%A3+%E7%84%A1%E6%B7%BB%E5%8A%A0+%E3%81%8A%E8%8F%93%E5%AD%90', 'https://search.rakuten.co.jp/search/mall/%E3%82%AB%E3%83%AB%E3%83%87%E3%82%A3+%E7%84%A1%E6%B7%BB%E5%8A%A0+%E3%81%8A%E8%8F%93%E5%AD%90/'],
  ['24', 'カルディ 甘すぎ輸入スイーツ（パンダ杏仁等・欧米基準の甘さ）', '', 'https://www.amazon.co.jp/s?k=%E3%82%AB%E3%83%AB%E3%83%87%E3%82%A3+%E8%BC%B8%E5%85%A5%E3%82%B9%E3%82%A4%E3%83%BC%E3%83%84', 'https://search.rakuten.co.jp/search/mall/%E3%82%AB%E3%83%AB%E3%83%87%E3%82%A3+%E8%BC%B8%E5%85%A5%E3%82%B9%E3%82%A4%E3%83%BC%E3%83%84/'],
]

// header + 24 rows
const headerRow = ['No.', '商品名', '型番（代表例）', 'Amazonリンク', '楽天リンク']
const values = [headerRow, ...products]

console.log(`Total products: ${products.length} (神12 + ネガ12)`)
console.log(`Total rows to write: ${values.length} (header + 24)`)

// Step 1: Clear existing rows A1:E30 (cover old 13 + buffer)
console.log('\nStep 1: Clear existing 商品リスト A1:E30')
await sheets.spreadsheets.values.clear({
  spreadsheetId,
  range: '商品リスト!A1:E30',
})
console.log('  -> cleared')

// Step 2: Write 25 rows
console.log('\nStep 2: Write 25 rows (header + 24 products) to A1:E25')
const updRes = await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: '商品リスト!A1:E25',
  valueInputOption: 'RAW',
  requestBody: { values },
})
console.log(`  -> updated ${updRes.data.updatedCells} cells (${updRes.data.updatedRows} rows × ${updRes.data.updatedColumns} cols)`)

// Step 3: Read back for verification
console.log('\nStep 3: Read back A1:E25 for verification')
const readBack = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: '商品リスト!A1:E25',
})
const rows = readBack.data.values ?? []
console.log(`  -> ${rows.length} rows`)
rows.forEach((row, i) => {
  const truncate = (s, n) => (s ?? '').length > n ? (s ?? '').slice(0, n) + '...' : (s ?? '')
  console.log(`  Row ${i + 1}: [${row[0]}] ${truncate(row[1], 50)} | D=${truncate(row[3], 40)} | E=${truncate(row[4], 40)}`)
})

// Step 4: Garbage character check
console.log('\nStep 4: Garbage character check')
const allText = JSON.stringify(rows)
const garbageRegex = /[̀-ͯ฀-๿�]|PLACEHOLDER|TODO|XXX/g
const matches = allText.match(garbageRegex)
if (matches) {
  console.log('  ⚠️ Garbage chars detected:', matches)
} else {
  console.log('  ✅ No garbage / no PLACEHOLDER residues')
}

// Step 5: Row count check
console.log('\nStep 5: Row count check')
if (rows.length === 25) {
  console.log('  ✅ 25 rows confirmed (1 header + 24 products = 神12 + ネガ12)')
} else {
  console.log(`  ⚠️ Expected 25 rows, got ${rows.length}`)
}

// Step 6: Affiliate tag check (only positive products 1-12 should have tag)
console.log('\nStep 6: Affiliate tag check (アフィタグはNo.1-12のみ・No.13-24はタグなし)')
let affiTagViolations = 0
for (let i = 1; i <= 24; i++) {
  const row = rows[i] // i=1 is No.1
  if (!row) continue
  const dLink = row[3] ?? ''
  const eLink = row[4] ?? ''
  const hasAffiTag = dLink.includes('garuchannel22-22') || eLink.includes('garuchannel22-22')
  if (i <= 12) {
    // 神商品: アフィタグあるべき (No.8 ロピア精肉系は店頭のみで例外)
    if (!hasAffiTag && i !== 8) {
      console.log(`  ⚠️ No.${i} 神商品にアフィタグなし: ${row[1]}`)
      affiTagViolations++
    }
  } else {
    // ネガ商品: アフィタグあってはNG
    if (hasAffiTag) {
      console.log(`  ❌ No.${i} ネガ商品にアフィタグ混入: ${row[1]}`)
      affiTagViolations++
    }
  }
}
if (affiTagViolations === 0) {
  console.log('  ✅ アフィタグ配置OK (神商品のみアフィタグ・ネガ商品はタグなし)')
}

console.log('\n=== DONE ===')
