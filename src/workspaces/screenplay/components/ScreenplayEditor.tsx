import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { PreserveMarks } from '../../shared/extensions/PreserveMarks'
import { Color } from '@tiptap/extension-color'
import { Placeholder } from '@tiptap/extension-placeholder'
import { DragHandle } from '@tiptap/extension-drag-handle'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { CheckmarkRegular, DismissRegular } from '@fluentui/react-icons'
import type { JSONContent } from '@tiptap/core'

import { useProjectStore, getDocumentHierarchyType, getPageNumber, getParentDocument } from '../../../stores/projectStore'
import { StoryboardPanel } from '../../../components/StoryboardPanel'
import { WritingPartnerPanel } from '../../../components/WritingPartnerPanel'
import { useStoryboardPlayback } from '../../../hooks/useStoryboardPlayback'
import { captureBlockAnchor } from '../../../utils/blockAnchoring'
import { StateDropdown } from '../../../components/StateDropdown'
import type { Character, Prop, DocumentLifecycleState, LivingDocument } from '../../../types/project'

// Shared extensions
import { 
  UniqueID, 
  getBlockIdAtPos,
  FontSize, 
  LineHeight, 
  FontFamily, 
  AssetImage,
  Citation,
  FixPreview,
  SlashCommand,
  SelectionSlashCommand,
  AIPreview,
  MentionPreview
} from '../../shared/extensions'
import { createSlashCommandSuggestion } from '../../shared/components/slashCommandConfig'
import { SelectionSlashMenu } from '../../shared/components/SelectionSlashMenu'
import { VersionHistoryPanel } from '../../shared/components'

// Screenplay-specific
import { ScreenplayElement, getScreenplayElementDef } from '../extensions/ScreenplayElement'
import { Mention, type MentionType } from '../extensions/Mention'
import { ScreenplayToolbar } from './ScreenplayToolbar'
import { JournalToolbar } from '../../notes-journal/components/JournalToolbar'
import { ScreenplayElementPicker, type ElementPickerSelection } from './ScreenplayElementPicker'
import { CharacterAutocomplete } from './CharacterAutocomplete'
import { PropAutocomplete } from './PropAutocomplete'
import { ShotAutocomplete } from './ShotAutocomplete'
import { createMentionSuggestionConfig } from './mentionSuggestionConfig'
import { ScriptAppearances } from './ScriptAppearances'

// MIME type for citation metadata in clipboard
const CITATION_MIME_TYPE = 'application/x-cadmus-citation'

interface CitationClipboardData {
  sourceDocumentId: string
  sourceDocumentTitle: string
  sourceBlockId: string
  text: string
}

interface AssetDropData {
  assetId: string
  assetPath: string
  projectPath: string
  name: string
}

// Screenplay element types that should be displayed in uppercase
const UPPERCASE_ELEMENT_TYPES = ['scene-heading', 'character', 'transition']

// Helper to extract the first block's text from screenplay content
export function getFirstBlockText(content: JSONContent | null): string | null {
  if (!content?.content) return null
  
  for (const node of content.content) {
    if (node.type === 'screenplayElement' && node.content) {
      const textParts: string[] = []
      for (const child of node.content) {
        if (child.type === 'text' && child.text) {
          textParts.push(child.text)
        }
      }
      let text = textParts.join('').trim()
      if (text) {
        const elementType = node.attrs?.elementType
        if (elementType && UPPERCASE_ELEMENT_TYPES.includes(elementType)) {
          text = text.toUpperCase()
        }
        return text
      }
    }
    
    if (node.type === 'heading' && node.content) {
      const textParts: string[] = []
      for (const child of node.content) {
        if (child.type === 'text' && child.text) {
          textParts.push(child.text)
        }
      }
      const text = textParts.join('').trim()
      if (text) return text
    }
    
    if (node.type === 'paragraph' && node.content) {
      const textParts: string[] = []
      for (const child of node.content) {
        if (child.type === 'text' && child.text) {
          textParts.push(child.text)
        }
      }
      const text = textParts.join('').trim()
      if (text) return text
    }
  }
  
  return null
}

