/**
 * Context Gather — Structured Retrieval with Budget and Citations
 *
 * The context gather is an explicit phase in the Thought Partner pipeline that
 * replaces naive full-document dumps. It uses a BM25 index to rank document
 * blocks by relevance, enforces token/chunk/document budgets, applies safety
 * gates (denylist, max chunk size), and builds a "working set" — the ONLY
 * context the patcher model sees.
 *
 * Every entry in the working set has a stable span ID (documentId:blockId)
 * and the patcher must cite these IDs in every patch operation.
 */

import type {
  ContextGatherInput,
  ContextGatherBudget,
  ContextGatherReceipt,
  GatheredChunk,
  WorkingSet,
  WorkingSetEntry,
  ChunkIndex,
} from '../../shared/contextGatherTypes'
import {
  DEFAULT_CONTEXT_GATHER_BUDGET,
  CONTEXT_GATHER_SAFETY,
  STOP_CONFIDENT_PROXIMITY,
  STOP_CONFIDENT_RATIO,
  estimateTokens,
  chunkKey,
} from '../../shared/contextGatherTypes'
import { queryIndex } from './contextGatherIndex'

// ─── Safety Gates ──────────────────────────────────────────────────────

/** Check if a chunk's text passes the denylist (no secrets, keys, etc.) */
function isChunkSafe(text: string): boolean {
  return !CONTEXT_GATHER_SAFETY.denylistPatterns.some(pattern => pattern.test(text))
}

// ─── Stop When Confident ───────────────────────────────────────────────

/**
 * If the top 2 BM25 chunks are co-located (same doc, within N blocks)
 * and their combined score dominates the 3rd-place chunk, stop searching
 * other documents.
 */
function shouldStopEarly(
  ranked: GatheredChunk[]
): { stop: boolean; reason: string } {
  if (ranked.length < 2) return { stop: false, reason: '' }

  const top1 = ranked[0]
  const top2 = ranked[1]

  if (
    top1.ref.documentId === top2.ref.documentId &&
    Math.abs(top1.ref.blockIndex - top2.ref.blockIndex) <= STOP_CONFIDENT_PROXIMITY
  ) {
    const top2Score = top1.relevanceScore + top2.relevanceScore
    const thirdScore = ranked[2]?.relevanceScore || 0

    if (thirdScore === 0 || top2Score > thirdScore * STOP_CONFIDENT_RATIO) {
      return {
        stop: true,
        reason: `Top 2 chunks co-located in "${top1.ref.documentTitle}" ` +
          `(blocks ${top1.ref.blockIndex}–${top2.ref.blockIndex}), ` +
          `score ratio ${(top2Score / (thirdScore || 1)).toFixed(1)}x over 3rd`,
      }
    }
  }

  return { stop: false, reason: '' }
}

// ─── Budget Enforcement ────────────────────────────────────────────────

/**
 * Greedily fill the working set from ranked candidates, respecting all budget gates.
 */
function enforceBudget(
  candidates: GatheredChunk[],
  budget: ContextGatherBudget
): GatheredChunk[] {
  const result: GatheredChunk[] = []
  let tokensUsed = 0
  const docsUsed = new Set<string>()
  const chunksPerDoc = new Map<string, number>()

  for (const chunk of candidates) {
    // Token gate
    if (tokensUsed + chunk.tokenCount > budget.maxTotalTokens) continue
    // Document gate
    if (docsUsed.size >= budget.maxDocuments && !docsUsed.has(chunk.ref.documentId)) continue
    // Per-document chunk gate
    const docChunks = chunksPerDoc.get(chunk.ref.documentId) || 0
    if (docChunks >= budget.maxChunksPerDocument) continue
    // Total chunk gate
    if (result.length >= budget.maxTotalChunks) break

    result.push(chunk)
    tokensUsed += chunk.tokenCount
    docsUsed.add(chunk.ref.documentId)
    chunksPerDoc.set(chunk.ref.documentId, docChunks + 1)
  }

  return result
}

// ─── Main Gather Function ──────────────────────────────────────────────

/**
 * Gather context for the patcher using BM25-ranked retrieval with budget enforcement.
 *
 * Three phases:
 * 1. Mandatory includes: edit targets, selection blocks, active doc headings
 * 2. BM25 scored retrieval: rank all chunks, take top-K within budget
 * 3. Contextual padding: include 1 adjacent block before/after each selected chunk
 */
