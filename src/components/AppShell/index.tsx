import { useProjectStore } from '../../stores/projectStore'
import { ProjectExplorer } from '../ProjectExplorer'
import { WorkspaceRouter } from '../../workspaces'
import { AssetsPanel } from '../AssetsPanel'
import { StickersPanel } from '../StickersPanel'
import { CharactersPanel } from '../CharactersPanel'
import { PropsPanel } from '../PropsPanel'
import { WebLinksPanel } from '../WebLinksPanel'
import { ProblemsPanel } from '../ProblemsPanel'
import { ProjectSettingsPanel } from '../ProjectSettingsPanel'
import { StatusBar } from './StatusBar'
import { useWorkspace } from '../../workspaces'
import { clsx } from 'clsx'
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ArrowLeftRegular,
  PanelLeftRegular,
  PanelRightRegular,
  WeatherSunnyRegular,
  WeatherMoonRegular
} from '@fluentui/react-icons'

type RightSidebarTab = 'assets' | 'stickers' | 'characters' | 'props'

// Min/max constraints for panels
const MIN_PANEL_HEIGHT = 150
const MAX_PANEL_HEIGHT_RATIO = 0.6 // 60% of viewport
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 500
const FLOATING_PANEL_GAP = 8 // Gap between floating panels

type ResizeTarget = 'bottom' | 'left' | 'right' | null

