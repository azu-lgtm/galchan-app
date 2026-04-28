'use client'

import { useState } from 'react'
import VideoList from './VideoList'
import CommentList from './CommentList'
import type { ChannelVideo } from '@/lib/types'

/**
 * ガルch コメント返信タブ（健康ch完全移植版）
 *
 * フロー:
 *   VideoList（自チャンネル動画 + 未返信件数フィルタ）
 *     → 動画選択
 *     → CommentList（自動コメント取得 + 台本自動取得 + AI返信生成 + YouTube投稿）
 *
 * ガル独自:
 *   - emoji: 🌸💕😊🙏✨☕（💪除外）
 *   - 「私もずっと同じ悩み」型禁止
 *   - 絵文字量を相手に合わせる
 *   - prompts-galchan.json の comment_reply キーを使用
 *   - callGemini（Gemini Flash 固定）
 */
export default function CommentReply() {
  const [selectedVideo, setSelectedVideo] = useState<ChannelVideo | null>(null)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-text-primary">コメント返信</h2>
        <p className="text-text-secondary text-sm mt-0.5">
          {selectedVideo
            ? '視聴者コメントへの返信文をAIで生成・投稿します'
            : '未返信コメントがある動画を選択してください'}
        </p>
      </div>

      {selectedVideo ? (
        <CommentList
          video={selectedVideo}
          onBack={() => setSelectedVideo(null)}
        />
      ) : (
        <VideoList onVideoSelect={setSelectedVideo} />
      )}
    </div>
  )
}
