import { NextRequest, NextResponse } from 'next/server'

/** テキストから最初のJSON配列を抽出する */
function extractJsonArray(text: string): string | null {
  // コードブロック内のJSONを優先
  const fenceMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
  if (fenceMatch) return fenceMatch[1]

  // 最初の [ から対応する ] までを抽出
  const start = text.indexOf('[')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}
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

    // jsonMode不使用（gemini-2.5-flashは思考モデルのためjsonModeが不安定）
    const raw = await callGemini(prompt, 4096)

    // 堅牢なJSON抽出
    let topics
    const extracted = extractJsonArray(raw)
    if (!extracted) throw new Error('JSONの抽出に失敗しました。生のレスポンス: ' + raw.slice(0, 200))
    topics = JSON.parse(extracted)

    return NextResponse.json({ topics })
  } catch (err) {
    console.error('topics generation error:', err)
    return NextResponse.json(
      { error: 'ネタ生成に失敗しました: ' + String(err) },
      { status: 500 },
    )
  }
}
