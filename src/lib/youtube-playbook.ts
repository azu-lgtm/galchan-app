/**
 * Playbook — video-history から成功/失敗パターンを自動抽出
 *
 * video-history の metrics_fetched: true のエントリを分析し、
 * CTR・維持率・テーマ別の傾向をまとめる。
 *
 * OAuth: ガルちゃんアカウント(1)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { readHistory, type VideoHistoryEntry } from './youtube-video-history'

const PLAYBOOK_PATH =
  'C:\\Users\\meiek\\Dropbox\\アプリ\\remotely-save\\obsidian\\02_youtube\\ガルちゃんねる\\自分動画\\playbook.md'

// ── チャンネル固有の閾値 ──────────────────────────────────
const THRESHOLDS = {
  ctrHigh: 5.0,     // CTR 高い
  ctrLow: 2.0,      // CTR 低い
  retHigh: 40.0,    // 維持率 高い
  retLow: 20.0,     // 維持率 低い
  ctrAvg: 3.0,      // チャンネル平均CTR（ガルちゃん）
  retAvg: 30.0,     // チャンネル平均維持率（ガルちゃん）
}

interface PatternItem {
  title: string
  videoId: string
  ctr: number
  retention: number
  themeType: string
}

interface ThemeStats {
  themeType: string
  avgCtr: number
  avgRetention: number
  count: number
  judgment: string
}

export function generatePlaybook(): string {
  const entries = readHistory().filter(e => e.metricsFetched)

  if (entries.length === 0) {
    return '# Playbook（ガルちゃんねる）\n\n> まだ metrics_fetched: true のエントリがありません。Post Tracker でデータを蓄積してください。\n'
  }

  // 数値パース
  const parsed = entries
    .map(e => ({
      title: e.title,
      videoId: e.videoId,
      ctr: parseFloat(e.ctr),
      retention: parseFloat(e.retention),
      themeType: e.themeType,
    }))
    .filter(e => !isNaN(e.ctr) || !isNaN(e.retention))

  // 成功パターン
  const highCtr = parsed.filter(e => !isNaN(e.ctr) && e.ctr >= THRESHOLDS.ctrHigh)
  const highRet = parsed.filter(e => !isNaN(e.retention) && e.retention >= THRESHOLDS.retHigh)

  // 失敗パターン
  const lowCtr = parsed.filter(e => !isNaN(e.ctr) && e.ctr <= THRESHOLDS.ctrLow)
  const lowRet = parsed.filter(e => !isNaN(e.retention) && e.retention <= THRESHOLDS.retLow)

  // テーマ別集計
  const themeMap = new Map<string, { ctrs: number[], rets: number[] }>()
  for (const e of parsed) {
    if (e.themeType === '-') continue
    const current = themeMap.get(e.themeType) ?? { ctrs: [], rets: [] }
    if (!isNaN(e.ctr)) current.ctrs.push(e.ctr)
    if (!isNaN(e.retention)) current.rets.push(e.retention)
    themeMap.set(e.themeType, current)
  }

  const themeStats: ThemeStats[] = Array.from(themeMap.entries()).map(([theme, data]) => {
    const avgCtr = data.ctrs.length > 0 ? data.ctrs.reduce((a, b) => a + b, 0) / data.ctrs.length : 0
    const avgRet = data.rets.length > 0 ? data.rets.reduce((a, b) => a + b, 0) / data.rets.length : 0
    const ctrOk = avgCtr >= THRESHOLDS.ctrAvg
    const retOk = avgRet >= THRESHOLDS.retAvg
    const judgment = ctrOk && retOk ? '✅ 強い' : ctrOk || retOk ? '⚠️ 普通' : '❌ 弱い'
    return { themeType: theme, avgCtr: Math.round(avgCtr * 10) / 10, avgRetention: Math.round(avgRet * 10) / 10, count: Math.max(data.ctrs.length, data.rets.length), judgment }
  })

  // レポート生成
  let md = `# Playbook（ガルちゃんねる）\n\n`
  md += `> video-history から自動抽出（${entries.length}本分析、${new Date().toISOString().split('T')[0]} 更新）\n\n`

  md += `## 成功パターン\n\n`
  if (highCtr.length > 0) {
    md += `### CTR ${THRESHOLDS.ctrHigh}%以上の動画（${highCtr.length}本）\n`
    for (const e of highCtr) md += `- ${e.title} — CTR ${e.ctr}%\n`
    md += '\n'
  }
  if (highRet.length > 0) {
    md += `### 維持率 ${THRESHOLDS.retHigh}%以上の動画（${highRet.length}本）\n`
    for (const e of highRet) md += `- ${e.title} — 維持率 ${e.retention}%\n`
    md += '\n'
  }
  if (highCtr.length === 0 && highRet.length === 0) {
    md += `- まだ突出した成功パターンはありません（データ蓄積中）\n\n`
  }

  md += `## 失敗パターン\n\n`
  if (lowCtr.length > 0) {
    md += `### CTR ${THRESHOLDS.ctrLow}%以下の動画（${lowCtr.length}本）\n`
    for (const e of lowCtr) md += `- ${e.title} — CTR ${e.ctr}%\n`
    md += '\n'
  }
  if (lowRet.length > 0) {
    md += `### 維持率 ${THRESHOLDS.retLow}%以下の動画（${lowRet.length}本）\n`
    for (const e of lowRet) md += `- ${e.title} — 維持率 ${e.retention}%\n`
    md += '\n'
  }
  if (lowCtr.length === 0 && lowRet.length === 0) {
    md += `- 深刻な失敗パターンはありません\n\n`
  }

  if (themeStats.length > 0) {
    md += `## テーマ別成績\n\n`
    md += `| テーマタイプ | 平均CTR | 平均維持率 | 動画数 | 判定 |\n`
    md += `|---|---|---|---|---|\n`
    for (const t of themeStats.sort((a, b) => b.avgCtr - a.avgCtr)) {
      md += `| ${t.themeType} | ${t.avgCtr}% | ${t.avgRetention}% | ${t.count} | ${t.judgment} |\n`
    }
    md += '\n'
  }

  // 全体統計
  const allCtrs = parsed.filter(e => !isNaN(e.ctr)).map(e => e.ctr)
  const allRets = parsed.filter(e => !isNaN(e.retention)).map(e => e.retention)

  if (allCtrs.length > 0 || allRets.length > 0) {
    md += `## 全体統計\n\n`
    if (allCtrs.length > 0) {
      const avgCtr = allCtrs.reduce((a, b) => a + b, 0) / allCtrs.length
      md += `- 平均CTR: ${(Math.round(avgCtr * 10) / 10)}%（${allCtrs.length}本）\n`
    }
    if (allRets.length > 0) {
      const avgRet = allRets.reduce((a, b) => a + b, 0) / allRets.length
      md += `- 平均維持率: ${(Math.round(avgRet * 10) / 10)}%（${allRets.length}本）\n`
    }
  }

  return md
}

export function savePlaybook(): string {
  const md = generatePlaybook()
  const dir = dirname(PLAYBOOK_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(PLAYBOOK_PATH, md, 'utf-8')
  return md
}
