/**
 * AIPreview Extension
 * 
 * A TipTap node that shows AI-generated content in a preview state
 * with accept/reject buttons. Used by the slash command AI writing tools.
 * 
 * For screenplays, it stores structured elements and inserts them with
 * proper formatting (scene-heading, action, character, dialogue, etc.)
 * and parses @NAME syntax to create proper mention nodes.
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { CheckmarkRegular, DismissRegular } from '@fluentui/react-icons'
import { clsx } from 'clsx'

// Screenplay element types
type ScreenplayElementType = 
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'

interface ScreenplayElement {
  type: ScreenplayElementType
  text: string
}

interface CharacterInfo {
  id: string
  name: string
  color?: string
}

interface PropInfo {
  id: string
  name: string
  icon?: string
}

export interface AIPreviewOptions {
  HTMLAttributes: Record<string, unknown>
  onAccept?: (previewId: string, text: string) => void
  onReject?: (previewId: string) => void
}

export interface AIPreviewAttributes {
  previewId: string
  generatedText: string
  commandName: string
  // Screenplay-specific attributes
  isScreenplay?: boolean
  screenplayElements?: string // JSON stringified ScreenplayElement[]
  characterMap?: string // JSON stringified Record<string, CharacterInfo>
  propMap?: string // JSON stringified Record<string, PropInfo>
  // Replacement mode (for rework command)
  isReplacement?: boolean
  replacementRange?: string // JSON stringified { from: number; to: number }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiPreview: {
      /**
       * Insert an AI preview node
       */
      insertAIPreview: (attrs: AIPreviewAttributes) => ReturnType
      /**
       * Accept an AI preview (keep the text)
       */
      acceptAIPreview: (previewId: string) => ReturnType
      /**
       * Reject an AI preview (remove it)
       */
      rejectAIPreview: (previewId: string) => ReturnType
    }
  }
}

// Element type display formatting
const ELEMENT_DISPLAY: Record<ScreenplayElementType, { label: string; color: string }> = {
  'scene-heading': { label: 'Scene', color: 'text-blue-400' },
  'action': { label: 'Action', color: 'text-ink-300' },
  'character': { label: 'Char', color: 'text-purple-400' },
  'dialogue': { label: 'Dial', color: 'text-green-400' },
  'parenthetical': { label: 'Paren', color: 'text-yellow-400' },
  'transition': { label: 'Trans', color: 'text-orange-400' },
  'shot': { label: 'Shot', color: 'text-cyan-400' },
}

/**
 * Find the best matching character for a mention name (flexible matching)
 */
function findMatchingCharacterForMention(
  mentionName: string,
  characterMap: Record<string, CharacterInfo>
): CharacterInfo | null {
  const normalized = mentionName.trim().toUpperCase()
  
  // Try exact match first
  if (characterMap[normalized]) {
    return characterMap[normalized]
  }
  
  // Try to find a character whose name is contained in the mention or vice versa
  for (const [charName, charInfo] of Object.entries(characterMap)) {
    // "NURSE WHITE" -> "WHITE"
    if (normalized.endsWith(charName) || normalized.startsWith(charName)) {
      return charInfo
    }
    // "WHITE" -> "NURSE WHITE"
    if (charName.endsWith(normalized) || charName.startsWith(normalized)) {
      return charInfo
    }
    // General contains check
    if (normalized.includes(charName) || charName.includes(normalized)) {
      return charInfo
    }
  }
  
  return null
}

/**
 * Find the best matching prop for a mention name
 */
function findMatchingProp(
  mentionName: string,
  propMap: Record<string, PropInfo>
): PropInfo | null {
  const normalized = mentionName.trim().toUpperCase()
  
  if (propMap[normalized]) {
    return propMap[normalized]
  }
  
  for (const [propName, propInfo] of Object.entries(propMap)) {
    if (normalized.includes(propName) || propName.includes(normalized)) {
      return propInfo
    }
  }
  
  return null
}

/**
 * Parse text and convert @MENTIONS to proper mention nodes
 * Returns an array of TipTap JSON content items
 */
