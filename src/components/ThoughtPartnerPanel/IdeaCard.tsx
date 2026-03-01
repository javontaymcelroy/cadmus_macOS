import {
  SparkleRegular,
  ChevronDownRegular,
  ChevronUpRegular,
  ArrowRightRegular,
  ShieldTaskRegular,
  DocumentRegular,
  BranchRegular,
  DismissRegular,
  WarningRegular,
  CheckmarkCircleRegular,
} from '@fluentui/react-icons'
import { clsx } from 'clsx'
import { useState, useCallback } from 'react'
import type { PipelineAction, IdeaCard } from '../../../shared/thoughtPartnerPipelineTypes'

interface IdeaCardsGroupProps {
  action: PipelineAction
  onExplore: (ideaCardId: string, expansionPathId?: string) => void
  onStressTest: (ideaCardId: string) => void
  onTurnInto: (ideaCardId: string, targetType: 'scene' | 'mechanic') => void
  onMerge: (ideaCardIdA: string, ideaCardIdB: string) => void
  onDiscard: (ideaCardId: string) => void
  otherPendingIdeaCards: IdeaCard[]
  textSize?: number
}

const FONT_FAMILY = 'Calibri, "Segoe UI", system-ui, -apple-system, sans-serif'

const statusLabels: Record<string, string> = {
  exploring: 'Exploring',
  'stress-testing': 'Stress Testing',
  merged: 'Merged',
  converted: 'Converted',
  discarded: 'Discarded',
}

export function IdeaCardsGroup({ action, onExplore, onStressTest, onTurnInto, onMerge, onDiscard, otherPendingIdeaCards, textSize = 13 }: IdeaCardsGroupProps) {
  const ideaCards = action.ideaCards || []
  if (ideaCards.length === 0) return null

  const pendingCount = ideaCards.filter(ic => ic.status === 'pending').length

  return (
    <div
      className="rounded-lg border border-amber-400/30 bg-theme-elevated overflow-hidden"
      style={{ fontFamily: FONT_FAMILY }}
    >
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-amber-400/10">
          <SparkleRegular className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold uppercase tracking-wider text-amber-400" style={{ fontSize: textSize - 3 }}>
            Idea Cards
          </div>
        </div>
        <span className="text-theme-muted flex-shrink-0" style={{ fontSize: textSize - 3 }}>
          {pendingCount > 0 ? `${pendingCount} to review` : `${ideaCards.length} ideas`}
        </span>
      </div>

      {/* Individual cards */}
      <div className="space-y-0">
        {ideaCards.map(card => (
          <SingleIdeaCard
            key={card.id}
            card={card}
            onExplore={onExplore}
            onStressTest={onStressTest}
            onTurnInto={onTurnInto}
            onMerge={onMerge}
            onDiscard={onDiscard}
            otherPendingIdeaCards={otherPendingIdeaCards.filter(ic => ic.id !== card.id)}
            textSize={textSize}
          />
        ))}
      </div>
    </div>
  )
}

// ===== Individual idea card =====

