/**
 * Vercel KV ヘルパー（galchan-app 用）
 * - KV_REST_API_URL / KV_REST_API_TOKEN が設定されている場合 → Vercel KV を使用
 * - 未設定（ローカル開発）→ data/prompts-galchan.json にフォールバック
 */

import type { GalPromptsStore } from './types'

const KV_URL = process.env.KV_REST_API_URL
const KV_TOKEN = process.env.KV_REST_API_TOKEN

// galchan プレフィックス
const KEYS = {
  prompts: 'gc:prompts',
  counter: 'gc:counter',
  analytics: 'gc:analytics',
} as const

function isKVAvailable(): boolean {
  return !!(KV_URL && KV_TOKEN)
}

async function kvGet<T>(key: string): Promise<T | null> {
  if (!isKVAvailable()) return null
  try {
    const res = await fetch(KV_URL!, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', key]),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.result) return null
    return typeof data.result === 'string'
      ? (JSON.parse(data.result) as T)
      : (data.result as T)
  } catch {
    return null
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  if (!isKVAvailable()) return
  try {
    await fetch(KV_URL!, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, JSON.stringify(value)]),
      cache: 'no-store',
    })
  } catch (err) {
    console.error('KV set error:', err)
  }
}

// ── Prompts ───────────────────────────────────────────────────────────────────

export async function getPromptsFromStore(): Promise<GalPromptsStore> {
  const kvData = await kvGet<GalPromptsStore>(KEYS.prompts)
  if (kvData) return kvData

  // Fallback: local JSON
  const { getDefaultPrompts } = await import('./prompts')
  return getDefaultPrompts()
}

export async function savePromptsToStore(prompts: GalPromptsStore): Promise<void> {
  if (isKVAvailable()) {
    await kvSet(KEYS.prompts, prompts)
    return
  }
  // ローカル環境ではJSONファイルに書き込み
  try {
    const { writeFileSync } = await import('fs')
    const { join } = await import('path')
    writeFileSync(
      join(process.cwd(), 'data', 'prompts-galchan.json'),
      JSON.stringify(prompts, null, 2),
      'utf-8',
    )
  } catch (err) {
    console.error('prompts-galchan.json write error:', err)
  }
}

export async function resetPromptsToDefault(): Promise<GalPromptsStore> {
  const { getDefaultPrompts } = await import('./prompts')
  const defaults = getDefaultPrompts()
  await savePromptsToStore(defaults)
  return defaults
}

// ── Counter（採番 【外ガルN】）────────────────────────────────────────────────

export async function getNextSerialNumber(): Promise<number> {
  const current = await kvGet<number>(KEYS.counter)
  const next = (current ?? 0) + 1
  await kvSet(KEYS.counter, next)
  return next
}

export async function peekCurrentCounter(): Promise<number> {
  const current = await kvGet<number>(KEYS.counter)
  return current ?? 0
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalyticsFromStore(): Promise<string> {
  const data = await kvGet<string>(KEYS.analytics)
  return data ?? ''
}

export async function saveAnalyticsToStore(data: string): Promise<void> {
  await kvSet(KEYS.analytics, data)
}
