import { useState, useMemo, useRef, useEffect } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import type { Diagnostic, DiagnosticSeverity } from '../../types/project'
import {
  ErrorCircleRegular,
  WarningRegular,
  InfoRegular,
  FilterRegular,
  ChevronDownRegular,
  DismissRegular,
  ArrowSyncRegular,
  CheckmarkCircleRegular,
  WrenchRegular,
  LocationRegular,
  MoreHorizontalRegular,
  CheckboxCheckedRegular,
  PanelBottomRegular,
  SparkleRegular
} from '@fluentui/react-icons'
import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MenuDivider,
  FluentProvider,
  createDarkTheme
} from '@fluentui/react-components'

const darkTheme = createDarkTheme({
  10: '#050505',
  20: '#1a1a1a',
  30: '#252525',
  40: '#333333',
  50: '#404040',
  60: '#4d4d4d',
  70: '#666666',
  80: '#808080',
  90: '#999999',
  100: '#b3b3b3',
  110: '#cccccc',
  120: '#e6e6e6',
  130: '#f2f2f2',
  140: '#fafafa',
  150: '#ffffff',
  160: '#ffffff',
})

// Pass display names
const PASS_NAMES: Record<string, string> = {
  'formatting-lint': 'Formatting',
  'spelling-grammar': 'Spelling & Grammar',
  'citation': 'Citations',
  'system': 'System',
  'ai-suggestions': 'AI Suggestions'
}

// Severity icons and colors
const severityConfig: Record<DiagnosticSeverity, { icon: React.ReactNode; color: string; bgColor: string }> = {
  error: {
    icon: <ErrorCircleRegular className="w-4 h-4" />,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10'
  },
  warning: {
    icon: <WarningRegular className="w-4 h-4" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10'
  },
  info: {
    icon: <InfoRegular className="w-4 h-4" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10'
  }
}

interface DiagnosticItemProps {
  diagnostic: Diagnostic
  documentTitle: string
  onNavigate: () => void
  onApplyFix?: () => void
  onDismiss: () => void
}

// Helper to render context snippet with highlighted issue
function ContextSnippet({ context, severity }: { context: { text: string; offset: number; length: number }; severity: DiagnosticSeverity }) {
  const before = context.text.slice(0, context.offset)
  const issue = context.text.slice(context.offset, context.offset + context.length)
  const after = context.text.slice(context.offset + context.length)
  
  const highlightColor = {
    error: 'text-red-400/90 bg-red-400/15',
    warning: 'text-amber-400/90 bg-amber-400/15',
    info: 'text-blue-400/90 bg-blue-400/15'
  }[severity]
  
  return (
    <code className="text-xs text-white/30 font-mono block truncate">
      <span className="text-white/25">{before}</span>
      <span className={clsx('font-semibold rounded px-0.5', highlightColor)}>{issue}</span>
      <span className="text-white/25">{after}</span>
    </code>
  )
}

function DiagnosticItem({ diagnostic, documentTitle, onNavigate, onApplyFix, onDismiss }: DiagnosticItemProps) {
  const config = severityConfig[diagnostic.severity]
  const passName = PASS_NAMES[diagnostic.passId] || diagnostic.passId
  const hasFix = diagnostic.suggestions && diagnostic.suggestions.length > 0 && diagnostic.suggestions[0].replacement
  const hasRange = diagnostic.range && diagnostic.range.from !== undefined
  const isAISuggestion = diagnostic.passId === 'ai-suggestions'

  // Build enhanced title with issue text and suggestion
  const issueText = diagnostic.context 
    ? diagnostic.context.text.slice(diagnostic.context.offset, diagnostic.context.offset + diagnostic.context.length)
    : null
  const suggestionText = diagnostic.suggestions?.[0]?.replacement
  
  const enhancedTitle = issueText && suggestionText
    ? `${diagnostic.title}: "${issueText}" → "${suggestionText}"`
    : diagnostic.title

  return (
    <div
      className="px-3 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-all duration-200 group"
      onClick={onNavigate}
    >
      <div className="flex items-center gap-3">
        {/* Severity icon */}
        <span className={clsx('shrink-0 opacity-80', config.color)}>
          {config.icon}
        </span>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and pass */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white/80 truncate group-hover:text-white/90 transition-colors">
              {enhancedTitle}
            </span>
            <span className={clsx(
              'text-[10px] font-ui shrink-0 uppercase tracking-wide flex items-center gap-1',
              isAISuggestion ? 'text-purple-400/70' : 'text-white/25'
            )}>
              {isAISuggestion && <SparkleRegular className="w-3 h-3" />}
              {passName}
            </span>
          </div>
          
          {/* Context snippet - show the actual problematic text */}
          {diagnostic.context ? (
            <div className="mb-1.5">
              <ContextSnippet context={diagnostic.context} severity={diagnostic.severity} />
            </div>
          ) : (
            /* Fallback to message if no context */
            <p className="text-xs text-white/40 line-clamp-1 mb-1">
              {diagnostic.message}
            </p>
          )}
          
          {/* Location */}
          <span className="text-[11px] text-white/30 font-ui">
            {documentTitle}
          </span>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Go to issue button - show when has location */}
          {hasRange && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNavigate()
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-ui font-medium text-white/50 bg-white/[0.04] border border-white/[0.06] rounded-lg hover:bg-white/[0.06] hover:text-white/70 transition-all duration-200"
              title="Go to issue location"
            >
              <LocationRegular className="w-4 h-4" />
              Go to
            </button>
          )}
          
          {/* Quick fix button */}
          {hasFix && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onApplyFix?.()
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-ui font-medium text-gold-400/90 bg-gold-400/10 border border-gold-400/20 rounded-lg hover:bg-gold-400/15 hover:text-gold-400 hover:border-gold-400/30 transition-all duration-200"
              title={diagnostic.suggestions![0].label}
            >
              <WrenchRegular className="w-4 h-4" />
              Fix
            </button>
          )}
          
          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
            className="p-2 text-white/30 hover:text-white/60 hover:bg-white/[0.04] rounded-lg transition-all duration-200"
            title="Dismiss this issue"
          >
            <DismissRegular className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

