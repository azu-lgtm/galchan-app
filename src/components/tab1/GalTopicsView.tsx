'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { GalTopicCandidate, ScriptStyle } from '@/lib/types'
import { SCRIPT_STYLE_LABELS } from '@/lib/types'

interface Props {
  topics: GalTopicCandidate[]
  analyticsText: string
  competitorText: string
  onScriptReady: (script: string, topic: GalTopicCandidate, style: ScriptStyle) => void
  onBack: () => void
}

const STYLE_ICONS: Record<ScriptStyle, string> = {
  product: '🛍️',
  habit: '🔄',
  tips: '💡',
}

const STYLE_DESCRIPTIONS: Record<ScriptStyle, string> = {
  product: '商品紹介・レビュー・買ってよかった／失敗した系',
  habit: '習慣・ライフスタイル・やめてよかった系',
  tips: '知識・コツ・知らないと損系',
}

export default function GalTopicsView({
  topics,
  analyticsText,
  competitorText,
  onScriptReady,
  onBack,
}: Props) {
  const [selectedTopic, setSelectedTopic] = useState<GalTopicCandidate | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<ScriptStyle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [streamText, setStreamText] = useState('')

  const handleGenerate = async () => {
    if (!selectedTopic || !selectedStyle) return
    setLoading(true)
    setError('')
    setStreamText('')

    try {
      const res = await fetch('/api/gemini/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedTopic,
          style: selectedStyle,
          analyticsText,
          competitorText,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '台本生成に失敗しました')
      }

      // ストリーミング読み取り
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setStreamText(fullText)
      }

      onScriptReady(fullText, selectedTopic, selectedStyle)
    } catch (err) {
      setError(String(err))
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSpinner message="Geminiが台本を生成しています..." />
        {streamText && (
          <Card>
            <div className="text-xs text-text-secondary font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
              {streamText}
            </div>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          ← 戻る
        </button>
        <div>
          <h2 className="text-lg font-medium text-text-primary">ネタ候補</h2>
          <p className="text-text-secondary text-sm">{topics.length}件のネタ候補が生成されました</p>
        </div>
      </div>

      {/* ネタ候補一覧 */}
      <div className="space-y-3">
        {topics.map((topic, i) => (
          <button
            key={i}
            onClick={() => {
              setSelectedTopic(topic)
              setSelectedStyle(null)
            }}
            className={`w-full text-left rounded-2xl border transition-all duration-200 p-4 ${
              selectedTopic === topic
                ? 'border-accent bg-accent/5 shadow-soft'
                : 'border-border-soft bg-white hover:border-accent/50 hover:shadow-soft'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary text-sm leading-snug">{topic.title}</p>
                <p className="text-text-secondary text-xs mt-1 line-clamp-2">{topic.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-xs bg-secondary/40 text-text-secondary rounded-lg px-2 py-0.5">
                    {topic.angle}
                  </span>
                  {topic.emotionWords.slice(0, 3).map((w, j) => (
                    <span key={j} className="text-xs bg-accent/10 text-accent rounded-lg px-2 py-0.5">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
              <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 transition-colors ${
                selectedTopic === topic ? 'border-accent bg-accent' : 'border-border-soft'
              }`} />
            </div>
          </button>
        ))}
      </div>

      {/* スタイル選択（ネタ選択後に表示） */}
      {selectedTopic && (
        <Card>
          <div className="space-y-3">
            <p className="text-sm font-medium text-text-primary">スタイルを選択</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(SCRIPT_STYLE_LABELS) as ScriptStyle[]).map((style) => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(style)}
                  className={`rounded-xl border p-3 text-center transition-all duration-200 ${
                    selectedStyle === style
                      ? 'border-accent bg-accent/5 shadow-soft'
                      : 'border-border-soft bg-base hover:border-accent/50'
                  }`}
                >
                  <div className="text-xl mb-1">{STYLE_ICONS[style]}</div>
                  <div className="text-sm font-medium text-text-primary">{SCRIPT_STYLE_LABELS[style]}</div>
                  <div className="text-xs text-text-secondary mt-0.5 leading-tight hidden sm:block">
                    {STYLE_DESCRIPTIONS[style].split('・')[0]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* 台本生成ボタン */}
      {selectedTopic && selectedStyle && (
        <Button onClick={handleGenerate} className="w-full" size="lg">
          ✏️ 台本を生成する（{SCRIPT_STYLE_LABELS[selectedStyle]}）
        </Button>
      )}
    </div>
  )
}
