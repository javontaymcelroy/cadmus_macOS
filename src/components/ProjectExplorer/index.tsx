import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useProjectStore, getDocumentHierarchyType, getPageNumber, canCreateSubDocument } from '../../stores/projectStore'
import { clsx } from 'clsx'
import type { ProjectDocument } from '../../types/project'
import { getWorkspaceConfig, getFirstBlockText } from '../../workspaces'
import {
  AddRegular,
  ChevronRightRegular,
  MoreVerticalRegular,
  EditRegular,
  DeleteRegular,
  DocumentRegular,
  VideoRegular,
  CheckmarkRegular,
  DismissRegular,
  DividerTallRegular,
  PersonFilled,
  BoxRegular,
  SettingsRegular,
  ArrowLeftRegular,
  SaveArrowRightFilled
} from '@fluentui/react-icons'
import { getPropIconComponent } from '../PropsPanel'
import { SaveVersionButton } from '../../workspaces/shared/components'
import { SETTINGS_SECTIONS } from '../ProjectSettingsPanel'

interface ContextMenuState {
  x: number
  y: number
  docId: string | null
}

interface DragState {
  draggedId: string | null
  draggedParentId: string | undefined
  dropTargetId: string | null
  dropPosition: 'before' | 'after' | 'inside' | null
}

