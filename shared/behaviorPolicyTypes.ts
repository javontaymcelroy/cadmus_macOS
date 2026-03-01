// Behavior Policy — Shared types between Electron main and renderer
// Adaptive behavior layer that learns from thumbs up/down feedback

// ===== Behavior Dimensions =====

/** The 8 adaptable dimensions of the behavior policy. */
export type BehaviorDimension =
  | 'initiative'          // 0 = passive/reactive, 1 = proactive/suggests without being asked
  | 'toolUsage'           // 0 = avoid tools/reflect only, 1 = aggressively use edit tools
  | 'verbosity'           // 0 = terse/minimal, 1 = detailed/expansive
  | 'structuralStyle'     // 0 = freeform prose, 1 = structured (bullets, headings, numbered lists)
  | 'tone'                // 0 = warm/casual, 1 = formal/rigorous
  | 'riskTolerance'       // 0 = conservative/safe, 1 = bold/experimental suggestions
  | 'autonomy'            // 0 = always ask before acting, 1 = act first/ask forgiveness
  | 'clarificationFreq'   // 0 = rarely clarify/infer, 1 = frequently ask clarifying questions

export const ALL_DIMENSIONS: readonly BehaviorDimension[] = [
  'initiative', 'toolUsage', 'verbosity', 'structuralStyle',
  'tone', 'riskTolerance', 'autonomy', 'clarificationFreq'
] as const

// ===== Behavior Vector =====

/** A vector of preference weights, one per dimension. Each value is in [0, 1]. */
export type BehaviorVector = Record<BehaviorDimension, number>

/** Default neutral vector (0.5 on all dimensions). */
export const DEFAULT_BEHAVIOR_VECTOR: BehaviorVector = {
  initiative: 0.5,
  toolUsage: 0.5,
  verbosity: 0.5,
  structuralStyle: 0.5,
  tone: 0.5,
  riskTolerance: 0.5,
  autonomy: 0.5,
  clarificationFreq: 0.5,
}

// ===== Context Features (for contextual bandit) =====

/** Observed context at the time of an interaction turn. */
export interface InteractionContext {
  intentPolicy: string
  hasSelection: boolean
  consecutiveChatTurns: number
  messageLength: 'short' | 'medium' | 'long'
  templateType: string
  pipelineState: string
  hasActions: boolean
  hasQuestions: boolean
  hasPlan: boolean
  hasReflection: boolean
  hasIdeas: boolean
}

/** Compact serializable context key for the bandit lookup table. */
export type ContextKey = string

// ===== Feedback =====

export type FeedbackSignal = 'thumbs_up' | 'thumbs_down'

export interface FeedbackEntry {
  id: string
  messageId: string
  conversationId: string | null
  timestamp: string
  signal: FeedbackSignal
  context: InteractionContext
  behaviorVectorSnapshot: BehaviorVector
  expressedDimensions: Partial<Record<BehaviorDimension, number>>
}

// ===== Per-Dimension Bandit State (Thompson Sampling with Beta distribution) =====

export interface DimensionBanditState {
  alphaHigh: number
  betaHigh: number
  alphaLow: number
  betaLow: number
  ema: number
  n: number
}

export const DEFAULT_DIMENSION_BANDIT: DimensionBanditState = {
  alphaHigh: 1,
  betaHigh: 1,
  alphaLow: 1,
  betaLow: 1,
  ema: 0.5,
  n: 0,
}

// ===== Persisted Policy State =====

export interface ContextOverride {
  vector: BehaviorVector
  bandits: Record<BehaviorDimension, DimensionBanditState>
  sampleCount: number
}

export interface BehaviorPolicyState {
  version: number
  globalVector: BehaviorVector
  globalBandits: Record<BehaviorDimension, DimensionBanditState>
  contextOverrides: Record<ContextKey, ContextOverride>
  lastUpdated: string
}

export const BEHAVIOR_POLICY_VERSION = 1

// ===== Safeguard Bounds =====

export const DIMENSION_BOUNDS: Record<BehaviorDimension, { min: number; max: number }> = {
  initiative:        { min: 0.1, max: 0.9 },
  toolUsage:         { min: 0.1, max: 0.9 },
  verbosity:         { min: 0.15, max: 0.95 },
  structuralStyle:   { min: 0.05, max: 0.95 },
  tone:              { min: 0.05, max: 0.95 },
  riskTolerance:     { min: 0.1, max: 0.8 },
  autonomy:          { min: 0.05, max: 0.7 },
  clarificationFreq: { min: 0.1, max: 0.85 },
}

/** Dimensions that exploration is NOT allowed to perturb (safety-sensitive). */
export const EXPLORATION_LOCKED_DIMENSIONS: readonly BehaviorDimension[] = [
  'riskTolerance', 'autonomy'
] as const

/** Maximum change to any dimension from a single feedback event. */
export const MAX_SINGLE_FEEDBACK_DELTA = 0.05

// ===== Exploration Config =====

export interface ExplorationConfig {
  epsilon: number
  maxPerturbation: number
  epsilonDecay: number
  epsilonMin: number
  emaAlpha: number
}

export const DEFAULT_EXPLORATION_CONFIG: ExplorationConfig = {
  epsilon: 0.2,
  maxPerturbation: 0.15,
  epsilonDecay: 0.995,
  epsilonMin: 0.05,
  emaAlpha: 0.15,
}

// ===== Prompt Policy Directives =====

export interface BehaviorDirectives {
  initiativeDirective: string
  verbosityDirective: string
  toneDirective: string
  structureDirective: string
  riskDirective: string
  autonomyDirective: string
  clarificationDirective: string
}

// ===== Feedback Submission (renderer → main IPC payload) =====

export interface FeedbackSubmission {
  messageId: string
  conversationId: string | null
  signal: FeedbackSignal
  projectPath: string | null
  context: InteractionContext
  vectorSnapshot: BehaviorVector
  expressedDimensions: Partial<Record<BehaviorDimension, number>>
}

// ===== Helper to create default bandit state for all dimensions =====

export function createDefaultBandits(): Record<BehaviorDimension, DimensionBanditState> {
  const bandits = {} as Record<BehaviorDimension, DimensionBanditState>
  for (const dim of ALL_DIMENSIONS) {
    bandits[dim] = { ...DEFAULT_DIMENSION_BANDIT }
  }
  return bandits
}

export function createDefaultPolicyState(): BehaviorPolicyState {
  return {
    version: BEHAVIOR_POLICY_VERSION,
    globalVector: { ...DEFAULT_BEHAVIOR_VECTOR },
    globalBandits: createDefaultBandits(),
    contextOverrides: {},
    lastUpdated: new Date().toISOString(),
  }
}
