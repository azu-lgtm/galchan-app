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
  markedPosted: boolean
  onSelect: () => void
  onSaveObsidian: () => void
  onMarkPosted: () => void
  saving: boolean
  markingPosted: boolean
}

function TopicCard({
  topic, selected, savedToObsidian, markedPosted,
  onSelect, onSaveObsidian, onMarkPosted, saving, markingPosted,
}: TopicCardProps) {
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

      {/* ネタ元リンク + アクションボタン */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
        {/* ネタ元リンク */}
        {topic.sourceUrl && (
          <a
            href={topic.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border-soft bg-base text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
          >
            🔗 ネタ元を見る
          </a>
        )}

        {/* Obsidian保存 */}
        {!markedPosted && (
          <button
            onClick={(e) => { e.stopPropagation(); onSaveObsidian() }}
            disabled={saving || savedToObsidian}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              savedToObsidian
                ? 'border-green-200 bg-green-50 text-green-600'
                : 'border-border-soft bg-base text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-50'
            }`}
          >
            {savedToObsidian ? '✅ 保存済み' : saving ? '保存中...' : '📝 Obsidianに保存'}
          </button>
        )}

        {/* 投稿済みにする（保存後のみ表示） */}
        {savedToObsidian && !markedPosted && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkPosted() }}
            disabled={markingPosted}
            className="text-xs px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all disabled:opacity-50"
          >
            {markingPosted ? '更新中...' : '🎉 投稿済みにする'}
          </button>
        )}

        {/* 投稿済み表示 */}
        {markedPosted && (
          <span className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-400">
            ✓ 投稿済み
          </span>
        )}
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
  const [savedFilePaths, setSavedFilePaths] = useState<Map<string, string>>(new Map())
  const [markingPostedIds, setMarkingPostedIds] = useState<Set<string>>(new Set())
  const [postedIds, setPostedIds] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)

  const totalCount = topics.galchan.length + topics.trends.length + topics.competitors.length
  const allTopics = [...topics.galchan, ...topics.trends, ...topics.competitors]

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
      const d = await res.json()
      if (!res.ok) {
        alert('Obsidian保存失敗: ' + (d.error ?? '不明なエラー'))
      } else {
        setSavedIds(prev => new Set(prev).add(id))
        if (d.filePath) {
          setSavedFilePaths(prev => new Map(prev).set(id, d.filePath))
        }
      }
    } catch (err) {
      alert('Obsidian保存エラー: ' + String(err))
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleMarkPosted = async (topic: GalTopicCandidate) => {
    const id = getTopicId(topic)
    const filePath = savedFilePaths.get(id)
    if (!filePath) return
    setMarkingPostedIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch('/api/topics/mark-posted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert('投稿済み更新失敗: ' + (d.error ?? '不明なエラー'))
      } else {
        setPostedIds(prev => new Set(prev).add(id))
      }
    } catch (err) {
      alert('投稿済み更新エラー: ' + String(err))
    } finally {
      setMarkingPostedIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleBulkSave = async () => {
    const unsaved = allTopics.filter(t => !savedIds.has(getTopicId(t)))
    if (!unsaved.length) return
    setBulkSaving(true)
    for (const topic of unsaved) {
      await handleSaveObsidian(topic)
    }
    setBulkSaving(false)
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
  const savedCount = savedIds.size

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-text-secondary hover:text-text-primary transition-colors">
          ← 戻る
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-medium text-text-primary">ネタ候補</h2>
          <p className="text-text-secondary text-sm">{totalCount}件のネタ候補</p>
        </div>
        {/* 一括保存ボタン */}
        <button
          onClick={handleBulkSave}
          disabled={bulkSaving || savedCount === totalCount}
          className={`text-xs px-3 py-2 rounded-xl border transition-all whitespace-nowrap ${
            savedCount === totalCount
              ? 'border-green-200 bg-green-50 text-green-600'
              : 'border-border-soft bg-base text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-50'
          }`}
        >
          {savedCount === totalCount
            ? `✅ 全件保存済み`
            : bulkSaving
              ? '保存中...'
              : `📝 全件保存（${totalCount - savedCount}件）`
          }
        </button>
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
                    markedPosted={postedIds.has(id)}
                    saving={savingIds.has(id)}
                    markingPosted={markingPostedIds.has(id)}
                    onSelect={() => { setSelectedTopic(topic); setSelectedStyle(null) }}
                    onSaveObsidian={() => handleSaveObsidian(topic)}
                    onMarkPosted={() => handleMarkPosted(topic)}
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
