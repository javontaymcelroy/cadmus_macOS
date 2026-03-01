/**
 * Context Gather Index — BM25 Lexical Search
 *
 * In-memory BM25 index over document blocks. Supports incremental updates
 * (skips unchanged chunks by textHash), sub-millisecond queries for
 * corpus sizes up to ~500 blocks, and zero external dependencies.
 */

import type {
  ChunkIndex,
  IndexedChunk,
  ChunkRef,
  MultiDocumentBlockContext,
} from '../../shared/contextGatherTypes'
import { estimateTokens, chunkKey } from '../../shared/contextGatherTypes'

// ─── Stop Words ────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'were',
  'been', 'are', 'am', 'do', 'does', 'did', 'has', 'have', 'had',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
  'not', 'no', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
  'we', 'you', 'i', 'me', 'my', 'his', 'her', 'its', 'our', 'their',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'if', 'then', 'so', 'up', 'out', 'just', 'also', 'than', 'very',
  'too', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'only', 'own', 'same', 'about', 'into',
])

// ─── Tokenizer ─────────────────────────────────────────────────────────

/**
 * Tokenize text: lowercase, split on whitespace/punctuation, filter stop words.
 * Returns deduplicated terms for queries, raw terms for document indexing.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')     // strip punctuation except apostrophes/hyphens
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
}

// ─── DJB2 Hash ─────────────────────────────────────────────────────────

function djb2Hash(text: string): string {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return (hash >>> 0).toString(16)
}

// ─── Index Creation ────────────────────────────────────────────────────

/** Create an empty chunk index */
export function createIndex(): ChunkIndex {
  return {
    chunks: new Map(),
    invertedIndex: new Map(),
    avgDocLength: 0,
    totalChunks: 0,
    documents: new Map(),
    chunkHashes: new Map(),
    lastIndexedAt: new Date().toISOString(),
  }
}

// ─── Incremental Index Update ──────────────────────────────────────────

/**
 * Update the index incrementally from a MultiDocumentBlockContext.
 * - Skips chunks whose textHash hasn't changed.
 * - Removes chunks that no longer exist.
 * - Recalculates corpus statistics after updates.
 */
export function updateIndex(
  existing: ChunkIndex | null,
  allBlocks: MultiDocumentBlockContext
): ChunkIndex {
  const index = existing ?? createIndex()

  // Collect all current chunk keys for deletion detection
  const currentKeys = new Set<string>()

  for (const doc of allBlocks.documents) {
    let docChunkCount = 0
    let docTotalTokens = 0

    for (let blockIndex = 0; blockIndex < doc.blocks.length; blockIndex++) {
      const block = doc.blocks[blockIndex]
      if (!block.blockId || !block.text.trim()) continue

      const key = chunkKey(doc.documentId, block.blockId)
      currentKeys.add(key)

      // Skip unchanged chunks
      const existingHash = index.chunkHashes.get(key)
      if (existingHash === block.textHash) {
        const existingChunk = index.chunks.get(key)
        if (existingChunk) {
          docChunkCount++
          docTotalTokens += existingChunk.tokenCount
          continue
        }
      }

      // Index this chunk (new or changed)
      const terms = tokenize(block.text)
      const termFreqs = new Map<string, number>()
      for (const term of terms) {
        termFreqs.set(term, (termFreqs.get(term) || 0) + 1)
      }

      const tokenCount = estimateTokens(block.text)

      const ref: ChunkRef = {
        documentId: doc.documentId,
        blockId: block.blockId,
        documentTitle: doc.documentTitle,
        blockType: block.type,
        blockIndex,
      }

      const chunk: IndexedChunk = {
        ref,
        text: block.text,
        textHash: block.textHash || djb2Hash(block.text),
        tokenCount,
        termFrequencies: termFreqs,
        totalTerms: terms.length,
      }

      // Remove old inverted index entries if this chunk existed before
      const oldChunk = index.chunks.get(key)
      if (oldChunk) {
        for (const term of oldChunk.termFrequencies.keys()) {
          const postings = index.invertedIndex.get(term)
          if (postings) {
            postings.delete(key)
            if (postings.size === 0) index.invertedIndex.delete(term)
          }
        }
      }

      // Add new inverted index entries
      for (const term of termFreqs.keys()) {
        let postings = index.invertedIndex.get(term)
        if (!postings) {
          postings = new Set()
          index.invertedIndex.set(term, postings)
        }
        postings.add(key)
      }

      index.chunks.set(key, chunk)
      index.chunkHashes.set(key, chunk.textHash)

      docChunkCount++
      docTotalTokens += tokenCount
    }

    index.documents.set(doc.documentId, {
      title: doc.documentTitle,
      chunkCount: docChunkCount,
      totalTokens: docTotalTokens,
    })
  }

  // Remove chunks that no longer exist
  for (const key of [...index.chunks.keys()]) {
    if (!currentKeys.has(key)) {
      const chunk = index.chunks.get(key)!
      // Remove from inverted index
      for (const term of chunk.termFrequencies.keys()) {
        const postings = index.invertedIndex.get(term)
        if (postings) {
          postings.delete(key)
          if (postings.size === 0) index.invertedIndex.delete(term)
        }
      }
      index.chunks.delete(key)
      index.chunkHashes.delete(key)
    }
  }

  // Recalculate corpus stats
  index.totalChunks = index.chunks.size
  let totalTerms = 0
  for (const chunk of index.chunks.values()) {
    totalTerms += chunk.totalTerms
  }
  index.avgDocLength = index.totalChunks > 0 ? totalTerms / index.totalChunks : 0
  index.lastIndexedAt = new Date().toISOString()

  return index
}

// ─── BM25 Scoring ──────────────────────────────────────────────────────

/**
 * Score a single chunk against a set of query terms using Okapi BM25.
 * k1=1.2, b=0.75 are standard parameters.
 */
export function scoreBM25(
  queryTerms: string[],
  chunk: IndexedChunk,
  index: ChunkIndex,
  k1 = 1.2,
  b = 0.75
): number {
  let score = 0
  const dl = chunk.totalTerms
  const avgdl = index.avgDocLength

  for (const term of queryTerms) {
    const tf = chunk.termFrequencies.get(term) || 0
    if (tf === 0) continue

    const df = index.invertedIndex.get(term)?.size || 0
    // IDF with +1 smoothing to avoid negative scores
    const idf = Math.log((index.totalChunks - df + 0.5) / (df + 0.5) + 1)

    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgdl)))
    score += idf * tfNorm
  }

  return score
}

// ─── Query Interface ───────────────────────────────────────────────────

export interface QueryResult {
  chunkKey: string
  score: number
}

/**
 * Query the index with a text string, returning top-K chunks ranked by BM25 score.
 * Skips chunks with score <= 0.
 */
export function queryIndex(
  index: ChunkIndex,
  query: string,
  topK: number
): QueryResult[] {
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) return []

  // Collect candidate chunk keys: only chunks that contain at least one query term
  const candidateKeys = new Set<string>()
  for (const term of queryTerms) {
    const postings = index.invertedIndex.get(term)
    if (postings) {
      for (const key of postings) {
        candidateKeys.add(key)
      }
    }
  }

  // Score candidates
  const results: QueryResult[] = []
  for (const key of candidateKeys) {
    const chunk = index.chunks.get(key)
    if (!chunk) continue

    const score = scoreBM25(queryTerms, chunk, index)
    if (score > 0) {
      results.push({ chunkKey: key, score })
    }
  }

  // Sort descending by score, take top-K
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, topK)
}
