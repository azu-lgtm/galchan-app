import { NextResponse } from 'next/server'
import { google } from 'googleapis'

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
]

export async function GET() {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!redirectUri) {
    return NextResponse.json(
      { error: 'GOOGLE_REDIRECT_URI が .env.local に未設定です' },
      { status: 500 }
    )
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })

  return NextResponse.redirect(authUrl)
}
