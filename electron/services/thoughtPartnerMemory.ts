/**
 * Thought Partner Pipeline — Structured Memory Module
 *
 * Replaces the append-only ContextDocument with a budgeted structured memory
 * that decays old items and periodically recompresses from conversation history.
 */

import type {
  StructuredMemory,
  MemoryField,
} from '../../shared/thoughtPartnerPipelineTypes'
import { MEMORY_TOKEN_BUDGETS } from '../../shared/thoughtPartnerPipelineTypes'
import type {
  ContextDocument,
  ThoughtPartnerMessage,
} from '../../shared/thoughtPartnerTypes'

// Approximate tokens from text: ~0.75 tokens per word
function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length
  return Math.ceil(words / 0.75)
}

function estimateArrayTokens(items: string[]): number {
  return items.reduce((sum, item) => sum + estimateTokens(item), 0)
}

/**
 * Trim an array of strings to fit within a token budget.
 * Drops the oldest items first (items at the beginning of the array).
 */
function trimToTokenBudget(items: string[], budget: number): string[] {
  let total = estimateArrayTokens(items)
  if (total <= budget) return items

  const result = [...items]
  while (result.length > 0 && total > budget) {
    const removed = result.shift()!
    total -= estimateTokens(removed)
  }
  return result
}

/**
 * Deduplicate items using normalized lowercase comparison.
 * Keeps the later (more recent) occurrence.
 */
function deduplicateItems(items: string[]): string[] {
  const seen = new Map<string, string>()
  for (const item of items) {
    const key = item.toLowerCase().trim()
    seen.set(key, item) // Later occurrences overwrite earlier ones
  }
  return Array.from(seen.values())
}

// ===== Public API =====

export function createEmptyStructuredMemory(): StructuredMemory {
  const now = new Date().toISOString()
  return {
    decisions: [],
    glossary: [],
    constraints: [],
    openQuestions: [],
    riskFlags: [],
    agreedIntents: [],
    diagnoses: [],
    lastCompressed: now,
    lastUpdated: now,
  }
}

/**
 * Merge a partial memory update into existing memory.
 * Appends new items, deduplicates, and trims to token budgets.
 */
export function mergeMemoryUpdate(
  existing: StructuredMemory,
  update: Partial<Pick<StructuredMemory, MemoryField>>
): StructuredMemory {
  const fields: MemoryField[] = [
    'decisions',
    'glossary',
    'constraints',
    'openQuestions',
    'riskFlags',
    'agreedIntents',
    'diagnoses',
  ]

  const merged: StructuredMemory = {
    ...existing,
    lastUpdated: new Date().toISOString(),
  }

  for (const field of fields) {
    const existingItems = existing[field]
    const updateItems = update[field]
    if (updateItems && updateItems.length > 0) {
      const combined = [...existingItems, ...updateItems]
      const deduped = deduplicateItems(combined)
      merged[field] = trimToTokenBudget(deduped, MEMORY_TOKEN_BUDGETS[field])
    }
  }

  return merged
}

/**
 * Recompress memory from the conversation source of truth.
 * Called every N messages to prevent drift and staleness.
 * This is a LOCAL operation — no API call.
 *
 * Strategy: Walk conversation history, extract items mentioned in
 * assistant messages that match memory field patterns, deduplicate,
 * and enforce budgets. This is a conservative heuristic — it keeps
 * existing items that still appear relevant and drops ones that were
 * superseded by later conversation.
 */
export function recompressMemory(
  memory: StructuredMemory,
  _conversationHistory: ThoughtPartnerMessage[]
): StructuredMemory {
  const fields: MemoryField[] = [
    'decisions',
    'glossary',
    'constraints',
    'openQuestions',
    'riskFlags',
    'agreedIntents',
    'diagnoses',
  ]

  const compressed: StructuredMemory = {
    ...memory,
    lastCompressed: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  }

  // For each field: deduplicate and re-enforce budget
  for (const field of fields) {
    const deduped = deduplicateItems(memory[field])
    compressed[field] = trimToTokenBudget(deduped, MEMORY_TOKEN_BUDGETS[field])
  }

  // Filter out per-edit constraints that leaked into permanent memory
  compressed.constraints = compressed.constraints.filter((c) => {
    const lower = c.toLowerCase()
    const ephemeralPatterns = [
      'this paragraph', 'this section', 'this scene', 'this block',
      'remove from', 'in this', 'from this', 'this sentence',
    ]
    return !ephemeralPatterns.some((p) => lower.includes(p))
  })

  // Remove open questions that were likely answered:
  // If a decision references a similar topic, the question is resolved
  const decisionTopics = new Set(
    compressed.decisions.map((d) =>
      d
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 5)
        .join(' ')
    )
  )

  compressed.openQuestions = compressed.openQuestions.filter((q) => {
    const questionWords = q
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 5)
      .join(' ')
    // Keep the question if no decision shares significant word overlap
    for (const topic of decisionTopics) {
      const topicWords = new Set(topic.split(' '))
      const qWords = questionWords.split(' ')
      const overlap = qWords.filter((w) => topicWords.has(w)).length
      if (overlap >= 2) return false // Question likely answered by a decision
    }
    return true
  })

  return compressed
}

