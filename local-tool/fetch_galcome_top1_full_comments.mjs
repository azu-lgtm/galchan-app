// ガルこめTOP1 (pYiAvUx6W_Q) 物価高×安いの買って正解 全コメ取得
// 自ガル17案A 物価高ネタ詳細リサーチ
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

const VIDEO_ID = 'pYiAvUx6W_Q'  // ガルこめTOP1 物価高×買って正解 39.3万再生
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
  let safety = 50
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

// いいね順上位50件
const top50 = [...cms].sort((a, b) => b.likeCount - a.likeCount).slice(0, 50)
console.log('\n=== TOP50 by likes ===')
for (const c of top50) {
  console.log(`[+${c.likeCount} 💬${c.replyCount}] ${c.text.replace(/\n/g, ' ').slice(0, 250)}`)
}

// カテゴリ判定
const CAT_FOOD = ['食品', '食材', '調味料', '醤油', '味噌', 'コーヒー', '紅茶', '米', '油', '冷凍', '業務スーパー', '業ス', 'PB', 'プライベートブランド', 'ご飯', 'お菓子']
const CAT_COSME = ['化粧水', 'シャンプー', '美容液', 'コスメ', '基礎化粧品', '牛乳石鹸', 'ハトムギ', '菊正宗', '無印', 'ニベア', 'クリーム', 'リップ']
const CAT_DAILY = ['洗剤', 'トイレットペーパー', 'ラップ', 'ティッシュ', '掃除', 'ゴミ袋', 'カネヨ', 'マジックリン', 'パストリーゼ']
const CAT_APPAREL = ['服', '靴', 'ユニクロ', 'GU', 'ワークマン', 'しまむら', '無印', 'タイツ', 'ソックス', 'インナー']
const CAT_HOME = ['ニトリ', '家具', '家電', '掃除機', 'コンロ', '炊飯器', '電気ケトル']
const CAT_KECHIRUNA = ['ケチる', 'ケチっ', '高い方', 'ここはケチる', '安物買い', '結局買い直', '長持ち', '一生もの', '良いやつ', '高くても']

function countMatch(comments, kws) {
  let n = 0
  const samples = []
  for (const c of comments) {
    if (kws.some(k => c.text.includes(k))) {
      n++
      if (samples.length < 8) samples.push({ likes: c.likeCount, text: c.text.replace(/\n/g, ' ').slice(0, 200) })
    }
  }
  return { count: n, ratio: (n / comments.length * 100).toFixed(1) + '%', samples }
}

console.log('\n=== カテゴリ別言及 ===')
console.log('\n[食品系]')
console.log(JSON.stringify(countMatch(cms, CAT_FOOD), null, 2))
console.log('\n[化粧品系]')
console.log(JSON.stringify(countMatch(cms, CAT_COSME), null, 2))
console.log('\n[日用品系]')
console.log(JSON.stringify(countMatch(cms, CAT_DAILY), null, 2))
console.log('\n[服飾系]')
console.log(JSON.stringify(countMatch(cms, CAT_APPAREL), null, 2))
console.log('\n[家具家電系]')
console.log(JSON.stringify(countMatch(cms, CAT_HOME), null, 2))
console.log('\n[ケチるな系]')
console.log(JSON.stringify(countMatch(cms, CAT_KECHIRUNA), null, 2))

await writeFile(
  'C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/galcome_top1_full_comments.json',
  JSON.stringify({ stats, comments: cms }, null, 2)
)
console.log('\nSaved: galcome_top1_full_comments.json')
