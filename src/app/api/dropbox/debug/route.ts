import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    DROPBOX_APP_KEY:        !!process.env.DROPBOX_APP_KEY,
    DROPBOX_APP_SECRET:     !!process.env.DROPBOX_APP_SECRET,
    DROPBOX_REFRESH_TOKEN:  !!process.env.DROPBOX_REFRESH_TOKEN,
    DROPBOX_REDIRECT_URI:   !!process.env.DROPBOX_REDIRECT_URI,
    DROPBOX_VAULT_PATH:     process.env.DROPBOX_VAULT_PATH ?? '(未設定)',
    APP_KEY_raw_length:     (process.env.DROPBOX_APP_KEY ?? '').length,
    REFRESH_TOKEN_length:   (process.env.DROPBOX_REFRESH_TOKEN ?? '').length,
  })
}
