import { useState } from 'react'
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  FluentProvider,
  createDarkTheme
} from '@fluentui/react-components'
import type { BrandVariants } from '@fluentui/react-components'
import type { AgendaItem, TodoItem, DocumentLifecycleState } from '../../types/project'
import { stateConfigs } from '../StateDropdown'
import {
  MoreHorizontalRegular,
  DeleteRegular,
  EditRegular,
  PlayCircleRegular,
  PauseCircleRegular,
  EyeRegular,
  CheckmarkCircleRegular,
  ArchiveRegular,
  CheckmarkRegular
} from '@fluentui/react-icons'

// Custom brand colors matching the gold theme
const customBrand: BrandVariants = {
  10: '#1a1a1a',
  20: '#1a1a1a',
  30: '#1a1a1a',
  40: '#1a1a1a',
  50: '#1a1a1a',
  60: '#1a1a1a',
  70: '#fbbf24',
  80: '#fbbf24',
  90: '#fbbf24',
  100: '#fbbf24',
  110: '#fbbf24',
  120: '#fbbf24',
  130: '#fbbf24',
  140: '#fbbf24',
  150: '#fbbf24',
  160: '#fbbf24'
}

const darkTheme = {
  ...createDarkTheme(customBrand),
  colorNeutralBackground1: 'transparent',
  colorNeutralBackground1Hover: '#2a2a2a',
  colorNeutralBackground1Pressed: '#333333',
  colorNeutralBackground2: 'transparent',
  colorNeutralBackground3: 'transparent',
  colorSubtleBackground: 'transparent',
  colorSubtleBackgroundHover: '#2a2a2a',
  colorNeutralForeground1: '#ffffff',
  colorNeutralForeground2: 'rgba(255,255,255,0.8)',
  colorNeutralStroke1: '#333333'
}

// State icons for menu
const stateIcons: Record<DocumentLifecycleState, React.ComponentType<{ className?: string }>> = {
  active: PlayCircleRegular,
  paused: PauseCircleRegular,
  review: EyeRegular,
  completed: CheckmarkCircleRegular,
  archived: ArchiveRegular
}

interface AgendaItemCardProps {
  item: AgendaItem
  onOpen: () => void
  onRename: (newTitle: string) => void
  onDelete: () => void
  onStateChange: (state: DocumentLifecycleState, note?: string) => void
  onToggleTodo: (todoId: string, checked: boolean) => void
  onMarkAllDone: () => void
  delay?: number
  isAttachedToProject?: boolean
}

