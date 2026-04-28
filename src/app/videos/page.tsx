'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

/**
 * 動画投稿準備ページ（ガルちゃん）
 *
 * 機能:
 * - 非公開アップロード（MP4 + サムネ + メタ → ワンクリック）
 * - 固定コメント投稿
 * - 勝ち動画設定取得（参照用）
 *
 * 運用フロー:
 * 1. YMM4でMP4完成 → パス入力
 * 2. Canvaサムネエクスポート → パス入力
 * 3. タイトル・概要・タグはスプシから手動コピペ
 * 4. [非公開アップロード] クリック → videoId返却
 * 5. Studio で商品タグ・広告位置追加 → 公開
 * 6. 公開後 [固定コメント投稿] → Studioで手動ピン留め
 */

const WINNING_VIDEO_ID = 'jLmLV-cqqOk' // 自ガル5（勝ち動画・参照元）

interface UploadResult {
  success: boolean
  videoId?: string
  studioUrl?: string
  watchUrl?: string
  thumbnailUploaded?: boolean
  message?: string
  error?: string
}

interface VideoSettings {
  title?: string
  description?: string
  tags?: string[]
  categoryId?: string
  defaultLanguage?: string
  selfDeclaredMadeForKids?: boolean
  privacyStatus?: string
  duration?: string
  studioUrl?: string
  error?: string
}

