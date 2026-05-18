// 自ガル16 v12 整合性ハードチェック
// post_save_verify がネガ商品の店舗注記をFAILとするため、azu指示「ワーカー識別OK」基準で再検証する
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

const NEW_SPREADSHEET_ID = '1fmEuE-hm3dHN479LYL31g9VBYi2PncOiQyBwkPJ91Ls'
const MANAGEMENT_SPREADSHEET_ID = process.env.SPREADSHEET_ID_GALCHAN
const SHEET_MANAGEMENT = '自分チャンネル・動画管理表'

let failCount = 0
let warnCount = 0
const fail = (m) => { console.error(`❌ FAIL: ${m}`); failCount++ }
const warn = (m) => { console.log(`⚠️ WARN: ${m}`); warnCount++ }
const pass = (m) => console.log(`✅ ${m}`)

console.log('=== 自ガル16 v12 整合性ハードチェック ===\n')

// === 1. 商品リスト 24商品検証 (ネガ12は店舗注記OK・神12はリンク必須) ===
console.log('▼ 1. 商品リスト 24商品検証')
const prodRes = await sheets.spreadsheets.values.get({
  spreadsheetId: NEW_SPREADSHEET_ID,
  range: '商品リスト!A1:E50',
})
const prodRows = prodRes.data.values ?? []
console.log(`  - シート行数: ${prodRows.length}行`)
if (prodRows.length !== 25) {
  fail(`商品リスト行数異常: 期待25行(ヘッダ+24)・実際${prodRows.length}行`)
} else {
  pass(`商品リスト行数 25行 (ヘッダ+神12+ネガ12)`)
}

// 神商品12件 (No.1-12): D/E にhttp URL or「※〜店頭〜」注記許容 (No.8ロピア精肉系のみ店頭)
let positiveOK = 0
let positiveBad = []
for (let i = 1; i <= 12; i++) {
  const row = prodRows[i] // i=1 はNo.1
  if (!row) { positiveBad.push(`No.${i} 行欠`); continue }
  const dCell = row[3] ?? ''
  const eCell = row[4] ?? ''
  const hasD = /^https?:\/\//.test(dCell) || dCell.startsWith('※')
  const hasE = /^https?:\/\//.test(eCell) || eCell.startsWith('※')
  if (hasD && hasE) {
    positiveOK++
  } else {
    positiveBad.push(`No.${i} D=${dCell.slice(0, 30)} E=${eCell.slice(0, 30)}`)
  }
}
if (positiveBad.length === 0) {
  pass(`神商品12件 D/E列全件設置済 (http URL or 店舗注記)`)
} else {
  fail(`神商品 D/E欠落: ${positiveBad.join(' / ')}`)
}

// ネガ商品12件 (No.13-24): D/E に「※〜」注記 or http URL (アフィタグなし)
let negativeOK = 0
let negativeBadAffi = []
for (let i = 13; i <= 24; i++) {
  const row = prodRows[i]
  if (!row) { negativeBadAffi.push(`No.${i} 行欠`); continue }
  const dCell = row[3] ?? ''
  const eCell = row[4] ?? ''
  const hasD = /^https?:\/\//.test(dCell) || dCell.startsWith('※')
  const hasE = /^https?:\/\//.test(eCell) || eCell.startsWith('※')
  const hasAffi = dCell.includes('garuchannel22-22') || eCell.includes('garuchannel22-22')
  if (!hasD || !hasE) {
    negativeBadAffi.push(`No.${i} D/E欠落`)
  } else if (hasAffi) {
    negativeBadAffi.push(`No.${i} アフィタグ混入(ネガ商品なのにgaruchannel22-22)`)
  } else {
    negativeOK++
  }
}
if (negativeBadAffi.length === 0) {
  pass(`ネガ商品12件 D/E列全件設置済・アフィタグなし (azu指示準拠)`)
} else {
  fail(`ネガ商品 整合違反: ${negativeBadAffi.join(' / ')}`)
}

// === 2. row41 K/M/N列とローカルMDの完全一致検証 ===
console.log('\n▼ 2. row41 K/M/N列 ↔ ローカルMD 完全一致検証')
const mgmtRes = await sheets.spreadsheets.values.get({
  spreadsheetId: MANAGEMENT_SPREADSHEET_ID,
  range: `${SHEET_MANAGEMENT}!A41:Q41`,
})
const row41 = mgmtRes.data.values?.[0] ?? []
const kCol = row41[10] ?? '' // K列 (index 10)
const mCol = row41[12] ?? '' // M列 (index 12)
const nCol = row41[13] ?? '' // N列 (index 13)

