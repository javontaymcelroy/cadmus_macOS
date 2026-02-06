/**
 * Scene State Types
 * 
 * Shared types for the gated AI writing partner architecture.
 * These types define the scene-state classification, character eligibility,
 * and staged generation pipeline that enforce narrative constraints
 * BEFORE any AI generation happens.
 * 
 * The core principle: exclusions matter more than inclusions.
 * The partner's job is to protect the story from premature cleverness,
 * including its own.
 */

import type { AIWritingResponse } from './aiWritingTypes'

// =============================================================================
// SCENE STATE CLASSIFICATION
// =============================================================================

/**
 * Structural act position in the screenplay.
 * Derived from scene count, page count, and structural markers.
 */
export type ActPosition = 'I' | 'II-A' | 'II-B' | 'III' | 'unknown'

/**
 * Narrative phase within the current act.
 * Determines what kinds of contributions are appropriate.
 */
export type NarrativePhase = 'setup' | 'escalation' | 'climax' | 'release' | 'transition'

/**
 * What the current moment is focused on.
 * Determines which elements should be foregrounded or backgrounded.
 */
export type SceneFocus = 'world-building' | 'supporting-cast' | 'lead-driven' | 'theme' | 'conflict'

/**
 * Types of contributions the AI is allowed to make.
 * These are derived from scene state, not chosen by the model.
 */
export type ContributionType =
  | 'question'      // Ask the writer something instead of generating
  | 'tension'       // Add/maintain tension without advancing plot
  | 'delay'         // Slow the pace, add waiting, breathing room
  | 'texture'       // Environmental/behavioral detail, atmosphere
  | 'dialogue'      // Character exchange (within eligibility constraints)
  | 'action'        // Plot-advancing action (most restricted)
  | 'negativeSpace' // Non-advancing organic moments
  | 'none'          // Decline to generate entirely

/**
 * A hard exclusion that the AI MUST obey.
 * These are system-enforced constraints, not prompt suggestions.
 */
export interface SceneExclusion {
  /** What category of thing is excluded */
  type: 'character' | 'action' | 'revelation' | 'resolution'
  /** Specific target (e.g., character name, plot point) */
  target?: string
  /** Human-readable reason for the exclusion */
  reason: string
}

/**
 * The classified state of the current scene/moment.
 * This is computed BEFORE any generation and becomes the constraint envelope.
 */
export interface SceneState {
  /** Structural position in the story */
  act: ActPosition
  /** Narrative phase within the current beat */
  phase: NarrativePhase
  /** What the current moment is focused on */
  focus: SceneFocus

  /** Hard constraints - these become FORBIDDEN rules */
  exclusions: SceneExclusion[]
  /** What kinds of contributions are allowed right now */
  allowedContributions: ContributionType[]

  /** Confidence in the classification (0-1) */
  confidence: number
  /** Brief explanation of why this classification was chosen */
  reasoning: string

  /** Raw signals used for classification */
  signals: ClassificationSignals
}

/**
 * Raw signals extracted from the script that inform classification.
 * These are observable facts, not interpretations.
 */
export interface ClassificationSignals {
  /** Total scene count in the script so far */
  totalSceneCount: number
  /** How many scenes since the last act break (if act breaks exist) */
  scenesSinceActBreak: number
  /** Number of unique characters introduced so far */
  charactersIntroducedCount: number
  /** Number of unique characters in the current scene */
  charactersInCurrentScene: number
  /** Whether any major conflict has been established */
  conflictEstablished: boolean
  /** Whether we're in the first scene of the script */
  isOpeningScene: boolean
  /** Whether a lead/protagonist character has been identified */
  leadCharacterIdentified: boolean
  /** Whether the lead character has appeared in the current scene */
  leadInCurrentScene: boolean
  /** Number of scenes since the lead character last appeared */
  scenesSinceLeadAppearance: number
  /** Whether there's an active unresolved tension */
  activeTension: boolean
  /** The most recent scene heading */
  currentSceneHeading?: string
}

