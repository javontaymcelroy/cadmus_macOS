/**
 * SlashCommandMenu Component
 * 
 * Popover menu for AI writing commands triggered by "/".
 * Supports keyboard navigation and shows AI-generated content in a preview
 * that can be accepted or rejected.
 * 
 * When text is selected, shows revision commands (Rework, Expand Selection).
 * The "Rework" command revises selected text while keeping tone/consistency.
 */

import { forwardRef, useEffect, useImperativeHandle, useState, useCallback, useRef } from 'react'
import { clsx } from 'clsx'
import type { Editor } from '@tiptap/react'
import { 
  PenRegular, 
  ChatRegular, 
  LocationRegular, 
  ArrowExpandRegular, 
  PersonRegular,
  EditRegular
} from '@fluentui/react-icons'
import type { SlashCommandItem } from '../extensions/SlashCommand'
import { useProjectStore } from '../../../stores/projectStore'
import { contentToPlainText, extractSurroundingContext } from '../../../utils/selectionUtils'

// Icon mapping
const COMMAND_ICONS: Record<string, React.ElementType> = {
  pen: PenRegular,
  chat: ChatRegular,
  'chat-question': ChatRegular,
  location: LocationRegular,
  expand: ArrowExpandRegular,
  person: PersonRegular,
  edit: EditRegular,
}

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export interface SlashCommandMenuProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
  editor: Editor
  query: string
  // Selection-specific props
  hasSelection?: boolean
  selectedText?: string
  selectionRange?: { from: number; to: number }
}

// Loading text based on command type
const LOADING_TEXT: Record<string, string> = {
  continue: 'Continuing...',
  dialogue: 'Generating dialogue...',
  setting: 'Describing setting...',
  expand: 'Expanding...',
  pov: 'Writing from POV...',
  rework: 'Reworking...',
  ask: 'Thinking...',
}

// Get loading text for a command
function getLoadingText(commandId: string): string {
  return LOADING_TEXT[commandId] || 'Processing...'
}

