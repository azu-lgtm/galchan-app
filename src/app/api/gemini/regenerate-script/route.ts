import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { streamGemini, STREAM_HEADERS } from '@/lib/ai'
import type { GalTopicCandidate, ScriptStyle } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const {
      script,
      topic,
      style,
      instruction,
    }: {
      script: string
      topic: GalTopicCandidate
      style: ScriptStyle
      instruction: string
    } = await req.json()

    const prompt = `以下の台本を、指示に従って修正・再生成してください。

【現在の台本】
${script}

---

【修正指示】
${instruction}

---

【ルール】
・出力形式：【話者名】本文 の形式で1行1セリフ（変更なし）
・見出し記号（#）は使わない
・台本の合計文字数：8400〜8600文字（厳守）
・不足の場合はスレ民のセリフを追加すること
・登場人物：ナレーション、タイトル、イッチ、スレ民1〜6
・指示された箇所のみ修正し、それ以外は元の台本を維持する

修正後の台本を出力してください（説明文なし・台本のみ）。`

    const stream = streamGemini(prompt, 8192)
    return new NextResponse(stream, { headers: STREAM_HEADERS })
  } catch (err) {
    console.error('regenerate-script error:', err)
    return NextResponse.json(
      { error: '再生成に失敗しました: ' + String(err) },
      { status: 500 },
    )
  }
}
