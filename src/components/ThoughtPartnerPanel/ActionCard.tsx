import {
  DocumentAddRegular,
  DocumentEditRegular,
  PersonAddRegular,
  BoxRegular,
  CheckmarkCircleRegular,
  CheckmarkRegular,
  DismissCircleRegular,
  DismissRegular,
  ArrowSyncRegular,
  ChevronDownRegular,
  ChevronUpRegular
} from '@fluentui/react-icons'
import { clsx } from 'clsx'
import { useState } from 'react'

interface ActionCardProps {
  action: {
    id: string
    type: 'insert-content' | 'replace-content' | 'create-character' | 'create-prop'
    status: 'pending' | 'accepted' | 'rejected' | 'executing' | 'completed' | 'failed'
    description: string
    content: any
  }
  onAccept: () => void
  onReject: () => void
  textSize?: number
}

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

const typeConfig = {
  'insert-content': {
    icon: DocumentAddRegular,
    label: 'Insert Content',
    accentColor: 'text-blue-400',
    accentBg: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30'
  },
  'replace-content': {
    icon: DocumentEditRegular,
    label: 'Replace Content',
    accentColor: 'text-purple-400',
    accentBg: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30'
  },
  'create-character': {
    icon: PersonAddRegular,
    label: 'Create Character',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-400/10',
    borderColor: 'border-amber-400/30'
  },
  'create-prop': {
    icon: BoxRegular,
    label: 'Create Prop',
    accentColor: 'text-emerald-400',
    accentBg: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/30'
  }
}

const statusConfig: Record<string, { icon: typeof CheckmarkCircleRegular; label: string; color: string }> = {
  executing: { icon: ArrowSyncRegular, label: 'Executing...', color: 'text-amber-400' },
  completed: { icon: CheckmarkCircleRegular, label: 'Done', color: 'text-emerald-400' },
  accepted: { icon: CheckmarkCircleRegular, label: 'Sent to editor', color: 'text-blue-400' },
  rejected: { icon: DismissCircleRegular, label: 'Rejected', color: 'text-theme-muted' },
  failed: { icon: DismissCircleRegular, label: 'Failed', color: 'text-red-400' }
}

function ScreenplayPreview({ elements, textSize }: { elements: any[]; textSize: number }) {
  return (
    <div className="space-y-1 font-mono" style={{ fontSize: textSize - 2 }}>
      {elements.map((el: any, i: number) => {
        switch (el.type) {
          case 'scene-heading':
            return <div key={i} className="font-bold uppercase text-theme-primary">{el.text}</div>
          case 'action':
            return <div key={i} className="text-theme-secondary">{el.text}</div>
          case 'character':
            return <div key={i} className="text-center uppercase font-semibold text-theme-primary mt-1">{el.text}</div>
          case 'dialogue':
            return <div key={i} className="text-center text-theme-primary px-8">{el.text}</div>
          case 'parenthetical':
            return <div key={i} className="text-center text-theme-muted italic px-12">({el.text})</div>
          case 'transition':
            return <div key={i} className="text-right uppercase text-theme-muted">{el.text}</div>
          case 'shot':
            return <div key={i} className="font-bold uppercase text-theme-secondary">{el.text}</div>
          default:
            return <div key={i} className="text-theme-secondary">{el.text}</div>
        }
      })}
    </div>
  )
}

export function ActionCard({ action, onAccept, onReject, textSize = 13 }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const config = typeConfig[action.type]
  const Icon = config.icon
  const isDone = ['completed', 'accepted', 'rejected', 'failed'].includes(action.status)
  const statusInfo = statusConfig[action.status]

  const hasPreview = (action.type === 'insert-content' || action.type === 'replace-content') && (
    action.content.screenplayElements?.length > 0 || action.content.text
  )

  return (
    <div
      className={clsx(
        'rounded-lg border overflow-hidden transition-all',
        isDone ? 'opacity-70 border-theme-subtle' : config.borderColor,
        isDone ? 'bg-theme-base' : 'bg-theme-elevated'
      )}
      style={{ fontFamily: FONT_FAMILY }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className={clsx('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', config.accentBg)}>
          <Icon className={clsx('w-3.5 h-3.5', config.accentColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={clsx('font-medium text-theme-primary truncate')} style={{ fontSize: textSize - 1 }}>
            {action.description}
          </div>
          <div className={clsx('text-theme-muted')} style={{ fontSize: textSize - 3 }}>
            {config.label}
          </div>
        </div>

        {/* Status indicator */}
        {statusInfo ? (
          <div className={clsx('flex items-center gap-1 flex-shrink-0', statusInfo.color)} style={{ fontSize: textSize - 2 }}>
            <statusInfo.icon className={clsx('w-4 h-4', action.status === 'executing' && 'animate-spin')} />
            <span>{statusInfo.label}</span>
          </div>
        ) : hasPreview ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-theme-active transition-colors text-theme-muted"
            title={expanded ? 'Collapse preview' : 'Expand preview'}
          >
            {expanded ? <ChevronUpRegular className="w-4 h-4" /> : <ChevronDownRegular className="w-4 h-4" />}
          </button>
        ) : null}
      </div>

      {/* Expandable preview */}
      {expanded && hasPreview && action.status === 'pending' && (
        <div className="px-3 pb-2.5 pt-0.5 border-t border-theme-subtle">
          {action.content.screenplayElements ? (
            <ScreenplayPreview elements={action.content.screenplayElements} textSize={textSize} />
          ) : action.content.text ? (
            <div className="whitespace-pre-wrap text-theme-secondary" style={{ fontSize: textSize - 2 }}>
              {action.content.text}
            </div>
          ) : null}
        </div>
      )}

      {/* Accept / Reject buttons for pending actions */}
      {action.status === 'pending' && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-theme-subtle">
          <button
            onClick={onAccept}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors"
            style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
          >
            <CheckmarkRegular className="w-3.5 h-3.5" />
            Accept
          </button>
          <button
            onClick={onReject}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-theme-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
            style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
          >
            <DismissRegular className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