export function AppShell() {
  const { 
    currentProject, 
    ui,
    toggleLeftSidebar, 
    toggleRightSidebar,
    toggleTheme,
    setBottomPanelHeight,
    setLeftSidebarWidth,
    setRightSidebarWidth,
    closeProject
  } = useProjectStore()

  // Resize state - tracks which panel is being resized
  const [resizeTarget, setResizeTarget] = useState<ResizeTarget>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Right sidebar tab state
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('assets')
  
  // Get workspace configuration
  const { showCharactersPanel } = useWorkspace()

  // Handle mouse move during resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizeTarget || !containerRef.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    
    if (resizeTarget === 'bottom') {
      // Account for status bar height (28px) and bottom padding
      const maxHeight = containerRect.height * MAX_PANEL_HEIGHT_RATIO
      const newHeight = containerRect.bottom - e.clientY - FLOATING_PANEL_GAP - 28
      const clampedHeight = Math.min(Math.max(newHeight, MIN_PANEL_HEIGHT), maxHeight)
      setBottomPanelHeight(clampedHeight)
    } else if (resizeTarget === 'left') {
      // Account for left padding in floating layout
      const newWidth = e.clientX - containerRect.left - FLOATING_PANEL_GAP
      const clampedWidth = Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH)
      setLeftSidebarWidth(clampedWidth)
    } else if (resizeTarget === 'right') {
      // Account for right padding in floating layout
      const newWidth = containerRect.right - e.clientX - FLOATING_PANEL_GAP
      const clampedWidth = Math.min(Math.max(newWidth, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH)
      setRightSidebarWidth(clampedWidth)
    }
  }, [resizeTarget, setBottomPanelHeight, setLeftSidebarWidth, setRightSidebarWidth])

  // Handle mouse up to end resize
  const handleMouseUp = useCallback(() => {
    setResizeTarget(null)
  }, [])

  // Attach/detach global mouse listeners during resize
  useEffect(() => {
    if (resizeTarget) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = resizeTarget === 'bottom' ? 'ns-resize' : 'ew-resize'
      document.body.style.userSelect = 'none'
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizeTarget, handleMouseMove, handleMouseUp])

  // Start resize on mouse down
  const handleResizeStart = useCallback((target: ResizeTarget) => (e: React.MouseEvent) => {
    e.preventDefault()
    setResizeTarget(target)
  }, [])

  if (!currentProject) return null

  return (
    <div ref={containerRef} className="floating-layout">
      {/* Title bar / Toolbar */}
      <div className="h-12 flex items-center justify-between px-4 toolbar-floating titlebar-drag-region">
        {/* Left controls */}
        <div className="flex items-center gap-1 titlebar-no-drag">
          {/* macOS traffic lights space */}
          <div className="w-16" />
          
          {/* Back to projects */}
          <button
            onClick={closeProject}
            className="btn-icon-modern"
            title="Back to Projects"
          >
            <ArrowLeftRegular className="w-4 h-4" />
          </button>
          
          {/* Toggle left sidebar */}
          <button
            onClick={toggleLeftSidebar}
            className={clsx(
              'btn-icon-modern',
              ui.leftSidebarOpen && 'active'
            )}
            title="Toggle Project Explorer"
          >
            <PanelLeftRegular className="w-4 h-4" />
          </button>
        </div>

        {/* Center - Project name */}
        <div className="flex items-center gap-3 titlebar-no-drag">
          <span className="text-sm font-ui font-medium text-theme-primary">
            {currentProject.name}
          </span>
          <span className="badge-modern">
            {currentProject.templateId.replace(/-/g, ' ')}
          </span>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1 titlebar-no-drag">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="btn-icon-modern"
            title={ui.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {ui.theme === 'dark' ? (
              <WeatherSunnyRegular className="w-4 h-4" />
            ) : (
              <WeatherMoonRegular className="w-4 h-4" />
            )}
          </button>
          
          {/* Toggle right sidebar */}
          <button
            onClick={toggleRightSidebar}
            className={clsx(
              'btn-icon-modern',
              ui.rightSidebarOpen && 'active'
            )}
            title="Toggle Assets Panel"
          >
            <PanelRightRegular className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content area with floating panels */}
      <div className="floating-content">
        {/* Left sidebar - Project Explorer (Floating) */}
        {ui.leftSidebarOpen && (
          <>
            <div
              className="sidebar-transition panel-floating overflow-hidden flex flex-col flex-shrink-0"
              style={{ width: ui.leftSidebarWidth }}
            >
              <ProjectExplorer />
            </div>

            {/* Left sidebar resize handle - in gap */}
            <div
              onMouseDown={handleResizeStart('left')}
              className={clsx(
                'w-2 -mx-1 cursor-ew-resize flex-shrink-0 resize-handle-floating horizontal',
                resizeTarget === 'left' && 'active'
              )}
            />
          </>
        )}

        {/* Editor area - subtle background, not a floating card */}
        <div className="floating-editor-area">
          {ui.settingsPanelOpen ? <ProjectSettingsPanel /> : <WorkspaceRouter />}
        </div>

        {/* Right sidebar - Assets/Characters Panel + Web Links Panel (Floating) */}
        {ui.rightSidebarOpen && (
          <>
            {/* Right sidebar resize handle - in gap */}
            <div
              onMouseDown={handleResizeStart('right')}
              className={clsx(
                'w-2 -mx-1 cursor-ew-resize flex-shrink-0 resize-handle-floating horizontal',
                resizeTarget === 'right' && 'active'
              )}
            />

            <div
              className="sidebar-transition panel-floating overflow-hidden flex flex-col flex-shrink-0"
              style={{ width: ui.rightSidebarWidth }}
            >
              {/* Tab navigation - only show when characters panel is enabled */}
              {showCharactersPanel && (
                <div className="flex gap-4 px-4 py-3 border-b border-theme-subtle bg-theme-header">
                  <button
                    onClick={() => setRightSidebarTab('assets')}
                    className={clsx(
                      'px-2 py-1 text-xs font-ui font-medium uppercase tracking-wider transition-colors',
                      rightSidebarTab === 'assets'
                        ? 'text-theme-accent'
                        : 'text-theme-muted hover:text-theme-accent'
                    )}
                  >
                    Assets
                  </button>
                  <button
                    onClick={() => setRightSidebarTab('characters')}
                    className={clsx(
                      'px-2 py-1 text-xs font-ui font-medium uppercase tracking-wider transition-colors',
                      rightSidebarTab === 'characters'
                        ? 'text-theme-accent'
                        : 'text-theme-muted hover:text-theme-accent'
                    )}
                  >
                    Characters
                  </button>
                  <button
                    onClick={() => setRightSidebarTab('props')}
                    className={clsx(
                      'px-2 py-1 text-xs font-ui font-medium uppercase tracking-wider transition-colors',
                      rightSidebarTab === 'props'
                        ? 'text-theme-accent'
                        : 'text-theme-muted hover:text-theme-accent'
                    )}
                  >
                    Props
                  </button>
                </div>
              )}
              
              {/* Panel content */}
              {currentProject.templateId === 'notes-journal' ? (
                // Stickers panel takes full height for NotesJournal (no WebLinks)
                <div className="flex-1 min-h-0 overflow-hidden">
                  <StickersPanel />
                </div>
              ) : (
                <>
                  {/* Panel content - takes 60% */}
                  <div className="flex-[3] min-h-0 overflow-hidden border-b border-theme-subtle">
                    {showCharactersPanel && rightSidebarTab === 'characters' ? (
                      <CharactersPanel />
                    ) : showCharactersPanel && rightSidebarTab === 'props' ? (
                      <PropsPanel />
                    ) : (
                      <AssetsPanel />
                    )}
                  </div>
                  {/* Web Links Panel - takes 40% */}
                  <div className="flex-[2] min-h-0 overflow-hidden">
                    <WebLinksPanel />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom panel - Problems (Floating) */}
      {ui.bottomPanelOpen && (
        <div className="floating-bottom-wrapper">
          {/* Resize handle - above the panel */}
          <div
            onMouseDown={handleResizeStart('bottom')}
            className={clsx(
              'h-2 -mb-1 cursor-ns-resize resize-handle-floating vertical',
              resizeTarget === 'bottom' && 'active'
            )}
          />
          <div
            className="panel-floating overflow-hidden"
            style={{ height: ui.bottomPanelHeight }}
          >
            <ProblemsPanel />
          </div>
        </div>
      )}

      {/* Status bar */}
      <StatusBar />
    </div>
  )
}
