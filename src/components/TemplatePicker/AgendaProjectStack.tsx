import { useState } from 'react'
import type { AgendaItem, DocumentLifecycleState } from '../../types/project'
import { AgendaItemCard } from './AgendaItemCard'
import {
  ChevronDownRegular,
  ChevronUpRegular,
  FolderRegular
} from '@fluentui/react-icons'

interface AgendaProjectStackProps {
  projectPath: string
  projectName: string
  items: AgendaItem[]
  onOpen: (item: AgendaItem) => void
  onRename: (item: AgendaItem, newTitle: string) => void
  onDelete: (item: AgendaItem) => void
  onStateChange: (item: AgendaItem, state: DocumentLifecycleState, note?: string) => void
  onToggleTodo: (item: AgendaItem, todoId: string, checked: boolean) => void
  onMarkAllDone: (item: AgendaItem) => void
  delay?: number
  isAttachedToProject?: boolean
}

export function AgendaProjectStack({
  projectName,
  items,
  onOpen,
  onRename,
  onDelete,
  onStateChange,
  onToggleTodo,
  onMarkAllDone,
  delay = 0,
  isAttachedToProject = false
}: AgendaProjectStackProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // If only one item, render it directly
  if (items.length === 1) {
    return (
      <AgendaItemCard
        item={items[0]}
        onOpen={() => onOpen(items[0])}
        onRename={(newTitle) => onRename(items[0], newTitle)}
        onDelete={() => onDelete(items[0])}
        onStateChange={(state, note) => onStateChange(items[0], state, note)}
        onToggleTodo={(todoId, checked) => onToggleTodo(items[0], todoId, checked)}
        onMarkAllDone={() => onMarkAllDone(items[0])}
        delay={delay}
        isAttachedToProject={isAttachedToProject}
      />
    )
  }

  // Multiple items - show stacked view
  const totalTodos = items.reduce((sum, item) => sum + item.todos.length, 0)
  const completedTodos = items.reduce((sum, item) => sum + item.todos.filter(t => t.checked).length, 0)

  if (isExpanded) {
    // Expanded view - show all cards
    return (
      <div 
        className={`agenda-stack expanded animate-slide-up ${isAttachedToProject ? 'attached-to-project' : ''}`}
        style={{ animationDelay: `${delay}s` }}
      >
        {/* Header with collapse button - only show if not attached to project */}
        {!isAttachedToProject && (
          <div 
            onClick={() => setIsExpanded(false)}
            className="flex items-center justify-between p-3 mb-2 rounded-xl border border-gold-400/20 bg-gradient-to-br from-gold-400/5 to-transparent cursor-pointer hover:bg-gold-400/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderRegular className="w-4 h-4 text-gold-400" />
              <span className="text-sm font-ui font-medium text-white/90">{projectName}</span>
              <span className="text-xs text-gold-400/60 font-ui">({items.length} notes)</span>
            </div>
            <ChevronUpRegular className="w-4 h-4 text-gold-400/60" />
          </div>
        )}
        
        {/* Collapse button when attached */}
        {isAttachedToProject && (
          <div 
            onClick={() => setIsExpanded(false)}
            className="flex items-center justify-center p-2 mb-2 rounded-lg border border-gold-400/20 bg-gradient-to-br from-gold-400/5 to-transparent cursor-pointer hover:bg-gold-400/10 transition-colors"
          >
            <ChevronUpRegular className="w-4 h-4 text-gold-400/60 mr-2" />
            <span className="text-xs text-gold-400/70 font-ui">Collapse {items.length} notes</span>
          </div>
        )}
        
        {/* All cards */}
        <div className="space-y-3">
          {items.map((item, index) => (
            <AgendaItemCard
              key={`${item.projectPath}-${item.documentId}`}
              item={item}
              onOpen={() => onOpen(item)}
              onRename={(newTitle) => onRename(item, newTitle)}
              onDelete={() => onDelete(item)}
              onStateChange={(state, note) => onStateChange(item, state, note)}
              onToggleTodo={(todoId, checked) => onToggleTodo(item, todoId, checked)}
              onMarkAllDone={() => onMarkAllDone(item)}
              delay={index * 0.05}
              isAttachedToProject={isAttachedToProject}
            />
          ))}
        </div>
      </div>
    )
  }

  // Collapsed stacked view
  const topItem = items[0]
  const stackLayers = Math.min(items.length - 1, 2) // Show max 2 layers behind
  
  // Card styling based on whether attached to project
  const cardClasses = isAttachedToProject
    ? 'p-4 rounded-b-2xl rounded-t-none border border-t-0 border-gold-400/20 bg-gradient-to-br from-gold-400/[0.08] to-gold-400/[0.02] hover:from-gold-400/[0.12] hover:to-gold-400/[0.04] transition-all duration-200'
    : 'p-4 rounded-2xl border border-gold-400/20 bg-gradient-to-br from-gold-400/[0.08] to-gold-400/[0.02] hover:border-gold-400/40 hover:from-gold-400/[0.12] hover:to-gold-400/[0.04] transition-all duration-200'

  return (
    <div 
      className={`agenda-stack animate-slide-up relative ${isAttachedToProject ? 'attached-to-project' : ''}`}
      style={{ 
        animationDelay: `${delay}s`,
        paddingBottom: `${stackLayers * 8}px` // Space for stacked layers
      }}
    >
      {/* Stacked layer indicators (behind the top card) */}
      {Array.from({ length: stackLayers }).map((_, index) => (
        <div
          key={index}
          className={`agenda-stack-layer absolute inset-x-0 border border-gold-400/10 bg-gold-400/[0.03] ${isAttachedToProject ? 'rounded-b-2xl' : 'rounded-2xl'}`}
          style={{
            top: `${(index + 1) * 8}px`,
            height: 'calc(100% - 8px)',
            zIndex: stackLayers - index,
            transform: `scale(${1 - (index + 1) * 0.02})`,
            opacity: 1 - (index + 1) * 0.3
          }}
        />
      ))}
      
      {/* Top card (clickable to expand) */}
      <div 
        onClick={() => setIsExpanded(true)}
        className="relative z-10 cursor-pointer"
      >
        <div className={cardClasses}>
          {/* Project header with expand indicator - only show if not attached */}
          {!isAttachedToProject && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FolderRegular className="w-4 h-4 text-gold-400" />
                <span className="text-xs font-ui font-medium text-gold-400/80">{projectName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gold-400 font-ui font-medium px-2 py-0.5 rounded-full bg-gold-400/15 border border-gold-400/30">
                  {items.length} notes
                </span>
                <ChevronDownRegular className="w-4 h-4 text-gold-400/60" />
              </div>
            </div>
          )}
          
          {/* Notes count badge when attached */}
          {isAttachedToProject && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-gold-400 font-ui font-medium px-2 py-0.5 rounded-full bg-gold-400/15 border border-gold-400/30">
                {items.length} notes with todos
              </span>
              <ChevronDownRegular className="w-4 h-4 text-gold-400/60" />
            </div>
          )}

          {/* Preview of first item */}
          <h3 className="text-sm font-ui font-medium text-white/90 mb-2 truncate">
            {topItem.documentTitle}
          </h3>
          
          {/* Summary of all todos across items */}
          <div className="space-y-1 mb-3">
            {topItem.todos.slice(0, 2).map((todo) => (
              <div key={todo.id} className="flex items-start gap-2">
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  todo.checked 
                    ? 'bg-gold-400 border-gold-400' 
                    : 'border-gold-400/40'
                }`}>
                  {todo.checked && (
                    <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`text-xs font-ui truncate ${
                  todo.checked ? 'text-white/30 line-through' : 'text-white/70'
                }`}>
                  {todo.text}
                </span>
              </div>
            ))}
            {items.length > 1 && (
              <p className="text-[10px] text-gold-400/50 font-ui pl-5 italic">
                +{items.length - 1} more {items.length - 1 === 1 ? 'note' : 'notes'} with todos...
              </p>
            )}
          </div>

          {/* Footer with aggregate progress */}
          <div className="flex items-center justify-between pt-2 border-t border-gold-400/10">
            <span className="text-[10px] text-white/50 font-ui">
              {completedTodos}/{totalTodos} total done
            </span>
            <span className="text-[10px] text-gold-400 font-ui font-medium">
              Click to expand
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