function parseTextWithMentions(
  text: string,
  characterMap: Record<string, CharacterInfo>,
  propMap: Record<string, PropInfo>
): unknown[] {
  const content: unknown[] = []
  
  // Match @NAME patterns (uppercase names, can include spaces)
  // Pattern: @ followed by uppercase letters, numbers, spaces, hyphens until we hit lowercase or punctuation
  const mentionRegex = /@([A-Z][A-Z0-9\s\-']*[A-Z0-9]|[A-Z])/g
  
  let lastIndex = 0
  let match
  
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index)
      if (beforeText) {
        content.push({ type: 'text', text: beforeText })
      }
    }
    
    const mentionName = match[1].trim()
    
    // Check if this is a known character or prop (with flexible matching)
    const characterInfo = findMatchingCharacterForMention(mentionName, characterMap)
    const propInfo = !characterInfo ? findMatchingProp(mentionName, propMap) : null
    
    if (characterInfo) {
      // Insert character mention
      content.push({
        type: 'mention',
        attrs: {
          id: characterInfo.id,
          type: 'character',
          label: characterInfo.name,
          color: characterInfo.color || '#fbbf24'
        }
      })
    } else if (propInfo) {
      // Insert prop mention
      content.push({
        type: 'mention',
        attrs: {
          id: propInfo.id,
          type: 'prop',
          label: propInfo.name,
          color: '#fbbf24' // Gold for props
        }
      })
    } else {
      // Unknown mention - keep as plain text with @ prefix
      content.push({ type: 'text', text: `@${mentionName}` })
    }
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text after the last mention
  if (lastIndex < text.length) {
    content.push({ type: 'text', text: text.slice(lastIndex) })
  }
  
  // If no content was added, just return the original text
  if (content.length === 0 && text) {
    content.push({ type: 'text', text })
  }
  
  return content
}

/**
 * Find the best matching character for a character cue
 * Handles cases like "NURSE WHITE" matching "WHITE", or "WHITE (V.O.)" matching "WHITE"
 */
