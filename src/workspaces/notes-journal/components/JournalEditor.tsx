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
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { DragHandle } from '@tiptap/extension-drag-handle'
import { CheckmarkRegular, DismissRegular } from '@fluentui/react-icons'
import type { JSONContent } from '@tiptap/core'

import { useProjectStore, getDocumentHierarchyType, getPageNumber, getParentDocument } from '../../../stores/projectStore'
import { StateDropdown } from '../../../components/StateDropdown'
import type { DocumentLifecycleState, LivingDocument } from '../../../types/project'

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
  AIPreview
} from '../../shared/extensions'
import { createSlashCommandSuggestion } from '../../shared/components/slashCommandConfig'
import { SelectionSlashMenu } from '../../shared/components/SelectionSlashMenu'
import { VersionHistoryPanel } from '../../shared/components'

// Journal-specific
import { JournalToolbar } from './JournalToolbar'
import { StickerOverlay } from './StickerOverlay'

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

// Helper to extract first H1 text
interface H1Info {
  text: string | null
  fontFamily: string | null
}

function getFirstH1Info(content: JSONContent | null): H1Info {
  if (!content?.content) return { text: null, fontFamily: null }
  
  for (const node of content.content) {
    if (node.type === 'heading' && node.attrs?.level === 1) {
      const textParts: string[] = []
      let fontFamily: string | null = null
      
      if (node.content) {
        for (const child of node.content) {
          if (child.type === 'text' && child.text) {
            textParts.push(child.text)
            if (child.marks) {
              const textStyleMark = child.marks.find((m: { type: string }) => m.type === 'textStyle')
              if (textStyleMark?.attrs?.fontFamily) {
                fontFamily = textStyleMark.attrs.fontFamily
              }
            }
          }
        }
      }
      return { text: textParts.join('') || null, fontFamily }
    }
  }
  return { text: null, fontFamily: null }
}

// Helper to update first H1 text
function updateFirstH1Text(content: JSONContent, newText: string): JSONContent {
  if (!content.content) return content
  
  const newContent = { ...content, content: [...content.content] }
  
  for (let i = 0; i < newContent.content.length; i++) {
    const node = newContent.content[i]
    if (node.type === 'heading' && node.attrs?.level === 1) {
      const existingMarks = node.content?.[0]?.marks || []
      newContent.content[i] = {
        ...node,
        content: [{ type: 'text', text: newText, marks: existingMarks.length > 0 ? existingMarks : undefined }]
      }
      return newContent
    }
  }
  
  newContent.content.unshift({
    type: 'heading',
    attrs: { level: 1 },
    content: [{ type: 'text', text: newText }]
  })
  
  return newContent
}

