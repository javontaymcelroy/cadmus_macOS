import { useState } from 'react'
import { CursorClickRegular, DismissRegular, ChevronDownRegular, ChevronUpRegular } from '@fluentui/react-icons'
import type { CursorContext } from '../../../shared/cursorContextTypes'
import { MIN_CURSOR_CONTEXT_RADIUS, MAX_CURSOR_CONTEXT_RADIUS } from '../../../shared/cursorContextTypes'

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

interface CursorContextChipProps {
  cursorContext: CursorContext
  radius: number
  onRadiusChange: (radius: number) => void
  onRemove: () => void
}

export function CursorContextChip({ cursorContext, radius, onRadiusChange, onRemove }: CursorContextChipProps) {
  const [expanded, setExpanded] = useState(true)

  const breadcrumb = cursorContext.headingPath.length > 0
    ? cursorContext.headingPath.join(' > ')
    : cursorContext.documentTitle

  return (
    <div className="w-full">
      {/* Chip header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 max-w-full cursor-pointer"
        style={{ fontSize: 11, fontFamily: FONT_FAMILY }}
        title="Cursor context — your current position is being sent to the thought partner"
        onClick={() => setExpanded(!expanded)}
      >
        <CursorClickRegular className="w-3 h-3 flex-shrink-0" />
        <span className="truncate flex-1">{breadcrumb}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          className="flex-shrink-0 p-0.5 rounded hover:bg-amber-500/30 transition-colors"
          title={expanded ? 'Collapse preview' : 'Expand preview'}
        >
          {expanded
            ? <ChevronUpRegular className="w-3 h-3" />
            : <ChevronDownRegular className="w-3 h-3" />
          }
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="flex-shrink-0 p-0.5 rounded hover:bg-amber-500/30 transition-colors"
          title="Turn off cursor context"
        >
          <DismissRegular className="w-3 h-3" />
        </button>
      </div>

      {/* Expanded preview */}
      {expanded && (
        <div
          className="mt-1 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-theme-secondary overflow-hidden"
          style={{ fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace' }}
        >
          {/* Heading path */}
          {cursorContext.headingPath.length > 0 && (
            <div className="text-amber-400/70 mb-1 truncate" style={{ fontSize: 9, fontFamily: FONT_FAMILY }}>
              {cursorContext.headingPath.join(' > ')}
            </div>
          )}

          {/* Before text (dimmed) */}
          {cursorContext.beforeText && (
            <div className="text-theme-muted whitespace-pre-wrap break-words max-h-[60px] overflow-hidden leading-tight">
              {cursorContext.beforeText}
            </div>
          )}

          {/* Cursor marker */}
          <div className="flex items-center gap-1 my-1">
            <div className="h-px flex-1 bg-[var(--accent-gold)]" />
            <span className="text-[var(--accent-gold)] flex-shrink-0" style={{ fontSize: 9, fontFamily: FONT_FAMILY }}>
              cursor
            </span>
            <div className="h-px flex-1 bg-[var(--accent-gold)]" />
          </div>

          {/* After text (dimmed) */}
          {cursorContext.afterText && (
            <div className="text-theme-muted whitespace-pre-wrap break-words max-h-[60px] overflow-hidden leading-tight">
              {cursorContext.afterText}
            </div>
          )}

          {/* Radius slider */}
          <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-amber-500/15">
            <span className="text-theme-muted flex-shrink-0" style={{ fontSize: 9, fontFamily: FONT_FAMILY }}>
              Narrow
            </span>
            <input
              type="range"
              min={MIN_CURSOR_CONTEXT_RADIUS}
              max={MAX_CURSOR_CONTEXT_RADIUS}
              step={100}
              value={radius}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="flex-1 h-1 accent-amber-500 cursor-pointer"
              title={`Context radius: ${radius} chars each side`}
            />
            <span className="text-theme-muted flex-shrink-0" style={{ fontSize: 9, fontFamily: FONT_FAMILY }}>
              Wide
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
