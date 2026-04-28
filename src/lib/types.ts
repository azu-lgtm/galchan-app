// ── Topic ─────────────────────────────────────────────────────────────────────

export type TopicCategory = 'galchan' | 'trends' | 'competitors'

export interface GalTopicCandidate {
  title: string
  description: string
  angle: string          // 切り口
  emotionWords: string[] // 感情ワード（後悔/恥/損失など）
  source?: string        // 参考競合タイトルなど
  sourceUrl?: string     // ネタ元URL（ガルちゃんスレッド or YouTube動画）
  category?: TopicCategory
}

export interface CategorizedTopics {
  galchan: GalTopicCandidate[]
  trends: GalTopicCandidate[]
  competitors: GalTopicCandidate[]
}

// ── Script ────────────────────────────────────────────────────────────────────

export type ScriptStyle = 'product' | 'habit' | 'tips'

export const SCRIPT_STYLE_LABELS: Record<ScriptStyle, string> = {
  product: '商品',
  habit: '習慣',
  tips: 'Tips',
}

// 台本は【話者】本文 形式のテキスト
export type ScriptText = string

// ── Materials ─────────────────────────────────────────────────────────────────

export interface GalProduct {
  name: string
  category: string
  scriptQuote: string  // 台本内の言及箇所
  amazonLink: string
  rakutenLink: string
}

export interface GalMaterials {
  titles: string[]       // タイトル案3件
  thumbnails: string[]   // サムネ文言3件
  description: string    // 概要欄（固定テンプレ含む）
  metaTags: string       // カンマ区切りメタタグ
  pinComment: string     // 固定コメント
  workerMessage?: string // ワーカーさんへの編集メモ（任意）
  productList?: GalProduct[]  // 商品系スタイル時のみ
  serialNumber?: string  // 【外ガルN】採番
}

// ── Save Files ────────────────────────────────────────────────────────────────

export interface SavedFiles {
  ideaMd: string        // idea.md (Obsidian ネタ保存)
  scriptTxt: string     // script.txt (Obsidian 台本保存)
  materialsJson: string // materials.json (スプシ・動画管理)
  csvTsv: string        // csv.tsv (YMM4連携)
  tsvFilename: string   // TSVファイル名 【自ガルN台本】タイトル_YYYYMMDD.tsv
}

// ── Prompts ───────────────────────────────────────────────────────────────────

export interface GalScriptPrompts {
  common: string
  habit: string
  product: string
  tips: string
  competitor_reflection: string
  output_rules: string
}

export interface GalMaterialsPrompts {
  common: string
  title: string
  thumbnail: string
  description: string
  tags: string
  fixed_comment: string
  product_list_extraction: string
}

export interface GalCommentReplyPrompt {
  name: string
  content: string
}

export interface GalPromptsStore {
  script: GalScriptPrompts
  materials: GalMaterialsPrompts
  comment_reply?: GalCommentReplyPrompt
}

// ── Comment Reply ─────────────────────────────────────────────────────────────

export interface GalReplySettings {
  name: string
  persona: string
  tone: 'friendly' | 'formal' | 'casual'
  length: 'short' | 'medium' | 'long'
  customRules: string
}

export const DEFAULT_GAL_REPLY_SETTINGS: GalReplySettings = {
  name: 'ガル運営',
  persona: '40代後半の女性チャンネル運営者',
  tone: 'friendly',
  length: 'medium',
  customRules: '',
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsInput {
  analyticsText: string    // 貼り付けたアナリティクステキスト
  competitorText: string   // 貼り付けた競合動画データ
}