export default function VideosPage() {
  // アップロードフォーム
  const [videoFilePath, setVideoFilePath] = useState('')
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [categoryId, setCategoryId] = useState('22')
  const [madeForKids, setMadeForKids] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  // 固定コメント
  const [commentVideoId, setCommentVideoId] = useState('')
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [commentResult, setCommentResult] = useState<UploadResult | null>(null)

  // 勝ち動画参照
  const [refVideoId, setRefVideoId] = useState(WINNING_VIDEO_ID)
  const [fetching, setFetching] = useState(false)
  const [refSettings, setRefSettings] = useState<VideoSettings | null>(null)

  const handleUpload = async () => {
    if (!videoFilePath || !title || !description) {
      alert('MP4パス・タイトル・概要は必須')
      return
    }
    if (!confirm(`非公開アップロード実行します。\n\nタイトル: ${title}\n\npublicではなくprivateでアップされます。よろしい？`)) {
      return
    }
    setUploading(true)
    setUploadResult(null)
    try {
      const res = await fetch('/api/youtube/upload-private', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoFilePath,
          thumbnailPath: thumbnailPath || undefined,
          title,
          description,
          tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
          categoryId,
          madeForKids,
        }),
      })
      const data = await res.json()
      setUploadResult(data)
      if (data.videoId) {
        setCommentVideoId(data.videoId)
      }
    } catch (err) {
      setUploadResult({ success: false, error: err instanceof Error ? err.message : String(err) })
    } finally {
      setUploading(false)
    }
  }

  const handlePostComment = async () => {
    if (!commentVideoId || !commentText) {
      alert('videoId・コメント文は必須')
      return
    }
    setPosting(true)
    setCommentResult(null)
    try {
      const res = await fetch('/api/youtube/post-pinned-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: commentVideoId, commentText }),
      })
      const data = await res.json()
      setCommentResult(data)
    } catch (err) {
      setCommentResult({ success: false, error: err instanceof Error ? err.message : String(err) })
    } finally {
      setPosting(false)
    }
  }

  const handleFetchSettings = async () => {
    if (!refVideoId) return
    setFetching(true)
    setRefSettings(null)
    try {
      const res = await fetch(`/api/youtube/fetch-video-settings?videoId=${encodeURIComponent(refVideoId)}`)
      const data = await res.json()
      setRefSettings(data)
    } catch (err) {
      setRefSettings({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      setFetching(false)
    }
  }

  const inputStyle = 'w-full px-3 py-2 rounded-lg border border-border-soft bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/30'

  return (
    <div className="min-h-screen bg-base py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">🎬 動画投稿準備</h1>
          <p className="text-sm text-text-secondary mt-1">
            MP4アップロード → 商品タグ&広告位置はStudioで手動 → 公開 → 固定コメント投稿
          </p>
          <p className="text-xs text-red-500 mt-2">
            ⚠️ privacyStatus=private 固定。public/unlistedで上がる実装は存在しません。
          </p>
        </div>

        {/* ステップ1: 非公開アップロード */}
        <section className="bg-white rounded-2xl shadow-soft-md border border-border-soft p-6 space-y-4">
          <h2 className="text-lg font-medium text-text-primary">① 非公開アップロード</h2>

          <div>
            <label className="block text-sm text-text-secondary mb-1">MP4ファイル（絶対パス）</label>
            <input
              className={inputStyle}
              value={videoFilePath}
              onChange={e => setVideoFilePath(e.target.value)}
              placeholder="C:\Users\meiek\Desktop\自ガル9.mp4"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">サムネ画像（絶対パス・任意）</label>
            <input
              className={inputStyle}
              value={thumbnailPath}
              onChange={e => setThumbnailPath(e.target.value)}
              placeholder="C:\Users\meiek\Desktop\自ガル9_サムネ.png"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">タイトル（スプシJ列からコピペ）</label>
            <input
              className={inputStyle}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">概要欄（スプシK列からコピペ）</label>
            <textarea
              className={`${inputStyle} min-h-[120px]`}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">タグ（カンマ区切り・スプシL列から）</label>
            <input
              className={inputStyle}
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
              placeholder="ガルちゃん, ゾッとした, 危険商品"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">カテゴリID</label>
              <select
                className={inputStyle}
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="22">22: People & Blogs</option>
                <option value="24">24: Entertainment</option>
                <option value="27">27: Education</option>
                <option value="26">26: How-to & Style</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={madeForKids}
                  onChange={e => setMadeForKids(e.target.checked)}
                />
                子ども向けコンテンツ
              </label>
            </div>
          </div>

          <Button onClick={handleUpload} loading={uploading} className="w-full" size="lg">
            🎬 非公開アップロード実行
          </Button>

          {uploadResult && (
            <div className={`mt-4 p-4 rounded-xl text-sm ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {uploadResult.success ? (
                <>
                  <p className="font-medium text-green-800">{uploadResult.message}</p>
                  <p className="mt-2">videoId: <code className="bg-white px-2 py-1 rounded">{uploadResult.videoId}</code></p>
                  <p className="mt-1">
                    <a href={uploadResult.studioUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                      → YouTube Studio を開く（商品タグ・広告位置設定）
                    </a>
                  </p>
                </>
              ) : (
                <p className="text-red-700">❌ {uploadResult.error}</p>
              )}
            </div>
          )}
        </section>

        {/* ステップ2: 固定コメント投稿 */}
        <section className="bg-white rounded-2xl shadow-soft-md border border-border-soft p-6 space-y-4">
          <h2 className="text-lg font-medium text-text-primary">② 固定コメント投稿（公開後）</h2>
          <p className="text-xs text-text-secondary">
            ⚠️ 動画が公開（またはunlisted）状態でないとコメント不可。公式APIではピン留め自動化不可→Studioで手動ピン留め。
          </p>

          <div>
            <label className="block text-sm text-text-secondary mb-1">videoId（アップロード後自動入力）</label>
            <input
              className={inputStyle}
              value={commentVideoId}
              onChange={e => setCommentVideoId(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">コメント本文（スプシN列から）</label>
            <textarea
              className={`${inputStyle} min-h-[100px]`}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
            />
          </div>

          <Button onClick={handlePostComment} loading={posting} className="w-full">
            📌 コメント投稿（投稿後Studioでピン留め）
          </Button>

          {commentResult && (
            <div className={`mt-4 p-4 rounded-xl text-sm ${commentResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {commentResult.success ? (
                <>
                  <p className="font-medium text-green-800">{commentResult.message}</p>
                  <p className="mt-2">
                    <a href={commentResult.studioUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                      → Studio コメントページへ（ピン留め操作）
                    </a>
                  </p>
                </>
              ) : (
                <p className="text-red-700">❌ {commentResult.error}</p>
              )}
            </div>
          )}
        </section>

        {/* ステップ3: 勝ち動画参照 */}
        <section className="bg-white rounded-2xl shadow-soft-md border border-border-soft p-6 space-y-4">
          <h2 className="text-lg font-medium text-text-primary">③ 勝ち動画設定参照（読み取り専用）</h2>
          <p className="text-xs text-text-secondary">
            CTR実績のある動画の設定を確認し、新動画に踏襲。BANリスク0。
          </p>

          <div className="flex gap-2">
            <input
              className={inputStyle}
              value={refVideoId}
              onChange={e => setRefVideoId(e.target.value)}
              placeholder="videoId"
            />
            <Button onClick={handleFetchSettings} loading={fetching}>
              📥 取得
            </Button>
          </div>

          {refSettings && !refSettings.error && (
            <div className="bg-base rounded-xl p-4 text-sm space-y-2">
              <p><strong>タイトル:</strong> {refSettings.title}</p>
              <p><strong>カテゴリID:</strong> {refSettings.categoryId}</p>
              <p><strong>言語:</strong> {refSettings.defaultLanguage}</p>
              <p><strong>子供向け:</strong> {refSettings.selfDeclaredMadeForKids ? 'はい' : 'いいえ'}</p>
              <p><strong>公開状態:</strong> {refSettings.privacyStatus}</p>
              <p><strong>タグ:</strong> {refSettings.tags?.join(', ') || '(なし)'}</p>
              <details>
                <summary className="cursor-pointer text-text-secondary">概要欄全文</summary>
                <pre className="mt-2 text-xs whitespace-pre-wrap">{refSettings.description}</pre>
              </details>
            </div>
          )}
          {refSettings?.error && (
            <p className="text-red-600 text-sm">❌ {refSettings.error}</p>
          )}
        </section>

        {/* Studio手動チェックリスト */}
        <section className="bg-yellow-50 rounded-2xl border border-yellow-200 p-6 space-y-2">
          <h2 className="text-lg font-medium text-text-primary">🧾 Studio手動チェックリスト</h2>
          <p className="text-xs text-text-secondary mb-2">APIでは自動化不可。アップロード後、Studioで手動設定:</p>
          <ul className="text-sm space-y-1 text-text-primary">
            <li>☐ 商品タグ（Shopping）追加</li>
            <li>☐ 広告ON（収益化タブ）</li>
            <li>☐ mid-roll広告 3箇所位置指定（動画内の自然な切れ目）</li>
            <li>☐ 終了画面（次動画誘導）設定</li>
            <li>☐ カード（動画内リンク）設定</li>
            <li>☐ 字幕ファイル（.srt等）アップロード（任意）</li>
            <li>☐ 再生リスト追加</li>
            <li>☐ 最終プレビュー → 公開</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
