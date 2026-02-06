/**
 * Block Anchoring Utilities
 * 
 * Provides functionality to anchor storyboard shots to script text blocks
 * and re-anchor them after edits using context hashing.
 */

import type { JSONContent } from '@tiptap/core'
import type { BlockAnchor, StoryboardShot, Storyboard } from '../types/project'

// Context length for prefix/suffix hashing (characters)
const CONTEXT_LENGTH = 50

/**
 * Generate a simple hash from a string for anchor context matching.
 * Uses a fast, deterministic hash that's good for short strings.
 */
export function generateAnchorHash(text: string): string {
  // Simple djb2 hash
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return (hash >>> 0).toString(16) // Unsigned
}

/**
 * Extract all text from a TipTap JSON node recursively.
 */
export function extractTextFromNode(node: JSONContent): string {
  if (node.type === 'text' && node.text) {
    return node.text
  }
  
  if (node.content) {
    return node.content.map(extractTextFromNode).join('')
  }
  
  return ''
}

/**
 * Extract text from a document up to a certain position (for prefix context).
 */
function extractTextBefore(doc: JSONContent, targetBlockId: string): string {
  const texts: string[] = []
  let found = false
  
  function traverse(node: JSONContent): void {
    if (found) return
    
    // Check if this is our target block
    if (node.attrs?.blockId === targetBlockId) {
      found = true
      return
    }
    
    // Add text from this node
    if (node.type === 'text' && node.text) {
      texts.push(node.text)
    }
    
    // Traverse children
    if (node.content) {
      for (const child of node.content) {
        if (found) break
        traverse(child)
      }
    }
  }
  
  traverse(doc)
  return texts.join('')
}

/**
 * Extract text from a document after a certain block (for suffix context).
 */
function extractTextAfter(doc: JSONContent, targetBlockId: string): string {
  const texts: string[] = []
  let foundTarget = false
  let passedTarget = false
  
  function traverse(node: JSONContent): void {
    // Check if this is our target block
    if (node.attrs?.blockId === targetBlockId) {
      foundTarget = true
      // Continue to traverse this node's content, then set passedTarget
      if (node.content) {
        for (const child of node.content) {
          traverse(child)
        }
      }
      passedTarget = true
      return
    }
    
    // If we've passed the target, collect text
    if (passedTarget) {
      if (node.type === 'text' && node.text) {
        texts.push(node.text)
      }
    }
    
    // Traverse children
    if (node.content) {
      for (const child of node.content) {
        traverse(child)
      }
    }
  }
  
  traverse(doc)
  return foundTarget ? texts.join('') : ''
}

/**
 * Find a block by its ID and extract its text content.
 */
export function getBlockText(doc: JSONContent, blockId: string): string | null {
  let result: string | null = null
  const allBlocks: Array<{id: string, text: string, type: string}> = []
  
  function traverse(node: JSONContent): void {
    // Collect ALL blocks with blockIds for debugging
    if (node.attrs?.blockId) {
      allBlocks.push({
        id: node.attrs.blockId as string,
        text: extractTextFromNode(node).slice(0, 30),
        type: node.type || 'unknown'
      })
    }
    
    if (result === null && node.attrs?.blockId === blockId) {
      result = extractTextFromNode(node)
    }
    
    if (node.content) {
      for (const child of node.content) {
        traverse(child)
      }
    }
  }
  
  traverse(doc)
  
  return result
}

/**
 * Capture anchor context for a block in a document.
 * Returns null if the block is not found.
 */