export function contextGather(
  input: ContextGatherInput,
  index: ChunkIndex,
  budgetOverrides?: Partial<ContextGatherBudget>
): ContextGatherReceipt {
  const startTime = Date.now()
  const budget: ContextGatherBudget = { ...DEFAULT_CONTEXT_GATHER_BUDGET, ...budgetOverrides }

  // Track which chunk keys are already included (dedup)
  const includedKeys = new Set<string>()
  const allCandidates: GatheredChunk[] = []

  // Helper: try to add a chunk from the index
  const addChunk = (
    key: string,
    score: number,
    reason: string
  ): boolean => {
    if (includedKeys.has(key)) return false
    const chunk = index.chunks.get(key)
    if (!chunk) return false
    if (!isChunkSafe(chunk.text)) return false
    if (chunk.tokenCount > CONTEXT_GATHER_SAFETY.maxChunkTokens) return false

    includedKeys.add(key)
    allCandidates.push({
      ref: chunk.ref,
      text: chunk.text,
      textHash: chunk.textHash,
      tokenCount: chunk.tokenCount,
      relevanceScore: score,
      gatherReason: reason,
    })
    return true
  }

  // ── Phase 1: Mandatory includes ──────────────────────────────────

  // 1a. Edit target blocks (from editPlan.readsNeeded)
  for (const readSpec of input.editPlan.readsNeeded) {
    for (const blockId of readSpec.blockIds) {
      const key = chunkKey(readSpec.documentId, blockId)
      addChunk(key, 100, 'mandatory: edit target')
    }
  }

  // 1b. Selection blocks
  if (input.selectionBlockIds) {
    for (const blockId of input.selectionBlockIds) {
      const key = chunkKey(input.activeDocumentId, blockId)
      addChunk(key, 90, 'mandatory: selection')
    }
  }

  // 1c. All headings from the active document (structural context)
  for (const chunk of index.chunks.values()) {
    if (
      chunk.ref.documentId === input.activeDocumentId &&
      (chunk.ref.blockType === 'heading' || chunk.ref.blockType === 'scene-heading')
    ) {
      addChunk(
        chunkKey(chunk.ref.documentId, chunk.ref.blockId),
        50,
        'mandatory: active doc heading'
      )
    }
  }

  // ── Phase 2: BM25 scored retrieval ───────────────────────────────

  // Build query from edit plan + user message
  const queryParts = [
    input.editPlan.goal,
    ...(input.editPlan.constraints || []),
    input.userMessage,
  ].filter(Boolean)
  const query = queryParts.join(' ')

  // Query index for top candidates (request more than budget to allow filtering)
  const bm25Results = queryIndex(index, query, budget.maxTotalChunks * 2)

  // Convert to GatheredChunks
  const scoredCandidates: GatheredChunk[] = []
  for (const result of bm25Results) {
    if (includedKeys.has(result.chunkKey)) continue
    const chunk = index.chunks.get(result.chunkKey)
    if (!chunk) continue
    if (!isChunkSafe(chunk.text)) continue
    if (chunk.tokenCount > CONTEXT_GATHER_SAFETY.maxChunkTokens) continue
    if (result.score < CONTEXT_GATHER_SAFETY.minRelevanceScore) continue

    scoredCandidates.push({
      ref: chunk.ref,
      text: chunk.text,
      textHash: chunk.textHash,
      tokenCount: chunk.tokenCount,
      relevanceScore: result.score,
      gatherReason: `BM25 match (score ${result.score.toFixed(2)})`,
    })
  }

  // Check stop-when-confident
  let stoppedEarly = false
  let stopReason: string | undefined
  const earlyStop = shouldStopEarly(scoredCandidates)
  if (earlyStop.stop) {
    stoppedEarly = true
    stopReason = earlyStop.reason
    // Filter scored candidates to only the co-located document
    const colocatedDocId = scoredCandidates[0]?.ref.documentId
    if (colocatedDocId) {
      const filtered = scoredCandidates.filter(c => c.ref.documentId === colocatedDocId)
      scoredCandidates.length = 0
      scoredCandidates.push(...filtered)
    }
  }

  // Merge mandatory + scored, then enforce budget
  const merged = [...allCandidates, ...scoredCandidates]
  const budgeted = enforceBudget(merged, budget)

  // Update includedKeys for padding phase
  for (const chunk of budgeted) {
    includedKeys.add(chunkKey(chunk.ref.documentId, chunk.ref.blockId))
  }

  // ── Phase 3: Contextual padding ─────────────────────────────────
  // For each selected chunk, include 1 adjacent block before/after

  const paddingCandidates: GatheredChunk[] = []
  for (const chunk of budgeted) {
    const docBlocks = input.allBlockContext.documents.find(
      d => d.documentId === chunk.ref.documentId
    )
    if (!docBlocks) continue

    for (const offset of [-1, 1]) {
      const adjIndex = chunk.ref.blockIndex + offset
      if (adjIndex < 0 || adjIndex >= docBlocks.blocks.length) continue

      const adjBlock = docBlocks.blocks[adjIndex]
      if (!adjBlock?.blockId) continue

      const adjKey = chunkKey(chunk.ref.documentId, adjBlock.blockId)
      if (includedKeys.has(adjKey)) continue

      const indexedChunk = index.chunks.get(adjKey)
      if (!indexedChunk) continue
      if (!isChunkSafe(indexedChunk.text)) continue
      if (indexedChunk.tokenCount > CONTEXT_GATHER_SAFETY.maxChunkTokens) continue

      includedKeys.add(adjKey)
      paddingCandidates.push({
        ref: indexedChunk.ref,
        text: indexedChunk.text,
        textHash: indexedChunk.textHash,
        tokenCount: indexedChunk.tokenCount,
        relevanceScore: chunk.relevanceScore * 0.1,
        gatherReason: `adjacent to ${chunk.ref.blockId}`,
      })
    }
  }

  // Enforce budget on the full set (budgeted + padding)
  const finalSet = enforceBudget([...budgeted, ...paddingCandidates], budget)

  // ── Build receipt ────────────────────────────────────────────────

  const totalTokensUsed = finalSet.reduce((sum, c) => sum + c.tokenCount, 0)
  const documentsAccessed = [...new Set(finalSet.map(c => c.ref.documentId))]

  return {
    workingSet: finalSet,
    totalTokensUsed,
    totalChunksRead: finalSet.length,
    documentsAccessed,
    budgetUsed: {
      tokens: { used: totalTokensUsed, limit: budget.maxTotalTokens },
      chunks: { used: finalSet.length, limit: budget.maxTotalChunks },
      documents: { used: documentsAccessed.length, limit: budget.maxDocuments },
    },
    gatherDurationMs: Date.now() - startTime,
    stoppedEarly,
    stopReason,
  }
}

