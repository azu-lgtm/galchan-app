/**
 * YouTube コメント取得 API（ガルch・健康chから完全移植）
 * - mode=public: APIキーのみで公開コメント取得（競合分析用）
 * - mode=all:    OAuthで自チャンネル全コメント返却（フィルタなし・分析用）
 * - 既定:        OAuthで自チャンネル未返信コメントのみ返却
 *
 * scope: youtube.force-ssl が OAuth に含まれている前提
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAccessToken } from '@/lib/google'
import { getVideoCommentsOwner, getPublicVideoComments } from '@/lib/youtube-galchan'

export const runtime = 'nodejs'
export const maxDuration = 60

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const videoId = req.nextUrl.searchParams.get('videoId')
  const mode = req.nextUrl.searchParams.get('mode') // 'all' | 'public'
  if (!videoId) {
    return NextResponse.json({ error: 'videoIdが必要です' }, { status: 400 })
  }

  // mode=public: APIキーのみで公開コメント取得
  if (mode === 'public') {
    try {
      const maxResults = parseInt(req.nextUrl.searchParams.get('maxResults') ?? '20')
      const order = (req.nextUrl.searchParams.get('order') ?? 'relevance') as 'relevance' | 'time'
      const comments = await getPublicVideoComments(videoId, maxResults, order)
      return NextResponse.json({ comments })
    } catch (error) {
      console.error('Public comments API error:', error)
      return NextResponse.json({ comments: [], error: 'コメント取得失敗' })
    }
  }

  try {
    const accessToken = await getAccessToken()

    // 自チャンネルIDを取得（自分のコメントを除外するため）
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const channelData = await channelRes.json()
    const ownChannelId = channelData.items?.[0]?.id ?? ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let threads: any[] = []
    try {
      threads = await getVideoCommentsOwner(videoId, accessToken)
    } catch (commentErr) {
      const errMsg = commentErr instanceof Error ? commentErr.message : String(commentErr)
      if (errMsg.includes('403') || errMsg.includes('400') || errMsg.includes('disabled') || errMsg.includes('commentsDisabled')) {
        return NextResponse.json({ comments: [], disabled: true })
      }
      throw commentErr
    }

    // mode=all: フィルタなしで全コメント返却
    if (mode === 'all') {
      const allComments = threads.map((thread: {
        snippet: {
          topLevelComment: {
            snippet: {
              authorDisplayName: string
              authorChannelId?: { value: string }
              textDisplay: string
              publishedAt: string
              likeCount: number
            }
          }
          totalReplyCount: number
        }
      }) => {
        const top = thread.snippet.topLevelComment.snippet
        return {
          author: top.authorDisplayName,
          authorChannelId: top.authorChannelId?.value,
          text: stripHtml(top.textDisplay),
          publishedAt: top.publishedAt,
          likeCount: top.likeCount,
          replyCount: thread.snippet.totalReplyCount,
          isOwnComment: top.authorChannelId?.value === ownChannelId,
        }
      })
      return NextResponse.json({ comments: allComments })
    }

    // 既定: 未返信スレッド or 視聴者が再返信してきたスレッドのみ
    const unreplied = threads
      .filter((thread: {
        snippet: { totalReplyCount: number; topLevelComment: { snippet: { authorChannelId?: { value: string } } } }
        replies?: { comments: { snippet: { authorChannelId?: { value: string }; publishedAt: string } }[] }
      }) => {
        if (thread.snippet.topLevelComment.snippet.authorChannelId?.value === ownChannelId) return false
        if (thread.snippet.totalReplyCount === 0) return true

        const replyComments = thread.replies?.comments
        if (replyComments && replyComments.length > 0) {
          const lastReply = replyComments[replyComments.length - 1]
          if (lastReply.snippet?.authorChannelId?.value !== ownChannelId) return true
        }
        return false
      })
      .map((thread: {
        id: string
        snippet: {
          topLevelComment: {
            id: string
            snippet: {
              authorDisplayName: string
              authorChannelId?: { value: string }
              textDisplay: string
              publishedAt: string
              likeCount: number
            }
          }
          totalReplyCount: number
        }
        replies?: { comments: { snippet: { authorDisplayName: string; authorChannelId?: { value: string }; textDisplay: string; publishedAt: string } }[] }
      }) => {
        const topLevel = thread.snippet.topLevelComment
        const replyComments = thread.replies?.comments
        const lastReply = replyComments && replyComments.length > 0 ? replyComments[replyComments.length - 1] : null
        const isReplyThread = !!(lastReply && lastReply.snippet?.authorChannelId?.value !== ownChannelId && thread.snippet.totalReplyCount > 0)

        const displayComment = isReplyThread && lastReply
          ? { authorName: lastReply.snippet.authorDisplayName, text: stripHtml(lastReply.snippet.textDisplay), publishedAt: lastReply.snippet.publishedAt }
          : { authorName: topLevel.snippet.authorDisplayName, text: stripHtml(topLevel.snippet.textDisplay), publishedAt: topLevel.snippet.publishedAt }

        return {
          id: topLevel.id,
          threadId: thread.id,
          authorName: displayComment.authorName,
          authorChannelId: topLevel.snippet.authorChannelId?.value,
          text: displayComment.text,
          publishedAt: displayComment.publishedAt,
          likeCount: topLevel.snippet.likeCount,
          replyCount: thread.snippet.totalReplyCount,
          isReplyThread,
          topLevelText: isReplyThread ? stripHtml(topLevel.snippet.textDisplay) : undefined,
        }
      })

    return NextResponse.json({ comments: unreplied })
  } catch (error) {
    console.error('Comments API error:', error)
    return NextResponse.json(
      { error: 'コメントの取得に失敗しました' },
      { status: 500 },
    )
  }
}
