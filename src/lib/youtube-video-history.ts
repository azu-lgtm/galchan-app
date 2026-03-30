/**
 * video-history — 投稿履歴の蓄積・更新
 * Obsidian の Markdown テーブルに動画ごとの成績を記録する。
 *
 * フロー:
 *   1. 新動画検出 → addEntry (metrics_fetched: false)
 *   2. 48時間後  → updateMetrics (metrics_fetched: true)
 *   3. 週次     → updateWeeklyViews (7d再生数を追記)
 *
 * OAuth: ガルちゃんアカウント(1)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

// ── 型定義 ──────────────────────────────────

export interface VideoHistoryEntry {
  videoId: string
  title: string
  publishDate: string
  themeType: string
  views48h: string
  views7d: string
  ctr: string
  retention: string
  subscribersGained: string
  likes: string
  comments: string
  judgment: string
  metricsFetched: boolean
  notes: string
}

// ── パス ──────────────────────────────────

const HISTORY_PATH =
  'C:\\Users\\meiek\\Dropbox\\アプリ\\remotely-save\\obsidian\\02_youtube\\ガルちゃんねる\\自分動画\\video-history.md'

// ── テーブルヘッダー ──────────────────────────────────

const TABLE_HEADER = `| videoId | タイトル | 投稿日 | テーマタイプ | 48h再生数 | 7d再生数 | CTR(%) | 維持率(%) | 登録者増 | いいね | コメント | 判定 | metrics_fetched | 備考 |`
const TABLE_SEPARATOR = `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`

// ── 読み込み ──────────────────────────────────

export function readHistory(): VideoHistoryEntry[] {
  if (!existsSync(HISTORY_PATH)) return []

  const content = readFileSync(HISTORY_PATH, 'utf-8')
  const lines = content.split('\n')

  const entries: VideoHistoryEntry[] = []
  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('videoId') || line.startsWith('|---')) continue
    const cols = line.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 14) continue

    entries.push({
      videoId: cols[0],
      title: cols[1],
      publishDate: cols[2],
      themeType: cols[3],
      views48h: cols[4],
      views7d: cols[5],
      ctr: cols[6],
      retention: cols[7],
      subscribersGained: cols[8],
      likes: cols[9],
      comments: cols[10],
      judgment: cols[11],
      metricsFetched: cols[12] === 'true',
      notes: cols[13],
    })
  }

  return entries
}

// ── 書き込み ──────────────────────────────────

export function writeHistory(entries: VideoHistoryEntry[]): void {
  const dir = dirname(HISTORY_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  let md = `# video-history（ガルちゃんねる）\n\n`
  md += `> Post Tracker が自動で書き込み、Playbook が参照する投稿履歴。\n\n`
  md += `${TABLE_HEADER}\n${TABLE_SEPARATOR}\n`

  for (const e of entries) {
    md += `| ${e.videoId} | ${e.title} | ${e.publishDate} | ${e.themeType} | ${e.views48h} | ${e.views7d} | ${e.ctr} | ${e.retention} | ${e.subscribersGained} | ${e.likes} | ${e.comments} | ${e.judgment} | ${e.metricsFetched} | ${e.notes} |\n`
  }

  writeFileSync(HISTORY_PATH, md, 'utf-8')
}

// ── エントリ追加（初回検出時） ──────────────────────────────────

export function addEntry(videoId: string, title: string, publishDate: string): VideoHistoryEntry[] {
  const entries = readHistory()

  // 既に存在する場合はスキップ
  if (entries.find(e => e.videoId === videoId)) return entries

  entries.unshift({
    videoId,
    title,
    publishDate,
    themeType: '-',
    views48h: '-',
    views7d: '-',
    ctr: '-',
    retention: '-',
    subscribersGained: '-',
    likes: '-',
    comments: '-',
    judgment: '-',
    metricsFetched: false,
    notes: '-',
  })

  writeHistory(entries)
  return entries
}

// ── 指標更新（48h後フル判定時） ──────────────────────────────────

export interface MetricsUpdate {
  views48h?: number
  ctr?: number | null
  retention?: number | null
  subscribersGained?: number | null
  likes?: number
  comments?: number
}

export function updateMetrics(videoId: string, metrics: MetricsUpdate): VideoHistoryEntry[] {
  const entries = readHistory()
  const entry = entries.find(e => e.videoId === videoId)
  if (!entry) return entries

  if (metrics.views48h !== undefined) entry.views48h = metrics.views48h.toLocaleString()
  if (metrics.ctr !== undefined && metrics.ctr !== null) entry.ctr = metrics.ctr.toFixed(1)
  if (metrics.retention !== undefined && metrics.retention !== null) entry.retention = metrics.retention.toFixed(1)
  if (metrics.subscribersGained !== undefined && metrics.subscribersGained !== null) entry.subscribersGained = `+${metrics.subscribersGained}`
  if (metrics.likes !== undefined) entry.likes = String(metrics.likes)
  if (metrics.comments !== undefined) entry.comments = String(metrics.comments)

  // 判定ロジック
  const ctrNum = parseFloat(entry.ctr)
  const retNum = parseFloat(entry.retention)
  if (!isNaN(ctrNum) && !isNaN(retNum)) {
    // ガルちゃん閾値: CTR 3.0%, 維持率 30%
    const ctrOk = ctrNum >= 3.0
    const retOk = retNum >= 30.0
    if (ctrOk && retOk) entry.judgment = '✅好調'
    else if (ctrOk || retOk) entry.judgment = '⚠️普通'
    else entry.judgment = '❌不調'
  }

  entry.metricsFetched = true

  writeHistory(entries)
  return entries
}

// ── 7日再生数の更新（週次Detector時） ──────────────────────────────────

export function updateWeeklyViews(videoId: string, views7d: number): VideoHistoryEntry[] {
  const entries = readHistory()
  const entry = entries.find(e => e.videoId === videoId)
  if (!entry) return entries

  entry.views7d = views7d.toLocaleString()

  writeHistory(entries)
  return entries
}

// ── 未取得エントリの一覧 ──────────────────────────────────

export function getUnfetchedEntries(): VideoHistoryEntry[] {
  return readHistory().filter(e => !e.metricsFetched)
}

// ── レポート生成 ──────────────────────────────────

export function formatHistorySummary(): string {
  const entries = readHistory()
  if (entries.length === 0) return '📭 video-history にエントリがありません。'

  const total = entries.length
  const fetched = entries.filter(e => e.metricsFetched).length
  const unfetched = total - fetched
  const good = entries.filter(e => e.judgment.includes('好調')).length
  const bad = entries.filter(e => e.judgment.includes('不調')).length

  let md = `## video-history サマリー（ガルちゃんねる）\n\n`
  md += `- 総エントリ: ${total}本\n`
  md += `- 指標取得済み: ${fetched}本\n`
  md += `- 未取得: ${unfetched}本\n`
  md += `- 好調: ${good}本 / 不調: ${bad}本\n`

  if (unfetched > 0) {
    md += `\n### 未取得の動画\n`
    for (const e of entries.filter(e => !e.metricsFetched)) {
      md += `- ${e.title} (${e.publishDate})\n`
    }
  }

  return md
}
