import {
  LightbulbRegular,
  CheckmarkRegular,
  EditRegular,
  QuestionCircleRegular,
  CheckmarkCircleRegular,
  SendRegular,
} from '@fluentui/react-icons'
import { clsx } from 'clsx'
import { useState, useCallback } from 'react'
import type { PipelineAction, ReflectionQuestion } from '../../../shared/thoughtPartnerPipelineTypes'

interface ReflectionCardProps {
  action: PipelineAction
  onAccept: (reflectionId: string) => void
  onEdit: (reflectionId: string, newInterpretation: string) => void
  onAnswer: (
    reflectionId: string,
    meaningAnswers: Array<{ questionText: string; answer: string }>,
    executionAnswers: Array<{ questionText: string; answer: string }>
  ) => void
  textSize?: number
}

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

const routeLabels: Record<string, string> = {
  execute_now: 'Proceed immediately',
  ask_align: 'Answer questions first',
  plan: 'Create a plan',
}

const scopeLabels: Record<string, string> = {
  selection: 'Selection',
  section: 'Section',
  document: 'Document',
  'multi-document': 'Multi-Document',
}

export function ReflectionCard({ action, onAccept, onEdit, onAnswer, textSize = 13 }: ReflectionCardProps) {
  const [mode, setMode] = useState<'default' | 'editing' | 'answering'>('default')
  const [editedText, setEditedText] = useState('')
  const [meaningAnswer, setMeaningAnswer] = useState<string | null>(null)
  const [executionAnswer, setExecutionAnswer] = useState<string | null>(null)

  const reflection = action.reflection
  if (!reflection) return null

  const isPending = reflection.status === 'pending'
  const isDone = ['accepted', 'edited', 'answered', 'dismissed'].includes(reflection.status)

  const hasQuestions =
    reflection.meaningQuestions.length > 0 || reflection.executionQuestions.length > 0

  const handleEditStart = useCallback(() => {
    setEditedText(reflection.interpretation)
    setMode('editing')
  }, [reflection.interpretation])

  const handleEditSubmit = useCallback(() => {
    const text = editedText.trim()
    if (!text) return
    onEdit(reflection.id, text)
    setMode('default')
  }, [editedText, reflection.id, onEdit])

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditSubmit()
    }
  }, [handleEditSubmit])

  const handleAnswerSubmit = useCallback(() => {
    const mAnswers: Array<{ questionText: string; answer: string }> = []
    const eAnswers: Array<{ questionText: string; answer: string }> = []

    if (reflection.meaningQuestions.length > 0 && meaningAnswer) {
      mAnswers.push({ questionText: reflection.meaningQuestions[0].text, answer: meaningAnswer })
    }
    if (reflection.executionQuestions.length > 0 && executionAnswer) {
      eAnswers.push({ questionText: reflection.executionQuestions[0].text, answer: executionAnswer })
    }

    onAnswer(reflection.id, mAnswers, eAnswers)
    setMode('default')
  }, [reflection, meaningAnswer, executionAnswer, onAnswer])

  const allQuestionsAnswered =
    (reflection.meaningQuestions.length === 0 || meaningAnswer !== null) &&
    (reflection.executionQuestions.length === 0 || executionAnswer !== null)

  const statusLabel = reflection.status === 'accepted' ? 'Confirmed' :
                      reflection.status === 'edited' ? 'Corrected' :
                      reflection.status === 'answered' ? 'Answered' : null

  return (
    <div
      className={clsx(
        'rounded-lg border overflow-hidden transition-all',
        isDone ? 'opacity-70 border-theme-subtle bg-theme-panel' :
        'border-purple-400/30 bg-theme-elevated'
      )}
      style={{ fontFamily: FONT_FAMILY }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-purple-400/10">
          <LightbulbRegular className="w-3.5 h-3.5 text-purple-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold uppercase tracking-wider text-purple-400" style={{ fontSize: textSize - 3 }}>
            Understanding
          </div>
        </div>

        {/* Status indicator */}
        {isDone && statusLabel && (
          <div className="flex items-center gap-1 text-emerald-400 flex-shrink-0" style={{ fontSize: textSize - 2 }}>
            <CheckmarkCircleRegular className="w-4 h-4" />
            <span>{statusLabel}</span>
          </div>
        )}
      </div>

      {/* Interpretation */}
      <div className="px-3 pb-2">
        <div className="text-theme-primary leading-snug" style={{ fontSize: textSize }}>
          {reflection.editedInterpretation || reflection.interpretation}
        </div>
      </div>

      {/* Diagnosis */}
      <div className="px-3 pb-2">
        <div className="rounded-md px-2.5 py-1.5 bg-purple-400/5 border border-purple-400/10">
          <div className="font-semibold text-theme-muted uppercase tracking-wider mb-0.5" style={{ fontSize: textSize - 3 }}>
            Diagnosis
          </div>
          <div className="text-theme-secondary leading-snug" style={{ fontSize: textSize - 1 }}>
            {reflection.diagnosis}
          </div>
        </div>
      </div>

      {/* Scope + Route badges */}
      <div className="px-3 pb-2.5 flex items-center gap-2 flex-wrap">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-purple-400 bg-purple-400/10 border border-purple-400/20"
          style={{ fontSize: textSize - 3 }}
        >
          {scopeLabels[reflection.proposedScope] || reflection.proposedScope}
        </span>
        <span className="text-theme-muted" style={{ fontSize: textSize - 3 }}>
          Recommends: {routeLabels[reflection.route] || reflection.route}
        </span>
      </div>

      {/* Editing mode */}
      {mode === 'editing' && isPending && (
        <div className="px-3 py-2 border-t border-theme-subtle">
          <div className="font-semibold text-theme-muted uppercase tracking-wider mb-1" style={{ fontSize: textSize - 3 }}>
            Correct the interpretation
          </div>
          <textarea
            value={editedText}
            onChange={e => setEditedText(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className="w-full px-2.5 py-2 rounded-lg border border-theme-subtle bg-theme-panel text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-purple-400/50 resize-none"
            style={{ fontSize: textSize - 1, fontFamily: FONT_FAMILY, minHeight: 60 }}
            rows={3}
          />
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={handleEditSubmit}
              disabled={!editedText.trim()}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors',
                editedText.trim()
                  ? 'text-purple-400 bg-purple-400/10 hover:bg-purple-400/20'
                  : 'text-theme-muted cursor-not-allowed'
              )}
              style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
            >
              <SendRegular className="w-3.5 h-3.5" />
              Send
            </button>
            <button
              onClick={() => { setMode('default'); setEditedText('') }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-theme-muted hover:text-theme-secondary transition-colors"
              style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Answering mode */}
      {mode === 'answering' && isPending && (
        <div className="px-3 py-2 border-t border-theme-subtle space-y-3">
          {/* Meaning question */}
          {reflection.meaningQuestions.length > 0 && (
            <QuestionSection
              label="Meaning"
              question={reflection.meaningQuestions[0]}
              selectedAnswer={meaningAnswer}
              onSelect={setMeaningAnswer}
              textSize={textSize}
              accentColor="purple"
            />
          )}

          {/* Execution question */}
          {reflection.executionQuestions.length > 0 && (
            <QuestionSection
              label="Execution"
              question={reflection.executionQuestions[0]}
              selectedAnswer={executionAnswer}
              onSelect={setExecutionAnswer}
              textSize={textSize}
              accentColor="blue"
            />
          )}

          {/* Submit + Cancel */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleAnswerSubmit}
              disabled={!allQuestionsAnswered}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors',
                allQuestionsAnswered
                  ? 'text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20'
                  : 'text-theme-muted cursor-not-allowed'
              )}
              style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
            >
              <CheckmarkRegular className="w-3.5 h-3.5" />
              Submit
            </button>
            <button
              onClick={() => { setMode('default'); setMeaningAnswer(null); setExecutionAnswer(null) }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-theme-muted hover:text-theme-secondary transition-colors"
              style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons (default mode, pending only) */}
      {mode === 'default' && isPending && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-theme-subtle">
          <button
            onClick={() => onAccept(reflection.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors"
            style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
          >
            <CheckmarkRegular className="w-3.5 h-3.5" />
            Yep
          </button>
          <button
            onClick={handleEditStart}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 transition-colors"
            style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
          >
            <EditRegular className="w-3.5 h-3.5" />
            Not quite
          </button>
          {hasQuestions && (
            <button
              onClick={() => setMode('answering')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[var(--accent-gold)] bg-[var(--accent-gold-muted)] hover:bg-[var(--accent-gold-border)] transition-colors"
              style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
            >
              <QuestionCircleRegular className="w-3.5 h-3.5" />
              Ask me
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ===== Inline question section for answering mode =====

function QuestionSection({
  label,
  question,
  selectedAnswer,
  onSelect,
  textSize,
  accentColor,
}: {
  label: string
  question: ReflectionQuestion
  selectedAnswer: string | null
  onSelect: (answer: string) => void
  textSize: number
  accentColor: 'purple' | 'blue'
}) {
  const colorMap = {
    purple: { text: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
    blue: { text: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  }
  const colors = colorMap[accentColor]

  return (
    <div>
      <div className={clsx('font-semibold uppercase tracking-wider mb-1', colors.text)} style={{ fontSize: textSize - 3 }}>
        {label}
      </div>
      <div className="text-theme-primary font-medium mb-1.5" style={{ fontSize: textSize - 1 }}>
        {question.text}
      </div>
      <div className="space-y-1">
        {question.options.map((opt, j) => (
          <button
            key={j}
            onClick={() => onSelect(opt.label)}
            className={clsx(
              'w-full px-3 py-1.5 rounded-lg border text-left transition-all cursor-pointer',
              selectedAnswer === opt.label
                ? `${colors.border} ${colors.bg} ${colors.text}`
                : 'border-theme-subtle hover:border-theme-active hover:bg-theme-active'
            )}
          >
            <div className={clsx('font-medium', selectedAnswer === opt.label ? colors.text : 'text-theme-primary')} style={{ fontSize: textSize - 1 }}>
              {opt.label}
            </div>
            {opt.description && (
              <div className="text-theme-muted mt-0.5" style={{ fontSize: textSize - 2 }}>
                {opt.description}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
