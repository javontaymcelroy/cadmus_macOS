import { useProjectStore, getDocumentHierarchyType } from '../../stores/projectStore'
import { useWorkspace } from '../../workspaces'

export function StatusBar() {
  const { 
    currentProject, 
    activeDocumentId, 
    documents, 
    lastBuildResult,
    ui,
    zoomIn,
    zoomOut,
    setViewZoom
  } = useProjectStore()
  
  // Get workspace configuration
  const { showStatusBarRuntime } = useWorkspace()

  if (!currentProject) return null

  const activeDoc = currentProject.documents.find(d => d.id === activeDocumentId)
  const docState = activeDocumentId ? documents[activeDocumentId] : null

  // Calculate word count from plain text (simplified)
  const getWordCount = (): number => {
    if (!docState?.content) return 0
    
    const extractText = (node: any): string => {
      if (node.text) return node.text
      if (node.content) {
        return node.content.map(extractText).join(' ')
      }
      return ''
    }
    
    const text = extractText(docState.content)
    return text.split(/\s+/).filter(word => word.length > 0).length
  }

  // Check if document content starts with a scene-heading element
  const isScenePage = (content: any): boolean => {
    if (!content?.content) return false
    
    // Find the first meaningful content node
    for (const node of content.content) {
      // Skip empty paragraphs
      if (node.type === 'paragraph' && (!node.content || node.content.length === 0)) {
        continue
      }
      // Check if it's a screenplay element with scene-heading type
      if (node.type === 'screenplayElement' && node.attrs?.elementType === 'scene-heading') {
        return true
      }
      // If first non-empty node is not a scene-heading, it's not a scene page
      return false
    }
    return false
  }

  // Calculate screenplay runtime estimate (only when enabled in workspace config)
  // Rule: 1 page = ~1 minute of screen time
  // Only count scene pages (pages with scene-heading), not breaks, title pages, or notes
  const getScreenplayRuntime = (): number => {
    if (!showStatusBarRuntime) return 0
    
    let scenePageCount = 0
    
    for (const doc of currentProject.documents) {
      // Check if this is a "page" in the hierarchy (child of top-level document)
      const hierarchyType = getDocumentHierarchyType(doc, currentProject.documents)
      if (hierarchyType !== 'page') continue
      
      // Check if this document's content starts with a scene-heading
      const docContent = documents[doc.id]?.content
      if (docContent && isScenePage(docContent)) {
        scenePageCount++
      }
    }
    
    return scenePageCount
  }

  // Format runtime for display
  const formatRuntime = (minutes: number): string => {
    if (minutes === 0) return '0 min'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  const wordCount = getWordCount()
  const screenplayRuntime = showStatusBarRuntime ? getScreenplayRuntime() : 0

  return (
    <div className="h-7 flex items-center justify-between px-4 mb-3 statusbar-floating text-xs font-ui">
      {/* Left side */}
      <div className="flex items-center gap-4 text-theme-muted">
        {activeDoc && (
          <>
            <span className="flex items-center gap-1.5">
              <span className={docState?.isDirty ? 'text-theme-accent' : 'text-green-500'}>
                ●
              </span>
              <span className={docState?.isDirty ? 'text-theme-secondary' : 'text-theme-muted'}>
                {docState?.isDirty ? 'Unsaved' : 'Saved'}
              </span>
            </span>
            <span>{wordCount.toLocaleString()} words</span>
          </>
        )}
        {/* Screenplay runtime estimate - only shown when enabled */}
        {showStatusBarRuntime && (
          <span className="text-theme-primary">
            Estimated film runtime: {formatRuntime(screenplayRuntime)}
          </span>
        )}
      </div>

      {/* Center */}
      <div className="flex items-center gap-2 text-theme-muted">
        {ui.isBuilding && (
          <span className="flex items-center gap-1.5 text-theme-accent">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Building...
          </span>
        )}
        {lastBuildResult && !ui.isBuilding && (
          <span className={lastBuildResult.success ? 'text-green-500' : 'text-red-500'}>
            {lastBuildResult.success ? '✓ Build successful' : '✗ Build failed'}
            {lastBuildResult.diagnostics.length > 0 && (
              <span className="ml-2 text-theme-muted">
                ({lastBuildResult.diagnostics.length} issues)
              </span>
            )}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 text-theme-muted">
        <span>
          {currentProject.documents.filter(d => d.type === 'document').length} docs
        </span>
        <span>
          {currentProject.assets.length} assets
        </span>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-1.5 ml-2 border-l border-theme-default pl-3">
          <button
            onClick={zoomOut}
            disabled={ui.viewZoom <= 50}
            className="p-1.5 rounded hover:bg-theme-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-theme-secondary hover:text-theme-primary"
            title="Zoom Out (⌘-)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <button
            onClick={() => setViewZoom(100)}
            className="px-2 py-1 rounded hover:bg-theme-hover transition-colors min-w-[48px] text-center text-theme-secondary hover:text-theme-primary"
            title="Reset Zoom (⌘0)"
          >
            <span className="text-xs font-medium">{ui.viewZoom}%</span>
          </button>
          <button
            onClick={zoomIn}
            disabled={ui.viewZoom >= 200}
            className="p-1.5 rounded hover:bg-theme-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-theme-secondary hover:text-theme-primary"
            title="Zoom In (⌘+)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