type FilterTab = 'all' | 'error' | 'warning' | 'info'

export function ProblemsPanel() {
  const {
    currentProject,
    diagnostics,
    lastBuildResult,
    ui,
    runBuild,
    setActiveDocument,
    navigateToRange,
    requestFix,
    startBatchFix,
    toggleBottomPanel,
    removeDiagnostic
  } = useProjectStore()

  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [filterPass, setFilterPass] = useState<string | null>(null)
  const [showPassDropdown, setShowPassDropdown] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)

  // Detect header overflow based on width
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width
      setShowOverflow(width < 280)
    })
    
    if (headerRef.current) {
      observer.observe(headerRef.current)
    }
    
    return () => observer.disconnect()
  }, [])

  // Get document title by ID
  const getDocumentTitle = (docId: string): string => {
    if (!docId) return 'Project'
    const doc = currentProject?.documents.find(d => d.id === docId)
    return doc?.title || 'Unknown Document'
  }

  // Get unique passes from diagnostics
  const uniquePasses = useMemo(() => {
    const passes = new Set(diagnostics.map(d => d.passId))
    return Array.from(passes)
  }, [diagnostics])

  // Filter diagnostics
  const filteredDiagnostics = useMemo(() => {
    return diagnostics.filter(d => {
      // Filter by severity tab
      if (filterTab !== 'all' && d.severity !== filterTab) {
        return false
      }
      // Filter by pass
      if (filterPass && d.passId !== filterPass) {
        return false
      }
      return true
    })
  }, [diagnostics, filterTab, filterPass])

  // Count by severity
  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 }
    for (const d of diagnostics) {
      c[d.severity]++
    }
    return c
  }, [diagnostics])

  // Handle navigate to diagnostic
  const handleNavigate = (diagnostic: Diagnostic) => {
    if (!diagnostic.documentId) return
    
    // If there's a range, use navigateToRange to scroll to it
    if (diagnostic.range) {
      navigateToRange(diagnostic.documentId, diagnostic.range)
    } else {
      // Just switch to the document
      setActiveDocument(diagnostic.documentId)
    }
  }

  // Handle apply fix - request the fix to be shown in the editor
  const handleApplyFix = (diagnostic: Diagnostic) => {
    if (diagnostic.suggestions?.[0]?.replacement && diagnostic.range) {
      requestFix(diagnostic)
    }
  }

  // Get all fixable diagnostics
  const fixableDiagnostics = useMemo(() => {
    return diagnostics.filter(d => 
      d.suggestions && d.suggestions.length > 0 && d.suggestions[0].replacement && d.range
    )
  }, [diagnostics])

  // Resolve all fixable diagnostics - enters batch fix mode
  const handleResolveAll = () => {
    startBatchFix(fixableDiagnostics)
  }

  if (!currentProject) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div ref={headerRef} className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-white/40">
          Build Issues
        </h2>
        
        <div className="flex items-center gap-1">
          {/* Buttons shown when not overflowing */}
          {!showOverflow && (
            <>
              {/* Resolve All button */}
              {fixableDiagnostics.length > 0 && (
                <button
                  onClick={handleResolveAll}
                  className="btn-icon-modern p-1.5"
                  title={`Resolve All (${fixableDiagnostics.length} fixes)`}
                >
                  <CheckboxCheckedRegular className="w-4 h-4" />
                </button>
              )}
              
              {/* Toggle/Collapse Panel button */}
              <button
                onClick={toggleBottomPanel}
                className="btn-icon-modern p-1.5"
                title="Close Problems Panel (⌘⇧M)"
              >
                <PanelBottomRegular className="w-4 h-4" />
              </button>
              
              {/* Run Build button */}
              <button
                onClick={() => runBuild()}
                disabled={ui.isBuilding}
                className={clsx(
                  'btn-icon-modern p-1.5',
                  ui.isBuilding && 'opacity-40 cursor-not-allowed'
                )}
                title="Run Build (⌘⇧B)"
              >
                <ArrowSyncRegular className={clsx('w-4 h-4', ui.isBuilding && 'animate-spin')} />
              </button>
              
              {/* Clear button */}
              {diagnostics.length > 0 && (
                <button
                  onClick={() => useProjectStore.getState().clearDiagnostics()}
                  className="btn-icon-modern p-1.5"
                  title="Clear Problems"
                >
                  <DismissRegular className="w-4 h-4" />
                </button>
              )}
            </>
          )}
          
          {/* Overflow menu for narrow screens */}
          {showOverflow && (
            <FluentProvider theme={darkTheme} style={{ background: 'transparent' }}>
              <Menu
                open={overflowMenuOpen}
                onOpenChange={(_, data) => setOverflowMenuOpen(data.open)}
                positioning="below-end"
              >
                <MenuTrigger disableButtonEnhancement>
                  <button
                    className="btn-icon-modern p-1.5"
                    title="More actions"
                  >
                    <MoreHorizontalRegular className="w-4 h-4" />
                  </button>
                </MenuTrigger>
                <MenuPopover style={{ 
                  background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(18, 18, 18, 0.99) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.08)', 
                  borderRadius: '12px',
                  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05), 0 4px 24px rgba(0, 0, 0, 0.5)'
                }}>
                  <MenuList style={{ backgroundColor: 'transparent' }}>
                    {fixableDiagnostics.length > 0 && (
                      <MenuItem
                        icon={<CheckboxCheckedRegular />}
                        onClick={() => {
                          handleResolveAll()
                          setOverflowMenuOpen(false)
                        }}
                        style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.8)' }}
                      >
                        Resolve All ({fixableDiagnostics.length})
                      </MenuItem>
                    )}
                    <MenuItem
                      icon={<PanelBottomRegular />}
                      onClick={() => {
                        toggleBottomPanel()
                        setOverflowMenuOpen(false)
                      }}
                      style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.8)' }}
                    >
                      Close Panel
                    </MenuItem>
                    <MenuItem
                      icon={<ArrowSyncRegular />}
                      onClick={() => {
                        runBuild()
                        setOverflowMenuOpen(false)
                      }}
                      disabled={ui.isBuilding}
                      style={{ backgroundColor: 'transparent', color: 'rgba(251, 191, 36, 0.8)' }}
                    >
                      Run Build
                    </MenuItem>
                    {diagnostics.length > 0 && (
                      <>
                        <MenuDivider />
                        <MenuItem
                          icon={<DismissRegular />}
                          onClick={() => {
                            useProjectStore.getState().clearDiagnostics()
                            setOverflowMenuOpen(false)
                          }}
                          style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.8)' }}
                        >
                          Clear All
                        </MenuItem>
                      </>
                    )}
                  </MenuList>
                </MenuPopover>
              </Menu>
            </FluentProvider>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.03]">
        <button
          onClick={() => setFilterTab('all')}
          className={clsx(
            'tab-modern',
            filterTab === 'all' && 'active'
          )}
        >
          All ({diagnostics.length})
        </button>
        <button
          onClick={() => setFilterTab('error')}
          className={clsx(
            'tab-modern flex items-center gap-1',
            filterTab === 'error' 
              ? 'bg-red-400/15 text-red-400/90' 
              : 'hover:text-red-400/70 hover:bg-red-400/10'
          )}
        >
          <ErrorCircleRegular className="w-3 h-3" />
          {counts.error}
        </button>
        <button
          onClick={() => setFilterTab('warning')}
          className={clsx(
            'tab-modern flex items-center gap-1',
            filterTab === 'warning' 
              ? 'bg-amber-400/15 text-amber-400/90' 
              : 'hover:text-amber-400/70 hover:bg-amber-400/10'
          )}
        >
          <WarningRegular className="w-3 h-3" />
          {counts.warning}
        </button>
        <button
          onClick={() => setFilterTab('info')}
          className={clsx(
            'tab-modern flex items-center gap-1',
            filterTab === 'info' 
              ? 'bg-blue-400/15 text-blue-400/90' 
              : 'hover:text-blue-400/70 hover:bg-blue-400/10'
          )}
        >
          <InfoRegular className="w-3 h-3" />
          {counts.info}
        </button>

        {/* Pass filter dropdown */}
        {uniquePasses.length > 1 && (
          <div className="relative ml-auto">
            <button
              onClick={() => setShowPassDropdown(!showPassDropdown)}
              className={clsx(
                'tab-modern flex items-center gap-1',
                filterPass && 'bg-gold-400/15 text-gold-400/90'
              )}
            >
              <FilterRegular className="w-3 h-3" />
              {filterPass ? PASS_NAMES[filterPass] || filterPass : 'Filter'}
              <ChevronDownRegular className="w-3 h-3" />
            </button>
            
            {showPassDropdown && (
              <div className="menu-modern absolute right-0 top-full mt-1 z-50 py-1.5 min-w-[140px]">
                <button
                  onClick={() => {
                    setFilterPass(null)
                    setShowPassDropdown(false)
                  }}
                  className={clsx(
                    'menu-modern-item w-full px-3 py-1.5 text-left text-xs font-ui',
                    !filterPass ? 'text-gold-400/90' : 'text-white/70'
                  )}
                >
                  All Passes
                </button>
                {uniquePasses.map(passId => (
                  <button
                    key={passId}
                    onClick={() => {
                      setFilterPass(passId)
                      setShowPassDropdown(false)
                    }}
                    className={clsx(
                      'menu-modern-item w-full px-3 py-1.5 text-left text-xs font-ui',
                      filterPass === passId ? 'text-gold-400/90' : 'text-white/70'
                    )}
                  >
                    {PASS_NAMES[passId] || passId}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Build status banner */}
      {lastBuildResult && !ui.isBuilding && (
        <div className={clsx(
          'px-3 py-2 text-xs font-ui flex items-center gap-2 border-b border-white/[0.03]',
          lastBuildResult.success ? 'bg-green-500/8 text-green-400/80' : 'bg-red-500/8 text-red-400/80'
        )}>
          {lastBuildResult.success ? (
            <CheckmarkCircleRegular className="w-4 h-4" />
          ) : (
            <ErrorCircleRegular className="w-4 h-4" />
          )}
          <span>
            {lastBuildResult.success ? 'Build completed' : 'Build completed with issues'}
          </span>
          <span className="text-white/25 ml-auto">
            {lastBuildResult.totalTiming}ms
          </span>
        </div>
      )}

      {/* Building indicator */}
      {ui.isBuilding && (
        <div className="px-3 py-2 text-xs font-ui flex items-center gap-2 border-b border-white/[0.03] bg-gold-400/8 text-gold-400/80">
          <ArrowSyncRegular className="w-4 h-4 animate-spin" />
          <span>Building...</span>
        </div>
      )}

      {/* Diagnostics list */}
      <div className="flex-1 overflow-auto">
        {filteredDiagnostics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {diagnostics.length === 0 ? (
              <>
                <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
                  <CheckmarkCircleRegular className="w-6 h-6 text-white/20" />
                </div>
                <p className="text-sm text-white/40 font-ui mb-1">No problems detected</p>
                <p className="text-xs text-white/25 font-ui">
                  Run a build to check your documents
                </p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center mb-3">
                  <FilterRegular className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-sm text-white/40 font-ui">
                  No matching problems
                </p>
              </>
            )}
          </div>
        ) : (
          filteredDiagnostics.map(diagnostic => (
            <DiagnosticItem
              key={diagnostic.id}
              diagnostic={diagnostic}
              documentTitle={getDocumentTitle(diagnostic.documentId)}
              onNavigate={() => handleNavigate(diagnostic)}
              onApplyFix={() => handleApplyFix(diagnostic)}
              onDismiss={() => removeDiagnostic(diagnostic.id)}
            />
          ))
        )}
      </div>

      {/* Footer with counts */}
      {diagnostics.length > 0 && (
        <div className="px-3 py-1.5 border-t border-white/[0.04] text-xs font-ui text-white/30 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <ErrorCircleRegular className="w-3 h-3 text-red-400/70" />
            {counts.error}
          </span>
          <span className="flex items-center gap-1">
            <WarningRegular className="w-3 h-3 text-amber-400/70" />
            {counts.warning}
          </span>
          <span className="flex items-center gap-1">
            <InfoRegular className="w-3 h-3 text-blue-400/70" />
            {counts.info}
          </span>
        </div>
      )}
    </div>
  )
}
