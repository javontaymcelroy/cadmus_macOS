/**
 * Context Gather Types
 *
 * Types for the structured context gathering phase of the Thought Partner pipeline.
 * The context gather replaces naive full-document dumps with BM25-ranked retrieval,
 * budget enforcement, and a working set with stable span IDs and mandatory citations.
 */

import type { EditPlan, StructuredMemory } from './thoughtPartnerPipelineTypes'

// ─── Chunk & Index Types ───────────────────────────────────────────────

/** Stable reference to a single block in a document */
export interface ChunkRef {
  documentId: string
  blockId: string
  documentTitle: string
  blockType: string      // 'paragraph' | 'heading' | 'screenplayElement' | etc.
  blockIndex: number     // 0-based position within the document
}

/** A chunk with its text, hash, and pre-computed BM25 term frequencies */
export interface IndexedChunk {
  ref: ChunkRef
  text: string
  textHash: string
  tokenCount: number
  termFrequencies: Map<string, number>  // term → count in this chunk
  totalTerms: number
}

/** The BM25 chunk index — in-memory, persists across pipeline runs */
export interface ChunkIndex {
  /** All indexed chunks, keyed by `${documentId}:${blockId}` */
  chunks: Map<string, IndexedChunk>

  /** Inverted index: term → set of chunk keys */
  invertedIndex: Map<string, Set<string>>

  /** Average chunk length in terms (for BM25 normalization) */
  avgDocLength: number

  /** Total number of chunks in the index */
  totalChunks: number

  /** Document-level metadata */
  documents: Map<string, {
    title: string
    chunkCount: number
    totalTokens: number
  }>

  /** Cache invalidation: chunk key → textHash */
  chunkHashes: Map<string, string>

  /** When the index was last fully updated */
  lastIndexedAt: string
}

// ─── Multi-Document Block Context ──────────────────────────────────────

/** Block metadata from a single document */
export interface DocumentBlock {
  blockId: string
  type: string
  text: string
  textHash: string
  attrs?: Record<string, unknown>
}

/** Blocks from ALL project documents — sent from renderer to main process */
export interface MultiDocumentBlockContext {
  documents: Array<{
    documentId: string
    documentTitle: string
    blocks: DocumentBlock[]
  }>
}

// ─── Context Gather Input / Output ─────────────────────────────────────

/** Input to the context gather function */
export interface ContextGatherInput {
  editPlan: EditPlan
  userMessage: string
  activeDocumentId: string
  selectionBlockIds?: string[]
  allBlockContext: MultiDocumentBlockContext
  structuredMemory?: StructuredMemory | null
}

/** Budget gates for the context gather */
export interface ContextGatherBudget {
  maxTotalTokens: number
  maxDocuments: number
  maxChunksPerDocument: number
  maxTotalChunks: number
}

/** A chunk that was selected by the gather, with score and reason */
export interface GatheredChunk {
  ref: ChunkRef
  text: string
  textHash: string
  tokenCount: number
  relevanceScore: number
  gatherReason: string    // e.g. "BM25 match on 'dialogue tension'" or "mandatory: edit target"
}

/** Full transparency receipt from a context gather run */
export interface ContextGatherReceipt {
  workingSet: GatheredChunk[]
  totalTokensUsed: number
  totalChunksRead: number
  documentsAccessed: string[]
  budgetUsed: {
    tokens: { used: number; limit: number }
    chunks: { used: number; limit: number }
    documents: { used: number; limit: number }
  }
  gatherDurationMs: number
  stoppedEarly: boolean
  stopReason?: string
}

// ─── Working Set ───────────────────────────────────────────────────────

/** A single entry in the working set with a stable span ID */
export interface WorkingSetEntry {
  /** Stable ID: `${documentId}:${blockId}` */
  spanId: string
  documentId: string
  documentTitle: string
  blockId: string
  blockType: string
  text: string
  textHash: string
  tokenCount: number
  relevanceScore: number
  gatherReason: string
}

/** The curated working set — the ONLY context the patcher sees */
export interface WorkingSet {
  entries: WorkingSetEntry[]
  totalTokens: number
  receipt: ContextGatherReceipt
}

// ─── Constants ─────────────────────────────────────────────────────────

export const DEFAULT_CONTEXT_GATHER_BUDGET: ContextGatherBudget = {
  maxTotalTokens: 8000,
  maxDocuments: 5,
  maxChunksPerDocument: 30,
  maxTotalChunks: 60,
}

export const CONTEXT_GATHER_SAFETY = {
  /** Regex patterns for content that should never enter the working set */
  denylistPatterns: [
    /(?:api[_-]?key|secret[_-]?key|password|token)\s*[:=]\s*\S+/i,
    /(?:sk-|pk_live_|pk_test_)\w{20,}/,
    /Bearer\s+\S{20,}/i,
  ] as readonly RegExp[],

  /** Skip chunks larger than this (in estimated tokens) */
  maxChunkTokens: 2000,

  /** Below this BM25 score, chunks are considered noise */
  minRelevanceScore: 0.1,
} as const

/** Proximity threshold for "stop when confident" rule */
export const STOP_CONFIDENT_PROXIMITY = 5

/** Score ratio threshold for early stopping */
export const STOP_CONFIDENT_RATIO = 3.0

/** Estimate token count from text (word count / 0.75) */
export function estimateTokens(text: string): number {
  if (!text) return 0
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length
  return Math.ceil(wordCount / 0.75)
}

/** Generate a chunk key from documentId and blockId */
export function chunkKey(documentId: string, blockId: string): string {
  return `${documentId}:${blockId}`
}
