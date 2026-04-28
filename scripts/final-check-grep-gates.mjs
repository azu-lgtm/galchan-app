// 自ガルN 台本×YouTubeタイトル×動画管理表 機械検出ゲート
// Usage: node scripts/final-check-grep-gates.mjs <galN>
//   例: node scripts/final-check-grep-gates.mjs gal9
//
// 検出項目:
//   G8: 冒頭タイトルコール ≒ YouTubeタイトル核ワード整合
//   G9: 動画管理表 A-S列完全性（P列ワーカーメッセージ等）
//   G10: 商品数テーマ別妥当性（全体/トピック別/代替なし）
//   G11: 全体文字数上限チェック

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

const galN = process.argv[2] || 'gal9'
const mgmtSheetId = process.env.SPREADSHEET_ID_GALCHAN

// 台本ファイルパス（Obsidian）
const scriptPath = `C:/Users/meiek/Dropbox/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる/自分動画/台本/【自${galN.replace('gal', 'ガル')}台本】ドラッグストア_v3.md`
// ※実際は動的にファイル名検索する必要あり。ここでは自ガル9固定例

const results = { pass: [], fail: [], warn: [] }

// =====================================
// G8: 冒頭タイトルコール整合チェック
// =====================================
async function checkG8() {
  console.log('\n=== G8: 冒頭タイトルコール整合 ===')

  // 台本2行目のタイトル取得
  let scriptTitle = ''
  try {
    const md = fs.readFileSync(scriptPath, 'utf8')
    const lines = md.split('\n')
    const titleLine = lines.find(l => l.startsWith('タイトル\t'))
    if (titleLine) scriptTitle = titleLine.split('\t')[1] || ''
  } catch (e) {
    results.fail.push(`G8: 台本ファイル読み込み失敗 (${scriptPath})`)
    return
  }

  // 動画管理表からYouTubeタイトル取得
  const mgmtRes = await sheets.spreadsheets.values.get({
    spreadsheetId: mgmtSheetId,
    range: '自分チャンネル・動画管理表!F11:J50',
  })
  const mgmtRows = mgmtRes.data.values || []
  let ytTitle = ''
  for (const row of mgmtRows) {
    if (row[0] && row[0].includes(`自${galN.replace('gal', 'ガル')}台本`)) {
      ytTitle = row[4] || '' // J列 = index 4 from F列
      break
    }
  }

  if (!ytTitle) {
    results.fail.push(`G8: YouTubeタイトルが動画管理表に見つからない`)
    return
  }

  console.log(`台本コール: "${scriptTitle}"`)
  console.log(`YouTubeタイトル: "${ytTitle}"`)

  // シノニム辞書ベースの概念マッチング（ガルchの頻出ワード）
  const synonymGroups = [
    ['危ない', '危険', 'ヤバい', '怖い', '怖すぎ', 'やめろ', '捨てて'],
    ['商品', '日用品', '常備品', '品', 'アイテム', 'もの', 'グッズ'],
    ['ドラスト', 'ドラッグストア', '薬局'],
    ['知らない', '気づかない', 'バレる', '名指し'],
    ['買う', '買い続けて', '買ってた', '買い物', '購入'],
    ['家', '家の中', '常備', '置いてる'],
    ['国', '消費者庁', '国民生活', '厚労省', '政府', '警告'],
  ]

  // 両方に含まれる概念グループをカウント
  const matched = synonymGroups.filter(group => {
    const inScript = group.some(w => scriptTitle.includes(w))
    const inYt = group.some(w => ytTitle.includes(w))
    return inScript && inYt
  })
  console.log(`共通概念: ${matched.map(g => g[0]).join(', ')}`)

  if (matched.length >= 2) {
    results.pass.push(`G8: 核概念${matched.length}個一致 (${matched.map(g => g[0]).slice(0, 3).join('/')}...)`)
  } else if (matched.length === 1) {
    results.warn.push(`G8: 核概念1個のみ一致。手動で整合性再確認推奨`)
  } else {
    results.fail.push(`G8: 核概念一致ゼロ。タイトルコールをYouTubeタイトルと整合させよ`)
  }

  // 文字数チェック（10-20字）
  const titleLen = [...scriptTitle].length
  if (titleLen >= 10 && titleLen <= 20) {
    results.pass.push(`G8: タイトルコール文字数OK (${titleLen}字)`)
  } else {
    results.warn.push(`G8: タイトルコール${titleLen}字（推奨10-20字）`)
  }
}

