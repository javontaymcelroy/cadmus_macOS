import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import type { Prop } from '../../types/project'
import {
  DeleteRegular,
  CheckmarkRegular,
  DismissRegular,
  NoteRegular,
  EditRegular,
  ArrowSyncRegular,
  // Prop icons - Story Elements
  // Location/Setting
  HomeRegular,
  BuildingRegular,
  GlobeRegular,
  LocationRegular,
  // Objects/Physical Props
  DiamondRegular,
  KeyRegular,
  BoxRegular,
  DocumentRegular,
  // Time
  HourglassRegular,
  TimerRegular,
  CalendarClockRegular,
  // Rules/Systems
  GavelRegular,
  ScalesRegular,
  ShieldRegular,
  LockClosedRegular,
  // Information
  InfoRegular,
  EyeRegular,
  SearchRegular,
  BookInformationRegular,
  // Status/Identity
  CrownRegular,
  BadgeRegular,
  PersonRegular,
  TargetRegular,
  // Relationships
  PeopleRegular,
  LinkRegular,
  HeartRegular,
  HandshakeRegular,
  // Emotional States
  BrainRegular,
  HeartBrokenRegular,
  WarningRegular,
  FireRegular,
  // Environment
  WeatherRainRegular,
  WeatherSunnyRegular,
  WeatherThunderstormRegular,
  WeatherFogRegular,
  // Absence/Mystery
  QuestionCircleRegular,
  EyeOffRegular,
  ProhibitedRegular,
  CircleRegular
} from '@fluentui/react-icons'
import type { FluentIcon } from '@fluentui/react-icons'

// Icon name to component mapping for props - organized by story element category
export const PROP_ICON_MAP: Record<string, FluentIcon> = {
  // Location/Setting - where the story happens
  'Home': HomeRegular,
  'Building': BuildingRegular,
  'Globe': GlobeRegular,
  'Location': LocationRegular,
  // Objects/Physical Props - tangible items
  'Diamond': DiamondRegular,
  'Key': KeyRegular,
  'Box': BoxRegular,
  'Document': DocumentRegular,
  // Time - deadlines, countdowns, temporal pressure
  'Hourglass': HourglassRegular,
  'Timer': TimerRegular,
  'Deadline': CalendarClockRegular,
  // Rules/Systems - laws, codes, constraints
  'Gavel': GavelRegular,
  'Scales': ScalesRegular,
  'Shield': ShieldRegular,
  'Lock': LockClosedRegular,
  // Information - secrets, knowledge, leverage
  'Info': InfoRegular,
  'Eye': EyeRegular,
  'Search': SearchRegular,
  'Knowledge': BookInformationRegular,
  // Status/Identity - titles, reputation, roles
  'Crown': CrownRegular,
  'Badge': BadgeRegular,
  'Identity': PersonRegular,
  'Target': TargetRegular,
  // Relationships - bonds that strain or snap
  'People': PeopleRegular,
  'Link': LinkRegular,
  'Heart': HeartRegular,
  'Bond': HandshakeRegular,
  // Emotional States - conditions characters operate under
  'Mind': BrainRegular,
  'Heartbreak': HeartBrokenRegular,
  'Tension': WarningRegular,
  'Passion': FireRegular,
  // Environment - conditions applied to scenes
  'Rain': WeatherRainRegular,
  'Sun': WeatherSunnyRegular,
  'Storm': WeatherThunderstormRegular,
  'Fog': WeatherFogRegular,
  // Absence/Mystery - voids doing narrative work
  'Unknown': QuestionCircleRegular,
  'Hidden': EyeOffRegular,
  'Forbidden': ProhibitedRegular,
  'Void': CircleRegular
}

// Helper to get icon component by name
export function getPropIconComponent(iconName: string): FluentIcon {
  return PROP_ICON_MAP[iconName] || DiamondRegular
}

// Icon names for the picker
const ICON_OPTIONS = Object.keys(PROP_ICON_MAP)

