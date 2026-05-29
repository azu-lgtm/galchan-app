// 競合ガル系13ch程度の直近30日動画リサーチ（2026-05-26 自ガル17ポジ訴求ネタ案用）
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
const BASE = 'https://www.googleapis.com/youtube/v3'

// 競合チャンネル一覧（ハンドル or ID）
const COMPETITORS = [
  { name: 'ガルちゃん芸能新聞', handle: 'geinoushimbun' },
  { name: 'ガル姫の商品紹介', channelId: 'UC-Qz5zpSt-Qm-B7j2LCUApg' },
  { name: 'ガルの有益ライフ', handle: 'GirlsCH_BeautyLife' },
  { name: 'ガルちゃん民へ届け', handle: 'garuchanmin' },
  { name: 'がるラッコちゃん', handle: 'garurakkochan' },
  { name: 'ガルカピ商品紹介', handle: 'garucapi-chan' },
  { name: 'どぐうちゃん', handle: 'garudoguu' },
  { name: 'ガルちゃん芸能スレ', handle: 'garuchan.geinou' },
  { name: 'ガルペンちゃん', handle: 'girls_penguin' },
  { name: '有益ガルねこにゃん', handle: 'garuneko-nyan' },
  { name: 'ガルにゃん速報(GALnyan)', handle: 'GALnyan' },
  { name: 'がるザラシちゃんねる', handle: 'girls-zarashi-ch' },
  { name: 'がる猫ちゃん', handle: 'garunekochan' },
  { name: '有益天使ガルちゃんまとめ', handle: 'yuueki-angel' },
  { name: '有益ガールズライフ', handle: 'lgirls-life-yueki' },
  { name: '楽しいとこ取り', handle: 'Tanoshiitokodori-GirlsChannel' },
  { name: 'はなまるがるちゃんねる', handle: 'hanamarugaru' },
  { name: 'ガルちゃんアイランド', handle: 'girlsch_island' },
  { name: '開運ガルねこちゃん', handle: 'garuneko-chan' },
  { name: 'ガルこめちゃん', handle: 'garucome' },
  { name: 'ガルにゃん速報(galnyan)', handle: 'galnyan' },
]

const SINCE = '2026-04-26T00:00:00Z'
const UNTIL = '2026-05-26T23:59:59Z'

async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

// ハンドル→ChannelID
async function resolveChannel(c) {
  if (c.channelId) return { ...c, resolved: c.channelId }
  try {
    const u = `${BASE}/channels?part=id,snippet,contentDetails,statistics&forHandle=@${c.handle}&key=${KEY}`
    const j = await getJSON(u)
    const it = j.items?.[0]
    if (!it) {
      // forHandleが失敗するパターン (アンダースコア・ピリオド・ハイフン)
      // searchで再試行
      const su = `${BASE}/search?part=snippet&q=${encodeURIComponent('@' + c.handle)}&type=channel&maxResults=3&key=${KEY}`
      const sj = await getJSON(su)
      const sit = sj.items?.[0]
      if (sit) return { ...c, resolved: sit.snippet.channelId, title: sit.snippet.title, _via: 'search' }
      return { ...c, resolved: null, _error: 'not_found' }
    }
    return {
      ...c,
      resolved: it.id,
      title: it.snippet.title,
      subscriberCount: +it.statistics?.subscriberCount || 0,
      videoCount: +it.statistics?.videoCount || 0,
      uploads: it.contentDetails?.relatedPlaylists?.uploads,
    }
  } catch (e) {
    return { ...c, resolved: null, _error: e.message }
  }
}

// playlistId経由でuploads一覧（推奨：search APIよりquota安い）
async function fetchUploadsRecent(playlistId, maxItems = 50) {
  const out = []
  let pageToken = ''
  while (out.length < maxItems) {
    const u = `${BASE}/playlistItems?part=contentDetails,snippet&playlistId=${playlistId}&maxResults=50&pageToken=${pageToken}&key=${KEY}`
    const j = await getJSON(u)
    for (const it of (j.items ?? [])) {
      const pub = it.contentDetails?.videoPublishedAt || it.snippet?.publishedAt
      if (!pub) continue
      out.push({
        videoId: it.contentDetails.videoId,
        publishedAt: pub,
        title: it.snippet.title,
      })
    }
    if (!j.nextPageToken) break
    pageToken = j.nextPageToken
    // 直近30日のみ欲しいので、最古のpublishedAtがSINCEより古ければ打ち切り
    const oldest = out[out.length - 1]?.publishedAt
    if (oldest && new Date(oldest) < new Date(SINCE)) break
  }
  // SINCE〜UNTILでフィルタ
  return out.filter(v => v.publishedAt >= SINCE && v.publishedAt <= UNTIL)
}

