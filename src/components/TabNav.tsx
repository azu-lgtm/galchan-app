'use client'

type Tab = 'tab1' | 'tab2' | 'tab3'

interface TabNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const TABS = [
  { id: 'tab1' as Tab, label: '台本生成', icon: '✏️' },
  { id: 'tab2' as Tab, label: 'チャンネル', icon: '📺' },
  { id: 'tab3' as Tab, label: '設定', icon: '⚙️' },
]

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="bg-white border-b border-border-soft sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-medium transition-all duration-200 border-b-2 min-h-[52px] ${
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:border-secondary'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
