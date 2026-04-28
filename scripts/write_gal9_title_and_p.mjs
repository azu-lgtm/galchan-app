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
const mgmtSheetId = process.env.SPREADSHEET_ID_GALCHAN

const workerMessage = `この度はご契約ありがとうございます。
本日より業務を開始していただければと思います。

納期は本日より4日後まででお願いいたします。

以下、編集に必要なデータをお送りします。
※納品時のファイル名は、必ず台本のファイル名と同一にしてください。

・台本（Googleスプレッドシート）
https://docs.google.com/spreadsheets/d/1vzAeBpDJXOBzKyNhiBWA1xEcVA1vPGOLZZNtNehTgNg/edit
※納品時は、こちらの台本ファイル名を使用してください


・マニュアル（Google ドキュメント）

https://docs.google.com/document/d/1RwmmhQSlReyEH_EFvvpjSaDOPnzVZYfP-PUKe4pasS4/edit?usp=sharing

・テンプレート素材一式（下記）

https://xgf.nu/ixTdZ

パスワード：113
(ギガファイル便リンク 有効期限5/20)

♢テンプレプロジェクトファイル（YMM4）
♢背景動画
♢効果音
♢BGM
♢イラスト素材


上記素材がすべて揃っているか、作業開始前に必ずご確認ください。
不足や破損、読み込みできない素材がある場合は、作業を進めず事前にご連絡をお願いいたします。
自己判断による代替素材の使用は禁止です。

本案件は、冒頭約1分を先に制作・提出していただき、内容確認後に問題なければ本編を最後まで制作していただく流れとなります。

マニュアルおよびテンプレプロジェクトファイルに沿って進めていただければ問題ありませんが、作業中に不明点や判断に迷う点がありましたら、必ずその都度ご相談いただければと思います。

また、マニュアルについて、分かりづらい点や改善した方がよさそうな点があれば、率直に教えていただけると助かります。

完成後は、マニュアル記載の手順に従って納品をお願いいたします。

それでは、完成を楽しみにしております。
どうぞよろしくお願いいたします。

あずき`

// 1) First read the script sheet to find the title row (row with "タイトル" in col A)
const scriptRange = 'A1:C10'
const scriptRes = await sheets.spreadsheets.values.get({ spreadsheetId: scriptSheetId, range: scriptRange })
console.log('=== 台本シート A1:C10 ===')
scriptRes.data.values?.forEach((row, i) => {
  console.log(`Row ${i + 1}: [${(row[0] || '').slice(0, 20)}] [${(row[1] || '').slice(0, 40)}]`)
})

// Find title row (col A = "タイトル")
let titleRowIdx = -1
scriptRes.data.values?.forEach((row, i) => {
  if (row[0] === 'タイトル') titleRowIdx = i + 1
})
console.log('Title row:', titleRowIdx)

if (titleRowIdx > 0) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: scriptSheetId,
    range: `B${titleRowIdx}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['ドラストで買い続けてた危ない商品']] },
  })
  console.log('✅ 台本シート タイトル更新')
}

// 2) Write P32 worker message in mgmt sheet
await sheets.spreadsheets.values.update({
  spreadsheetId: mgmtSheetId,
  range: '自分チャンネル・動画管理表!P32',
  valueInputOption: 'RAW',
  requestBody: { values: [[workerMessage]] },
})
console.log('✅ 動画管理表 P32 ワーカーメッセージ記入')

// 3) Read back for verification
const verifyScript = await sheets.spreadsheets.values.get({ spreadsheetId: scriptSheetId, range: `B${titleRowIdx}` })
const verifyP32 = await sheets.spreadsheets.values.get({ spreadsheetId: mgmtSheetId, range: '自分チャンネル・動画管理表!P32' })
console.log('\n=== 書き戻し検証 ===')
console.log('台本タイトル:', verifyScript.data.values?.[0]?.[0])
console.log('P32 先頭100字:', verifyP32.data.values?.[0]?.[0]?.slice(0, 100))
console.log('P32 末尾20字:', verifyP32.data.values?.[0]?.[0]?.slice(-20))
