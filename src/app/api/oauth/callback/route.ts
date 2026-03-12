import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return new NextResponse(
      html(`<h1 style="color:red">認証エラー</h1><p>${error}</p><p><a href="/">トップに戻る</a></p>`),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  if (!code) {
    return new NextResponse(
      html('<h1 style="color:red">認証コードが取得できませんでした</h1>'),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI!
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)
    const refreshToken = tokens.refresh_token

    if (!refreshToken) {
      return new NextResponse(
        html(`
          <h1 style="color:orange">⚠️ refresh_token が取得できませんでした</h1>
          <p>Google Cloud Console でアクセスを一度削除してから再認証してください。</p>
          <p><a href="/api/oauth/authorize">再認証する</a></p>
        `),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    return new NextResponse(
      html(`
        <h1 style="color:green">✅ 認証成功！</h1>
        <p>以下のリフレッシュトークンを <code>.env.local</code> の <code>GOOGLE_REFRESH_TOKEN</code> に設定してください：</p>
        <textarea rows="4" style="width:100%;font-family:monospace;font-size:13px;padding:8px">${refreshToken}</textarea>
        <br><br>
        <p>設定後、サーバーを再起動してください（<code>npm run dev</code>）。</p>
        <p><strong>このページは閉じて構いません。</strong></p>
      `),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new NextResponse(
      html(`<h1 style="color:red">トークン交換エラー</h1><pre>${msg}</pre>`),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}

function html(body: string): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>OAuth</title>
  <style>body{font-family:sans-serif;max-width:640px;margin:40px auto;padding:0 16px}</style>
  </head><body>${body}</body></html>`
}
