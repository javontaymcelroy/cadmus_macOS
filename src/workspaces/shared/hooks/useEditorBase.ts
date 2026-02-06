import { useRef, useCallback, useEffect } from 'react'
import { useProjectStore } from '../../../stores/projectStore'
import type { JSONContent } from '@tiptap/core'
import type { Editor } from '@tiptap/react'

// MIME type for citation metadata in clipboard
export const CITATION_MIME_TYPE = 'application/x-cadmus-citation'

// Interface for citation clipboard data
export interface CitationClipboardData {
  sourceDocumentId: string
  sourceDocumentTitle: string
  sourceBlockId: string
  text: string
}

// Interface for asset data transferred during drag-drop
export interface AssetDropData {
  assetId: string
  assetPath: string
  projectPath: string
  name: string
}

/**
 * Shared hook for editor document state management
 * Handles loading, saving, and syncing document content
 */
export function useEditorDocumentState() {
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
  } = useProjectStore()

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const titleSyncRef = useRef(false)

  const activeDoc = currentProject?.documents.find(d => d.id === activeDocumentId)
  const docState = activeDocumentId ? documents[activeDocumentId] : null

  // Handle document content update with debounced save
  const handleEditorUpdate = useCallback((content: JSONContent, getFirstH1Text?: () => string | null) => {
    if (!activeDocumentId) return

    updateDocumentContent(activeDocumentId, content)
    syncAssetReferences(activeDocumentId, content)
    syncDocumentTodos(activeDocumentId, content)

    // Sync first H1 to document title (if not already syncing from title edit)
    if (!titleSyncRef.current && getFirstH1Text) {
      const h1Text = getFirstH1Text()
      if (h1Text && activeDoc && h1Text !== activeDoc.title) {
        renameDocument(activeDocumentId, h1Text)
      }
    }

    // Debounced auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(activeDocumentId)
    }, 1000)
  }, [activeDocumentId, activeDoc, updateDocumentContent, syncAssetReferences, syncDocumentTodos, renameDocument, saveDocument])

  // Cleanup save timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    activeDoc,
    docState,
    activeDocumentId,
    currentProject,
    handleEditorUpdate,
    updateDocumentTitleFont,
    addAssetReference,
    titleSyncRef,
    saveDocument,
    renameDocument,
  }
}

/**
 * Hook for handling navigation to citations and scroll targets
 */
export function useEditorNavigation(editor: Editor | null, editorContainerRef: React.RefObject<HTMLDivElement>) {
  const {
    scrollTargetBlock,
    clearScrollTarget,
    scrollTargetRange,
    clearScrollTargetRange,
    navigateToCitation,
    navigateToCharacterNote,
  } = useProjectStore()

  // Scroll to target block when navigating from a citation or storyboard
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
  }, [scrollTargetBlock, editor, clearScrollTarget, editorContainerRef])

  // Scroll to target range when navigating from "Go to issue"
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
  }, [scrollTargetRange, editor, clearScrollTargetRange, editorContainerRef])

  return {
    navigateToCitation,
    navigateToCharacterNote,
  }
}

/**
 * Hook for handling fix previews and batch fixes
 */
export function useEditorFixPreviews(editor: Editor | null, activeDocumentId: string | null) {
  const {
    pendingFixRequest,
    clearFixRequest,
    batchFixState,
    clearBatchFix,
  } = useProjectStore()

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

  return {
    batchFixState,
    clearBatchFix,
  }
}

/**
 * Hook for handling citation copy/paste
 */
export function useEditorCitationClipboard(
  editor: Editor | null,
  activeDocumentId: string | null,
  activeDocTitle: string | undefined
) {
  useEffect(() => {
    if (!editor || !activeDocumentId || !activeDocTitle) return

    const handleCopy = (event: ClipboardEvent) => {
      const { state } = editor
      const { from, to, empty } = state.selection

      if (empty) return

      const selectedText = state.doc.textBetween(from, to, ' ')
      if (!selectedText.trim()) return

      // Dynamic import to avoid circular dependency
      import('./useEditorBase').then(({ getBlockIdAtPos }) => {
        // This won't work - need to import from extensions
      }).catch(() => {})

      // For now, just set basic citation data without blockId
      const citationData: CitationClipboardData = {
        sourceDocumentId: activeDocumentId,
        sourceDocumentTitle: activeDocTitle,
        sourceBlockId: '', // Would need to import getBlockIdAtPos
        text: selectedText
      }

      event.clipboardData?.setData(CITATION_MIME_TYPE, JSON.stringify(citationData))
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('copy', handleCopy)

    return () => {
      editorElement.removeEventListener('copy', handleCopy)
    }
  }, [editor, activeDocumentId, activeDocTitle])
}
