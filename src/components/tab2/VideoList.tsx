'use client'

import { useState, useEffect } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import type { ChannelVideo } from '@/lib/types'

interface VideoListProps {
  onVideoSelect: (video: ChannelVideo) => void
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export default function VideoList({ onVideoSelect }: VideoListProps) {
  const [videos, setVideos] = useState<ChannelVideo[]>([])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)

  useEffect(() => {
    loadDoneIds().then(() => fetchVideos())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDoneIds = async () => {
    try {
      const res = await fetch('/api/done-videos')
      if (res.ok) {
        const { ids } = await res.json()
        setDoneIds(new Set(ids ?? []))
      }
    } catch {}
  }

  const fetchVideos = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/youtube/channel-videos')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '動画一覧の取得に失敗しました')
      }
      const data = await res.json()
      const withComments = (data.videos as ChannelVideo[]).filter(
        (v) => parseInt(v.commentCount) > 0,
      )

      // スキップ済みマップをKVから一括取得（端末間同期）
      let skippedMap: Record<string, string[]> = {}
      try {
        const skippedRes = await fetch('/api/skipped-comments')
        if (skippedRes.ok) {
          const { map } = await skippedRes.json()
          skippedMap = map ?? {}
        }
      } catch {}

      // 未返信チェックを先に完了させてからUIに表示
      let filtered: ChannelVideo[] = []
      setCheckFailed(false)
      if (withComments.length > 0) {
        try {
          const ids = withComments.map(v => v.id).join(',')
          const checkRes = await fetch(`/api/youtube/unreplied-check?videoIds=${ids}`)
          if (checkRes.ok) {
            const { result } = await checkRes.json() as { result: Record<string, string[]> }
            if (Object.keys(result).length > 0) {
              filtered = withComments.filter(v => {
                const unrepliedIds = result[v.id] ?? []
                if (unrepliedIds.length === 0) return false
                const skippedSet = new Set(skippedMap[v.id] ?? [])
                return unrepliedIds.some(id => !skippedSet.has(id))
              })
            } else {
              setCheckFailed(true)
            }
          } else {
            setCheckFailed(true)
          }
        } catch {
          setCheckFailed(true)
        }
      }

      setVideos(filtered)

      // 完了済み動画に新しい未返信が来たら done 状態を解除
      if (doneIds.size > 0) {
        const filteredIds = new Set(filtered.map(v => v.id))
        const revivedIds = Array.from(doneIds).filter(id => filteredIds.has(id))
        if (revivedIds.length > 0) {
          fetch('/api/done-videos', { method: 'DELETE' }).catch(() => {})
          setDoneIds(new Set())
        }
      }

      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
      setLoading(false)
    }
  }

  const handleResetDone = async () => {
    try {
      await fetch('/api/done-videos', { method: 'DELETE' })
      setDoneIds(new Set())
    } catch {}
    setShowAll(false)
  }

  if (loading) return <LoadingSpinner message="未返信コメントを確認中..." />

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-red-500 text-sm text-center py-4">⚠️ {error}</p>
        </Card>
        <Button onClick={fetchVideos} variant="secondary" className="w-full">
          再読み込み
        </Button>
      </div>
    )
  }

  const displayVideos = showAll ? videos : videos.filter(v => !doneIds.has(v.id))
  const doneCount = videos.filter(v => doneIds.has(v.id)).length
  const totalDoneCount = doneIds.size

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">
          未返信あり動画 ({displayVideos.length}件)
          {doneCount > 0 && !showAll && (
            <span className="text-text-secondary font-normal ml-1">/ 除外 {doneCount}件</span>
          )}
        </h3>
        <div className="flex gap-2 items-center">
          {doneCount > 0 && (
            <button
              onClick={() => showAll ? handleResetDone() : setShowAll(true)}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              {showAll ? 'リセット' : '全部表示'}
            </button>
          )}
          {totalDoneCount > 0 && doneCount === 0 && (
            <button
              onClick={handleResetDone}
              className="text-xs text-red-400 hover:text-red-600"
            >
              完了リストをリセット({totalDoneCount}件)
            </button>
          )}
          <button onClick={fetchVideos} className="text-xs text-accent hover:text-accent-dark">
            更新
          </button>
        </div>
      </div>

      {checkFailed && (
        <Card>
          <p className="text-amber-600 text-sm text-center py-4">
            ⚠️ 未返信チェックに失敗しました（APIクォータ超過または認証エラー）<br />
            <span className="text-xs text-text-secondary">しばらく後に「更新」を押してください</span>
          </p>
        </Card>
      )}

      {!checkFailed && displayVideos.length === 0 ? (
        <Card>
          <p className="text-text-secondary text-sm text-center py-4">
            未返信コメントはありません 🌸
          </p>
        </Card>
      ) : !checkFailed && (
        <div className="space-y-2">
          {displayVideos.map((video) => (
            <Card key={video.id} padding="sm" className="hover:shadow-soft-md transition-shadow">
              <div className="flex items-start gap-3">
                {video.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-20 h-12 object-cover rounded-lg shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary line-clamp-2 mb-1">{video.title}</p>
                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                    <span>{formatDate(video.publishedAt)}</span>
                    <span>💬 {video.commentCount}件</span>
                  </div>
                </div>
                <Button
                  onClick={() => onVideoSelect(video)}
                  size="sm"
                  className="shrink-0"
                >
                  選択
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
