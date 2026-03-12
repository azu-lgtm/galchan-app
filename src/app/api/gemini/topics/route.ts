import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { callGemini } from '@/lib/ai'
import { getPromptsFromStore } from '@/lib/kv'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { analyticsText, competitorText } = await req.json()

    const prompts = await getPromptsFromStore()

    const prompt = `あなたはガールズちゃんねる系YouTubeチャンネル「40代の失敗回避ch」のネタ出し担当です。

【チャンネル前提】
・ターゲット：47歳女性（40代全般）
・主軸テーマ：商品 と 習慣
・視聴者の心理軸：後悔回避・恥回避・損失回避
・ガルちゃん（ガールズちゃんねる）のリアルな声をベースにしたコンテンツ

【アナリティクスデータ】
${analyticsText || '（データなし）'}

【競合動画データ】
${competitorText || '（データなし）'}

---

上記データを分析し、このチャンネルに適したネタ候補を10件生成してください。

出力形式：必ずJSON配列のみを出力してください。説明文は不要です。

\`\`\`json
[
  {
    "title": "ネタのタイトル（仮タイトル）",
    "description": "どんな内容か2〜3文で説明",
    "angle": "切り口（どんな角度で見せるか）",
    "emotionWords": ["感情ワード1", "感情ワード2"],
    "source": "参考にした競合タイトルや気づきのポイント（あれば）"
  }
]
\`\`\`

条件：
・「商品」「習慣」「Tips」のいずれかに分類できるネタ
・40代女性が「これ見なきゃ」と感じる訴求力のあるネタ
・競合とかぶりすぎない差別化ポイントを意識する
・必ず10件生成すること`

    const raw = await callGemini(prompt, 4096, { jsonMode: true })

    // JSONを抽出
    let topics
    try {
      // コードブロックを除去
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      topics = JSON.parse(cleaned)
    } catch {
      // JSON抽出を試みる
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        topics = JSON.parse(match[0])
      } else {
        throw new Error('JSONパースに失敗しました')
      }
    }

    return NextResponse.json({ topics })
  } catch (err) {
    console.error('topics generation error:', err)
    return NextResponse.json(
      { error: 'ネタ生成に失敗しました: ' + String(err) },
      { status: 500 },
    )
  }
}
