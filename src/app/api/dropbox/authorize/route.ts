import { NextResponse } from 'next/server'

export async function GET() {
  const appKey = process.env.DROPBOX_APP_KEY
  if (!appKey) {
    return new NextResponse('DROPBOX_APP_KEY が未設定です', { status: 503 })
  }

  const redirectUri = process.env.DROPBOX_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/dropbox/callback`

  const url = new URL('https://www.dropbox.com/oauth2/authorize')
  url.searchParams.set('client_id', appKey)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('token_access_type', 'offline')
  url.searchParams.set('redirect_uri', redirectUri)

  return NextResponse.redirect(url.toString())
}
