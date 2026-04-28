/**
 * YouTube 非公開アップロード API
 * POST /api/youtube/upload-private
 *
 * Body JSON: {
 *   videoFilePath: string (ローカルMP4絶対パス),
 *   thumbnailPath: string (ローカルPNG/JPG絶対パス),
 *   title: string,
 *   description: string,
 *   tags: string[],
 *   categoryId?: string (default '22' = People & Blogs),
 *   madeForKids?: boolean (default false),
 *   defaultLanguage?: string (default 'ja'),
 * }
 *
 * 重要: privacyStatus='private' ハードコード＋アサーション（public禁止ルール）
 */
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { existsSync, createReadStream } from 'fs'
import { isAuthenticated } from '@/lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 300 // Vercel Hobbyプラン最大5分（元600=10分だがHobbyでは deploy 拒否）

function getAuth() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return client
}

interface UploadBody {
  videoFilePath: string
  thumbnailPath?: string
  title: string
  description: string
  tags: string[]
  categoryId?: string
  madeForKids?: boolean
  defaultLanguage?: string
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  let body: UploadBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON body required' }, { status: 400 })
  }

  const { videoFilePath, thumbnailPath, title, description, tags, categoryId = '22', madeForKids = false, defaultLanguage = 'ja' } = body

  if (!videoFilePath || !title || !description) {
    return NextResponse.json(
      { error: 'videoFilePath / title / description は必須' },
      { status: 400 },
    )
  }

  if (!existsSync(videoFilePath)) {
    return NextResponse.json(
      { error: `動画ファイルが存在しません: ${videoFilePath}` },
      { status: 400 },
    )
  }

  if (thumbnailPath && !existsSync(thumbnailPath)) {
    return NextResponse.json(
      { error: `サムネファイルが存在しません: ${thumbnailPath}` },
      { status: 400 },
    )
  }

  // 絶対変更禁止: privacyStatus='private' ハードコード
  const PRIVACY_STATUS = 'private' as const
  if ((PRIVACY_STATUS as string) !== 'private') {
    throw new Error('SECURITY: privacyStatus must be "private" — public upload is forbidden')
  }

  try {
    const auth = getAuth()
    const youtube = google.youtube({ version: 'v3', auth })

    // 1. 動画本体をアップロード（videos.insert）
    const insertRes = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
          tags,
          categoryId,
          defaultLanguage,
        },
        status: {
          privacyStatus: PRIVACY_STATUS,  // 絶対private
          selfDeclaredMadeForKids: madeForKids,
          embeddable: true,
          publicStatsViewable: true,
        },
      },
      media: {
        body: createReadStream(videoFilePath),
      },
    })

    const videoId = insertRes.data.id
    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId が返ってこなかった（アップロード失敗の可能性）' },
        { status: 500 },
      )
    }

    // 2. サムネアップロード（任意）
    let thumbnailUploaded = false
    if (thumbnailPath) {
      await youtube.thumbnails.set({
        videoId,
        media: {
          body: createReadStream(thumbnailPath),
        },
      })
      thumbnailUploaded = true
    }

    const studioUrl = `https://studio.youtube.com/video/${videoId}/edit`
    const watchUrl = `https://youtu.be/${videoId}`

    return NextResponse.json({
      success: true,
      videoId,
      studioUrl,
      watchUrl,
      privacyStatus: PRIVACY_STATUS,
      thumbnailUploaded,
      message: `✅ 非公開アップロード完了。Studioで商品タグ・広告位置を設定してから公開してください。`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('YouTube upload-private error:', message)
    return NextResponse.json(
      { error: `アップロード失敗: ${message}` },
      { status: 500 },
    )
  }
}
