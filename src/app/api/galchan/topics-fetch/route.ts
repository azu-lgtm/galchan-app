import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { callGemini } from '@/lib/ai'
import { getTrendTopics, getCompetitorTopics, scrapeGirlsChannel } from '@/lib/youtube-galchan'
import type { CategorizedTopics, GalTopicCandidate } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

function extractJsonObject(text: string): string | null {
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
  if (fenceMatch) return fenceMatch[1]
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 3枠のデータを並列取得
    const [galchanThreads, trendVideos, competitorData] = await Promise.all([
      scrapeGirlsChannel(),
      getTrendTopics(),
      getCompetitorTopics(),
    ])

    // Geminiに3枠分のデータを渡してネタ生成
    const galchanSection = galchanThreads.length > 0
      ? galchanThreads.map(t => `・${t.title}`).join('\n')
      : '（データ取得できませんでした）'

    const trendsSection = trendVideos.length > 0
      ? trendVideos.map(v => `・${v.title}（${parseInt(v.viewCount).toLocaleString()}再生）`).join('\n')
      : '（データなし）'

    const competitorSection = competitorData.length > 0
      ? competitorData.map(ch =>
          `【${ch.channelName}】\n` + ch.videos.map(v => `  ・${v.title}（${parseInt(v.viewCount).toLocaleString()}再生）`).join('\n')
        ).join('\n')
      : '（データなし）'

    const prompt = `あなたはガールズちゃんねる系YouTubeチャンネル「40代の失敗回避ch」のネタ出し担当です。

【チャンネル前提】
・ターゲット：47歳女性（40代全般）
・主軸テーマ：商品 と 習慣
・視聴者の心理軸：後悔回避・恥回避・損失回避
・ガルちゃん（ガールズちゃんねる）のリアルな声をベースにしたコンテンツ

---

【枠1: ガルちゃんスレッド（直近1ヶ月で盛り上がった40代スレッド）】
${galchanSection}

【枠2: トレンドネタ（YouTube 40代女性向け 直近6ヶ月 10万再生以上）】
${trendsSection}

【枠3: 競合ネタ（競合チャンネル 直近6ヶ月 3万再生以上）】
${competitorSection}

---

上記3枠のデータを分析し、各枠から5件ずつ、合計15件のYouTubeネタ候補を生成してください。

出力形式：必ずJSON objectのみを出力。説明文は不要。

\`\`\`json
{
  "galchan": [
    {
      "title": "ネタのタイトル（仮タイトル）",
      "description": "どんな内容か2〜3文で説明",
      "angle": "切り口（どんな角度で見せるか）",
      "emotionWords": ["感情ワード1", "感情ワード2"],
      "source": "参考にしたスレッドタイトルや気づき"
    }
  ],
  "trends": [ /* 同じ形式で5件 */ ],
  "competitors": [ /* 同じ形式で5件 */ ]
}
\`\`\`

条件：
・40代女性が「これ見なきゃ」と感じる訴求力のあるネタ
・後悔回避・損失回避・恥回避の心理を突いた切り口
・各枠必ず5件生成すること`

    const raw = await callGemini(prompt, 16384)
    const extracted = extractJsonObject(raw)
    if (!extracted) {
      throw new Error('JSONの抽出に失敗しました。レスポンス先頭: ' + raw.slice(0, 300))
    }

    const parsed = JSON.parse(extracted) as { galchan: GalTopicCandidate[]; trends: GalTopicCandidate[]; competitors: GalTopicCandidate[] }

    // category フィールドを付与
    const categorized: CategorizedTopics = {
      galchan:     (parsed.galchan     ?? []).map(t => ({ ...t, category: 'galchan' as const })),
      trends:      (parsed.trends      ?? []).map(t => ({ ...t, category: 'trends' as const })),
      competitors: (parsed.competitors ?? []).map(t => ({ ...t, category: 'competitors' as const })),
    }

    return NextResponse.json({
      topics: categorized,
      meta: {
        galchanCount:    galchanThreads.length,
        trendCount:      trendVideos.length,
        competitorCount: competitorData.reduce((s, ch) => s + ch.videos.length, 0),
      },
    })
  } catch (err) {
    console.error('topics-fetch error:', err)
    return NextResponse.json({ error: 'ネタ取得に失敗しました: ' + String(err) }, { status: 500 })
  }
}
