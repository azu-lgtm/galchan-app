// 自ガル9 追加6商品の楽天アフィリエイトリンクを取得
import { readFileSync, writeFileSync } from 'fs'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const APP_ID = process.env.RAKUTEN_APP_ID
const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID
const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY

const PRODUCTS = [
  { idx: 1, name: 'シャボン玉 重曹680g', keyword: 'シャボン玉石けん 重曹 680g' },
  { idx: 2, name: 'ファンケル えんきん', keyword: 'ファンケル えんきん 30日分' },
  { idx: 3, name: 'リアップリジェンヌ', keyword: 'リアップリジェンヌ 60ml 大正製薬' },
  { idx: 4, name: 'アヴァンセ ラッシュセラムEX', keyword: 'アヴァンセ ラッシュセラム EX 7ml' },
  { idx: 5, name: 'マジョマジョ ラッシュジェリードロップEX', keyword: 'マジョリカマジョルカ ラッシュジェリードロップ EX プレミアム' },
  { idx: 6, name: 'アズノールうがい液', keyword: 'アズレン うがい液 4%' },
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
    return {
      ...p,
      ok: true,
      itemName: item.itemName,
      affiliateUrl: item.affiliateUrl,
      itemPrice: item.itemPrice,
      shopName: item.shopName,
    }
  } catch (e) {
    return { ...p, ok: false, error: e.message }
  }
}

const results = []
for (const p of PRODUCTS) {
  const r = await fetchOne(p)
  results.push(r)
  console.log(`[${p.idx}] ${p.name}: ${r.ok ? '✅ ' + r.itemPrice + '円' : '❌ ' + r.error}`)
  if (r.ok) console.log(`    URL: ${r.affiliateUrl}`)
  await sleep(1100)
}

writeFileSync('./scripts/rakuten-results-gal9-additions.json', JSON.stringify(results, null, 2))
console.log('\n✅ results saved to rakuten-results-gal9-additions.json')
