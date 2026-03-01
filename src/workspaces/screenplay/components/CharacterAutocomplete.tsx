import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { clsx } from 'clsx'
import { useProjectStore } from '../../../stores/projectStore'
import type { Character } from '../../../types/project'
import { PersonRegular, AddRegular } from '@fluentui/react-icons'

interface CharacterAutocompleteProps {
  isOpen: boolean
  position: { x: number; y: number }
  initialValue?: string
  onSelect: (character: Character) => void
  onCreateNew: (name: string) => Promise<Character | undefined>
  onClose: () => void
}

/**
 * Floating autocomplete popover for selecting characters.
 */
export function CharacterAutocomplete({
  isOpen,
  position,
  initialValue = '',
  onSelect,
  onCreateNew,
  onClose
}: CharacterAutocompleteProps) {
  const { currentProject } = useProjectStore()
  const [inputValue, setInputValue] = useState(initialValue)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const characters = currentProject?.characters || []

  const filteredCharacters = useMemo(() => {
    if (!inputValue.trim()) return characters
    const normalizedInput = inputValue.toUpperCase().trim()
    return characters.filter(char => 
      char.name.toUpperCase().includes(normalizedInput)
    )
  }, [characters, inputValue])

  const showCreateOption = useMemo(() => {
    if (!inputValue.trim()) return false
    const normalizedInput = inputValue.toUpperCase().trim()
    return !characters.some(char => char.name.toUpperCase() === normalizedInput)
  }, [characters, inputValue])

  useEffect(() => {
    if (isOpen) {
      setInputValue(initialValue)
      setSelectedIndex(0)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 10)
    }
  }, [isOpen, initialValue])

  const handleSelect = useCallback(async () => {
    if (showCreateOption && selectedIndex === filteredCharacters.length) {
      const newChar = await onCreateNew(inputValue.trim())
      if (newChar) {
        onSelect(newChar)
      }
      return
    }

    if (filteredCharacters[selectedIndex]) {
      onSelect(filteredCharacters[selectedIndex])
    } else if (inputValue.trim() && showCreateOption) {
      const newChar = await onCreateNew(inputValue.trim())
      if (newChar) {
        onSelect(newChar)
      }
    }
  }, [filteredCharacters, selectedIndex, showCreateOption, inputValue, onSelect, onCreateNew])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = filteredCharacters.length + (showCreateOption ? 1 : 0)
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1))
        break
      case 'Enter':
        e.preventDefault()
        handleSelect()
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'Tab':
        e.preventDefault()
        handleSelect()
        break
    }
  }, [filteredCharacters, showCreateOption, onClose, handleSelect])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Close on scroll to prevent popover from floating away
    const handleScroll = () => {
      onClose()
    }

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('scroll', handleScroll, true)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest'
      })
    }
  }, [selectedIndex])

  useEffect(() => {
    setSelectedIndex(0)
  }, [inputValue])

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-[var(--bg-elevated)] border border-theme-default rounded-lg shadow-2xl min-w-[280px] max-h-[400px] overflow-hidden focus:outline-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateY(4px)'
      }}
    >
      <div className="p-2 border-b border-theme-default">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type character name..."
          className="w-full bg-[var(--bg-tertiary)] text-theme-primary text-sm font-ui px-3 py-2 rounded-md border border-theme-default focus:border-theme-accent outline-none placeholder:text-white/30"
          style={{ fontFamily: 'Courier New, Courier, monospace' }}
        />
      </div>

      <div className="max-h-[280px] overflow-auto py-1">
        {filteredCharacters.length === 0 && !showCreateOption ? (
          <div className="px-3 py-4 text-center text-sm text-white/40 font-ui">
            {characters.length === 0 
              ? 'No characters in bank. Start typing to create one.'
              : 'No matching characters'}
          </div>
        ) : (
          <>
            {filteredCharacters.map((character, index) => (
              <button
                key={character.id}
                ref={el => itemRefs.current[index] = el}
                onClick={() => {
                  setSelectedIndex(index)
                  onSelect(character)
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                  index === selectedIndex
                    ? 'bg-gold-400/20'
                    : 'hover:bg-[var(--bg-hover)]'
                )}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: character.color }}
                >
                  <PersonRegular className="w-3.5 h-3.5 text-ink-900" />
                </div>

                <span
                  className="text-sm font-medium truncate"
                  style={{ 
                    color: index === selectedIndex ? character.color : 'rgba(255,255,255,0.8)',
                    fontFamily: 'Courier New, Courier, monospace'
                  }}
                >
                  {character.name}
                </span>
              </button>
            ))}

            {showCreateOption && (
              <button
                ref={el => itemRefs.current[filteredCharacters.length] = el}
                onClick={async () => {
                  const newChar = await onCreateNew(inputValue.trim())
                  if (newChar) {
                    onSelect(newChar)
                  }
                }}
                onMouseEnter={() => setSelectedIndex(filteredCharacters.length)}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors border-t border-theme-default',
                  selectedIndex === filteredCharacters.length
                    ? 'bg-gold-400/20'
                    : 'hover:bg-[var(--bg-hover)]'
                )}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-gold-400/20 border border-gold-400/30"
                >
                  <AddRegular className="w-3.5 h-3.5 text-theme-accent" />
                </div>

                <span className="text-sm font-ui">
                  <span className="text-white/60">Create </span>
                  <span 
                    className="font-medium text-theme-accent"
                    style={{ fontFamily: 'Courier New, Courier, monospace' }}
                  >
                    {inputValue.toUpperCase()}
                  </span>
                </span>
              </button>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-theme-default text-[10px] text-theme-muted font-ui">
        <span className="text-theme-muted">↑↓</span> Navigate • <span className="text-theme-muted">Enter</span> Select • <span className="text-theme-muted">Esc</span> Close
      </div>
    </div>
  )
}
