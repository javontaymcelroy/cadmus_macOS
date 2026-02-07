import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { ChevronDownRegular } from '@fluentui/react-icons'
import type { Editor } from '@tiptap/react'
import { useProjectStore, getDocumentHierarchyType } from '../../../stores/projectStore'
import { FONT_FAMILIES, getAvailableFonts } from '../extensions/FontFamily'
import { useProjectEditorStyles } from '../hooks/useProjectEditorStyles'

interface FontFamilyDropdownProps {
  editor: Editor
}

// Workspace CSS defaults - mirrors the font-family cascade in globals.css
const WORKSPACE_CSS_FONTS: Record<string, string> = {
  'notes-journal': 'Beth Ellen, cursive',
  'screenplay': 'Courier New, Courier, monospace',
}
const DEFAULT_CSS_FONT = 'Carlito, Calibri, sans-serif'

export function FontFamilyDropdown({ editor }: FontFamilyDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const { currentProject, activeDocumentId } = useProjectStore()
  const { style: overrideStyle } = useProjectEditorStyles()

  // Force re-render when editor selection changes to update displayed font
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

  // Determine if we're in the notes-journal workspace and if the current doc is a note
  const isNotesJournalWorkspace = currentProject?.templateId === 'notes-journal'
  const activeDoc = currentProject?.documents.find(d => d.id === activeDocumentId)
  const isNote = useMemo(() => {
    if (!activeDoc || !currentProject) return false
    // Check if explicitly marked as a note
    if (activeDoc.isNote) return true
    // Check hierarchy type
    const hierarchyType = getDocumentHierarchyType(activeDoc, currentProject.documents)
    return hierarchyType === 'note'
  }, [activeDoc, currentProject])

  // Get available fonts based on context
  const availableFonts = useMemo(() => {
    return getAvailableFonts(isNotesJournalWorkspace, isNote)
  }, [isNotesJournalWorkspace, isNote])

  // Determine the effective default font following the actual CSS cascade:
  // 1. Project override (--project-font-family CSS variable) if set
  // 2. Workspace CSS default based on templateId
  // 3. Global default (Calibri)
  const effectiveDefaultFontValue = useMemo(() => {
    // Check if the project override CSS variable is actually being set
    const projectOverrideFont = overrideStyle['--project-font-family']
    if (projectOverrideFont) return projectOverrideFont

    // Workspace CSS defaults (mirrors globals.css cascade)
    const templateId = currentProject?.templateId
    if (templateId && WORKSPACE_CSS_FONTS[templateId]) {
      return WORKSPACE_CSS_FONTS[templateId]
    }

    return DEFAULT_CSS_FONT
  }, [overrideStyle, currentProject?.templateId])

  // Find font entry with exact + fuzzy matching
  const findFontEntry = (fontValue: string) => {
    // Try exact match first
    const exactMatch = FONT_FAMILIES.find(f => f.value === fontValue)
    if (exactMatch) return exactMatch

    // Try partial match (the fontValue might be just the primary font name)
    const partialMatch = FONT_FAMILIES.find(f =>
      f.value.toLowerCase().startsWith(fontValue.toLowerCase()) ||
      fontValue.toLowerCase().startsWith(f.value.split(',')[0].trim().toLowerCase())
    )
    if (partialMatch) return partialMatch

    return null
  }

  const defaultFontEntry = findFontEntry(effectiveDefaultFontValue)
  const defaultFontName = defaultFontEntry?.name || 'Calibri'

  // Get current font family from the current block (check all block types)
  const paragraphFont = editor.getAttributes('paragraph').fontFamily
  const headingFont = editor.getAttributes('heading').fontFamily
  const screenplayFont = editor.getAttributes('screenplayElement').fontFamily
  const explicitFont = paragraphFont || headingFont || screenplayFont

  // Resolve the currently displayed font: explicit block attribute > effective default
  const currentFontEntry = explicitFont ? findFontEntry(explicitFont) || defaultFontEntry : defaultFontEntry
  const currentFontName = currentFontEntry?.name || defaultFontName
  const currentFontValue = currentFontEntry?.value || effectiveDefaultFontValue

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

  const handleFontSelect = (fontValue: string) => {
    // Direct command - no focus() needed since we're updating block attributes
    editor.commands.setFontFamily(fontValue)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-md text-theme-primary hover:text-theme-accent hover:bg-theme-hover transition-colors min-w-[100px]"
        title="Font Family"
      >
        <span className="text-xs font-ui truncate">{currentFontName}</span>
        <ChevronDownRegular className="w-3 h-3 shrink-0" />
      </button>
      
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed bg-theme-elevated border border-theme-default rounded-lg shadow-xl z-[9999] py-1 w-[180px] max-h-[300px] overflow-auto"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {availableFonts.map((font) => (
            <button
              key={font.value}
              onClick={() => handleFontSelect(font.value)}
              className={clsx(
                'w-full px-3 py-2 text-left text-sm hover:bg-theme-hover transition-colors',
                currentFontValue === font.value ? 'text-theme-accent' : 'text-theme-primary'
              )}
              style={{ fontFamily: font.value }}
            >
              {font.name}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