export function captureBlockAnchor(
  doc: JSONContent,
  blockId: string,
  documentId: string
): BlockAnchor | null {
  // Get the block's text
  const textSnapshot = getBlockText(doc, blockId)
  if (textSnapshot === null) {
    return null
  }
  
  // Get prefix and suffix context
  const prefixText = extractTextBefore(doc, blockId)
  const suffixText = extractTextAfter(doc, blockId)
  
  // Take the last CONTEXT_LENGTH chars of prefix and first CONTEXT_LENGTH of suffix
  const prefixContext = prefixText.slice(-CONTEXT_LENGTH)
  const suffixContext = suffixText.slice(0, CONTEXT_LENGTH)
  
  return {
    blockId,
    documentId,
    prefixHash: generateAnchorHash(prefixContext),
    suffixHash: generateAnchorHash(suffixContext),
    textSnapshot
  }
}

/**
 * Find all blocks in a document with their text content.
 */
interface BlockInfo {
  blockId: string
  text: string
  prefixText: string
  suffixText: string
}

function collectAllBlocks(doc: JSONContent): BlockInfo[] {
  const blocks: BlockInfo[] = []
  const allText: string[] = []
  
  function traverse(node: JSONContent, depth = 0): void {
    // If this node has a blockId, it's a block we can anchor to
    if (node.attrs?.blockId) {
      const blockText = extractTextFromNode(node)
      const prefixText = allText.join('')
      
      blocks.push({
        blockId: node.attrs.blockId as string,
        text: blockText,
        prefixText,
        suffixText: '' // Will be filled in later
      })
      
      // Add this block's text to the running total
      allText.push(blockText)
    } else if (node.type === 'text' && node.text) {
      // Text nodes without blockId contribute to context but aren't anchorable
      allText.push(node.text)
    }
    
    // Traverse children
    if (node.content) {
      for (const child of node.content) {
        traverse(child, depth + 1)
      }
    }
  }
  
  traverse(doc)
  
  // Fill in suffix text for each block
  const fullText = allText.join('')
  let currentPos = 0
  
  for (const block of blocks) {
    currentPos += block.prefixText.length
    const afterBlockPos = currentPos + block.text.length
    block.suffixText = fullText.slice(afterBlockPos)
    currentPos = afterBlockPos
  }
  
  // Actually, let's recalculate properly
  // Each block's suffix is everything after it
  for (let i = 0; i < blocks.length; i++) {
    const suffixParts: string[] = []
    for (let j = i + 1; j < blocks.length; j++) {
      suffixParts.push(blocks[j].text)
    }
    blocks[i].suffixText = suffixParts.join('')
  }
  
  return blocks
}

/**
 * Attempt to relocate a block that may have moved after edits.
 * Returns the new blockId if found, or null if relocation failed.
 */
export function relocateBlock(
  doc: JSONContent,
  anchor: BlockAnchor
): string | null {
  // First, try exact blockId match
  const exactMatch = getBlockText(doc, anchor.blockId)
  if (exactMatch !== null) {
    // Block still exists - check if text is similar enough
    if (exactMatch === anchor.textSnapshot) {
      return anchor.blockId
    }
    // Text changed but block ID exists - still use it
    // (User may have edited the block intentionally)
    return anchor.blockId
  }
  
  // Block ID not found - try to find by text matching
  const blocks = collectAllBlocks(doc)
  
  // Strategy 1: Exact text match
  const exactTextMatch = blocks.find(b => b.text === anchor.textSnapshot)
  if (exactTextMatch) {
    return exactTextMatch.blockId
  }
  
  // Strategy 2: Context hash matching
  // Find blocks with matching prefix OR suffix hash
  const candidates: Array<{ blockId: string; score: number }> = []
  
  for (const block of blocks) {
    const prefixContext = block.prefixText.slice(-CONTEXT_LENGTH)
    const suffixContext = block.suffixText.slice(0, CONTEXT_LENGTH)
    const prefixHash = generateAnchorHash(prefixContext)
    const suffixHash = generateAnchorHash(suffixContext)
    
    let score = 0
    
    // Exact prefix match
    if (prefixHash === anchor.prefixHash) score += 2
    
    // Exact suffix match
    if (suffixHash === anchor.suffixHash) score += 2
    
    // Partial text match (using simple similarity)
    const textSimilarity = calculateTextSimilarity(block.text, anchor.textSnapshot)
    if (textSimilarity > 0.7) score += textSimilarity * 3
    
    if (score > 0) {
      candidates.push({ blockId: block.blockId, score })
    }
  }
  
  // Return the best candidate if it scores above threshold
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score)
    const best = candidates[0]
    if (best.score >= 2) {
      return best.blockId
    }
  }
  
  // Relocation failed
  return null
}

