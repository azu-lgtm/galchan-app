// 自ガル9商品リスト拡充: 19商品 → 25商品 (+6)
// TSVファイル追記 + スプシSheet2書き込み + 読み戻し検証

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    process.env[m[1]] = val
  }
}

const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI)
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
const sheets = google.sheets({ version: 'v4', auth })

const scriptSheetId = '1vzAeBpDJXOBzKyNhiBWA1xEcVA1vPGOLZZNtNehTgNg'

const amazonSearch = (q) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}&tag=garuchannel22-22`

const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'rakuten-results-gal9-additions.json'), 'utf8'))

const newRows = [
  // 1: シャボン玉 重曹680g (T1代替)
  [
    'シャボン玉 重曹 680g',
    'ジュウソウ',
    'シャボン玉石けん',
    'ナチュラルクリーニング用重曹。塩素系と混ぜず単独で使える浴室掃除の安全代替',
    results[0].affiliateUrl,
    amazonSearch('シャボン玉 重曹 680g'),
  ],
  // 2: ファンケル えんきん (T3代替)
  [
    'ファンケル えんきん 30日分',
    'エンキン',
    'ファンケル',
    'ルテイン10mg・アスタキサンチン・ゼアキサンチン配合の機能性表示食品。手元のピント調節サポート',
    results[1].affiliateUrl,
    amazonSearch('ファンケル えんきん'),
  ],
  // 3: リアップリジェンヌ (T4代替)
  [
    'リアップリジェンヌ 60ml',
    'リアップリジェンヌ',
    '大正製薬',
    '女性用ミノキシジル1%配合の第1類医薬品。薬剤師対面販売・臨床試験データあり',
    results[2].affiliateUrl,
    amazonSearch('リアップリジェンヌ'),
  ],
  // 4: アヴァンセ ラッシュセラムEX (T6代替)
  [
    'アヴァンセ ラッシュセラムEX 7ml',
    'ラッシュセラム',
    'アヴァンセ',
    'パントテン酸誘導体とヒアルロン酸配合の医薬部外品まつ毛育毛料。個人輸入より安全',
    results[3].affiliateUrl,
    amazonSearch('アヴァンセ ラッシュセラムEX'),
  ],
  // 5: マジョマジョ ラッシュジェリードロップEX (T6代替)
  [
    'マジョリカマジョルカ ラッシュジェリードロップEX プレミアム 5.3g',
    'ラッシュジェリードロップ',
    '資生堂',
    '資生堂の20種美容成分配合保湿まつ毛美容液。医師監視不要で安全',
    results[4].affiliateUrl,
    amazonSearch('マジョリカマジョルカ ラッシュジェリードロップEX プレミアム'),
  ],
  // 6: トラフルクリアウォッシュ (T7代替・アズレン系)
  [
    'トラフルクリアウォッシュ 65ml',
    'トラフル',
    '第一三共ヘルスケア',
    'アズレンスルホン酸ナトリウム配合の医薬品含嗽剤。口内炎・のどの痛み・口腔トラブル対応',
    results[5].affiliateUrl,
    amazonSearch('トラフルクリアウォッシュ'),
  ],
]

// 1) Sheet2 末尾行を検出（F列=楽天URLベースで末尾検出）
const curRange = await sheets.spreadsheets.values.get({
  spreadsheetId: scriptSheetId,
  range: '商品リスト!A1:F50',
})
const curRows = curRange.data.values || []
let lastRow = 0
curRows.forEach((row, i) => {
  if (row && row.length > 4 && row[4]) lastRow = i + 1 // F列=楽天URL基準
})
console.log('末尾行:', lastRow, '/ 既存行数:', curRows.length)

// 2) 新規行を末尾以降に追記
const startRow = lastRow + 1
const endRow = startRow + newRows.length - 1

// UTF-8バッファ書き込み（Sheets APIネイティブ）
await sheets.spreadsheets.values.update({
  spreadsheetId: scriptSheetId,
  range: `商品リスト!A${startRow}:F${endRow}`,
  valueInputOption: 'RAW',
  requestBody: { values: newRows },
})
console.log(`✅ Sheet2 行${startRow}-${endRow}に6商品追加`)

// 3) 読み戻し検証
const verifyRange = await sheets.spreadsheets.values.get({
  spreadsheetId: scriptSheetId,
  range: `商品リスト!A${startRow}:F${endRow}`,
})
console.log('\n=== 書き戻し検証 ===')
verifyRange.data.values?.forEach((row, i) => {
  console.log(`行${startRow + i}: ${row[0]} | ${row[3]?.slice(0, 30)}... | ${row[4]?.slice(0, 50)}...`)
})

// 4) TSVファイルにも追記
const tsvPath = 'C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/自社台本/【自ガル9】商品リスト_Sheet2.tsv'
const tsvContent = fs.readFileSync(tsvPath, 'utf8')
const existingLines = tsvContent.trimEnd().split('\n')
const newTsvLines = newRows.map(row => row.join('\t'))
const updatedTsv = [...existingLines, ...newTsvLines].join('\n') + '\n'
fs.writeFileSync(tsvPath, updatedTsv, 'utf8')
console.log(`\n✅ TSV更新: ${existingLines.length}行 → ${existingLines.length + newTsvLines.length}行`)
