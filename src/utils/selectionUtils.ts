import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import type { 
  ExtractedMention, 
  Character, 
  Prop, 
  SurroundingScriptContext,
  CharacterContextInfo,
  ResolvedPronoun
} from '../types/project'

// Position mapping for converting plain text offsets to document positions
export interface TextPosition {
  offset: number      // Offset in plain text
  docPosition: number // Corresponding position in TipTap document
  mentionTextLength?: number // If this is a mention, the length of the mention text in plain text
}

export interface PlainTextResult {
  text: string
  positions: TextPosition[]
}

/**
 * Get the plain text from the current editor selection
 */
export function getSelectedText(editor: Editor | null): string {
  if (!editor) return ''
  
  const { from, to, empty } = editor.state.selection
  
  if (empty) return ''
  
  // Get the selected text slice
  const slice = editor.state.doc.textBetween(from, to, '\n', '\n')
  return slice
}

/**
 * Check if the editor has a non-empty selection
 */
export function hasSelection(editor: Editor | null): boolean {
  if (!editor) return false
  return !editor.state.selection.empty
}

/**
 * Extract all mention nodes from the current selection
 */
export function extractMentionsFromSelection(editor: Editor | null): ExtractedMention[] {
  if (!editor) return []
  
  const { from, to, empty } = editor.state.selection
  
  if (empty) return []
  
  const mentions: ExtractedMention[] = []
  const seenIds = new Set<string>()
  
  // Walk through the selected content and find mention nodes
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (node.type.name === 'mention') {
      const id = node.attrs.id as string
      const type = node.attrs.type as 'character' | 'prop'
      const label = node.attrs.label as string
      
      // Avoid duplicates
      if (id && !seenIds.has(id)) {
        seenIds.add(id)
        mentions.push({ type, id, label })
      }
    }
    return true // Continue traversal
  })
  
  return mentions
}

/**
 * Get the content of a character's note document as plain text
 */
function getCharacterNoteContent(
  character: Character,
  documents: Record<string, { content: JSONContent | null }>
): string | null {
  if (!character.noteDocumentId) return null
  
  const docState = documents[character.noteDocumentId]
  if (!docState?.content) return null
  
  return contentToPlainText(docState.content)
}

/**
 * Get the content of a prop's note document as plain text
 */
function getPropNoteContent(
  prop: Prop,
  documents: Record<string, { content: JSONContent | null }>
): string | null {
  if (!prop.noteDocumentId) return null
  
  const docState = documents[prop.noteDocumentId]
  if (!docState?.content) return null
  
  return contentToPlainText(docState.content)
}

/**
 * Convert JSONContent to plain text (simple version without position tracking)
 * NOTE: This MUST produce identical text to contentToPlainTextWithPositions
 * so that offsets calculated from this text can be mapped to document positions.
 */
export function contentToPlainText(content: JSONContent): string {
  // Use the version with positions and just return the text
  return contentToPlainTextWithPositions(content).text
}

/**
 * Convert JSONContent to plain text with position mapping
 * This tracks the mapping between plain text offsets and TipTap document positions
 * 
 * NOTE: This must match the logic in electron/services/passEngine.ts exactly
 * to ensure consistent position mapping across the codebase.
 */