// videos.list でstats取得 (batch 50)
async function fetchVideoStats(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join(',')
    const u = `${BASE}/videos?part=snippet,statistics,contentDetails&id=${batch}&key=${KEY}`
    const j = await getJSON(u)
    for (const v of (j.items ?? [])) {
      out.push({
        videoId: v.id,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt,
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        duration: v.contentDetails?.duration,
        view: +v.statistics?.viewCount || 0,
        like: +v.statistics?.likeCount || 0,
        comment: +v.statistics?.commentCount || 0,
      })
    }
  }
  return out
}

// ISO8601 PT##M##S → 秒
function parseDuration(iso) {
  if (!iso) return 0
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)
}

function formatDuration(sec) {
  if (sec < 3600) return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  return `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

// 型分類（タイトル文字列ベース）
function classifyType(title) {
  const t = title.toLowerCase()
  // ポジ訴求型: 神/一生使える/買って正解/リピしてる/絶対これ/良かった/最高/おすすめ/買ってよかった/正解
  const positive = /神\S|一生(使|愛用|リピ)|買って(よかった|正解|大正解)|リピ(してる|決定)|絶対これ|本当に良かった|最高だった|大正解|やっと辿り着いた|これは買い|超おすすめ|大満足|心から/
  // 警告型: 買うな/やめろ/カゴに入れるな/危険/絶対買わない/避ける/ヤバい/絶対NG
  const warning = /買うな|やめろ|やめとけ|カゴに入れるな|危険|絶対(買わない|避け|入れない)|ヤバい|やばい|地雷|失敗|後悔|捨てる|ゾッと|怖い|ガッカリ|騙され/
  // 比較型: vs/どっちが/ガチ比較/比較
  const compare = /vs|VS|どっち(が|を)|ガチ比較|比較|徹底比較/
  // 保存版・総集編: 保存版/まとめ/総集編/○○選
  const archive = /保存版|総集編|まとめ.*【|【.*まとめ|完全版|これだけ見て/
  // 暴露型: 元店員/業界の闇/裏側
  const expose = /元(店員|社員|スタッフ|プロ|職員)|業界の(闇|裏)|裏側|内部|秘密|語り|暴露|本音|現役/

  const tags = []
  if (positive.test(title)) tags.push('ポジ訴求')
  if (warning.test(title)) tags.push('警告')
  if (compare.test(title)) tags.push('比較')
  if (archive.test(title)) tags.push('保存版')
  if (expose.test(title)) tags.push('暴露')
  if (tags.length === 0) tags.push('その他')
  return tags
}

async function main() {
  console.log(`== 競合ガル系直近30日リサーチ (${SINCE.slice(0, 10)}〜${UNTIL.slice(0, 10)}) ==`)
  // 1. ハンドル解決
  const resolved = []
  for (const c of COMPETITORS) {
    const r = await resolveChannel(c)
    resolved.push(r)
    console.log(`${r.resolved ? '✅' : '❌'} ${c.name}: ${r.title ?? c.handle ?? c.channelId} (subs:${r.subscriberCount ?? '-'}, vids:${r.videoCount ?? '-'})`)
  }
  // 2. 各chの直近動画取得
  const allVideos = []
  for (const r of resolved) {
    if (!r.uploads) {
      // uploads未取得（searchヒット時）→ channels.list で取り直し
      if (r.resolved) {
        try {
          const cu = `${BASE}/channels?part=contentDetails,snippet,statistics&id=${r.resolved}&key=${KEY}`
          const cj = await getJSON(cu)
          const ci = cj.items?.[0]
          if (ci) {
            r.uploads = ci.contentDetails?.relatedPlaylists?.uploads
            r.title = ci.snippet.title
            r.subscriberCount = +ci.statistics?.subscriberCount || 0
            r.videoCount = +ci.statistics?.videoCount || 0
          }
        } catch (e) { /* skip */ }
      }
    }
    if (!r.uploads) {
      console.log(`⏭️ ${r.name}: uploads playlistなしスキップ`)
      continue
    }
    try {
      const vids = await fetchUploadsRecent(r.uploads, 30)
      console.log(`  -> ${r.name}: 直近30日 ${vids.length}件`)
      for (const v of vids) v._channel = { name: r.name, channelId: r.resolved, subscriberCount: r.subscriberCount }
      allVideos.push(...vids)
    } catch (e) {
      console.log(`❌ ${r.name}: fetch失敗 ${e.message}`)
    }
  }
  console.log(`== 直近30日内 候補動画 合計 ${allVideos.length}件 ==`)
  if (allVideos.length === 0) {
    console.log('動画なし。終了')
    return
  }
  // 3. stats一括取得
  const stats = await fetchVideoStats(allVideos.map(v => v.videoId))
  const statsMap = new Map(stats.map(s => [s.videoId, s]))
  // 4. enrich
  const enriched = allVideos.map(v => {
    const s = statsMap.get(v.videoId)
    if (!s) return null
    return {
      ...v,
      ...s,
      durationSec: parseDuration(s.duration),
      types: classifyType(s.title),
    }
  }).filter(Boolean)
  // 5. ショート除外(60秒以下)
  const longform = enriched.filter(v => v.durationSec >= 60)
  // 6. 再生数順
  longform.sort((a, b) => b.view - a.view)
  // 出力
  console.log('\n== TOP20 (再生数順・60秒以上) ==')
  for (const [i, v] of longform.slice(0, 20).entries()) {
    console.log(`${(i + 1).toString().padStart(2)}. ${v.view.toLocaleString().padStart(7)} 👁 [${v.types.join(',')}] ${v.channelTitle} | ${v.title.slice(0, 70)} (${formatDuration(v.durationSec)}, ${v.publishedAt.slice(0, 10)}, 💬${v.comment} 👍${v.like})`)
  }
  // 7. 型集計
  const typeStat = {}
  for (const v of longform) {
    for (const t of v.types) {
      if (!typeStat[t]) typeStat[t] = { count: 0, totalView: 0, videos: [] }
      typeStat[t].count++
      typeStat[t].totalView += v.view
      typeStat[t].videos.push(v.videoId)
    }
  }
  console.log('\n== 型分類サマリ ==')
  for (const t of Object.keys(typeStat).sort((a, b) => typeStat[b].totalView - typeStat[a].totalView)) {
    const s = typeStat[t]
    console.log(`${t.padEnd(8)}: ${s.count}本 / 合計${s.totalView.toLocaleString()}再生 / 平均${Math.round(s.totalView / s.count).toLocaleString()}再生`)
  }
  // 8. ポジ訴求型TOP10
  const positiveOnly = longform.filter(v => v.types.includes('ポジ訴求'))
  console.log(`\n== ポジ訴求型 TOP10 (${positiveOnly.length}本中) ==`)
  for (const [i, v] of positiveOnly.slice(0, 10).entries()) {
    console.log(`${(i + 1).toString().padStart(2)}. ${v.view.toLocaleString().padStart(7)} 👁 ${v.channelTitle} | ${v.title.slice(0, 80)} (${formatDuration(v.durationSec)}, ${v.publishedAt.slice(0, 10)}, 💬${v.comment})`)
  }
  // 9. 保存
  await writeFile('C:/Users/meiek/Desktop/ClaudeCode-projects/galchan-app/local-tool/competitor_recent_30days.json',
    JSON.stringify({ since: SINCE, until: UNTIL, resolved, total: longform.length, longform, typeStat }, null, 2), 'utf8')
  console.log('\n✅ JSON保存: galchan-app/local-tool/competitor_recent_30days.json')
}

main().catch(e => { console.error('FATAL:', e?.message ?? e); process.exit(1) })
