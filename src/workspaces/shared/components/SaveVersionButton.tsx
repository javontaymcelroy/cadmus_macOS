import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { SaveSyncRegular } from '@fluentui/react-icons'
import { useProjectStore } from '../../../stores/projectStore'

export function SaveVersionButton() {
  const [isSaving, setIsSaving] = useState(false)
  const activeDocumentId = useProjectStore(state => state.activeDocumentId)
  const saveVersion = useProjectStore(state => state.saveVersion)
  const versions = useProjectStore(state => 
    activeDocumentId ? state.documentVersions[activeDocumentId] || [] : []
  )
  const hasContent = useProjectStore(state => {
    if (!activeDocumentId) return false
    const content = state.documents[activeDocumentId]?.content
    // Check if document has actual content (not just empty)
    return content?.content && content.content.length > 0
  })
  
  const isDisabled = !activeDocumentId || isSaving || !hasContent
  
  const handleSaveVersion = useCallback(async () => {
    if (!activeDocumentId || isSaving) return
    
    setIsSaving(true)
    try {
      await saveVersion(activeDocumentId)
    } finally {
      setIsSaving(false)
    }
  }, [activeDocumentId, isSaving, saveVersion])

  // Show version count badge if there are saved versions
  const versionCount = versions.length

  return (
    <button
      onClick={handleSaveVersion}
      disabled={isDisabled}
      className={clsx(
        "relative btn-icon-modern w-7 h-7 flex items-center justify-center",
        isDisabled && "opacity-50 cursor-not-allowed"
      )}
      title={isSaving ? "Saving..." : `Save Version${versionCount > 0 ? ` (${versionCount} saved)` : ''}`}
    >
      <SaveSyncRegular className={clsx("w-4 h-4", isSaving && "animate-spin")} />
      {versionCount > 0 && (
        <span className="absolute -top-1 -right-1 text-[10px] font-medium text-white bg-theme-accent px-1 min-w-[16px] h-4 flex items-center justify-center rounded-full">
          {versionCount}
        </span>
      )}
    </button>
  )
}
