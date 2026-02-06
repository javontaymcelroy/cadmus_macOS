import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import type { Editor } from '@tiptap/react'

// Predefined color palette
const TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'White', value: '#ffffff' },
  { name: 'Light Gray', value: '#a3a3a3' },
  { name: 'Gold', value: '#fbbf24' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Lime', value: '#84cc16' },
]

interface TextColorDropdownProps {
  editor: Editor
}

export function TextColorDropdown({ editor }: TextColorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  
  // Force re-render when editor selection changes to update displayed color
  const [, setSelectionUpdate] = useState(0)
  
  useEffect(() => {
    const updateHandler = () => {
      setSelectionUpdate(prev => prev + 1)
    }
    
    editor.on('selectionUpdate', updateHandler)
    editor.on('transaction', updateHandler)
    
    return () => {
      editor.off('selectionUpdate', updateHandler)
      editor.off('transaction', updateHandler)
    }
  }, [editor])

  // Get current text color from selection
  const currentColor = editor.getAttributes('textStyle').color || ''

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleColorSelect = (colorValue: string) => {
    if (colorValue === '') {
      editor.chain().focus().unsetColor().run()
    } else {
      editor.chain().focus().setColor(colorValue).run()
    }
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'p-2 rounded-md transition-colors',
          isOpen ? 'bg-theme-active' : 'hover:bg-theme-hover'
        )}
        title="Text Color"
      >
        {/* Color square preview */}
        <div 
          className="w-4 h-4 rounded border border-theme-default" 
          style={{ backgroundColor: currentColor || '#ffffff' }}
        />
      </button>
      
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed bg-theme-elevated border border-theme-default rounded-lg shadow-xl z-[9999] p-2 min-w-[140px]"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <div className="grid grid-cols-4 gap-1">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.value || 'default'}
                onClick={() => handleColorSelect(color.value)}
                className={clsx(
                  'w-7 h-7 rounded-md border-2 transition-all hover:scale-110',
                  currentColor === color.value 
                    ? 'border-theme-accent ring-2 ring-theme-accent/30' 
                    : 'border-transparent hover:border-theme-strong'
                )}
                style={{ 
                  backgroundColor: color.value || 'transparent',
                  backgroundImage: color.value === '' ? 'linear-gradient(135deg, #fff 45%, transparent 45%, transparent 55%, #fff 55%)' : undefined
                }}
                title={color.name}
              >
                {color.value === '' && (
                  <span className="text-[10px] text-theme-secondary">A</span>
                )}
              </button>
            ))}
          </div>
          {/* Custom color input */}
          <div className="mt-2 pt-2 border-t border-theme-subtle">
            <label className="flex items-center gap-2">
              <input
                type="color"
                value={currentColor || '#ffffff'}
                onChange={(e) => handleColorSelect(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="text-xs text-theme-secondary">Custom</span>
            </label>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
