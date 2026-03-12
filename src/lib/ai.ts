/**
 * Gemini専用AI呼び出し（galchan-app は Gemini Flash のみ使用）
 */
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

const DEFAULT_MODEL = 'gemini-2.5-flash'

/**
 * ストリーミング呼び出し — ReadableStream<Uint8Array> を返す
 */
export function streamGemini(
  prompt: string,
  maxTokens: number = 8192,
  options?: { jsonMode?: boolean; model?: string },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const model = options?.model ?? DEFAULT_MODEL

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const geminiModel = genAI.getGenerativeModel({
          model,
          generationConfig: {
            maxOutputTokens: Math.min(maxTokens, 65536),
            ...(options?.jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        })
        const result = await geminiModel.generateContentStream(prompt)
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}

/**
 * 非ストリーミング呼び出し — テキストを返す（503時は1.5-flashにフォールバック）
 */
export async function callGemini(
  prompt: string,
  maxTokens: number = 8192,
  options?: { jsonMode?: boolean; model?: string },
): Promise<string> {
  const models = [options?.model ?? DEFAULT_MODEL, 'gemini-1.5-flash']

  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    try {
      const geminiModel = genAI.getGenerativeModel({
        model,
        generationConfig: {
          maxOutputTokens: Math.min(maxTokens, 65536),
          ...(options?.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      })
      const result = await geminiModel.generateContent(prompt)
      return result.response.text()
    } catch (err) {
      const isOverload = String(err).includes('503') || String(err).includes('overloaded') || String(err).includes('high demand')
      if (isOverload && i < models.length - 1) {
        console.warn(`[ai] ${model} 高負荷 → ${models[i + 1]} にフォールバック`)
        continue
      }
      throw err
    }
  }
  throw new Error('全モデルで失敗しました')
}

export const STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
}
