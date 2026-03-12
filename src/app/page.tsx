'use client'

import { useState, useEffect } from 'react'
import LoginForm from '@/components/LoginForm'
import TabNav from '@/components/TabNav'
import GalDashboard from '@/components/tab1/GalDashboard'
import GalTopicsView from '@/components/tab1/GalTopicsView'
import GalScriptResult from '@/components/tab1/GalScriptResult'
import ChannelDummy from '@/components/tab2/ChannelDummy'
import SettingsDummy from '@/components/tab3/SettingsDummy'
import type { GalTopicCandidate, CategorizedTopics, ScriptStyle } from '@/lib/types'

type Tab = 'tab1' | 'tab2' | 'tab3'
type Tab1Screen = 'dashboard' | 'topics' | 'script'

interface Tab1State {
  screen: Tab1Screen
  topics: CategorizedTopics
  selectedTopic: GalTopicCandidate | null
  selectedStyle: ScriptStyle | null
  script: string
}

const STORAGE_KEY = 'gc_tab1_state'

function loadTab1State(): Tab1State | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Tab1State
      return {
        ...parsed,
        script: '',
        screen: parsed.screen === 'script' ? 'topics' : parsed.screen,
      }
    }
  } catch {}
  return null
}

function saveTab1State(state: Tab1State) {
  try {
    const { script: _s, ...rest } = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  } catch {}
}

const defaultTab1State: Tab1State = {
  screen: 'dashboard',
  topics: { galchan: [], trends: [], competitors: [] },
  selectedTopic: null,
  selectedStyle: null,
  script: '',
}

export default function HomePage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('tab1')
  const [tab1, setTab1] = useState<Tab1State>(defaultTab1State)
  const [tab1Initialized, setTab1Initialized] = useState(false)

  useEffect(() => {
    checkAuth()
    const restored = loadTab1State()
    if (restored) {
      const t = restored.topics
      const hasTopics = t.galchan.length > 0 || t.trends.length > 0 || t.competitors.length > 0
      if (hasTopics) setTab1(restored)
    }
    setTab1Initialized(true)
  }, [])

  useEffect(() => {
    if (tab1Initialized) {
      saveTab1State(tab1)
    }
  }, [tab1, tab1Initialized])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check')
      setAuthenticated(res.ok)
    } catch {
      setAuthenticated(false)
    }
  }

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-text-secondary text-sm">読み込み中...</div>
      </div>
    )
  }

  if (!authenticated) {
    return <LoginForm onLogin={() => setAuthenticated(true)} />
  }

  return (
    <div className="min-h-screen bg-base">
      {/* ヘッダー */}
      <header className="bg-white border-b border-border-soft">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌷</span>
            <span className="font-medium text-text-primary text-sm">ガルちゃん運営ツール</span>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/auth', { method: 'DELETE' })
              setAuthenticated(false)
            }}
            className="text-xs text-text-secondary hover:text-text-primary"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* タブナビ */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* コンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-5 pb-20">
        {/* TAB 1: 台本生成 */}
        {activeTab === 'tab1' && (
          <>
            {tab1.screen === 'dashboard' && (
              <GalDashboard
                onTopicsReady={(topics) =>
                  setTab1((prev) => ({ ...prev, topics, screen: 'topics' }))
                }
                onResumeTopics={
                  (tab1.topics.galchan.length > 0 || tab1.topics.trends.length > 0 || tab1.topics.competitors.length > 0)
                    ? () => setTab1((prev) => ({ ...prev, screen: 'topics' }))
                    : undefined
                }
              />
            )}

            {tab1.screen === 'topics' && (
              <GalTopicsView
                topics={tab1.topics}
                onScriptReady={(script, topic, style) =>
                  setTab1((prev) => ({
                    ...prev,
                    script,
                    selectedTopic: topic,
                    selectedStyle: style,
                    screen: 'script',
                  }))
                }
                onBack={() => setTab1((prev) => ({ ...prev, screen: 'dashboard' }))}
              />
            )}

            {tab1.screen === 'script' && tab1.selectedTopic && tab1.selectedStyle && (
              <GalScriptResult
                script={tab1.script}
                topic={tab1.selectedTopic}
                style={tab1.selectedStyle}
                onBack={() => setTab1((prev) => ({ ...prev, screen: 'topics' }))}
                onReset={() => {
                  setTab1(defaultTab1State)
                  try { localStorage.removeItem(STORAGE_KEY) } catch {}
                }}
              />
            )}
          </>
        )}

        {/* TAB 2: チャンネル（ダミー） */}
        {activeTab === 'tab2' && <ChannelDummy />}

        {/* TAB 3: 設定 */}
        {activeTab === 'tab3' && <SettingsDummy />}
      </main>
    </div>
  )
}