function SingleIdeaCard({
  card,
  onExplore,
  onStressTest,
  onTurnInto,
  onMerge,
  onDiscard,
  otherPendingIdeaCards,
  textSize,
}: {
  card: IdeaCard
  onExplore: (ideaCardId: string, expansionPathId?: string) => void
  onStressTest: (ideaCardId: string) => void
  onTurnInto: (ideaCardId: string, targetType: 'scene' | 'mechanic') => void
  onMerge: (ideaCardIdA: string, ideaCardIdB: string) => void
  onDiscard: (ideaCardId: string) => void
  otherPendingIdeaCards: IdeaCard[]
  textSize: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [showTurnIntoMenu, setShowTurnIntoMenu] = useState(false)
  const [showMergeSelector, setShowMergeSelector] = useState(false)

  const isPending = card.status === 'pending'
  const isActive = card.status === 'exploring' || card.status === 'stress-testing'
  const isDone = ['merged', 'converted', 'discarded'].includes(card.status)

  const handleToggleExpand = useCallback(() => {
    setExpanded(prev => !prev)
  }, [])

  return (
    <div
      className={clsx(
        'border-t border-theme-subtle transition-all',
        isDone && 'opacity-50',
        isActive && 'bg-amber-400/5'
      )}
    >
      {/* Card header: title + hook + tags + chevron */}
      <div
        className="px-3 py-2 cursor-pointer hover:bg-theme-active/50 transition-colors"
        onClick={handleToggleExpand}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={clsx(
                  'font-semibold text-theme-primary',
                  card.status === 'discarded' && 'line-through'
                )}
                style={{ fontSize: textSize }}
              >
                {card.title}
              </span>

              {/* Status indicator */}
              {isDone && statusLabels[card.status] && (
                <span className="flex items-center gap-0.5 text-theme-muted" style={{ fontSize: textSize - 3 }}>
                  <CheckmarkCircleRegular className="w-3 h-3" />
                  {statusLabels[card.status]}
                </span>
              )}

              {/* Active indicator */}
              {isActive && (
                <span className="flex items-center gap-0.5 text-amber-400" style={{ fontSize: textSize - 3 }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  {statusLabels[card.status]}
                </span>
              )}
            </div>

            <div className="text-theme-secondary leading-snug mt-0.5" style={{ fontSize: textSize - 1 }}>
              {card.hook}
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1 flex-wrap mt-1.5">
              {card.tags.map((tag, i) => (
                <span
                  key={i}
                  className="inline-block px-1.5 py-0 rounded text-amber-400 bg-amber-400/10 border border-amber-400/20"
                  style={{ fontSize: textSize - 4 }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Expand/collapse chevron */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleExpand() }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors mt-0.5"
          >
            {expanded
              ? <ChevronUpRegular className="w-3.5 h-3.5" />
              : <ChevronDownRegular className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-2 space-y-2">
          {/* Core Insight */}
          <div className="rounded-md px-2.5 py-1.5 bg-amber-400/5 border border-amber-400/10">
            <div className="font-semibold text-theme-muted uppercase tracking-wider mb-0.5" style={{ fontSize: textSize - 3 }}>
              Core Insight
            </div>
            <div className="text-theme-secondary leading-snug" style={{ fontSize: textSize - 1 }}>
              {card.coreInsight}
            </div>
          </div>

          {/* Why It Matters */}
          <div className="rounded-md px-2.5 py-1.5 bg-theme-panel border border-theme-subtle">
            <div className="font-semibold text-theme-muted uppercase tracking-wider mb-0.5" style={{ fontSize: textSize - 3 }}>
              Why It Matters
            </div>
            <div className="text-theme-secondary leading-snug" style={{ fontSize: textSize - 1 }}>
              {card.whyItMatters}
            </div>
          </div>

          {/* Expansion Paths */}
          {card.expansionPaths.length > 0 && (
            <div>
              <div className="font-semibold text-theme-muted uppercase tracking-wider mb-1" style={{ fontSize: textSize - 3 }}>
                Expand This
              </div>
              <div className="space-y-1">
                {card.expansionPaths.map(ep => (
                  <button
                    key={ep.id}
                    onClick={() => isPending && onExplore(card.id, ep.id)}
                    disabled={!isPending}
                    className={clsx(
                      'w-full flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all',
                      isPending
                        ? 'border-theme-subtle hover:border-amber-400/30 hover:bg-amber-400/5 cursor-pointer'
                        : 'border-theme-subtle opacity-60 cursor-default'
                    )}
                  >
                    <ArrowRightRegular className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-theme-primary" style={{ fontSize: textSize - 1 }}>
                        {ep.label}
                      </div>
                      <div className="text-theme-muted" style={{ fontSize: textSize - 2 }}>
                        {ep.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {card.risks.length > 0 && (
            <div>
              <div className="font-semibold text-theme-muted uppercase tracking-wider mb-1" style={{ fontSize: textSize - 3 }}>
                Risks
              </div>
              <div className="space-y-0.5">
                {card.risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-1.5" style={{ fontSize: textSize - 2 }}>
                    <WarningRegular className="w-3 h-3 text-red-400/70 mt-0.5 flex-shrink-0" />
                    <span className="text-theme-muted">{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {isPending && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-theme-subtle">
              {/* Explore */}
              <button
                onClick={() => onExplore(card.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition-colors"
                style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
              >
                <SparkleRegular className="w-3.5 h-3.5" />
                Explore
              </button>

              {/* Stress Test */}
              <button
                onClick={() => onStressTest(card.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors"
                style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
              >
                <ShieldTaskRegular className="w-3.5 h-3.5" />
                Stress Test
              </button>

              {/* Turn into... */}
              <div className="relative">
                <button
                  onClick={() => setShowTurnIntoMenu(prev => !prev)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 transition-colors"
                  style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
                >
                  <DocumentRegular className="w-3.5 h-3.5" />
                  Turn into...
                </button>
                {showTurnIntoMenu && (
                  <div className="absolute left-0 top-full mt-1 z-10 bg-theme-elevated border border-theme-subtle rounded-lg shadow-lg overflow-hidden min-w-[120px]">
                    <button
                      onClick={() => { onTurnInto(card.id, 'scene'); setShowTurnIntoMenu(false) }}
                      className="w-full text-left px-3 py-1.5 text-theme-primary hover:bg-theme-active transition-colors"
                      style={{ fontSize: textSize - 1, fontFamily: FONT_FAMILY }}
                    >
                      Scene
                    </button>
                    <button
                      onClick={() => { onTurnInto(card.id, 'mechanic'); setShowTurnIntoMenu(false) }}
                      className="w-full text-left px-3 py-1.5 text-theme-primary hover:bg-theme-active transition-colors"
                      style={{ fontSize: textSize - 1, fontFamily: FONT_FAMILY }}
                    >
                      Mechanic
                    </button>
                  </div>
                )}
              </div>

              {/* Merge with... */}
              {otherPendingIdeaCards.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowMergeSelector(prev => !prev)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-purple-400 bg-purple-400/10 hover:bg-purple-400/20 transition-colors"
                    style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
                  >
                    <BranchRegular className="w-3.5 h-3.5" />
                    Merge
                  </button>
                  {showMergeSelector && (
                    <div className="absolute left-0 top-full mt-1 z-10 bg-theme-elevated border border-theme-subtle rounded-lg shadow-lg overflow-hidden min-w-[180px] max-w-[260px]">
                      <div className="px-2.5 py-1.5 text-theme-muted border-b border-theme-subtle" style={{ fontSize: textSize - 3 }}>
                        Merge with...
                      </div>
                      {otherPendingIdeaCards.map(other => (
                        <button
                          key={other.id}
                          onClick={() => { onMerge(card.id, other.id); setShowMergeSelector(false) }}
                          className="w-full text-left px-3 py-1.5 text-theme-primary hover:bg-theme-active transition-colors"
                          style={{ fontSize: textSize - 1, fontFamily: FONT_FAMILY }}
                        >
                          {other.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Discard */}
              <button
                onClick={() => onDiscard(card.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-theme-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                style={{ fontSize: textSize - 2, fontFamily: FONT_FAMILY }}
              >
                <DismissRegular className="w-3.5 h-3.5" />
                Discard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
