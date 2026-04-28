/**
 * コメント返信生成 API（ガルちゃん版）
 *
 * 健康ch から移植。ガルch 用にカスタマイズ：
 * - Gemini Flash 固定（ガル側は callGemini のみ使用）
 * - 運営者ペルソナは中年女性（既存ガル設定維持）
 * - emoji は ガル向けソフト系（💪は禁止）
 * - GalPromptsStore.comment_reply キーを参照
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getPromptsFromStore, getReplySettingsFromStore } from '@/lib/kv'
import { callGemini } from '@/lib/ai'

export const runtime = 'nodejs'
export const maxDuration = 120

const TONE_MAP = {
  friendly: '親しみやすく丁寧なトーン。温かみのある表現で絵文字（🌸💕😊🙏✨☕など）を適度に使う。相手をリスペクトし低姿勢で。文末表現は毎回変えて単調にしない。',
  formal:   'フォーマルで丁寧なトーン。礼儀正しく敬語を使う。絵文字は控えめに。',
  casual:   'カジュアルで気軽なトーン。同世代の友達に話しかけるような親しみやすい表現。絵文字も積極的に使う。',
}

const LENGTH_MAP = {
  short:  '1〜2文で簡潔に返信する。',
  medium: '2〜4文で返信する。',
  long:   '4〜6文でしっかり返信する。',
}

export async function POST(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  try {
    const { comments, script, instruction } = await req.json()

    if (!comments || !Array.isArray(comments)) {
      return NextResponse.json({ error: 'commentsが必要です' }, { status: 400 })
    }

    const [prompts, replySettings] = await Promise.all([
      getPromptsFromStore(),
      getReplySettingsFromStore(),
    ])
    const promptTemplate = prompts.comment_reply?.content ?? ''

    if (!promptTemplate) {
      return NextResponse.json(
        { error: 'comment_reply プロンプトが未設定です。設定タブからリセットしてください。' },
        { status: 500 },
      )
    }

    const commentsText = comments
      .map((c: { id: string; authorName: string; text: string }, i: number) =>
        `[${i + 1}] ID: ${c.id}\n著者: ${c.authorName}\nコメント: ${c.text}`
      )
      .join('\n\n')

    // 設定オーバーライドブロック
    const settingsBlock = `\n【返信スタイル設定（この設定を優先すること）】\n- 返信者名：${replySettings.name}（${replySettings.persona}）\n- トーン：${TONE_MAP[replySettings.tone]}\n- 長さ：${LENGTH_MAP[replySettings.length]}${replySettings.customRules ? `\n- 追加ルール：${replySettings.customRules}` : ''}\n`

    const instructionBlock = instruction
      ? `\n【追加指示（最優先で反映すること）】\n${instruction}\n`
      : ''

    const prompt = promptTemplate
      .replace('{SCRIPT}', script || '（台本データなし）')
      .replace('{COMMENTS}', commentsText)
      + settingsBlock
      + instructionBlock

    const responseText = await callGemini(prompt, 4000)

    // JSON抽出（```json ブロック対応）
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : responseText

    let replies
    try {
      const parsed = JSON.parse(jsonStr)
      replies = parsed.replies ?? []
    } catch {
      replies = comments.map((c: { id: string }) => ({
        commentId: c.id,
        reply: '返信文の生成に失敗しました。再度お試しください。',
      }))
    }

    return NextResponse.json({ replies })
  } catch (error) {
    console.error('Replies API error:', error)
    return NextResponse.json(
      { error: '返信文の生成に失敗しました' },
      { status: 500 },
    )
  }
}
