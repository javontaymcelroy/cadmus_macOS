import { useEffect } from 'react'
import { useProjectStore } from '../stores/projectStore'

/**
 * Global keyboard shortcuts for the application
 */
export function useKeyboardShortcuts() {
  const {
    activeDocumentId,
    saveDocument,
    createDocument,
    toggleLeftSidebar,
    toggleRightSidebar,
    runBuild,
    zoomIn,
    zoomOut,
    resetZoom,
    // Storyboard shortcuts
    storyboardUI,
    togglePlayback,
    nextShot,
    prevShot,
    cancelLinkMode,
    currentProject,
    // Writing Partner
    toggleWritingPartnerPanel
  } = useProjectStore()

  // Check if storyboard mode is active (for enabling playback shortcuts)
  const isStoryboardActive = storyboardUI.mode && currentProject?.templateId === 'screenplay'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Storyboard shortcuts (only when storyboard is active and not in input)
      if (isStoryboardActive) {
        // Space - Play/Pause (only if not in an editable element)
        if (e.key === ' ' && !isInputElement) {
          e.preventDefault()
          togglePlayback()
          return
        }

        // Arrow Right - Next Shot (only if not in an editable element)
        if (e.key === 'ArrowRight' && !isInputElement && !isMod) {
          e.preventDefault()
          nextShot()
          return
        }

        // Arrow Left - Previous Shot (only if not in an editable element)
        if (e.key === 'ArrowLeft' && !isInputElement && !isMod) {
          e.preventDefault()
          prevShot()
          return
        }

        // Escape - Cancel link mode or exit storyboard playback
        if (e.key === 'Escape') {
          if (storyboardUI.linkMode.active) {
            e.preventDefault()
            cancelLinkMode()
            return
          }
        }
      }

      // Cmd/Ctrl + S - Save
      if (isMod && e.key === 's') {
        e.preventDefault()
        if (activeDocumentId) {
          saveDocument(activeDocumentId)
        }
      }

      // Cmd/Ctrl + N - New Document/Journal
      if (isMod && e.key === 'n') {
        e.preventDefault()
        const defaultTitle = currentProject?.templateId === 'notes-journal' ? 'New Journal' : 'New Document'
        createDocument(defaultTitle)
      }

      // Cmd/Ctrl + B - Toggle Left Sidebar
      if (isMod && e.key === 'b') {
        e.preventDefault()
        toggleLeftSidebar()
      }

      // Cmd/Ctrl + Shift + B - Run Build
      if (isMod && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        runBuild()
      }

      // Cmd/Ctrl + \ - Toggle Right Sidebar
      if (isMod && e.key === '\\') {
        e.preventDefault()
        toggleRightSidebar()
      }

      // Cmd/Ctrl + Plus/= - Zoom In
      if (isMod && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        zoomIn()
      }

      // Cmd/Ctrl + Minus - Zoom Out
      if (isMod && e.key === '-') {
        e.preventDefault()
        zoomOut()
      }

      // Cmd/Ctrl + 0 - Reset Zoom
      if (isMod && e.key === '0') {
        e.preventDefault()
        resetZoom()
      }

      // Cmd/Ctrl + Shift + P - Toggle Writing Partner Panel (screenplay only)
      if (isMod && e.shiftKey && e.key === 'P') {
        if (currentProject?.templateId === 'screenplay') {
          e.preventDefault()
          toggleWritingPartnerPanel()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeDocumentId,
    saveDocument,
    createDocument,
    toggleLeftSidebar,
    toggleRightSidebar,
    runBuild,
    zoomIn,
    zoomOut,
    resetZoom,
    // Storyboard dependencies
    isStoryboardActive,
    storyboardUI.linkMode.active,
    togglePlayback,
    nextShot,
    prevShot,
    cancelLinkMode,
    // Writing Partner
    currentProject?.templateId,
    toggleWritingPartnerPanel
  ])
}
