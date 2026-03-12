import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { streamGemini, STREAM_HEADERS } from '@/lib/ai'
import { getPromptsFromStore } from '@/lib/kv'
import type { GalTopicCandidate, ScriptStyle } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const {
      topic,
      style,
      analyticsText,
      competitorText,
    }: {
      topic: GalTopicCandidate
      style: ScriptStyle
      analyticsText?: string
      competitorText?: string
    } = await req.json()

    const prompts = await getPromptsFromStore()
    const sp = prompts.script

    const stylePrompt =
      style === 'product' ? sp.product : style === 'habit' ? sp.habit : sp.tips

    const competitorSection =
      competitorText
        ? `\n${sp.competitor_reflection}\n\n【競合動画データ】\n${competitorText}`
        : ''

    const prompt = `${sp.common}

${stylePrompt}
${competitorSection}

${sp.output_rules}

---

【ネタ情報】
タイトル（仮）：${topic.title}
概要：${topic.description}
切り口：${topic.angle}
感情ワード：${topic.emotionWords.join('・')}

${analyticsText ? `【チャンネルアナリティクス】\n${analyticsText}\n` : ''}

上記のネタ情報をもとに、台本を生成してください。`

    const stream = streamGemini(prompt, 8192)
    return new NextResponse(stream, { headers: STREAM_HEADERS })
  } catch (err) {
    console.error('script generation error:', err)
    return NextResponse.json(
      { error: '台本生成に失敗しました: ' + String(err) },
      { status: 500 },
    )
  }
}
