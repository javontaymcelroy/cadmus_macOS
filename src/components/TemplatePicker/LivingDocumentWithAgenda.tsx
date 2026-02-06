import { useState } from 'react'
import type { LivingDocument, AgendaItem, DocumentLifecycleState } from '../../types/project'
import { RecentProjectCard } from './RecentProjectCard'
import { AgendaItemCard } from './AgendaItemCard'
import { ChevronUpRegular } from '@fluentui/react-icons'

interface LivingDocumentWithAgendaProps {
  document: LivingDocument
  agendaItems: AgendaItem[]
  onOpenProject: () => void
  onRenameProject: (newName: string) => void
  onDeleteProject: () => void
  onStateChange: (state: DocumentLifecycleState, note?: string) => void
  onOpenAgendaItem: (item: AgendaItem) => void
  onRenameAgendaItem: (item: AgendaItem, newTitle: string) => void
  onDeleteAgendaItem: (item: AgendaItem) => void
  onAgendaStateChange: (item: AgendaItem, state: DocumentLifecycleState, note?: string) => void
  onToggleAgendaTodo: (item: AgendaItem, todoId: string, checked: boolean) => void
  onMarkAllAgendaTodosDone: (item: AgendaItem) => void
  delay?: number
}

export function LivingDocumentWithAgenda({
  document,
  agendaItems,
  onOpenProject,
  onRenameProject,
  onDeleteProject,
  onStateChange,
  onOpenAgendaItem,
  onRenameAgendaItem,
  onDeleteAgendaItem,
  onAgendaStateChange,
  onToggleAgendaTodo,
  onMarkAllAgendaTodosDone,
  delay = 0
}: LivingDocumentWithAgendaProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasAgendaItems = agendaItems.length > 0
  const stackLayers = Math.min(agendaItems.length, 2) // Show max 2 layers behind

  // Calculate total todos for the stack indicator
  const totalTodos = agendaItems.reduce((sum, item) => sum + item.todos.length, 0)

  // Handle stack click to expand
  const handleStackClick = (e: React.MouseEvent) => {
    // Only expand if clicking on the stack layers area, not on the card itself
    if (hasAgendaItems && !isExpanded) {
      e.stopPropagation()
      setIsExpanded(true)
    }
  }

  // Expanded view - project card + agenda cards below
  if (isExpanded && hasAgendaItems) {
    return (
      <div className="project-stack expanded animate-slide-up" style={{ animationDelay: `${delay}s` }}>
        {/* Project Card */}
        <RecentProjectCard
          name={document.projectName}
          path={document.projectPath}
          templateId={document.templateId}
          state={document.state}
          stateNote={document.stateNote}
          lastOpened={document.lastOpened}
          onOpen={onOpenProject}
          onRename={onRenameProject}
          onDelete={onDeleteProject}
          onStateChange={onStateChange}
          delay={0}
        />

        {/* Collapse button */}
        <div 
          onClick={() => setIsExpanded(false)}
          className="flex items-center justify-center gap-2 p-2 mt-2 rounded-lg border border-theme-default bg-theme-hover cursor-pointer hover:bg-theme-active transition-colors"
        >
          <ChevronUpRegular className="w-4 h-4 text-theme-accent" />
          <span className="text-xs text-theme-accent font-ui">Collapse {agendaItems.length} {agendaItems.length === 1 ? 'note' : 'notes'}</span>
        </div>

        {/* Agenda cards */}
        <div className="space-y-3 mt-3">
          {agendaItems.map((item, index) => (
            <AgendaItemCard
              key={`${item.projectPath}-${item.documentId}`}
              item={item}
              onOpen={() => onOpenAgendaItem(item)}
              onRename={(newTitle) => onRenameAgendaItem(item, newTitle)}
              onDelete={() => onDeleteAgendaItem(item)}
              onStateChange={(state, note) => onAgendaStateChange(item, state, note)}
              onToggleTodo={(todoId, checked) => onToggleAgendaTodo(item, todoId, checked)}
              onMarkAllDone={() => onMarkAllAgendaTodosDone(item)}
              delay={index * 0.05}
              isAttachedToProject={true}
            />
          ))}
        </div>
      </div>
    )
  }

  // Collapsed view - project card with stacked layers behind
  return (
    <div 
      className={`project-stack animate-slide-up ${hasAgendaItems ? 'has-stack' : ''}`}
      style={{ 
        animationDelay: `${delay}s`,
        marginBottom: hasAgendaItems ? `${stackLayers * 6}px` : 0
      }}
    >
      {/* Project Card (on top) */}
      <div className="relative z-10">
        <RecentProjectCard
          name={document.projectName}
          path={document.projectPath}
          templateId={document.templateId}
          state={document.state}
          stateNote={document.stateNote}
          lastOpened={document.lastOpened}
          onOpen={onOpenProject}
          onRename={onRenameProject}
          onDelete={onDeleteProject}
          onStateChange={onStateChange}
          delay={0}
          hasAgendaStack={hasAgendaItems}
          stackCount={totalTodos}
          onStackClick={() => setIsExpanded(true)}
        />
      </div>

      {/* Stacked layer indicators (peeking out from bottom) */}
      {hasAgendaItems && Array.from({ length: stackLayers }).map((_, index) => (
        <div
          key={index}
          onClick={handleStackClick}
          className="project-stack-layer absolute left-1 right-1 rounded-b-2xl border-x border-b border-theme-default cursor-pointer bg-theme-active"
          style={{
            top: `calc(100% - ${4 - index * 2}px)`,
            height: `${10 + index * 2}px`,
            zIndex: -1 - index,
            marginLeft: `${(index + 1) * 4}px`,
            marginRight: `${(index + 1) * 4}px`,
          }}
        />
      ))}
    </div>
  )
}
