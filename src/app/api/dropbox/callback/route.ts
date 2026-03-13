import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return new NextResponse('codeパラメータがありません', { status: 400 })
  }

  const appKey    = process.env.DROPBOX_APP_KEY!
  const appSecret = process.env.DROPBOX_APP_SECRET!
  const redirectUri = process.env.DROPBOX_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/dropbox/callback`

  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: appKey,
      client_secret: appSecret,
      redirect_uri: redirectUri,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new NextResponse('トークン取得失敗: ' + err, { status: 500 })
  }

  const data = await res.json()
  const refreshToken = data.refresh_token

  return new NextResponse(`
    <html><body style="font-family:sans-serif;padding:2rem;background:#f5f0eb">
      <h2>✅ Dropbox認証成功</h2>
      <p>以下のRefresh Tokenを <code>.env.local</code> と Vercel環境変数に設定してください：</p>
      <p><strong>DROPBOX_REFRESH_TOKEN</strong></p>
      <textarea rows="3" style="width:100%;font-size:12px;padding:8px">${refreshToken}</textarea>
      <p style="margin-top:1rem;color:#666">設定後、このページは閉じて構いません。</p>
    </body></html>
  `, { headers: { 'Content-Type': 'text/html' } })
}