/**
 * Simple text similarity calculation (0-1).
 * Uses Jaccard similarity on word sets.
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 0))
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 0))
  
  if (words1.size === 0 && words2.size === 0) return 1
  if (words1.size === 0 || words2.size === 0) return 0
  
  let intersection = 0
  for (const word of words1) {
    if (words2.has(word)) intersection++
  }
  
  const union = words1.size + words2.size - intersection
  return intersection / union
}

/**
 * Validate all anchors in a storyboard against the current document content.
 * Returns shot IDs that have become unlinked.
 */
export function validateAnchors(
  storyboard: Storyboard,
  documents: Record<string, JSONContent>
): string[] {
  const unlinkedShotIds: string[] = []
  
  for (const shot of storyboard.shots) {
    if (!shot.linkedBlock) continue
    
    const doc = documents[shot.linkedBlock.documentId]
    if (!doc) {
      // Document not loaded or doesn't exist
      unlinkedShotIds.push(shot.id)
      continue
    }
    
    const relocatedBlockId = relocateBlock(doc, shot.linkedBlock)
    if (!relocatedBlockId) {
      unlinkedShotIds.push(shot.id)
    }
  }
  
  return unlinkedShotIds
}

/**
 * Attempt to repair unlinked shots by relocating their anchors.
 * Returns updated shots with new blockIds where possible.
 */
export function repairAnchors(
  shots: StoryboardShot[],
  documents: Record<string, JSONContent>
): StoryboardShot[] {
  return shots.map(shot => {
    if (!shot.linkedBlock) return shot
    
    const doc = documents[shot.linkedBlock.documentId]
    if (!doc) {
      return { ...shot, isUnlinked: true }
    }
    
    const relocatedBlockId = relocateBlock(doc, shot.linkedBlock)
    
    if (relocatedBlockId) {
      // Successfully relocated - update the anchor
      const newAnchor = captureBlockAnchor(doc, relocatedBlockId, shot.linkedBlock.documentId)
      if (newAnchor) {
        return {
          ...shot,
          linkedBlock: newAnchor,
          isUnlinked: false
        }
      }
    }
    
    // Relocation failed
    return { ...shot, isUnlinked: true }
  })
}

/**
 * Estimate duration in milliseconds based on text length.
 * Uses ~150 words per minute for narration pace.
 */
export function estimateDurationMs(text: string): number {
  if (!text || text.trim().length === 0) {
    return 3500 // Default 3.5 seconds for empty/no text
  }
  
  const words = text.trim().split(/\s+/).length
  const wordsPerMinute = 150
  const ms = (words / wordsPerMinute) * 60 * 1000
  
  // Clamp between 3 and 15 seconds
  return Math.max(3000, Math.min(ms, 15000))
}

/**
 * Get the effective duration for a shot.
 * Priority: manual override > estimate from linked text > default
 */
export function getShotDuration(
  shot: StoryboardShot,
  documents: Record<string, JSONContent>
): number {
  // Manual override takes priority
  if (shot.durationMs !== undefined) {
    return shot.durationMs
  }
  
  // If linked to a block, estimate from text
  if (shot.linkedBlock && !shot.isUnlinked) {
    const doc = documents[shot.linkedBlock.documentId]
    if (doc) {
      const text = getBlockText(doc, shot.linkedBlock.blockId)
      if (text) {
        return estimateDurationMs(text)
      }
    }
  }
  
  // Default duration
  return 3500
}
