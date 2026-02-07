import { useState, useRef, useLayoutEffect, useCallback, Children, isValidElement, type ReactNode, useEffect } from 'react'
import { MoreHorizontalRegular } from '@fluentui/react-icons'
import { ToolbarDivider } from './ToolbarButton'

interface OverflowToolbarProps {
  children: ReactNode
  rightContent?: ReactNode
}

export function OverflowToolbar({ children, rightContent }: OverflowToolbarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState<number>(Infinity)
  const [measuring, setMeasuring] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const itemWidthsRef = useRef<number[]>([])

  const items = Children.toArray(children)

  const calculateFromWidths = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const rightWidth = rightRef.current?.offsetWidth || 0
    const containerWidth = container.clientWidth
    const gap = 4 // gap-1
    const moreButtonWidth = 36 + gap
    const rightGap = rightWidth > 0 ? gap : 0

    const available = containerWidth - rightWidth - rightGap

    const widths = itemWidthsRef.current
    if (widths.length === 0) return

    // Check if all items fit without the more button
    const totalWidth = widths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0)
    if (totalWidth <= available) {
      setVisibleCount(Infinity)
      return
    }

    // Find how many fit with the more button
    let used = 0
    for (let i = 0; i < widths.length; i++) {
      const itemWidth = widths[i] + (i > 0 ? gap : 0)
      if (used + itemWidth + moreButtonWidth > available) {
        setVisibleCount(Math.max(0, i))
        return
      }
      used += itemWidth
    }

    setVisibleCount(Infinity)
  }, [])

  // Measure phase: capture item widths using useLayoutEffect (before paint)
  useLayoutEffect(() => {
    if (!measuring) return
    const container = containerRef.current
    if (!container) return

    const wrappers = container.querySelectorAll<HTMLElement>('[data-toolbar-item]')
    itemWidthsRef.current = Array.from(wrappers).map(el => el.offsetWidth)

    calculateFromWidths()
    setMeasuring(false)
  }, [measuring, calculateFromWidths])

  // Re-measure when children change
  useEffect(() => {
    setMeasuring(true)
  }, [items.length])

  // Recalculate on resize (using stored widths, no re-measure needed)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      if (itemWidthsRef.current.length > 0) {
        calculateFromWidths()
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [calculateFromWidths])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const showAll = measuring || visibleCount >= items.length
  const visibleItems = showAll ? items : items.slice(0, visibleCount)
  const overflowItems = showAll ? [] : items.slice(visibleCount)
    .filter(item => !(isValidElement(item) && item.type === ToolbarDivider))

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1 px-4 py-2 bg-theme-header border-b border-theme-subtle"
      style={measuring ? { overflow: 'hidden' } : undefined}
    >
      {(measuring ? items : visibleItems).map((item, i) => (
        <div key={i} data-toolbar-item="" className="flex items-center shrink-0">
          {item}
        </div>
      ))}

      {overflowItems.length > 0 && (
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            className="p-2 rounded-md transition-colors text-theme-secondary hover:text-theme-accent hover:bg-theme-hover"
            title="More tools"
          >
            <MoreHorizontalRegular className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 p-2 bg-theme-surface border border-theme-default rounded-lg shadow-lg z-50 flex flex-wrap items-center gap-1">
              {overflowItems}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-w-0" />

      {rightContent && (
        <div ref={rightRef} className="flex items-center gap-1 shrink-0">
          {rightContent}
        </div>
      )}
    </div>
  )
}
