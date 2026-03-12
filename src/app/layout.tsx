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
      <body>{children}</body>
    </html>
  )
}
