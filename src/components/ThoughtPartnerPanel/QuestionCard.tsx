import {
  CheckmarkCircleRegular,
  DismissCircleRegular,
  SendRegular
} from '@fluentui/react-icons'
import { clsx } from 'clsx'
import { useState, useCallback } from 'react'

interface QuestionCardProps {
  question: {
    id: string
    questionText: string
    options: Array<{ id: string; label: string; description?: string }>
    allowCustom: boolean
    status: 'active' | 'answered' | 'skipped'
    selectedOptionId?: string
    customAnswer?: string
    category?: string
  }
  onSelectOption: (questionId: string, optionId: string) => void
  onSubmitCustom: (questionId: string, text: string) => void
  onSkip: (questionId: string) => void
  textSize?: number
}

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

const categoryLabels: Record<string, string> = {
  tone: 'Tone',
  structure: 'Structure',
  character: 'Character',
  plot: 'Plot',
  style: 'Style',
  general: 'Question'
}

export function QuestionCard({ question, onSelectOption, onSubmitCustom, onSkip, textSize = 13 }: QuestionCardProps) {
  const [customText, setCustomText] = useState('')
  const isActive = question.status === 'active'
  const isAnswered = question.status === 'answered'
  const isSkipped = question.status === 'skipped'

  const categoryLabel = categoryLabels[question.category || 'general'] || categoryLabels.general

  const handleCustomSubmit = useCallback(() => {
    const text = customText.trim()
    if (!text) return
    onSubmitCustom(question.id, text)
    setCustomText('')
  }, [customText, question.id, onSubmitCustom])

  const handleCustomKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCustomSubmit()
    }
  }, [handleCustomSubmit])

  // Get the displayed answer for answered state
  const answeredLabel = isAnswered
    ? (question.selectedOptionId
        ? question.options.find(o => o.id === question.selectedOptionId)?.label
        : question.customAnswer) || ''
    : ''

  return (
    <div
      className={clsx(
        'rounded-lg border overflow-hidden transition-all',
        !isActive
          ? 'opacity-70 border-theme-subtle bg-theme-panel'
          : 'border-[var(--accent-gold-border)] bg-theme-panel'
      )}
      style={{ fontFamily: FONT_FAMILY }}
    >
      {/* Category label + status */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span
          className="text-[var(--accent-gold)] font-semibold uppercase tracking-wider"
          style={{ fontSize: textSize - 3 }}
        >
          {categoryLabel}
        </span>

        {isAnswered && (
          <div className="flex items-center gap-1 text-emerald-400" style={{ fontSize: textSize - 2 }}>
            <CheckmarkCircleRegular className="w-3.5 h-3.5" />
          </div>
        )}
        {isSkipped && (
          <div className="flex items-center gap-1 text-theme-muted" style={{ fontSize: textSize - 2 }}>
            <DismissCircleRegular className="w-3.5 h-3.5" />
            <span>Skipped</span>
          </div>
        )}
      </div>

      {/* Question text */}
      <div className="px-3 pb-2.5">
        <div className="font-medium text-theme-primary leading-snug" style={{ fontSize: textSize }}>
          {question.questionText}
        </div>
      </div>

      {/* Active state: show options + custom input */}
      {isActive && (
        <div className="px-3 pb-3 space-y-1.5">
          {/* Option buttons */}
          {question.options.map(option => (
            <button
              key={option.id}
              onClick={() => onSelectOption(question.id, option.id)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-left transition-all',
                'border-theme-subtle hover:border-[var(--accent-gold-border)] hover:bg-theme-active',
                'cursor-pointer group'
              )}
            >
              <div className="font-medium text-theme-primary group-hover:text-theme-accent transition-colors" style={{ fontSize: textSize }}>
                {option.label}
              </div>
              {option.description && (
                <div className="text-theme-muted mt-0.5" style={{ fontSize: textSize - 2 }}>
                  {option.description}
                </div>
              )}
            </button>
          ))}

          {/* Custom input */}
          {question.allowCustom && (
            <div className="flex items-center gap-1.5 mt-2">
              <input
                type="text"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={handleCustomKeyDown}
                placeholder="Or type your own..."
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-theme-subtle bg-theme-panel text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-[var(--accent-gold-border)]"
                style={{ fontSize: textSize - 1, fontFamily: FONT_FAMILY }}
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customText.trim()}
                className={clsx(
                  'flex items-center justify-center w-7 h-7 rounded-lg transition-colors',
                  customText.trim()
                    ? 'bg-[var(--accent-gold-muted)] text-[var(--accent-gold)] hover:bg-[var(--accent-gold-border)]'
                    : 'text-theme-muted cursor-not-allowed'
                )}
                title="Send"
              >
                <SendRegular className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Skip link */}
          <button
            onClick={() => onSkip(question.id)}
            className="text-theme-muted hover:text-theme-secondary transition-colors mt-3"
            style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
          >
            Skip this question
          </button>
        </div>
      )}

      {/* Answered state: show what was selected */}
      {isAnswered && answeredLabel && (
        <div className="px-3 pb-2.5 pt-0">
          <div
            className="inline-block px-2.5 py-1 rounded-md bg-[var(--accent-gold-muted)] text-[var(--accent-gold)] border border-[var(--accent-gold-border)]"
            style={{ fontSize: textSize - 1 }}
          >
            {answeredLabel}
          </div>
        </div>
      )}
    </div>
  )
}
