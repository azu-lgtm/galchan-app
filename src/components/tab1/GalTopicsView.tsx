'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { GalTopicCandidate, CategorizedTopics, ScriptStyle, TopicCategory } from '@/lib/types'
import { SCRIPT_STYLE_LABELS } from '@/lib/types'

interface Props {
  topics: CategorizedTopics
  onScriptReady: (script: string, topic: GalTopicCandidate, style: ScriptStyle) => void
  onBack: () => void
}

const STYLE_ICONS: Record<ScriptStyle, string> = {
  product: '🛍️',
  habit: '🔄',
  tips: '💡',
}

const CATEGORY_CONFIG: Record<TopicCategory, { label: string; icon: string; color: string }> = {
  galchan:     { label: 'ガルちゃんネタ', icon: '💬', color: 'bg-pink-50 border-pink-200' },
  trends:      { label: 'トレンドネタ',   icon: '📈', color: 'bg-blue-50 border-blue-200' },
  competitors: { label: '競合ネタ',       icon: '🔍', color: 'bg-amber-50 border-amber-200' },
}

interface TopicCardProps {
  topic: GalTopicCandidate
  selected: boolean
  savedToObsidian: boolean
  onSelect: () => void
  onSaveObsidian: () => void
  saving: boolean
}

function TopicCard({ topic, selected, savedToObsidian, onSelect, onSaveObsidian, saving }: TopicCardProps) {
  return (
    <div className={`rounded-2xl border transition-all duration-200 ${
      selected ? 'border-accent bg-accent/5 shadow-soft' : 'border-border-soft bg-white hover:border-accent/50'
    }`}>
      <button onClick={onSelect} className="w-full text-left p-4 pb-2">
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
            {topic.source && (
              <p className="text-xs text-text-secondary/60 mt-1.5 line-clamp-1">参考: {topic.source}</p>
            )}
          </div>
          <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 transition-colors ${
            selected ? 'border-accent bg-accent' : 'border-border-soft'
          }`} />
        </div>
      </button>
      {/* Obsidian保存ボタン */}
      <div className="px-4 pb-3">
        <button
          onClick={(e) => { e.stopPropagation(); onSaveObsidian() }}
          disabled={saving || savedToObsidian}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
            savedToObsidian
              ? 'border-green-200 bg-green-50 text-green-600'
              : 'border-border-soft bg-base text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-50'
          }`}
        >
          {savedToObsidian ? '✅ Obsidianに保存済み' : saving ? '保存中...' : '📝 Obsidianに保存'}
        </button>
      </div>
    </div>
  )
}

export default function GalTopicsView({ topics, onScriptReady, onBack }: Props) {
  const [selectedTopic, setSelectedTopic] = useState<GalTopicCandidate | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<ScriptStyle | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [streamText, setStreamText] = useState('')
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const totalCount = topics.galchan.length + topics.trends.length + topics.competitors.length

  const getTopicId = (topic: GalTopicCandidate) => `${topic.category}_${topic.title}`

  const handleSaveObsidian = async (topic: GalTopicCandidate) => {
    const id = getTopicId(topic)
    setSavingIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch('/api/topics/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert('Obsidian保存失敗: ' + (d.error ?? '不明なエラー'))
      } else {
        setSavedIds(prev => new Set(prev).add(id))
      }
    } catch (err) {
      alert('Obsidian保存エラー: ' + String(err))
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleGenerate = async () => {
    if (!selectedTopic || !selectedStyle) return
    setLoading(true)
    setError('')
    setStreamText('')

    try {
      const res = await fetch('/api/gemini/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: selectedTopic, style: selectedStyle }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '台本生成に失敗しました')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
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

  const categories: TopicCategory[] = ['galchan', 'trends', 'competitors']

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-text-secondary hover:text-text-primary transition-colors">
          ← 戻る
        </button>
        <div>
          <h2 className="text-lg font-medium text-text-primary">ネタ候補</h2>
          <p className="text-text-secondary text-sm">{totalCount}件のネタ候補</p>
        </div>
      </div>

      {/* 3カテゴリ表示 */}
      {categories.map(cat => {
        const cfg = CATEGORY_CONFIG[cat]
        const list = topics[cat]
        if (!list.length) return null
        return (
          <div key={cat} className="space-y-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${cfg.color}`}>
              <span>{cfg.icon}</span>
              <span className="text-sm font-medium text-text-primary">{cfg.label}</span>
              <span className="text-xs text-text-secondary ml-auto">{list.length}件</span>
            </div>
            <div className="space-y-2 pl-1">
              {list.map((topic, i) => {
                const id = getTopicId(topic)
                return (
                  <TopicCard
                    key={i}
                    topic={topic}
                    selected={selectedTopic === topic}
                    savedToObsidian={savedIds.has(id)}
                    saving={savingIds.has(id)}
                    onSelect={() => { setSelectedTopic(topic); setSelectedStyle(null) }}
                    onSaveObsidian={() => handleSaveObsidian(topic)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* スタイル選択 */}
      {selectedTopic && (
        <Card>
          <div className="space-y-3">
            <p className="text-sm font-medium text-text-primary">
              選択中: <span className="text-accent">{selectedTopic.title.slice(0, 30)}...</span>
            </p>
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

      {selectedTopic && selectedStyle && (
        <Button onClick={handleGenerate} className="w-full" size="lg">
          ✏️ 台本を生成する（{SCRIPT_STYLE_LABELS[selectedStyle]}）
        </Button>
      )}
    </div>
  )
}
