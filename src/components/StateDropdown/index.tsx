import { useState, useRef, useEffect } from 'react'
import {
  ChevronDownRegular,
  PlayCircleRegular,
  PauseCircleRegular,
  EyeRegular,
  CheckmarkCircleRegular,
  ArchiveRegular
} from '@fluentui/react-icons'
import type { DocumentLifecycleState } from '../../types/project'

interface StateConfig {
  label: string
  shortLabel: string
  color: string
  bgColor: string
  borderColor: string
  icon: React.ComponentType<{ className?: string }>
}

const stateConfigs: Record<DocumentLifecycleState, StateConfig> = {
  active: {
    label: 'Active (WIP)',
    shortLabel: 'Active',
    color: 'text-black',
    bgColor: 'bg-amber-400',
    borderColor: 'border-amber-500',
    icon: PlayCircleRegular
  },
  paused: {
    label: 'Paused',
    shortLabel: 'Paused',
    color: 'text-black',
    bgColor: 'bg-gray-400',
    borderColor: 'border-gray-500',
    icon: PauseCircleRegular
  },
  review: {
    label: 'Ready for Review',
    shortLabel: 'Review',
    color: 'text-black',
    bgColor: 'bg-blue-400',
    borderColor: 'border-blue-500',
    icon: EyeRegular
  },
  completed: {
    label: 'Completed',
    shortLabel: 'Done',
    color: 'text-black',
    bgColor: 'bg-green-400',
    borderColor: 'border-green-500',
    icon: CheckmarkCircleRegular
  },
  archived: {
    label: 'Archived',
    shortLabel: 'Archived',
    color: 'text-black',
    bgColor: 'bg-gray-300',
    borderColor: 'border-gray-400',
    icon: ArchiveRegular
  }
}

interface StateDropdownProps {
  value: DocumentLifecycleState
  stateNote?: string
  onChange: (state: DocumentLifecycleState, note?: string) => void
  compact?: boolean // For use in cards vs editor
  showNote?: boolean // Whether to show/edit the note
}

export function StateDropdown({ 
  value, 
  stateNote, 
  onChange, 
  compact = false,
  showNote = true 
}: StateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(stateNote || '')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const noteInputRef = useRef<HTMLInputElement>(null)

  const config = stateConfigs[value]
  const Icon = config.icon

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setEditingNote(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus note input when editing starts
  useEffect(() => {
    if (editingNote && noteInputRef.current) {
      noteInputRef.current.focus()
    }
  }, [editingNote])

  // Update noteValue when stateNote prop changes
  useEffect(() => {
    setNoteValue(stateNote || '')
  }, [stateNote])

  const handleStateSelect = (newState: DocumentLifecycleState) => {
    if (newState === value) {
      setIsOpen(false)
      return
    }
    
    // When changing state, clear the note unless it's paused/review where notes are common
    if (newState === 'active' || newState === 'completed' || newState === 'archived') {
      onChange(newState, undefined)
      setNoteValue('')
    } else {
      // For paused/review, prompt for note
      setEditingNote(true)
      onChange(newState, noteValue || undefined)
    }
    setIsOpen(false)
  }

  const handleNoteSave = () => {
    onChange(value, noteValue.trim() || undefined)
    setEditingNote(false)
  }

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNoteSave()
    } else if (e.key === 'Escape') {
      setNoteValue(stateNote || '')
      setEditingNote(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all
          ${config.bgColor} ${config.borderColor}
          hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]
          text-xs
        `}
      >
        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        <span className={`font-ui font-medium ${config.color}`}>
          {compact ? config.shortLabel : config.label}
        </span>
        <ChevronDownRegular className={`w-3 h-3 ${config.color} transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu - aligned right to prevent clipping */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-48 py-1 rounded-lg border border-theme-default bg-theme-elevated backdrop-blur-sm shadow-xl">
          {(Object.keys(stateConfigs) as DocumentLifecycleState[]).map((state) => {
            const stateConfig = stateConfigs[state]
            const StateIcon = stateConfig.icon
            const isSelected = state === value
            
            return (
              <button
                key={state}
                onClick={() => handleStateSelect(state)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                  ${isSelected ? 'bg-theme-active' : 'hover:bg-theme-hover'}
                `}
              >
                <StateIcon className={`w-4 h-4 ${stateConfig.color}`} />
                <span className={`text-sm font-ui ${isSelected ? 'text-theme-primary' : 'text-theme-secondary'}`}>
                  {stateConfig.label}
                </span>
                {isSelected && (
                  <CheckmarkCircleRegular className="w-4 h-4 text-theme-accent ml-auto" />
                )}
              </button>
            )
          })}

          {/* Note input section */}
          {showNote && (value === 'paused' || value === 'review') && (
            <div className="border-t border-theme-subtle mt-1 pt-1 px-3 py-2">
              <label className="text-xs text-theme-muted font-ui mb-1 block">
                Add a note (optional)
              </label>
              <input
                ref={noteInputRef}
                type="text"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                onKeyDown={handleNoteKeyDown}
                onBlur={handleNoteSave}
                placeholder="e.g., waiting on feedback"
                className="input-modern w-full px-2 py-1.5 text-xs font-ui"
              />
            </div>
          )}
        </div>
      )}

      {/* Display note below if exists and not editing */}
      {showNote && stateNote && !editingNote && !compact && (
        <button
          onClick={() => setEditingNote(true)}
          className="mt-1 text-xs text-theme-muted italic hover:text-theme-secondary transition-colors cursor-pointer"
        >
          "{stateNote}"
        </button>
      )}
    </div>
  )
}

// Export state configs for use in other components (like badges)
export { stateConfigs }
export type { StateConfig }
