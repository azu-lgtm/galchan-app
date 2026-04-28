import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ガルちゃん運営ツール',
  description: '40代の失敗回避チャンネル 運営ツール',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <meta httpEquiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body>{children}</body>
    </html>
  )
}
