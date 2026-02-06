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
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-400/30',
    sortOrder: 1
  },
  optional: {
    icon: <InfoRegular className="w-3.5 h-3.5" />,
    label: 'OPTIONAL',
    color: 'text-white/40',
    bgColor: 'bg-white/5',
    borderColor: 'border-white/10',
    sortOrder: 2
  }
}

// CinemaSins operator display config - 30 narrative sins
const operatorConfig: Record<CritiqueOperator, { icon: React.ReactNode; label: string; color: string }> = {
  // Character/Motivation (1-4)
  unclear_motivation: {
    icon: <QuestionCircleRegular className="w-4 h-4" />,
    label: 'Unclear Motivation',
    color: 'text-amber-400'
  },
  motivation_shift: {
    icon: <ArrowShuffleRegular className="w-4 h-4" />,
    label: 'Motivation Shift',
    color: 'text-amber-400'
  },
  behavior_contradiction: {
    icon: <WarningRegular className="w-4 h-4" />,
    label: 'Behavior Contradiction',
    color: 'text-red-400'
  },
  protagonist_passivity: {
    icon: <PersonRegular className="w-4 h-4" />,
    label: 'Protagonist Passivity',
    color: 'text-orange-400'
  },
  // Convenience/Coincidence (5-6)
  coincidence_plotting: {
    icon: <ThumbDislikeRegular className="w-4 h-4" />,
    label: 'Coincidence Plotting',
    color: 'text-rose-400'
  },
  convenient_information: {
    icon: <FlashRegular className="w-4 h-4" />,
    label: 'Convenient Information',
    color: 'text-rose-400'
  },
  // Exposition/Dialogue (7-8, 21-22)
  exposition_dump: {
    icon: <MegaphoneRegular className="w-4 h-4" />,
    label: 'Exposition Dump',
    color: 'text-yellow-400'
  },
  audience_dialogue: {
    icon: <ChatRegular className="w-4 h-4" />,
    label: 'Audience Dialogue',
    color: 'text-yellow-400'
  },
  theme_stated: {
    icon: <BookRegular className="w-4 h-4" />,
    label: 'Theme Stated',
    color: 'text-yellow-400'
  },
  plot_dialogue: {
    icon: <TextBulletListSquareRegular className="w-4 h-4" />,
    label: 'Plot Dialogue',
    color: 'text-yellow-400'
  },
  // Rules/Logic (9-10, 25-26)
  late_rules: {
    icon: <SettingsRegular className="w-4 h-4" />,
    label: 'Late Rules',
    color: 'text-purple-400'
  },
  rules_broken: {
    icon: <ShieldErrorRegular className="w-4 h-4" />,
    label: 'Rules Broken',
    color: 'text-purple-400'
  },
  impossible_knowledge: {
    icon: <BrainCircuitRegular className="w-4 h-4" />,
    label: 'Impossible Knowledge',
    color: 'text-purple-400'
  },
  undefined_tech: {
    icon: <FlashRegular className="w-4 h-4" />,
    label: 'Undefined Tech',
    color: 'text-purple-400'
  },
  // Setup/Payoff (11-13)
  setup_no_payoff: {
    icon: <TargetArrowRegular className="w-4 h-4" />,
    label: 'Setup No Payoff',
    color: 'text-blue-400'
  },
  payoff_no_setup: {
    icon: <GiftRegular className="w-4 h-4" />,
    label: 'Payoff No Setup',
    color: 'text-blue-400'
  },
  forgotten_prop: {
    icon: <BoxRegular className="w-4 h-4" />,
    label: 'Forgotten Prop',
    color: 'text-blue-400'
  },
  // Continuity/Timeline (14-16)
  location_logic: {
    icon: <MapRegular className="w-4 h-4" />,
    label: 'Location Logic',
    color: 'text-indigo-400'
  },
  timeline_issue: {
    icon: <ClockRegular className="w-4 h-4" />,
    label: 'Timeline Issue',
    color: 'text-indigo-400'
  },
  spatial_error: {
    icon: <CompassNorthwestRegular className="w-4 h-4" />,
    label: 'Spatial Error',
    color: 'text-indigo-400'
  },
  // Stakes/Conflict (17-20, 23-24)
  offscreen_resolution: {
    icon: <EyeOffRegular className="w-4 h-4" />,
    label: 'Offscreen Resolution',
    color: 'text-pink-400'
  },
  stakes_asserted: {
    icon: <ScalesRegular className="w-4 h-4" />,
    label: 'Stakes Asserted',
    color: 'text-pink-400'
  },
  unearned_emotion: {
    icon: <HeartBrokenRegular className="w-4 h-4" />,
    label: 'Unearned Emotion',
    color: 'text-pink-400'
  },
  tonal_whiplash: {
    icon: <WeatherThunderstormRegular className="w-4 h-4" />,
    label: 'Tonal Whiplash',
    color: 'text-pink-400'
  },
  fake_conflict: {
    icon: <LinkRegular className="w-4 h-4" />,
    label: 'Fake Conflict',
    color: 'text-pink-400'
  },
  antagonist_fluctuation: {
    icon: <PeopleRegular className="w-4 h-4" />,
    label: 'Antagonist Fluctuation',
    color: 'text-pink-400'
  },
  // Structure/Ending (27-29)
  montage_causality: {
    icon: <VideoRegular className="w-4 h-4" />,
    label: 'Montage Causality',
    color: 'text-teal-400'
  },
  conflict_avoided: {
    icon: <ArrowTurnRightRegular className="w-4 h-4" />,
    label: 'Conflict Avoided',
    color: 'text-teal-400'
  },
  consequence_dodged: {
    icon: <ShieldErrorRegular className="w-4 h-4" />,
    label: 'Consequence Dodged',
    color: 'text-teal-400'
  },
  // Meta (30)
  repetition_sin: {
    icon: <NumberSymbolRegular className="w-4 h-4" />,
    label: 'Repetition Sin',
    color: 'text-cyan-400'
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
    color: 'text-amber-400'
  },
  convenience: {
    label: 'Convenience Sins',
    operators: ['coincidence_plotting', 'convenient_information', 'impossible_knowledge', 'undefined_tech'],
    icon: <FlashRegular className="w-3.5 h-3.5" />,
    color: 'text-rose-400'
  },
  exposition: {
    label: 'Telling Not Showing',
    operators: ['exposition_dump', 'audience_dialogue', 'theme_stated', 'plot_dialogue'],
    icon: <MegaphoneRegular className="w-3.5 h-3.5" />,
    color: 'text-yellow-400'
  },
  logic: {
    label: 'Logic/Rules Debt',
    operators: ['late_rules', 'rules_broken', 'location_logic', 'spatial_error'],
    icon: <SettingsRegular className="w-3.5 h-3.5" />,
    color: 'text-purple-400'
  },
  setup: {
    label: 'Promise Debt',
    operators: ['setup_no_payoff', 'payoff_no_setup', 'forgotten_prop'],
    icon: <TargetArrowRegular className="w-3.5 h-3.5" />,
    color: 'text-blue-400'
  },
  stakes: {
    label: 'Stakes/Conflict Debt',
    operators: ['offscreen_resolution', 'stakes_asserted', 'unearned_emotion', 'tonal_whiplash', 'fake_conflict', 'antagonist_fluctuation'],
    icon: <ScalesRegular className="w-3.5 h-3.5" />,
    color: 'text-pink-400'
  },
  structure: {
    label: 'Structure Sins',
    operators: ['timeline_issue', 'montage_causality', 'conflict_avoided', 'consequence_dodged'],
    icon: <ClockRegular className="w-3.5 h-3.5" />,
    color: 'text-teal-400'
  },
  meta: {
    label: 'Pattern Sins',
    operators: ['repetition_sin'],
    icon: <NumberSymbolRegular className="w-3.5 h-3.5" />,
    color: 'text-cyan-400'
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
    <div className="border-b border-white/[0.06] bg-black/20">
      {/* Header with total counter */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-ui font-medium uppercase tracking-wider text-white/30">
            Narrative Sins
          </span>
          <span className="text-[9px] font-ui text-white/20 italic">
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
            unpaidSins > 5 ? 'bg-amber-500/20 text-amber-400' :
            'bg-white/10 text-white/60'
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
              <span className="w-24 text-white/40 font-ui truncate text-[10px]">
                {config.label}
              </span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={clsx(
                    'h-full rounded-full transition-all duration-500',
                    debt.unpaid > 5 ? 'bg-red-400/60' :
                    debt.unpaid > 2 ? 'bg-amber-400/60' :
                    'bg-white/30'
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className={clsx(
                'w-6 text-right font-mono text-[10px]',
                debt.unpaid > 0 ? config.color : 'text-white/20'
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
        <div className="px-3 py-1.5 bg-black/30 border-t border-white/[0.04]">
          <div className="flex items-center justify-between text-[10px] font-ui">
            <span className="text-white/30 uppercase tracking-wide">
              Unresolved narrative debt
            </span>
            <span className={clsx(
              'font-mono font-bold',
              unpaidSins > 10 ? 'text-red-400' :
              unpaidSins > 5 ? 'text-amber-400' :
              'text-white/50'
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
      'border-b border-white/[0.03] last:border-b-0',
      isResolved && 'opacity-50'
    )}>
      {/* Header */}
      <div 
        className="px-3 py-3 hover:bg-white/[0.02] cursor-pointer transition-all duration-200 group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          {/* Expand/collapse icon */}
          <button className="mt-0.5 text-white/30 hover:text-white/60 shrink-0">
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
              isResolved ? 'text-white/50 line-through' : 'text-white/90'
            )}>
              {issue.question}
            </p>
            
            {/* Consequence - the cost of not fixing */}
            {issue.consequence && !isResolved && (
              <p className={clsx(
                'text-xs leading-relaxed mb-1.5 italic',
                issue.severity === 'blocking' ? 'text-red-400/80' : 'text-amber-400/70'
              )}>
                {issue.consequence}
              </p>
            )}
            
            {/* Meta row */}
            <div className="flex items-center gap-2 text-[10px] font-ui flex-wrap">
              <span className={clsx('uppercase tracking-wide', operatorCfg.color)}>
                {operatorCfg.label}
              </span>
              <span className="text-white/20">•</span>
              <span className="text-white/40">
                {confidencePercent}%
              </span>
              {issue.deadline && !isResolved && (
                <>
                  <span className="text-white/20">•</span>
                  <span className="text-amber-400/70 flex items-center gap-1">
                    <ClockRegular className="w-3 h-3" />
                    {issue.deadline}
                  </span>
                </>
              )}
              {isResolved && (
                <>
                  <span className="text-white/20">•</span>
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
            className="p-1.5 text-white/30 hover:text-white/60 hover:bg-white/[0.04] rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 shrink-0"
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
            <div className="text-xs text-white/50 leading-relaxed">
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
              <div className="text-[10px] font-ui uppercase tracking-wide text-white/30 mb-1">
                Evidence
              </div>
              
              {/* Evidence citations */}
              <div className="space-y-2">
                {issue.evidence.slice(0, 3).map((ev, idx) => (
                  <div key={idx} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2.5">
                    {/* Source document and scene ref */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-ui font-medium text-gold-400/80 bg-gold-400/10 px-1.5 py-0.5 rounded">
                        {(ev as { sourceDocument?: string }).sourceDocument || 'Script'}
                      </span>
                      <span className="text-[10px] font-ui text-white/40 truncate">
                        {ev.sceneRef}
                      </span>
                    </div>
                    
                    {/* Quote */}
                    <p className="text-xs text-white/60 leading-relaxed border-l-2 border-gold-400/30 pl-2 italic">
                      "{ev.excerpt}"
                    </p>
                  </div>
                ))}
                {issue.evidence.length > 3 && (
                  <p className="text-[11px] text-white/30 italic pl-1">
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
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-ui font-medium text-gold-400 bg-gold-400/10 hover:bg-gold-400/20 rounded-md transition-colors w-full justify-center"
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
              <span className="text-[10px] font-ui text-white/30 uppercase tracking-wide">Action:</span>
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
                className="px-2 py-1 text-[10px] font-ui font-medium text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 rounded transition-colors"
                title="Deliberate choice - pay this sin"
              >
                Pay Sin
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onResolve('deferred')
                }}
                className="px-2 py-1 text-[10px] font-ui font-medium text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 rounded transition-colors"
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
  setup: 'text-blue-400',
  escalation: 'text-amber-400',
  climax: 'text-red-400',
  release: 'text-green-400',
  transition: 'text-white/40'
}

const phaseBgColors: Record<string, string> = {
  setup: 'bg-blue-400/10 border-blue-400/20',
  escalation: 'bg-amber-400/10 border-amber-400/20',
  climax: 'bg-red-400/10 border-red-400/20',
  release: 'bg-green-400/10 border-green-400/20',
  transition: 'bg-white/5 border-white/10'
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
  'present-passive': { label: 'Passive', color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  'available-delayed': { label: 'Delayed', color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  excluded: { label: 'Excluded', color: 'text-red-400', bgColor: 'bg-red-400/10' }
}

interface SceneStateDisplayProps {
  sceneState: SceneState
}

function SceneStateDisplay({ sceneState }: SceneStateDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="border-b border-white/[0.06] bg-black/20">
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-ui font-medium uppercase tracking-wider text-white/30">
            Scene State
          </span>
          <span className={clsx(
            'text-[10px] font-ui font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border',
            phaseBgColors[sceneState.phase] || 'bg-white/5 border-white/10',
            phaseColors[sceneState.phase] || 'text-white/40'
          )}>
            {sceneState.phase}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-ui text-white/30">
            Act {sceneState.act}
          </span>
          <span className="text-[10px] font-ui text-white/20">
            {focusLabels[sceneState.focus] || sceneState.focus}
          </span>
          <button className="text-white/30 hover:text-white/60">
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
          <p className="text-[11px] text-white/40 leading-relaxed">
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
                  <p className="text-white/40 mt-0.5">{exc.reason}</p>
                </div>
              ))}
            </div>
          )}

          {/* Allowed contributions */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-ui text-white/30 uppercase tracking-wide mr-1">Allowed:</span>
            {sceneState.allowedContributions.map(c => (
              <span
                key={c}
                className="text-[9px] font-ui px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/[0.06]"
              >
                {c}
              </span>
            ))}
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-ui text-white/30">Confidence:</span>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden max-w-[100px]">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  sceneState.confidence > 0.7 ? 'bg-green-400/60' :
                  sceneState.confidence > 0.5 ? 'bg-amber-400/60' :
                  'bg-red-400/60'
                )}
                style={{ width: `${sceneState.confidence * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-white/40">
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
    <div className="border-b border-white/[0.06] bg-black/10">
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-ui font-medium uppercase tracking-wider text-white/30">
            Character Eligibility
          </span>
        </div>
        <div className="flex items-center gap-2">
          {counts.eligible > 0 && (
            <span className="text-[10px] font-mono text-green-400">{counts.eligible}</span>
          )}
          {counts.passive > 0 && (
            <span className="text-[10px] font-mono text-amber-400">{counts.passive}</span>
          )}
          {counts.delayed > 0 && (
            <span className="text-[10px] font-mono text-blue-400">{counts.delayed}</span>
          )}
          {counts.excluded > 0 && (
            <span className="text-[10px] font-mono text-red-400">{counts.excluded}</span>
          )}
          <button className="text-white/30 hover:text-white/60">
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
                  'border border-white/[0.04]'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PersonRegular className={clsx('w-3.5 h-3.5 shrink-0', config.color)} />
                  <span className="text-white/80 font-medium truncate">
                    {char.name}
                    {char.isLead && (
                      <span className="text-gold-400/60 ml-1 text-[9px]">LEAD</span>
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
          <div className="flex items-center gap-3 pt-1 text-[9px] font-ui text-white/20">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400/60" /> can act</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" /> present, reactive only</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400/60" /> not yet</span>
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
    <div className="border-b border-white/[0.06] bg-amber-400/[0.03]">
      <div className="px-3 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldRegular className="w-4 h-4 text-amber-400/80" />
          <span className="text-xs font-ui font-medium text-amber-400/90">
            Generation Declined
          </span>
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed">
          {result.gateReason}
        </p>
        {result.suggestion && (
          <p className="text-[11px] text-blue-400/70 leading-relaxed">
            {result.suggestion}
          </p>
        )}
        {onOverride && (
          <button
            onClick={onOverride}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-ui font-medium text-amber-400/80 bg-amber-400/10 hover:bg-amber-400/20 rounded-md transition-colors border border-amber-400/20"
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
    <div className="flex flex-col h-full bg-zinc-900/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <SparkleFilled className="w-4 h-4 text-gold-400/80" />
          <h2 className="text-xs font-ui font-medium uppercase tracking-wider text-white/40">
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
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.03]">
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
                filterSeverity === 'blocking' && 'active bg-red-400/15 text-red-400'
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
                filterSeverity === 'warning' && 'active bg-amber-400/15 text-amber-400'
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
            <div className="w-12 h-12 rounded-full bg-gold-400/10 flex items-center justify-center mb-4">
              <ArrowSyncRegular className="w-6 h-6 text-gold-400/60 animate-spin" />
            </div>
            <p className="text-sm text-white/40 font-ui mb-1">Analyzing your screenplay...</p>
            <p className="text-xs text-white/25 font-ui">
              This may take a moment
            </p>
          </div>
        ) : filteredIssues.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {critiqueIssues.length === 0 ? (
              <>
                <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
                  <TextBulletListSquareRegular className="w-6 h-6 text-white/20" />
                </div>
                <p className="text-sm text-white/40 font-ui mb-1">No issues detected</p>
                <p className="text-xs text-white/25 font-ui max-w-[200px]">
                  Click "Analyze" to check for contradictions, pacing issues, and more
                </p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center mb-3">
                  <FilterRegular className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-sm text-white/40 font-ui">
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
        <div className="px-3 py-2 border-t border-white/[0.04] text-xs font-ui">
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
              <span className="flex items-center gap-1 text-amber-400">
                <WarningRegular className="w-3.5 h-3.5" />
                <span className="font-medium">{severityCounts.warning}</span>
                <span className="text-amber-400/60">warnings</span>
              </span>
            )}
            {severityCounts.optional > 0 && (
              <span className="flex items-center gap-1 text-white/40">
                <InfoRegular className="w-3.5 h-3.5" />
                <span className="font-medium">{severityCounts.optional}</span>
                <span className="text-white/30">optional</span>
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
