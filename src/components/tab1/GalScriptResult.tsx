'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { GalTopicCandidate, ScriptStyle, GalMaterials, SavedFiles } from '@/lib/types'
import { SCRIPT_STYLE_LABELS } from '@/lib/types'

interface Props {
  script: string
  topic: GalTopicCandidate
  style: ScriptStyle
  onBack: () => void
  onReset: () => void
}

function downloadText(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function GalScriptResult({ script, topic, style, onBack, onReset }: Props) {
  const [materials, setMaterials] = useState<GalMaterials | null>(null)
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingSheets, setSavingSheets] = useState(false)
  const [savedFiles, setSavedFiles] = useState<SavedFiles | null>(null)
  const [sheetsSaved, setSheetsSaved] = useState(false)
  const [error, setError] = useState('')
  const [scriptOpen, setScriptOpen] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  // マウント時に素材を自動生成
  useEffect(() => {
    generateMaterials()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const generateMaterials = async () => {
    setLoadingMaterials(true)
    setError('')
    try {
      const res = await fetch('/api/gemini/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, topic, style }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '素材生成に失敗しました')
      }
      const { materials: mat } = await res.json()
      setMaterials(mat)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoadingMaterials(false)
    }
  }

  const handleSaveAll = async () => {
    if (!materials) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, style, script, materials }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '保存に失敗しました')
      }
      const { files } = await res.json()
      setSavedFiles(files)

      // ブラウザからダウンロード
      const serial = materials.serialNumber?.replace(/[【】]/g, '') ?? 'tmp'
      downloadText(files.ideaMd, `${serial}_idea.md`)
      downloadText(files.scriptTxt, `${serial}_script.txt`)
      downloadText(files.materialsJson, `${serial}_materials.json`, 'application/json')
      downloadText(files.csvTsv, `${serial}_ymm4.tsv`)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleCsvOnly = () => {
    // script から直接TSV生成
    const lines = script.split('\n').filter((l) => l.trim())
    const SE_MAP: Record<string, string> = {
      ナレーション: '',
      タイトル: 'se_title',
      イッチ: 'se_main',
      スレ民1: 'se_reply', スレ民2: 'se_reply', スレ民3: 'se_reply',
      スレ民4: 'se_reply', スレ民5: 'se_reply', スレ民6: 'se_reply',
    }
    const rows = lines
      .map((line) => {
        const m = line.match(/^【(.+?)】(.+)$/)
        if (!m) return null
        const speaker = m[1].trim()
        const text = m[2].trim()
        return `${speaker}\t${text}\t\t${SE_MAP[speaker] ?? ''}`
      })
      .filter(Boolean)
      .join('\n')

    const serial = materials?.serialNumber?.replace(/[【】]/g, '') ?? 'tmp'
    downloadText(rows, `${serial}_ymm4.tsv`)
  }

  const handleSaveSheets = async () => {
    if (!materials) return
    setSavingSheets(true)
    setError('')
    try {
      const res = await fetch('/api/google/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, style, script, materials }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sheets保存に失敗しました')
      setSheetsSaved(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setSavingSheets(false)
    }
  }

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
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
        <div className="flex-1">
          <h2 className="text-lg font-medium text-text-primary">台本・素材</h2>
          <p className="text-xs text-text-secondary">
            {materials?.serialNumber && <span className="mr-2 text-accent font-medium">{materials.serialNumber}</span>}
            {SCRIPT_STYLE_LABELS[style]} ／ {topic.title}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>最初から</Button>
      </div>

      {/* 台本プレビュー */}
      <Card padding="none">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setScriptOpen((v) => !v)}
        >
          <span className="font-medium text-text-primary text-sm">台本プレビュー</span>
          <span className="text-text-secondary text-sm">{scriptOpen ? '▲ 閉じる' : '▼ 開く'}</span>
        </button>
        {scriptOpen && (
          <div className="border-t border-border-soft px-4 pb-4">
            <div className="flex justify-end mt-2 mb-2">
              <button
                onClick={() => copy(script, 'script')}
                className="text-xs text-accent hover:text-accent-dark"
              >
                {copied === 'script' ? '✓ コピー済み' : 'コピー'}
              </button>
            </div>
            <pre className="text-xs text-text-primary whitespace-pre-wrap font-mono bg-base rounded-xl p-3 max-h-96 overflow-y-auto leading-relaxed">
              {script}
            </pre>
          </div>
        )}
      </Card>

      {/* 素材一式 */}
      {loadingMaterials ? (
        <LoadingSpinner message="素材を生成しています..." />
      ) : materials ? (
        <div className="space-y-4">
          {/* タイトル案 */}
          <Card>
            <p className="text-sm font-medium text-text-primary mb-3">タイトル案</p>
            <div className="space-y-2">
              {materials.titles.map((t, i) => (
                <div key={i} className="flex items-start gap-2 bg-base rounded-xl px-3 py-2">
                  <span className="text-xs text-accent font-medium mt-0.5">{i + 1}</span>
                  <span className="text-sm text-text-primary flex-1">{t}</span>
                  <button
                    onClick={() => copy(t, `title${i}`)}
                    className="text-xs text-text-secondary hover:text-accent flex-shrink-0"
                  >
                    {copied === `title${i}` ? '✓' : 'コピー'}
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* サムネ文言 */}
          <Card>
            <p className="text-sm font-medium text-text-primary mb-3">サムネ文言</p>
            <div className="flex flex-wrap gap-2">
              {materials.thumbnails.map((t, i) => (
                <button
                  key={i}
                  onClick={() => copy(t, `thumb${i}`)}
                  className="bg-secondary/30 hover:bg-secondary/60 text-text-primary text-sm rounded-xl px-3 py-1.5 transition-colors"
                  title="クリックでコピー"
                >
                  {copied === `thumb${i}` ? '✓ ' : ''}{t}
                </button>
              ))}
            </div>
          </Card>

          {/* 概要欄 */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-primary">概要欄</p>
              <button
                onClick={() => copy(materials.description, 'desc')}
                className="text-xs text-accent hover:text-accent-dark"
              >
                {copied === 'desc' ? '✓ コピー済み' : 'コピー'}
              </button>
            </div>
            <pre className="text-xs text-text-primary whitespace-pre-wrap bg-base rounded-xl p-3 max-h-48 overflow-y-auto leading-relaxed">
              {materials.description}
            </pre>
          </Card>

          {/* メタタグ */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-primary">メタタグ</p>
              <button
                onClick={() => copy(materials.metaTags, 'tags')}
                className="text-xs text-accent hover:text-accent-dark"
              >
                {copied === 'tags' ? '✓ コピー済み' : 'コピー'}
              </button>
            </div>
            <p className="text-xs text-text-secondary bg-base rounded-xl p-3">{materials.metaTags}</p>
          </Card>

          {/* 固定コメント */}
          <Card>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-primary">固定コメント</p>
              <button
                onClick={() => copy(materials.pinComment, 'pin')}
                className="text-xs text-accent hover:text-accent-dark"
              >
                {copied === 'pin' ? '✓ コピー済み' : 'コピー'}
              </button>
            </div>
            <p className="text-sm text-text-primary bg-base rounded-xl p-3">{materials.pinComment}</p>
          </Card>

          {/* 商品リスト（商品スタイル時） */}
          {materials.productList && materials.productList.length > 0 && (
            <Card>
              <p className="text-sm font-medium text-text-primary mb-3">商品リスト</p>
              <div className="space-y-3">
                {materials.productList.map((p, i) => (
                  <div key={i} className="border border-border-soft rounded-xl p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-text-primary">{p.name}</p>
                      <span className="text-xs bg-secondary/40 text-text-secondary rounded-lg px-2 py-0.5 flex-shrink-0">
                        {p.category}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">「{p.scriptQuote}」</p>
                    <div className="flex gap-2 text-xs">
                      <span className="text-text-secondary">Amazon: </span>
                      <span className="text-text-secondary italic">（後で入力）</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : null}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* 保存・CSV出力ボタン */}
      <div className="flex gap-3">
        <Button
          onClick={handleSaveAll}
          loading={saving}
          disabled={!materials}
          className="flex-1"
          size="lg"
        >
          💾 全ファイルを保存
        </Button>
        <Button
          variant="secondary"
          onClick={handleCsvOnly}
          size="lg"
        >
          📄 TSV出力
        </Button>
      </div>

      <Button
        variant="secondary"
        onClick={handleSaveSheets}
        loading={savingSheets}
        disabled={!materials || sheetsSaved}
        className="w-full"
      >
        {sheetsSaved ? '✅ Sheetsに保存済み' : '📊 Sheetsに保存（台本・商品リスト・管理シート）'}
      </Button>

      {savedFiles && (
        <Card padding="sm">
          <p className="text-xs text-text-secondary text-center">
            4ファイルをダウンロードしました（idea.md / script.txt / materials.json / ymm4.tsv）
          </p>
        </Card>
      )}

      {/* 素材再生成 */}
      {materials && !loadingMaterials && (
        <button
          onClick={generateMaterials}
          className="text-xs text-text-secondary hover:text-accent text-center w-full"
        >
          素材を再生成する
        </button>
      )}
    </div>
  )
}