export function contentToPlainTextWithPositions(content: JSONContent): PlainTextResult {
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

/**
 * Convert a plain text offset to a TipTap document position using the position map
 * This function accounts for mention nodes which have different sizes in plain text vs document
 * 
 * NOTE: This must match the logic in electron/services/passEngine.ts exactly
 */
export function plainTextOffsetToDocPos(offset: number, positions: TextPosition[]): number {
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

/**
 * Extract visual/appearance-related content from character notes
 * Looks for sections like "Appearance", "Physical Description", "Visual", etc.
 * and prioritizes that content for image generation
 */
function extractVisualDescription(noteContent: string): string {
  // Common section headers that indicate visual/appearance info
  const visualSectionPatterns = [
    /(?:^|\n)#+?\s*(?:appearance|physical description|looks?|visual|description|physical)\s*\n([\s\S]*?)(?=\n#+|\n\n\n|$)/i,
    /(?:^|\n)\*\*(?:appearance|physical description|looks?|visual|description|physical)\*\*:?\s*([\s\S]*?)(?=\n\*\*|\n\n\n|$)/i,
    /(?:^|\n)(?:appearance|physical description|looks?|visual|description|physical):?\s*([\s\S]*?)(?=\n[A-Z]|\n\n\n|$)/i,
  ]
  
  for (const pattern of visualSectionPatterns) {
    const match = noteContent.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()
      if (extracted.length > 20) { // Only use if substantial
        return extracted.length > 400 
          ? extracted.substring(0, 400) + '...'
          : extracted
      }
    }
  }
  
  // If no specific visual section found, use the beginning of the notes
  // but try to find sentences that mention physical attributes
  const physicalKeywords = /\b(tall|short|slim|stocky|muscular|age|years? old|\d+s?|hair|eyes?|skin|wears?|wearing|dressed|built|height|weight|face|scar|tattoo|beard|glasses)\b/i
  
  const sentences = noteContent.split(/[.!?]+/)
  const physicalSentences = sentences
    .filter(s => physicalKeywords.test(s))
    .map(s => s.trim())
    .filter(s => s.length > 10)
    .slice(0, 3) // Max 3 sentences
  
  if (physicalSentences.length > 0) {
    return physicalSentences.join('. ') + '.'
  }
  
  // Fallback: just use the first part of the notes
  return noteContent.length > 400 
    ? noteContent.substring(0, 400) + '...'
    : noteContent
}

/**
 * Build the context section for the prompt based on extracted mentions
 * Optimized for image generation - emphasizes visual character descriptions
 */
export function buildContextSection(
  mentions: ExtractedMention[],
  characters: Character[],
  props: Prop[],
  documents: Record<string, { content: JSONContent | null }>
): string {
  if (mentions.length === 0) return ''
  
  const contextLines: string[] = []
  
  for (const mention of mentions) {
    if (mention.type === 'character') {
      const character = characters.find(c => c.id === mention.id)
      if (character) {
        const noteContent = getCharacterNoteContent(character, documents)
        if (noteContent) {
          // Extract visual description specifically for image generation
          const visualDescription = extractVisualDescription(noteContent)
          contextLines.push(`- ${character.name} (CHARACTER VISUAL): ${visualDescription}`)
        } else {
          contextLines.push(`- ${character.name}: (No character notes available - add visual description to character document)`)
        }
      }
    } else if (mention.type === 'prop') {
      const prop = props.find(p => p.id === mention.id)
      if (prop) {
        const noteContent = getPropNoteContent(prop, documents)
        if (noteContent) {
          const truncatedContent = noteContent.length > 300 
            ? noteContent.substring(0, 300) + '...' 
            : noteContent
          contextLines.push(`- ${prop.name} (PROP): ${truncatedContent}`)
        } else {
          contextLines.push(`- ${prop.name} (PROP): (No prop notes available)`)
        }
      }
    }
  }
  
  if (contextLines.length === 0) return ''
  
  return `CHARACTER/PROP VISUAL DESCRIPTIONS (use these for the image):\n${contextLines.join('\n')}`
}

/**
 * Build the full prompt with selected text and optional context
 */
export function buildFullPrompt(
  selectedText: string,
  mentions: ExtractedMention[],
  characters: Character[],
  props: Prop[],
  documents: Record<string, { content: JSONContent | null }>,
  includeContext: boolean = true
): { prompt: string; contextSection: string } {
  const contextSection = includeContext 
    ? buildContextSection(mentions, characters, props, documents)
    : ''
  
  return {
    prompt: selectedText,
    contextSection
  }
}

// =============================================================================
// SURROUNDING CONTEXT EXTRACTION FOR IMAGE GENERATION
// =============================================================================

// Pronouns that we want to resolve to characters
const FEMALE_PRONOUNS = ['she', 'her', 'hers', 'herself']
const MALE_PRONOUNS = ['he', 'him', 'his', 'himself']
const NEUTRAL_PRONOUNS = ['they', 'them', 'their', 'theirs', 'themselves']
const ALL_PRONOUNS = [...FEMALE_PRONOUNS, ...MALE_PRONOUNS, ...NEUTRAL_PRONOUNS]

// Pattern to detect character introductions in action lines
// Matches: "NAME, description" or "NAME (age), description" at start of text or after period/newline
// Examples: "AVA KLINE, 30s, blood on her sleeve" or "MARCUS (40s), a grizzled veteran"
const CHARACTER_INTRO_PATTERN = /(?:^|[.\n]\s*)([A-Z][A-Z\s'-]+?)(?:\s*\(([^)]+)\))?,\s*([^.]+(?:\.[^.]*)?)/g

/**
 * Check if a string is likely all uppercase (for character name detection)
 */
function isAllCaps(str: string): boolean {
  const letters = str.replace(/[^a-zA-Z]/g, '')
  return letters.length > 0 && letters === letters.toUpperCase()
}

/**
 * Parse a character introduction from action text
 * Returns the character name and their visual description if found
 */
export function parseCharacterIntroduction(
  actionText: string,
  knownCharacters: Character[]
): { name: string; characterId?: string; description: string } | null {
  // Reset regex state
  CHARACTER_INTRO_PATTERN.lastIndex = 0
  
  // Try to find character introductions in the text
  let match: RegExpExecArray | null
  while ((match = CHARACTER_INTRO_PATTERN.exec(actionText)) !== null) {
    const rawName = match[1].trim()
    const ageParenthetical = match[2]?.trim() // e.g., "40s"
    const descriptionPart = match[3].trim()
    
    // Only consider if it looks like a character name (all caps)
    if (!isAllCaps(rawName)) continue
    
    // Clean up the name
    const name = rawName.replace(/\s+/g, ' ')
    
    // Build the full description
    let description = ''
    if (ageParenthetical) {
      description = `${ageParenthetical}, ${descriptionPart}`
    } else {
      description = descriptionPart
    }
    
    // Try to match to a known character
    const knownChar = knownCharacters.find(c => 
      c.name.toUpperCase() === name.toUpperCase() ||
      name.toUpperCase().includes(c.name.toUpperCase()) ||
      c.name.toUpperCase().includes(name.replace(/\s+/g, ' ').toUpperCase())
    )
    
    return {
      name,
      characterId: knownChar?.id,
      description
    }
  }
  
  return null
}

/**
 * Detect pronouns in the selected text that need resolution
 */
export function detectPronouns(text: string): string[] {
  const words = text.toLowerCase().split(/\b/)
  const foundPronouns: string[] = []
  const seen = new Set<string>()
  
  for (const word of words) {
    const cleanWord = word.trim()
    if (ALL_PRONOUNS.includes(cleanWord) && !seen.has(cleanWord)) {
      seen.add(cleanWord)
      // Capitalize for display
      foundPronouns.push(cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1))
    }
  }
  
  return foundPronouns
}

/**
 * Resolve pronouns to the most recent character(s) in context
 * Since we don't track gender, we use the most recent character for any pronoun
 */
export function resolvePronouns(
  pronouns: string[],
  recentCharacters: CharacterContextInfo[]
): ResolvedPronoun[] {
  if (pronouns.length === 0 || recentCharacters.length === 0) return []
  
  const resolved: ResolvedPronoun[] = []
  const mostRecentChar = recentCharacters[0] // Most recent character
  
  for (const pronoun of pronouns) {
    resolved.push({
      pronoun,
      resolvedTo: mostRecentChar.name,
      characterId: mostRecentChar.id,
      description: mostRecentChar.introductionText || mostRecentChar.noteContent
    })
  }
  
  return resolved
}

/**
 * Extract text content from a TipTap node (handles mentions properly)
 */
function extractTextFromNode(node: JSONContent): string {
  if (node.type === 'text' && node.text) {
    return node.text
  }
  if (node.type === 'mention') {
    return node.attrs?.label || node.attrs?.id || ''
  }
  if (node.content) {
    return node.content.map(extractTextFromNode).join('')
  }
  return ''
}

/**
 * Extract surrounding context from the screenplay document
 * Walks backwards from the selection to find:
 * - Scene heading
 * - Character dialogue headers (who's in the scene)
 * - Character introductions in action lines
 * - Recent action lines for context
 */
export function extractSurroundingContext(
  editor: Editor | null,
  characters: Character[],
  documents: Record<string, { content: JSONContent | null }>
): SurroundingScriptContext {
  const result: SurroundingScriptContext = {
    sceneHeading: undefined,
    recentCharacters: [],
    precedingAction: '',
    resolvedPronouns: []
  }
  
  if (!editor) return result
  
  const { from } = editor.state.selection
  const doc = editor.state.doc
  
  // Collect data as we walk backwards
  const charactersSeen = new Map<string, CharacterContextInfo>() // name -> info
  const actionLines: string[] = []
  let foundSceneHeading = false
  const maxActionLines = 3
  const maxCharacters = 5
  
  // Walk backwards through the document from selection position
  doc.nodesBetween(0, from, (node, nodePos) => {
    // Only process nodes that end before or at our selection
    const nodeEnd = nodePos + node.nodeSize
    if (nodeEnd > from) return true // Continue but skip this node
    
    // Check if this is a screenplay element
    if (node.type.name === 'screenplayElement') {
      const elementType = node.attrs.elementType as string
      // Convert ProseMirror Node to JSONContent format for extractTextFromNode
      const nodeJson = node.toJSON() as JSONContent
      const text = extractTextFromNode(nodeJson).trim()
      
      if (!text) return true
      
      switch (elementType) {
        case 'scene-heading':
          // Store scene heading and stop looking backwards
          if (!foundSceneHeading) {
            result.sceneHeading = text
            foundSceneHeading = true
          }
          break
          
        case 'character':
          // This is a dialogue header - track the character
          if (charactersSeen.size < maxCharacters) {
            const charName = text.toUpperCase().replace(/\s*\(.*?\)\s*/g, '').trim()
            if (!charactersSeen.has(charName)) {
              // Try to find matching character in bank
              const knownChar = characters.find(c => 
                c.name.toUpperCase() === charName ||
                charName.includes(c.name.toUpperCase())
              )
              
              // Get note content if available
              let noteContent: string | undefined
              if (knownChar?.noteDocumentId) {
                const docState = documents[knownChar.noteDocumentId]
                if (docState?.content) {
                  noteContent = contentToPlainText(docState.content)
                  // Truncate for prompt
                  if (noteContent && noteContent.length > 300) {
                    noteContent = noteContent.substring(0, 300) + '...'
                  }
                }
              }
              
              charactersSeen.set(charName, {
                name: charName,
                id: knownChar?.id,
                noteContent
              })
            }
          }
          break
          
        case 'action':
          // Check for character introductions
          const intro = parseCharacterIntroduction(text, characters)
          if (intro) {
            const existingChar = charactersSeen.get(intro.name)
            if (existingChar) {
              // Update with introduction text if we don't have it
              if (!existingChar.introductionText) {
                existingChar.introductionText = intro.description
              }
            } else if (charactersSeen.size < maxCharacters) {
              // Get note content if we found a matching character
              let noteContent: string | undefined
              if (intro.characterId) {
                const knownChar = characters.find(c => c.id === intro.characterId)
                if (knownChar?.noteDocumentId) {
                  const docState = documents[knownChar.noteDocumentId]
                  if (docState?.content) {
                    noteContent = contentToPlainText(docState.content)
                    if (noteContent && noteContent.length > 300) {
                      noteContent = noteContent.substring(0, 300) + '...'
                    }
                  }
                }
              }
              
              charactersSeen.set(intro.name, {
                name: intro.name,
                id: intro.characterId,
                introductionText: intro.description,
                noteContent
              })
            }
          }
          
          // Store recent action lines (most recent first)
          if (actionLines.length < maxActionLines) {
            actionLines.unshift(text)
          }
          break
      }
    }
    
    return true // Continue traversal
  })
  
  // Convert characters map to array (most recent first based on insertion order)
  result.recentCharacters = Array.from(charactersSeen.values())
  
  // Join action lines
  result.precedingAction = actionLines.join('\n')
  
  return result
}

/**
 * Format the surrounding context into a string for the prompt
 * Optimized for image generation - emphasizes visual character descriptions
 */
export function formatSurroundingContext(context: SurroundingScriptContext): string {
  const lines: string[] = []
  
  // Scene heading
  if (context.sceneHeading) {
    lines.push(`SCENE LOCATION: ${context.sceneHeading}`)
  }
  
  // Characters in scene with descriptions - formatted for visual reference
  if (context.recentCharacters.length > 0) {
    lines.push('')
    lines.push('CHARACTER VISUAL DESCRIPTIONS (draw these characters, NOT the reference image characters):')
    for (const char of context.recentCharacters) {
      // Prioritize visual descriptions
      if (char.introductionText) {
        lines.push(`- ${char.name}: ${char.introductionText}`)
      } else if (char.noteContent) {
        lines.push(`- ${char.name} appearance: ${char.noteContent}`)
      } else {
        lines.push(`- ${char.name}`)
      }
    }
  }
  
  // Pronoun resolutions - important for knowing WHO to draw
  if (context.resolvedPronouns.length > 0) {
    lines.push('')
    lines.push('PRONOUN KEY:')
    for (const resolved of context.resolvedPronouns) {
      let line = `- "${resolved.pronoun}" = ${resolved.resolvedTo}`
      if (resolved.description) {
        line += ` (${resolved.description})`
      }
      lines.push(line)
    }
  }
  
  // Recent action for continuity context
  if (context.precedingAction) {
    lines.push('')
    lines.push('PRECEDING ACTION (for context):')
    lines.push(context.precedingAction)
  }
  
  return lines.join('\n')
}

/**
 * Extract surrounding context and resolve pronouns in the selected text
 */
export function extractSurroundingContextWithPronouns(
  editor: Editor | null,
  selectedText: string,
  characters: Character[],
  documents: Record<string, { content: JSONContent | null }>
): SurroundingScriptContext {
  // First extract the surrounding context
  const context = extractSurroundingContext(editor, characters, documents)
  
  // Then detect and resolve pronouns in the selected text
  const pronouns = detectPronouns(selectedText)
  if (pronouns.length > 0 && context.recentCharacters.length > 0) {
    context.resolvedPronouns = resolvePronouns(pronouns, context.recentCharacters)
  }
  
  return context
}

// =============================================================================
// SELECTION INFO
// =============================================================================

/**
 * Get selection info for the toolbar button state
 */
export interface SelectionInfo {
  hasSelection: boolean
  selectedText: string
  mentions: ExtractedMention[]
  hasMentions: boolean
}

export function getSelectionInfo(editor: Editor | null): SelectionInfo {
  const selectedText = getSelectedText(editor)
  const mentions = extractMentionsFromSelection(editor)
  
  return {
    hasSelection: selectedText.length > 0,
    selectedText,
    mentions,
    hasMentions: mentions.length > 0
  }
}
