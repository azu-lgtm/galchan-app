/**
 * Google OAuth コールバック
 * 認証後にGoogleがリダイレクトするURL
 * GOOGLE_REFRESH_TOKEN を画面に表示するので .env.local にコピーして設定する
 */
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) {
    return new NextResponse('認証コードが取得できませんでした', { status: 400 })
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI!
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)
    const refreshToken = tokens.refresh_token

    if (!refreshToken) {
      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:2rem">
          <h2>⚠️ refresh_token が取得できませんでした</h2>
          <p>すでに認証済みの場合は、<a href="/api/oauth/authorize">こちら</a>からもう一度認証してください（prompt=consentを付けてリセットします）</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } },
      )
    }

    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem;max-width:800px">
        <h2>✅ Google OAuth 認証完了</h2>
        <p>以下のトークンを <code>.env.local</code> に設定してください：</p>
        <pre style="background:#f5f5f5;padding:1rem;border-radius:8px;overflow-x:auto">GOOGLE_REFRESH_TOKEN=${refreshToken}</pre>
        <p>設定後、<strong>開発サーバーを再起動</strong>してください（Ctrl+C → npm run dev）</p>
        <hr>
        <p style="color:#666;font-size:0.9rem">このページは閉じても構いません</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  } catch (err) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>❌ トークン取得エラー</h2>
        <pre>${String(err)}</pre>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    )
  }
}
