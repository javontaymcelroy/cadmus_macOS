import { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import type { Character } from '../../types/project'
import {
  DeleteRegular,
  PersonRegular,
  CheckmarkRegular,
  DismissRegular,
  NoteRegular,
  EditRegular,
  ArrowSyncRegular
} from '@fluentui/react-icons'

// Helper to determine if a color is light (needs dark icon) or dark (needs light icon)
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

// Expanded color palette for characters - organized by tone/use
const COLOR_PALETTE = [
  // Row 1: Warm/Hero colors
  '#fbbf24', // Gold (default/brand)
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#fb923c', // Light Orange
  '#fcd34d', // Yellow
  
  // Row 2: Danger/Villain colors
  '#ef4444', // Red
  '#dc2626', // Dark Red
  '#b91c1c', // Crimson
  '#f87171', // Light Red
  '#fca5a5', // Soft Red
  
  // Row 3: Nature/Ally colors
  '#22c55e', // Green
  '#16a34a', // Dark Green
  '#4ade80', // Light Green
  '#14b8a6', // Teal
  '#2dd4bf', // Light Teal
  
  // Row 4: Cool/Neutral colors
  '#3b82f6', // Blue
  '#2563eb', // Dark Blue
  '#60a5fa', // Light Blue
  '#06b6d4', // Cyan
  '#22d3ee', // Light Cyan
  
  // Row 5: Mystery/Royal colors
  '#8b5cf6', // Purple
  '#7c3aed', // Dark Purple
  '#a78bfa', // Light Purple
  '#ec4899', // Pink
  '#f472b6', // Light Pink
  
  // Row 6: Neutral/Supporting colors
  '#64748b', // Slate
  '#475569', // Dark Slate
  '#94a3b8', // Light Slate
  '#6b7280', // Gray
  '#9ca3af', // Light Gray
  
  // Row 7: Earth tones
  '#92400e', // Brown
  '#a16207', // Dark Gold
  '#ca8a04', // Olive Gold
  '#854d0e', // Dark Brown
  '#d97706', // Burnt Orange
  
  // Row 8: Special
  '#0f172a', // Near Black
  '#1e293b', // Dark Navy
  '#334155', // Charcoal
  '#e2e8f0', // Light Gray
  '#ffffff', // White
]

interface ColorPickerProps {
  currentColor: string
  onColorSelect: (color: string) => void
  onClose: () => void
}

function ColorPicker({ currentColor, onColorSelect, onClose }: ColorPickerProps) {
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
      <div className="grid grid-cols-5 gap-1.5">
        {COLOR_PALETTE.map(color => (
          <button
            key={color}
            onClick={() => {
              onColorSelect(color)
              onClose()
            }}
            className={clsx(
              'w-8 h-8 rounded-md border-2 transition-all hover:scale-110 flex-shrink-0',
              color === currentColor ? 'border-theme-strong ring-2 ring-theme-accent/30' : 'border-transparent hover:border-theme-subtle'
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  )
}

interface CharacterItemProps {
  character: Character
  onUpdate: (id: string, updates: Partial<Omit<Character, 'id'>>) => void
  onDelete: (id: string) => void
  onNavigateToNote: (id: string) => void
}

function CharacterItem({ character, onUpdate, onDelete, onNavigateToNote }: CharacterItemProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(character.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSaveName = () => {
    const trimmedName = editName.trim()
    if (trimmedName && trimmedName !== character.name) {
      onUpdate(character.id, { name: trimmedName })
    } else {
      setEditName(character.name)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName()
    } else if (e.key === 'Escape') {
      setEditName(character.name)
      setIsEditing(false)
    }
  }

  // Check if character has a linked note document
  const hasNote = !!character.noteDocumentId

  // Determine icon color based on background brightness
  const iconColorClass = isLightColor(character.color) ? 'text-gray-800' : 'text-white'

  return (
    <div className="list-item-modern flex items-center gap-3 p-2.5 group relative">
      {/* Color swatch - clickable to change */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-8 h-8 rounded-lg border-2 border-theme-subtle hover:border-theme-default transition-colors flex items-center justify-center"
          style={{ backgroundColor: character.color }}
          title="Change color"
        >
          <PersonRegular className={clsx('w-4 h-4', iconColorClass)} />
        </button>
        {showColorPicker && (
          <ColorPicker
            currentColor={character.color}
            onColorSelect={(color) => onUpdate(character.id, { color })}
            onClose={() => setShowColorPicker(false)}
          />
        )}
      </div>

      {/* Character name - click to navigate to notes */}
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
                setEditName(character.name)
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
            onClick={() => hasNote && onNavigateToNote(character.id)}
            className={clsx(
              'text-sm font-semibold transition-colors truncate',
              hasNote 
                ? 'cursor-pointer hover:opacity-80' 
                : 'cursor-default'
            )}
            style={{ 
              color: character.color,
              fontFamily: 'Courier New, Courier, monospace'
            }}
            title={hasNote ? 'Click to view character notes' : character.name}
          >
            {character.name}
          </span>
          {/* Note indicator */}
          {hasNote && (
            <NoteRegular 
              className="w-3.5 h-3.5 text-theme-muted flex-shrink-0" 
              title="Has character notes"
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
            title="Rename character"
          >
            <EditRegular className="w-4 h-4" />
          </button>
          {/* Delete button */}
          <button
            onClick={() => onDelete(character.id)}
            className="p-1.5 text-theme-muted hover:text-red-500 transition-all"
            title="Delete character"
          >
            <DeleteRegular className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export function CharactersPanel() {
  const { 
    currentProject, 
    addCharacter, 
    updateCharacter, 
    removeCharacter, 
    navigateToCharacterNote,
    activeDocumentId,
    updateDocumentCharacterStyling 
  } = useProjectStore()
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync character colors/names to the active document
  const handleSyncToEditor = () => {
    if (!activeDocumentId) return
    setIsSyncing(true)
    updateDocumentCharacterStyling(activeDocumentId)
    // Brief visual feedback
    setTimeout(() => setIsSyncing(false), 500)
  }

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  if (!currentProject) return null

  const characters = currentProject.characters || []

  const handleAddCharacter = async () => {
    const trimmedName = newName.trim()
    if (trimmedName) {
      await addCharacter(trimmedName)
      setNewName('')
      setIsAdding(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddCharacter()
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
          Characters
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
              title="Sync colors to editor"
            >
              <ArrowSyncRegular className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs text-theme-muted font-ui">
            {characters.length} {characters.length === 1 ? 'character' : 'characters'}
          </span>
        </div>
      </div>

      {/* Character list */}
      <div className="flex-1 overflow-auto p-3">
        {characters.length === 0 && !isAdding ? (
          <div className="text-center p-8">
            <div className="w-14 h-14 rounded-full bg-theme-hover flex items-center justify-center mx-auto mb-4">
              <PersonRegular className="w-7 h-7 text-theme-muted" />
            </div>
            <p className="text-sm text-theme-secondary font-ui font-medium mb-2">
              No characters yet
            </p>
            <p className="text-xs text-theme-muted font-ui mb-4">
              Add characters to assign colors
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="text-sm text-theme-accent font-ui font-medium transition-colors hover:opacity-80"
            >
              + Add first character
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {characters.map(character => (
              <CharacterItem
                key={character.id}
                character={character}
                onUpdate={updateCharacter}
                onDelete={removeCharacter}
                onNavigateToNote={navigateToCharacterNote}
              />
            ))}

            {/* Add new character form */}
            {isAdding && (
              <div className="list-item-modern flex items-center gap-3 p-2.5">
                <div
                  className="w-8 h-8 rounded-lg border-2 border-theme-default flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#fbbf24' }}
                >
                  <PersonRegular className="w-4 h-4 text-gray-800" />
                </div>
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Character name..."
                    className="input-modern w-full text-sm font-ui font-medium pl-2 pr-16 py-1.5"
                    style={{ fontFamily: 'Courier New, Courier, monospace' }}
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button
                      onClick={handleAddCharacter}
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
            {!isAdding && characters.length > 0 && (
              <div className="pt-3 text-center">
                <button
                  onClick={() => setIsAdding(true)}
                  className="text-xs text-theme-muted hover:text-theme-accent font-ui font-medium transition-colors"
                >
                  + Add character
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