// =============================================================================
// CHARACTER ELIGIBILITY
// =============================================================================

/**
 * Character eligibility status.
 * NOT a simple available/unavailable boolean - eligibility is nuanced.
 */
export type EligibilityStatus =
  | 'eligible'           // Can appear and drive action
  | 'present-passive'    // In scene but shouldn't drive action
  | 'available-delayed'  // Could enter, but not yet (protect entrance)
  | 'excluded'           // Hard exclusion for this beat

/**
 * Computed eligibility for a single character at the current moment.
 * This is derived at request time from scene state + usage history.
 */
export interface CharacterEligibility {
  /** Character ID from the character bank */
  characterId: string
  /** Character name */
  name: string

  /** Current eligibility status */
  status: EligibilityStatus
  /** Why this status was assigned */
  reason: string

  /** Additional constraints if eligible (e.g., "only reactive", "no dialogue") */
  constraints?: string[]

  /** Whether this character is considered a lead/protagonist */
  isLead: boolean
  /** How many scenes this character has appeared in */
  sceneAppearanceCount: number
  /** How many scenes ago this character last appeared */
  scenesSinceLastAppearance: number
}

/**
 * Character usage history for eligibility derivation.
 * Tracked per character across the script.
 */
export interface CharacterUsageHistory {
  characterId: string
  name: string
  /** Scene numbers where this character appears */
  appearsInScenes: number[]
  /** Whether this character has been identified as lead/protagonist */
  isLead: boolean
  /** Total dialogue line count */
  dialogueLineCount: number
  /** Whether this character has had a formal introduction (all-caps in action) */
  hasBeenIntroduced: boolean
  /** Scene number of first appearance */
  firstAppearanceScene: number
}

// =============================================================================
// STAGED GENERATION PIPELINE
// =============================================================================

/**
 * Which stage the pipeline reached before returning.
 */
export type PipelineStage =
  | 'classified'   // Scene state was classified
  | 'constrained'  // Constraints were derived
  | 'gated'        // Gate was evaluated
  | 'generated'    // Generation completed
  | 'declined'     // Pipeline declined to generate

/**
 * Result from the gated writing pipeline.
 * Contains the full chain of reasoning, even if generation was declined.
 */
export interface PipelineResult {
  /** Which stage the pipeline reached */
  stage: PipelineStage
  /** The classified scene state */
  sceneState?: SceneState
  /** Computed character eligibility */
  eligibility?: CharacterEligibility[]
  /** Whether generation was allowed */
  gatePassed: boolean
  /** If declined, why */
  gateReason?: string
  /** The generated content (only if gatePassed) */
  generation?: AIWritingResponse
  /** Alternative suggestion when declining (e.g., "try negativeSpace instead") */
  suggestion?: string
}

/**
 * Gate evaluation result.
 * Determines whether the pipeline should proceed to generation.
 */
export interface GateEvaluation {
  /** Whether generation should proceed */
  shouldGenerate: boolean
  /** Why the gate passed or failed */
  reason: string
  /** If the requested command isn't appropriate, suggest an alternative */
  suggestedAlternative?: ContributionType
}

// =============================================================================
// CONSTRAINT ENVELOPE
// =============================================================================

/**
 * The full constraint envelope passed to the AI generation step.
 * This is the final output of the pre-generation pipeline.
 */
export interface ConstraintEnvelope {
  /** Characters that MUST NOT appear */
  excludedCharacters: string[]
  /** Characters that are present but MUST NOT drive action */
  passiveCharacters: string[]
  /** Characters that are fully eligible with any per-character constraints */
  eligibleCharacters: Array<{ name: string; constraints?: string[] }>

  /** Actions/events that are FORBIDDEN */
  forbiddenActions: string[]
  /** The types of contribution allowed */
  allowedContributions: ContributionType[]

  /** Scene state summary for the AI's awareness */
  sceneStateSummary: string
}
