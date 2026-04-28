// 楽天市場API（Item Search 2026年新仕様 / 20220601）で18商品のアフィリエイトリンクを取得
// Usage: node scripts/rakuten-affiliate-fetch.mjs [output.json]
//
// 新仕様の要点:
//   ENDPOINT: https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601
//   必須HEADER: Referer / Origin / User-Agent
//   必須PARAM: applicationId / accessKey / affiliateId / keyword / hits / sort / format / formatVersion
//   QPS: 1req/sec

import { readFileSync, writeFileSync } from 'fs'

// Load .env.local manually
const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const APP_ID = process.env.RAKUTEN_APP_ID
const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY
if (!APP_ID || !AFF_ID || !ACCESS_KEY) {
  console.error('RAKUTEN_APP_ID / RAKUTEN_AFFILIATE_ID / RAKUTEN_ACCESS_KEY のいずれかが未設定')
  process.exit(1)
}

// 18商品（順序保持）— ユーザー指定リスト
const PRODUCTS = [
  { idx: 1,  name: 'ロキソニンS（第一三共HC）', keyword: 'ロキソニンS 12錠 第一三共' },
  { idx: 2,  name: 'タイレノールA（アリナミン製薬）', keyword: 'タイレノールA' },
  { idx: 3,  name: 'ソフトサンティア（参天製薬）', keyword: 'ソフトサンティア 参天製薬' },
  { idx: 4,  name: 'メラノCC美容液（ロート製薬）', keyword: 'メラノCC 薬用しみ集中対策美容液' },
  { idx: 5,  name: 'カビキラー（ジョンソン）', keyword: 'カビキラー 400g' },
  { idx: 6,  name: 'カビハイター（花王）', keyword: '強力カビハイター 400ml' },
  { idx: 7,  name: 'キュレル ジェルメイク落とし（花王）', keyword: 'キュレル ジェルメイク落とし' },
  { idx: 8,  name: 'ナイアード マハラニヘナ', keyword: 'マハラニ ヘナ' },
  { idx: 9,  name: 'ウェラトーン2+1（コーティ）', keyword: 'ウエラトーン2+1 クリームタイプ' },
  { idx: 10, name: 'クリニカアドバンテージ（ライオン）', keyword: 'クリニカアドバンテージ ハミガキ' },
  { idx: 11, name: 'システマハグキプラス（ライオン）', keyword: 'システマハグキプラス ハミガキ' },
  { idx: 12, name: '3Aマグネシア（健栄製薬）', keyword: '3Aマグネシア 90錠' },
  { idx: 13, name: 'ファンケル マイルドクレンジングオイル（ファンケル）', keyword: 'ファンケル マイルドクレンジングオイル' },
  { idx: 14, name: 'トゥヴェール ビタミンC誘導体ローション', keyword: 'トゥヴェール 薬用ホワイトニングローション' },
  { idx: 15, name: 'ツムラ漢方加味帰脾湯', keyword: 'クラシエ 加味帰脾湯' }, // ツムラは医療用のみで市販なし→クラシエで代替
  { idx: 16, name: '新ビオフェルミンS（大正製薬）', keyword: '新ビオフェルミンS 350錠' },
  { idx: 17, name: 'ツムラ葛根湯', keyword: 'ツムラ 葛根湯' },
  { idx: 18, name: 'クラシエ葛根湯', keyword: 'クラシエ 葛根湯' },
]

const ENDPOINT = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601'

const HEADERS = {
  'Referer': 'https://rakuten.co.jp',
  'Origin': 'https://rakuten.co.jp',
  'User-Agent': 'GalchanYT/1.0',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchOne(p) {
  const params = new URLSearchParams({
    applicationId: APP_ID,
    accessKey: ACCESS_KEY,
    affiliateId: AFF_ID,
    keyword: p.keyword,
    hits: '1',
    sort: '-reviewCount',
    format: 'json',
    formatVersion: '2',
  })
  const url = `${ENDPOINT}?${params.toString()}`
  try {
    const res = await fetch(url, { headers: HEADERS })
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = { error: 'parse_error', error_description: text.slice(0, 200) } }
    if (!res.ok || json.error) {
      return { ...p, ok: false, error: json.error_description || json.error || `HTTP ${res.status}` }
    }
    const item = json.Items?.[0]
    if (!item) return { ...p, ok: false, error: 'no items' }
    // formatVersion=2 → itemはフラット構造
    return {
      ...p,
      ok: true,
      itemName: item.itemName,
      itemPrice: item.itemPrice,
      itemUrl: item.itemUrl,
      affiliateUrl: item.affiliateUrl,
      shopName: item.shopName,
      reviewCount: item.reviewCount,
    }
  } catch (e) {
    return { ...p, ok: false, error: e.message }
  }
}

const results = []
for (const p of PRODUCTS) {
  process.stderr.write(`[${p.idx}/18] ${p.name} ... `)
  const r = await fetchOne(p)
  if (r.ok) {
    const url = r.affiliateUrl || r.itemUrl || ''
    process.stderr.write(`OK ¥${r.itemPrice} ${url.slice(0, 60)}...\n`)
  } else {
    process.stderr.write(`FAIL ${r.error}\n`)
  }
  results.push(r)
  await sleep(1100) // ~1req/sec
}

const out = JSON.stringify(results, null, 2)
const outPath = process.argv[2] || 'scripts/rakuten-results.json'
writeFileSync(outPath, out)
console.log(out)
process.stderr.write(`\nSaved: ${outPath}\n`)
process.stderr.write(`Success: ${results.filter(r => r.ok).length}/${results.length}\n`)
process.stderr.write(`Affiliate URLs (hb.afl): ${results.filter(r => r.ok && (r.affiliateUrl?.includes('hb.afl.rakuten.co.jp'))).length}/${results.length}\n`)