function findMatchingCharacter(
  charCue: string,
  characterMap: Record<string, CharacterInfo>
): CharacterInfo | null {
  const normalizedCue = charCue.trim().toUpperCase()
  
  // Remove common screenplay extensions like (V.O.), (O.S.), (CONT'D)
  const cleanCue = normalizedCue
    .replace(/\s*\(V\.?O\.?\)$/i, '')
    .replace(/\s*\(O\.?S\.?\)$/i, '')
    .replace(/\s*\(CONT'?D?\)$/i, '')
    .replace(/\s*\(OFF\)$/i, '')
    .trim()
  
  // Try exact match first
  if (characterMap[cleanCue]) {
    return characterMap[cleanCue]
  }
  
  // Try to find a character whose name is contained in the cue
  // e.g., "NURSE WHITE" contains "WHITE"
  for (const [charName, charInfo] of Object.entries(characterMap)) {
    // Check if character name is at the end of the cue (most common: "NURSE WHITE" -> "WHITE")
    if (cleanCue.endsWith(charName)) {
      return charInfo
    }
    // Check if character name is at the start of the cue
    if (cleanCue.startsWith(charName)) {
      return charInfo
    }
    // Check if the cue contains the character name
    if (cleanCue.includes(charName)) {
      return charInfo
    }
  }
  
  // Try the other direction - check if cue is contained in any character name
  // e.g., "WHITE" might be in "NURSE WHITE" in the character bank
  for (const [charName, charInfo] of Object.entries(characterMap)) {
    if (charName.includes(cleanCue)) {
      return charInfo
    }
  }
  
  return null
}

/**
 * Build TipTap content for screenplay elements with @mention parsing
 */
function buildScreenplayContent(
  elements: ScreenplayElement[],
  characterMap: Record<string, CharacterInfo>,
  propMap: Record<string, PropInfo>
): unknown[] {
  return elements.map(element => {
    // For character elements, try to match with a known character
    if (element.type === 'character') {
      const charText = element.text.trim()
      const charInfo = findMatchingCharacter(charText, characterMap)
      
      if (charInfo) {
        // Check if there's a suffix like (V.O.) to preserve
        const suffixMatch = charText.match(/(\s*\((?:V\.?O\.?|O\.?S\.?|CONT'?D?|OFF)\))$/i)
        const suffix = suffixMatch ? suffixMatch[1] : ''
        
        // Build content with mention + optional suffix
        const content: unknown[] = [{
          type: 'mention',
          attrs: {
            id: charInfo.id,
            type: 'character',
            label: charInfo.name,
            color: charInfo.color || '#fbbf24'
          }
        }]
        
        // Add suffix as text if present
        if (suffix) {
          content.push({ type: 'text', text: suffix })
        }
        
        return {
          type: 'screenplayElement',
          attrs: { elementType: element.type },
          content
        }
      }
      
      // No match found - just use plain text
      return {
        type: 'screenplayElement',
        attrs: { elementType: element.type },
        content: [{ type: 'text', text: charText }]
      }
    }
    
    // For other elements, parse for @mentions
    const contentItems = parseTextWithMentions(element.text, characterMap, propMap)
    
    return {
      type: 'screenplayElement',
      attrs: { elementType: element.type },
      content: contentItems
    }
  })
}

// React component for the AI preview node view
interface AIPreviewComponentProps {
  node: {
    attrs: AIPreviewAttributes
    nodeSize: number
  }
  extension: {
    options: AIPreviewOptions
  }
  deleteNode: () => void
  editor: {
    chain: () => {
      focus: () => {
        deleteRange: (range: { from: number; to: number }) => {
          insertContentAt: (pos: number, content: unknown) => {
            run: () => boolean
          }
          run: () => boolean
        }
        insertContentAt: (pos: number, content: unknown) => {
          run: () => boolean
        }
        command: (fn: (props: { tr: { delete: (from: number, to: number) => unknown; replaceWith: (from: number, to: number, node: unknown) => unknown }; state: { schema: { text: (s: string) => unknown } } }) => boolean) => {
          run: () => boolean
        }
      }
    }
    view: {
      state: {
        schema: {
          text: (content: string) => unknown
          nodes: {
            screenplayElement?: {
              create: (attrs: { elementType: string }, content?: unknown) => unknown
            }
            paragraph?: {
              create: (attrs?: unknown, content?: unknown) => unknown
            }
          }
        }
      }
    }
    extensionManager: {
      extensions: Array<{ name: string }>
    }
  }
  getPos: () => number
}

function AIPreviewComponent({ node, extension, editor, getPos }: AIPreviewComponentProps) {
  const { 
    previewId, 
    generatedText, 
    commandName, 
    isScreenplay, 
    screenplayElements, 
    characterMap: characterMapStr, 
    propMap: propMapStr,
    isReplacement,
    replacementRange: replacementRangeStr
  } = node.attrs
  const { onAccept, onReject } = extension.options

  // Parse screenplay elements and entity maps if available
  let parsedElements: ScreenplayElement[] | null = null
  let characterMap: Record<string, CharacterInfo> = {}
  let propMap: Record<string, PropInfo> = {}
  let replacementRange: { from: number; to: number } | null = null
  
  if (isScreenplay && screenplayElements) {
    try {
      parsedElements = JSON.parse(screenplayElements)
    } catch {
      console.warn('[AIPreview] Failed to parse screenplay elements')
    }
  }
  
  if (characterMapStr) {
    try {
      characterMap = JSON.parse(characterMapStr)
    } catch {
      console.warn('[AIPreview] Failed to parse character map')
    }
  }
  
  if (propMapStr) {
    try {
      propMap = JSON.parse(propMapStr)
    } catch {
      console.warn('[AIPreview] Failed to parse prop map')
    }
  }
  
  if (replacementRangeStr) {
    try {
      replacementRange = JSON.parse(replacementRangeStr)
    } catch {
      console.warn('[AIPreview] Failed to parse replacement range')
    }
  }

  // Check if screenplayElement and mention node types exist
  const hasScreenplayExtension = editor.extensionManager.extensions.some(
    ext => ext.name === 'screenplayElement'
  )
  const hasMentionExtension = editor.extensionManager.extensions.some(
    ext => ext.name === 'mention'
  )

  const handleAccept = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const pos = getPos()
    const nodeSize = node.nodeSize
    
    // Build the content to insert
    let content: unknown
    
    if (parsedElements && parsedElements.length > 0 && hasScreenplayExtension) {
      // Build the TipTap content array for screenplay elements with mention parsing
      content = hasMentionExtension 
        ? buildScreenplayContent(parsedElements, characterMap, propMap)
        : parsedElements.map(element => ({
            type: 'screenplayElement',
            attrs: { elementType: element.type },
            content: [{ type: 'text', text: element.text }]
          }))
    } else {
      // Plain text for prose
      content = generatedText
    }
    
    // Handle replacement mode (for rework command)
    // In replacement mode, we need to:
    // 1. Delete the original selection
    // 2. Delete the preview node
    // 3. Insert the new content at the original selection position
    if (isReplacement && replacementRange) {
      // Calculate the position offset - the preview node was inserted AFTER the selection,
      // so we need to account for the document structure
      const { from: selFrom, to: selTo } = replacementRange
      
      // First, delete the preview node
      editor.chain()
        .focus()
        .deleteRange({ from: pos, to: pos + nodeSize })
        .run()
      
      // Now delete the original selection and insert the new content
      // Note: after deleting the preview, positions might have shifted
      editor.chain()
        .focus()
        .deleteRange({ from: selFrom, to: selTo })
        .insertContentAt(selFrom, content)
        .run()
    } else {
      // Standard mode - just replace the preview node with the content
      if (parsedElements && parsedElements.length > 0 && hasScreenplayExtension) {
        editor.chain()
          .focus()
          .deleteRange({ from: pos, to: pos + nodeSize })
          .insertContentAt(pos, content)
          .run()
      } else {
        // Plain text fallback - replace preview with text
        editor.chain().focus().command(({ tr, state }) => {
          tr.replaceWith(pos, pos + nodeSize, state.schema.text(generatedText))
          return true
        }).run()
      }
    }
    
    onAccept?.(previewId, generatedText)
  }

  const handleReject = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Remove the preview node entirely
    editor.chain().focus().command(({ tr }) => {
      const currentPos = getPos()
      const currentNodeSize = node.nodeSize
      tr.delete(currentPos, currentPos + currentNodeSize)
      return true
    }).run()
    
    onReject?.(previewId)
  }

  // Render text with @mentions highlighted in preview (using flexible matching)
  const renderPreviewText = (text: string) => {
    const parts: React.ReactNode[] = []
    const mentionRegex = /@([A-Z][A-Z0-9\s\-']*[A-Z0-9]|[A-Z])/g
    
    let lastIndex = 0
    let match
    let keyIndex = 0
    
    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      
      const mentionName = match[1].trim()
      // Use flexible matching
      const charInfo = findMatchingCharacterForMention(mentionName, characterMap)
      const propInfo = !charInfo ? findMatchingProp(mentionName, propMap) : null
      
      if (charInfo || propInfo) {
        // Render as highlighted mention with the resolved name
        const color = charInfo?.color || '#fbbf24'
        const displayName = charInfo?.name || propInfo?.name || mentionName
        parts.push(
          <span
            key={keyIndex++}
            className="px-1 rounded text-black font-medium"
            style={{ backgroundColor: color }}
          >
            @{displayName}
          </span>
        )
      } else {
        // Render as plain text (unrecognized mention)
        parts.push(`@${mentionName}`)
      }
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }
    
    return parts.length > 0 ? parts : text
  }
  
  // Render character element with mention highlighting
  const renderCharacterElement = (text: string) => {
    const charInfo = findMatchingCharacter(text, characterMap)
    
    if (charInfo) {
      // Extract suffix like (V.O.)
      const suffixMatch = text.match(/(\s*\((?:V\.?O\.?|O\.?S\.?|CONT'?D?|OFF)\))$/i)
      const suffix = suffixMatch ? suffixMatch[1] : ''
      
      return (
        <>
          <span
            className="px-1 rounded text-black font-medium"
            style={{ backgroundColor: charInfo.color || '#fbbf24' }}
          >
            @{charInfo.name}
          </span>
          {suffix && <span>{suffix}</span>}
        </>
      )
    }
    
    return text
  }

  return (
    <NodeViewWrapper as="div" className="ai-preview-wrapper my-2">
      <div className="ai-preview relative border-l-4 border-gold-400 bg-gold-400/5 rounded-r-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gold-400/10 border-b border-gold-400/20">
          <span className="text-xs font-ui font-medium text-gold-400 flex items-center gap-1.5">
            <span className="text-gold-400">✨</span>
            AI Generated: {commandName}
            {isScreenplay && (
              <span className="ml-1 px-1.5 py-0.5 bg-gold-400/20 rounded text-[10px]">
                Screenplay
              </span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleAccept}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-ui font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300 transition-colors"
              title="Accept (keep this text)"
              contentEditable={false}
            >
              <CheckmarkRegular className="w-3 h-3" />
              Accept
            </button>
            <button
              onClick={handleReject}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-ui font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-colors"
              title="Reject (remove this text)"
              contentEditable={false}
            >
              <DismissRegular className="w-3 h-3" />
              Reject
            </button>
          </div>
        </div>
        
        {/* Generated content */}
        <div className="px-3 py-2">
          {parsedElements && parsedElements.length > 0 ? (
            // Render screenplay elements with type indicators
            <div className="space-y-1.5">
              {parsedElements.map((element, idx) => {
                const display = ELEMENT_DISPLAY[element.type]
                return (
                  <div key={idx} className="flex gap-2 items-start">
                    <span className={clsx(
                      'flex-shrink-0 text-[9px] font-mono px-1 py-0.5 rounded bg-ink-800 uppercase tracking-wider',
                      display.color
                    )}>
                      {display.label}
                    </span>
                    <span className={clsx(
                      'text-gold-100 flex-1',
                      element.type === 'scene-heading' && 'uppercase font-bold',
                      element.type === 'action' && 'italic',
                      element.type === 'character' && 'uppercase text-center',
                      element.type === 'dialogue' && 'text-center px-8',
                      element.type === 'parenthetical' && 'text-center italic text-ink-400 text-sm',
                      element.type === 'transition' && 'uppercase text-right',
                      element.type === 'shot' && 'uppercase font-bold'
                    )}>
                      {element.type === 'character' 
                        ? renderCharacterElement(element.text)
                        : renderPreviewText(element.text)
                      }
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            // Plain text
            <div className="text-gold-100 whitespace-pre-wrap">
              {generatedText}
            </div>
          )}
        </div>
        
        {/* Keyboard shortcut hints */}
        <div className="px-3 py-1.5 border-t border-gold-400/10 text-[10px] text-ink-500 font-ui flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 bg-ink-800 rounded text-ink-400">⌘↵</kbd> Accept</span>
          <span><kbd className="px-1 py-0.5 bg-ink-800 rounded text-ink-400">Esc</kbd> Reject</span>
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const AIPreview = Node.create<AIPreviewOptions>({
  name: 'aiPreview',

  group: 'block',

  atom: true,

  selectable: true,

  draggable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      onAccept: undefined,
      onReject: undefined,
    }
  },

  addAttributes() {
    return {
      previewId: {
        default: null,
        parseHTML: element => element.getAttribute('data-preview-id'),
        renderHTML: attributes => ({
          'data-preview-id': attributes.previewId,
        }),
      },
      generatedText: {
        default: '',
        parseHTML: element => element.getAttribute('data-generated-text'),
        renderHTML: attributes => ({
          'data-generated-text': attributes.generatedText,
        }),
      },
      commandName: {
        default: 'AI Writing',
        parseHTML: element => element.getAttribute('data-command-name'),
        renderHTML: attributes => ({
          'data-command-name': attributes.commandName,
        }),
      },
      isScreenplay: {
        default: false,
        parseHTML: element => element.getAttribute('data-is-screenplay') === 'true',
        renderHTML: attributes => ({
          'data-is-screenplay': attributes.isScreenplay ? 'true' : 'false',
        }),
      },
      screenplayElements: {
        default: null,
        parseHTML: element => element.getAttribute('data-screenplay-elements'),
        renderHTML: attributes => ({
          'data-screenplay-elements': attributes.screenplayElements,
        }),
      },
      characterMap: {
        default: null,
        parseHTML: element => element.getAttribute('data-character-map'),
        renderHTML: attributes => ({
          'data-character-map': attributes.characterMap,
        }),
      },
      propMap: {
        default: null,
        parseHTML: element => element.getAttribute('data-prop-map'),
        renderHTML: attributes => ({
          'data-prop-map': attributes.propMap,
        }),
      },
      isReplacement: {
        default: false,
        parseHTML: element => element.getAttribute('data-is-replacement') === 'true',
        renderHTML: attributes => ({
          'data-is-replacement': attributes.isReplacement ? 'true' : 'false',
        }),
      },
      replacementRange: {
        default: null,
        parseHTML: element => element.getAttribute('data-replacement-range'),
        renderHTML: attributes => ({
          'data-replacement-range': attributes.replacementRange,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-ai-preview]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-ai-preview': '' }, this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AIPreviewComponent)
  },

  addCommands() {
    return {
      insertAIPreview:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          })
        },

      acceptAIPreview:
        (previewId) =>
        ({ tr, state, dispatch }) => {
          let found = false
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.previewId === previewId) {
              if (dispatch) {
                const generatedText = node.attrs.generatedText
                tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(generatedText))
              }
              found = true
              return false
            }
            return true
          })
          return found
        },

      rejectAIPreview:
        (previewId) =>
        ({ tr, dispatch, state }) => {
          let found = false
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.previewId === previewId) {
              if (dispatch) {
                tr.delete(pos, pos + node.nodeSize)
              }
              found = true
              return false
            }
            return true
          })
          return found
        },
    }
  },

  // Keyboard shortcuts for the preview
  addKeyboardShortcuts() {
    return {
      // Allow Enter to accept when the preview is selected
      'Mod-Enter': () => {
        const { selection } = this.editor.state
        const node = selection.$anchor.parent
        if (node.type.name === this.name) {
          return this.editor.commands.acceptAIPreview(node.attrs.previewId)
        }
        return false
      },
      // Allow Escape to reject when the preview is selected
      'Escape': () => {
        const { selection } = this.editor.state
        const node = selection.$anchor.parent
        if (node.type.name === this.name) {
          return this.editor.commands.rejectAIPreview(node.attrs.previewId)
        }
        return false
      },
    }
  },
})
