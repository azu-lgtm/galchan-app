'use client'

import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import LoadingSpinner from '../ui/LoadingSpinner'
import type { VideoComment, CommentReply, ChannelVideo } from '@/lib/types'

interface CommentListProps {
  video: ChannelVideo
  onBack: () => void
}

type CommentFilter = 'unreplied' | 'reply_threads' | 'replied'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const repliesKey = (videoId: string) => `gc_replies_${videoId}`
const skippedKey = (videoId: string) => `gc_skipped_${videoId}`

export default function CommentList({ video, onBack }: CommentListProps) {
  const [comments, setComments] = useState<VideoComment[]>([])
  const [replies, setReplies] = useState<CommentReply[]>([])
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<CommentFilter>('unreplied')
  const [scriptContent, setScriptContent] = useState('')
  const [scriptUrl, setScriptUrl] = useState('')
  const [loadingComments, setLoadingComments] = useState(true)
  const [generatingReplies, setGeneratingReplies] = useState(false)
  const [postingAll, setPostingAll] = useState(false)
  const [error, setError] = useState('')
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [regenInstructions, setRegenInstructions] = useState<Record<string, string>>({})
  const [showRegenInput, setShowRegenInput] = useState<Record<string, boolean>>({})

  // 起動時: スキップ復元 → 自動コメント取得
  useEffect(() => {
    try {
      const savedSkipped = localStorage.getItem(skippedKey(video.id))
      if (savedSkipped) {
        const s: string[] = JSON.parse(savedSkipped)
        if (s.length > 0) setSkippedIds(new Set(s))
      }
    } catch {}

    fetch('/api/skipped-comments')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.map) return
        const remote: string[] = data.map[video.id] ?? []
        if (remote.length === 0) return
        setSkippedIds(prev => new Set([...Array.from(prev), ...remote]))
      })
      .catch(() => {})

    handleLoadComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id])

  // スキップが変わるたびに保存（localStorage + KV）
  useEffect(() => {
    try {
      if (skippedIds.size > 0) {
        localStorage.setItem(skippedKey(video.id), JSON.stringify(Array.from(skippedIds)))
      } else {
        localStorage.removeItem(skippedKey(video.id))
      }
    } catch {}

    fetch('/api/skipped-comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: video.id, commentIds: Array.from(skippedIds) }),
    }).catch(() => {})
  }, [skippedIds, video.id])

  // 返信が変わるたびに保存
  useEffect(() => {
    if (replies.length === 0) return
    try {
      const unposted = replies.filter(r => !r.posted)
      if (unposted.length > 0) {
        localStorage.setItem(repliesKey(video.id), JSON.stringify({ replies, comments }))
      } else {
        localStorage.removeItem(repliesKey(video.id))
      }
    } catch {}
  }, [replies, comments, video.id])

  // 全コメントがスキップ or 投稿済みになったら自動完了
  useEffect(() => {
    if (!commentsLoaded || comments.length === 0) return
    const postedIds = new Set(replies.filter(r => r.posted).map(r => r.commentId))
    const allHandled = comments.every(c => skippedIds.has(c.id) || postedIds.has(c.id))
    if (allHandled) {
      markVideoDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skippedIds, replies, comments, commentsLoaded, video.id])

  const markVideoDone = () => {
    fetch('/api/done-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: video.id }),
    }).catch(() => {})
  }

  const handleLoadComments = async () => {
    setLoadingComments(true)
    setError('')

    const currentUnpostedReplies = replies.filter(r => !r.posted && !skippedIds.has(r.commentId))

    try { localStorage.removeItem(repliesKey(video.id)) } catch {}

    try {
      const [commentsRes, scriptRes] = await Promise.allSettled([
        fetch(`/api/youtube/comments?videoId=${video.id}`),
        fetch(`/api/google/script?videoTitle=${encodeURIComponent(video.title)}`),
      ])

      if (commentsRes.status === 'fulfilled' && commentsRes.value.ok) {
        const data = await commentsRes.value.json()
        const freshComments: VideoComment[] = data.comments ?? []

        setComments(freshComments)

        const freshIds = new Set(freshComments.map((c: VideoComment) => c.id))
        const currentSkipped = skippedIds
        const mergedReplies = currentUnpostedReplies.filter(r =>
          freshIds.has(r.commentId) && !currentSkipped.has(r.commentId),
        )
        setReplies(mergedReplies)

        setSkippedIds(prev => new Set(Array.from(prev).filter(id => freshIds.has(id))))

        if (freshComments.length === 0) {
          markVideoDone()
        }
      } else {
        throw new Error('コメントの取得に失敗しました')
      }

      if (scriptRes.status === 'fulfilled' && scriptRes.value.ok) {
        const data = await scriptRes.value.json()
        setScriptContent(data.script || '')
        setScriptUrl(data.docUrl || '')
      }

      setCommentsLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoadingComments(false)
    }
  }

  const handleSkip = (commentId: string) => {
    const isCurrentlySkipped = skippedIds.has(commentId)
    setSkippedIds(prev => {
      const next = new Set(prev)
      if (next.has(commentId)) {
        next.delete(commentId)
      } else {
        next.add(commentId)
      }
      return next
    })
    if (!isCurrentlySkipped) {
      setReplies(prev => prev.filter(r => r.commentId !== commentId || r.posted))
    }
  }

  const handleGenerateReplies = async () => {
    const currentReplyMap = new Map(replies.map(r => [r.commentId, r]))
    const commentsToGenerate = comments.filter(c => !skippedIds.has(c.id) && !currentReplyMap.has(c.id))
    if (commentsToGenerate.length === 0) return
    setGeneratingReplies(true)
    setError('')

    try {
      const res = await fetch('/api/claude/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: commentsToGenerate.map((c) => ({
            id: c.id,
            authorName: c.authorName,
            text: c.text,
          })),
          script: scriptContent,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '返信生成に失敗しました')
      }

      const data = await res.json()
      const apiMap = new Map(data.replies.map((r: { commentId: string; reply: string }) => [r.commentId, r.reply]))

      const newReplies = commentsToGenerate.map((c) => ({
        commentId: c.id,
        authorName: c.authorName,
        commentText: c.text,
        generatedReply: (apiMap.get(c.id) as string) || '返信文の生成に失敗しました',
        edited: false,
        posted: false,
      }))

      setReplies(prev => [...prev, ...newReplies])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setGeneratingReplies(false)
    }
  }

  const handleRegenerateReply = async (reply: CommentReply, instruction?: string) => {
    setReplies((prev) =>
      prev.map((r) => (r.commentId === reply.commentId ? { ...r, regenerating: true } : r)),
    )
    try {
      const res = await fetch('/api/claude/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: [{ id: reply.commentId, authorName: reply.authorName, text: reply.commentText }],
          script: scriptContent,
          instruction: instruction || '',
        }),
      })
      if (!res.ok) throw new Error('再生成に失敗しました')
      const data = await res.json()
      const newReply = data.replies?.[0]?.reply
      if (newReply) {
        setReplies((prev) =>
          prev.map((r) =>
            r.commentId === reply.commentId
              ? { ...r, generatedReply: newReply, edited: false, regenerating: false }
              : r,
          ),
        )
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '再生成に失敗しました')
      setReplies((prev) =>
        prev.map((r) => (r.commentId === reply.commentId ? { ...r, regenerating: false } : r)),
      )
    }
  }

  const handleEditReply = (commentId: string, text: string) => {
    setReplies((prev) =>
      prev.map((r) =>
        r.commentId === commentId ? { ...r, generatedReply: text, edited: true } : r,
      ),
    )
  }

  const handlePostReply = async (reply: CommentReply) => {
    setReplies((prev) =>
      prev.map((r) => (r.commentId === reply.commentId ? { ...r, posting: true } : r)),
    )

    try {
      const res = await fetch('/api/youtube/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: reply.commentId,
          text: reply.generatedReply,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '投稿に失敗しました')
      }

      setReplies((prev) =>
        prev.map((r) => (r.commentId === reply.commentId ? { ...r, posted: true, posting: false } : r)),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : '投稿に失敗しました')
      setReplies((prev) =>
        prev.map((r) => (r.commentId === reply.commentId ? { ...r, posting: false } : r)),
      )
    }
  }

  const handlePostAll = async () => {
    setPostingAll(true)
    const unposted = replies.filter((r) => !r.posted && !skippedIds.has(r.commentId))
    for (const reply of unposted) {
      await handlePostReply(reply)
    }
    setPostingAll(false)
    try { localStorage.removeItem(repliesKey(video.id)) } catch {}
    markVideoDone()
  }

  const handleGenerateAndPostAll = async () => {
    const activeComments = comments.filter(c => !skippedIds.has(c.id))
    if (activeComments.length === 0) return
    setGeneratingReplies(true)
    setError('')

    let generatedReplies: CommentReply[] = []

    try {
      const res = await fetch('/api/claude/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: activeComments.map((c) => ({
            id: c.id,
            authorName: c.authorName,
            text: c.text,
          })),
          script: scriptContent,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '返信生成に失敗しました')
      }

      const data = await res.json()
      const apiMap = new Map(data.replies.map((r: { commentId: string; reply: string }) => [r.commentId, r.reply]))

      generatedReplies = activeComments.map((c) => ({
        commentId: c.id,
        authorName: c.authorName,
        commentText: c.text,
        generatedReply: (apiMap.get(c.id) as string) || '返信文の生成に失敗しました',
        edited: false,
        posted: false,
      }))

      setReplies(generatedReplies)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
      setGeneratingReplies(false)
      return
    } finally {
      setGeneratingReplies(false)
    }

    setPostingAll(true)
    for (const reply of generatedReplies) {
      await handlePostReply(reply)
    }
    setPostingAll(false)
    markVideoDone()
  }

  // 派生値
  const replyMap = new Map(replies.map(r => [r.commentId, r]))
  const activeComments = comments.filter(c => !skippedIds.has(c.id))
  const activeWithoutReply = activeComments.filter(c => !replyMap.has(c.id))
  const unpostedCount = replies.filter(r => !r.posted && !skippedIds.has(r.commentId)).length
  const allPosted = replies.length > 0 && replies.every(r => r.posted || skippedIds.has(r.commentId))

  // フィルタ済みアイテム
  const filteredItems = comments.filter(c => {
    const hasPostedReply = replyMap.get(c.id)?.posted ?? false
    const isSkipped = skippedIds.has(c.id)
    switch (activeFilter) {
      case 'unreplied': return !hasPostedReply && !isSkipped
      case 'reply_threads': return c.isReplyThread ?? false
      case 'replied': return hasPostedReply
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-text-secondary hover:text-text-primary p-1">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium text-text-primary line-clamp-1">{video.title}</h2>
          <p className="text-text-secondary text-xs">コメント数: {video.commentCount}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {!commentsLoaded && !loadingComments && (
        <Button onClick={handleLoadComments} size="lg" className="w-full">
          💬 コメントを読み込む
        </Button>
      )}

      {loadingComments && <LoadingSpinner message="コメントを読み込み中..." />}

      {commentsLoaded && !loadingComments && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setReplies([])
              setSkippedIds(new Set())
              try { localStorage.removeItem(repliesKey(video.id)) } catch {}
              try { localStorage.removeItem(skippedKey(video.id)) } catch {}
              fetch(`/api/skipped-comments?videoId=${encodeURIComponent(video.id)}`, { method: 'DELETE' }).catch(() => {})
            }}
            className="text-xs text-red-400 hover:text-red-600"
          >
            🗑 返信・スキップをリセット
          </button>
          <button onClick={handleLoadComments} className="text-xs text-accent underline">
            🔄 最新コメントを更新
          </button>
        </div>
      )}

      {commentsLoaded && (
        <>
          {scriptUrl && (
            <Card padding="sm" className="bg-accent/5 border-accent/20">
              <p className="text-xs text-accent font-medium">✅ 台本を自動取得しました</p>
              <a href={scriptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent/70 underline">
                台本を確認する →
              </a>
            </Card>
          )}

          {!scriptUrl && (
            <Card padding="sm" className="bg-secondary/30 border-secondary">
              <p className="text-xs text-text-secondary">⚠️ 台本が見つかりませんでした。コメントのみで返信を生成します。</p>
            </Card>
          )}

          {comments.length === 0 ? (
            <Card>
              <p className="text-text-secondary text-sm text-center py-4">未返信コメントはありません 🌸</p>
            </Card>
          ) : (
            <>
              {!generatingReplies && activeWithoutReply.length > 0 && (
                <div className="flex flex-col gap-2">
                  {replies.length === 0 && (
                    <Button
                      onClick={handleGenerateAndPostAll}
                      loading={generatingReplies || postingAll}
                      size="lg"
                      className="w-full"
                    >
                      🚀 一括返信生成＆投稿（確認なし）
                    </Button>
                  )}
                  <Button
                    onClick={handleGenerateReplies}
                    loading={generatingReplies}
                    size="lg"
                    variant="secondary"
                    className="w-full"
                  >
                    🌸 返信文を生成する（{activeWithoutReply.length}件）
                  </Button>
                </div>
              )}

              {(generatingReplies || postingAll) && (
                <LoadingSpinner message={postingAll ? '投稿中...' : '返信文を生成中...'} />
              )}

              {unpostedCount > 0 && (
                <Button onClick={handlePostAll} loading={postingAll} size="lg" className="w-full">
                  🎉 全部投稿する ({unpostedCount}件)
                </Button>
              )}

              {allPosted && unpostedCount === 0 && (
                <Card className="bg-green-50 border-green-200">
                  <p className="text-green-700 text-sm text-center font-medium">
                    🎉 すべての返信を投稿しました！
                  </p>
                </Card>
              )}

              {/* フィルタタブ */}
              {(() => {
                const unrepliedCount = comments.filter(c => !replyMap.get(c.id)?.posted && !skippedIds.has(c.id)).length
                const replyThreadCount = comments.filter(c => c.isReplyThread).length
                const repliedCount = replies.filter(r => r.posted).length
                return (
                  <div className="flex gap-1 bg-secondary/40 rounded-xl p-1">
                    {([
                      { key: 'unreplied' as CommentFilter, label: '未返信', count: unrepliedCount },
                      { key: 'reply_threads' as CommentFilter, label: '新返信', count: replyThreadCount },
                      { key: 'replied' as CommentFilter, label: '返信済み', count: repliedCount },
                    ]).map(({ key, label, count }) => (
                      <button
                        key={key}
                        onClick={() => setActiveFilter(key)}
                        className={`flex-1 text-xs py-1.5 px-1 rounded-lg font-medium transition-all ${
                          activeFilter === key
                            ? 'bg-white text-accent shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {label}{count > 0 ? ` (${count})` : ''}
                      </button>
                    ))}
                  </div>
                )
              })()}

              <div className="space-y-3">
                {filteredItems.map((comment, i) => {
                  const reply = replyMap.get(comment.id) ?? null
                  const isSkipped = skippedIds.has(comment.id)

                  return (
                    <Card key={i} padding="sm" className={isSkipped ? 'opacity-50' : ''}>
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-medium text-text-primary">{comment.authorName}</span>
                          <span className="text-xs text-text-secondary">{formatDate(comment.publishedAt)}</span>
                          {comment.isReplyThread && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              返信への返信
                            </span>
                          )}
                          {reply?.posted && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              ✅ 投稿済み
                            </span>
                          )}
                          {isSkipped && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              スキップ
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleSkip(comment.id)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                isSkipped
                                  ? 'border-accent text-accent bg-accent/5'
                                  : 'border-border-soft text-text-secondary hover:border-accent hover:text-accent'
                              }`}
                            >
                              {isSkipped ? '↩ 戻す' : 'スキップ'}
                            </button>
                            <a
                              href={`https://www.youtube.com/watch?v=${video.id}&lc=${comment.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-accent underline"
                            >
                              YouTube →
                            </a>
                          </div>
                        </div>
                        {comment.isReplyThread && comment.topLevelText && (
                          <p className="text-xs text-text-secondary bg-secondary/20 rounded-lg px-2 py-1 mb-2 line-clamp-2">
                            元コメント: {comment.topLevelText}
                          </p>
                        )}
                        <p className="text-sm text-text-primary">{comment.text}</p>
                      </div>

                      {reply?.posted && (
                        <div className="border-t border-green-200 pt-3">
                          <p className="text-xs font-medium text-green-700 mb-1">あなたの返信</p>
                          <p className="text-sm text-text-primary bg-green-50 rounded-xl px-3 py-2 whitespace-pre-wrap">
                            {reply.generatedReply}
                          </p>
                        </div>
                      )}

                      {reply && !reply.posted && !isSkipped && (
                        <div className="border-t border-border-soft pt-3">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-accent">返信文</label>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setShowRegenInput(prev => ({ ...prev, [reply.commentId]: !prev[reply.commentId] }))}
                                className="text-xs text-text-secondary hover:text-accent px-2 py-1 rounded"
                              >
                                ✏️ こうして
                              </button>
                              <Button
                                onClick={() => {
                                  const instr = regenInstructions[reply.commentId] || ''
                                  handleRegenerateReply(reply, instr)
                                  setShowRegenInput(prev => ({ ...prev, [reply.commentId]: false }))
                                }}
                                loading={reply.regenerating}
                                size="sm"
                                variant="ghost"
                                className="text-xs px-2 py-1 min-h-0 h-auto"
                              >
                                🔄 再生成
                              </Button>
                            </div>
                          </div>
                          {showRegenInput[reply.commentId] && (
                            <div className="mb-2">
                              <input
                                type="text"
                                value={regenInstructions[reply.commentId] || ''}
                                onChange={(e) => setRegenInstructions(prev => ({ ...prev, [reply.commentId]: e.target.value }))}
                                placeholder="指示を入力（例：もっと親しみやすく）"
                                className="w-full px-3 py-2 rounded-xl border border-accent/30 bg-base text-xs text-text-primary focus:outline-none"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleRegenerateReply(reply, regenInstructions[reply.commentId] || '')
                                    setShowRegenInput(prev => ({ ...prev, [reply.commentId]: false }))
                                  }
                                }}
                              />
                            </div>
                          )}
                          <textarea
                            value={reply.generatedReply}
                            onChange={(e) => handleEditReply(reply.commentId, e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-border-soft bg-base text-sm text-text-primary resize-y min-h-[80px]"
                          />
                          <Button
                            onClick={() => handlePostReply(reply)}
                            size="sm"
                            className="w-full mt-2"
                          >
                            ✅ YouTubeに投稿する
                          </Button>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