export function AgendaItemCard({
  item,
  onOpen,
  onRename,
  onDelete,
  onStateChange,
  onToggleTodo,
  onMarkAllDone,
  delay = 0,
  isAttachedToProject = false
}: AgendaItemCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(item.documentTitle)
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [pendingState, setPendingState] = useState<DocumentLifecycleState | null>(null)
  const [noteInput, setNoteInput] = useState('')

  const stateConfig = stateConfigs[item.state]
  const isPaused = item.state === 'paused'
  
  // Calculate progress
  const completedCount = item.todos.filter(t => t.checked).length
  const totalCount = item.todos.length
  const allDone = completedCount === totalCount

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== item.documentTitle) {
      onRename(editTitle.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditTitle(item.documentTitle)
      setIsEditing(false)
    }
  }

  const handleDeleteConfirm = () => {
    onDelete()
    setIsDeleteDialogOpen(false)
  }

  const handleStateSelect = (newState: DocumentLifecycleState) => {
    // For paused/review, show note dialog
    if (newState === 'paused' || newState === 'review') {
      setPendingState(newState)
      setNoteInput(item.stateNote || '')
      setIsNoteDialogOpen(true)
    } else {
      onStateChange(newState, undefined)
    }
    setIsMenuOpen(false)
  }

  const handleNoteConfirm = () => {
    if (pendingState) {
      onStateChange(pendingState, noteInput.trim() || undefined)
    }
    setIsNoteDialogOpen(false)
    setPendingState(null)
    setNoteInput('')
  }

  const handleTodoClick = (e: React.MouseEvent, todo: TodoItem) => {
    e.stopPropagation()
    onToggleTodo(todo.id, !todo.checked)
  }

  return (
    <FluentProvider theme={darkTheme} style={{ background: 'transparent' }}>
      <Menu
        open={isMenuOpen}
        onOpenChange={(_, data) => setIsMenuOpen(data.open)}
        positioning="below-end"
      >
        <MenuTrigger disableButtonEnhancement>
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onContextMenu={(e) => {
              e.preventDefault()
              setIsMenuOpen(true)
            }}
            onClick={isEditing ? undefined : onOpen}
            className={`p-4 text-left group animate-slide-up focus:outline-none cursor-pointer border transition-all duration-200 flex flex-col ${
              isAttachedToProject ? 'rounded-xl' : 'rounded-2xl'
            } ${
              isPaused 
                ? 'border-gold-400/10 bg-gradient-to-br from-gold-400/[0.03] to-transparent opacity-70 grayscale-[30%] hover:opacity-90 hover:grayscale-0' 
                : 'border-gold-400/20 bg-gradient-to-br from-gold-400/[0.08] to-gold-400/[0.02] hover:border-gold-400/40 hover:from-gold-400/[0.12] hover:to-gold-400/[0.04]'
            }`}
            style={{ animationDelay: `${delay}s` }}
          >
            {/* Top row: Project name (if not attached) + State Badge + Menu button */}
            <div className="flex items-start justify-between mb-2">
              {!isAttachedToProject && (
                <p className="text-[10px] text-gold-400/60 font-ui truncate">
                  {item.projectName}
                </p>
              )}
              {isAttachedToProject && <div />}
              
              <div className="flex items-center gap-2">
                {/* State badge */}
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${stateConfig.bgColor} border ${stateConfig.borderColor}`}>
                  {(() => {
                    const StateIcon = stateConfig.icon
                    return <StateIcon className={`w-3 h-3 ${stateConfig.color}`} />
                  })()}
                  <span className={`text-[10px] font-ui font-medium ${stateConfig.color}`}>
                    {stateConfig.shortLabel}
                  </span>
                </div>
                
                {/* Menu button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsMenuOpen(true)
                  }}
                  className={`btn-icon-modern p-1 transition-opacity duration-150 ${
                    (isHovered || isMenuOpen) && !isEditing ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  <MoreHorizontalRegular className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Document title */}
            <div className="mb-3">
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="input-modern w-full text-sm py-1"
                />
              ) : (
                <h3 className="text-sm font-ui font-medium text-white/90 group-hover:text-white transition-colors duration-300 truncate">
                  {item.documentTitle}
                </h3>
              )}
              
              {/* State note */}
              {item.stateNote && (
                <p className="text-[10px] text-white/40 font-ui italic mt-1 truncate">
                  "{item.stateNote}"
                </p>
              )}
            </div>

            {/* Todo checklist */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                {item.todos.slice(0, 5).map((todo) => (
                  <div
                    key={todo.id}
                    onClick={(e) => handleTodoClick(e, todo)}
                    className="flex items-start gap-2 group/todo cursor-pointer"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      todo.checked 
                        ? 'bg-gold-400 border-gold-400' 
                        : 'border-white/30 group-hover/todo:border-gold-400'
                    }`}>
                      {todo.checked && (
                        <CheckmarkRegular className="w-3 h-3 text-black" />
                      )}
                    </div>
                    <span className={`text-xs font-ui leading-tight ${
                      todo.checked 
                        ? 'text-white/40 line-through' 
                        : 'text-white/70 group-hover/todo:text-white/90'
                    }`}>
                      {todo.text}
                    </span>
                  </div>
                ))}
                {item.todos.length > 5 && (
                  <p className="text-[10px] text-white/40 font-ui pl-6">
                    +{item.todos.length - 5} more
                  </p>
                )}
              </div>
            </div>

            {/* Footer: Progress + Mark all done */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.06]">
              <span className="text-[10px] text-white/40 font-ui">
                {completedCount}/{totalCount} done
              </span>
              
              {!allDone && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onMarkAllDone()
                  }}
                  className="text-[10px] text-gold-400/70 hover:text-gold-400 font-ui font-medium transition-colors"
                >
                  Mark all done
                </button>
              )}
              
              {allDone && (
                <span className="text-[10px] text-green-400/70 font-ui font-medium flex items-center gap-1">
                  <CheckmarkCircleRegular className="w-3 h-3" />
                  Complete
                </span>
              )}
            </div>
          </div>
        </MenuTrigger>

        <MenuPopover style={{ 
          background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.98) 0%, rgba(18, 18, 18, 0.99) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)', 
          borderRadius: '12px',
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05), 0 4px 24px rgba(0, 0, 0, 0.5), 0 8px 48px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(20px)'
        }}>
          <MenuList style={{ backgroundColor: 'transparent' }}>
            <MenuItem
              icon={<EditRegular />}
              onClick={(e) => {
                e.stopPropagation()
                setIsEditing(true)
                setIsMenuOpen(false)
              }}
              style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.8)' }}
            >
              Rename
            </MenuItem>
            
            {/* State change options */}
            <MenuDivider style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            {(Object.keys(stateConfigs) as DocumentLifecycleState[]).map((stateOption) => {
              const config = stateConfigs[stateOption]
              const StateIcon = stateIcons[stateOption]
              const isCurrentState = stateOption === item.state
              
              return (
                <MenuItem
                  key={stateOption}
                  icon={<StateIcon />}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isCurrentState) {
                      handleStateSelect(stateOption)
                    }
                  }}
                  style={{ 
                    backgroundColor: isCurrentState ? 'rgba(255,255,255,0.05)' : 'transparent', 
                    color: isCurrentState ? 'rgba(251,191,36,0.9)' : 'rgba(255,255,255,0.8)'
                  }}
                >
                  {config.label}
                </MenuItem>
              )
            })}
            <MenuDivider style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            
            <MenuItem
              icon={<DeleteRegular />}
              onClick={(e) => {
                e.stopPropagation()
                setIsDeleteDialogOpen(true)
                setIsMenuOpen(false)
              }}
              style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.8)' }}
            >
              Delete
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(_, data) => setIsDeleteDialogOpen(data.open)}
      >
        <DialogSurface style={{ 
          background: 'linear-gradient(135deg, rgba(18, 18, 18, 0.98) 0%, rgba(10, 10, 10, 0.99) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05), 0 8px 40px rgba(0, 0, 0, 0.6)'
        }}>
          <DialogBody>
            <DialogTitle style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Remove from Agenda?</DialogTitle>
            <DialogContent style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Are you sure you want to remove "{item.documentTitle}" from your agenda? The todos will remain in the document.
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setIsDeleteDialogOpen(false)}
                style={{ 
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: 'rgba(255,255,255,0.8)'
                }}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleDeleteConfirm}
                style={{ 
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#050505',
                  borderRadius: '10px',
                  fontWeight: 600
                }}
              >
                Remove
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* State Note Dialog */}
      <Dialog
        open={isNoteDialogOpen}
        onOpenChange={(_, data) => {
          setIsNoteDialogOpen(data.open)
          if (!data.open) {
            setPendingState(null)
            setNoteInput('')
          }
        }}
      >
        <DialogSurface style={{ 
          background: 'linear-gradient(135deg, rgba(18, 18, 18, 0.98) 0%, rgba(10, 10, 10, 0.99) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.05), 0 8px 40px rgba(0, 0, 0, 0.6)'
        }}>
          <DialogBody>
            <DialogTitle style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
              {pendingState === 'paused' ? 'Pause Item' : 'Mark for Review'}
            </DialogTitle>
            <DialogContent style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              <p className="mb-4">
                {pendingState === 'paused' 
                  ? 'Add an optional note about why this is paused.'
                  : 'Add an optional note about what needs review.'}
              </p>
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={pendingState === 'paused' ? 'e.g., waiting on feedback' : 'e.g., needs final review'}
                className="w-full px-3 py-2 text-sm font-ui text-white bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-gold-400/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleNoteConfirm()
                  }
                }}
                autoFocus
              />
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => {
                  setIsNoteDialogOpen(false)
                  setPendingState(null)
                  setNoteInput('')
                }}
                style={{ 
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: 'rgba(255,255,255,0.8)'
                }}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleNoteConfirm}
                style={{ 
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#050505',
                  borderRadius: '10px',
                  fontWeight: 600
                }}
              >
                {pendingState === 'paused' ? 'Pause' : 'Mark for Review'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </FluentProvider>
  )
}