function stripFrontmatter(md) {
  return md.replace(/^---\n[\s\S]*?\n---\n+/, '').replace(/^#\s+.*\n/, '').trim()
}

const descMd = stripFrontmatter(fs.readFileSync('C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】概要欄_20260517.md', 'utf8'))
const pinMd = stripFrontmatter(fs.readFileSync('C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】固定コメント_20260517.md', 'utf8'))
const wmMd = stripFrontmatter(fs.readFileSync('C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル16】ワーカーメッセージ_20260517.md', 'utf8'))

console.log(`  - K列(概要欄): spreadsheet=${kCol.length}字 / MD=${descMd.length}字`)
console.log(`  - M列(固定コメ): spreadsheet=${mCol.length}字 / MD=${pinMd.length}字`)
console.log(`  - N列(ワーカー): spreadsheet=${nCol.length}字 / MD=${wmMd.length}字`)

// 完全一致検証
if (kCol.trim() === descMd.trim()) pass(`K列(概要欄) 完全一致`)
else fail(`K列(概要欄) 不一致 (spreadsheet vs MD)`)

if (mCol.trim() === pinMd.trim()) pass(`M列(固定コメ) 完全一致`)
else fail(`M列(固定コメ) 不一致 (spreadsheet vs MD)`)

if (nCol.trim() === wmMd.trim()) pass(`N列(ワーカー) 完全一致`)
else fail(`N列(ワーカー) 不一致 (spreadsheet vs MD)`)

// === 3. 概要欄のアフィリンク 神商品11件確認 (ロピア精肉系除く) ===
console.log('\n▼ 3. 概要欄アフィリンク (神商品11件・No.8ロピア精肉系除く)')
const amazonCount = (kCol.match(/amazon\.co\.jp.*garuchannel22-22/g) || []).length
const rakutenCount = (kCol.match(/search\.rakuten\.co\.jp/g) || []).length
console.log(`  - Amazonアフィリンク: ${amazonCount}件`)
console.log(`  - 楽天検索リンク: ${rakutenCount}件`)
if (amazonCount === 11) pass(`概要欄Amazonアフィ 11件 (神商品12件 - ロピア精肉系1件 = 11件・azu仕様)`)
else if (amazonCount >= 10) warn(`概要欄Amazonアフィ ${amazonCount}件 (期待11件・許容範囲)`)
else fail(`概要欄Amazonアフィ ${amazonCount}件 (期待11件・不足)`)

// === 4. 固定コメ 危険商品リンクなし確認 (azu指示「危険商品退避削除」) ===
console.log('\n▼ 4. 固定コメ 危険商品退避削除確認 (azu指示)')
const pinHasNegativeBrand = /中国産|リコール|是正指示|集団訴訟|モッツァロール|甘すぎない|無添加.*罠/.test(mCol)
const pinHasAmazonLink = /amazon\.co\.jp.*garuchannel22-22/.test(mCol)
if (!pinHasNegativeBrand) pass(`固定コメに危険商品関連退避なし`)
else warn(`固定コメに危険商品関連表現が残存している可能性あり (要目視確認)`)
if (!pinHasAmazonLink) pass(`固定コメにAmazonアフィリンク混入なし (神商品は概要欄に集約)`)
else warn(`固定コメにAmazonアフィリンク残存`)

// === 5. PLACEHOLDER残存ゼロ ===
console.log('\n▼ 5. PLACEHOLDER残存検査')
const placeholderRegex = /\bPLACEHOLDER\b|\bTODO\b|\bXXX\b|\{\{|未確定/g
const inSheet = JSON.stringify({ kCol, mCol, nCol, prodRows }).match(placeholderRegex)
if (!inSheet) pass(`PLACEHOLDER残存ゼロ`)
else fail(`PLACEHOLDER残存: ${inSheet.join(',')}`)

// === 6. 文字化け検査 ===
console.log('\n▼ 6. 文字化け検査')
const garbageRegex = /[̀-ͯ฀-๿�]/g
const garbage = JSON.stringify({ kCol, mCol, nCol, prodRows }).match(garbageRegex)
if (!garbage) pass(`文字化けゼロ`)
else fail(`文字化け検出: ${garbage.join(',')}`)

console.log(`\n=== 結果 ===`)
console.log(`FAIL: ${failCount}件 / WARN: ${warnCount}件`)
if (failCount === 0) {
  console.log('🟢 整合性チェック完全通過')
  process.exit(0)
} else {
  console.log('🔴 修正が必要')
  process.exit(1)
}
