'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { CategorizedTopics } from '@/lib/types'

interface Props {
  onTopicsReady: (topics: CategorizedTopics) => void
  onResumeTopics?: () => void
}

const STEPS = [
  'ガルちゃん掲示板スクレイプ中...',
  'YouTube トレンド動画を取得中...',
  '競合チャンネル動画を取得中...',
  'Geminiがネタを考えています...',
]

export default function GalDashboard({ onTopicsReady, onResumeTopics }: Props) {
  const [loading, setLoading] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setStepIndex(0)

    // ステップ表示のタイマー（実際の処理は1つのAPIコール）
    const timer = setInterval(() => {
      setStepIndex(i => Math.min(i + 1, STEPS.length - 1))
    }, 4000)

    try {
      const res = await fetch('/api/galchan/topics-fetch', { cache: 'no-store' })

      clearInterval(timer)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'ネタ取得に失敗しました')
      }

      const { topics } = await res.json()
      onTopicsReady(topics as CategorizedTopics)
    } catch (err) {
      clearInterval(timer)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message={STEPS[stepIndex]} />
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h2 className="text-lg font-medium text-text-primary">ネタ出し</h2>
        <p className="text-text-secondary text-sm mt-0.5">
          3つのデータ源から自動でネタ候補を15件生成します
        </p>
      </div>

      {/* 前回データ復元 */}
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

      {/* 3枠説明 */}
      <div className="space-y-3">
        <Card padding="sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">💬</span>
            <div>
              <p className="text-sm font-medium text-text-primary">ガルちゃんネタ（5件）</p>
              <p className="text-xs text-text-secondary mt-0.5">ガールズちゃんねる掲示板の直近1ヶ月で盛り上がった40代スレッドから</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">📈</span>
            <div>
              <p className="text-sm font-medium text-text-primary">トレンドネタ（5件）</p>
              <p className="text-xs text-text-secondary mt-0.5">YouTube「40代女性 やめてよかった/後悔」直近6ヶ月・10万再生以上から</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🔍</span>
            <div>
              <p className="text-sm font-medium text-text-primary">競合ネタ（5件）</p>
              <p className="text-xs text-text-secondary mt-0.5">競合7チャンネルの直近6ヶ月・3万再生以上の動画から</p>
              <p className="text-xs text-text-secondary/60 mt-1">
                がるねこ / ガルペンギン / がるえねが / ガルアイランド / GALにゃん / 有益エンジェル / ガルざらし
              </p>
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <Button onClick={handleGenerate} className="w-full" size="lg">
        ✨ ネタ候補を自動取得する（計15件）
      </Button>

      <button
        onClick={() => onTopicsReady({ galchan: [], trends: [], competitors: [] })}
        className="w-full text-sm text-text-secondary hover:text-accent py-1 transition-colors"
      >
        ✏️ テーマを手動で入力して台本を作る
      </button>
    </div>
  )
}