// =====================================
// G9: 動画管理表 A-S列完全性
// =====================================
async function checkG9() {
  console.log('\n=== G9: 動画管理表完全性 ===')
  const mgmtRes = await sheets.spreadsheets.values.get({
    spreadsheetId: mgmtSheetId,
    range: '自分チャンネル・動画管理表!A11:S50',
  })
  const mgmtRows = mgmtRes.data.values || []
  let targetRow = -1
  mgmtRows.forEach((row, i) => {
    if (row[5] && row[5].includes(`自${galN.replace('gal', 'ガル')}台本`)) {
      targetRow = i
    }
  })

  if (targetRow < 0) {
    results.fail.push(`G9: 動画管理表に ${galN} の行が見つからない`)
    return
  }

  const row = mgmtRows[targetRow]
  // 2026-04-18 列順変更反映: P列（ワーカーへメッセージ）→ N列へ移動（固定コメントの隣）
  const required = [
    { col: 'F', idx: 5, name: '台本名' },
    { col: 'G', idx: 6, name: '台本リンク' },
    { col: 'H', idx: 7, name: 'テーマ' },
    { col: 'I', idx: 8, name: 'サムネテキスト' },
    { col: 'J', idx: 9, name: 'タイトル' },
    { col: 'K', idx: 10, name: '概要欄' },
    { col: 'L', idx: 11, name: 'メタタグ' },
    { col: 'M', idx: 12, name: '固定コメント' },
    { col: 'N', idx: 13, name: 'ワーカーへメッセージ' },
    { col: 'P', idx: 15, name: '切り口' },
    { col: 'Q', idx: 16, name: '動画企画の型' },
  ]

  required.forEach(({ col, idx, name }) => {
    const val = row[idx]
    if (!val || val.trim() === '') {
      results.fail.push(`G9: ${col}列「${name}」が空欄`)
    } else {
      results.pass.push(`G9: ${col}列「${name}」記入済 (${val.length}字)`)
    }
  })
}

// =====================================
// G10/G11: 商品数・文字数妥当性
// =====================================
async function checkG10G11() {
  console.log('\n=== G10: 商品数妥当性 / G11: 全体文字数 ===')

  // 台本文字数
  let scriptChars = 0
  try {
    const md = fs.readFileSync(scriptPath, 'utf8')
    scriptChars = [...md].filter(c => !['\t', '\n', '\r'].includes(c)).length
  } catch (e) {
    results.fail.push(`G11: 台本ファイル読み込み失敗`)
    return
  }

  // テーマ判定（動画管理表Q列「動画企画の型」）
  const mgmtRes = await sheets.spreadsheets.values.get({
    spreadsheetId: mgmtSheetId,
    range: '自分チャンネル・動画管理表!F11:Q50',
  })
  const mgmtRows = mgmtRes.data.values || []
  let themeType = ''
  mgmtRows.forEach(row => {
    if (row[0] && row[0].includes(`自${galN.replace('gal', 'ガル')}台本`)) {
      themeType = row[11] || ''
    }
  })
  console.log(`テーマタイプ: ${themeType}`)
  console.log(`台本文字数: ${scriptChars}`)

  // 商品タイプはほぼ「注意喚起×代替ハイブリッド型」想定で10,200字上限
  const charLimit = 10200
  if (scriptChars <= charLimit) {
    results.pass.push(`G11: 文字数OK (${scriptChars}/${charLimit}字上限)`)
  } else {
    results.fail.push(`G11: 文字数超過 (${scriptChars}字 > ${charLimit}字上限)。圧縮必須`)
  }

  // 商品数（商品リストシート行数）
  const scriptSheetId = '1vzAeBpDJXOBzKyNhiBWA1xEcVA1vPGOLZZNtNehTgNg' // 自ガル9固定。動的にする場合は動画管理表G列から
  try {
    const prodRes = await sheets.spreadsheets.values.get({
      spreadsheetId: scriptSheetId,
      range: '商品リスト!A1:A50',
    })
    const prodRows = (prodRes.data.values || []).filter(r => r[0] && r[0].trim() !== '' && r[0] !== '商品名')
    console.log(`商品数: ${prodRows.length}`)
    // ハイブリッド型 20-26商品
    if (prodRows.length >= 20 && prodRows.length <= 26) {
      results.pass.push(`G10: 商品数OK (${prodRows.length}商品・ハイブリッド型基準20-26内)`)
    } else if (prodRows.length < 20) {
      results.fail.push(`G10: 商品数不足 (${prodRows.length}商品・20-26推奨)`)
    } else {
      results.warn.push(`G10: 商品数多め (${prodRows.length}商品・20-26推奨)`)
    }
  } catch (e) {
    results.warn.push(`G10: 商品リスト読み込み失敗: ${e.message}`)
  }
}

// =====================================
// 実行
// =====================================
await checkG8()
await checkG9()
await checkG10G11()

console.log('\n\n========== 最終QAレポート ==========')
console.log(`\n✅ PASS (${results.pass.length}):`)
results.pass.forEach(m => console.log('  ✓ ' + m))
console.log(`\n❌ FAIL (${results.fail.length}):`)
results.fail.forEach(m => console.log('  ✗ ' + m))
console.log(`\n⚠️ WARN (${results.warn.length}):`)
results.warn.forEach(m => console.log('  ! ' + m))

console.log(`\n=== 総合判定 ===`)
if (results.fail.length === 0) {
  console.log('✅ 投稿OK')
  process.exit(0)
} else {
  console.log(`❌ 要修正（${results.fail.length}件）`)
  process.exit(1)
}
