import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { callGemini } from '@/lib/ai'
import { getPromptsFromStore, getNextSerialNumber } from '@/lib/kv'
import type { GalTopicCandidate, ScriptStyle, GalMaterials } from '@/lib/types'

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
    }: {
      script: string
      topic: GalTopicCandidate
      style: ScriptStyle
    } = await req.json()

    const prompts = await getPromptsFromStore()
    const mp = prompts.materials

    // 採番取得
    const serialNum = await getNextSerialNumber()
    const serialLabel = `【外ガル${serialNum}】`

    const prompt = `${mp.common}

【ネタ情報】
タイトル（仮）：${topic.title}
スタイル：${style}

【台本本文】
${script}

---

以下のJSON形式で素材を生成してください。

\`\`\`json
{
  "titles": ["タイトル案1", "タイトル案2", "タイトル案3"],
  "thumbnails": ["サムネ文言1", "サムネ文言2", "サムネ文言3"],
  "description": "概要欄テキスト（動画説明＋ハッシュタグ＋固定テンプレ）",
  "metaTags": "タグ1,タグ2,タグ3,...",
  "pinComment": "固定コメントテキスト",
  "productList": []
}
\`\`\`

各素材のルール：

${mp.title}

${mp.thumbnail}

${mp.description}

${mp.tags}

${mp.fixed_comment}

${style === 'product' ? mp.product_list_extraction : '商品系スタイルではないため productList は空配列 [] にしてください。'}

出力はJSONのみ。説明文は不要です。`

    const raw = await callGemini(prompt, 8192, { jsonMode: true })

    let materials: GalMaterials
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      materials = JSON.parse(cleaned)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        materials = JSON.parse(match[0])
      } else {
        throw new Error('JSONパースに失敗しました')
      }
    }

    materials.serialNumber = serialLabel

    return NextResponse.json({ materials })
  } catch (err) {
    console.error('materials generation error:', err)
    return NextResponse.json(
      { error: '素材生成に失敗しました: ' + String(err) },
      { status: 500 },
    )
  }
}
