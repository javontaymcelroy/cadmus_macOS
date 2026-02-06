import type { JSONContent } from '@tiptap/core'
import type {
  Project,
  ProjectSettings,
  Diagnostic,
  Fix,
  PassResult,
  BuildResult
} from '../../src/types/project'

// Document with content for pass processing
export interface DocumentWithContent {
  id: string
  title: string
  content: JSONContent
  plainText: string
}

// Context passed to each pass
export interface PassContext {
  project: Project
  documents: DocumentWithContent[]
  settings: ProjectSettings
}

// Pass interface that all passes must implement
export interface Pass {
  id: string
  name: string
  kind: 'local' | 'ai'
  run(ctx: PassContext): Promise<PassResult>
}

// Registry for managing passes
export class PassRegistry {
  private passes: Map<string, Pass> = new Map()

  register(pass: Pass): void {
    this.passes.set(pass.id, pass)
  }

  get(passId: string): Pass | undefined {
    return this.passes.get(passId)
  }

  getAll(): Pass[] {
    return Array.from(this.passes.values())
  }

  getEnabled(enabledIds: string[]): Pass[] {
    return enabledIds
      .map(id => this.passes.get(id))
      .filter((pass): pass is Pass => pass !== undefined)
  }
}

// Convert TipTap JSON content to plain text with position mapping
export interface TextPosition {
  offset: number      // Position in plain text
  docPosition: number // Position in TipTap document
  mentionTextLength?: number // If this is a mention, the length of the mention text in plain text
}

export interface PlainTextResult {
  text: string
  positions: TextPosition[]
}

export function contentToPlainText(content: JSONContent): PlainTextResult {
  const positions: TextPosition[] = []
  let text = ''
  let docPos = 0

  function traverse(node: JSONContent): void {
    // Opening tag position for non-doc nodes
    if (node.type && node.type !== 'doc' && node.type !== 'text') {
      docPos += 1
    }

    if (node.type === 'text' && node.text) {
      // Track each text node's start position
      positions.push({
        offset: text.length,
        docPosition: docPos
      })
      text += node.text
      docPos += node.text.length
    } else if (node.type === 'mention') {
      // Handle mention nodes - include them in the text so grammar checkers
      // don't see gaps in the text (e.g., "A STURDY , stocky" instead of "A STURDY @BADGER, stocky")
      // Note: Mentions are atomic nodes in TipTap (nodeSize = 1), but we add the full text
      // for grammar checking. We track the mentionTextLength to adjust position mapping.
      const mentionText = node.attrs?.label || node.attrs?.id || 'mention'
      positions.push({
        offset: text.length,
        docPosition: docPos,
        mentionTextLength: mentionText.length // Track length for position adjustment
      })
      text += mentionText
      // Mentions are atomic nodes in TipTap, they take up 1 position
      docPos += 1
    } else if (node.content) {
      for (const child of node.content) {
        traverse(child)
      }
    }

    // Closing position for container nodes (those with content property)
    if (node.type && node.type !== 'doc' && node.type !== 'text') {
      if (Array.isArray(node.content)) {
        docPos += 1
      }
    }

    // Add newline AFTER closing tag for block elements
    // Note: screenplayElement must be included for screenplay documents to have proper line breaks
    if (['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'screenplayElement'].includes(node.type || '')) {
      if (text.length > 0 && !text.endsWith('\n')) {
        // Track the newline position (maps to end of block)
        positions.push({
          offset: text.length,
          docPosition: docPos
        })
        text += '\n'
      }
    }
  }

  traverse(content)
  return { text: text.trimEnd(), positions }
}

// Map plain text offset back to document position
// This function accounts for mention nodes which have different sizes in plain text vs document
export function plainTextOffsetToDocPos(
  offset: number,
  positions: TextPosition[]
): number {
  // Calculate cumulative adjustment for mentions that appear before the target offset
  // Mentions add (mentionTextLength - 1) extra characters in plain text vs document
  let mentionAdjustment = 0
  
  // First pass: calculate total adjustment from all mentions before this offset
  for (const pos of positions) {
    if (pos.mentionTextLength) {
      const mentionEndOffset = pos.offset + pos.mentionTextLength
      if (offset >= mentionEndOffset) {
        // Offset is after this mention - add full adjustment
        mentionAdjustment += pos.mentionTextLength - 1
      } else if (offset > pos.offset && offset < mentionEndOffset) {
        // Offset is within the mention text - map to the mention node position
        return pos.docPosition
      }
    }
  }
  
  // Find the position entry that contains this offset (after adjustment)
  for (let i = positions.length - 1; i >= 0; i--) {
    const pos = positions[i]
    if (pos.offset <= offset) {
      // Skip mention entries when calculating final position
      // (they've already been accounted for in the adjustment)
      if (pos.mentionTextLength) {
        continue
      }
      
      // Calculate adjusted delta
      const delta = offset - pos.offset - mentionAdjustment
      
      // Ensure we don't go negative
      return pos.docPosition + Math.max(0, delta)
    }
  }
  
  return Math.max(0, offset - mentionAdjustment) // Fallback
}

// Main Pass Engine that orchestrates pass execution
export class PassEngine {
  private registry: PassRegistry

  constructor(registry: PassRegistry) {
    this.registry = registry
  }

  async runBuild(ctx: PassContext): Promise<BuildResult> {
    const startTime = Date.now()
    const allDiagnostics: Diagnostic[] = []
    const passResults: PassResult[] = []
    let hasErrors = false

    // Get enabled passes in order
    const enabledPasses = this.registry.getEnabled(ctx.settings.enabledPasses)

    // Run each pass sequentially
    for (const pass of enabledPasses) {
      try {
        console.log(`[PassEngine] Running pass: ${pass.name}`)
        const result = await pass.run(ctx)
        passResults.push(result)
        allDiagnostics.push(...result.diagnostics)

        // Check for errors
        if (result.diagnostics.some(d => d.severity === 'error')) {
          hasErrors = true
        }
      } catch (error) {
        console.error(`[PassEngine] Pass ${pass.name} failed:`, error)
        // Add error diagnostic for failed pass
        allDiagnostics.push({
          id: `${pass.id}-error`,
          passId: pass.id,
          severity: 'error',
          title: `${pass.name} Failed`,
          message: error instanceof Error ? error.message : 'Unknown error',
          documentId: ''
        })
        hasErrors = true
      }
    }

    // Sort diagnostics by severity (errors first) then by document
    const severityOrder = { error: 0, warning: 1, info: 2 }
    allDiagnostics.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      return a.documentId.localeCompare(b.documentId)
    })

    const totalTiming = Date.now() - startTime

    return {
      success: !hasErrors,
      diagnostics: allDiagnostics,
      passResults,
      totalTiming
    }
  }
}

// Create and configure the global pass registry
export function createPassRegistry(): PassRegistry {
  return new PassRegistry()
}
