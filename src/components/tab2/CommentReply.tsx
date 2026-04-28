'use client'

import { useState } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'

// ガルchはYouTube Data API連携を持たないため、コメント本文を貼り付け→AIで返信生成→
// コピー→YouTube Studio手動貼付、の半自動フローとする。
// 健康ch CommunityReply.tsx をベースに、ガル運営者（40代後半女性）向けに調整。

type CommentEntry = {
  id: string
  authorName: string
  commentText: string
  generatedReply: string
  posting?: boolean
  regenerating?: boolean
}

function genId() {
  return 'c_' + Math.random().toString(36).slice(2, 10)
}

export default function CommentReply() {
  const [postContext, setPostContext] = useState('')
  const [entries, setEntries] = useState<CommentEntry[]>([
    { id: genId(), authorName: '', commentText: '', generatedReply: '' },
  ])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const addEntry = () => {
    setEntries(prev => [
      ...prev,
      { id: genId(), authorName: '', commentText: '', generatedReply: '' },
    ])
  }

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const updateEntry = (
    id: string,
    field: 'authorName' | 'commentText' | 'generatedReply',
    value: string,
  ) => {
    setEntries(prev => prev.map(e => (e.id === id ? { ...e, [field]: value } : e)))
  }

  const handleGenerateAll = async () => {
    const targets = entries.filter(e => e.commentText.trim())
    if (targets.length === 0) {
      setError('コメント本文を1件以上入力してください')
      return
    }
    setError('')
    setGenerating(true)
    try {
      const res = await fetch('/api/claude/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: targets.map(e => ({
            id: e.id,
            authorName: e.authorName || '視聴者さん',
            text: e.commentText,
          })),
          script: postContext
            ? `【動画 / 投稿の文脈】\n${postContext}`
            : '（文脈なし）',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '返信生成に失敗しました')
      }
      const data = await res.json()
      const map = new Map<string, string>(
        (data.replies as { commentId: string; reply: string }[]).map(r => [
          r.commentId,
          r.reply,
        ]),
      )
      setEntries(prev =>
        prev.map(e => {
          const gen = map.get(e.id)
          return gen ? { ...e, generatedReply: gen } : e
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerateOne = async (entry: CommentEntry) => {
    if (!entry.commentText.trim()) return
    setEntries(prev =>
      prev.map(e => (e.id === entry.id ? { ...e, regenerating: true } : e)),
    )
    try {
      const res = await fetch('/api/claude/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: [
            {
              id: entry.id,
              authorName: entry.authorName || '視聴者さん',
              text: entry.commentText,
            },
          ],
          script: postContext
            ? `【動画 / 投稿の文脈】\n${postContext}`
            : '（文脈なし）',
        }),
      })
      if (!res.ok) throw new Error('再生成に失敗しました')
      const data = await res.json()
      const newReply = data.replies?.[0]?.reply
      if (newReply) {
        setEntries(prev =>
          prev.map(e =>
            e.id === entry.id
              ? { ...e, generatedReply: newReply, regenerating: false }
              : e,
          ),
        )
      } else {
        setEntries(prev =>
          prev.map(e => (e.id === entry.id ? { ...e, regenerating: false } : e)),
        )
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '再生成に失敗しました')
      setEntries(prev =>
        prev.map(e => (e.id === entry.id ? { ...e, regenerating: false } : e)),
      )
    }
  }

  const handleCopy = async (entry: CommentEntry) => {
    if (!entry.generatedReply) return
    try {
      await navigator.clipboard.writeText(entry.generatedReply)
      setCopiedId(entry.id)
      setTimeout(
        () => setCopiedId(prev => (prev === entry.id ? null : prev)),
        1800,
      )
    } catch {
      alert('クリップボードにコピーできませんでした')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-text-primary">コメント返信</h2>
        <p className="text-text-secondary text-sm mt-0.5">
          視聴者コメントへの返信文をAIで生成します（半自動フロー）
        </p>
      </div>

      <Card padding="sm" className="bg-amber-50 border-amber-200">
        <p className="text-xs text-amber-700 leading-relaxed">
          🌸 コメント本文を貼り付け → AIで返信生成 → コピー → YouTube Studioに手動貼り付け、の半自動フローです。<br />
          ガルch運営者（40代後半女性）として、低姿勢・共感ベースの返信を生成します。
        </p>
      </Card>

      {/* 動画 / 投稿の文脈（任意） */}
      <Card padding="sm">
        <label className="text-xs font-medium text-text-primary mb-1 block">
          動画 / 投稿の文脈（任意・AIが返信時の参考にする）
        </label>
        <textarea
          value={postContext}
          onChange={e => setPostContext(e.target.value)}
          placeholder="例：今回は「40代になって買って後悔した日用品」をテーマに、ガルちゃんの声をまとめた動画です"
          className="w-full px-3 py-2 rounded-xl border border-border-soft bg-base text-sm text-text-primary resize-y min-h-[60px]"
        />
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <Card key={entry.id} padding="sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-secondary">
                コメント {idx + 1}
              </span>
              {entries.length > 1 && (
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  削除
                </button>
              )}
            </div>

            <input
              type="text"
              value={entry.authorName}
              onChange={e => updateEntry(entry.id, 'authorName', e.target.value)}
              placeholder="コメント主の名前（任意）"
              className="w-full px-3 py-2 rounded-xl border border-border-soft bg-base text-xs text-text-primary mb-2"
            />
            <textarea
              value={entry.commentText}
              onChange={e => updateEntry(entry.id, 'commentText', e.target.value)}
              placeholder="コメント本文を貼り付け"
              className="w-full px-3 py-2 rounded-xl border border-border-soft bg-base text-sm text-text-primary resize-y min-h-[70px]"
            />

            {entry.generatedReply && (
              <div className="mt-3 border-t border-border-soft pt-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-accent">
                    生成された返信
                  </label>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => handleRegenerateOne(entry)}
                      loading={entry.regenerating}
                      size="sm"
                      variant="ghost"
                      className="text-xs px-2 py-1 min-h-0 h-auto"
                    >
                      🔄 再生成
                    </Button>
                    <Button
                      onClick={() => handleCopy(entry)}
                      size="sm"
                      className="text-xs px-2 py-1 min-h-0 h-auto"
                    >
                      {copiedId === entry.id ? '✅ コピー済み' : '📋 コピー'}
                    </Button>
                  </div>
                </div>
                <textarea
                  value={entry.generatedReply}
                  onChange={e =>
                    updateEntry(entry.id, 'generatedReply', e.target.value)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-border-soft bg-base text-sm text-text-primary resize-y min-h-[80px]"
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={addEntry} variant="secondary" size="md" className="w-full">
          ＋ コメント欄を追加
        </Button>
        {generating ? (
          <LoadingSpinner message="返信文を生成中..." />
        ) : (
          <Button onClick={handleGenerateAll} size="lg" className="w-full">
            🌸 すべての返信を生成
          </Button>
        )}
      </div>

      <Card padding="sm" className="bg-secondary/20">
        <p className="text-xs text-text-secondary leading-relaxed">
          💡 使い方: コメント本文を貼り付け → 「すべての返信を生成」 → 生成結果を 「📋 コピー」 → YouTube Studioのコメント返信欄に手動で貼り付け。
        </p>
      </Card>
    </div>
  )
}
