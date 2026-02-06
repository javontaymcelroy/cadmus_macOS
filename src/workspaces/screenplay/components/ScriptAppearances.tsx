import { useState, useMemo, useEffect } from 'react'
import { useProjectStore } from '../../../stores/projectStore'
import { clsx } from 'clsx'
import type { ScriptReference } from '../../../types/project'
import {
  ChevronDownRegular,
  ChevronRightRegular,
  DocumentTextRegular,
  ArrowRightRegular,
  PersonRegular,
  BoxRegular
} from '@fluentui/react-icons'

// Debounce hook for efficient updates
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => clearTimeout(handler)
  }, [value, delay])
  
  return debouncedValue
}

interface ScriptAppearancesProps {
  characterId?: string
  propId?: string
}

interface GroupedReferences {
  documentId: string
  documentTitle: string
  scenes: {
    sceneNumber: number
    sceneHeading: string
    references: ScriptReference[]
  }[]
}

function groupReferencesByDocument(references: ScriptReference[]): GroupedReferences[] {
  const groups = new Map<string, GroupedReferences>()
  
  for (const ref of references) {
    let group = groups.get(ref.documentId)
    if (!group) {
      group = {
        documentId: ref.documentId,
        documentTitle: ref.documentTitle,
        scenes: []
      }
      groups.set(ref.documentId, group)
    }
    
    // Find or create scene entry
    let scene = group.scenes.find(s => s.sceneNumber === ref.sceneNumber)
    if (!scene) {
      scene = {
        sceneNumber: ref.sceneNumber,
        sceneHeading: ref.sceneHeading,
        references: []
      }
      group.scenes.push(scene)
    }
    
    // Add reference (avoiding duplicates by blockId)
    if (!scene.references.some(r => r.blockId === ref.blockId)) {
      scene.references.push(ref)
    }
  }
  
  // Sort scenes within each group
  for (const group of groups.values()) {
    group.scenes.sort((a, b) => a.sceneNumber - b.sceneNumber)
  }
  
  return Array.from(groups.values())
}