export function JournalEditor() {
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
    navigateToCitation,
    scrollTargetBlock,
    clearScrollTarget,
    scrollTargetRange,
    clearScrollTargetRange,
    pendingFixRequest,
    clearFixRequest,
    batchFixState,
    clearBatchFix,
    ui,
    versionHistoryMode,
    documentVersions,
    setVersionHistoryMode,
  } = useProjectStore()
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const titleSyncRef = useRef(false)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const activeDoc = currentProject?.documents.find(d => d.id === activeDocumentId)
  const docState = activeDocumentId ? documents[activeDocumentId] : null
  
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  
  const [projectState, setProjectState] = useState<DocumentLifecycleState>('active')
  const [projectStateNote, setProjectStateNote] = useState<string | undefined>(undefined)
  
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

  const fixAcceptRef = useRef<(diagnosticId: string) => void>()
  fixAcceptRef.current = () => {}
  
  const fixRejectRef = useRef<(diagnosticId: string) => void>()
  fixRejectRef.current = () => {}
  
  // Selection slash menu trigger ref
  const selectionSlashTriggerRef = useRef<(selectedText: string, selectionRange: { from: number; to: number }) => void>()
  selectionSlashTriggerRef.current = (selectedText, selectionRange) => {
    setSelectionMenuData({ selectedText, selectionRange })
    setSelectionMenuOpen(true)
  }

  // Get title from first H1 or document title
  const { documentTitle, titleFontFamily } = useMemo(() => {
    const h1Info = getFirstH1Info(docState?.content || null)
    const fontFamily = h1Info.fontFamily || 'Carlito, Calibri, sans-serif'
    
    return {
      documentTitle: h1Info.text || activeDoc?.title || 'Untitled Note',
      titleFontFamily: fontFamily,
    }
  }, [docState?.content, activeDoc?.title])

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
      updateDocumentTitleFont(activeDocumentId, titleFontFamily !== 'Carlito, Calibri, sans-serif' ? titleFontFamily : null)
    }
  }, [activeDocumentId, titleFontFamily, updateDocumentTitleFont])
  
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

  // TipTap extensions for journal
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] }
    }),
    Underline,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    Color,
    FontSize,
    LineHeight,
    FontFamily,
    PreserveMarks,
    AssetImage.configure({ inline: false, allowBase64: false }),
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
    UniqueID.configure({
      types: ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'bulletList', 'orderedList', 'taskItem'],
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
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          return 'Note title...'
        }
        return 'Start writing...'
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
    },
    onUpdate: ({ editor }) => {
      if (!activeDocumentId) return
      
      const content = editor.getJSON()
      updateDocumentContent(activeDocumentId, content)
      syncAssetReferences(activeDocumentId, content)
      syncDocumentTodos(activeDocumentId, content)
      
      if (!titleSyncRef.current) {
        const h1Info = getFirstH1Info(content)
        if (h1Info.text && activeDoc && h1Info.text !== activeDoc.title) {
          renameDocument(activeDocumentId, h1Info.text)
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

  // Update editor content when document changes
  useEffect(() => {
    if (editor && docState?.content) {
      const currentContent = JSON.stringify(editor.getJSON())
      const newContent = JSON.stringify(docState.content)
      
      if (currentContent !== newContent) {
        editor.commands.setContent(docState.content)
      }
    }
  }, [editor, docState?.content])

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
    setEditedTitle(documentTitle)
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
    if (newTitle && newTitle !== documentTitle && activeDocumentId && editor) {
      renameDocument(activeDocumentId, newTitle)
      
      titleSyncRef.current = true
      const content = editor.getJSON()
      const updatedContent = updateFirstH1Text(content, newTitle)
      editor.commands.setContent(updatedContent)
      updateDocumentContent(activeDocumentId, updatedContent)
      
      setTimeout(() => {
        titleSyncRef.current = false
      }, 100)
    }
    setIsEditingTitle(false)
    setEditedTitle('')
  }, [editedTitle, documentTitle, activeDocumentId, editor, renameDocument, updateDocumentContent])

  // Version history
  const currentDocVersions = activeDocumentId ? documentVersions[activeDocumentId] || [] : []
  
  const handleCloseVersionHistory = useCallback(() => {
    setVersionHistoryMode(false, null)
  }, [setVersionHistoryMode])

  if (!activeDocumentId || !activeDoc) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-theme-muted font-ui">Select a note to start writing</p>
      </div>
    )
  }

  return (
    <div 
      className="flex-1 flex flex-col min-w-0 min-h-0"
      onKeyDown={handleKeyDown}
    >
      <div className="relative z-20 flex-shrink-0">
        <JournalToolbar editor={editor} />
      </div>
      
      <div className={`flex-1 min-h-0 flex ${versionHistoryMode.active ? 'flex-row' : 'flex-col'} overflow-hidden`}>
        <div className={clsx(
          'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0',
          versionHistoryMode.active && 'w-1/2 border-r border-ink-700'
        )}>
          {/* Document title */}
          <div className="px-8 pt-6 pb-2 border-b border-theme-subtle bg-theme-header flex-shrink-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  autoFocus
                  className="flex-1 text-2xl font-bold text-theme-primary bg-transparent outline-none border-b-2 border-theme-accent caret-gold-400 pb-1"
                  style={{ fontFamily: titleFontFamily }}
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
                className="text-2xl font-bold text-theme-primary cursor-pointer hover:text-theme-accent transition-colors truncate max-w-full"
                style={{ fontFamily: titleFontFamily }}
                onClick={handleTitleClick}
                title={documentTitle}
              >
                {documentTitle}
              </h1>
            )}
            {hierarchyInfo.type === 'page' && hierarchyInfo.parentTitle && (
              <p className="text-sm text-theme-muted font-ui mt-1">
                Note {hierarchyInfo.pageNumber} of {hierarchyInfo.parentTitle}
              </p>
            )}
            {hierarchyInfo.type === 'note' && hierarchyInfo.parentTitle && (
              <p className="text-sm text-theme-muted font-ui mt-1">
                Note of {hierarchyInfo.parentTitle}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-theme-muted font-ui">
              <span>
                {docState?.isDirty ? 'Unsaved changes' : 'Saved'}
              </span>
              {docState?.lastSaved && (
                <span>
                  Last saved: {new Date(docState.lastSaved).toLocaleTimeString()}
                </span>
              )}
              {versionHistoryMode.active && (
                <span className="text-gold-400 font-medium">
                  Comparing with version history
                </span>
              )}
              
              <div className="ml-auto">
                <StateDropdown
                  value={projectState}
                  stateNote={projectStateNote}
                  onChange={handleProjectStateChange}
                  showNote={true}
                />
              </div>
            </div>
          </div>

          {/* Editor content */}
          <div 
            className="flex-1 overflow-auto relative" 
            ref={editorContainerRef}
          >
            {/* Sticker overlay for draggable stickers */}
            {activeDocumentId && (
              <StickerOverlay 
                documentId={activeDocumentId}
                containerRef={editorContainerRef}
              />
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
                  'max-w-3xl mx-auto notes-journal-mode',
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
            />
          </div>
        )}
      </div>
      
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
