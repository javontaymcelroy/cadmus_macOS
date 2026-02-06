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
import type { DocumentLifecycleState } from '../../types/project'
import { stateConfigs } from '../StateDropdown'

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

import {
  DocumentRegular,
  NotebookRegular,
  EditRegular,
  VideoRegular,
  HatGraduationRegular,
  MoreHorizontalRegular,
  DeleteRegular,
  PlayCircleRegular,
  PauseCircleRegular,
  EyeRegular,
  CheckmarkCircleRegular,
  ArchiveRegular
} from '@fluentui/react-icons'

// Map template IDs to icons (same as TemplateCard)
const templateIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'basic-document': DocumentRegular,
  'notes-journal': NotebookRegular,
  'blog-post': EditRegular,
  'screenplay': VideoRegular,
  'academic-paper': HatGraduationRegular
}

// State icons for menu
const stateIcons: Record<DocumentLifecycleState, React.ComponentType<{ className?: string }>> = {
  active: PlayCircleRegular,
  paused: PauseCircleRegular,
  review: EyeRegular,
  completed: CheckmarkCircleRegular,
  archived: ArchiveRegular
}

interface RecentProjectCardProps {
  name: string
  path: string
  templateId?: string
  state?: DocumentLifecycleState
  stateNote?: string
  lastOpened?: string
  onOpen: () => void
  onRename: (newName: string) => void
  onDelete: () => void
  onStateChange?: (state: DocumentLifecycleState, note?: string) => void
  delay?: number
  hasAgendaStack?: boolean
  stackCount?: number
  onStackClick?: () => void
}

