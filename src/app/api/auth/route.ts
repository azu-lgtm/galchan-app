import { NextRequest, NextResponse } from 'next/server'
import { getAuthCookieName, getAuthCookieValue } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()

    if (password !== process.env.APP_PASSWORD) {
      return NextResponse.json({ error: 'パスワードが正しくありません' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(getAuthCookieName(), getAuthCookieValue(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(getAuthCookieName())
  return response
}
