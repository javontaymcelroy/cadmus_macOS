import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { ChevronDownRegular, PlayFilled, HistoryRegular, DocumentSyncRegular, BroomRegular, DocumentOnePageRegular, TagSearchRegular } from '@fluentui/react-icons'
import { useProjectStore } from '../../../stores/projectStore'

export function RunBuildButton() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  
  const { 
    ui, 
    runBuild,
    runBuildCurrentPage,
    regenerateAssetDocs,
    regenerateAssetDocsCurrentPage,
    removeBlankBlocks,
    scanForMentions,
    activeDocumentId, 
    documentVersions, 
    loadVersions,
    setVersionHistoryMode,
    currentProject
  } = useProjectStore()
  
  // Check if project is screenplay (has characters/props)
  const isScreenplay = currentProject?.templateId === 'screenplay'
  
  // Get version count for current document
  const versions = activeDocumentId ? documentVersions[activeDocumentId] || [] : []
  const hasVersions = versions.length > 0
  
  // Load versions when document changes
  useEffect(() => {
    if (activeDocumentId) {
      loadVersions(activeDocumentId)
    }
  }, [activeDocumentId, loadVersions])

  const handleRunBuild = useCallback(() => {
    if (!ui.isBuilding) {
      runBuild()
    }
  }, [ui.isBuilding, runBuild])

  const handleViewHistory = useCallback(() => {
    setIsDropdownOpen(false)
    if (hasVersions) {
      // Open version history mode with the most recent version selected
      setVersionHistoryMode(true, versions[0]?.id || null)
    }
  }, [hasVersions, versions, setVersionHistoryMode])

  const handleRegenerateAssetDocs = useCallback(() => {
    setIsDropdownOpen(false)
    if (!ui.isBuilding) {
      regenerateAssetDocs()
    }
  }, [ui.isBuilding, regenerateAssetDocs])

  const handleRegenerateAssetDocsCurrentPage = useCallback(() => {
    setIsDropdownOpen(false)
    if (!ui.isBuilding && activeDocumentId) {
      regenerateAssetDocsCurrentPage()
    }
  }, [ui.isBuilding, activeDocumentId, regenerateAssetDocsCurrentPage])

  const handleRemoveBlankBlocks = useCallback(() => {
    setIsDropdownOpen(false)
    removeBlankBlocks()
  }, [removeBlankBlocks])

  const handleRunBuildCurrentPage = useCallback(() => {
    setIsDropdownOpen(false)
    if (!ui.isBuilding && activeDocumentId) {
      runBuildCurrentPage()
    }
  }, [ui.isBuilding, activeDocumentId, runBuildCurrentPage])

  const handleScanForMentions = useCallback(() => {
    setIsDropdownOpen(false)
    if (!ui.isBuilding) {
      scanForMentions()
    }
  }, [ui.isBuilding, scanForMentions])

  // Update dropdown position when opened
  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.right - 200 // Right-align dropdown
      })
    }
  }, [isDropdownOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={buttonRef} className="flex items-stretch rounded-md overflow-hidden h-8 shrink-0">
      {/* Main Run Build button */}
      <button 
        onClick={handleRunBuild} 
        disabled={ui.isBuilding}
        className={clsx(
          "flex items-center gap-2 px-3 text-sm font-medium transition-colors whitespace-nowrap",
          "bg-gold-500 text-ink-900 hover:bg-gold-400",
          ui.isBuilding && "opacity-50 cursor-not-allowed"
        )}
      >
        <PlayFilled className="w-4 h-4" />
        {ui.isBuilding ? 'Building...' : 'Run Build'}
      </button>
      
      {/* Divider */}
      <div className="w-px bg-gold-600/40" />
      
      {/* Dropdown toggle */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className={clsx(
          "flex items-center px-2 text-sm font-medium transition-colors",
          "bg-gold-500 text-ink-900 hover:bg-gold-400",
          isDropdownOpen && "bg-gold-400"
        )}
      >
        <ChevronDownRegular className={clsx("w-4 h-4 transition-transform", isDropdownOpen && "rotate-180")} />
      </button>
      
      {/* Dropdown menu */}
      {isDropdownOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed bg-theme-elevated border border-theme-default rounded-lg shadow-xl z-[9999] py-1 min-w-[200px]"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {/* Run Build on Current Page */}
          <button
            onClick={handleRunBuildCurrentPage}
            disabled={ui.isBuilding || !activeDocumentId}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
              !ui.isBuilding && activeDocumentId
                ? "text-theme-primary hover:bg-theme-hover" 
                : "text-theme-muted cursor-not-allowed"
            )}
          >
            <DocumentOnePageRegular className="w-4 h-4" />
            <span>Run Build on Current Page</span>
          </button>
          
          {/* Update Asset Docs - only for screenplay projects */}
          {isScreenplay && (
            <button
              onClick={handleRegenerateAssetDocs}
              disabled={ui.isBuilding}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                !ui.isBuilding 
                  ? "text-theme-primary hover:bg-theme-hover" 
                  : "text-theme-muted cursor-not-allowed"
              )}
            >
              <DocumentSyncRegular className="w-4 h-4" />
              <span>Update Asset Docs</span>
            </button>
          )}
          
          {/* Update Asset Docs on Current Page - only for screenplay projects */}
          {isScreenplay && (
            <button
              onClick={handleRegenerateAssetDocsCurrentPage}
              disabled={ui.isBuilding || !activeDocumentId}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                !ui.isBuilding && activeDocumentId
                  ? "text-theme-primary hover:bg-theme-hover" 
                  : "text-theme-muted cursor-not-allowed"
              )}
            >
              <DocumentOnePageRegular className="w-4 h-4" />
              <span>Update Asset Docs on Current Page</span>
            </button>
          )}
          
          {/* Scan for Mentions - only for screenplay projects */}
          {isScreenplay && (
            <button
              onClick={handleScanForMentions}
              disabled={ui.isBuilding}
              className={clsx(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                !ui.isBuilding 
                  ? "text-theme-primary hover:bg-theme-hover" 
                  : "text-theme-muted cursor-not-allowed"
              )}
            >
              <TagSearchRegular className="w-4 h-4" />
              <span>Scan for Mentions</span>
            </button>
          )}
          
          <button
            onClick={handleViewHistory}
            disabled={!hasVersions}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
              hasVersions 
                ? "text-theme-primary hover:bg-theme-hover" 
                : "text-theme-muted cursor-not-allowed"
            )}
          >
            <HistoryRegular className="w-4 h-4" />
            <span>View Version History</span>
            {hasVersions && (
              <span className="ml-auto text-xs text-theme-muted bg-theme-active px-1.5 py-0.5 rounded">
                {versions.length}
              </span>
            )}
          </button>
          
          {/* Divider */}
          <div className="h-px bg-theme-subtle mx-2 my-1" />
          
          {/* Clean up - delete blank blocks */}
          <button
            onClick={handleRemoveBlankBlocks}
            disabled={!activeDocumentId}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
              activeDocumentId 
                ? "text-theme-primary hover:bg-theme-hover" 
                : "text-theme-muted cursor-not-allowed"
            )}
          >
            <BroomRegular className="w-4 h-4" />
            <span>Clean Up</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
