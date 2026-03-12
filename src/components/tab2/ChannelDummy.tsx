'use client'

export default function ChannelDummy() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="text-4xl">📺</div>
      <div>
        <p className="text-text-primary font-medium">チャンネル管理</p>
        <p className="text-text-secondary text-sm mt-1">この機能は今後実装予定です</p>
      </div>
      <div className="bg-secondary/20 rounded-2xl px-6 py-4 text-left text-xs text-text-secondary space-y-1 max-w-xs">
        <p className="font-medium text-text-primary mb-2">予定機能</p>
        <p>・コメント返信</p>
        <p>・動画管理（投稿済みリスト）</p>
        <p>・アップロード進捗管理</p>
      </div>
    </div>
  )
}
