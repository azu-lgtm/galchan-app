/**
 * 未返信コメントチェック API（ガルch・健康chから完全移植）
 * 複数動画の未返信コメントIDマップを一括返却
 * scope: youtube.force-ssl 必須
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAccessToken } from '@/lib/google'

export const runtime = 'nodejs'
export const maxDuration = 60

const BASE_URL = 'https://www.googleapis.com/youtube/v3'

type CommentThread = {
  id: string
  snippet: { totalReplyCount: number; topLevelComment: { snippet: { authorChannelId?: { value: string } } } }
  replies?: { comments: { snippet: { authorChannelId?: { value: string } } }[] }
}

function threadIsUnreplied(thread: CommentThread, ownChannelId: string): boolean {
  if (thread.snippet.topLevelComment.snippet.authorChannelId?.value === ownChannelId) return false
  if (thread.snippet.totalReplyCount === 0) return true
  const replyComments = thread.replies?.comments
  if (replyComments && replyComments.length > 0) {
    const lastReply = replyComments[replyComments.length - 1]
    if (lastReply.snippet?.authorChannelId?.value !== ownChannelId) return true
  }
  return false
}

async function getUnrepliedIds(videoId: string, accessToken: string, ownChannelId: string): Promise<string[]> {
  let pageToken: string | undefined = undefined
  const MAX_PAGES = 3
  const ids: string[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${BASE_URL}/commentThreads`)
    url.searchParams.set('part', 'snippet,replies')
    url.searchParams.set('videoId', videoId)
    url.searchParams.set('maxResults', '100')
    url.searchParams.set('order', 'time')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      if (!res.ok) break
      const data = await res.json()
      const threads: CommentThread[] = data.items ?? []

      for (const t of threads) {
        if (threadIsUnreplied(t, ownChannelId)) ids.push(t.id)
        if (ids.length >= 100) return ids
      }

      pageToken = data.nextPageToken
      if (!pageToken) break
    } catch {
      break
    }
  }
  return ids
}

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const videoIdsParam = req.nextUrl.searchParams.get('videoIds')
  if (!videoIdsParam) return NextResponse.json({ result: {} })

  const videoIds = videoIdsParam.split(',').filter(Boolean).slice(0, 30)

  try {
    const accessToken = await getAccessToken()

    const channelRes = await fetch(
      `${BASE_URL}/channels?part=id&mine=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const channelData = await channelRes.json()
    const ownChannelId = channelData.items?.[0]?.id ?? ''

    const checks = await Promise.allSettled(
      videoIds.map(id => getUnrepliedIds(id, accessToken, ownChannelId)),
    )

    const result: Record<string, string[]> = {}
    videoIds.forEach((id, i) => {
      result[id] = checks[i].status === 'fulfilled' ? (checks[i] as PromiseFulfilledResult<string[]>).value : []
    })

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Unreplied check error:', error)
    return NextResponse.json({ result: {} })
  }
}