interface IconPickerProps {
  currentIcon: string
  onIconSelect: (icon: string) => void
  onClose: () => void
}

function IconPicker({ currentIcon, onIconSelect, onClose }: IconPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={pickerRef}
      className="absolute left-0 top-10 p-3 bg-theme-elevated border border-theme-default rounded-lg shadow-2xl"
      style={{ zIndex: 9999, width: '220px' }}
    >
      <div className="grid grid-cols-5 gap-2">
        {ICON_OPTIONS.map(iconName => {
          const IconComponent = PROP_ICON_MAP[iconName]
          return (
            <button
              key={iconName}
              onClick={() => {
                onIconSelect(iconName)
                onClose()
              }}
              className={clsx(
                'w-8 h-8 rounded-md border-2 transition-all hover:scale-110 flex-shrink-0 flex items-center justify-center',
                iconName === currentIcon 
                  ? 'border-theme-accent bg-theme-active text-theme-accent' 
                  : 'border-theme-default hover:border-theme-strong text-theme-secondary hover:text-theme-primary bg-theme-tertiary'
              )}
              title={iconName}
            >
              <IconComponent className="w-4 h-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface PropItemProps {
  prop: Prop
  onUpdate: (id: string, updates: Partial<Omit<Prop, 'id'>>) => void
  onDelete: (id: string) => void
  onNavigateToNote: (id: string) => void
}

function PropItem({ prop, onUpdate, onDelete, onNavigateToNote }: PropItemProps) {
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(prop.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSaveName = () => {
    const trimmedName = editName.trim()
    if (trimmedName && trimmedName !== prop.name) {
      onUpdate(prop.id, { name: trimmedName })
    } else {
      setEditName(prop.name)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName()
    } else if (e.key === 'Escape') {
      setEditName(prop.name)
      setIsEditing(false)
    }
  }

  // Check if prop has a linked note document
  const hasNote = !!prop.noteDocumentId
  const IconComponent = getPropIconComponent(prop.icon)

  return (
    <div className="list-item-modern flex items-center gap-3 p-2.5 group relative">
      {/* Icon button - clickable to change */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="w-8 h-8 rounded-lg border-2 border-theme-default hover:border-theme-strong transition-colors flex items-center justify-center bg-theme-active"
          title="Change icon"
        >
          <IconComponent className="w-4 h-4 text-theme-accent" />
        </button>
        {showIconPicker && (
          <IconPicker
            currentIcon={prop.icon}
            onIconSelect={(icon) => onUpdate(prop.id, { icon })}
            onClose={() => setShowIconPicker(false)}
          />
        )}
      </div>

      {/* Prop name - click to navigate to notes */}
      {isEditing ? (
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleKeyDown}
            className="input-modern w-full text-sm font-ui font-medium pl-2 pr-16 py-1.5"
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <button
              onClick={handleSaveName}
              className="p-1 text-green-500 hover:text-green-600"
            >
              <CheckmarkRegular className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setEditName(prop.name)
                setIsEditing(false)
              }}
              className="p-1 text-theme-muted hover:text-theme-primary"
            >
              <DismissRegular className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span
            onClick={() => hasNote && onNavigateToNote(prop.id)}
            className={clsx(
              'text-sm font-semibold transition-colors truncate text-theme-accent',
              hasNote 
                ? 'cursor-pointer hover:opacity-80' 
                : 'cursor-default'
            )}
            style={{ fontFamily: 'Courier New, Courier, monospace' }}
            title={hasNote ? 'Click to view prop notes' : prop.name}
          >
            {prop.name}
          </span>
          {/* Note indicator */}
          {hasNote && (
            <NoteRegular 
              className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" 
              title="Has prop notes"
            />
          )}
        </div>
      )}

      {/* Action buttons */}
      {!isEditing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Edit button */}
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 text-theme-muted hover:text-theme-primary transition-all"
            title="Rename prop"
          >
            <EditRegular className="w-4 h-4" />
          </button>
          {/* Delete button */}
          <button
            onClick={() => onDelete(prop.id)}
            className="p-1.5 text-theme-muted hover:text-red-500 transition-all"
            title="Delete prop"
          >
            <DeleteRegular className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export function PropsPanel() {
  const { 
    currentProject, 
    addProp,
    updateProp,
    removeProp,
    navigateToPropNote,
    activeDocumentId,
    updateDocumentPropStyling
  } = useProjectStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync prop names to the active document
  const handleSyncToEditor = () => {
    if (!activeDocumentId) return
    setIsSyncing(true)
    updateDocumentPropStyling(activeDocumentId)
    // Brief visual feedback
    setTimeout(() => setIsSyncing(false), 500)
  }

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  if (!currentProject) return null

  const props = currentProject.props || []

  const handleAddProp = async () => {
    const trimmedName = newName.trim()
    if (trimmedName) {
      await addProp(trimmedName)
      setNewName('')
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddProp()
    } else if (e.key === 'Escape') {
      setNewName('')
      setIsAdding(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-theme-subtle bg-theme-header">
        <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
          Props
        </h2>
        <div className="flex items-center gap-2">
          {activeDocumentId && (
            <button
              onClick={handleSyncToEditor}
              disabled={isSyncing}
              className={clsx(
                "p-1 rounded transition-all",
                isSyncing 
                  ? "text-theme-accent animate-spin" 
                  : "text-theme-muted hover:text-theme-primary hover:bg-theme-hover"
              )}
              title="Sync to editor"
            >
              <ArrowSyncRegular className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs text-theme-muted font-ui">
            {props.length} {props.length === 1 ? 'prop' : 'props'}
          </span>
        </div>
      </div>

      {/* Props list */}
      <div className="flex-1 overflow-auto p-3">
        {props.length === 0 && !isAdding ? (
          <div className="text-center p-8">
            <div className="w-14 h-14 rounded-full bg-theme-hover flex items-center justify-center mx-auto mb-4">
              <BoxRegular className="w-7 h-7 text-theme-muted" />
            </div>
            <p className="text-sm text-theme-secondary font-ui font-medium mb-2">
              No props yet
            </p>
            <p className="text-xs text-theme-muted font-ui mb-4">
              Add props to track important items
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="text-sm text-theme-accent font-ui font-medium transition-colors hover:opacity-80"
            >
              + Add first prop
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {props.map(prop => (
              <PropItem
                key={prop.id}
                prop={prop}
                onUpdate={updateProp}
                onDelete={removeProp}
                onNavigateToNote={navigateToPropNote}
              />
            ))}

            {/* Add new prop form */}
            {isAdding && (
              <div className="list-item-modern flex items-center gap-3 p-2.5">
                <div className="w-8 h-8 rounded-lg border-2 border-theme-default flex items-center justify-center flex-shrink-0 bg-theme-active">
                  <BoxRegular className="w-4 h-4 text-theme-accent" />
                </div>
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Prop name..."
                    className="input-modern w-full text-sm font-ui font-medium pl-2 pr-16 py-1.5"
                    style={{ fontFamily: 'Courier New, Courier, monospace' }}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button
                      onClick={handleAddProp}
                      disabled={!newName.trim()}
                      className="p-1 text-green-500 hover:text-green-600 disabled:text-theme-muted disabled:cursor-not-allowed"
                    >
                      <CheckmarkRegular className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setNewName('')
                        setIsAdding(false)
                      }}
                      className="p-1 text-theme-muted hover:text-theme-primary"
                    >
                      <DismissRegular className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add more button */}
            {!isAdding && props.length > 0 && (
              <div className="pt-3 text-center">
                <button
                  onClick={() => setIsAdding(true)}
                  className="text-xs text-theme-muted hover:text-theme-accent font-ui font-medium transition-colors"
                >
                  + Add prop
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
