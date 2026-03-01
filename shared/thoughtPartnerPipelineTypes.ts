// Thought Partner Pipeline — Shared types for the structured edit pipeline
// This replaces the regex-based action block parsing with a typed FSM pipeline.

import type { ScreenplayElement } from './thoughtPartnerTypes'
import type { WorkingSet } from './contextGatherTypes'

// ===== Finite State Machine =====

export type PipelineState =
  | 'idle'
  | 'orchestrating'
  | 'reflecting'
  | 'planning'
  | 'context_gathering'
  | 'reading'
  | 'patching'
  | 'verifying'
  | 'repairing'
  | 'awaiting_approval'
  | 'applying'
  | 'completed'
  | 'failed'

// ===== Structured Memory (replaces ContextDocument) =====

export interface StructuredMemory {
  decisions: string[]
  glossary: string[]
  constraints: string[]
  openQuestions: string[]
  riskFlags: string[]
  agreedIntents: string[]
  diagnoses: string[]
  lastCompressed: string
  lastUpdated: string
}

export const MEMORY_TOKEN_BUDGETS = {
  decisions: 800,
  glossary: 400,
  constraints: 400,
  openQuestions: 300,
  riskFlags: 200,
  agreedIntents: 500,
  diagnoses: 300,
} as const

export type MemoryField = keyof typeof MEMORY_TOKEN_BUDGETS

// ===== Per-turn session constraints (not persisted to memory) =====

export interface SessionConstraints {
  turnId: string
  constraints: string[]
}

// ===== Edit Plan (output of plan_edit tool call) =====

export interface ReadRequest {
  documentId: string
  blockIds: string[]
}

export interface EditPlan {
  id: string
  goal: string
  constraints: string[]
  scope: 'selection' | 'document'
  readsNeeded: ReadRequest[]
  patchStrategy: 'replace' | 'insert' | 'delete' | 'mixed'
  maxBlocksAffected: number
}

// ===== Block Anchor Reference =====

export interface BlockAnchorRef {
  blockId: string
  documentId: string
  originalTextHash: string
  textSnapshot: string
}

// ===== Patch Operations (output of produce_patch) =====

export type PatchOpType = 'insert' | 'replace' | 'delete'

export interface PatchOp {
  id: string
  type: PatchOpType
  anchor: BlockAnchorRef | null
  insertPosition?: 'before' | 'after' | 'replace'
  content?: string
  screenplayElements?: ScreenplayElement[]
  why: string
  /** Span IDs from the working set that this operation is based on. Required for citation. */
  sourceSpanIds: string[]
}

export interface PatchList {
  planId: string
  ops: PatchOp[]
  totalCharsChanged: number
  totalBlocksTouched: number
}

// ===== Verification =====

export interface VerifyRule {
  name: string
  passed: boolean
  message?: string
}

export type VerifyStatus = 'pass' | 'fail'

export interface VerifyResult {
  status: VerifyStatus
  rules: VerifyRule[]
  repairInstructions?: string
}

// ===== Pipeline Checkpoint (for resumability) =====

export interface PipelineCheckpoint {
  state: PipelineState
  editPlan?: EditPlan
  structuredPlan?: StructuredPlan
  reflection?: Reflection
  readSpans?: Record<string, string>
  patchList?: PatchList
  verifyResult?: VerifyResult
  workingSet?: WorkingSet
  retryCount: number
  startedAt: string
  error?: string
}

// ===== Document Block Context (renderer → main process) =====

export interface DocumentBlock {
  blockId: string
  type: string
  text: string
  textHash: string
  attrs?: Record<string, unknown>
}

export interface DocumentBlockContext {
  documentId: string
  blocks: DocumentBlock[]
}

// ===== Structured Plan (output of produce_plan tool call) =====

export interface PlanStep {
  id: string
  description: string
  targetBlockIds?: string[]
  estimatedImpact: 'low' | 'medium' | 'high'
}

export interface PlanQuestion {
  text: string
  options: Array<{ label: string; description: string }>
}

export type StructuredPlanStatus = 'pending' | 'approved' | 'revised' | 'rejected'

export interface StructuredPlan {
  id: string
  goal: string
  scope: 'selection' | 'section' | 'document' | 'multi-document'
  assumptions: string[]
  steps: PlanStep[]
  risks: string[]
  questions: PlanQuestion[]
  acceptanceCriteria: string[]
  createdAt: string
  status: StructuredPlanStatus
}

// ===== Reflection (output of reflect_understanding tool call) =====

export type ReflectionRoute = 'execute_now' | 'ask_align' | 'plan' | 'respond'
export type ReflectionStatus = 'pending' | 'accepted' | 'edited' | 'answered' | 'dismissed'

export interface ReflectionQuestion {
  text: string
  options: Array<{ label: string; description: string }>
  answer?: string
}

export interface Reflection {
  id: string
  interpretation: string
  diagnosis: string
  route: ReflectionRoute
  confidence: number
  proposedScope: 'selection' | 'section' | 'document' | 'multi-document'
  meaningQuestions: ReflectionQuestion[]
  executionQuestions: ReflectionQuestion[]
  status: ReflectionStatus
  createdAt: string
  editedInterpretation?: string
}

// ===== Idea Card (output of propose_ideas tool call) =====

export type IdeaCardStatus = 'pending' | 'exploring' | 'stress-testing' | 'merged' | 'converted' | 'discarded'

export interface IdeaExpansionPath {
  id: string
  label: string
  description: string
}

export interface IdeaCard {
  id: string
  title: string
  hook: string
  coreInsight: string
  whyItMatters: string
  expansionPaths: IdeaExpansionPath[]
  risks: string[]
  tags: string[]
  status: IdeaCardStatus
  mergedWith?: string
  exploringPathId?: string
  createdAt: string
}

// ===== Pipeline Action (enhanced action for UI) =====

export type PipelineActionType = 'edit' | 'create-character' | 'create-prop' | 'plan' | 'reflection' | 'idea'
export type PipelineActionStatus = 'pending' | 'verified' | 'accepted' | 'rejected' | 'failed'

export interface PipelineAction {
  id: string
  type: PipelineActionType
  status: PipelineActionStatus
  description: string
  editPlan?: EditPlan
  patchList?: PatchList
  verifyResult?: VerifyResult
  content?: { name: string; reason?: string }
  structuredPlan?: StructuredPlan
  reflection?: Reflection
  ideaCards?: IdeaCard[]
}

// ===== Valid screenplay element types (for verifier) =====

export const VALID_SCREENPLAY_ELEMENT_TYPES = [
  'scene-heading', 'action', 'character', 'dialogue',
  'parenthetical', 'transition', 'shot'
] as const

// ===== Verification limits (configurable) =====

export const DEFAULT_VERIFY_LIMITS = {
  maxCharsChanged: 5000,
  maxBlocksTouched: 20,
} as const

// ===== Intent Classification (client-side heuristic) =====

export interface IntentScores {
  chat: number      // 0..1
  edit: number      // 0..1
  explore: number   // 0..1
  clarify: number   // 0..1
}

export type ToolPolicy = 'chat-only' | 'reflect-first' | 'explore-only' | 'full'

export interface IntentClassification {
  scores: IntentScores
  policy: ToolPolicy
  signals: string[]     // detected signals for debugging
  skipped: boolean      // true if classification was bypassed
  skipReason?: string
}
