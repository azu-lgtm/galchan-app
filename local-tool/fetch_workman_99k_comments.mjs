// ガルの有益ライフ ワークマン99K動画(n1DHy3ZStjg)コメント全取得
// 自ガル17ワークマン需要調査用
import { readFile, writeFile } from 'fs/promises'

let env = await readFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/.env.local', 'utf8')
if (env.charCodeAt(0) === 0xFEFF) env = env.slice(1)
for (const rawLine of env.split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || !line.includes('=') || line.startsWith('#')) continue
  const eqIdx = line.indexOf('=')
  const k = line.slice(0, eqIdx).trim()
  let v = line.slice(eqIdx + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env[k] = v
}

const KEY = process.env.YOUTUBE_API_KEY
if (!KEY) throw new Error('YOUTUBE_API_KEY missing')

const VIDEO_ID = 'n1DHy3ZStjg'  // ガルの有益ライフ ワークマン99K
const BASE = 'https://www.googleapis.com/youtube/v3'

async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

async function videoStats(videoId) {
  const u = `${BASE}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${KEY}`
  const j = await getJSON(u)
  const v = j.items?.[0]
  return v ? {
    videoId,
    title: v.snippet.title,
    channelTitle: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    duration: v.contentDetails?.duration,
    viewCount: v.statistics?.viewCount,
    likeCount: v.statistics?.likeCount,
    commentCount: v.statistics?.commentCount,
  } : null
}

async function allComments(videoId) {
  const out = []
  let pageToken = ''
  let safety = 30
  while (safety-- > 0) {
    const u = `${BASE}/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=100&order=relevance&textFormat=plainText&key=${KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`
    const j = await getJSON(u)
    for (const item of j.items ?? []) {
      const top = item.snippet.topLevelComment.snippet
      out.push({
        text: top.textDisplay,
        author: top.authorDisplayName,
        likeCount: top.likeCount,
        publishedAt: top.publishedAt,
        replyCount: item.snippet.totalReplyCount,
      })
    }
    if (!j.nextPageToken) break
    pageToken = j.nextPageToken
  }
  return out
}

const stats = await videoStats(VIDEO_ID)
console.log('=== Video Stats ===')
console.log(JSON.stringify(stats, null, 2))

const cms = await allComments(VIDEO_ID)
console.log(`\n=== 取得コメント数: ${cms.length} ===`)

// いいね順上位30件
const top30 = [...cms].sort((a, b) => b.likeCount - a.likeCount).slice(0, 30)
console.log('\n=== TOP30 by likes ===')
for (const c of top30) {
  console.log(`[+${c.likeCount}] ${c.text.replace(/\n/g, ' ').slice(0, 200)}`)
}

// 主婦層判定キーワード
const HOUSEWIFE_KW = ['子供', '子ども', 'こども', '娘', '息子', '夫', '旦那', 'うちの', '家族', '主婦', 'パート', '孫', '40代', '50代', '60代']
const REPEAT_KW = ['リピ', '私も買っ', '愛用', '何度も', '何回も', '使ってる', '使ってます', 'お気に入り', '神商品', '神アイテム', '最高', '良かった', 'よかった', '大正解', '買って正解']
const NEGATIVE_KW = ['劣化', 'すぐ破れ', 'ダメ', '失敗', 'サイズ', 'ダサい', '在庫', '売り切れ', '買えない']
const PRODUCT_KW = ['作業着', '作業服', 'ワークマン女子', 'プラス', 'カラーズ', 'メディヒール', 'ファン付き', 'リカバリー', '冷感', 'UV', '撥水', 'インソール', 'パーカー', 'パンツ', 'シャツ', 'スニーカー', 'シューズ', '帽子', 'バッグ', 'リュック', 'ボトル']

function countMatch(comments, kws) {
  let n = 0
  const samples = []
  for (const c of comments) {
    if (kws.some(k => c.text.includes(k))) {
      n++
      if (samples.length < 5) samples.push({ likes: c.likeCount, text: c.text.replace(/\n/g, ' ').slice(0, 150) })
    }
  }
  return { count: n, ratio: (n / comments.length * 100).toFixed(1) + '%', samples }
}

console.log('\n=== 主婦層判定 ===')
console.log(JSON.stringify(countMatch(cms, HOUSEWIFE_KW), null, 2))
console.log('\n=== リピート/ポジ反応 ===')
console.log(JSON.stringify(countMatch(cms, REPEAT_KW), null, 2))
console.log('\n=== ネガコメ ===')
console.log(JSON.stringify(countMatch(cms, NEGATIVE_KW), null, 2))
console.log('\n=== 商品名言及 ===')
console.log(JSON.stringify(countMatch(cms, PRODUCT_KW), null, 2))

// 作業着系 vs ワークマン女子系
const SAGYO = ['作業着', '作業服', '現場', '建築', '大工', '職人', 'ガテン', '夫が', '旦那が']
const JOSHI = ['ワークマン女子', 'プラス', 'カラーズ', 'おしゃれ', 'コーデ', 'UV', '冷感', '可愛い', 'かわいい']
console.log('\n=== 作業着系言及 ===')
console.log(JSON.stringify(countMatch(cms, SAGYO), null, 2))
console.log('\n=== ワークマン女子系言及 ===')
console.log(JSON.stringify(countMatch(cms, JOSHI), null, 2))

await writeFile(
  'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/workman_99k_comments.json',
  JSON.stringify({ stats, comments: cms }, null, 2)
)
console.log('\nSaved: workman_99k_comments.json')
