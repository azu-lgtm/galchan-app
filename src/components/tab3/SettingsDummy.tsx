'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

export default function SettingsDummy() {
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState('')

  const handleReset = async () => {
    setResetting(true)
    setMessage('')
    try {
      const res = await fetch('/api/prompts/reset', { method: 'POST' })
      if (res.ok) {
        setMessage('プロンプトをデフォルトにリセットしました')
      } else {
        setMessage('リセットに失敗しました')
      }
    } catch {
      setMessage('エラーが発生しました')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-text-primary">設定</h2>
        <p className="text-text-secondary text-sm mt-0.5">プロンプト管理・システム設定</p>
      </div>

      <Card>
        <p className="text-sm font-medium text-text-primary mb-1">プロンプト管理</p>
        <p className="text-xs text-text-secondary mb-4">
          台本生成・素材生成のプロンプトは Vercel KV で管理されています。<br />
          フル編集UIは今後実装予定です。
        </p>
        <div className="bg-secondary/20 rounded-xl p-3 text-xs text-text-secondary space-y-1 mb-4">
          <p className="font-medium text-text-primary">KVキー構成</p>
          <p>gc:prompts → script.common / habit / product / tips / competitor_reflection / output_rules</p>
          <p>gc:prompts → materials.common / title / thumbnail / description / tags / fixed_comment / product_list_extraction</p>
          <p>gc:counter → 採番カウンター（外ガルN）</p>
        </div>
        {message && (
          <p className="text-sm text-accent mb-3">{message}</p>
        )}
        <Button
          variant="secondary"
          size="sm"
          loading={resetting}
          onClick={handleReset}
        >
          🔄 プロンプトをデフォルトにリセット
        </Button>
      </Card>

      <Card>
        <p className="text-sm font-medium text-text-primary mb-1">環境変数</p>
        <div className="text-xs text-text-secondary space-y-1">
          <p>APP_PASSWORD / GEMINI_API_KEY / SPREADSHEET_ID_GALCHAN</p>
          <p>KV_REST_API_URL / KV_REST_API_TOKEN（Vercel KV）</p>
          <p>OBSIDIAN_VAULT_PATH（ローカル書き込み用・Windowsのみ）</p>
        </div>
      </Card>

      <Card>
        <p className="text-sm font-medium text-text-primary mb-1">今後実装予定</p>
        <div className="text-xs text-text-secondary space-y-1">
          <p>・プロンプト全文編集UI（スマホ対応）</p>
          <p>・商品マスタ管理</p>
          <p>・Google Sheets / Drive 連携</p>
          <p>・Obsidian Dropbox 経由保存</p>
        </div>
      </Card>
    </div>
  )
}