// Helper function to format dates in human-friendly relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  const dateHour = date.getHours()
  const isToday = date.toDateString() === now.toDateString()
  
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  
  // Time of day helpers
  const getTimeOfDay = (hour: number): string => {
    if (hour >= 0 && hour < 5) return 'middle of the night'
    if (hour >= 5 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 17) return 'afternoon'
    if (hour >= 17 && hour < 21) return 'evening'
    return 'night'
  }
  
  // Very recent - within last few minutes
  if (diffMins < 5) {
    return 'A moment ago'
  }
  
  // Within the last hour
  if (diffMins < 60) {
    return `${diffMins} minutes ago`
  }
  
  // Today
  if (isToday) {
    if (diffHours === 1) {
      return 'An hour ago'
    }
    if (diffHours < 3) {
      return `${diffHours} hours ago`
    }
    const timeOfDay = getTimeOfDay(dateHour)
    return `This ${timeOfDay}`
  }
  
  // Yesterday
  if (isYesterday) {
    const timeOfDay = getTimeOfDay(dateHour)
    if (timeOfDay === 'middle of the night') {
      return 'In the middle of the night yesterday'
    }
    if (timeOfDay === 'night') {
      return 'Last night'
    }
    return `Yesterday ${timeOfDay}`
  }
  
  // Within the last week
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
    return dayName
  }
  
  // Older than a week - show the date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ProjectExplorer() {
  const { 
    currentProject, 
    activeDocumentId,
    documents,
    setActiveDocument,
    createDocument,
    deleteDocument,
    renameDocument,
    reorderDocuments,
    moveDocument,
    renameProject,
    sceneHeadings,
    characterReferences,
    propReferences,
    ui,
    toggleSettingsPanel
  } = useProjectStore()
  
  const [isExporting, setIsExporting] = useState(false)

  const handleExportProject = async () => {
    if (!currentProject || isExporting) return
    const destinationPath = await window.api.dialog.selectFolder()
    if (!destinationPath) return
    setIsExporting(true)
    try {
      await window.api.project.export(currentProject.path, destinationPath)
    } catch (err) {
      console.error('Failed to export project:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingProjectName, setEditingProjectName] = useState(false)
  const [projectNameInput, setProjectNameInput] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Start with all parent documents expanded by default
    if (!currentProject) return new Set<string>()
    const parentIds = new Set<string>()
    for (const doc of currentProject.documents) {
      if (doc.parentId) parentIds.add(doc.parentId)
    }
    return parentIds
  })
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const addDropdownRef = useRef<HTMLDivElement>(null)
  const [addMenuPos, setAddMenuPos] = useState({ top: 0, right: 0 })
  const projectNameInputRef = useRef<HTMLInputElement>(null)
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    draggedParentId: undefined,
    dropTargetId: null,
    dropPosition: null
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const [scenesExpanded, setScenesExpanded] = useState(true)

  // Build a map of documentId -> entities (characters/props) that appear in that document
  const documentEntities = useMemo(() => {
    if (!currentProject) return {}
    
    const entityMap: Record<string, { characters: Array<{ id: string; name: string; color: string }>; props: Array<{ id: string; name: string; color: string }> }> = {}
    
    // Process character references - use the character's assigned color
    for (const [characterId, refs] of Object.entries(characterReferences)) {
      const character = currentProject.characters?.find(c => c.id === characterId)
      if (!character) continue
      
      for (const ref of refs) {
        if (!entityMap[ref.documentId]) {
          entityMap[ref.documentId] = { characters: [], props: [] }
        }
        // Only add if not already present
        if (!entityMap[ref.documentId].characters.some(c => c.id === characterId)) {
          entityMap[ref.documentId].characters.push({
            id: characterId,
            name: character.name,
            color: character.color
          })
        }
      }
    }
    
    // Process prop references - use the brand gold color for props
    for (const [propId, refs] of Object.entries(propReferences)) {
      const prop = currentProject.props?.find(p => p.id === propId)
      if (!prop) continue
      
      for (const ref of refs) {
        if (!entityMap[ref.documentId]) {
          entityMap[ref.documentId] = { characters: [], props: [] }
        }
        // Only add if not already present
        if (!entityMap[ref.documentId].props.some(p => p.id === propId)) {
          entityMap[ref.documentId].props.push({
            id: propId,
            name: prop.name,
            color: '#fbbf24' // Props use brand gold
          })
        }
      }
    }
    
    return entityMap
  }, [currentProject, characterReferences, propReferences])

  // Scroll to a scene heading and center it in the viewport
  const scrollToScene = (blockId: string) => {
    const targetElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null

    if (targetElement) {
      // Use scrollIntoView with center alignment - browser handles finding the scrollable container
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })

      // Highlight using inline styles (avoids CSS specificity issues)
      targetElement.style.backgroundColor = 'rgba(251, 191, 36, 0.35)'
      targetElement.style.boxShadow = '0 0 0 6px rgba(251, 191, 36, 0.2)'
      targetElement.style.borderRadius = '4px'

      // After hold period, fade out by adding transition then clearing values
      setTimeout(() => {
        targetElement.style.transition = 'background-color 1s ease-out, box-shadow 1s ease-out'
        // Use requestAnimationFrame to ensure the transition property is applied before changing values
        requestAnimationFrame(() => {
          targetElement.style.backgroundColor = ''
          targetElement.style.boxShadow = ''
        })
      }, 1200)

      // Clean up all inline styles after fade completes
      setTimeout(() => {
        targetElement.style.transition = ''
        targetElement.style.borderRadius = ''
      }, 2500)
    }
  }

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Close add menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        addButtonRef.current && !addButtonRef.current.contains(target) &&
        addDropdownRef.current && !addDropdownRef.current.contains(target)
      ) {
        setShowAddMenu(false)
      }
    }
    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAddMenu])

  // Focus input when editing document
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  // Focus input when editing project name
  useEffect(() => {
    if (editingProjectName && projectNameInputRef.current) {
      projectNameInputRef.current.focus()
      projectNameInputRef.current.select()
    }
  }, [editingProjectName])

  if (!currentProject) return null

  // Project name editing handlers
  const handleProjectNameClick = () => {
    setProjectNameInput(currentProject.name)
    setEditingProjectName(true)
  }

  const handleProjectNameSubmit = async () => {
    if (projectNameInput.trim() && projectNameInput.trim() !== currentProject.name) {
      await renameProject(projectNameInput.trim())
    }
    setEditingProjectName(false)
    setProjectNameInput('')
  }

  const handleProjectNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleProjectNameSubmit()
    } else if (e.key === 'Escape') {
      setEditingProjectName(false)
      setProjectNameInput('')
    }
  }

  const handleContextMenu = (e: React.MouseEvent, docId: string | null) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, docId })
  }

  const handleNewDocument = async () => {
    setContextMenu(null)
    
    // Get workspace config for this template
    const workspaceConfig = getWorkspaceConfig(currentProject.templateId)
    
    // Determine the appropriate default title and document type based on parent hierarchy
    let defaultTitle = workspaceConfig.hierarchy.defaultDocumentTitle
    let screenplayDocType: 'title-page' | 'page' | 'break' | undefined = undefined
    let isNote = false
    
    if (contextMenu?.docId) {
      const parentDoc = currentProject.documents.find(d => d.id === contextMenu.docId)
      if (parentDoc) {
        const parentHierarchyType = getDocumentHierarchyType(parentDoc, currentProject.documents)
        if (parentHierarchyType === 'document') {
          // Creating a child under a document -> use page settings
          defaultTitle = workspaceConfig.hierarchy.defaultPageTitle
          screenplayDocType = workspaceConfig.hierarchy.documentChildType
        } else if (parentHierarchyType === 'page') {
          // Creating a child under a page -> this is a note
          defaultTitle = 'New Note'
          isNote = true
        }
      }
    }
    
    await createDocument(defaultTitle, contextMenu?.docId || undefined, screenplayDocType, isNote)
  }

  // Create a sibling page (same parent as the current document)
  const handleNewSiblingPage = async () => {
    if (!contextMenu?.docId) return
    setContextMenu(null)
    
    const currentDoc = currentProject.documents.find(d => d.id === contextMenu.docId)
    if (!currentDoc?.parentId) return
    
    // Get workspace config for this template
    const workspaceConfig = getWorkspaceConfig(currentProject.templateId)
    
    // Create sibling with appropriate title and document type
    await createDocument(
      workspaceConfig.hierarchy.defaultPageTitle,
      currentDoc.parentId,
      workspaceConfig.hierarchy.documentChildType
    )
  }

  const handleDelete = async () => {
    if (contextMenu?.docId) {
      await deleteDocument(contextMenu.docId)
    }
    setContextMenu(null)
  }

  const handleRename = () => {
    if (contextMenu?.docId) {
      const doc = currentProject.documents.find(d => d.id === contextMenu.docId)
      if (doc) {
        setEditingId(contextMenu.docId)
        setEditingTitle(doc.title)
      }
    }
    setContextMenu(null)
  }

  const handleRenameSubmit = async () => {
    if (editingId && editingTitle.trim()) {
      await renameDocument(editingId, editingTitle.trim())
    }
    setEditingId(null)
    setEditingTitle('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditingTitle('')
    }
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  // Helper to check if a document is a descendant of another (prevents circular references)
  const isDescendantOf = (docId: string, potentialAncestorId: string): boolean => {
    let current = regularDocs.find(d => d.id === docId)
    while (current?.parentId) {
      if (current.parentId === potentialAncestorId) return true
      current = regularDocs.find(d => d.id === current?.parentId)
    }
    return false
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, doc: ProjectDocument) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', doc.id)
    setDragState({
      draggedId: doc.id,
      draggedParentId: doc.parentId,
      dropTargetId: null,
      dropPosition: null
    })
  }

  const handleDragOver = (e: React.DragEvent, doc: ProjectDocument) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Don't allow dropping on self
    if (dragState.draggedId === doc.id) {
      setDragState(prev => ({ ...prev, dropTargetId: null, dropPosition: null }))
      return
    }

    // Don't allow dropping a parent into its own descendants (circular reference)
    if (dragState.draggedId && isDescendantOf(doc.id, dragState.draggedId)) {
      setDragState(prev => ({ ...prev, dropTargetId: null, dropPosition: null }))
      return
    }

    // Determine drop position based on mouse position within the element
    // Top 25%: before, Middle 50%: inside (if allowed), Bottom 25%: after
    const rect = e.currentTarget.getBoundingClientRect()
    const relativeY = e.clientY - rect.top
    const heightPercent = relativeY / rect.height

    let position: 'before' | 'after' | 'inside'
    
    if (heightPercent < 0.25) {
      position = 'before'
    } else if (heightPercent > 0.75) {
      position = 'after'
    } else {
      // Middle zone - check if target can accept children
      const canAcceptChildren = canCreateSubDocument(doc, currentProject?.documents || [])
      if (canAcceptChildren) {
        position = 'inside'
      } else {
        // Fall back to before/after based on which half we're in
        position = heightPercent < 0.5 ? 'before' : 'after'
      }
    }

    setDragState(prev => ({
      ...prev,
      dropTargetId: doc.id,
      dropPosition: position
    }))
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving to outside the list
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget?.closest('[data-doc-item]')) {
      setDragState(prev => ({ ...prev, dropTargetId: null, dropPosition: null }))
    }
  }

  const handleDragEnd = () => {
    setDragState({
      draggedId: null,
      draggedParentId: undefined,
      dropTargetId: null,
      dropPosition: null
    })
  }

  const handleDrop = async (e: React.DragEvent, targetDoc: ProjectDocument) => {
    e.preventDefault()
    e.stopPropagation()

    const { draggedId, draggedParentId, dropPosition } = dragState

    // Reset drag state
    setDragState({
      draggedId: null,
      draggedParentId: undefined,
      dropTargetId: null,
      dropPosition: null
    })

    if (!draggedId || !dropPosition || draggedId === targetDoc.id) return

    // Handle 'inside' - move document to become a child of the target
    if (dropPosition === 'inside') {
      await moveDocument(draggedId, targetDoc.id)
      // Auto-expand the target folder to show the dropped item
      setExpandedFolders(prev => {
        const next = new Set(prev)
        next.add(targetDoc.id)
        return next
      })
      return
    }

    // Handle 'before' and 'after' - reorder or move to new parent level
    const targetParentId = targetDoc.parentId
    
    // If moving to a different parent level, use moveDocument
    if (draggedParentId !== targetParentId) {
      // Calculate the new order based on position relative to target
      const siblings = regularDocs.filter(d => d.parentId === targetParentId)
      const targetIndex = siblings.findIndex(d => d.id === targetDoc.id)
      const newOrder = dropPosition === 'before' ? targetIndex : targetIndex + 1
      await moveDocument(draggedId, targetParentId, newOrder)
      return
    }

    // Same parent - just reorder among siblings
    const siblings = regularDocs.filter(d => d.parentId === targetParentId)
    const draggedIndex = siblings.findIndex(d => d.id === draggedId)
    const targetIndex = siblings.findIndex(d => d.id === targetDoc.id)

    if (draggedIndex === -1 || targetIndex === -1) return

    // Remove dragged item and insert at new position
    const newSiblings = [...siblings]
    const [removed] = newSiblings.splice(draggedIndex, 1)
    
    let insertIndex = targetIndex
    if (draggedIndex < targetIndex) {
      // Moving down - adjust for removed item
      insertIndex = dropPosition === 'after' ? targetIndex : targetIndex - 1
    } else {
      // Moving up
      insertIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1
    }
    
    newSiblings.splice(insertIndex, 0, removed)

    // Build the new order array with all document IDs
    const otherDocs = regularDocs.filter(d => d.parentId !== targetParentId)
    const newOrder = [...otherDocs, ...newSiblings].map(d => d.id)
    
    await reorderDocuments(newOrder)
  }

  // Sort documents by order
  const sortedDocs = [...currentProject.documents].sort((a, b) => a.order - b.order)
  
  // Separate regular documents from character notes and prop notes
  const regularDocs = sortedDocs.filter(d => !d.isCharacterNote && !d.isPropNote)
  const characterNoteDocs = sortedDocs.filter(d => d.isCharacterNote)
  const propNoteDocs = sortedDocs.filter(d => d.isPropNote)
  
  // Group by parent (top-level vs nested) - only regular docs
  const topLevelDocs = regularDocs.filter(d => !d.parentId)
  
  // Get workspace config for this template
  const workspaceConfig = getWorkspaceConfig(currentProject.templateId)
  const isScreenplayProject = currentProject.templateId === 'screenplay'

  // Indent configuration
  const INDENT_SIZE = 14 // pixels per depth level

  const renderDocument = (doc: ProjectDocument, depth = 0) => {
    const isFolder = doc.type === 'folder'
    const isExpanded = expandedFolders.has(doc.id)
    const children = regularDocs.filter(d => d.parentId === doc.id)
    const isEditing = editingId === doc.id
    const docState = documents[doc.id]
    const titleFont = docState?.titleFontFamily || undefined
    
    // Get hierarchy info for this document
    const hierarchyType = getDocumentHierarchyType(doc, currentProject.documents)
    const pageNumber = hierarchyType === 'page' ? getPageNumber(doc, currentProject.documents) : 0
    
    // Derive title from first block content if enabled in workspace config
    const shouldDeriveTitle = workspaceConfig.features.deriveTitlesFromContent && doc.parentId
    const derivedTitle = shouldDeriveTitle ? getFirstBlockText(docState?.content || null) : null
    const displayTitle = derivedTitle || doc.title
    
    // Determine font family from workspace config
    const fontFamily = workspaceConfig.editor.useMonospaceFont 
      ? workspaceConfig.editor.fontFamily 
      : (titleFont || undefined)

    // Drag state for this item
    const isDragging = dragState.draggedId === doc.id
    const isDropTarget = dragState.dropTargetId === doc.id
    const isDropInside = isDropTarget && dragState.dropPosition === 'inside'
    const isDropBeforeOrAfter = isDropTarget && (dragState.dropPosition === 'before' || dragState.dropPosition === 'after')

    const hasChildren = children.length > 0

    return (
      <div key={doc.id} className="relative">

        {/* Drop indicator - before */}
        {isDropTarget && dragState.dropPosition === 'before' && (
          <div
            className="absolute left-2 right-2 h-0.5 bg-gold-400 rounded-full z-10"
            style={{ top: 0, marginLeft: `${depth * INDENT_SIZE}px` }}
          />
        )}

        <div
          data-doc-item
          draggable={!isEditing}
          onDragStart={(e) => handleDragStart(e, doc)}
          onDragOver={(e) => handleDragOver(e, doc)}
          onDragLeave={handleDragLeave}
          onDragEnd={handleDragEnd}
          onDrop={(e) => handleDrop(e, doc)}
          className={clsx(
            'list-item-modern flex items-center px-2 py-0.5 cursor-pointer group',
            activeDocumentId === doc.id && !isFolder && 'active',
            isDragging && 'opacity-50',
            isDropBeforeOrAfter && 'bg-theme-hover',
            isDropInside && 'bg-gold-400/15 ring-1 ring-gold-400/50 ring-inset'
          )}
          style={{ paddingLeft: `${8 + (doc.isActBreak ? 0 : depth * INDENT_SIZE)}px` }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(doc.id)
            } else {
              setActiveDocument(doc.id)
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, doc.id)}
        >
          {/* Expand/collapse chevron for folders or documents with children */}
          {(isFolder || hasChildren) ? (
            <ChevronRightRegular
              className={clsx('w-3.5 h-3.5 text-theme-muted transition-transform duration-200 mr-1 shrink-0', isExpanded && 'rotate-90')}
              onClick={(e) => {
                if (!isFolder) {
                  e.stopPropagation()
                  toggleFolder(doc.id)
                }
              }}
            />
          ) : depth > 0 ? (
            <span className="w-3.5 mr-1 shrink-0" />
          ) : null}
          
          {/* Title */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              className="input-modern flex-1 min-w-0 text-sm py-1"
              style={{ fontFamily }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span 
              className={clsx(
                'flex-1 min-w-0 text-sm truncate transition-colors duration-200',
                activeDocumentId === doc.id && !isFolder 
                  ? 'text-theme-accent font-semibold' 
                  : 'text-theme-secondary font-medium group-hover:text-theme-primary'
              )}
              style={{ fontFamily }}
              title={displayTitle}
            >
              {displayTitle}
            </span>
          )}

          {/* Character/Prop indicators for child documents - tiny colored squares */}
          {hierarchyType === 'page' && doc.parentId && (
            <div className="flex items-center gap-0.5 shrink-0 ml-2">
              {documentEntities[doc.id]?.characters.map((char) => (
                <div
                  key={char.id}
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: char.color }}
                  title={char.name}
                />
              ))}
              {documentEntities[doc.id]?.props.map((prop) => (
                <div
                  key={prop.id}
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: prop.color }}
                  title={prop.name}
                />
              ))}
            </div>
          )}

          {/* Actions */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleContextMenu(e, doc.id)
            }}
            className="opacity-0 group-hover:opacity-100 btn-icon-modern p-0.5 transition-opacity"
          >
            <MoreVerticalRegular className="w-3 h-3" />
          </button>
        </div>

        {/* Drop indicator - after */}
        {isDropTarget && dragState.dropPosition === 'after' && (
          <div 
            className="absolute left-2 right-2 h-0.5 bg-gold-400 rounded-full z-10"
            style={{ bottom: 0, marginLeft: `${depth * INDENT_SIZE}px` }}
          />
        )}

        {/* Children - collapsible for both folders and documents with children */}
        {hasChildren && isExpanded && (
          <div>
            {children.map((child) => renderDocument(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle bg-theme-header">
        <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
          {ui.settingsPanelOpen ? 'Settings' : 'Project'}
        </h2>
        <div className="flex items-center gap-1">
          {!ui.settingsPanelOpen && (
            <button
              onClick={handleExportProject}
              disabled={isExporting}
              className={clsx(
                'btn-icon-modern w-7 h-7 flex items-center justify-center text-theme-accent',
                isExporting && 'opacity-50 cursor-not-allowed'
              )}
              title={isExporting ? 'Exporting...' : 'Export Project'}
            >
              <SaveArrowRightFilled className="w-4 h-4" />
            </button>
          )}
          {!ui.settingsPanelOpen && <SaveVersionButton />}
          <button
            onClick={toggleSettingsPanel}
            className={clsx(
              'btn-icon-modern w-7 h-7 flex items-center justify-center',
              ui.settingsPanelOpen && 'bg-theme-active text-theme-accent'
            )}
            title={ui.settingsPanelOpen ? 'Back to Editor' : 'Project Settings'}
          >
            {ui.settingsPanelOpen
              ? <ArrowLeftRegular className="w-4 h-4" />
              : <SettingsRegular className="w-4 h-4" />}
          </button>
          {!ui.settingsPanelOpen && (
            <div className="relative" ref={addMenuRef}>
              <button
                ref={addButtonRef}
                onClick={() => {
                  if (!showAddMenu && addButtonRef.current) {
                    const rect = addButtonRef.current.getBoundingClientRect()
                    setAddMenuPos({
                      top: rect.bottom + 4,
                      right: window.innerWidth - rect.right
                    })
                  }
                  setShowAddMenu(!showAddMenu)
                }}
                className={clsx(
                  'btn-icon-modern p-1.5',
                  showAddMenu && 'bg-theme-active text-theme-accent'
                )}
                title={`Add ${workspaceConfig.hierarchy.documentLabel}`}
              >
                <AddRegular className="w-4 h-4" />
              </button>

              {/* Add menu dropdown */}
              {showAddMenu && createPortal(
                <div ref={addDropdownRef} className="menu-modern fixed py-1.5 z-[9999] min-w-[200px]" style={{ top: addMenuPos.top, right: addMenuPos.right }}>
                  {isScreenplayProject ? (
                    <>
                      <button
                        onClick={() => {
                          createDocument('Title Page', undefined, 'title-page')
                          setShowAddMenu(false)
                        }}
                        className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
                      >
                        <VideoRegular className="w-4 h-4 text-theme-accent" />
                        <div>
                          <div>New Screenplay Project</div>
                          <div className="text-[10px] text-theme-muted">Title page format</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          // Find the first top-level document (title page) to use as parent
                          const titlePage = topLevelDocs.find(d => d.type === 'document' && !d.parentId)
                          if (!titlePage) {
                            console.warn('Cannot create screenplay page: no title page found')
                            setShowAddMenu(false)
                            return
                          }
                          createDocument(
                            workspaceConfig.hierarchy.defaultPageTitle,
                            titlePage.id,
                            workspaceConfig.hierarchy.documentChildType
                          )
                          setShowAddMenu(false)
                        }}
                        className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
                      >
                        <DocumentRegular className="w-4 h-4 text-theme-secondary" />
                        <div>
                          <div>{workspaceConfig.hierarchy.documentChildLabel}</div>
                          <div className="text-[10px] text-theme-muted">Scene heading format</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          // Find the first top-level document (title page) to use as parent
                          const titlePage = topLevelDocs.find(d => d.type === 'document' && !d.parentId)
                          if (!titlePage) {
                            console.warn('Cannot create Act break: no title page found')
                            setShowAddMenu(false)
                            return
                          }

                          // Count existing act breaks to determine the next act number
                          const existingActBreaks = regularDocs.filter(d =>
                            d.parentId === titlePage.id &&
                            d.title.toLowerCase().startsWith('act')
                          )
                          const nextActNumber = existingActBreaks.length + 1

                          createDocument(`Act ${nextActNumber}`, titlePage.id, 'break')
                          setShowAddMenu(false)
                        }}
                        className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
                      >
                        <DividerTallRegular className="w-4 h-4 text-theme-secondary" />
                        <div>
                          <div>New Act Break</div>
                          <div className="text-[10px] text-theme-muted">Act divider with description</div>
                        </div>
                      </button>
                      <div className="divider-modern my-1" />
                      <button
                        onClick={() => {
                          createDocument('New Document', undefined, undefined, false, true)
                          setShowAddMenu(false)
                        }}
                        className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
                      >
                        <DocumentRegular className="w-4 h-4 text-theme-secondary" />
                        <div>
                          <div>New Document</div>
                          <div className="text-[10px] text-theme-muted">Blank document with notes</div>
                        </div>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        createDocument(workspaceConfig.hierarchy.defaultDocumentTitle)
                        setShowAddMenu(false)
                      }}
                      className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
                    >
                      <DocumentRegular className="w-4 h-4 text-theme-secondary" />
                      {workspaceConfig.hierarchy.defaultDocumentTitle}
                    </button>
                  )}
                </div>,
                document.body
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings section navigation - shown when settings panel is open */}
      {ui.settingsPanelOpen ? (
        <div className="flex-1 overflow-auto p-2">
          <nav className="space-y-1">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  const el = document.getElementById(`settings-${section.id}`)
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="list-item-modern flex items-center gap-2 px-3 py-2 w-full text-left group"
              >
                <span className="text-sm font-ui font-medium text-theme-secondary group-hover:text-theme-primary transition-colors">
                  {section.label}
                </span>
              </button>
            ))}
          </nav>
        </div>
      ) : (
      <>
      {/* Project name */}
      <div className="px-4 py-3 border-b border-theme-subtle bg-theme-header">
        {editingProjectName ? (
          <div className="relative flex items-center">
            <input
              ref={projectNameInputRef}
              type="text"
              value={projectNameInput}
              onChange={(e) => setProjectNameInput(e.target.value)}
              onKeyDown={handleProjectNameKeyDown}
              className="input-modern w-full text-sm font-ui font-medium py-1 pr-14"
            />
            <div className="absolute right-1 flex items-center gap-0.5">
              <button
                onClick={handleProjectNameSubmit}
                className="p-1 text-theme-secondary hover:text-green-500 transition-colors"
                title="Save (Enter)"
              >
                <CheckmarkRegular className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setEditingProjectName(false)
                  setProjectNameInput('')
                }}
                className="p-1 text-theme-secondary hover:text-red-500 transition-colors"
                title="Cancel (Escape)"
              >
                <DismissRegular className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <h3 
            className="text-sm font-ui font-medium text-theme-primary truncate cursor-pointer hover:text-theme-accent transition-colors"
            onClick={handleProjectNameClick}
            title="Click to rename project"
          >
            {currentProject.name}
          </h3>
        )}
        <p className="text-xs text-theme-muted font-ui font-medium mt-1">
          {(() => {
            const count = currentProject.documents.filter(d => d.type === 'document' && !d.parentId && !d.isCharacterNote && !d.isPropNote).length
            const label = workspaceConfig.hierarchy.documentLabel.toLowerCase()
            return `${count} ${count === 1 ? label : label + 's'}`
          })()}
        </p>
      </div>

      {/* Document tree */}
      <div
        className="shrink overflow-auto p-2"
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        {topLevelDocs.map((doc, index) => (
          <div key={`top-${doc.id}`}>
            {renderDocument(doc, 0)}
            {/* Divider between top-level documents */}
            {index < topLevelDocs.length - 1 && (
              <div className="my-2 mx-2 border-t border-theme-subtle" />
            )}
          </div>
        ))}
        
        {topLevelDocs.length === 0 && (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-theme-hover flex items-center justify-center mx-auto mb-3">
              <AddRegular className="w-5 h-5 text-theme-muted" />
            </div>
            <p className="text-sm text-theme-muted font-ui">No {workspaceConfig.hierarchy.documentLabel.toLowerCase()}s yet</p>
            <button
              onClick={() => {
                createDocument(
                  workspaceConfig.hierarchy.defaultDocumentTitle,
                  undefined,
                  workspaceConfig.hierarchy.documentChildType
                )
              }}
              className="mt-3 text-sm text-theme-accent font-ui transition-colors hover:opacity-80"
            >
              Create your first {workspaceConfig.hierarchy.defaultDocumentTitle.toLowerCase()}
            </button>
          </div>
        )}
      </div>

      {/* Scenes Section - only for screenplay projects */}
      {currentProject.templateId === 'screenplay' && activeDocumentId && (sceneHeadings[activeDocumentId]?.length || 0) > 0 && (
        <div className="border-t border-theme-subtle flex flex-col flex-1 min-h-0">
          {/* Scenes Header */}
          <button
            onClick={() => setScenesExpanded(!scenesExpanded)}
            className="flex items-center justify-between w-full px-4 py-3 border-b border-theme-subtle bg-theme-header hover:bg-theme-hover transition-colors shrink-0"
          >
            <div className="flex items-center gap-2">
              <ChevronRightRegular
                className={clsx(
                  'w-3 h-3 text-theme-muted transition-transform',
                  scenesExpanded && 'rotate-90'
                )}
              />
              <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
                Scenes
              </h2>
            </div>
            <span className="text-xs text-theme-muted font-ui">
              {sceneHeadings[activeDocumentId]?.length || 0}
            </span>
          </button>

          {/* Scenes List */}
          {scenesExpanded && (
            <div className="overflow-auto p-2 flex-1 min-h-0">
              {sceneHeadings[activeDocumentId]?.map((scene) => (
                <button
                  key={scene.blockId}
                  onClick={() => scrollToScene(scene.blockId)}
                  className="list-item-modern flex items-center gap-2 px-2 py-1.5 cursor-pointer group w-full text-left"
                >
                  {/* Scene number */}
                  <span className="text-xs text-theme-muted font-ui font-medium w-6 flex-shrink-0">
                    {scene.sceneNumber}.
                  </span>
                  
                  {/* Scene heading text */}
                  <span 
                    className="flex-1 text-sm truncate text-theme-secondary group-hover:text-theme-primary transition-colors"
                    style={{ fontFamily: "'Courier New', Courier, monospace" }}
                    title={scene.text}
                  >
                    {scene.text}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Character Notes Section - only shown when characters panel is enabled */}
      {workspaceConfig.features.showCharactersPanel && characterNoteDocs.length > 0 && (
        <div className="border-t border-theme-subtle">
          {/* Character Notes Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle bg-theme-header">
            <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
              Character Notes
            </h2>
            <span className="text-xs text-theme-muted font-ui">
              {characterNoteDocs.length}
            </span>
          </div>
          
          {/* Character Notes List */}
          <div className="overflow-auto p-2 max-h-48">
            {characterNoteDocs.map((doc) => {
              // Find the character this note belongs to for color
              const character = currentProject.characters?.find(c => c.id === doc.characterId)
              
              return (
                <div
                  key={doc.id}
                  className={clsx(
                    'list-item-modern flex items-center gap-2 px-2 py-1.5 cursor-pointer group',
                    activeDocumentId === doc.id && 'active'
                  )}
                  onClick={() => setActiveDocument(doc.id)}
                  onContextMenu={(e) => handleContextMenu(e, doc.id)}
                >
                  {/* Character color indicator */}
                  <div 
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: character?.color || '#fbbf24' }}
                  >
                    <PersonFilled className="w-3 h-3 text-slate-900" />
                  </div>
                  
                  {/* Character name */}
                  <span 
                    className={clsx(
                      'flex-1 text-sm truncate transition-colors duration-200',
                      activeDocumentId === doc.id 
                        ? 'text-theme-accent font-semibold' 
                        : 'text-theme-secondary font-medium group-hover:text-theme-primary'
                    )}
                    style={{ fontFamily: workspaceConfig.editor.fontFamily }}
                    title={doc.title}
                  >
                    {doc.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Prop Notes Section - only shown when characters panel is enabled (props are part of screenplay features) */}
      {workspaceConfig.features.showCharactersPanel && propNoteDocs.length > 0 && (
        <div className="border-t border-theme-subtle">
          {/* Prop Notes Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle bg-theme-header">
            <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
              Prop Notes
            </h2>
            <span className="text-xs text-theme-muted font-ui">
              {propNoteDocs.length}
            </span>
          </div>
          
          {/* Prop Notes List */}
          <div className="overflow-auto p-2 max-h-48">
            {propNoteDocs.map((doc) => {
              // Find the prop this note belongs to for icon
              const prop = currentProject.props?.find(p => p.id === doc.propId)
              const PropIcon = prop ? getPropIconComponent(prop.icon) : BoxRegular
              
              return (
                <div
                  key={doc.id}
                  className={clsx(
                    'list-item-modern flex items-center gap-2 px-2 py-1.5 cursor-pointer group',
                    activeDocumentId === doc.id && 'active'
                  )}
                  onClick={() => setActiveDocument(doc.id)}
                  onContextMenu={(e) => handleContextMenu(e, doc.id)}
                >
                  {/* Prop icon indicator */}
                  <div 
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-amber-400"
                  >
                    <PropIcon className="w-3 h-3 text-black" />
                  </div>
                  
                  {/* Prop name */}
                  <span 
                    className={clsx(
                      'flex-1 text-sm truncate transition-colors duration-200',
                      activeDocumentId === doc.id 
                        ? 'text-theme-accent font-semibold' 
                        : 'text-theme-secondary font-medium group-hover:text-theme-primary'
                    )}
                    style={{ fontFamily: workspaceConfig.editor.fontFamily }}
                    title={doc.title}
                  >
                    {doc.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      </>
      )}

      {/* Context menu */}
      {contextMenu && (() => {
        // Get hierarchy info for context menu document
        const contextDoc = contextMenu.docId
          ? currentProject.documents.find(d => d.id === contextMenu.docId)
          : null
        const contextHierarchyType = contextDoc
          ? getDocumentHierarchyType(contextDoc, currentProject.documents)
          : null

        // Get workspace config for menu labels
        const workspaceConfig = getWorkspaceConfig(currentProject.templateId)

        // Character notes and prop notes cannot have children
        const isCharacterNote = contextDoc?.isCharacterNote === true
        const isPropNote = contextDoc?.isPropNote === true
        // Check if pages can have children in this workspace
        const isPageWithoutChildren = contextHierarchyType === 'page' && !workspaceConfig.hierarchy.pagesCanHaveChildren
        const canCreateChild = contextDoc
          ? canCreateSubDocument(contextDoc, currentProject.documents) && !isCharacterNote && !isPropNote && !isPageWithoutChildren
          : true

        // Determine the label for creating child documents based on hierarchy level
        const newChildLabel = contextHierarchyType === 'document'
          ? workspaceConfig.hierarchy.documentChildLabel  // "New Page" for screenplay, "New Note" for notes-journal
          : contextHierarchyType === 'page'
            ? workspaceConfig.hierarchy.pageChildLabel    // "New Note" for screenplay
            : workspaceConfig.hierarchy.documentChildLabel

        return createPortal(
          <div
            className="menu-modern fixed py-1.5 z-50 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Show "New Document/Journal" only when right-clicking on empty space */}
            {!contextMenu.docId && (
              <button
                onClick={handleNewDocument}
                className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
              >
                <AddRegular className="w-4 h-4 text-theme-secondary" />
                {workspaceConfig.hierarchy.defaultDocumentTitle}
              </button>
            )}
            
            {contextMenu.docId && (
              <>
                {/* Show "New Page/Note" option for pages (to create sibling page) */}
                {contextHierarchyType === 'page' && contextDoc?.parentId && (
                  <button
                    onClick={handleNewSiblingPage}
                    className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
                  >
                    <AddRegular className="w-4 h-4 text-theme-secondary" />
                    {workspaceConfig.hierarchy.siblingPageLabel}
                  </button>
                )}
                
                {/* Only show "New Page/Note" if this document can have children */}
                {canCreateChild && (
                  <button
                    onClick={handleNewDocument}
                    className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
                  >
                    <AddRegular className="w-4 h-4 text-theme-secondary" />
                    {newChildLabel}
                  </button>
                )}
                
                {/* For documents in screenplay, also show "New Note" option */}
                {contextHierarchyType === 'document' && workspaceConfig.hierarchy.pagesCanHaveChildren && (
                  <button
                    onClick={async () => {
                      setContextMenu(null)
                      await createDocument('New Note', contextMenu?.docId || undefined, undefined, true)
                    }}
                    className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
                  >
                    <AddRegular className="w-4 h-4 text-theme-secondary" />
                    New Note
                  </button>
                )}
                
                <button
                  onClick={handleRename}
                  className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-theme-primary flex items-center gap-2"
                >
                  <EditRegular className="w-4 h-4 text-theme-secondary" />
                  Rename
                </button>
                
                <div className="divider-modern my-1" />
                
                <button
                  onClick={handleDelete}
                  className="menu-modern-item w-full px-3 py-2 text-left text-sm font-ui text-red-500 hover:text-red-600 flex items-center gap-2"
                >
                  <DeleteRegular className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>,
          document.body
        )
      })()}
    </div>
  )
}