// Generate a unique ID for the preview
function generatePreviewId(): string {
  return `ai-preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Check if the editor has screenplay extension loaded
function isScreenplayEditor(editor: Editor): boolean {
  return editor.extensionManager.extensions.some(
    ext => ext.name === 'screenplayElement'
  )
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command, editor, hasSelection, selectedText, selectionRange }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [inputMode, setInputMode] = useState(false)
    const [inputText, setInputText] = useState('')
    const pendingCommand = useRef<SlashCommandItem | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Store editor ref for async operations
    const editorRef = useRef(editor)
    editorRef.current = editor

    // Get project data for characters/props and documents for context extraction
    const currentProject = useProjectStore(state => state.currentProject)
    const documents = useProjectStore(state => state.documents)

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    // Execute the AI writing command
    const executeCommand = useCallback(async (item: SlashCommandItem, userQuestion?: string) => {
      const currentEditor = editorRef.current
      const { state } = currentEditor
      const { from } = state.selection
      
      // Detect if we're in screenplay mode
      const isScreenplay = isScreenplayEditor(currentEditor)
      
      // Check if this is a selection-based command (rework, expand selection, etc.)
      const isSelectionCommand = item.requiresSelection || item.id === 'rework'
      
      // Get text before cursor (up to 8000 chars) BEFORE we modify anything
      const textBefore = state.doc.textBetween(0, from, '\n', '\ufffc')
      const context = textBefore.slice(-8000)
      
      // For selection commands, use the stored selection
      // For non-selection commands, check if there's current selection
      let selection: string | undefined
      let originalSelectionRange: { from: number; to: number } | undefined
      
      if (isSelectionCommand && selectedText && selectionRange) {
        selection = selectedText
        originalSelectionRange = selectionRange
      } else {
        const { empty } = state.selection
        if (!empty) {
          selection = state.doc.textBetween(
            state.selection.from,
            state.selection.to,
            '\n',
            '\ufffc'
          )
        }
      }

      // Get document title from the first H1 if available
      let documentTitle: string | undefined
      state.doc.descendants((node) => {
        if (node.type.name === 'heading' && node.attrs.level === 1 && !documentTitle) {
          documentTitle = node.textContent
          return false
        }
        return true
      })

      // Get characters and props from the project (for screenplays)
      const characters = currentProject?.characters?.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color
      })) || []
      
      const props = currentProject?.props?.map(p => ({
        id: p.id,
        name: p.name,
        icon: p.icon
      })) || []

      // Extract structured scene context using extractSurroundingContext
      const surroundingContext = extractSurroundingContext(
        currentEditor,
        currentProject?.characters || [],
        documents
      )
      
      // Build scene context for AI
      const sceneContext = isScreenplay ? {
        sceneHeading: surroundingContext.currentSceneHeading,
        charactersInScene: surroundingContext.recentCharacters.map(c => c.name),
        precedingAction: surroundingContext.summary
      } : undefined

      // Gather supplementary context from project documents
      const supplementaryContext: {
        synopsis?: string
        characterNotes?: Array<{ name: string; content: string }>
        propNotes?: Array<{ name: string; content: string }>
        otherNotes?: Array<{ title: string; content: string }>
      } = {}

      if (currentProject?.path) {
        const projectPath = currentProject.path

        // Get scene character names for filtering (uppercase for comparison)
        const sceneCharacterNames = sceneContext?.charactersInScene?.map(c => c.toUpperCase()) || []

        // Load character notes - only for characters in the scene (if available)
        const charNotes: Array<{ name: string; content: string }> = []
        for (const char of currentProject.characters || []) {
          // Skip characters not in the scene (if we have scene context)
          if (sceneCharacterNames.length > 0) {
            const charNameUpper = char.name.toUpperCase()
            const isInScene = sceneCharacterNames.some(sceneName => 
              sceneName.includes(charNameUpper) || charNameUpper.includes(sceneName)
            )
            if (!isInScene) {
              continue
            }
          }
          
          if (char.noteDocumentId) {
            try {
              const content = await window.api.document.load(projectPath, char.noteDocumentId)
              if (content) {
                const plainText = contentToPlainText(content)
                if (plainText.trim().length > 0) {
                  charNotes.push({ name: char.name, content: plainText })
                }
              }
            } catch (e) {
              console.warn(`[SlashCommandMenu] Failed to load character note for ${char.name}:`, e)
            }
          }
        }
        if (charNotes.length > 0) {
          supplementaryContext.characterNotes = charNotes
        }

        // Load prop notes
        const propNotes: Array<{ name: string; content: string }> = []
        for (const prop of currentProject.props || []) {
          if (prop.noteDocumentId) {
            try {
              const content = await window.api.document.load(projectPath, prop.noteDocumentId)
              if (content) {
                const plainText = contentToPlainText(content)
                if (plainText.trim().length > 0) {
                  propNotes.push({ name: prop.name, content: plainText })
                }
              }
            } catch (e) {
              console.warn(`[SlashCommandMenu] Failed to load prop note for ${prop.name}:`, e)
            }
          }
        }
        if (propNotes.length > 0) {
          supplementaryContext.propNotes = propNotes
        }

        // Load other supplementary docs (notes, synopsis, etc. - not character/prop notes)
        const otherNotes: Array<{ title: string; content: string }> = []
        const supplementaryDocs = currentProject.documents?.filter(doc => 
          doc.type === 'document' && 
          (doc.isNote || doc.title.toLowerCase().includes('synopsis') || doc.title.toLowerCase().includes('outline')) &&
          !doc.isCharacterNote && 
          !doc.isPropNote &&
          !doc.isActBreak
        ) || []

        for (const doc of supplementaryDocs) {
          try {
            const content = await window.api.document.load(projectPath, doc.id)
            if (content) {
              const plainText = contentToPlainText(content)
              if (plainText.trim().length > 0) {
                // Check if this looks like a synopsis based on title
                if (doc.title.toLowerCase().includes('synopsis')) {
                  supplementaryContext.synopsis = plainText
                } else {
                  otherNotes.push({ title: doc.title, content: plainText })
                }
              }
            }
          } catch (e) {
            console.warn(`[SlashCommandMenu] Failed to load supplementary doc ${doc.title}:`, e)
          }
        }
        if (otherNotes.length > 0) {
          supplementaryContext.otherNotes = otherNotes
        }
      }

      // Close the menu first by calling command (this deletes the "/")
      command(item)

      // Get the loading text for this command
      const loadingText = getLoadingText(item.id)

      // Save scroll position
      const editorElement = currentEditor.view.dom.closest('.overflow-auto') as HTMLElement | null
      const scrollTop = editorElement?.scrollTop ?? 0

      // Insert loading placeholder with highlight color
      currentEditor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: loadingText,
          marks: [{ type: 'textStyle', attrs: { color: '#fbbf24' } }]
        })
        .run()

      try {
        // Call the AI writing service with template type and entity data
        const response = await window.api.aiWriting.generate({
          command: item.id,
          context,
          selection,
          documentTitle,
          characters: isScreenplay && characters.length > 0 ? characters : undefined,
          props: isScreenplay && props.length > 0 ? props : undefined,
          templateType: isScreenplay ? 'screenplay' : undefined,
          supplementaryContext: Object.keys(supplementaryContext).length > 0 ? supplementaryContext : undefined,
          sceneContext,
          targetRuntimeMinutes: isScreenplay ? currentProject.settings?.targetRuntimeMinutes : undefined,
          userQuestion: item.id === 'ask' ? userQuestion : undefined,
        })

        // Find the loading text in the document
        const { doc } = currentEditor.state
        let placeholderStart = -1
        let placeholderEnd = -1

        doc.descendants((node, pos) => {
          if (placeholderStart >= 0) return false
          if (node.isText && node.text?.includes(loadingText)) {
            const offset = node.text.indexOf(loadingText)
            placeholderStart = pos + offset
            placeholderEnd = placeholderStart + loadingText.length
            return false
          }
          return true
        })

        // Restore scroll position
        if (editorElement) {
          editorElement.scrollTop = scrollTop
        }

        if (response.error) {
          console.error('[SlashCommand] Error:', response.error)
          // Replace placeholder with error message
          if (placeholderStart >= 0) {
            currentEditor
              .chain()
              .focus()
              .setTextSelection({ from: placeholderStart, to: placeholderEnd })
              .deleteSelection()
              .insertContent({
                type: 'text',
                text: `[Error: ${response.error}]`,
                marks: [{ type: 'textStyle', attrs: { color: '#ef4444' } }]
              })
              .run()
          }
          requestAnimationFrame(() => {
            if (editorElement) editorElement.scrollTop = scrollTop
          })
          return
        }

        if (response.text && placeholderStart >= 0) {
          // Replace placeholder with AI Preview node
          const previewId = generatePreviewId()
          
          // Build preview attributes
          const previewAttrs: Record<string, unknown> = {
            previewId,
            generatedText: response.text,
            commandName: item.name,
          }
          
          // Add screenplay-specific data if available
          if (response.isScreenplay && response.screenplayElements) {
            previewAttrs.isScreenplay = true
            previewAttrs.screenplayElements = JSON.stringify(response.screenplayElements)
            // Pass character/prop maps for mention resolution
            if (response.characterMap) {
              previewAttrs.characterMap = JSON.stringify(response.characterMap)
            }
            if (response.propMap) {
              previewAttrs.propMap = JSON.stringify(response.propMap)
            }
          }
          
          // For rework commands, store the original selection range so we can replace it
          if (isSelectionCommand && originalSelectionRange) {
            previewAttrs.isReplacement = true
            previewAttrs.replacementRange = JSON.stringify(originalSelectionRange)
          }
          
          currentEditor
            .chain()
            .focus()
            .setTextSelection({ from: placeholderStart, to: placeholderEnd })
            .deleteSelection()
            .insertContent({
              type: 'aiPreview',
              attrs: previewAttrs,
            })
            .run()
          
          // Restore scroll position after content insertion
          requestAnimationFrame(() => {
            if (editorElement) editorElement.scrollTop = scrollTop
          })
        } else if (response.text) {
          // Fallback: insert preview at current position
          const previewId = generatePreviewId()
          
          const previewAttrs: Record<string, unknown> = {
            previewId,
            generatedText: response.text,
            commandName: item.name,
          }
          
          if (response.isScreenplay && response.screenplayElements) {
            previewAttrs.isScreenplay = true
            previewAttrs.screenplayElements = JSON.stringify(response.screenplayElements)
            if (response.characterMap) {
              previewAttrs.characterMap = JSON.stringify(response.characterMap)
            }
            if (response.propMap) {
              previewAttrs.propMap = JSON.stringify(response.propMap)
            }
          }
          
          if (isSelectionCommand && originalSelectionRange) {
            previewAttrs.isReplacement = true
            previewAttrs.replacementRange = JSON.stringify(originalSelectionRange)
          }
          
          currentEditor
            .chain()
            .focus()
            .insertContent({
              type: 'aiPreview',
              attrs: previewAttrs,
            })
            .run()
          
          requestAnimationFrame(() => {
            if (editorElement) editorElement.scrollTop = scrollTop
          })
        }
      } catch (error) {
        console.error('[SlashCommand] Failed to generate:', error)
        
        // Restore scroll position
        if (editorElement) {
          editorElement.scrollTop = scrollTop
        }

        // Try to remove the placeholder on error
        const { doc } = currentEditor.state
        let placeholderStart = -1
        let placeholderEnd = -1

        doc.descendants((node, pos) => {
          if (placeholderStart >= 0) return false
          if (node.isText && node.text?.includes(loadingText)) {
            const offset = node.text.indexOf(loadingText)
            placeholderStart = pos + offset
            placeholderEnd = placeholderStart + loadingText.length
            return false
          }
          return true
        })

        if (placeholderStart >= 0) {
          currentEditor
            .chain()
            .focus()
            .setTextSelection({ from: placeholderStart, to: placeholderEnd })
            .deleteSelection()
            .insertContent({
              type: 'text',
              text: '[Generation failed - please try again]',
              marks: [{ type: 'textStyle', attrs: { color: '#ef4444' } }]
            })
            .run()
        }
      }
    }, [command, currentProject, hasSelection, selectedText, selectionRange])

    // Handle item selection
    const selectItem = useCallback((index: number) => {
      const item = items[index]
      if (item) {
        if (item.requiresInput) {
          pendingCommand.current = item
          setInputMode(true)
          setInputText('')
          // Focus input on next tick
          setTimeout(() => inputRef.current?.focus(), 0)
        } else {
          executeCommand(item)
        }
      }
    }, [items, executeCommand])

    // Submit the input for a requiresInput command
    const submitInput = useCallback(() => {
      if (pendingCommand.current && inputText.trim()) {
        executeCommand(pendingCommand.current, inputText.trim())
        pendingCommand.current = null
        setInputMode(false)
        setInputText('')
      }
    }, [executeCommand, inputText])

    // Cancel input mode
    const cancelInput = useCallback(() => {
      pendingCommand.current = null
      setInputMode(false)
      setInputText('')
    }, [])

    const upHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
    }, [items.length])

    const downHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev + 1) % items.length)
    }, [items.length])

    const enterHandler = useCallback(() => {
      selectItem(selectedIndex)
    }, [selectItem, selectedIndex])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        // In input mode, let the input handle most keys
        if (inputMode) {
          if (event.key === 'Escape') {
            cancelInput()
            return true
          }
          if (event.key === 'Enter') {
            submitInput()
            return true
          }
          // Let other keys pass through to the input
          return true
        }

        if (event.key === 'ArrowUp') {
          upHandler()
          return true
        }

        if (event.key === 'ArrowDown') {
          downHandler()
          return true
        }

        if (event.key === 'Enter') {
          enterHandler()
          return true
        }

        // Handle shortcut keys
        const shortcut = event.key.toUpperCase()
        const matchingIndex = items.findIndex(item => item.shortcut === shortcut)
        if (matchingIndex !== -1) {
          selectItem(matchingIndex)
          return true
        }

        return false
      },
    }), [upHandler, downHandler, enterHandler, items, selectItem, inputMode, cancelInput, submitInput])

    if (items.length === 0) {
      return (
        <div className="bg-ink-900 border border-ink-600 rounded-lg shadow-2xl p-3">
          <p className="text-sm text-ink-400 font-ui">No commands found</p>
        </div>
      )
    }

    // Input mode: show text input for requiresInput commands
    if (inputMode && pendingCommand.current) {
      return (
        <div
          className="bg-ink-900 border border-ink-600 rounded-lg shadow-2xl py-1.5 min-w-[320px]"
        >
          <div className="px-3 py-1.5 text-[10px] font-ui font-semibold text-gold-400 uppercase tracking-wider border-b border-ink-700 mb-1">
            {pendingCommand.current.name}
          </div>
          <div className="px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputText.trim()) {
                  e.preventDefault()
                  submitInput()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelInput()
                }
                e.stopPropagation()
              }}
              placeholder="Ask anything about your story..."
              className="w-full bg-ink-800 border border-ink-600 rounded px-3 py-2 text-sm text-white font-ui placeholder:text-ink-500 focus:outline-none focus:border-gold-400/50"
              autoFocus
            />
          </div>
          <div className="px-3 py-1.5 border-t border-ink-700 text-[10px] text-ink-500 font-ui">
            <span className="text-ink-400">Enter</span> Submit • <span className="text-ink-400">Esc</span> Cancel
          </div>
        </div>
      )
    }

    return (
      <div
        className="bg-ink-900 border border-ink-600 rounded-lg shadow-2xl py-1.5 min-w-[280px] max-h-[400px] overflow-auto"
        role="listbox"
        aria-label="AI Writing Commands"
      >
        <div className="px-3 py-1.5 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider border-b border-ink-700 mb-1">
          {hasSelection ? 'Revise Selection' : 'AI Writing Tools'}
        </div>

        {items.map((item, index) => {
          const Icon = COMMAND_ICONS[item.icon] || PenRegular
          const isSelected = index === selectedIndex

          return (
            <button
              key={item.id}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={clsx(
                'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                isSelected
                  ? 'bg-gold-400/20 text-gold-400'
                  : 'text-white hover:bg-ink-800'
              )}
              role="option"
              aria-selected={isSelected}
            >
              <span className={clsx(
                'flex-shrink-0',
                isSelected ? 'text-gold-400' : 'text-ink-400'
              )}>
                <Icon className="w-4 h-4" />
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-ui font-medium">
                  {item.name}
                </div>
                <div className={clsx(
                  'text-xs truncate',
                  isSelected ? 'text-gold-400/70' : 'text-ink-500'
                )}>
                  {item.description}
                </div>
              </div>

              <span className={clsx(
                'flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded',
                isSelected
                  ? 'bg-gold-400/30 text-gold-400'
                  : 'bg-ink-700 text-ink-400'
              )}>
                {item.shortcut}
              </span>
            </button>
          )
        })}

        <div className="px-3 py-1.5 mt-1 border-t border-ink-700 text-[10px] text-ink-500 font-ui">
          <span className="text-ink-400">↑↓</span> Navigate • <span className="text-ink-400">Enter</span> Select • <span className="text-ink-400">Esc</span> Close
        </div>
      </div>
    )
  }
)

SlashCommandMenu.displayName = 'SlashCommandMenu'

export default SlashCommandMenu
