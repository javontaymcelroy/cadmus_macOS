import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { clsx } from 'clsx'

// Common shot types in filmmaking
export const SHOT_TYPES = [
  { id: 'close-up', name: 'CLOSE UP', description: 'Tight shot on face/object' },
  { id: 'extreme-close-up', name: 'EXTREME CLOSE UP', description: 'Very tight, specific detail' },
  { id: 'medium-shot', name: 'MEDIUM SHOT', description: 'Waist up' },
  { id: 'medium-close-up', name: 'MEDIUM CLOSE UP', description: 'Chest up' },
  { id: 'wide-shot', name: 'WIDE SHOT', description: 'Full body with environment' },
  { id: 'long-shot', name: 'LONG SHOT', description: 'Subject small in frame' },
  { id: 'establishing-shot', name: 'ESTABLISHING SHOT', description: 'Location overview' },
  { id: 'over-shoulder', name: 'OVER THE SHOULDER', description: 'From behind one character' },
  { id: 'pov', name: 'POV', description: 'Point of view shot' },
  { id: 'two-shot', name: 'TWO SHOT', description: 'Two people in frame' },
  { id: 'insert', name: 'INSERT', description: 'Cut-in on important detail' },
  { id: 'angle-on', name: 'ANGLE ON', description: 'Specific angle emphasis' },
  { id: 'tracking', name: 'TRACKING SHOT', description: 'Camera follows subject' },
  { id: 'dolly', name: 'DOLLY', description: 'Camera moves toward/away' },
  { id: 'pan', name: 'PAN', description: 'Camera pivots horizontally' },
  { id: 'tilt', name: 'TILT', description: 'Camera pivots vertically' },
  { id: 'crane', name: 'CRANE SHOT', description: 'Camera rises/descends' },
  { id: 'aerial', name: 'AERIAL SHOT', description: 'From above, bird\'s eye' },
  { id: 'steadicam', name: 'STEADICAM', description: 'Smooth handheld movement' },
  { id: 'handheld', name: 'HANDHELD', description: 'Intentional camera shake' },
] as const

export type ShotType = typeof SHOT_TYPES[number]

interface ShotAutocompleteProps {
  isOpen: boolean
  position: { x: number; y: number }
  onSelect: (shotName: string) => void
  onClose: () => void
}

/**
 * Floating autocomplete popover for selecting shot types.
 * Similar to CharacterAutocomplete but for camera shots.
 */
export function ShotAutocomplete({
  isOpen,
  position,
  onSelect,
  onClose
}: ShotAutocompleteProps) {
  const [inputValue, setInputValue] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const filteredShots = useMemo(() => {
    if (!inputValue.trim()) return SHOT_TYPES
    const normalizedInput = inputValue.toUpperCase().trim()
    return SHOT_TYPES.filter(shot => 
      shot.name.includes(normalizedInput) || 
      shot.description.toUpperCase().includes(normalizedInput)
    )
  }, [inputValue])

  // Allow custom shot if input doesn't match any preset
  const showCustomOption = useMemo(() => {
    if (!inputValue.trim()) return false
    const normalizedInput = inputValue.toUpperCase().trim()
    return !SHOT_TYPES.some(shot => shot.name === normalizedInput)
  }, [inputValue])

  useEffect(() => {
    if (isOpen) {
      setInputValue('')
      setSelectedIndex(0)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 10)
    }
  }, [isOpen])

  const handleSelect = useCallback(() => {
    // If on custom option
    if (showCustomOption && selectedIndex === filteredShots.length) {
      onSelect(inputValue.trim().toUpperCase())
      return
    }

    if (filteredShots[selectedIndex]) {
      onSelect(filteredShots[selectedIndex].name)
    } else if (inputValue.trim()) {
      onSelect(inputValue.trim().toUpperCase())
    }
  }, [filteredShots, selectedIndex, showCustomOption, inputValue, onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = filteredShots.length + (showCustomOption ? 1 : 0)
    
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
  }, [filteredShots, showCustomOption, onClose, handleSelect])

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
      // Listen for scroll on the editor container
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

  // Camera icon for shot items
  const CameraIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-ink-900 border border-ink-600 rounded-lg shadow-2xl min-w-[300px] max-h-[400px] overflow-hidden focus:outline-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateY(4px)'
      }}
    >
      <div className="px-3 py-1.5 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider border-b border-ink-700">
        Shot Type
      </div>

      <div className="p-2 border-b border-ink-700">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or type custom shot..."
          className="w-full bg-ink-800 text-white text-sm font-ui px-3 py-2 rounded-md border border-ink-600 focus:border-gold-400 outline-none placeholder:text-white/30 uppercase"
        />
      </div>

      <div className="max-h-[280px] overflow-auto py-1">
        {filteredShots.length === 0 && !showCustomOption ? (
          <div className="px-3 py-4 text-center text-sm text-white/40 font-ui">
            No matching shots. Type to create custom.
          </div>
        ) : (
          <>
            {filteredShots.map((shot, index) => (
              <button
                key={shot.id}
                ref={el => itemRefs.current[index] = el}
                onClick={() => {
                  setSelectedIndex(index)
                  onSelect(shot.name)
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                  index === selectedIndex 
                    ? 'bg-gold-400/20' 
                    : 'hover:bg-ink-800'
                )}
              >
                <div
                  className={clsx(
                    'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                    index === selectedIndex ? 'bg-gold-400/30 text-gold-400' : 'bg-ink-700 text-ink-400'
                  )}
                >
                  <CameraIcon />
                </div>

                <div className="flex-1 min-w-0">
                  <div 
                    className={clsx(
                      'text-sm font-medium',
                      index === selectedIndex ? 'text-gold-400' : 'text-white/90'
                    )}
                    style={{ fontFamily: 'Courier New, Courier, monospace' }}
                  >
                    {shot.name}
                  </div>
                  <div className={clsx(
                    'text-[10px] truncate',
                    index === selectedIndex ? 'text-gold-400/70' : 'text-ink-500'
                  )}>
                    {shot.description}
                  </div>
                </div>
              </button>
            ))}

            {showCustomOption && (
              <button
                ref={el => itemRefs.current[filteredShots.length] = el}
                onClick={() => onSelect(inputValue.trim().toUpperCase())}
                onMouseEnter={() => setSelectedIndex(filteredShots.length)}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors border-t border-ink-700',
                  selectedIndex === filteredShots.length 
                    ? 'bg-gold-400/20' 
                    : 'hover:bg-ink-800'
                )}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-gold-400/20 border border-gold-400/30"
                >
                  <CameraIcon />
                </div>

                <span className="text-sm font-ui">
                  <span className="text-white/60">Use </span>
                  <span 
                    className="font-medium text-gold-400"
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

      <div className="px-3 py-1.5 border-t border-ink-700 text-[10px] text-ink-500 font-ui">
        <span className="text-ink-400">↑↓</span> Navigate • <span className="text-ink-400">Enter</span> Select • <span className="text-ink-400">Esc</span> Close
      </div>
    </div>
  )
}
