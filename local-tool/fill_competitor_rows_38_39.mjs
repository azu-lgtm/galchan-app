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

const SHEET = '競合チャンネル・動画管理表'

// 列順: A=ベンチマーク, B=URL, C=チャンネル名, D=登録者数, E=概要欄冒頭, F=使用音声, G=使用素材, H=登録日, I=動画本数, J=動画リンク, K=サムネ, L=タイトル
// 行38: URL #1 = 有益天使ガルちゃんまとめ (@yuueki-angel) + 動画 nM8F_Ixe4rM
//      ※既にRow 29に同チャンネル登録済の重複あり。azu判断待ち。今回はazu入力(B列の動画URL)を尊重しつつC-L列を埋める。
const row38 = [
  '',                                                                          // A: ベンチマーク (azu判断項目・未入力)
  'https://youtu.be/nM8F_Ixe4rM?si=Zb0mUVLVn5d5b1xU',                          // B: URL (azu入力ママ・動画URL)
  '有益天使ガルちゃんまとめ',                                                          // C: チャンネル名
  '4.29万',                                                                    // D: 登録者数 (42,900)
  'このチャンネルでは、ガールズちゃんねるや\nその他、様々な投稿から役に立つ有益な情報や\n面白い情報を集めて紹介しています！',  // E
  'ゆっくり音声',                                                                   // F
  'いらすとや系イラスト人 / 白枠4枚（ピンク背景）',                                         // G
  '2022/11/06',                                                                // H
  '414',                                                                       // I
  'https://youtu.be/nM8F_Ixe4rM?si=Zb0mUVLVn5d5b1xU',                          // J: 動画リンク
  'ちょちょいと作る、美味しすぎる簡単料理（総集編）（〇〇ラップで冷凍上手、〇〇のタレが万能過ぎるw、〇〇チョッパーめっちゃ使える、手抜きなのに家族に好評）', // K: サムネ
  '【有益スレ】料理がマジで楽になった⋯便利すぎるテクニックをガルちゃん民が伝授！［総集編］【ガルちゃん2chスレまとめ】',  // L: タイトル
]

// 行39: URL #2 = 有益ガールズライフ (@lgirls-life-yueki)
const row39 = [
  '',                                                                          // A: ベンチマーク (azu判断項目・未入力)
  'https://youtube.com/@lgirls-life-yueki?si=hCtp338atm1MwVaz',                // B: URL (azu入力ママ)
  '有益ガールズライフ',                                                                // C
  '3.16万',                                                                    // D (31,600)
  'ご視聴いただきありがとうございます☆\nこのチャンネルでは、ガールズちゃんねるの楽しく有益なスレなどをゆっくり解説していきます。\nコメント欄は、感想など、掲示板のように自由に書き込んでください☆',  // E
  'ゆっくり音声',                                                                   // F
  'いらすとや系イラスト人 / 白枠4枚（ピンク背景）',                                         // G
  '2023/12/17',                                                                // H
  '282',                                                                       // I
  'https://youtu.be/A_ILsxCO7Z4?si=lgirls-knm-money',                          // J: 直近最も伸びた動画(67,654再生)→いや、最大は89,836の備蓄品だが、サムネ確認済の方を採用
  'みんな騙されてる、払わなくていいお金（家電延長保証2700円のぼったくり、ドコモ/au/SoftBank/楽天Mobile魔法の1言で解決、結婚式/葬式の慣習）',  // K
  '【有益スレ】知らないと一生カモにされる。実は払わなくていいお金まとめ',                                  // L
]

console.log('--- 書き込み前 確認 ---')
console.log('Row 38:', JSON.stringify(row38, null, 2))
console.log('Row 39:', JSON.stringify(row39, null, 2))

const range38 = `'${SHEET}'!A38:L38`
const range39 = `'${SHEET}'!A39:L39`

await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: range38,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [row38] },
})
console.log(`✅ Updated ${range38}`)

await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range: range39,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [row39] },
})
console.log(`✅ Updated ${range39}`)

// 読み戻し検証
console.log('\n--- 書き込み後 読み戻し検証 ---')
for (const [name, range] of [['Row 38', range38], ['Row 39', range39]]) {
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range })
  console.log(`\n${name} (${range}):`)
  console.log(JSON.stringify(r.data.values?.[0] ?? [], null, 2))
}

// 文字化け・ゴミ文字検出
const checkGarbage = (s) => /[ŋɂ□�̂]/.test(s)
const allCells = [...row38, ...row39].filter(c => typeof c === 'string')
const garbageCells = allCells.filter(c => checkGarbage(c))
if (garbageCells.length) {
  console.log('\n⚠️ 文字化け検出:', garbageCells)
} else {
  console.log('\n✅ 文字化けなし')
}
