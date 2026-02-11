import { useState, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { clsx } from 'clsx'
import type { CritiqueIssue, CritiqueOperator, IssueSeverity } from '../../types/project'
import type { SceneState, CharacterEligibility, PipelineResult } from '../../../shared/sceneStateTypes'
import {
  SparkleFilled,
  ArrowSyncRegular,
  DismissRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  LocationRegular,
  LightbulbRegular,
  WarningRegular,
  PersonRegular,
  ClockRegular,
  LinkRegular,
  TextBulletListSquareRegular,
  ScalesRegular,
  ArrowRepeatAllRegular,
  QuestionCircleRegular,
  FilterRegular,
  ErrorCircleRegular,
  InfoRegular,
  CheckmarkCircleRegular,
  // Additional icons for 30 sins
  ArrowShuffleRegular,
  PeopleRegular,
  ThumbDislikeRegular,
  FlashRegular,
  ChatRegular,
  MegaphoneRegular,
  BookRegular,
  SettingsRegular,
  ShieldErrorRegular,
  BrainCircuitRegular,
  TargetArrowRegular,
  BoxRegular,
  MapRegular,
  CompassNorthwestRegular,
  EyeOffRegular,
  HeartBrokenRegular,
  WeatherThunderstormRegular,
  VideoRegular,
  ArrowTurnRightRegular,
  GiftRegular,
  NumberSymbolRegular,
  // Additional icons for scene state
  ProhibitedRegular,
  ShieldRegular,
  PlayRegular
} from '@fluentui/react-icons'

// Severity display config
const severityConfig: Record<IssueSeverity, { 
  icon: React.ReactNode
  label: string
  color: string
  bgColor: string
  borderColor: string
  sortOrder: number
}> = {
  blocking: {
    icon: <ErrorCircleRegular className="w-3.5 h-3.5" />,
    label: 'BLOCKING',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
    sortOrder: 0
  },
  warning: {
    icon: <WarningRegular className="w-3.5 h-3.5" />,
    label: 'WARNING',
    color: 'text-theme-accent',
    bgColor: 'bg-[var(--accent-gold-muted)]',
    borderColor: 'border-[var(--accent-gold-border)]',
    sortOrder: 1
  },
  optional: {
    icon: <InfoRegular className="w-3.5 h-3.5" />,
    label: 'OPTIONAL',
    color: 'text-theme-muted',
    bgColor: 'bg-theme-hover',
    borderColor: 'border-theme-default',
    sortOrder: 2
  }
}

// CinemaSins operator display config - 30 narrative sins
const operatorConfig: Record<CritiqueOperator, { icon: React.ReactNode; label: string; color: string }> = {
  // Character/Motivation (1-4)
  unclear_motivation: {
    icon: <QuestionCircleRegular className="w-4 h-4" />,
    label: 'Unclear Motivation',
    color: 'text-theme-accent'
  },
  motivation_shift: {
    icon: <ArrowShuffleRegular className="w-4 h-4" />,
    label: 'Motivation Shift',
    color: 'text-theme-accent'
  },
  behavior_contradiction: {
    icon: <WarningRegular className="w-4 h-4" />,
    label: 'Behavior Contradiction',
    color: 'text-theme-accent'
  },
  protagonist_passivity: {
    icon: <PersonRegular className="w-4 h-4" />,
    label: 'Protagonist Passivity',
    color: 'text-theme-accent'
  },
  // Convenience/Coincidence (5-6)
  coincidence_plotting: {
    icon: <ThumbDislikeRegular className="w-4 h-4" />,
    label: 'Coincidence Plotting',
    color: 'text-theme-accent'
  },
  convenient_information: {
    icon: <FlashRegular className="w-4 h-4" />,
    label: 'Convenient Information',
    color: 'text-theme-accent'
  },
  // Exposition/Dialogue (7-8, 21-22)
  exposition_dump: {
    icon: <MegaphoneRegular className="w-4 h-4" />,
    label: 'Exposition Dump',
    color: 'text-theme-accent'
  },
  audience_dialogue: {
    icon: <ChatRegular className="w-4 h-4" />,
    label: 'Audience Dialogue',
    color: 'text-theme-accent'
  },
  theme_stated: {
    icon: <BookRegular className="w-4 h-4" />,
    label: 'Theme Stated',
    color: 'text-theme-accent'
  },
  plot_dialogue: {
    icon: <TextBulletListSquareRegular className="w-4 h-4" />,
    label: 'Plot Dialogue',
    color: 'text-theme-accent'
  },
  // Rules/Logic (9-10, 25-26)
  late_rules: {
    icon: <SettingsRegular className="w-4 h-4" />,
    label: 'Late Rules',
    color: 'text-theme-accent'
  },
  rules_broken: {
    icon: <ShieldErrorRegular className="w-4 h-4" />,
    label: 'Rules Broken',
    color: 'text-theme-accent'
  },
  impossible_knowledge: {
    icon: <BrainCircuitRegular className="w-4 h-4" />,
    label: 'Impossible Knowledge',
    color: 'text-theme-accent'
  },
  undefined_tech: {
    icon: <FlashRegular className="w-4 h-4" />,
    label: 'Undefined Tech',
    color: 'text-theme-accent'
  },
  // Setup/Payoff (11-13)
  setup_no_payoff: {
    icon: <TargetArrowRegular className="w-4 h-4" />,
    label: 'Setup No Payoff',
    color: 'text-theme-accent'
  },
  payoff_no_setup: {
    icon: <GiftRegular className="w-4 h-4" />,
    label: 'Payoff No Setup',
    color: 'text-theme-accent'
  },
  forgotten_prop: {
    icon: <BoxRegular className="w-4 h-4" />,
    label: 'Forgotten Prop',
    color: 'text-theme-accent'
  },
  // Continuity/Timeline (14-16)
  location_logic: {
    icon: <MapRegular className="w-4 h-4" />,
    label: 'Location Logic',
    color: 'text-theme-accent'
  },
  timeline_issue: {
    icon: <ClockRegular className="w-4 h-4" />,
    label: 'Timeline Issue',
    color: 'text-theme-accent'
  },
  spatial_error: {
    icon: <CompassNorthwestRegular className="w-4 h-4" />,
    label: 'Spatial Error',
    color: 'text-theme-accent'
  },
  // Stakes/Conflict (17-20, 23-24)
  offscreen_resolution: {
    icon: <EyeOffRegular className="w-4 h-4" />,
    label: 'Offscreen Resolution',
    color: 'text-theme-accent'
  },
  stakes_asserted: {
    icon: <ScalesRegular className="w-4 h-4" />,
    label: 'Stakes Asserted',
    color: 'text-theme-accent'
  },
  unearned_emotion: {
    icon: <HeartBrokenRegular className="w-4 h-4" />,
    label: 'Unearned Emotion',
    color: 'text-theme-accent'
  },
  tonal_whiplash: {
    icon: <WeatherThunderstormRegular className="w-4 h-4" />,
    label: 'Tonal Whiplash',
    color: 'text-theme-accent'
  },
  fake_conflict: {
    icon: <LinkRegular className="w-4 h-4" />,
    label: 'Fake Conflict',
    color: 'text-theme-accent'
  },
  antagonist_fluctuation: {
    icon: <PeopleRegular className="w-4 h-4" />,
    label: 'Antagonist Fluctuation',
    color: 'text-theme-accent'
  },
  // Structure/Ending (27-29)
  montage_causality: {
    icon: <VideoRegular className="w-4 h-4" />,
    label: 'Montage Causality',
    color: 'text-theme-accent'
  },
  conflict_avoided: {
    icon: <ArrowTurnRightRegular className="w-4 h-4" />,
    label: 'Conflict Avoided',
    color: 'text-theme-accent'
  },
  consequence_dodged: {
    icon: <ShieldErrorRegular className="w-4 h-4" />,
    label: 'Consequence Dodged',
    color: 'text-theme-accent'
  },
  // Meta (30)
  repetition_sin: {
    icon: <NumberSymbolRegular className="w-4 h-4" />,
    label: 'Repetition Sin',
    color: 'text-theme-accent'
  }
}

// Debt categories for Sin Scoreboard - groups 30 sins into 8 narrative debt types
type DebtCategory = 'motivation' | 'convenience' | 'exposition' | 'logic' | 'setup' | 'stakes' | 'structure' | 'meta'

const debtCategories: Record<DebtCategory, {
  label: string
  operators: CritiqueOperator[]
  icon: React.ReactNode
  color: string
}> = {
  motivation: {
    label: 'Character Debt',
    operators: ['unclear_motivation', 'motivation_shift', 'behavior_contradiction', 'protagonist_passivity'],
    icon: <PersonRegular className="w-3.5 h-3.5" />,
    color: 'text-theme-accent'
  },
  convenience: {
    label: 'Convenience Sins',
    operators: ['coincidence_plotting', 'convenient_information', 'impossible_knowledge', 'undefined_tech'],
    icon: <FlashRegular className="w-3.5 h-3.5" />,
    color: 'text-theme-accent'
  },
  exposition: {
    label: 'Telling Not Showing',
    operators: ['exposition_dump', 'audience_dialogue', 'theme_stated', 'plot_dialogue'],
    icon: <MegaphoneRegular className="w-3.5 h-3.5" />,
    color: 'text-theme-accent'
  },
  logic: {
    label: 'Logic/Rules Debt',
    operators: ['late_rules', 'rules_broken', 'location_logic', 'spatial_error'],
    icon: <SettingsRegular className="w-3.5 h-3.5" />,
    color: 'text-theme-accent'
  },
  setup: {
    label: 'Promise Debt',
    operators: ['setup_no_payoff', 'payoff_no_setup', 'forgotten_prop'],
    icon: <TargetArrowRegular className="w-3.5 h-3.5" />,
    color: 'text-theme-accent'
  },
  stakes: {
    label: 'Stakes/Conflict Debt',
    operators: ['offscreen_resolution', 'stakes_asserted', 'unearned_emotion', 'tonal_whiplash', 'fake_conflict', 'antagonist_fluctuation'],
    icon: <ScalesRegular className="w-3.5 h-3.5" />,
    color: 'text-theme-accent'
  },
  structure: {
    label: 'Structure Sins',
    operators: ['timeline_issue', 'montage_causality', 'conflict_avoided', 'consequence_dodged'],
    icon: <ClockRegular className="w-3.5 h-3.5" />,
    color: 'text-theme-accent'
  },
  meta: {
    label: 'Pattern Sins',
    operators: ['repetition_sin'],
    icon: <NumberSymbolRegular className="w-3.5 h-3.5" />,
    color: 'text-theme-accent'
  }
}

// Map operator to its debt category
const operatorToCategory: Record<CritiqueOperator, DebtCategory> = {
  // Character/Motivation
  unclear_motivation: 'motivation',
  motivation_shift: 'motivation',
  behavior_contradiction: 'motivation',
  protagonist_passivity: 'motivation',
  // Convenience/Coincidence
  coincidence_plotting: 'convenience',
  convenient_information: 'convenience',
  impossible_knowledge: 'convenience',
  undefined_tech: 'convenience',
  // Exposition/Dialogue
  exposition_dump: 'exposition',
  audience_dialogue: 'exposition',
  theme_stated: 'exposition',
  plot_dialogue: 'exposition',
  // Rules/Logic
  late_rules: 'logic',
  rules_broken: 'logic',
  location_logic: 'logic',
  spatial_error: 'logic',
  // Setup/Payoff
  setup_no_payoff: 'setup',
  payoff_no_setup: 'setup',
  forgotten_prop: 'setup',
  // Stakes/Conflict
  offscreen_resolution: 'stakes',
  stakes_asserted: 'stakes',
  unearned_emotion: 'stakes',
  tonal_whiplash: 'stakes',
  fake_conflict: 'stakes',
  antagonist_fluctuation: 'stakes',
  // Structure/Ending
  timeline_issue: 'structure',
  montage_causality: 'structure',
  conflict_avoided: 'structure',
  consequence_dodged: 'structure',
  // Meta
  repetition_sin: 'meta'
}

// Sin Scoreboard - CinemaSins-style accumulating debt counter
interface SinScoreboardProps {
  issues: CritiqueIssue[]
}

function SinScoreboard({ issues }: SinScoreboardProps) {
  // Calculate debts per category
  const categoryDebts = useMemo(() => {
    const debts: Record<DebtCategory, { total: number; paid: number; unpaid: number }> = {
      motivation: { total: 0, paid: 0, unpaid: 0 },
      convenience: { total: 0, paid: 0, unpaid: 0 },
      exposition: { total: 0, paid: 0, unpaid: 0 },
      logic: { total: 0, paid: 0, unpaid: 0 },
      setup: { total: 0, paid: 0, unpaid: 0 },
      stakes: { total: 0, paid: 0, unpaid: 0 },
      structure: { total: 0, paid: 0, unpaid: 0 },
      meta: { total: 0, paid: 0, unpaid: 0 }
    }

    for (const issue of issues) {
      const category = operatorToCategory[issue.operator]
      if (category) {
        debts[category].total++
        if (issue.resolution === 'intentional') {
          debts[category].paid++
        } else if (!issue.resolution || issue.resolution === 'unresolved') {
          debts[category].unpaid++
        }
        // 'fixed' and 'deferred' don't count as unpaid debt
      }
    }

    return debts
  }, [issues])

  // Calculate totals
  const totalSins = useMemo(() => {
    return Object.values(categoryDebts).reduce((sum, cat) => sum + cat.total, 0)
  }, [categoryDebts])

  const paidSins = useMemo(() => {
    return Object.values(categoryDebts).reduce((sum, cat) => sum + cat.paid, 0)
  }, [categoryDebts])

  const unpaidSins = useMemo(() => {
    return Object.values(categoryDebts).reduce((sum, cat) => sum + cat.unpaid, 0)
  }, [categoryDebts])

  // Find max for bar scaling
  const maxCategoryDebt = useMemo(() => {
    return Math.max(...Object.values(categoryDebts).map(c => c.unpaid), 1)
  }, [categoryDebts])

  if (totalSins === 0) return null

  return (
    <div className="border-b border-theme-subtle">
      {/* Header with total counter */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-ui font-medium uppercase tracking-wider text-theme-muted">
            Narrative Sins
          </span>
          <span className="text-[9px] font-ui text-theme-muted italic">
            what the audience sees
          </span>
        </div>
        <div className="flex items-center gap-2">
          {paidSins > 0 && (
            <span className="text-xs font-ui text-green-400/60">
              -{paidSins} paid
            </span>
          )}
          <div className={clsx(
            'px-2 py-0.5 rounded font-mono text-sm font-bold',
            unpaidSins > 10 ? 'bg-red-500/20 text-red-400' :
            unpaidSins > 5 ? 'bg-[var(--accent-gold-muted)] text-theme-accent' :
            'bg-theme-active text-theme-secondary'
          )}>
            {unpaidSins}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="px-3 pb-2 space-y-1">
        {(Object.entries(debtCategories) as [DebtCategory, typeof debtCategories[DebtCategory]][]).map(([key, config]) => {
          const debt = categoryDebts[key]
          if (debt.total === 0) return null

          const barWidth = (debt.unpaid / maxCategoryDebt) * 100

          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <div className={clsx('w-4 flex-shrink-0', config.color)}>
                {config.icon}
              </div>
              <span className="w-24 text-theme-muted font-ui truncate text-[10px]">
                {config.label}
              </span>
              <div className="flex-1 h-1.5 bg-theme-hover rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-500',
                    debt.unpaid > 5 ? 'bg-red-400/60' :
                    debt.unpaid > 2 ? 'bg-[var(--accent-gold)]/60' :
                    'bg-[var(--accent-gold)]/30'
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={clsx(
                'w-6 text-right font-mono text-[10px]',
                debt.unpaid > 0 ? config.color : 'text-theme-muted'
              )}>
                +{debt.unpaid}
              </span>
              {debt.paid > 0 && (
                <span className="text-green-400/50 text-[9px] font-ui">
                  ({debt.paid} paid)
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Net debt summary */}
      {unpaidSins > 0 && (
        <div className="px-3 py-1.5 bg-theme-active border-t border-theme-subtle">
          <div className="flex items-center justify-between text-[10px] font-ui">
            <span className="text-theme-muted uppercase tracking-wide">
              Unresolved narrative debt
            </span>
            <span className={clsx(
              'font-mono font-bold',
              unpaidSins > 10 ? 'text-red-400' :
              unpaidSins > 5 ? 'text-theme-accent' :
              'text-theme-secondary'
            )}>
              {unpaidSins} sins
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

interface CritiqueIssueCardProps {
  issue: CritiqueIssue
  onDismiss: () => void
  onNavigate?: (documentId: string, blockId: string) => void
  onResolve?: (resolution: 'fixed' | 'intentional' | 'deferred') => void
}

function CritiqueIssueCard({ issue, onDismiss, onNavigate, onResolve }: CritiqueIssueCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const operatorCfg = operatorConfig[issue.operator]
  const severityCfg = severityConfig[issue.severity || 'warning']
  
  // Check if issue is resolved (not unresolved)
  const isResolved = issue.resolution && issue.resolution !== 'unresolved'
  
  // Format confidence as percentage
  const confidencePercent = Math.round(issue.confidence * 100)

  return (
    <div className={clsx(
      'border-b border-theme-subtle last:border-b-0',
      isResolved && 'opacity-50'
    )}>
      {/* Header */}
      <div
        className="px-3 py-3 hover:bg-theme-hover cursor-pointer transition-all duration-200 group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          {/* Expand/collapse icon */}
          <button className="mt-0.5 text-theme-muted hover:text-theme-secondary shrink-0">
            {isExpanded ? (
              <ChevronDownRegular className="w-4 h-4" />
            ) : (
              <ChevronRightRegular className="w-4 h-4" />
            )}
          </button>
          
          {/* Severity badge */}
          <span className={clsx(
            'shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-ui font-semibold uppercase tracking-wide flex items-center gap-1',
            severityCfg.bgColor,
            severityCfg.color,
            'border',
            severityCfg.borderColor
          )}>
            {severityCfg.icon}
            {severityCfg.label}
          </span>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Question - primary content */}
            <p className={clsx(
              'text-sm font-medium leading-relaxed mb-1.5',
              isResolved ? 'text-theme-secondary line-through' : 'text-theme-primary'
            )}>
              {issue.question}
            </p>

            {/* Consequence - the cost of not fixing */}
            {issue.consequence && !isResolved && (
              <p className={clsx(
                'text-xs leading-relaxed mb-1.5 italic',
                issue.severity === 'blocking' ? 'text-red-400/80' : 'text-theme-accent opacity-70'
              )}>
                {issue.consequence}
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-2 text-[10px] font-ui flex-wrap">
              <span className={clsx('uppercase tracking-wide', operatorCfg.color)}>
                {operatorCfg.label}
              </span>
              <span className="text-theme-muted">·</span>
              <span className="text-theme-muted">
                {confidencePercent}%
              </span>
              {issue.deadline && !isResolved && (
                <>
                  <span className="text-theme-muted">·</span>
                  <span className="text-theme-accent opacity-70 flex items-center gap-1">
                    <ClockRegular className="w-3 h-3" />
                    {issue.deadline}
                  </span>
                </>
              )}
              {isResolved && (
                <>
                  <span className="text-theme-muted">·</span>
                  <span className="text-green-400/70 flex items-center gap-1">
                    <CheckmarkCircleRegular className="w-3 h-3" />
                    {issue.resolution === 'fixed' ? 'Resolved' :
                     issue.resolution === 'intentional' ? 'Paid' : 'Debt Accepted'}
                  </span>
                </>
              )}
            </div>
          </div>
          
          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
            className="p-1.5 text-theme-muted hover:text-theme-secondary hover:bg-theme-hover rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 shrink-0"
            title="Dismiss"
          >
            <DismissRegular className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pl-10 space-y-3">
          {/* Context */}
          {issue.context && (
            <div className="text-xs text-theme-secondary leading-relaxed">
              {issue.context}
            </div>
          )}

          {/* Resolution note if exists */}
          {issue.resolutionNote && (
            <div className="text-xs text-green-400/60 leading-relaxed bg-green-400/5 rounded px-2 py-1.5 border border-green-400/20">
              Note: {issue.resolutionNote}
            </div>
          )}

          {/* Evidence - showing source documents and quotes */}
          {issue.evidence.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-ui uppercase tracking-wide text-theme-muted mb-1">
                Evidence
              </div>

              {/* Evidence citations */}
              <div className="space-y-2">
                {issue.evidence.slice(0, 3).map((ev, idx) => (
                  <div key={idx} className="bg-theme-hover border border-theme-subtle rounded-lg p-2.5">
                    {/* Source document and scene ref */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-ui font-medium text-theme-accent bg-[var(--accent-gold-muted)] px-1.5 py-0.5 rounded">
                        {(ev as { sourceDocument?: string }).sourceDocument || 'Script'}
                      </span>
                      <span className="text-[10px] font-ui text-theme-muted truncate">
                        {ev.sceneRef}
                      </span>
                    </div>

                    {/* Quote */}
                    <p className="text-xs text-theme-secondary leading-relaxed border-l-2 border-[var(--accent-gold-border)] pl-2 italic">
                      "{ev.excerpt}"
                    </p>
                  </div>
                ))}
                {issue.evidence.length > 3 && (
                  <p className="text-[11px] text-theme-muted italic pl-1">
                    +{issue.evidence.length - 3} more citation{issue.evidence.length > 4 ? 's' : ''}
                  </p>
                )}
              </div>
              
              {/* Source button - navigate to first evidence with valid blockId */}
              {(() => {
                const navigableEvidence = issue.evidence.find(ev => ev.documentId)
                return navigableEvidence && onNavigate ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigate(navigableEvidence.documentId, navigableEvidence.blockId || '')
                    }}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-ui font-medium text-theme-accent bg-[var(--accent-gold-muted)] hover:bg-[var(--accent-gold-border)] rounded-md transition-colors w-full justify-center"
                  >
                    <LocationRegular className="w-3.5 h-3.5" />
                    View in Script
                  </button>
                ) : null
              })()}
            </div>
          )}
          
          {/* Resolution actions - only show if not resolved and handler provided */}
          {!isResolved && onResolve && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-ui text-theme-muted uppercase tracking-wide">Action:</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onResolve('fixed')
                }}
                className="px-2 py-1 text-[10px] font-ui font-medium text-green-400 bg-green-400/10 hover:bg-green-400/20 rounded transition-colors"
                title="Issue has been resolved in the script"
              >
                Resolved
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onResolve('intentional')
                }}
                className="px-2 py-1 text-[10px] font-ui font-medium text-theme-accent bg-[var(--accent-gold-muted)] hover:bg-[var(--accent-gold-border)] rounded transition-colors"
                title="Deliberate choice - pay this sin"
              >
                Pay Sin
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onResolve('deferred')
                }}
                className="px-2 py-1 text-[10px] font-ui font-medium text-theme-muted bg-theme-hover hover:bg-theme-active rounded transition-colors"
                title="Accept this debt for now"
              >
                Accept Debt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// SCENE STATE DISPLAY
// =============================================================================

const phaseColors: Record<string, string> = {
  setup: 'text-theme-muted',
  escalation: 'text-theme-accent',
  climax: 'text-red-400',
  release: 'text-theme-secondary',
  transition: 'text-theme-muted'
}

const phaseBgColors: Record<string, string> = {
  setup: 'bg-theme-hover border-theme-default',
  escalation: 'bg-[var(--accent-gold-muted)] border-[var(--accent-gold-border)]',
  climax: 'bg-red-400/10 border-red-400/20',
  release: 'bg-theme-hover border-theme-default',
  transition: 'bg-theme-hover border-theme-default'
}

const focusLabels: Record<string, string> = {
  'world-building': 'World Building',
  'supporting-cast': 'Supporting Cast',
  'lead-driven': 'Lead Driven',
  'theme': 'Theme',
  'conflict': 'Conflict'
}

const eligibilityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  eligible: { label: 'Eligible', color: 'text-green-400', bgColor: 'bg-green-400/10' },
  'present-passive': { label: 'Passive', color: 'text-theme-accent', bgColor: 'bg-[var(--accent-gold-muted)]' },
  'available-delayed': { label: 'Delayed', color: 'text-theme-secondary', bgColor: 'bg-theme-hover' },
  excluded: { label: 'Excluded', color: 'text-red-400', bgColor: 'bg-red-400/10' }
}

interface SceneStateDisplayProps {
  sceneState: SceneState
}

function SceneStateDisplay({ sceneState }: SceneStateDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="border-b border-theme-subtle">
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-theme-hover transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-ui font-medium uppercase tracking-wider text-theme-muted">
            Scene State
          </span>
          <span className={clsx(
            'text-[10px] font-ui font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border',
            phaseBgColors[sceneState.phase] || 'bg-theme-hover border-theme-default',
            phaseColors[sceneState.phase] || 'text-theme-muted'
          )}>
            {sceneState.phase}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-ui text-theme-muted">
            Act {sceneState.act}
          </span>
          <span className="text-[10px] font-ui text-theme-muted">
            {focusLabels[sceneState.focus] || sceneState.focus}
          </span>
          <button className="text-theme-muted hover:text-theme-secondary">
            {isExpanded ? (
              <ChevronDownRegular className="w-3.5 h-3.5" />
            ) : (
              <ChevronRightRegular className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-2 space-y-2">
          {/* Reasoning */}
          <p className="text-[11px] text-theme-muted leading-relaxed">
            {sceneState.reasoning}
          </p>

          {/* Exclusions */}
          {sceneState.exclusions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-ui uppercase tracking-wide text-red-400/60 flex items-center gap-1">
                <ProhibitedRegular className="w-3 h-3" />
                Exclusions
              </div>
              {sceneState.exclusions.map((exc, idx) => (
                <div key={idx} className="text-[11px] text-red-400/80 bg-red-400/5 rounded px-2 py-1 border border-red-400/10">
                  <span className="font-medium uppercase text-[10px]">{exc.type}</span>
                  {exc.target && <span className="text-red-400/60"> — {exc.target}</span>}
                  <p className="text-theme-muted mt-0.5">{exc.reason}</p>
                </div>
              ))}
            </div>
          )}

          {/* Allowed contributions */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-ui text-theme-muted uppercase tracking-wide mr-1">Allowed:</span>
            {sceneState.allowedContributions.map(c => (
              <span
                key={c}
                className="text-[9px] font-ui px-1.5 py-0.5 rounded bg-theme-hover text-theme-muted border border-theme-subtle"
              >
                {c}
              </span>
            ))}
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-ui text-theme-muted">Confidence:</span>
            <div className="flex-1 h-1 bg-theme-hover rounded-full overflow-hidden max-w-[100px]">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  sceneState.confidence > 0.7 ? 'bg-green-400/60' :
                  sceneState.confidence > 0.5 ? 'bg-[var(--accent-gold)]/60' :
                  'bg-red-400/60'
                )}
                style={{ width: `${sceneState.confidence * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-theme-muted">
              {Math.round(sceneState.confidence * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// CHARACTER ELIGIBILITY DISPLAY
// =============================================================================

interface CharacterEligibilityDisplayProps {
  eligibility: CharacterEligibility[]
}

function CharacterEligibilityDisplay({ eligibility }: CharacterEligibilityDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (eligibility.length === 0) return null

  const counts = {
    eligible: eligibility.filter(e => e.status === 'eligible').length,
    passive: eligibility.filter(e => e.status === 'present-passive').length,
    delayed: eligibility.filter(e => e.status === 'available-delayed').length,
    excluded: eligibility.filter(e => e.status === 'excluded').length
  }

  return (
    <div className="border-b border-theme-subtle">
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-theme-hover transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-ui font-medium uppercase tracking-wider text-theme-muted">
            Character Eligibility
          </span>
        </div>
        <div className="flex items-center gap-2">
          {counts.eligible > 0 && (
            <span className="text-[10px] font-mono text-green-400">{counts.eligible}</span>
          )}
          {counts.passive > 0 && (
            <span className="text-[10px] font-mono text-theme-accent">{counts.passive}</span>
          )}
          {counts.delayed > 0 && (
            <span className="text-[10px] font-mono text-theme-secondary">{counts.delayed}</span>
          )}
          {counts.excluded > 0 && (
            <span className="text-[10px] font-mono text-red-400">{counts.excluded}</span>
          )}
          <button className="text-theme-muted hover:text-theme-secondary">
            {isExpanded ? (
              <ChevronDownRegular className="w-3.5 h-3.5" />
            ) : (
              <ChevronRightRegular className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-2 space-y-1">
          {eligibility.map(char => {
            const config = eligibilityConfig[char.status]
            return (
              <div
                key={char.characterId}
                className={clsx(
                  'flex items-center justify-between px-2 py-1.5 rounded text-[11px]',
                  config.bgColor,
                  'border border-theme-subtle'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PersonRegular className={clsx('w-3.5 h-3.5 shrink-0', config.color)} />
                  <span className="text-theme-primary font-medium truncate">
                    {char.name}
                    {char.isLead && (
                      <span className="text-theme-accent opacity-60 ml-1 text-[9px]">LEAD</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={clsx('text-[9px] font-ui font-semibold uppercase tracking-wide', config.color)}>
                    {config.label}
                  </span>
                </div>
              </div>
            )
          })}
          {/* Legend */}
          <div className="flex items-center gap-3 pt-1 text-[9px] font-ui text-theme-muted">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400/60" /> can act</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)]/60" /> present, reactive only</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-theme-active" /> not yet</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400/60" /> forbidden</span>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// PIPELINE DECLINE DISPLAY
// =============================================================================

interface PipelineDeclineDisplayProps {
  result: PipelineResult
  onOverride?: () => void
}

function PipelineDeclineDisplay({ result, onOverride }: PipelineDeclineDisplayProps) {
  if (result.gatePassed || result.stage !== 'declined') return null

  return (
    <div className="border-b border-theme-subtle bg-[var(--accent-gold-glow)]">
      <div className="px-3 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldRegular className="w-4 h-4 text-theme-accent opacity-80" />
          <span className="text-xs font-ui font-medium text-theme-accent opacity-90">
            Generation Declined
          </span>
        </div>
        <p className="text-[11px] text-theme-secondary leading-relaxed">
          {result.gateReason}
        </p>
        {result.suggestion && (
          <p className="text-[11px] text-theme-accent opacity-70 leading-relaxed">
            {result.suggestion}
          </p>
        )}
        {onOverride && (
          <button
            onClick={onOverride}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-ui font-medium text-theme-accent opacity-80 bg-[var(--accent-gold-muted)] hover:bg-[var(--accent-gold-border)] rounded-md transition-colors border border-[var(--accent-gold-border)]"
          >
            <PlayRegular className="w-3 h-3" />
            Override — Generate Anyway
          </button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// MAIN PANEL
// =============================================================================

type FilterSeverity = IssueSeverity | 'all'

export function WritingPartnerPanel() {
  const {
    currentProject,
    critiqueIssues,
    sceneState,
    characterEligibility,
    lastPipelineResult,
    ui,
    runCritique,
    dismissCritiqueIssue,
    toggleWritingPartnerPanel,
    navigateToCitation,
    resolveIssue,
    setLastPipelineResult
  } = useProjectStore()

  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all')
  const [hideResolved, setHideResolved] = useState(false)

  // Count by severity (excluding resolved if hideResolved)
  const severityCounts = useMemo(() => {
    const counts: Record<IssueSeverity, number> = { blocking: 0, warning: 0, optional: 0 }
    for (const issue of critiqueIssues) {
      if (hideResolved && issue.resolution !== 'unresolved') continue
      const severity = issue.severity || 'warning'
      counts[severity]++
    }
    return counts
  }, [critiqueIssues, hideResolved])

  // Count resolved issues
  const resolvedCount = useMemo(() => {
    return critiqueIssues.filter(i => i.resolution && i.resolution !== 'unresolved').length
  }, [critiqueIssues])

  // Filter and sort issues
  const filteredIssues = useMemo(() => {
    let issues = critiqueIssues

    // Filter by resolution status
    if (hideResolved) {
      issues = issues.filter(i => !i.resolution || i.resolution === 'unresolved')
    }

    // Filter by severity
    if (filterSeverity !== 'all') {
      issues = issues.filter(i => (i.severity || 'warning') === filterSeverity)
    }

    // Sort by severity (blocking first, then warning, then optional)
    // Within same severity, unresolved come before resolved
    return [...issues].sort((a, b) => {
      const aSeverity = severityConfig[a.severity || 'warning'].sortOrder
      const bSeverity = severityConfig[b.severity || 'warning'].sortOrder
      if (aSeverity !== bSeverity) return aSeverity - bSeverity
      
      // Then by resolution status (unresolved first)
      const aResolved = a.resolution && a.resolution !== 'unresolved' ? 1 : 0
      const bResolved = b.resolution && b.resolution !== 'unresolved' ? 1 : 0
      return aResolved - bResolved
    })
  }, [critiqueIssues, filterSeverity, hideResolved])

  // Total active (unresolved) issues
  const activeCount = critiqueIssues.length - resolvedCount

  const handleNavigate = async (documentId: string, blockId: string) => {
    if (documentId && blockId) {
      await navigateToCitation(documentId, blockId)
    }
  }

  const handleResolve = (issueId: string, resolution: 'fixed' | 'intentional' | 'deferred') => {
    resolveIssue(issueId, resolution)
  }

  if (!currentProject) return null
  if (currentProject.templateId !== 'screenplay') return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-theme-subtle bg-theme-header">
        <div className="flex items-center gap-2">
          <SparkleFilled className="w-4 h-4 text-theme-accent opacity-80" />
          <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-theme-muted">
            Writing Partner
          </h2>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Run Analysis button */}
          <button
            onClick={() => runCritique()}
            disabled={ui.isRunningCritique}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-ui font-medium rounded-lg transition-all duration-200',
              ui.isRunningCritique
                ? 'bg-gold-400/10 text-gold-400/50 cursor-not-allowed'
                : 'bg-gold-400/10 text-gold-400/90 hover:bg-gold-400/20 hover:text-gold-400'
            )}
            title="Analyze screenplay for structural issues"
          >
            <ArrowSyncRegular className={clsx('w-4 h-4', ui.isRunningCritique && 'animate-spin')} />
            {ui.isRunningCritique ? 'Analyzing...' : 'Analyze'}
          </button>
          
          {/* Close button */}
          <button
            onClick={toggleWritingPartnerPanel}
            className="btn-icon-modern p-1.5 ml-1"
            title="Close Writing Partner"
          >
            <DismissRegular className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scene State Classification */}
      {sceneState && !ui.isRunningCritique && (
        <SceneStateDisplay sceneState={sceneState} />
      )}

      {/* Character Eligibility */}
      {characterEligibility.length > 0 && !ui.isRunningCritique && (
        <CharacterEligibilityDisplay eligibility={characterEligibility} />
      )}

      {/* Pipeline Decline Notice */}
      {lastPipelineResult && lastPipelineResult.stage === 'declined' && !ui.isRunningCritique && (
        <PipelineDeclineDisplay
          result={lastPipelineResult}
          onOverride={() => setLastPipelineResult(null)}
        />
      )}

      {/* Sin Scoreboard - CinemaSins-style debt counter */}
      {!ui.isRunningCritique && <SinScoreboard issues={critiqueIssues} />}

      {/* Filter bar - severity tabs */}
      {critiqueIssues.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-theme-subtle">
          {/* Severity filter tabs */}
          <button
            onClick={() => setFilterSeverity('all')}
            className={clsx(
              'tab-modern',
              filterSeverity === 'all' && 'active'
            )}
          >
            All ({activeCount})
          </button>
          
          {severityCounts.blocking > 0 && (
            <button
              onClick={() => setFilterSeverity('blocking')}
              className={clsx(
                'tab-modern flex items-center gap-1',
                filterSeverity === 'blocking' && 'active bg-red-400/10 text-red-400'
              )}
            >
              <ErrorCircleRegular className="w-3 h-3" />
              {severityCounts.blocking}
            </button>
          )}
          
          {severityCounts.warning > 0 && (
            <button
              onClick={() => setFilterSeverity('warning')}
              className={clsx(
                'tab-modern flex items-center gap-1',
                filterSeverity === 'warning' && 'active bg-[var(--accent-gold-muted)] text-theme-accent'
              )}
            >
              <WarningRegular className="w-3 h-3" />
              {severityCounts.warning}
            </button>
          )}
          
          {severityCounts.optional > 0 && (
            <button
              onClick={() => setFilterSeverity('optional')}
              className={clsx(
                'tab-modern flex items-center gap-1',
                filterSeverity === 'optional' && 'active'
              )}
            >
              <InfoRegular className="w-3 h-3" />
              {severityCounts.optional}
            </button>
          )}
          
          {/* Toggle resolved visibility */}
          {resolvedCount > 0 && (
            <button
              onClick={() => setHideResolved(!hideResolved)}
              className={clsx(
                'tab-modern ml-auto flex items-center gap-1',
                hideResolved && 'active'
              )}
              title={hideResolved ? 'Show resolved issues' : 'Hide resolved issues'}
            >
              <CheckmarkCircleRegular className="w-3 h-3" />
              {resolvedCount}
            </button>
          )}
        </div>
      )}

      {/* Issues list */}
      <div className="flex-1 overflow-auto">
        {ui.isRunningCritique ? (
          // Loading state
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-gold-muted)] flex items-center justify-center mb-4">
              <ArrowSyncRegular className="w-6 h-6 text-theme-accent opacity-60 animate-spin" />
            </div>
            <p className="text-sm text-theme-muted font-ui mb-1">Analyzing your screenplay...</p>
            <p className="text-xs text-theme-muted font-ui">
              This may take a moment
            </p>
          </div>
        ) : filteredIssues.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {critiqueIssues.length === 0 ? (
              <>
                <div className="w-12 h-12 rounded-full bg-theme-hover flex items-center justify-center mb-4">
                  <TextBulletListSquareRegular className="w-6 h-6 text-theme-muted" />
                </div>
                <p className="text-sm text-theme-muted font-ui mb-1">No issues detected</p>
                <p className="text-xs text-theme-muted font-ui max-w-[200px]">
                  Click "Analyze" to check for contradictions, pacing issues, and more
                </p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-theme-hover flex items-center justify-center mb-3">
                  <FilterRegular className="w-5 h-5 text-theme-muted" />
                </div>
                <p className="text-sm text-theme-muted font-ui">
                  No matching issues
                </p>
              </>
            )}
          </div>
        ) : (
          // Issues list
          filteredIssues.map(issue => (
            <CritiqueIssueCard
              key={issue.id}
              issue={issue}
              onDismiss={() => dismissCritiqueIssue(issue.id)}
              onNavigate={handleNavigate}
              onResolve={(resolution) => handleResolve(issue.id, resolution)}
            />
          ))
        )}
      </div>

      {/* Footer - accountability summary */}
      {critiqueIssues.length > 0 && !ui.isRunningCritique && (
        <div className="px-3 py-2 border-t border-theme-subtle text-xs font-ui">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Severity counts */}
            {severityCounts.blocking > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <ErrorCircleRegular className="w-3.5 h-3.5" />
                <span className="font-medium">{severityCounts.blocking}</span>
                <span className="text-red-400/60">blocking</span>
              </span>
            )}
            {severityCounts.warning > 0 && (
              <span className="flex items-center gap-1 text-theme-accent">
                <WarningRegular className="w-3.5 h-3.5" />
                <span className="font-medium">{severityCounts.warning}</span>
                <span className="text-theme-accent opacity-60">warnings</span>
              </span>
            )}
            {severityCounts.optional > 0 && (
              <span className="flex items-center gap-1 text-theme-muted">
                <InfoRegular className="w-3.5 h-3.5" />
                <span className="font-medium">{severityCounts.optional}</span>
                <span className="text-theme-muted">optional</span>
              </span>
            )}

            {/* Resolved count */}
            {resolvedCount > 0 && (
              <span className="flex items-center gap-1 text-green-400/70 ml-auto">
                <CheckmarkCircleRegular className="w-3.5 h-3.5" />
                <span className="font-medium">{resolvedCount}</span>
                <span className="text-green-400/50">resolved</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
