/**
 * SelectionSlashMenu Component
 * 
 * Popup menu for AI revision commands when "/" is pressed with text selected.
 * Shows editing tools designed as "editors with guardrails" - they operate locally,
 * respect context, and never introduce new plot.
 * 
 * Features:
 * - "Adjust Tone" with a submenu of tone options
 * - Content modification tools (Shorten, Make Clearer, Elaborate)
 * - Emotional adjustment tools (Increase Tension, Soften Impact, Sharpen Imagery)
 * - Technical fixes (Fix Pacing, Align Voice, Resolve Contradiction)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import type { Editor } from '@tiptap/react'
import { 
  EditRegular, 
  ArrowExpandRegular, 
  PersonRegular,
  EmojiRegular,
  TextGrammarArrowLeftRegular,
  LightbulbRegular,
  SparkleRegular,
  WarningRegular,
  HeartRegular,
  EyeRegular,
  TimerRegular,
  TextAlignLeftRegular,
  CheckmarkRegular,
  ChevronRightRegular,
  PenRegular,
  ChatRegular,
  LocationRegular,
  CloudRegular,
  BriefcaseMedicalRegular
} from '@fluentui/react-icons'
import { SLASH_COMMANDS_SELECTION, type SlashCommandItem } from '../extensions/SlashCommand'
import { useProjectStore } from '../../../stores/projectStore'
import { contentToPlainText } from '../../../utils/selectionUtils'

// Icon mapping for all commands
const COMMAND_ICONS: Record<string, React.ElementType> = {
  edit: EditRegular,
  expand: ArrowExpandRegular,
  person: PersonRegular,
  emoji: EmojiRegular,
  compress: TextGrammarArrowLeftRegular,
  lightbulb: LightbulbRegular,
  sparkle: SparkleRegular,
  warning: WarningRegular,
  heart: HeartRegular,
  eye: EyeRegular,
  timer: TimerRegular,
  textAlign: TextAlignLeftRegular,
  checkmark: CheckmarkRegular,
  pen: PenRegular,
  chat: ChatRegular,
  location: LocationRegular,
  weather: CloudRegular,
  stethoscope: BriefcaseMedicalRegular,
}

interface SelectionSlashMenuProps {
  editor: Editor
  isOpen: boolean
  selectedText: string
  selectionRange: { from: number; to: number }
  onClose: () => void
}

// Loading text based on command type
const LOADING_TEXT: Record<string, string> = {
  rework: 'Reworking...',
  adjustTone: 'Adjusting tone...',
  shorten: 'Shortening...',
  clearer: 'Clarifying...',
  elaborate: 'Elaborating...',
  tension: 'Increasing tension...',
  soften: 'Softening...',
  imagery: 'Sharpening imagery...',
  pacing: 'Fixing pacing...',
  voice: 'Aligning voice...',
  contradiction: 'Resolving...',
  expand: 'Expanding...',
  pov: 'Rewriting...',
  scriptDoctor: 'Diagnosing script...',
  continue: 'Generating (gated)...',
  dialogue: 'Generating dialogue (gated)...',
  setting: 'Describing setting (gated)...',
  negativeSpace: 'Creating texture (gated)...',
}

// Get loading text for a command
function getLoadingText(commandId: string, toneOption?: string): string {
  if (commandId === 'adjustTone' && toneOption) {
    return `Making ${toneOption}...`
  }
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

export function SelectionSlashMenu({ 
  editor, 
  isOpen, 
  selectedText, 
  selectionRange, 
  onClose 
}: SelectionSlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [submenuIndex, setSubmenuIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  
  const currentProject = useProjectStore(state => state.currentProject)
  const setLastPipelineResult = useProjectStore(state => state.setLastPipelineResult)
  const items = SLASH_COMMANDS_SELECTION

  // Calculate menu position based on selection, with viewport clamping
  useEffect(() => {
    if (!isOpen || !editor) return

    const { view } = editor
    const { from, to } = selectionRange
    
    // Get coordinates of both selection start and end
    const coordsStart = view.coordsAtPos(from)
    const coordsEnd = view.coordsAtPos(to)

    const MENU_WIDTH = 280  // matches min-w-[280px]
    const MENU_MAX_HEIGHT = 500  // matches max-h-[500px]
    const GAP = 4
    const VIEWPORT_PADDING = 8

    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    // Prefer below selection start, flip above selection end if it overflows
    let top = coordsStart.bottom + GAP
    if (top + MENU_MAX_HEIGHT > viewportH - VIEWPORT_PADDING) {
      // Not enough room below — position above the selection end
      const aboveTop = coordsEnd.top - GAP
      top = Math.max(VIEWPORT_PADDING, aboveTop - MENU_MAX_HEIGHT)
    }

    // Clamp left so menu doesn't overflow the right edge
    let left = coordsStart.left
    if (left + MENU_WIDTH > viewportW - VIEWPORT_PADDING) {
      left = viewportW - MENU_WIDTH - VIEWPORT_PADDING
    }
    left = Math.max(VIEWPORT_PADDING, left)
    
    setPosition({ top, left })
  }, [isOpen, editor, selectionRange])

  // After the menu renders, refine position using actual measured height
  useEffect(() => {
    if (!isOpen || !position || !menuRef.current) return

    requestAnimationFrame(() => {
      const menu = menuRef.current
      if (!menu) return

      const rect = menu.getBoundingClientRect()
      const viewportH = window.innerHeight
      const viewportW = window.innerWidth
      const VIEWPORT_PADDING = 8

      let newTop = position.top
      let newLeft = position.left

      // If the menu's actual bottom overflows the viewport, push it up
      if (rect.bottom > viewportH - VIEWPORT_PADDING) {
        newTop = viewportH - rect.height - VIEWPORT_PADDING
      }
      newTop = Math.max(VIEWPORT_PADDING, newTop)

      // If the menu's actual right overflows the viewport, push it left
      if (rect.right > viewportW - VIEWPORT_PADDING) {
        newLeft = viewportW - rect.width - VIEWPORT_PADDING
      }
      newLeft = Math.max(VIEWPORT_PADDING, newLeft)

      if (newTop !== position.top || newLeft !== position.left) {
        setPosition({ top: newTop, left: newLeft })
      }
    })
  }, [isOpen, position])

  // Reset state when menu opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
      setActiveSubmenu(null)
      setSubmenuIndex(0)
    }
  }, [isOpen])

  // Get the current item's submenu if any
  const currentItem = items[selectedIndex]
  const currentSubmenu = currentItem?.submenu

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // If submenu is open, handle submenu navigation
      if (activeSubmenu && currentSubmenu) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault()
            setSubmenuIndex(prev => (prev + currentSubmenu.length - 1) % currentSubmenu.length)
            return
          case 'ArrowDown':
            e.preventDefault()
            setSubmenuIndex(prev => (prev + 1) % currentSubmenu.length)
            return
          case 'ArrowLeft':
          case 'Escape':
            e.preventDefault()
            setActiveSubmenu(null)
            setSubmenuIndex(0)
            return
          case 'Enter':
            e.preventDefault()
            const toneOption = currentSubmenu[submenuIndex]
            if (toneOption) {
              executeCommandWithTone(currentItem, toneOption.id)
            }
            return
        }
        return
      }

      // Main menu navigation
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => (prev + items.length - 1) % items.length)
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % items.length)
          break
        case 'ArrowRight':
          // Open submenu if current item has one
          if (currentSubmenu) {
            e.preventDefault()
            setActiveSubmenu(currentItem.id)
            setSubmenuIndex(0)
          }
          break
        case 'Enter':
          e.preventDefault()
          if (currentSubmenu) {
            // Open submenu instead of executing
            setActiveSubmenu(currentItem.id)
            setSubmenuIndex(0)
          } else {
            selectItem(selectedIndex)
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        default:
          // Handle shortcut keys
          const shortcut = e.key.toUpperCase()
          const matchingIndex = items.findIndex(item => item.shortcut === shortcut)
          if (matchingIndex !== -1) {
            e.preventDefault()
            const matchedItem = items[matchingIndex]
            if (matchedItem.submenu) {
              setSelectedIndex(matchingIndex)
              setActiveSubmenu(matchedItem.id)
              setSubmenuIndex(0)
            } else {
              selectItem(matchingIndex)
            }
          }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, items, activeSubmenu, currentSubmenu, submenuIndex, currentItem])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        (!submenuRef.current || !submenuRef.current.contains(target))
      ) {
        onClose()
      }
    }

    // Delay to prevent immediate close
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Execute command with optional tone parameter
  const executeCommandWithTone = useCallback(async (item: SlashCommandItem, toneOption?: string) => {
    const { state } = editor
    const { from } = state.selection
    
    // Detect if we're in screenplay mode
    const isScreenplay = isScreenplayEditor(editor)
    
    // Get text before selection (up to 8000 chars) for surrounding context
    const textBefore = state.doc.textBetween(0, from, '\n', '\ufffc')
    // If selection is near the start of the document, include the selected text
    // as context so the AI always has something to work with
    const context = textBefore.trim().length > 0
      ? textBefore.slice(-8000)
      : selectedText.slice(0, 8000)

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

    // Gather supplementary context from project documents
    const supplementaryContext: {
      synopsis?: string
      characterNotes?: Array<{ name: string; content: string }>
      propNotes?: Array<{ name: string; content: string }>
      otherNotes?: Array<{ title: string; content: string }>
    } = {}

    if (currentProject?.path) {
      const projectPath = currentProject.path
      
      // Load character notes
      const charNotes: Array<{ name: string; content: string }> = []
      for (const char of currentProject.characters || []) {
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
            console.warn(`[SelectionSlashMenu] Failed to load character note for ${char.name}:`, e)
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
            console.warn(`[SelectionSlashMenu] Failed to load prop note for ${prop.name}:`, e)
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
          console.warn(`[SelectionSlashMenu] Failed to load supplementary doc ${doc.title}:`, e)
        }
      }
      if (otherNotes.length > 0) {
        supplementaryContext.otherNotes = otherNotes
      }
    }

    // Close the menu
    onClose()

    // Get the loading text for this command
    const loadingText = getLoadingText(item.id, toneOption)

    // Save scroll position
    const editorElement = editor.view.dom.closest('.overflow-auto') as HTMLElement | null
    const scrollTop = editorElement?.scrollTop ?? 0

    // Insert loading placeholder AFTER the selection (don't delete the selection yet)
    const insertPos = selectionRange.to
    editor
      .chain()
      .focus()
      .setTextSelection(insertPos)
      .setColor('#fbbf24') // Gold color
      .insertContent(loadingText)
      .unsetColor()
      .run()

    // Helper: find the loading placeholder in the document
    const findPlaceholder = () => {
      const { doc } = editor.state
      let start = -1
      let end = -1
      doc.descendants((node, pos) => {
        if (start >= 0) return false
        if (node.isText && node.text?.includes(loadingText)) {
          const offset = node.text.indexOf(loadingText)
          start = pos + offset
          end = start + loadingText.length
          return false
        }
        return true
      })
      return { start, end }
    }

    // Helper: replace placeholder with error message
    const showPlaceholderError = (message: string) => {
      const { start, end } = findPlaceholder()
      if (start >= 0) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: start, to: end })
          .deleteSelection()
          .setColor('#ef4444')
          .insertContent(message)
          .unsetColor()
          .run()
      }
      requestAnimationFrame(() => {
        if (editorElement) editorElement.scrollTop = scrollTop
      })
    }

    // Helper: replace placeholder with AI Preview node from a response
    const showPreviewFromResponse = (response: { text?: string; error?: string; isScreenplay?: boolean; screenplayElements?: unknown; characterMap?: unknown; propMap?: unknown }) => {
      const { start, end } = findPlaceholder()
      if (editorElement) editorElement.scrollTop = scrollTop

      if (response.error) {
        console.error('[SelectionSlashMenu] Error:', response.error)
        showPlaceholderError(`[Error: ${response.error}]`)
        return
      }

      if (response.text && start >= 0) {
        const previewId = generatePreviewId()
        const previewAttrs: Record<string, unknown> = {
          previewId,
          generatedText: response.text,
          commandName: toneOption ? `${item.name}: ${toneOption}` : item.name,
          isReplacement: true,
          replacementRange: JSON.stringify(selectionRange),
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
        editor
          .chain()
          .focus()
          .setTextSelection({ from: start, to: end })
          .deleteSelection()
          .insertContent({ type: 'aiPreview', attrs: previewAttrs })
          .run()
        requestAnimationFrame(() => {
          if (editorElement) editorElement.scrollTop = scrollTop
        })
      }
    }

    try {
      const request = {
        command: item.id,
        context,
        selection: selectedText,
        documentTitle,
        toneOption,
        characters: isScreenplay && characters.length > 0 ? characters : undefined,
        props: isScreenplay && props.length > 0 ? props : undefined,
        templateType: isScreenplay ? 'screenplay' : undefined,
        supplementaryContext: Object.keys(supplementaryContext).length > 0 ? supplementaryContext : undefined,
      }

      if (item.gated) {
        // Route through the gated writing pipeline (classify → constrain → gate → generate)
        console.log(`[SelectionSlashMenu] Routing "${item.id}" through gated pipeline`)
        const pipelineResult = await window.api.gatedWriting.generate(request)

        // Update the store so WritingPartnerPanel reflects the latest analysis
        setLastPipelineResult(pipelineResult as any)

        if (pipelineResult.stage === 'declined') {
          // Gate declined generation — show decline reason inline
          const declineMsg = pipelineResult.gateReason || 'Generation declined by writing partner'
          const suggestion = pipelineResult.suggestion ? ` ${pipelineResult.suggestion}` : ''
          console.log(`[SelectionSlashMenu] Gated pipeline DECLINED: ${declineMsg}`)

          const { start, end } = findPlaceholder()
          if (start >= 0) {
            editor
              .chain()
              .focus()
              .setTextSelection({ from: start, to: end })
              .deleteSelection()
              .setColor('#f59e0b') // Amber color for decline (not error)
              .insertContent(`[Writing Partner: ${declineMsg}.${suggestion}]`)
              .unsetColor()
              .run()
          }
          requestAnimationFrame(() => {
            if (editorElement) editorElement.scrollTop = scrollTop
          })
          return
        }

        // Gate passed — use the generation response
        if (pipelineResult.generation) {
          showPreviewFromResponse(pipelineResult.generation)
        } else {
          showPlaceholderError('[Gated pipeline returned no generation]')
        }
      } else {
        // Standard (non-gated) AI writing service call
        const response = await window.api.aiWriting.generate(request)
        showPreviewFromResponse(response)
      }
    } catch (error) {
      console.error('[SelectionSlashMenu] Failed to generate:', error)
      if (editorElement) editorElement.scrollTop = scrollTop
      showPlaceholderError('[Generation failed - please try again]')
    }
  }, [editor, currentProject, selectedText, selectionRange, onClose, setLastPipelineResult])

  // Execute the AI writing command (no tone)
  const executeCommand = useCallback(async (item: SlashCommandItem) => {
    await executeCommandWithTone(item, undefined)
  }, [executeCommandWithTone])

  const selectItem = useCallback((index: number) => {
    const item = items[index]
    if (item) {
      if (item.submenu) {
        // Open submenu
        setActiveSubmenu(item.id)
        setSubmenuIndex(0)
      } else {
        executeCommand(item)
      }
    }
  }, [items, executeCommand])

  // Calculate submenu position with viewport clamping
  const getSubmenuPosition = useCallback(() => {
    if (!menuRef.current || !position) return null
    const menuRect = menuRef.current.getBoundingClientRect()
    const SUBMENU_WIDTH = 220  // matches min-w-[220px]
    const SUBMENU_MAX_HEIGHT = 400  // matches max-h-[400px]
    const GAP = 4
    const VIEWPORT_PADDING = 8
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    // Prefer to the right of the main menu; flip left if it overflows
    let left = menuRect.right + GAP
    if (left + SUBMENU_WIDTH > viewportW - VIEWPORT_PADDING) {
      left = menuRect.left - SUBMENU_WIDTH - GAP
    }
    left = Math.max(VIEWPORT_PADDING, left)

    // Align top with the main menu, but clamp to viewport bottom
    let top = position.top
    if (top + SUBMENU_MAX_HEIGHT > viewportH - VIEWPORT_PADDING) {
      top = viewportH - SUBMENU_MAX_HEIGHT - VIEWPORT_PADDING
    }
    top = Math.max(VIEWPORT_PADDING, top)

    return { top, left }
  }, [position])

  if (!isOpen || !position) return null

  const submenuPosition = getSubmenuPosition()

  return createPortal(
    <>
      {/* Main menu */}
      <div
        ref={menuRef}
        className="fixed bg-ink-900 border border-ink-600 rounded-lg shadow-2xl py-1.5 min-w-[280px] max-h-[500px] overflow-auto z-[100]"
        style={{ top: position.top, left: position.left }}
        role="listbox"
        aria-label="AI Editing Tools"
      >
        <div className="px-3 py-1.5 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider border-b border-ink-700 mb-1">
          Edit Selection
        </div>

        {items.map((item, index) => {
          const Icon = COMMAND_ICONS[item.icon] || EditRegular
          const isSelected = index === selectedIndex
          const hasSubmenu = !!item.submenu
          const isSubmenuOpen = activeSubmenu === item.id
          // Unique key for gated items (same id as non-gated counterpart)
          const itemKey = item.gated ? `${item.id}-gated` : item.id

          return (
            <div key={itemKey}>
              {/* Separator */}
              {item.separator && (
                <div className="h-px bg-ink-700 mx-2 my-1" />
              )}
              {/* Section header for Script Doctor */}
              {item.id === 'scriptDoctor' && (
                <div className="px-3 py-1 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider">
                  Screenplay Craft
                </div>
              )}
              {/* Section header for AI Writing Partner (gated) group */}
              {item.gated && item.separator && (
                <div className="px-3 py-1 text-[10px] font-ui font-semibold text-cyan-400/80 uppercase tracking-wider">
                  AI Writing Partner
                </div>
              )}
              
              <button
                onClick={() => selectItem(index)}
                onMouseEnter={() => {
                  setSelectedIndex(index)
                  if (hasSubmenu) {
                    setActiveSubmenu(item.id)
                    setSubmenuIndex(0)
                  } else {
                    setActiveSubmenu(null)
                  }
                }}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                  isSelected || isSubmenuOpen
                    ? (item.gated ? 'bg-cyan-400/20 text-cyan-400' : 'bg-gold-400/20 text-gold-400')
                    : 'text-white hover:bg-ink-800'
                )}
                role="option"
                aria-selected={isSelected}
                aria-haspopup={hasSubmenu ? 'menu' : undefined}
                aria-expanded={isSubmenuOpen}
              >
                <span className={clsx(
                  'flex-shrink-0',
                  item.gated
                    ? (isSelected || isSubmenuOpen ? 'text-cyan-400' : 'text-cyan-400/60')
                    : (isSelected || isSubmenuOpen ? 'text-gold-400' : 'text-ink-400')
                )}>
                  <Icon className="w-4 h-4" />
                </span>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-ui font-medium">
                    {item.name}
                  </div>
                  <div className={clsx(
                    'text-xs truncate',
                    item.gated
                      ? (isSelected || isSubmenuOpen ? 'text-cyan-400/70' : 'text-ink-500')
                      : (isSelected || isSubmenuOpen ? 'text-gold-400/70' : 'text-ink-500')
                  )}>
                    {item.description}
                  </div>
                </div>

                {hasSubmenu ? (
                  <ChevronRightRegular className={clsx(
                    'w-4 h-4 flex-shrink-0',
                    isSelected || isSubmenuOpen ? 'text-gold-400' : 'text-ink-400'
                  )} />
                ) : (
                  <span className={clsx(
                    'flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded',
                    isSelected
                      ? (item.gated ? 'bg-cyan-400/30 text-cyan-400' : 'bg-gold-400/30 text-gold-400')
                      : 'bg-ink-700 text-ink-400'
                  )}>
                    {item.shortcut}
                  </span>
                )}
              </button>
            </div>
          )
        })}

        <div className="px-3 py-1.5 mt-1 border-t border-ink-700 text-[10px] text-ink-500 font-ui">
          <span className="text-ink-400">↑↓</span> Navigate • <span className="text-ink-400">Enter</span> Select • <span className="text-ink-400">Esc</span> Close
        </div>
      </div>

      {/* Submenu for Adjust Tone */}
      {activeSubmenu && currentSubmenu && submenuPosition && (
        <div
          ref={submenuRef}
          className="fixed bg-ink-900 border border-ink-600 rounded-lg shadow-2xl py-1.5 min-w-[220px] max-h-[400px] overflow-auto z-[101]"
          style={{ top: submenuPosition.top, left: submenuPosition.left }}
          role="menu"
          aria-label="Tone Options"
        >
          <div className="px-3 py-1.5 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider border-b border-ink-700 mb-1">
            Select Tone
          </div>

          {currentSubmenu.map((tone, index) => {
            const isSelected = index === submenuIndex

            return (
              <button
                key={tone.id}
                onClick={() => executeCommandWithTone(currentItem, tone.id)}
                onMouseEnter={() => setSubmenuIndex(index)}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                  isSelected
                    ? 'bg-gold-400/20 text-gold-400'
                    : 'text-white hover:bg-ink-800'
                )}
                role="menuitem"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-ui font-medium">
                    {tone.name}
                  </div>
                  <div className={clsx(
                    'text-xs truncate',
                    isSelected ? 'text-gold-400/70' : 'text-ink-500'
                  )}>
                    {tone.description}
                  </div>
                </div>
              </button>
            )
          })}

          <div className="px-3 py-1.5 mt-1 border-t border-ink-700 text-[10px] text-ink-500 font-ui">
            <span className="text-ink-400">←</span> Back • <span className="text-ink-400">Enter</span> Select
          </div>
        </div>
      )}
    </>,
    document.body
  )
}

export default SelectionSlashMenu