// ─── Working Set Builder ───────────────────────────────────────────────

/** Build a working set from a context gather receipt */
export function buildWorkingSet(receipt: ContextGatherReceipt): WorkingSet {
  const entries: WorkingSetEntry[] = receipt.workingSet.map(chunk => ({
    spanId: chunkKey(chunk.ref.documentId, chunk.ref.blockId),
    documentId: chunk.ref.documentId,
    documentTitle: chunk.ref.documentTitle,
    blockId: chunk.ref.blockId,
    blockType: chunk.ref.blockType,
    text: chunk.text,
    textHash: chunk.textHash,
    tokenCount: chunk.tokenCount,
    relevanceScore: chunk.relevanceScore,
    gatherReason: chunk.gatherReason,
  }))

  return {
    entries,
    totalTokens: receipt.totalTokensUsed,
    receipt,
  }
}

/**
 * Format the working set into a prompt string for the patcher model.
 * Splits into "WORKING SET" (read-only context) and "TARGET BLOCKS" (modifiable).
 */
export function formatWorkingSetForPatcher(
  workingSet: WorkingSet,
  targetBlockIds: string[]
): string {
  const targetSet = new Set(targetBlockIds)
  let prompt = ''

  // Group entries by document for readability
  const byDoc = new Map<string, WorkingSetEntry[]>()
  for (const entry of workingSet.entries) {
    const list = byDoc.get(entry.documentId) || []
    list.push(entry)
    byDoc.set(entry.documentId, list)
  }

  prompt += '=== WORKING SET (read-only context for this edit) ===\n'
  prompt += 'These are the ONLY blocks you have access to. Every patch op must cite span IDs.\n\n'

  for (const [docId, entries] of byDoc) {
    const title = entries[0]?.documentTitle || docId
    prompt += `--- ${title} ---\n`
    for (const entry of entries) {
      prompt += `[span:${entry.spanId}] (${entry.blockType}) ${entry.text}\n`
    }
    prompt += '\n'
  }

  // Target blocks section
  const targets = workingSet.entries.filter(e => targetSet.has(e.blockId))
  if (targets.length > 0) {
    prompt += '=== TARGET BLOCKS (blocks you may modify) ===\n'
    for (const t of targets) {
      prompt += `[span:${t.spanId}]\n`
    }
    prompt += '\n'
  }

  return prompt
}
