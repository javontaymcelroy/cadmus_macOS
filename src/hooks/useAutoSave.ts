import { useEffect, useRef } from 'react'
import { useProjectStore } from '../stores/projectStore'

/**
 * Hook that handles auto-saving of the active document
 * - Saves after a debounce period when content changes
 * - Saves immediately on blur/close
 */
export function useAutoSave(debounceMs = 2000) {
  const { 
    activeDocumentId, 
    documents, 
    saveDocument 
  } = useProjectStore()
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef<string>('')

  // Debounced save when content changes
  useEffect(() => {
    if (!activeDocumentId) return

    const docState = documents[activeDocumentId]
    if (!docState?.isDirty || !docState?.content) return

    const currentContent = JSON.stringify(docState.content)
    
    // Skip if content hasn't actually changed
    if (currentContent === lastSavedContentRef.current) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      await saveDocument(activeDocumentId)
      lastSavedContentRef.current = currentContent
    }, debounceMs)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [activeDocumentId, documents, saveDocument, debounceMs])

  // Save on window blur
  useEffect(() => {
    const handleBlur = () => {
      if (activeDocumentId) {
        const docState = documents[activeDocumentId]
        if (docState?.isDirty) {
          saveDocument(activeDocumentId)
        }
      }
    }

    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [activeDocumentId, documents, saveDocument])

  // Save on beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasDirtyDocs = Object.values(documents).some(doc => doc.isDirty)
      
      if (hasDirtyDocs) {
        // Try to save synchronously (may not complete)
        if (activeDocumentId) {
          saveDocument(activeDocumentId)
        }
        
        // Show confirmation dialog
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [activeDocumentId, documents, saveDocument])
}