export function ScreenplayEditor() {
  const { 
    currentProject,
    activeDocumentId, 
    documents,
    updateDocumentContent,
    updateDocumentTitleFont,
    saveDocument,
    renameDocument,
    addAssetReference,
    syncAssetReferences,
    syncDocumentTodos,
    extractSceneHeadings,
    navigateToCitation,
    navigateToCharacterNote,
    navigateToPropNote,
    scrollTargetBlock,
    clearScrollTarget,
    scrollTargetRange,
    clearScrollTargetRange,
    pendingFixRequest,
    clearFixRequest,
    batchFixState,
    clearBatchFix,
    mentionScanState,
    clearMentionScan,
    ui,
    versionHistoryMode,
    documentVersions,
    setVersionHistoryMode,
    storyboardUI,
    linkShotToBlock,
    cancelLinkMode,
    setStoryboardPanelWidth,
    addCharacter,
    addProp
  } = useProjectStore()
  
  useStoryboardPlayback()
  
  const [isResizingStoryboard, setIsResizingStoryboard] = useState(false)
  const storyboardResizeStartX = useRef<number>(0)
  const storyboardResizeStartWidth = useRef<number>(0)
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const titleSyncRef = useRef(false)
  const isProgrammaticUpdateRef = useRef(false) // Flag to prevent onUpdate during programmatic content changes
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const activeDoc = currentProject?.documents.find(d => d.id === activeDocumentId)
  const docState = activeDocumentId ? documents[activeDocumentId] : null
  
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  
  const [projectState, setProjectState] = useState<DocumentLifecycleState>('active')
  const [projectStateNote, setProjectStateNote] = useState<string | undefined>(undefined)
  
  // Element picker state
  const [elementPickerOpen, setElementPickerOpen] = useState(false)
  const [elementPickerPosition, setElementPickerPosition] = useState({ x: 0, y: 0 })
  const lastEnterTimeRef = useRef<number>(0)
  const DOUBLE_ENTER_THRESHOLD = 300
  // Save the position when element picker opens (before focus shifts)
  const elementPickerSavedPositionRef = useRef<number | null>(null)
  
  const elementPickerOpenRef = useRef(elementPickerOpen)
  const setElementPickerOpenRef = useRef(setElementPickerOpen)
  const setElementPickerPositionRef = useRef(setElementPickerPosition)
  const elementPickerSavedPositionRefRef = useRef(elementPickerSavedPositionRef)
  
  useEffect(() => {
    elementPickerOpenRef.current = elementPickerOpen
  }, [elementPickerOpen])
  
  // Character autocomplete state
  const [characterAutocompleteOpen, setCharacterAutocompleteOpen] = useState(false)
  const [characterAutocompletePosition, setCharacterAutocompletePosition] = useState({ x: 0, y: 0 })
  const characterInsertPositionRef = useRef<number | null>(null)
  
  // Prop autocomplete state
  const [propAutocompleteOpen, setPropAutocompleteOpen] = useState(false)
  const [propAutocompletePosition, setPropAutocompletePosition] = useState({ x: 0, y: 0 })
  const propInsertPositionRef = useRef<number | null>(null)
  
  // Shot autocomplete state
  const [shotAutocompleteOpen, setShotAutocompleteOpen] = useState(false)
  const [shotAutocompletePosition, setShotAutocompletePosition] = useState({ x: 0, y: 0 })
  const shotInsertPositionRef = useRef<number | null>(null)
  
  // Selection slash menu state (for revision commands when text is selected)
  const [selectionMenuOpen, setSelectionMenuOpen] = useState(false)
  const [selectionMenuData, setSelectionMenuData] = useState<{
    selectedText: string
    selectionRange: { from: number; to: number }
  } | null>(null)
  
  // Refs for click handlers
  const citationClickRef = useRef<(docId: string, blockId: string) => void>()
  citationClickRef.current = (sourceDocumentId: string, sourceBlockId: string) => {
    navigateToCitation(sourceDocumentId, sourceBlockId)
  }

  const characterClickRef = useRef<(characterId: string) => void>()
  characterClickRef.current = (characterId: string) => {
    navigateToCharacterNote(characterId)
  }

  const propClickRef = useRef<(propId: string) => void>()
  propClickRef.current = (propId: string) => {
    navigateToPropNote(propId)
  }

  const fixAcceptRef = useRef<(diagnosticId: string) => void>()
  fixAcceptRef.current = () => {}
  
  const fixRejectRef = useRef<(diagnosticId: string) => void>()
  fixRejectRef.current = () => {}
  
  const mentionAcceptRef = useRef<(suggestionId: string) => void>()
  mentionAcceptRef.current = () => {}
  
  const mentionRejectRef = useRef<(suggestionId: string) => void>()
  mentionRejectRef.current = () => {}
  
  // Selection slash menu trigger ref
  const selectionSlashTriggerRef = useRef<(selectedText: string, selectionRange: { from: number; to: number }) => void>()
  selectionSlashTriggerRef.current = (selectedText, selectionRange) => {
    setSelectionMenuData({ selectedText, selectionRange })
    setSelectionMenuOpen(true)
  }

  // Get derived title from first block
  const { documentTitle, derivedTitle } = useMemo(() => {
    const firstBlockText = activeDoc?.parentId ? getFirstBlockText(docState?.content || null) : null
    
    return {
      documentTitle: activeDoc?.title || 'Untitled Document',
      derivedTitle: firstBlockText
    }
  }, [docState?.content, activeDoc?.title, activeDoc?.parentId])

  // Get hierarchy info
  const hierarchyInfo = useMemo(() => {
    if (!activeDoc || !currentProject) {
      return { type: 'document' as const, pageNumber: 0, parentTitle: null }
    }
    const type = getDocumentHierarchyType(activeDoc, currentProject.documents)
    const pageNumber = type === 'page' ? getPageNumber(activeDoc, currentProject.documents) : 0
    const parentDoc = getParentDocument(activeDoc, currentProject.documents)
    return {
      type,
      pageNumber,
      parentTitle: parentDoc?.title || null
    }
  }, [activeDoc, currentProject])

  // Sync title font
  useEffect(() => {
    if (activeDocumentId) {
      updateDocumentTitleFont(activeDocumentId, "'Courier New', Courier, monospace")
    }
  }, [activeDocumentId, updateDocumentTitleFont])
  
  // Load project lifecycle state
  useEffect(() => {
    const loadProjectState = async () => {
      if (!currentProject?.path) {
        setProjectState('active')
        setProjectStateNote(undefined)
        return
      }
      
      try {
        const livingDocs = await window.api.project.getLivingDocuments()
        const projectDoc = livingDocs.find((d: LivingDocument) => d.projectPath === currentProject.path)
        if (projectDoc) {
          setProjectState(projectDoc.state)
          setProjectStateNote(projectDoc.stateNote)
        } else {
          setProjectState('active')
          setProjectStateNote(undefined)
        }
      } catch (err) {
        console.error('Failed to load project state:', err)
        setProjectState('active')
        setProjectStateNote(undefined)
      }
    }
    
    loadProjectState()
  }, [currentProject?.path])
  
  const handleProjectStateChange = useCallback(async (state: DocumentLifecycleState, note?: string) => {
    if (!currentProject?.path) return
    
    try {
      await window.api.project.updateLivingDocument(currentProject.path, state, note)
      setProjectState(state)
      setProjectStateNote(note)
    } catch (err) {
      console.error('Failed to update project state:', err)
    }
  }, [currentProject?.path])

  // TipTap extensions for screenplay
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] }
    }),
    Underline,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph', 'screenplayElement'] }),
    TextStyle,
    Color,
    FontSize,
    LineHeight,
    FontFamily,
    PreserveMarks,
    AssetImage.configure({ inline: false, allowBase64: false }),
    UniqueID.configure({
      types: ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'bulletList', 'orderedList', 'screenplayElement', 'taskList', 'taskItem'],
    }),
    TaskList.configure({
      HTMLAttributes: {
        class: 'task-list',
      },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'task-item',
      },
    }),
    Citation.configure({
      onCitationClick: (docId: string, blockId: string) => {
        citationClickRef.current?.(docId, blockId)
      },
    }),
    FixPreview.configure({
      onAccept: (diagnosticId: string) => {
        fixAcceptRef.current?.(diagnosticId)
      },
      onReject: (diagnosticId: string) => {
        fixRejectRef.current?.(diagnosticId)
      },
    }),
    MentionPreview.configure({
      onAccept: (suggestionId: string) => {
        mentionAcceptRef.current?.(suggestionId)
      },
      onReject: (suggestionId: string) => {
        mentionRejectRef.current?.(suggestionId)
      },
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return 'Document title...'
        }
        if (node.type.name === 'screenplayElement') {
          const elementType = node.attrs.elementType
          const elementDef = getScreenplayElementDef(elementType)
          return elementDef?.description || 'Start writing...'
        }
        return 'Start writing here...'
      },
      includeChildren: true
    }),
    DragHandle.configure({
      render: () => {
        const el = document.createElement('div')
        el.classList.add('editor-drag-handle')
        el.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5"/>
          <circle cx="11" cy="3" r="1.5"/>
          <circle cx="5" cy="8" r="1.5"/>
          <circle cx="11" cy="8" r="1.5"/>
          <circle cx="5" cy="13" r="1.5"/>
          <circle cx="11" cy="13" r="1.5"/>
        </svg>`
        return el
      },
    }),
    ScreenplayElement.configure({
      onCharacterClick: (characterId: string) => {
        characterClickRef.current?.(characterId)
      },
      onPropClick: (propId: string) => {
        propClickRef.current?.(propId)
      }
    }),
    Mention.configure({
      suggestion: createMentionSuggestionConfig({
        getCharacters: () => useProjectStore.getState().currentProject?.characters || [],
        getProps: () => useProjectStore.getState().currentProject?.props || [],
        onCreateCharacter: async (name: string) => {
          await useProjectStore.getState().addCharacter(name)
          const { currentProject } = useProjectStore.getState()
          return currentProject?.characters?.find(
            c => c.name.toUpperCase() === name.toUpperCase()
          )
        },
        onCreateProp: async (name: string) => {
          await useProjectStore.getState().addProp(name)
          const { currentProject } = useProjectStore.getState()
          return currentProject?.props?.find(
            p => p.name.toUpperCase() === name.toUpperCase()
          )
        },
      }),
      onMentionClick: (type: MentionType, id: string) => {
        if (type === 'character') {
          characterClickRef.current?.(id)
        } else if (type === 'prop') {
          propClickRef.current?.(id)
        }
      },
    }),
    SlashCommand.configure({
      suggestion: createSlashCommandSuggestion(),
    }),
    SelectionSlashCommand.configure({
      onTrigger: (selectedText, selectionRange) => {
        selectionSlashTriggerRef.current?.(selectedText, selectionRange)
      },
    }),
    AIPreview,
  ], [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: docState?.content || null,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-full'
      },
      handlePaste: (view, event, _slice) => {
        const citationDataStr = event.clipboardData?.getData(CITATION_MIME_TYPE)
        if (!citationDataStr) return false
        
        try {
          const citationData: CitationClipboardData = JSON.parse(citationDataStr)
          
          if (citationData.sourceDocumentId === activeDocumentId) {
            return false
          }
          
          const { tr } = view.state
          const citationMark = view.state.schema.marks.citation?.create({
            sourceDocumentId: citationData.sourceDocumentId,
            sourceBlockId: citationData.sourceBlockId,
            sourceDocumentTitle: citationData.sourceDocumentTitle,
          })
          
          if (citationMark) {
            const textNode = view.state.schema.text(citationData.text, [citationMark])
            view.dispatch(tr.replaceSelectionWith(textNode, false))
            return true
          }
        } catch (err) {
          console.error('Failed to parse citation data:', err)
        }
        
        return false
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false

        const assetData = event.dataTransfer?.getData('application/x-cadmus-asset')
        if (!assetData) return false

        event.preventDefault()

        try {
          const asset: AssetDropData = JSON.parse(assetData)
          const fullPath = `${asset.projectPath}/${asset.assetPath}`
          const assetUrl = `cadmus-asset://load?path=${encodeURIComponent(fullPath)}`

          const coordinates = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })

          if (coordinates) {
            const { tr } = view.state
            const pos = coordinates.pos
            const imageNode = view.state.schema.nodes.assetImage?.create({
              src: assetUrl,
              assetId: asset.assetId,
              alt: asset.name,
            })

            if (imageNode) {
              view.dispatch(tr.insert(pos, imageNode))
              if (activeDocumentId) {
                addAssetReference(asset.assetId, activeDocumentId)
              }
              return true
            }
          }
        } catch (err) {
          console.error('Failed to handle asset drop:', err)
        }

        return false
      },
      handleKeyDown: (view, event) => {
        // Handle Enter for element picker
        if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
          const now = Date.now()
          const timeSinceLastEnter = now - lastEnterTimeRef.current
          
          if (elementPickerOpenRef.current) {
            if (timeSinceLastEnter < DOUBLE_ENTER_THRESHOLD && timeSinceLastEnter > 50) {
              event.preventDefault()
              setElementPickerOpenRef.current(false)
              lastEnterTimeRef.current = 0
              return false
            }
            return false
          }
          
          const { $from } = view.state.selection
          const currentNode = $from.parent
          const isBlockEmpty = currentNode.textContent.trim() === ''
          
          if (!isBlockEmpty) {
            lastEnterTimeRef.current = now
            return false
          }
          
          event.preventDefault()
          
          const { from } = view.state.selection
          const coords = view.coordsAtPos(from)
          
          if (coords) {
            // Save the position NOW before focus shifts to the picker
            const blockStart = $from.start()
            elementPickerSavedPositionRefRef.current.current = blockStart
            
            setElementPickerPositionRef.current({
              x: coords.left,
              y: coords.bottom + 4
            })
            setElementPickerOpenRef.current(true)
            lastEnterTimeRef.current = now
          }
          
          return true
        }
        
        return false
      },
    },
    onUpdate: ({ editor }) => {
      if (!activeDocumentId) return
      
      // Skip if this is a programmatic update (e.g., from character color sync)
      if (isProgrammaticUpdateRef.current) return
      
      const content = editor.getJSON()
      updateDocumentContent(activeDocumentId, content)
      syncAssetReferences(activeDocumentId, content)
      syncDocumentTodos(activeDocumentId, content)
      extractSceneHeadings(activeDocumentId, content)
      
      if (!titleSyncRef.current) {
        const firstText = getFirstBlockText(content)
        if (firstText && activeDoc && firstText !== activeDoc.title && activeDoc.parentId) {
          renameDocument(activeDocumentId, firstText)
        }
      }
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveDocument(activeDocumentId)
      }, 1000)
    }
  })

  // Update editor content when document changes (e.g., from character color updates)
  useEffect(() => {
    if (editor && docState?.content) {
      const currentContent = JSON.stringify(editor.getJSON())
      const newContent = JSON.stringify(docState.content)
      
      if (currentContent !== newContent) {
        // Use emitUpdate: false to prevent onUpdate callback from firing
        // This avoids a race condition where onUpdate would overwrite the changes
        isProgrammaticUpdateRef.current = true
        editor.commands.setContent(docState.content, false, { preserveWhitespace: 'full' })
        // Reset flag after a microtask to ensure any sync callbacks complete
        queueMicrotask(() => {
          isProgrammaticUpdateRef.current = false
        })
      }
    }
  }, [editor, docState?.content])

  // Toggle editor editable state based on reader mode
  useEffect(() => {
    if (editor) {
      editor.setEditable(!ui.readerMode)
    }
  }, [editor, ui.readerMode])

  // Extract scene headings when document is loaded (for TOC)
  useEffect(() => {
    if (activeDocumentId && docState?.content) {
      extractSceneHeadings(activeDocumentId, docState.content)
    }
  }, [activeDocumentId, docState?.content, extractSceneHeadings])

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Scroll to target block
  useEffect(() => {
    if (!scrollTargetBlock || !editor) return

    const { blockId } = scrollTargetBlock
    
    const scrollTimeout = setTimeout(() => {
      try {
        const doc = editor.state.doc
        let foundFrom = -1
        let foundTo = -1
        
        doc.descendants((node, pos) => {
          if (foundFrom >= 0) return false
          if (node.attrs?.blockId === blockId) {
            foundFrom = pos + 1
            foundTo = pos + node.nodeSize - 1
            return false
          }
          return true
        })
        
        if (foundFrom >= 0) {
          editor.chain().focus().setTextSelection({ from: foundFrom, to: foundTo }).run()
          
          const targetElement = editorContainerRef.current?.querySelector(
            `[data-block-id="${blockId}"]`
          ) as HTMLElement | null
          
          if (targetElement && editorContainerRef.current) {
            const container = editorContainerRef.current
            const containerRect = container.getBoundingClientRect()
            const elementRect = targetElement.getBoundingClientRect()
            
            // Calculate scroll position to center the element
            // Element's position relative to container + current scroll - half container height + half element height
            const elementTop = elementRect.top - containerRect.top + container.scrollTop
            const elementCenter = elementTop + (elementRect.height / 2)
            const scrollTop = elementCenter - (containerRect.height / 2)
            
            // Clamp to valid scroll range
            const maxScroll = container.scrollHeight - container.clientHeight
            const clampedScroll = Math.max(0, Math.min(scrollTop, maxScroll))
            
            container.scrollTo({
              top: clampedScroll,
              behavior: 'smooth'
            })
            
            // Add highlight effect
            targetElement.classList.add('citation-target-highlight')
            setTimeout(() => {
              targetElement.classList.remove('citation-target-highlight')
            }, 2000)
          }
        }
      } catch (err) {
        console.error('Failed to scroll to block:', err)
      }
      
      clearScrollTarget()
    }, 150)

    return () => clearTimeout(scrollTimeout)
  }, [scrollTargetBlock, editor, clearScrollTarget])

  // Scroll to target range
  useEffect(() => {
    if (!scrollTargetRange || !editor) return

    const { from, to } = scrollTargetRange
    
    const scrollTimeout = setTimeout(() => {
      try {
        editor.chain().focus().setTextSelection({ from, to }).run()
        
        const { view } = editor
        const coords = view.coordsAtPos(from)
        
        if (coords && editorContainerRef.current) {
          const container = editorContainerRef.current
          const containerRect = container.getBoundingClientRect()
          const scrollTop = container.scrollTop + (coords.top - containerRect.top) - (containerRect.height / 2)
          
          container.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
          })
        }
      } catch (err) {
        console.error('Failed to scroll to range:', err)
      }
      
      clearScrollTargetRange()
    }, 150)

    return () => clearTimeout(scrollTimeout)
  }, [scrollTargetRange, editor, clearScrollTargetRange])

  // Handle pending fix requests
  useEffect(() => {
    if (!pendingFixRequest || !editor) return
    
    const { diagnostic } = pendingFixRequest
    
    if (diagnostic.documentId !== activeDocumentId) return
    
    const suggestion = diagnostic.suggestions?.[0]
    if (!suggestion?.replacement || !diagnostic.range) {
      clearFixRequest()
      return
    }
    
    const fixTimeout = setTimeout(() => {
      try {
        let { from, to } = diagnostic.range!
        const doc = editor.state.doc
        
        const expectedText = diagnostic.context
          ? diagnostic.context.text.slice(diagnostic.context.offset, diagnostic.context.offset + diagnostic.context.length)
          : null
        
        let originalText = doc.textBetween(from, to)
        
        if (expectedText && originalText !== expectedText) {
          let found = false
          doc.descendants((node, pos) => {
            if (found) return false
            if (node.isText && node.text) {
              const idx = node.text.indexOf(expectedText)
              if (idx !== -1) {
                from = pos + idx
                to = from + expectedText.length
                originalText = expectedText
                found = true
                return false
              }
            }
            return true
          })
          
          if (!found) {
            clearFixRequest()
            return
          }
        }
        
        editor.chain().focus().setTextSelection({ from, to }).run()
        
        editor.chain().command(({ tr, state }) => {
          const fixPreviewNode = state.schema.nodes.fixPreview?.create({
            diagnosticId: diagnostic.id,
            originalText: originalText,
            suggestionText: suggestion.replacement,
          })
          
          if (fixPreviewNode) {
            tr.replaceWith(from, to, fixPreviewNode)
          }
          return true
        }).run()
        
      } catch (err) {
        console.error('Failed to insert fix preview:', err)
      }
      
      clearFixRequest()
    }, 150)

    return () => clearTimeout(fixTimeout)
  }, [pendingFixRequest, editor, activeDocumentId, clearFixRequest])

  // Handle batch fix mode
  useEffect(() => {
    if (!batchFixState?.active || !editor) return
    
    const { diagnostics } = batchFixState
    
    const batchTimeout = setTimeout(() => {
      try {
        const sortedDiagnostics = [...diagnostics].sort((a, b) => {
          const aFrom = a.range?.from ?? 0
          const bFrom = b.range?.from ?? 0
          return bFrom - aFrom
        })
        
        editor.chain().command(({ tr, state }) => {
          for (const diagnostic of sortedDiagnostics) {
            const suggestion = diagnostic.suggestions?.[0]
            if (!suggestion?.replacement || !diagnostic.range) continue
            
            let { from, to } = diagnostic.range
            
            const expectedText = diagnostic.context
              ? diagnostic.context.text.slice(diagnostic.context.offset, diagnostic.context.offset + diagnostic.context.length)
              : null
            
            let originalText = ''
            try {
              originalText = tr.doc.textBetween(from, to)
            } catch {
              continue
            }
            
            if (expectedText && originalText !== expectedText) {
              let found = false
              tr.doc.descendants((node, pos) => {
                if (found) return false
                if (node.isText && node.text) {
                  const idx = node.text.indexOf(expectedText)
                  if (idx !== -1) {
                    from = pos + idx
                    to = from + expectedText.length
                    originalText = expectedText
                    found = true
                    return false
                  }
                }
                return true
              })
              
              if (!found) continue
            }
            
            const fixPreviewNode = state.schema.nodes.fixPreview?.create({
              diagnosticId: diagnostic.id,
              originalText: originalText,
              suggestionText: suggestion.replacement,
            })
            
            if (fixPreviewNode) {
              tr.replaceWith(from, to, fixPreviewNode)
            }
          }
          return true
        }).run()
        
      } catch (err) {
        console.error('Failed to insert batch fix previews:', err)
      }
    }, 200)

    return () => clearTimeout(batchTimeout)
  }, [batchFixState, editor])

  // Count active fix preview nodes
  const activeFixPreviewCount = useMemo(() => {
    if (!editor) return 0
    let count = 0
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'fixPreview') {
        count++
      }
    })
    return count
  }, [editor?.state.doc])

  // Accept all fix previews
  const handleAcceptAll = useCallback(() => {
    if (!editor) return
    
    const acceptNext = () => {
      let found = false
      editor.state.doc.descendants((node, pos) => {
        if (found) return false
        if (node.type.name === 'fixPreview') {
          const suggestionText = node.attrs.suggestionText
          editor.chain().command(({ tr, state }) => {
            tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(suggestionText))
            return true
          }).run()
          found = true
          return false
        }
        return true
      })
      
      if (found) {
        setTimeout(acceptNext, 50)
      } else {
        clearBatchFix()
      }
    }
    
    acceptNext()
  }, [editor, clearBatchFix])

  // Reject all fix previews
  const handleRejectAll = useCallback(() => {
    if (!editor) return
    
    const rejectNext = () => {
      let found = false
      editor.state.doc.descendants((node, pos) => {
        if (found) return false
        if (node.type.name === 'fixPreview') {
          const originalText = node.attrs.originalText
          editor.chain().command(({ tr, state }) => {
            tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(originalText))
            return true
          }).run()
          found = true
          return false
        }
        return true
      })
      
      if (found) {
        setTimeout(rejectNext, 50)
      } else {
        clearBatchFix()
      }
    }
    
    rejectNext()
  }, [editor, clearBatchFix])

  // Handle mention scan state - insert MentionPreview nodes
  useEffect(() => {
    if (!mentionScanState?.active || !editor) return
    
    const { suggestions } = mentionScanState
    
    // Filter suggestions for current document
    const docSuggestions = suggestions.filter(s => s.documentId === activeDocumentId)
    if (docSuggestions.length === 0) return
    
    const scanTimeout = setTimeout(() => {
      try {
        // Sort by position descending to insert from end to start
        const sortedSuggestions = [...docSuggestions].sort((a, b) => {
          return b.range.from - a.range.from
        })
        
        editor.chain().command(({ tr, state }) => {
          for (const suggestion of sortedSuggestions) {
            const { from, to } = suggestion.range
            
            let originalText = ''
            try {
              originalText = tr.doc.textBetween(from, to)
            } catch {
              continue
            }
            
            // Verify the text matches what we expect
            if (originalText.toLowerCase() !== suggestion.originalText.toLowerCase()) {
              // Try to find the text nearby
              let found = false
              tr.doc.descendants((node, pos) => {
                if (found) return false
                if (node.isText && node.text) {
                  const regex = new RegExp(`\\b${suggestion.originalText}\\b`, 'i')
                  const match = node.text.match(regex)
                  if (match && match.index !== undefined) {
                    const newFrom = pos + match.index
                    const newTo = newFrom + match[0].length
                    
                    const mentionPreviewNode = state.schema.nodes.mentionPreview?.create({
                      suggestionId: suggestion.id,
                      originalText: match[0],
                      mentionId: suggestion.mentionId,
                      mentionType: suggestion.mentionType,
                      mentionLabel: suggestion.mentionLabel,
                      mentionColor: suggestion.mentionColor,
                    })
                    
                    if (mentionPreviewNode) {
                      tr.replaceWith(newFrom, newTo, mentionPreviewNode)
                    }
                    found = true
                    return false
                  }
                }
                return true
              })
              continue
            }
            
            const mentionPreviewNode = state.schema.nodes.mentionPreview?.create({
              suggestionId: suggestion.id,
              originalText: originalText,
              mentionId: suggestion.mentionId,
              mentionType: suggestion.mentionType,
              mentionLabel: suggestion.mentionLabel,
              mentionColor: suggestion.mentionColor,
            })
            
            if (mentionPreviewNode) {
              tr.replaceWith(from, to, mentionPreviewNode)
            }
          }
          return true
        }).run()
        
      } catch (err) {
        console.error('Failed to insert mention previews:', err)
      }
    }, 200)

    return () => clearTimeout(scanTimeout)
  }, [mentionScanState, editor, activeDocumentId])

  // Count active mention preview nodes
  const activeMentionPreviewCount = useMemo(() => {
    if (!editor) return 0
    let count = 0
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'mentionPreview') {
        count++
      }
    })
    return count
  }, [editor?.state.doc])

  // Accept all mention previews
  const handleAcceptAllMentions = useCallback(() => {
    if (!editor) return
    
    const acceptNext = () => {
      let found = false
      editor.state.doc.descendants((node, pos) => {
        if (found) return false
        if (node.type.name === 'mentionPreview') {
          const mentionNode = editor.state.schema.nodes.mention?.create({
            id: node.attrs.mentionId,
            type: node.attrs.mentionType,
            label: node.attrs.mentionLabel,
            color: node.attrs.mentionColor,
          })
          if (mentionNode) {
            editor.chain().command(({ tr }) => {
              tr.replaceWith(pos, pos + node.nodeSize, mentionNode)
              return true
            }).run()
          }
          found = true
          return false
        }
        return true
      })
      
      if (found) {
        setTimeout(acceptNext, 50)
      } else {
        clearMentionScan()
      }
    }
    
    acceptNext()
  }, [editor, clearMentionScan])

  // Reject all mention previews
  const handleRejectAllMentions = useCallback(() => {
    if (!editor) return
    
    const rejectNext = () => {
      let found = false
      editor.state.doc.descendants((node, pos) => {
        if (found) return false
        if (node.type.name === 'mentionPreview') {
          const originalText = node.attrs.originalText
          editor.chain().command(({ tr, state }) => {
            tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(originalText))
            return true
          }).run()
          found = true
          return false
        }
        return true
      })
      
      if (found) {
        setTimeout(rejectNext, 50)
      } else {
        clearMentionScan()
      }
    }
    
    rejectNext()
  }, [editor, clearMentionScan])

  // Handle copy event
  useEffect(() => {
    if (!editor || !activeDocumentId || !activeDoc) return

    const handleCopy = (event: ClipboardEvent) => {
      const { state } = editor
      const { from, to, empty } = state.selection
      
      if (empty) return
      
      const selectedText = state.doc.textBetween(from, to, ' ')
      if (!selectedText.trim()) return
      
      const blockId = getBlockIdAtPos(state.doc, from)
      if (!blockId) return
      
      const citationData: CitationClipboardData = {
        sourceDocumentId: activeDocumentId,
        sourceDocumentTitle: activeDoc.title,
        sourceBlockId: blockId,
        text: selectedText
      }
      
      event.clipboardData?.setData(CITATION_MIME_TYPE, JSON.stringify(citationData))
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('copy', handleCopy)
    
    return () => {
      editorElement.removeEventListener('copy', handleCopy)
    }
  }, [editor, activeDocumentId, activeDoc])

  // Handle screenplay element selection
  const handleElementSelect = useCallback((elementType: ElementPickerSelection) => {
    if (!editor) return
    
    setElementPickerOpen(false)
    
    if (elementType === 'character') {
      // Use the position saved when element picker opened (before focus shifted)
      const savedPosition = elementPickerSavedPositionRef.current
      if (savedPosition === null) return
      
      characterInsertPositionRef.current = savedPosition
      
      // Focus and restore selection to the saved position
      editor.chain()
        .focus()
        .setTextSelection(savedPosition)
        .setScreenplayElement('character')
        .run()
      
      // Get coords after restoring selection
      const { view } = editor
      const coords = view.coordsAtPos(savedPosition)
      
      setCharacterAutocompletePosition({
        x: coords.left,
        y: coords.bottom
      })
      setCharacterAutocompleteOpen(true)
      elementPickerSavedPositionRef.current = null
      return
    }
    
    if (elementType === 'prop') {
      // Use the position saved when element picker opened (before focus shifted)
      const savedPosition = elementPickerSavedPositionRef.current
      if (savedPosition === null) return
      
      propInsertPositionRef.current = savedPosition
      
      // Focus and restore selection to the saved position
      editor.chain()
        .focus()
        .setTextSelection(savedPosition)
        .run()
      
      // Get coords after restoring selection
      const { view } = editor
      const coords = view.coordsAtPos(savedPosition)
      
      setPropAutocompletePosition({
        x: coords.left,
        y: coords.bottom
      })
      setPropAutocompleteOpen(true)
      elementPickerSavedPositionRef.current = null
      return
    }
    
    if (elementType === 'shot') {
      // Use the position saved when element picker opened (before focus shifted)
      const savedPosition = elementPickerSavedPositionRef.current
      if (savedPosition === null) return
      
      shotInsertPositionRef.current = savedPosition
      
      // Focus and restore selection to the saved position
      editor.chain()
        .focus()
        .setTextSelection(savedPosition)
        .setScreenplayElement('shot')
        .run()
      
      // Get coords after restoring selection
      const { view } = editor
      const coords = view.coordsAtPos(savedPosition)
      
      setShotAutocompletePosition({
        x: coords.left,
        y: coords.bottom
      })
      setShotAutocompleteOpen(true)
      elementPickerSavedPositionRef.current = null
      return
    }
    
    // For other element types, use saved position
    const savedPosition = elementPickerSavedPositionRef.current
    if (savedPosition !== null) {
      editor.chain()
        .focus()
        .setTextSelection(savedPosition)
        .setScreenplayElement(elementType)
        .run()
      elementPickerSavedPositionRef.current = null
    } else {
      editor.chain().focus().setScreenplayElement(elementType).run()
    }
  }, [editor])

  const handleElementPickerClose = useCallback(() => {
    setElementPickerOpen(false)
    elementPickerSavedPositionRef.current = null
    editor?.chain().focus().run()
  }, [editor])

  // Handle character selection
  const handleCharacterSelect = useCallback((character: Character) => {
    if (!editor) return
    
    setCharacterAutocompleteOpen(false)
    
    // Use the saved position to ensure we're inserting in the right block
    const insertPos = characterInsertPositionRef.current
    if (insertPos !== null) {
      // Set selection to the saved position first
      editor.chain()
        .focus()
        .setTextSelection(insertPos)
        .setScreenplayElement('character', {
          characterId: character.id,
          characterColor: character.color
        })
        .insertContent({
          type: 'mention',
          attrs: {
            id: character.id,
            type: 'character',
            label: character.name,
            color: character.color
          }
        })
        .run()
      
      characterInsertPositionRef.current = null
    } else {
      // Fallback: just use current position
      editor.chain()
        .focus()
        .setScreenplayElement('character', {
          characterId: character.id,
          characterColor: character.color
        })
        .insertContent({
          type: 'mention',
          attrs: {
            id: character.id,
            type: 'character',
            label: character.name,
            color: character.color
          }
        })
        .run()
    }
  }, [editor])

  const handleCharacterCreate = useCallback(async (name: string): Promise<Character | undefined> => {
    await addCharacter(name)
    
    const { currentProject } = useProjectStore.getState()
    const newChar = currentProject?.characters?.find(
      c => c.name.toUpperCase() === name.toUpperCase()
    )
    
    return newChar
  }, [addCharacter])

  const handleCharacterAutocompleteClose = useCallback(() => {
    setCharacterAutocompleteOpen(false)
    characterInsertPositionRef.current = null
    editor?.chain().focus().run()
  }, [editor])

  // Handle prop selection
  const handlePropSelect = useCallback((prop: Prop) => {
    if (!editor) return
    
    setPropAutocompleteOpen(false)
    
    // Use the saved position to ensure we're inserting in the right block
    const insertPos = propInsertPositionRef.current
    if (insertPos !== null) {
      // Set selection to the saved position first
      editor.chain()
        .focus()
        .setTextSelection(insertPos)
        .setScreenplayElement('action')
        .insertContent(prop.name)
        .run()
      
      propInsertPositionRef.current = null
    } else {
      // Fallback: just use current position
      editor.chain()
        .focus()
        .setScreenplayElement('action')
        .insertContent(prop.name)
        .run()
    }
  }, [editor])

  const handlePropCreate = useCallback(async (name: string): Promise<Prop | undefined> => {
    await addProp(name)
    
    const { currentProject } = useProjectStore.getState()
    const newProp = currentProject?.props?.find(
      p => p.name.toUpperCase() === name.toUpperCase()
    )
    
    return newProp
  }, [addProp])

  const handlePropAutocompleteClose = useCallback(() => {
    setPropAutocompleteOpen(false)
    propInsertPositionRef.current = null
    editor?.chain().focus().run()
  }, [editor])

  // Handle shot selection
  const handleShotSelect = useCallback((shotName: string) => {
    if (!editor) return
    
    setShotAutocompleteOpen(false)
    
    // The block is already set to 'shot' element type when the autocomplete opened
    // Use the saved position to insert at the correct location
    const insertPos = shotInsertPositionRef.current
    
    if (insertPos !== null) {
      // Focus first
      editor.commands.focus()
      
      // Use a transaction to insert text and set cursor at the end
      const { tr } = editor.state
      tr.insertText(shotName, insertPos)
      // Set cursor position to end of inserted text
      const newCursorPos = insertPos + shotName.length
      tr.setSelection(editor.state.selection.constructor.near(tr.doc.resolve(newCursorPos)))
      editor.view.dispatch(tr)
      
      shotInsertPositionRef.current = null
    } else {
      // Fallback: just insert at current position
      editor.chain()
        .focus()
        .insertContent(shotName)
        .run()
    }
  }, [editor])

  const handleShotAutocompleteClose = useCallback(() => {
    setShotAutocompleteOpen(false)
    shotInsertPositionRef.current = null
    editor?.chain().focus().run()
  }, [editor])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (activeDocumentId) {
        saveDocument(activeDocumentId)
      }
    }
  }, [activeDocumentId, saveDocument])

  // Title editing
  const handleTitleClick = () => {
    setEditedTitle(derivedTitle || documentTitle)
    setIsEditingTitle(true)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitleChange()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
      setEditedTitle('')
    }
  }

  const saveTitleChange = useCallback(() => {
    const newTitle = editedTitle.trim()
    if (newTitle && newTitle !== (derivedTitle || documentTitle) && activeDocumentId) {
      renameDocument(activeDocumentId, newTitle)
    }
    setIsEditingTitle(false)
    setEditedTitle('')
  }, [editedTitle, derivedTitle, documentTitle, activeDocumentId, renameDocument])

  // Version history
  const currentDocVersions = activeDocumentId ? documentVersions[activeDocumentId] || [] : []
  
  const handleCloseVersionHistory = useCallback(() => {
    setVersionHistoryMode(false, null)
  }, [setVersionHistoryMode])

  // Storyboard link mode
  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    if (!storyboardUI.linkMode.active || !storyboardUI.linkMode.targetShotId) return
    if (!activeDocumentId || !editor) return

    const target = e.target as HTMLElement
    const blockElement = target.closest('[data-block-id]') as HTMLElement | null
    
    if (!blockElement) return
    
    const blockId = blockElement.getAttribute('data-block-id')
    if (!blockId) return

    const docContent = editor.getJSON()
    if (!docContent) return

    const anchor = captureBlockAnchor(docContent, blockId, activeDocumentId)
    if (!anchor) return

    linkShotToBlock(storyboardUI.linkMode.targetShotId, anchor)
  }, [storyboardUI.linkMode, activeDocumentId, editor, linkShotToBlock])

  // Cancel link mode on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && storyboardUI.linkMode.active) {
        cancelLinkMode()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [storyboardUI.linkMode.active, cancelLinkMode])

  // Auto-scroll to highlighted block during storyboard playback
  useEffect(() => {
    if (!editor || !editorContainerRef.current) return
    
    const allBlocks = editorContainerRef.current.querySelectorAll('[data-block-id]') as NodeListOf<HTMLElement>
    allBlocks.forEach(el => {
      el.style.background = ''
      el.style.boxShadow = ''
      el.style.borderRadius = ''
      el.style.marginLeft = ''
      el.style.marginRight = ''
      el.style.paddingLeft = ''
      el.style.paddingRight = ''
    })
    
    if (!storyboardUI.highlightedBlockId) return

    const blockId = storyboardUI.highlightedBlockId
    
    const doc = editor.state.doc
    let foundFrom = -1
    let foundTo = -1
    
    doc.descendants((node, pos) => {
      if (foundFrom >= 0) return false
      if (node.attrs?.blockId === blockId) {
        foundFrom = pos + 1
        foundTo = pos + node.nodeSize - 1
        return false
      }
      return true
    })
    
    if (foundFrom >= 0) {
      editor.chain().focus().setTextSelection({ from: foundFrom, to: foundTo }).run()
      
      const { view } = editor
      const coords = view.coordsAtPos(foundFrom)
      
      if (coords && editorContainerRef.current) {
        const container = editorContainerRef.current
        const containerRect = container.getBoundingClientRect()
        const scrollTop = container.scrollTop + (coords.top - containerRect.top) - (containerRect.height / 2)
        
        container.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        })
      }
      
      const targetElement = editorContainerRef.current.querySelector(
        `[data-block-id="${blockId}"]`
      ) as HTMLElement | null
      
      if (targetElement) {
        targetElement.style.background = 'linear-gradient(90deg, rgba(251, 191, 36, 0.12) 0%, rgba(251, 191, 36, 0.18) 50%, rgba(251, 191, 36, 0.12) 100%)'
        targetElement.style.boxShadow = 'inset 4px 0 0 rgba(251, 191, 36, 0.8), 0 0 30px rgba(251, 191, 36, 0.15)'
        targetElement.style.borderRadius = '4px'
        targetElement.style.marginLeft = '-8px'
        targetElement.style.marginRight = '-8px'
        targetElement.style.paddingLeft = '8px'
        targetElement.style.paddingRight = '8px'
      }
    }
  }, [storyboardUI.highlightedBlockId, editor])

  // Storyboard panel resize
  const handleStoryboardResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    storyboardResizeStartX.current = e.clientX
    storyboardResizeStartWidth.current = ui.storyboardPanelWidth
    setIsResizingStoryboard(true)
  }, [ui.storyboardPanelWidth])

  useEffect(() => {
    if (!isResizingStoryboard) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = storyboardResizeStartX.current - e.clientX
      const newWidth = storyboardResizeStartWidth.current + delta
      const clampedWidth = Math.min(Math.max(newWidth, 280), 600)
      setStoryboardPanelWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizingStoryboard(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingStoryboard, setStoryboardPanelWidth])

  if (!activeDocumentId || !activeDoc) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-theme-muted font-ui">Select a document to start editing</p>
      </div>
    )
  }

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 min-h-0"
      onKeyDown={handleKeyDown}
    >
      <div className="relative z-20 flex-shrink-0">
        {activeDoc?.useJournalToolbar ? (
          <JournalToolbar editor={editor} />
        ) : (
          <ScreenplayToolbar editor={editor} isNote={hierarchyInfo.type === 'note'} />
        )}
      </div>
      
      <div className={`flex-1 min-h-0 flex ${(versionHistoryMode.active || storyboardUI.mode || ui.writingPartnerPanelOpen) ? 'flex-row' : 'flex-col'} overflow-hidden`}>
        <div className={clsx(
          'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0',
          versionHistoryMode.active && 'w-1/2 border-r border-theme-subtle',
          (storyboardUI.mode || ui.writingPartnerPanelOpen) && !versionHistoryMode.active && 'border-r border-theme-subtle'
        )}>
          {/* Document title */}
          <div className="px-8 pt-6 pb-2 border-b border-theme-subtle bg-theme-header flex-shrink-0">
            {/* Title row with status dropdown */}
            <div className="flex items-center justify-between gap-4">
              {isEditingTitle ? (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    autoFocus
                    className="flex-1 text-2xl font-bold text-theme-primary bg-transparent outline-none border-b-2 border-theme-accent caret-gold-400 pb-1"
                    style={{ fontFamily: "'Courier New', Courier, monospace" }}
                  />
                  <button
                    onClick={saveTitleChange}
                    className="p-1.5 text-theme-primary hover:text-theme-accent transition-colors"
                    title="Save (Enter)"
                  >
                    <CheckmarkRegular className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingTitle(false)
                      setEditedTitle('')
                    }}
                    className="p-1.5 text-theme-primary hover:text-theme-accent transition-colors"
                    title="Cancel (Escape)"
                  >
                    <DismissRegular className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <h1 
                  className="text-2xl font-bold text-theme-primary cursor-pointer hover:text-theme-accent transition-colors truncate min-w-0 flex-1"
                  style={{ fontFamily: "'Courier New', Courier, monospace" }}
                  onClick={handleTitleClick}
                  title={derivedTitle || documentTitle}
                >
                  {derivedTitle || documentTitle}
                </h1>
              )}
              
              <StateDropdown
                value={projectState}
                stateNote={projectStateNote}
                onChange={handleProjectStateChange}
                showNote={true}
              />
            </div>
            
            {hierarchyInfo.type === 'page' && hierarchyInfo.parentTitle && (
              <p className="text-sm text-theme-muted font-ui mt-1">
                Page {hierarchyInfo.pageNumber} of {hierarchyInfo.parentTitle}
              </p>
            )}
            {hierarchyInfo.type === 'note' && hierarchyInfo.parentTitle && (
              <p className="text-sm text-theme-muted font-ui mt-1">
                Note of {hierarchyInfo.parentTitle}
              </p>
            )}
            <div className="text-xs text-theme-muted font-ui mt-2">
              <span>
                {docState?.isDirty ? 'Unsaved changes' : 'Saved'}
              </span>
              {docState?.lastSaved && (
                <span className="ml-2">
                  Last saved: {new Date(docState.lastSaved).toLocaleTimeString()}
                </span>
              )}
              {versionHistoryMode.active && (
                <span className="block text-gold-400 font-medium mt-1">
                  Comparing with version history
                </span>
              )}
            </div>
          </div>

          {/* Script Appearances section for character/prop notes */}
          {activeDoc?.isCharacterNote && activeDoc.characterId && (
            <ScriptAppearances characterId={activeDoc.characterId} />
          )}
          {activeDoc?.isPropNote && activeDoc.propId && (
            <ScriptAppearances propId={activeDoc.propId} />
          )}

          {/* Editor content */}
          <div 
            className={`flex-1 overflow-auto relative ${storyboardUI.linkMode.active ? 'cursor-crosshair' : ''}`} 
            ref={editorContainerRef}
            onClick={handleEditorClick}
          >
            {storyboardUI.linkMode.active && (
              <div className="sticky top-0 z-40 bg-gold-400/10 border-b border-gold-400/30 px-4 py-2 text-center">
                <p className="text-xs font-ui text-gold-400">
                  Click on a text block to link it to the shot • Press Esc to cancel
                </p>
              </div>
            )}
            
            {(batchFixState?.active || activeFixPreviewCount > 0) && (
              <div className="sticky top-4 z-50 flex justify-end px-4 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-2 bg-ink-800/95 backdrop-blur-sm border border-ink-600 rounded-lg px-3 py-2 shadow-xl">
                  <span className="text-xs text-ink-300 font-ui mr-2">
                    {activeFixPreviewCount} {activeFixPreviewCount === 1 ? 'change' : 'changes'}
                  </span>
                  <button
                    onClick={handleAcceptAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-ui font-medium text-green-400 bg-green-400/10 rounded-md hover:bg-green-400/20 transition-colors"
                  >
                    <CheckmarkRegular className="w-4 h-4" />
                    Accept All
                  </button>
                  <button
                    onClick={handleRejectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-ui font-medium text-red-400 bg-red-400/10 rounded-md hover:bg-red-400/20 transition-colors"
                  >
                    <DismissRegular className="w-4 h-4" />
                    Reject All
                  </button>
                </div>
              </div>
            )}
            
            {(mentionScanState?.active || activeMentionPreviewCount > 0) && (
              <div className="sticky top-4 z-50 flex justify-end px-4 pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-2 bg-ink-800/95 backdrop-blur-sm border border-gold-500/30 rounded-lg px-3 py-2 shadow-xl">
                  <span className="text-xs text-gold-400 font-ui mr-2">
                    {activeMentionPreviewCount} {activeMentionPreviewCount === 1 ? 'mention' : 'mentions'} found
                  </span>
                  <button
                    onClick={handleAcceptAllMentions}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-ui font-medium text-green-400 bg-green-400/10 rounded-md hover:bg-green-400/20 transition-colors"
                  >
                    <CheckmarkRegular className="w-4 h-4" />
                    Accept All
                  </button>
                  <button
                    onClick={handleRejectAllMentions}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-ui font-medium text-red-400 bg-red-400/10 rounded-md hover:bg-red-400/20 transition-colors"
                  >
                    <DismissRegular className="w-4 h-4" />
                    Reject All
                  </button>
                </div>
              </div>
            )}
            
            <div 
              className="mx-auto py-8 transition-transform duration-150 ease-out"
              style={{
                transform: `scale(${ui.viewZoom / 100})`,
                transformOrigin: 'top center',
                width: `${100 / (ui.viewZoom / 100)}%`,
                maxWidth: `${(768 * 100) / ui.viewZoom}%`,
              }}
            >
              <div 
                className={clsx(
                  'max-w-3xl mx-auto screenplay-mode',
                  hierarchyInfo.type === 'note' && 'note-editor'
                )}
              >
                <EditorContent 
                  editor={editor} 
                  className="max-w-none"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Version History Panel */}
        {versionHistoryMode.active && (
          <div className="w-1/2 flex">
            <VersionHistoryPanel
              versions={currentDocVersions}
              selectedVersionId={versionHistoryMode.selectedVersionId}
              onClose={handleCloseVersionHistory}
              useMonospaceFont={true}
            />
          </div>
        )}
        
        {/* Storyboard Panel */}
        {storyboardUI.mode && !versionHistoryMode.active && (
          <>
            <div
              onMouseDown={handleStoryboardResizeStart}
              className={clsx(
                'w-1 cursor-ew-resize flex-shrink-0 group relative',
                'hover:bg-gold-400/20 transition-colors',
                isResizingStoryboard && 'bg-gold-400/30'
              )}
            >
              <div className={clsx(
                'absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 rounded-full',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                'bg-gold-400/50',
                isResizingStoryboard && 'opacity-100'
              )} />
            </div>
            
            <div 
              className="flex flex-col relative flex-shrink-0"
              style={{ width: ui.storyboardPanelWidth }}
            >
              <StoryboardPanel />
            </div>
          </>
        )}

        {/* Writing Partner Panel */}
        {ui.writingPartnerPanelOpen && !versionHistoryMode.active && !storyboardUI.mode && (
          <>
            <div className="w-px bg-theme-subtle flex-shrink-0" />
            <div 
              className="flex flex-col relative flex-shrink-0 w-[360px]"
            >
              <WritingPartnerPanel />
            </div>
          </>
        )}
      </div>
      
      {/* Screenplay Element Picker */}
      <ScreenplayElementPicker
        isOpen={elementPickerOpen}
        position={elementPickerPosition}
        onSelect={handleElementSelect}
        onClose={handleElementPickerClose}
      />
      
      {/* Character Autocomplete */}
      <CharacterAutocomplete
        isOpen={characterAutocompleteOpen}
        position={characterAutocompletePosition}
        onSelect={handleCharacterSelect}
        onCreateNew={handleCharacterCreate}
        onClose={handleCharacterAutocompleteClose}
      />
      
      {/* Prop Autocomplete */}
      <PropAutocomplete
        isOpen={propAutocompleteOpen}
        position={propAutocompletePosition}
        onSelect={handlePropSelect}
        onCreateNew={handlePropCreate}
        onClose={handlePropAutocompleteClose}
      />
      
      {/* Shot Autocomplete */}
      <ShotAutocomplete
        isOpen={shotAutocompleteOpen}
        position={shotAutocompletePosition}
        onSelect={handleShotSelect}
        onClose={handleShotAutocompleteClose}
      />
      
      {/* Selection Slash Menu (for revision commands when text is selected) */}
      {editor && selectionMenuData && (
        <SelectionSlashMenu
          editor={editor}
          isOpen={selectionMenuOpen}
          selectedText={selectionMenuData.selectedText}
          selectionRange={selectionMenuData.selectionRange}
          onClose={() => {
            setSelectionMenuOpen(false)
            setSelectionMenuData(null)
          }}
        />
      )}
    </div>
  )
}
