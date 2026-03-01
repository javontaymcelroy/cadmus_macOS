import { clsx } from 'clsx'
import {
  CheckmarkCircleRegular,
  QuestionCircleRegular,
  LightbulbRegular,
  WarningRegular,
  NoteRegular,
  ChevronDownRegular
} from '@fluentui/react-icons'
import { useState } from 'react'

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

interface ContextDocumentViewProps {
  contextDocument: {
    decisions: string[]
    openQuestions: string[]
    ideas: string[]
    risks: string[]
    considerations: string[]
  }
}

interface SectionProps {
  icon: typeof CheckmarkCircleRegular
  iconColor: string
  label: string
  items: string[]
}

function Section({ icon: Icon, iconColor, label, items }: SectionProps) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Icon className={clsx('w-3 h-3', iconColor)} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted"
              style={{ fontFamily: FONT_FAMILY }}>
          {label} ({items.length})
        </span>
      </div>
      <ul className="space-y-0.5 pl-4">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] text-theme-secondary leading-snug list-disc"
              style={{ fontFamily: FONT_FAMILY }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ContextDocumentView({ contextDocument }: ContextDocumentViewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const cd = contextDocument

  const totalItems = cd.decisions.length + cd.openQuestions.length +
    cd.ideas.length + cd.risks.length + cd.considerations.length

  if (totalItems === 0) return null

  return (
    <div className="border-b border-theme-subtle">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-theme-active transition-colors"
      >
        <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider"
              style={{ fontFamily: FONT_FAMILY }}>
          Context Document ({totalItems})
        </span>
        <ChevronDownRegular
          className={clsx(
            'w-3.5 h-3.5 text-theme-muted transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-3">
          <Section icon={CheckmarkCircleRegular} iconColor="text-emerald-400" label="Decisions" items={cd.decisions} />
          <Section icon={QuestionCircleRegular} iconColor="text-amber-400" label="Open Questions" items={cd.openQuestions} />
          <Section icon={LightbulbRegular} iconColor="text-blue-400" label="Ideas" items={cd.ideas} />
          <Section icon={WarningRegular} iconColor="text-red-400" label="Risks" items={cd.risks} />
          <Section icon={NoteRegular} iconColor="text-theme-muted" label="Considerations" items={cd.considerations} />
        </div>
      )}
    </div>
  )
}
