// Thought Partner — Shared types between Electron main and renderer

// --- Action types for agentic Thought Partner ---

export type ThoughtPartnerActionType = 'insert-content' | 'replace-content' | 'create-character' | 'create-prop'
export type ThoughtPartnerActionStatus = 'pending' | 'accepted' | 'rejected' | 'executing' | 'completed' | 'failed'

export interface ThoughtPartnerActionBase {
  id: string
  type: ThoughtPartnerActionType
  status: ThoughtPartnerActionStatus
  description: string
}

export interface ScreenplayElement {
  type: 'scene-heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' | 'shot'
  text: string
}

export interface InsertContentAction extends ThoughtPartnerActionBase {
  type: 'insert-content'
  content: {
    screenplayElements?: ScreenplayElement[]
    text?: string
    insertionPoint?: 'cursor' | 'start' | 'end' | 'after-heading'
    afterHeading?: string
  }
}

export interface ReplaceContentAction extends ThoughtPartnerActionBase {
  type: 'replace-content'
  content: {
    targetHeading?: string
    targetText?: string
    screenplayElements?: ScreenplayElement[]
    text?: string
  }
}

export interface CreateCharacterAction extends ThoughtPartnerActionBase {
  type: 'create-character'
  content: { name: string; color?: string }
}

export interface CreatePropAction extends ThoughtPartnerActionBase {
  type: 'create-prop'
  content: { name: string; icon?: string }
}

export type ThoughtPartnerAction = InsertContentAction | ReplaceContentAction | CreateCharacterAction | CreatePropAction

export interface PendingEditorInsertion {
  actionId: string
  mode: 'insert' | 'replace' | 'delete'
  screenplayElements?: ScreenplayElement[]
  text?: string
  insertionPoint: 'cursor' | 'start' | 'end' | 'after-heading'
  afterHeading?: string
  targetHeading?: string
  targetText?: string
  // Pipeline fields (blockId-based positioning)
  pipelineOps?: import('./thoughtPartnerPipelineTypes').PatchOp[]
  anchorBlockId?: string
  originalText?: string
  opWhy?: string
}

// --- Interactive question types for guided Q&A flow ---

export type ThoughtPartnerQuestionStatus = 'active' | 'answered' | 'skipped'

export interface ThoughtPartnerQuestionOption {
  id: string
  label: string
  description?: string
}

export interface ThoughtPartnerQuestion {
  id: string
  toolCallId: string
  questionText: string
  options: ThoughtPartnerQuestionOption[]
  allowCustom: boolean
  status: ThoughtPartnerQuestionStatus
  selectedOptionId?: string
  customAnswer?: string
  category?: 'tone' | 'structure' | 'character' | 'plot' | 'style' | 'general'
}

// --- Core types ---

export interface ThoughtPartnerMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  actions?: ThoughtPartnerAction[]
  questions?: ThoughtPartnerQuestion[]
}

export interface ContextDocument {
  decisions: string[]
  openQuestions: string[]
  ideas: string[]
  risks: string[]
  considerations: string[]
  lastUpdated: string
}

export interface SuggestionCard {
  id: string
  title: string
  description: string
  category: 'explore' | 'question' | 'risk' | 'idea'
  prompt: string
}

export interface ConsciousContext {
  title: string
  content: string
}

export interface SelectionContext {
  text: string
  documentId: string
  documentTitle: string
}

export interface SubconsciousContext {
  projectName: string
  templateType: string
  documents: { title: string; content: string; isActive: boolean }[]
  characters?: { name: string; notes?: string }[]
  props?: { name: string; notes?: string }[]
  settings?: { synopsis?: string }
}

export interface ThoughtPartnerRequest {
  message: string
  conversationHistory: ThoughtPartnerMessage[]
  consciousContext: ConsciousContext | null
  subconsciousContext: SubconsciousContext
  contextDocument: ContextDocument
  agentMode?: boolean
  selectionContext?: SelectionContext | null
  // Pipeline fields (used when usePipeline=true)
  usePipeline?: boolean
  documentBlockContext?: import('./thoughtPartnerPipelineTypes').DocumentBlockContext | null
  structuredMemory?: import('./thoughtPartnerPipelineTypes').StructuredMemory | null
  allDocumentBlockContext?: import('./contextGatherTypes').MultiDocumentBlockContext | null
  // Intent classification context
  currentPipelineActions?: import('./thoughtPartnerPipelineTypes').PipelineAction[]
  consecutiveChatTurns?: number
  // Behavior policy vector (adaptive behavior layer)
  behaviorVector?: import('./behaviorPolicyTypes').BehaviorVector
}

export interface ThoughtPartnerResponse {
  message: string
  updatedContextDocument?: ContextDocument
  actions?: ThoughtPartnerAction[]
  questions?: ThoughtPartnerQuestion[]
  error?: string
  // Pipeline fields (used when usePipeline=true)
  pipelineActions?: import('./thoughtPartnerPipelineTypes').PipelineAction[]
  updatedStructuredMemory?: import('./thoughtPartnerPipelineTypes').StructuredMemory
  intentClassification?: import('./thoughtPartnerPipelineTypes').IntentClassification
  // Behavior policy metadata (for feedback loop)
  expressedDimensions?: Partial<Record<string, number>>
  behaviorVectorUsed?: Record<string, number>
}

export interface ThoughtPartnerSuggestionsRequest {
  subconsciousContext: SubconsciousContext
}

export interface ThoughtPartnerConversationData {
  messages: ThoughtPartnerMessage[]
  contextDocument: ContextDocument
  lastUpdated: string
  // Pipeline field (coexists with contextDocument during migration)
  structuredMemory?: import('./thoughtPartnerPipelineTypes').StructuredMemory
}

export interface ConversationMeta {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface ConversationIndex {
  activeConversationId: string | null
  conversations: ConversationMeta[]
}

export interface SuggestionsCache {
  contentHash: string
  suggestions: SuggestionCard[]
  cachedAt: string
}

export function createEmptyContextDocument(): ContextDocument {
  return {
    decisions: [],
    openQuestions: [],
    ideas: [],
    risks: [],
    considerations: [],
    lastUpdated: new Date().toISOString()
  }
}
