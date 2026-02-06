import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { clsx } from 'clsx'
import { useProjectStore } from '../../../stores/projectStore'
import type { Prop } from '../../../types/project'
import { AddRegular } from '@fluentui/react-icons'
import { getPropIconComponent } from '../../../components/PropsPanel'

interface PropAutocompleteProps {
  isOpen: boolean
  position: { x: number; y: number }
  initialValue?: string
  onSelect: (prop: Prop) => void
  onCreateNew: (name: string) => Promise<Prop | undefined>
  onClose: () => void
}

/**
 * Floating autocomplete popover for selecting props.
 */
export function PropAutocomplete({
  isOpen,
  position,
  initialValue = '',
  onSelect,
  onCreateNew,
  onClose
}: PropAutocompleteProps) {
  const { currentProject } = useProjectStore()
  const [inputValue, setInputValue] = useState(initialValue)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const props = currentProject?.props || []

  const filteredProps = useMemo(() => {
    if (!inputValue.trim()) return props
    const normalizedInput = inputValue.toUpperCase().trim()
    return props.filter(prop => 
      prop.name.toUpperCase().includes(normalizedInput)
    )
  }, [props, inputValue])

  const showCreateOption = useMemo(() => {
    if (!inputValue.trim()) return false
    const normalizedInput = inputValue.toUpperCase().trim()
    return !props.some(prop => prop.name.toUpperCase() === normalizedInput)
  }, [props, inputValue])

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
    if (showCreateOption && selectedIndex === filteredProps.length) {
      const newProp = await onCreateNew(inputValue.trim())
      if (newProp) {
        onSelect(newProp)
      }
      return
    }

    if (filteredProps[selectedIndex]) {
      onSelect(filteredProps[selectedIndex])
    } else if (inputValue.trim() && showCreateOption) {
      const newProp = await onCreateNew(inputValue.trim())
      if (newProp) {
        onSelect(newProp)
      }
    }
  }, [filteredProps, selectedIndex, showCreateOption, inputValue, onSelect, onCreateNew])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = filteredProps.length + (showCreateOption ? 1 : 0)
    
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
  }, [filteredProps, showCreateOption, onClose, handleSelect])

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
      className="fixed z-[100] bg-ink-900 border border-ink-600 rounded-lg shadow-2xl min-w-[280px] max-h-[400px] overflow-hidden focus:outline-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateY(4px)'
      }}
    >
      <div className="p-2 border-b border-ink-700">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type prop name..."
          className="w-full bg-ink-800 text-white text-sm font-ui px-3 py-2 rounded-md border border-ink-600 focus:border-gold-400 outline-none placeholder:text-white/30"
          style={{ fontFamily: 'Courier New, Courier, monospace' }}
        />
      </div>

      <div className="max-h-[280px] overflow-auto py-1">
        {filteredProps.length === 0 && !showCreateOption ? (
          <div className="px-3 py-4 text-center text-sm text-white/40 font-ui">
            {props.length === 0 
              ? 'No props in bank. Start typing to create one.'
              : 'No matching props'}
          </div>
        ) : (
          <>
            {filteredProps.map((prop, index) => {
              const IconComponent = getPropIconComponent(prop.icon)
              return (
                <button
                  key={prop.id}
                  ref={el => itemRefs.current[index] = el}
                  onClick={() => {
                    setSelectedIndex(index)
                    onSelect(prop)
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
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-gold-400/20"
                  >
                    <IconComponent className="w-3.5 h-3.5 text-gold-400" />
                  </div>

                  <span
                    className="text-sm font-medium truncate text-gold-400"
                    style={{ fontFamily: 'Courier New, Courier, monospace' }}
                  >
                    {prop.name}
                  </span>
                </button>
              )
            })}

            {showCreateOption && (
              <button
                ref={el => itemRefs.current[filteredProps.length] = el}
                onClick={async () => {
                  const newProp = await onCreateNew(inputValue.trim())
                  if (newProp) {
                    onSelect(newProp)
                  }
                }}
                onMouseEnter={() => setSelectedIndex(filteredProps.length)}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors border-t border-ink-700',
                  selectedIndex === filteredProps.length 
                    ? 'bg-gold-400/20' 
                    : 'hover:bg-ink-800'
                )}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-gold-400/20 border border-gold-400/30"
                >
                  <AddRegular className="w-3.5 h-3.5 text-gold-400" />
                </div>

                <span className="text-sm font-ui">
                  <span className="text-white/60">Create </span>
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