// Format date for display
const formatLastOpened = (isoDate: string): string => {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  // For older dates, show formatted date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

export function RecentProjectCard({ 
  name, 
  path, 
  templateId, 
  state = 'active', 
  stateNote,
  lastOpened,
  onOpen, 
  onRename, 
  onDelete, 
  onStateChange,
  delay = 0,
  hasAgendaStack = false,
  stackCount = 0,
  onStackClick
}: RecentProjectCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(name)
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [pendingState, setPendingState] = useState<DocumentLifecycleState | null>(null)
  const [noteInput, setNoteInput] = useState('')

  const stateConfig = stateConfigs[state]
  const isPaused = state === 'paused'

  const handleRename = () => {
    if (editName.trim() && editName !== name) {
      onRename(editName.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditName(name)
      setIsEditing(false)
    }
  }

  const handleDeleteConfirm = () => {
    onDelete()
    setIsDeleteDialogOpen(false)
  }

  const handleStateSelect = (newState: DocumentLifecycleState) => {
    if (!onStateChange) return
    
    // For paused/review, show note dialog
    if (newState === 'paused' || newState === 'review') {
      setPendingState(newState)
      setNoteInput(stateNote || '')
      setIsNoteDialogOpen(true)
    } else {
      onStateChange(newState, undefined)
    }
    setIsMenuOpen(false)
  }

  const handleNoteConfirm = () => {
    if (pendingState && onStateChange) {
      onStateChange(pendingState, noteInput.trim() || undefined)
    }
    setIsNoteDialogOpen(false)
    setPendingState(null)
    setNoteInput('')
  }

  // Truncate path for display - respect directory boundaries
  const getDisplayPath = (fullPath: string, maxLength: number = 40): string => {
    if (fullPath.length <= maxLength) return fullPath
    
    // Split into path components
    const parts = fullPath.split('/')
    
    // Try to show as many trailing path components as possible
    let result = ''
    for (let i = parts.length - 1; i >= 0; i--) {
      const newResult = parts.slice(i).join('/')
      if (newResult.length > maxLength - 3) {
        break
      }
      result = newResult
    }
    
    return result ? '.../' + result : '...' + fullPath.slice(-maxLength + 3)
  }
  
  const displayPath = getDisplayPath(path)

  return (
    <FluentProvider theme={darkTheme} style={{ background: 'transparent' }}>
      <Menu
        open={isMenuOpen}
        onOpenChange={(_, data) => setIsMenuOpen(data.open)}
        positioning="below-end"
      >
        <MenuTrigger disableButtonEnhancement>
          <div
            onContextMenu={(e) => {
              e.preventDefault()
              setIsMenuOpen(true)
            }}
            className={`text-left group animate-slide-up focus:outline-none border transition-all duration-200 rounded-2xl ${
              isPaused 
                ? 'border-theme-subtle bg-theme-tertiary opacity-70 grayscale-[30%] hover:opacity-90 hover:grayscale-0' 
                : hasAgendaStack 
                  ? 'border-theme-accent/20 bg-theme-tertiary'
                  : 'border-theme-subtle bg-theme-tertiary'
            }`}
            style={{ animationDelay: `${delay}s` }}
          >
            {/* Top portion - clickable area with hover state */}
            <div 
              onClick={isEditing ? undefined : onOpen}
              className={`project-card-top p-5 ${
                hasAgendaStack && stackCount > 0 ? 'rounded-t-2xl' : 'rounded-2xl'
              }`}
            >
              {/* Top row: Icon + State Badge + Menu button */}
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-theme-active border border-theme-subtle flex items-center justify-center shrink-0 transition-all duration-200 group-hover:border-theme-default">
                  {(() => {
                    const IconComponent = templateId ? templateIconMap[templateId] || DocumentRegular : DocumentRegular
                    return <IconComponent className="w-5 h-5 text-theme-secondary group-hover:text-theme-primary transition-colors duration-300" />
                  })()}
                </div>
                
                <div className="flex items-center gap-2">
                  {/* State badge */}
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${stateConfig.bgColor} border ${stateConfig.borderColor} transition-all duration-200`}>
                    {(() => {
                      const StateIcon = stateConfig.icon
                      return <StateIcon className={`w-3 h-3 ${stateConfig.color}`} />
                    })()}
                    <span className={`text-[10px] font-ui font-medium ${stateConfig.color}`}>
                      {stateConfig.shortLabel}
                    </span>
                  </div>
                  
                  {/* Menu button - always visible */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsMenuOpen(true)
                    }}
                    className="btn-icon-modern p-1.5 text-theme-muted hover:text-theme-primary transition-colors duration-150"
                  >
                    <MoreHorizontalRegular className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="input-modern w-full text-sm py-1 mb-2"
                  />
                ) : (
                  <h3 className="text-base font-ui font-medium text-theme-primary mb-1 group-hover:text-theme-accent transition-colors duration-300 truncate">
                    {name}
                  </h3>
                )}
                
                {/* State note */}
                {stateNote && (
                  <p className="text-xs text-theme-secondary font-ui italic mb-1 truncate">
                    "{stateNote}"
                  </p>
                )}
                
                {/* Last opened date */}
                {lastOpened && (
                  <p className="text-[11px] text-theme-muted font-ui mb-0.5">
                    {formatLastOpened(lastOpened)}
                  </p>
                )}
                
                <p className="text-xs text-theme-muted font-mono truncate group-hover:text-theme-secondary transition-colors duration-300">
                  {displayPath}
                </p>
              </div>
            </div>

            {/* Stack indicator for agenda items - separate clickable area */}
            {hasAgendaStack && stackCount > 0 && (
              <div 
                onClick={(e) => {
                  e.stopPropagation()
                  onStackClick?.()
                }}
                className="flex items-center justify-between px-5 py-3 border-t border-theme-default cursor-pointer hover:bg-theme-hover transition-colors rounded-b-2xl"
              >
                <span className="text-[10px] text-theme-accent font-ui font-medium px-2 py-0.5 rounded-full bg-theme-active border border-theme-default">
                  {stackCount} {stackCount === 1 ? 'todo' : 'todos'}
                </span>
                <span className="text-[10px] text-theme-muted font-ui hover:text-theme-accent transition-colors">
                  Click to expand
                </span>
              </div>
            )}
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
            {onStateChange && (
              <>
                <MenuDivider style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
                {(Object.keys(stateConfigs) as DocumentLifecycleState[]).map((stateOption) => {
                  const config = stateConfigs[stateOption]
                  const StateIcon = stateIcons[stateOption]
                  const isCurrentState = stateOption === state
                  
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
              </>
            )}
            
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
            <DialogTitle style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Move to Trash?</DialogTitle>
            <DialogContent style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Are you sure you want to delete "{name}"? The project folder will be moved to Trash and can be recovered from there.
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
                Delete
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
              {pendingState === 'paused' ? 'Pause Project' : 'Mark for Review'}
            </DialogTitle>
            <DialogContent style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              <p className="mb-4">
                {pendingState === 'paused' 
                  ? 'Add an optional note about why this project is paused.'
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