export function ScriptAppearances({ characterId, propId }: ScriptAppearancesProps) {
  const { 
    characterReferences, 
    propReferences, 
    computeAllReferences,
    navigateToCitation,
    currentProject,
    documents
  } = useProjectStore()
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  
  // Create a hash of document contents to detect changes
  // Include whether content is loaded to trigger recompute after initial load
  const documentsHash = useMemo(() => {
    if (!currentProject) return ''
    
    // Get script documents (excluding notes)
    const scriptDocs = currentProject.documents.filter(doc => 
      doc.type === 'document' && 
      !doc.isCharacterNote && 
      !doc.isPropNote &&
      !doc.isNote
    )
    
    // Create a hash that includes:
    // - whether content is loaded (for initial load detection)
    // - dirty state and lastSaved (for change detection)
    return scriptDocs.map(doc => {
      const docState = documents[doc.id]
      const hasContent = docState?.content ? 'loaded' : 'unloaded'
      return `${doc.id}:${hasContent}:${docState?.isDirty ? 'dirty' : 'clean'}:${docState?.lastSaved || 'never'}`
    }).join('|')
  }, [currentProject, documents])
  
  // Debounce the documents hash to avoid too frequent updates
  const debouncedDocumentsHash = useDebounce(documentsHash, 500)
  
  // Compute references when documents change (debounced)
  // This handles both initial load and subsequent edits
  useEffect(() => {
    let cancelled = false
    
    const compute = async () => {
      setIsLoading(true)
      await computeAllReferences()
      if (!cancelled) {
        setIsLoading(false)
      }
    }
    
    compute()
    
    return () => {
      cancelled = true
    }
  }, [computeAllReferences, debouncedDocumentsHash])
  
  // Get the relevant references
  const references = useMemo(() => {
    if (characterId) {
      return characterReferences[characterId] || []
    }
    if (propId) {
      return propReferences[propId] || []
    }
    return []
  }, [characterId, propId, characterReferences, propReferences])
  
  // Group by document
  const groupedReferences = useMemo(() => {
    return groupReferencesByDocument(references)
  }, [references])
  
  // Auto-expand all docs initially
  useEffect(() => {
    const allDocIds = new Set(groupedReferences.map(g => g.documentId))
    setExpandedDocs(allDocIds)
  }, [groupedReferences])
  
  // Get entity info for display
  const entityInfo = useMemo(() => {
    if (characterId && currentProject) {
      const char = currentProject.characters?.find(c => c.id === characterId)
      return char ? { name: char.name, color: char.color, type: 'character' as const } : null
    }
    if (propId && currentProject) {
      const prop = currentProject.props?.find(p => p.id === propId)
      return prop ? { name: prop.name, icon: prop.icon, type: 'prop' as const } : null
    }
    return null
  }, [characterId, propId, currentProject])
  
  const toggleDocExpanded = (docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }
  
  const handleSceneClick = async (ref: ScriptReference) => {
    // Navigate to the document and block
    await navigateToCitation(ref.documentId, ref.blockId)
  }
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="border-b border-theme-subtle bg-theme-header/50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-theme-muted">
            <DocumentTextRegular className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-ui font-medium">
              Scanning script for appearances...
            </span>
          </div>
        </div>
      </div>
    )
  }
  
  // Don't render if no references
  if (references.length === 0) {
    return (
      <div className="border-b border-theme-subtle bg-theme-header/50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-theme-muted">
            {entityInfo?.type === 'character' ? (
              <PersonRegular className="w-4 h-4" />
            ) : (
              <BoxRegular className="w-4 h-4" />
            )}
            <span className="text-xs font-ui font-medium">
              No script appearances yet
            </span>
          </div>
        </div>
      </div>
    )
  }
  
  // Count total appearances (all individual references)
  const totalAppearances = references.length
  // Count total unique scenes
  const totalScenes = groupedReferences.reduce((acc, group) => acc + group.scenes.length, 0)
  
  return (
    <div className="border-b border-theme-subtle bg-theme-header/30">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-theme-hover/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDownRegular className="w-4 h-4 text-theme-muted" />
          ) : (
            <ChevronRightRegular className="w-4 h-4 text-theme-muted" />
          )}
          <DocumentTextRegular className="w-4 h-4 text-theme-accent" />
          <span className="text-xs font-ui font-semibold uppercase tracking-wider text-theme-secondary">
            Script Appearances
          </span>
        </div>
        <span className="text-xs font-ui font-medium text-theme-muted bg-theme-hover px-2 py-0.5 rounded-full">
          {totalAppearances} {totalAppearances === 1 ? 'appearance' : 'appearances'} in {totalScenes} {totalScenes === 1 ? 'scene' : 'scenes'}
        </span>
      </button>
      
      {/* Content */}
      {isExpanded && (
        <div className="pb-2">
          {groupedReferences.map((group) => (
            <div key={group.documentId} className="px-2">
              {/* Document header */}
              <button
                onClick={() => toggleDocExpanded(group.documentId)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-theme-hover/50 rounded transition-colors"
              >
                {expandedDocs.has(group.documentId) ? (
                  <ChevronDownRegular className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" />
                ) : (
                  <ChevronRightRegular className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" />
                )}
                <span className="text-xs font-ui font-semibold text-theme-primary truncate">
                  {group.documentTitle}
                </span>
                <span className="text-xs text-theme-muted font-ui ml-auto flex-shrink-0">
                  ({group.scenes.length})
                </span>
              </button>
              
              {/* Scenes list */}
              {expandedDocs.has(group.documentId) && (
                <div className="ml-4 border-l border-theme-subtle pl-2 space-y-0.5">
                  {group.scenes.map((scene) => (
                    <div key={`${group.documentId}-${scene.sceneNumber}`}>
                      {/* Scene header - shows count if multiple appearances in same scene */}
                      <div className="flex items-center gap-2 px-2 py-1 text-xs font-ui">
                        <span className="font-medium text-theme-accent flex-shrink-0">
                          Scene {scene.sceneNumber}:
                        </span>
                        <span className="text-theme-secondary truncate flex-1">
                          {scene.sceneHeading}
                        </span>
                        {scene.references.length > 1 && (
                          <span className="text-theme-muted flex-shrink-0">
                            ({scene.references.length}x)
                          </span>
                        )}
                      </div>
                      {/* Individual appearances within the scene */}
                      <div className="ml-4 space-y-0.5">
                        {scene.references.map((ref, idx) => (
                          <button
                            key={`${ref.blockId}-${idx}`}
                            onClick={() => handleSceneClick(ref)}
                            className={clsx(
                              'w-full flex items-center gap-2 px-2 py-1 rounded text-left',
                              'hover:bg-theme-hover/70 transition-colors group'
                            )}
                          >
                            <span className="text-xs font-ui text-theme-muted flex-shrink-0 w-16">
                              {ref.elementType === 'character' ? 'Dialogue' : 
                               ref.elementType === 'dialogue' ? 'Dialogue' :
                               ref.elementType === 'action' ? 'Mentioned' :
                               ref.elementType === 'parenthetical' ? 'Action' : 'Other'}
                            </span>
                            <span className="text-xs font-ui text-theme-secondary truncate flex-1 italic">
                              "{ref.contextSnippet || '...'}"
                            </span>
                            <ArrowRightRegular className="w-3.5 h-3.5 text-theme-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