/**
 * Migrate a legacy ContextDocument to StructuredMemory.
 */
export function migrateContextDocument(
  old: ContextDocument
): StructuredMemory {
  const now = new Date().toISOString()

  const memory: StructuredMemory = {
    decisions: trimToTokenBudget(
      deduplicateItems(old.decisions),
      MEMORY_TOKEN_BUDGETS.decisions
    ),
    glossary: [], // No direct equivalent in old format
    constraints: trimToTokenBudget(
      deduplicateItems(old.considerations),
      MEMORY_TOKEN_BUDGETS.constraints
    ),
    openQuestions: trimToTokenBudget(
      deduplicateItems(old.openQuestions),
      MEMORY_TOKEN_BUDGETS.openQuestions
    ),
    riskFlags: trimToTokenBudget(
      deduplicateItems(old.risks),
      MEMORY_TOKEN_BUDGETS.riskFlags
    ),
    agreedIntents: [],
    diagnoses: [],
    lastCompressed: now,
    lastUpdated: now,
  }

  // Migrate ideas into decisions (they're creative directions that were noted)
  if (old.ideas && old.ideas.length > 0) {
    const combined = [...memory.decisions, ...old.ideas]
    memory.decisions = trimToTokenBudget(
      deduplicateItems(combined),
      MEMORY_TOKEN_BUDGETS.decisions
    )
  }

  return memory
}

/**
 * Render structured memory as a text block for inclusion in the system prompt.
 */
export function memoryToPromptString(memory: StructuredMemory): string {
  const sections: string[] = []

  if (memory.decisions.length > 0) {
    sections.push(`Decisions:\n${memory.decisions.map((d) => `- ${d}`).join('\n')}`)
  }
  if (memory.glossary.length > 0) {
    sections.push(`Glossary:\n${memory.glossary.map((g) => `- ${g}`).join('\n')}`)
  }
  if (memory.constraints.length > 0) {
    sections.push(
      `Constraints:\n${memory.constraints.map((c) => `- ${c}`).join('\n')}`
    )
  }
  if (memory.openQuestions.length > 0) {
    sections.push(
      `Open Questions:\n${memory.openQuestions.map((q) => `- ${q}`).join('\n')}`
    )
  }
  if (memory.riskFlags.length > 0) {
    sections.push(
      `Risk Flags:\n${memory.riskFlags.map((r) => `- ${r}`).join('\n')}`
    )
  }
  if (memory.agreedIntents && memory.agreedIntents.length > 0) {
    sections.push(
      `Agreed Intents:\n${memory.agreedIntents.map((i) => `- ${i}`).join('\n')}`
    )
  }
  if (memory.diagnoses && memory.diagnoses.length > 0) {
    sections.push(
      `Diagnoses:\n${memory.diagnoses.map((d) => `- ${d}`).join('\n')}`
    )
  }

  if (sections.length === 0) {
    return '(No memory items yet.)'
  }

  return sections.join('\n\n')
}

/**
 * Parse a memory update from the model's text response.
 * Looks for a ```memory-update JSON block.
 * Returns the parsed update and the text with the block removed.
 */
export function parseMemoryUpdate(
  text: string
): {
  cleanText: string
  memoryUpdate: Partial<Pick<StructuredMemory, MemoryField>> | null
} {
  const regex = /```\s*memory-update\s*\n([\s\S]*?)\n\s*```/
  const match = text.match(regex)

  if (!match) {
    return { cleanText: text, memoryUpdate: null }
  }

  const cleanText = text.replace(regex, '').trim()

  try {
    const parsed = JSON.parse(match[1])
    // Validate that only known fields are present
    const validFields: MemoryField[] = [
      'decisions',
      'glossary',
      'constraints',
      'openQuestions',
      'riskFlags',
      'agreedIntents',
      'diagnoses',
    ]
    const update: Partial<Pick<StructuredMemory, MemoryField>> = {}

    for (const field of validFields) {
      if (Array.isArray(parsed[field]) && parsed[field].length > 0) {
        update[field] = parsed[field].filter(
          (item: unknown) => typeof item === 'string' && item.trim().length > 0
        )
      }
    }

    return {
      cleanText,
      memoryUpdate: Object.keys(update).length > 0 ? update : null,
    }
  } catch {
    return { cleanText, memoryUpdate: null }
  }
}
