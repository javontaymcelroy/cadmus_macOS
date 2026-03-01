import {
  CheckmarkRegular,
  DismissRegular,
  EditRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  TargetRegular,
  WarningRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
} from '@fluentui/react-icons'
import { clsx } from 'clsx'
import { useState, useCallback } from 'react'
import type { PipelineAction } from '../../../shared/thoughtPartnerPipelineTypes'

interface PlanCardProps {
  action: PipelineAction
  onApprove: (planId: string) => void
  onRevise: (planId: string, feedback: string) => void
  onReject: (planId: string) => void
  textSize?: number
}

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

const impactColors: Record<string, { text: string; bg: string }> = {
  low: { text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  medium: { text: 'text-amber-400', bg: 'bg-amber-400/10' },
  high: { text: 'text-red-400', bg: 'bg-red-400/10' },
}

const scopeLabels: Record<string, string> = {
  selection: 'Selection',
  section: 'Section',
  document: 'Document',
  'multi-document': 'Multi-Document',
}

export function PlanCard({ action, onApprove, onRevise, onReject, textSize = 13 }: PlanCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [reviseMode, setReviseMode] = useState(false)
  const [reviseFeedback, setReviseFeedback] = useState('')

  const plan = action.structuredPlan
  if (!plan) return null

  const isPending = plan.status === 'pending'
  const isApproved = plan.status === 'approved'
  const isRejected = plan.status === 'rejected'

  const handleReviseSubmit = useCallback(() => {
    const text = reviseFeedback.trim()
    if (!text) return
    onRevise(plan.id, text)
    setReviseFeedback('')
    setReviseMode(false)
  }, [reviseFeedback, plan.id, onRevise])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleReviseSubmit()
    }
  }, [handleReviseSubmit])

  return (
    <div
      className={clsx(
        'rounded-lg border overflow-hidden transition-all',
        isApproved ? 'opacity-70 border-emerald-400/30 bg-theme-panel' :
        isRejected ? 'opacity-70 border-theme-subtle bg-theme-panel' :
        'border-blue-400/30 bg-theme-elevated'
      )}
      style={{ fontFamily: FONT_FAMILY }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-blue-400/10">
          <TargetRegular className="w-3.5 h-3.5 text-blue-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold uppercase tracking-wider text-blue-400" style={{ fontSize: textSize - 3 }}>
            Edit Plan
          </div>
          <div className="font-medium text-theme-primary leading-snug mt-0.5" style={{ fontSize: textSize }}>
            {plan.goal}
          </div>
        </div>

        {/* Status indicators */}
        {isApproved && (
          <div className="flex items-center gap-1 text-emerald-400 flex-shrink-0" style={{ fontSize: textSize - 2 }}>
            <CheckmarkCircleRegular className="w-4 h-4" />
            <span>Approved</span>
          </div>
        )}
        {isRejected && (
          <div className="flex items-center gap-1 text-theme-muted flex-shrink-0" style={{ fontSize: textSize - 2 }}>
            <DismissCircleRegular className="w-4 h-4" />
            <span>Rejected</span>
          </div>
        )}

        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-theme-active transition-colors text-theme-muted flex-shrink-0"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUpRegular className="w-4 h-4" /> : <ChevronDownRegular className="w-4 h-4" />}
        </button>
      </div>

      {/* Scope badge */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <span
          className="inline-block px-2 py-0.5 rounded-full text-blue-400 bg-blue-400/10 border border-blue-400/20"
          style={{ fontSize: textSize - 3 }}
        >
          {scopeLabels[plan.scope] || plan.scope}
        </span>
        <span className="text-theme-muted" style={{ fontSize: textSize - 3 }}>
          {plan.steps.length} step{plan.steps.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-theme-subtle">
          {/* Assumptions */}
          {plan.assumptions.length > 0 && (
            <div className="px-3 py-2 border-b border-theme-subtle">
              <div className="font-semibold text-theme-muted uppercase tracking-wider mb-1" style={{ fontSize: textSize - 3 }}>
                Assumptions
              </div>
              <ul className="space-y-0.5">
                {plan.assumptions.map((a, i) => (
                  <li key={i} className="text-theme-secondary flex gap-1.5" style={{ fontSize: textSize - 1 }}>
                    <span className="text-theme-muted flex-shrink-0">&bull;</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Steps */}
          <div className="px-3 py-2 border-b border-theme-subtle">
            <div className="font-semibold text-theme-muted uppercase tracking-wider mb-1.5" style={{ fontSize: textSize - 3 }}>
              Steps
            </div>
            <div className="space-y-2">
              {plan.steps.map((step, i) => {
                const impact = impactColors[step.estimatedImpact] || impactColors.medium
                return (
                  <div key={step.id || i} className="flex gap-2">
                    <span className="text-theme-muted flex-shrink-0 font-mono" style={{ fontSize: textSize - 2 }}>
                      {i + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-theme-primary" style={{ fontSize: textSize - 1 }}>
                        {step.description}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={clsx('inline-block px-1.5 py-0 rounded', impact.bg, impact.text)}
                          style={{ fontSize: textSize - 3 }}
                        >
                          {step.estimatedImpact}
                        </span>
                        {step.targetBlockIds && step.targetBlockIds.length > 0 && (
                          <span className="text-theme-muted" style={{ fontSize: textSize - 3 }}>
                            {step.targetBlockIds.length} block{step.targetBlockIds.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Risks */}
          {plan.risks.length > 0 && (
            <div className="px-3 py-2 border-b border-theme-subtle">
              <div className="font-semibold text-theme-muted uppercase tracking-wider mb-1 flex items-center gap-1" style={{ fontSize: textSize - 3 }}>
                <WarningRegular className="w-3 h-3 text-amber-400" />
                Risks
              </div>
              <ul className="space-y-0.5">
                {plan.risks.map((r, i) => (
                  <li key={i} className="text-amber-300/80 flex gap-1.5" style={{ fontSize: textSize - 1 }}>
                    <span className="flex-shrink-0">&bull;</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Acceptance Criteria */}
          {plan.acceptanceCriteria.length > 0 && (
            <div className="px-3 py-2 border-b border-theme-subtle">
              <div className="font-semibold text-theme-muted uppercase tracking-wider mb-1" style={{ fontSize: textSize - 3 }}>
                Acceptance Criteria
              </div>
              <ul className="space-y-0.5">
                {plan.acceptanceCriteria.map((ac, i) => (
                  <li key={i} className="text-theme-secondary flex gap-1.5" style={{ fontSize: textSize - 1 }}>
                    <span className="text-emerald-400 flex-shrink-0">&#10003;</span>
                    <span>{ac}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Questions */}
          {plan.questions.length > 0 && (
            <div className="px-3 py-2 border-b border-theme-subtle">
              <div className="font-semibold text-theme-muted uppercase tracking-wider mb-1.5" style={{ fontSize: textSize - 3 }}>
                Questions
              </div>
              <div className="space-y-2">
                {plan.questions.map((q, i) => (
                  <div key={i}>
                    <div className="text-theme-primary font-medium mb-1" style={{ fontSize: textSize - 1 }}>
                      {q.text}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {q.options.map((opt, j) => (
                        <span
                          key={j}
                          className="inline-block px-2 py-0.5 rounded-md border border-theme-subtle text-theme-secondary bg-theme-panel"
                          style={{ fontSize: textSize - 2 }}
                          title={opt.description}
                        >
                          {opt.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revise mode textarea */}
      {reviseMode && isPending && (
        <div className="px-3 py-2 border-t border-theme-subtle">
          <textarea
            value={reviseFeedback}
            onChange={e => setReviseFeedback(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What should change about this plan?"
            className="w-full px-2.5 py-2 rounded-lg border border-theme-subtle bg-theme-panel text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-blue-400/50 resize-none"
            style={{ fontSize: textSize - 1, fontFamily: FONT_FAMILY, minHeight: 60 }}
            rows={3}
          />
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={handleReviseSubmit}
              disabled={!reviseFeedback.trim()}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors',
                reviseFeedback.trim()
                  ? 'text-blue-400 bg-blue-400/10 hover:bg-blue-400/20'
                  : 'text-theme-muted cursor-not-allowed'
              )}
              style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
            >
              Send Feedback
            </button>
            <button
              onClick={() => { setReviseMode(false); setReviseFeedback('') }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-theme-muted hover:text-theme-secondary transition-colors"
              style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isPending && !reviseMode && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-theme-subtle">
          <button
            onClick={() => onApprove(plan.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors"
            style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
          >
            <CheckmarkRegular className="w-3.5 h-3.5" />
            Approve
          </button>
          <button
            onClick={() => setReviseMode(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 transition-colors"
            style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
          >
            <EditRegular className="w-3.5 h-3.5" />
            Revise
          </button>
          <button
            onClick={() => onReject(plan.id)}
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
