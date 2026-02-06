import { useEffect, useRef, useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { SCREENPLAY_ELEMENTS, type ScreenplayElementType } from '../extensions/ScreenplayElement'
import { BoxRegular } from '@fluentui/react-icons'

// Extended type to include 'prop' as a special option
export type ElementPickerSelection = ScreenplayElementType | 'prop'

interface ScreenplayElementPickerProps {
  isOpen: boolean
  position: { x: number; y: number }
  onSelect: (elementType: ElementPickerSelection) => void
  onClose: () => void
}

// Total number of items (screenplay elements + prop)
const TOTAL_ITEMS = SCREENPLAY_ELEMENTS.length + 1
const PROP_INDEX = SCREENPLAY_ELEMENTS.length

/**
 * Popover menu for selecting screenplay element types.
 * Supports keyboard navigation (arrow keys, Enter, Escape) and mouse selection.
 */
export function ScreenplayElementPicker({
  isOpen,
  position,
  onSelect,
  onClose
}: ScreenplayElementPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && menuRef.current) {
      menuRef.current.focus()
    }
  }, [isOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < TOTAL_ITEMS - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : TOTAL_ITEMS - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex === PROP_INDEX) {
          onSelect('prop')
        } else {
          onSelect(SCREENPLAY_ELEMENTS[selectedIndex].type)
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      default:
        // Handle shortcuts for screenplay elements
        const shortcut = e.key.toUpperCase()
        const matchingIndex = SCREENPLAY_ELEMENTS.findIndex(el => el.shortcut === shortcut)
        if (matchingIndex !== -1) {
          e.preventDefault()
          onSelect(SCREENPLAY_ELEMENTS[matchingIndex].type)
        }
        // Handle 'R' for Prop
        if (shortcut === 'R') {
          e.preventDefault()
          onSelect('prop')
        }
        break
    }
  }, [selectedIndex, onSelect, onClose])

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

  if (!isOpen) return null

  const getElementIcon = (type: ScreenplayElementType) => {
    switch (type) {
      case 'scene-heading':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h12" />
          </svg>
        )
      case 'action':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )
      case 'character':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      case 'dialogue':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
      case 'parenthetical':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l-4 7 4 7M15 5l4 7-4 7" />
          </svg>
        )
      case 'transition':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        )
      case 'shot':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-ink-900 border border-ink-600 rounded-lg shadow-2xl py-1.5 min-w-[240px] max-h-[400px] overflow-auto focus:outline-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateY(4px)'
      }}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label="Screenplay element types"
    >
      <div className="px-3 py-1.5 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider border-b border-ink-700 mb-1">
        Screenplay Element
      </div>
      
      {SCREENPLAY_ELEMENTS.map((element, index) => (
        <button
          key={element.type}
          ref={el => itemRefs.current[index] = el}
          onClick={() => onSelect(element.type)}
          onMouseEnter={() => setSelectedIndex(index)}
          className={clsx(
            'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
            index === selectedIndex 
              ? 'bg-gold-400/20 text-gold-400' 
              : 'text-white hover:bg-ink-800'
          )}
          role="option"
          aria-selected={index === selectedIndex}
        >
          <span className={clsx(
            'flex-shrink-0',
            index === selectedIndex ? 'text-gold-400' : 'text-ink-400'
          )}>
            {getElementIcon(element.type)}
          </span>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-ui font-medium">
              {element.name}
            </div>
            <div className={clsx(
              'text-xs truncate',
              index === selectedIndex ? 'text-gold-400/70' : 'text-ink-500'
            )}>
              {element.description}
            </div>
          </div>
          
          <span className={clsx(
            'flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded',
            index === selectedIndex 
              ? 'bg-gold-400/30 text-gold-400' 
              : 'bg-ink-700 text-ink-400'
          )}>
            {element.shortcut}
          </span>
        </button>
      ))}

      {/* Divider */}
      <div className="px-3 py-1.5 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider border-t border-ink-700 mt-1 mb-1">
        Story Elements
      </div>

      {/* Prop option */}
      <button
        ref={el => itemRefs.current[PROP_INDEX] = el}
        onClick={() => onSelect('prop')}
        onMouseEnter={() => setSelectedIndex(PROP_INDEX)}
        className={clsx(
          'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
          selectedIndex === PROP_INDEX 
            ? 'bg-gold-400/20 text-gold-400' 
            : 'text-white hover:bg-ink-800'
        )}
        role="option"
        aria-selected={selectedIndex === PROP_INDEX}
      >
        <span className={clsx(
          'flex-shrink-0',
          selectedIndex === PROP_INDEX ? 'text-gold-400' : 'text-ink-400'
        )}>
          <BoxRegular className="w-4 h-4" />
        </span>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-ui font-medium">
            Prop
          </div>
          <div className={clsx(
            'text-xs truncate',
            selectedIndex === PROP_INDEX ? 'text-gold-400/70' : 'text-ink-500'
          )}>
            Important item or object
          </div>
        </div>
        
        <span className={clsx(
          'flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded',
          selectedIndex === PROP_INDEX 
            ? 'bg-gold-400/30 text-gold-400' 
            : 'bg-ink-700 text-ink-400'
        )}>
          R
        </span>
      </button>
      
      <div className="px-3 py-1.5 mt-1 border-t border-ink-700 text-[10px] text-ink-500 font-ui">
        <span className="text-ink-400">↑↓</span> Navigate • <span className="text-ink-400">Enter</span> Select • <span className="text-ink-400">Esc</span> Close
      </div>
    </div>
  )
}
