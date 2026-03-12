'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { GalTopicCandidate } from '@/lib/types'

interface Props {
  onTopicsReady: (topics: GalTopicCandidate[], analyticsText: string, competitorText: string) => void
  onResumeTopics?: () => void
}

export default function GalDashboard({ onTopicsReady, onResumeTopics }: Props) {
  const [analyticsText, setAnalyticsText] = useState('')
  const [competitorText, setCompetitorText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/gemini/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyticsText, competitorText }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'ネタ生成に失敗しました')
      }

      const { topics } = await res.json()
      onTopicsReady(topics, analyticsText, competitorText)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message="Geminiがネタを考えています..." />
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h2 className="text-lg font-medium text-text-primary">ネタ出し</h2>
        <p className="text-text-secondary text-sm mt-0.5">
          アナリティクスと競合データを貼り付けてネタ候補を生成します
        </p>
      </div>

      {onResumeTopics && (
        <Card padding="sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">前回のネタ候補があります</span>
            <Button variant="secondary" size="sm" onClick={onResumeTopics}>
              前回の続きを見る
            </Button>
          </div>
        </Card>
      )}

      {/* アナリティクス */}
      <Card>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">
            アナリティクスデータ
          </label>
          <p className="text-xs text-text-secondary">
            YouTube Studio のアナリティクス画面からコピーして貼り付けてください（任意）
          </p>
          <textarea
            value={analyticsText}
            onChange={(e) => setAnalyticsText(e.target.value)}
            placeholder="再生数、視聴維持率、人気動画タイトルなどを貼り付け..."
            className="w-full h-32 px-3 py-2.5 rounded-xl border border-border-soft bg-base text-text-primary text-sm placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
          />
        </div>
      </Card>

      {/* 競合動画データ */}
      <Card>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">
            競合動画データ
          </label>
          <p className="text-xs text-text-secondary">
            競合チャンネルの動画タイトル・サムネ・再生数などをまとめて貼り付けてください（任意）
          </p>
          <div className="text-xs text-text-secondary bg-secondary/20 rounded-lg px-3 py-2">
            参考競合チャンネル：@garuneko-nyan / @girls_penguin / @garuenega / @girlsch_island / @GALnyan / @yuueki-angel / @girls-zarashi-ch
          </div>
          <textarea
            value={competitorText}
            onChange={(e) => setCompetitorText(e.target.value)}
            placeholder="動画タイトル、サムネイル文言、再生数、投稿日などを貼り付け..."
            className="w-full h-40 px-3 py-2.5 rounded-xl border border-border-soft bg-base text-text-primary text-sm placeholder-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
          />
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <Button onClick={handleGenerate} className="w-full" size="lg">
        ✨ ネタ候補を生成する
      </Button>
    </div>
  )
}
