'use client'

import { useState } from 'react'
import Button from './ui/Button'

interface LoginFormProps {
  onLogin: () => void
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        onLogin()
      } else {
        const data = await res.json()
        setError(data.error || 'パスワードが正しくありません')
      }
    } catch {
      setError('接続エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🌷</div>
          <h1 className="text-2xl font-medium text-text-primary">ガルちゃん運営ツール</h1>
          <p className="text-text-secondary text-sm mt-1">40代の失敗回避チャンネル</p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft-md border border-border-soft p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                className="w-full px-4 py-3 rounded-xl border border-border-soft bg-base text-text-primary placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent text-sm"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              アプリに入る
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
