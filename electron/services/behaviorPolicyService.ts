// BehaviorPolicyService — Core adaptive behavior layer
// Manages 3-layer behavior vector (global → project → session)
// Uses Thompson Sampling with Beta distributions per dimension

import Store from 'electron-store'
import * as fs from 'fs'
import * as path from 'path'
import type {
  BehaviorVector,
  BehaviorDimension,
  BehaviorPolicyState,
  InteractionContext,
  ContextKey,
  DimensionBanditState,
  ExplorationConfig,
  FeedbackEntry,
  ContextOverride,
} from '../../shared/behaviorPolicyTypes'
import {
  DEFAULT_BEHAVIOR_VECTOR,
  ALL_DIMENSIONS,
  DIMENSION_BOUNDS,
  DEFAULT_EXPLORATION_CONFIG,
  EXPLORATION_LOCKED_DIMENSIONS,
  MAX_SINGLE_FEEDBACK_DELTA,
  createDefaultPolicyState,
  createDefaultBandits,
} from '../../shared/behaviorPolicyTypes'

const BEHAVIOR_DIR = 'behavior'
const THOUGHT_PARTNER_DIR = '.cadmus/thought-partner'
const PROJECT_POLICY_FILE = 'project-policy.json'

type ToolPolicy = 'chat-only' | 'reflect-first' | 'explore-only' | 'full'

export class BehaviorPolicyService {
  private store: Store
  private sessionVector: BehaviorVector | null = null
  private explorationConfig: ExplorationConfig = { ...DEFAULT_EXPLORATION_CONFIG }

  constructor() {
    this.store = new Store({
      name: 'behavior-policy',
      encryptionKey: 'cadmus-behavior-v1',
    })
  }

  // ===== Vector Resolution (3-layer merge) =====

  resolveVector(projectPath: string | null, context: InteractionContext): BehaviorVector {
    const globalState = this.loadGlobalState()
    const contextKey = this.contextKey(context)

    // Layer 1: Global baseline
    let vector = { ...globalState.globalVector }

    // Layer 2: Context-specific override (if enough samples)
    const ctxOverride = globalState.contextOverrides[contextKey]
    if (ctxOverride && ctxOverride.sampleCount >= 3) {
      const ctxWeight = Math.min(0.6, ctxOverride.sampleCount / 20)
      for (const dim of ALL_DIMENSIONS) {
        vector[dim] = vector[dim] * (1 - ctxWeight) + ctxOverride.vector[dim] * ctxWeight
      }
    }

    // Layer 3: Project-specific override
    if (projectPath) {
      const projectState = this.loadProjectState(projectPath)
      if (projectState) {
        const totalSamples = ALL_DIMENSIONS.reduce((sum, dim) =>
          sum + projectState.globalBandits[dim].n, 0)
        if (totalSamples >= 5) {
          const projWeight = Math.min(0.5, totalSamples / 50)
          for (const dim of ALL_DIMENSIONS) {
            vector[dim] = vector[dim] * (1 - projWeight) + projectState.globalVector[dim] * projWeight
          }
        }
      }
    }

    // Layer 4: Session-level transient overlay
    if (this.sessionVector) {
      for (const dim of ALL_DIMENSIONS) {
        vector[dim] = vector[dim] * 0.7 + this.sessionVector[dim] * 0.3
      }
    }

    return this.clampVector(vector)
  }

  resolveVectorWithExploration(projectPath: string | null, context: InteractionContext): BehaviorVector {
    const baseVector = this.resolveVector(projectPath, context)

    // If enough data, try Thompson Sampling
    const globalState = this.loadGlobalState()
    const totalSamples = ALL_DIMENSIONS.reduce((sum, dim) =>
      sum + globalState.globalBandits[dim].n, 0)
    if (totalSamples > 10) {
      const sampled = this.thompsonSample(globalState.globalBandits)
      // Blend sampled with resolved: use sampled for exploration, resolved as anchor
      const blendWeight = Math.min(0.4, this.explorationConfig.epsilon)
      for (const dim of ALL_DIMENSIONS) {
        if (EXPLORATION_LOCKED_DIMENSIONS.includes(dim)) continue
        baseVector[dim] = baseVector[dim] * (1 - blendWeight) + sampled[dim] * blendWeight
      }
      return this.clampVector(baseVector)
    }

    // Otherwise use epsilon-greedy exploration
    return this.applyExploration(baseVector)
  }

  // ===== Contextual Bandit Update =====

  processFeedback(projectPath: string | null, entry: FeedbackEntry): BehaviorVector {
    const globalState = this.loadGlobalState()
    const contextKey = this.contextKey(entry.context)
    const reward = entry.signal === 'thumbs_up' ? 1 : 0

    // Update per-dimension bandit state
    for (const dim of ALL_DIMENSIONS) {
      const expressed = entry.expressedDimensions[dim]
      if (expressed === undefined) continue

      const isHigh = expressed > 0.5
      const bandit = globalState.globalBandits[dim]

      // Update Beta distribution
      if (isHigh) {
        if (reward) bandit.alphaHigh += 1
        else bandit.betaHigh += 1
      } else {
        if (reward) bandit.alphaLow += 1
        else bandit.betaLow += 1
      }

      // Update EMA
      const target = reward ? expressed : (1 - expressed)
      bandit.ema = (1 - this.explorationConfig.emaAlpha) * bandit.ema +
        this.explorationConfig.emaAlpha * target
      bandit.n += 1

      // Recompute vector from EMA, clamped by max delta
      const oldValue = globalState.globalVector[dim]
      const newValue = bandit.ema
      const delta = Math.max(-MAX_SINGLE_FEEDBACK_DELTA,
        Math.min(MAX_SINGLE_FEEDBACK_DELTA, newValue - oldValue))
      globalState.globalVector[dim] = oldValue + delta
    }

    // Update context-specific override
    if (!globalState.contextOverrides[contextKey]) {
      globalState.contextOverrides[contextKey] = {
        vector: { ...DEFAULT_BEHAVIOR_VECTOR },
        bandits: createDefaultBandits(),
        sampleCount: 0,
      }
    }
    const ctxOverride = globalState.contextOverrides[contextKey]
    ctxOverride.sampleCount += 1
    for (const dim of ALL_DIMENSIONS) {
      const expressed = entry.expressedDimensions[dim]
      if (expressed === undefined) continue
      const isHigh = expressed > 0.5
      const bandit = ctxOverride.bandits[dim]
      if (isHigh) {
        if (reward) bandit.alphaHigh += 1
        else bandit.betaHigh += 1
      } else {
        if (reward) bandit.alphaLow += 1
        else bandit.betaLow += 1
      }
      bandit.ema = (1 - this.explorationConfig.emaAlpha) * bandit.ema +
        this.explorationConfig.emaAlpha * (reward ? expressed : (1 - expressed))
      bandit.n += 1
      const oldCtxVal = ctxOverride.vector[dim]
      const ctxDelta = Math.max(-MAX_SINGLE_FEEDBACK_DELTA,
        Math.min(MAX_SINGLE_FEEDBACK_DELTA, bandit.ema - oldCtxVal))
      ctxOverride.vector[dim] = oldCtxVal + ctxDelta
    }

    // Clamp and persist global state
    globalState.globalVector = this.clampVector(globalState.globalVector)
    ctxOverride.vector = this.clampVector(ctxOverride.vector)
    globalState.lastUpdated = new Date().toISOString()
    this.saveGlobalState(globalState)

    // Update project-level state if applicable
    if (projectPath) {
      this.updateProjectState(projectPath, entry)
    }

    // Decay epsilon
    this.explorationConfig.epsilon = Math.max(
      this.explorationConfig.epsilonMin,
      this.explorationConfig.epsilon * this.explorationConfig.epsilonDecay
    )

    // Update session vector
    this.sessionVector = { ...globalState.globalVector }

    return globalState.globalVector
  }

  private updateProjectState(projectPath: string, entry: FeedbackEntry): void {
    let state = this.loadProjectState(projectPath) || createDefaultPolicyState()
    const reward = entry.signal === 'thumbs_up' ? 1 : 0

    for (const dim of ALL_DIMENSIONS) {
      const expressed = entry.expressedDimensions[dim]
      if (expressed === undefined) continue

      const isHigh = expressed > 0.5
      const bandit = state.globalBandits[dim]
      if (isHigh) {
        if (reward) bandit.alphaHigh += 1
        else bandit.betaHigh += 1
      } else {
        if (reward) bandit.alphaLow += 1
        else bandit.betaLow += 1
      }
      bandit.ema = (1 - this.explorationConfig.emaAlpha) * bandit.ema +
        this.explorationConfig.emaAlpha * (reward ? expressed : (1 - expressed))
      bandit.n += 1

      const oldValue = state.globalVector[dim]
      const delta = Math.max(-MAX_SINGLE_FEEDBACK_DELTA,
        Math.min(MAX_SINGLE_FEEDBACK_DELTA, bandit.ema - oldValue))
      state.globalVector[dim] = oldValue + delta
    }

    state.globalVector = this.clampVector(state.globalVector)
    state.lastUpdated = new Date().toISOString()
    this.saveProjectState(projectPath, state)
  }

  // ===== Exploration =====

  private applyExploration(vector: BehaviorVector): BehaviorVector {
    if (Math.random() > this.explorationConfig.epsilon) {
      return vector // Exploit
    }

    const explored = { ...vector }
    for (const dim of ALL_DIMENSIONS) {
      if (EXPLORATION_LOCKED_DIMENSIONS.includes(dim)) continue
      const perturbation = (Math.random() * 2 - 1) * this.explorationConfig.maxPerturbation
      explored[dim] += perturbation
    }
    return this.clampVector(explored)
  }

  private thompsonSample(bandits: Record<BehaviorDimension, DimensionBanditState>): BehaviorVector {
    const vector = { ...DEFAULT_BEHAVIOR_VECTOR }
    for (const dim of ALL_DIMENSIONS) {
      const b = bandits[dim]
      if (b.n < 3) {
        vector[dim] = 0.5
        continue
      }
      const sHigh = this.betaSample(b.alphaHigh, b.betaHigh)
      const sLow = this.betaSample(b.alphaLow, b.betaLow)
      // If high arm samples better, lean toward high
      if (sHigh > sLow) {
        vector[dim] = 0.5 + (sHigh - sLow) * 0.5
      } else {
        vector[dim] = 0.5 - (sLow - sHigh) * 0.5
      }
    }
    return this.clampVector(vector)
  }

  // ===== Statistical Sampling (pure JS, no external deps) =====

  private betaSample(alpha: number, beta: number): number {
    const x = this.gammaSample(alpha)
    const y = this.gammaSample(beta)
    if (x + y === 0) return 0.5
    return x / (x + y)
  }

  private gammaSample(shape: number): number {
    if (shape < 1) {
      return this.gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape)
    }
    // Marsaglia-Tsang method
    const d = shape - 1 / 3
    const c = 1 / Math.sqrt(9 * d)
    while (true) {
      let x: number
      let v: number
      do {
        x = this.normalSample()
        v = 1 + c * x
      } while (v <= 0)
      v = v * v * v
      const u = Math.random()
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
    }
  }

  private normalSample(): number {
    const u1 = Math.random()
    const u2 = Math.random()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }

  // ===== Context Key Generation =====

  private contextKey(context: InteractionContext): ContextKey {
    return `${context.intentPolicy}|${context.templateType}|${context.messageLength}`
  }

  // ===== Prompt Directive Generation =====

  vectorToPromptAddendum(vector: BehaviorVector): string {
    const parts: string[] = []
    const threshold = 0.15

    if (vector.verbosity > 0.5 + threshold) {
      parts.push('Be thorough and detailed in your responses. Explain your reasoning fully.')
    } else if (vector.verbosity < 0.5 - threshold) {
      parts.push('Be concise and brief. Get to the point quickly without over-explaining.')
    }

    if (vector.initiative > 0.5 + threshold) {
      parts.push('Proactively suggest ideas and improvements even when not explicitly asked.')
    } else if (vector.initiative < 0.5 - threshold) {
      parts.push('Only respond to what is directly asked. Avoid unsolicited suggestions.')
    }

    if (vector.tone > 0.5 + threshold) {
      parts.push('Use a formal, professional tone.')
    } else if (vector.tone < 0.5 - threshold) {
      parts.push('Use a warm, conversational tone.')
    }

    if (vector.structuralStyle > 0.5 + threshold) {
      parts.push('Structure your responses with bullet points, numbered lists, or headings when appropriate.')
    } else if (vector.structuralStyle < 0.5 - threshold) {
      parts.push('Write in flowing prose paragraphs rather than lists or structured formats.')
    }

    if (vector.riskTolerance > 0.5 + threshold) {
      parts.push('Feel free to suggest bold, unconventional, or experimental ideas.')
    } else if (vector.riskTolerance < 0.5 - threshold) {
      parts.push('Favor safe, well-established approaches over experimental ones.')
    }

    if (vector.clarificationFreq > 0.5 + threshold) {
      parts.push('When in doubt, ask a clarifying question before proceeding.')
    } else if (vector.clarificationFreq < 0.5 - threshold) {
      parts.push('Infer the most likely intent rather than asking clarifying questions. Act on your best interpretation.')
    }

    if (vector.autonomy > 0.5 + threshold) {
      parts.push('When you are confident about an edit, go ahead and propose it directly.')
    } else if (vector.autonomy < 0.5 - threshold) {
      parts.push('Always confirm with the writer before taking action or making changes.')
    }

    if (vector.toolUsage > 0.5 + threshold) {
      parts.push('Prefer to use tools and propose concrete edits rather than just discussing.')
    } else if (vector.toolUsage < 0.5 - threshold) {
      parts.push('Prefer to discuss and advise rather than directly proposing edits.')
    }

    if (parts.length === 0) return ''
    return '\n\n=== BEHAVIOR PREFERENCES (learned from your feedback) ===\n' + parts.join('\n')
  }

  // ===== Tool Policy Influence =====

  adjustToolPolicy(originalPolicy: ToolPolicy, vector: BehaviorVector): ToolPolicy {
    let policy = originalPolicy

    // Low tool usage → downgrade toward chat
    if (vector.toolUsage < 0.3 && policy === 'full') {
      policy = 'reflect-first'
    } else if (vector.toolUsage < 0.2 && policy === 'reflect-first') {
      policy = 'chat-only'
    }

    // High tool usage → upgrade toward full (only if there's edit intent)
    if (vector.toolUsage > 0.7 && policy === 'chat-only') {
      policy = 'reflect-first'
    }

    // High clarification → prefer reflect-first over full
    if (vector.clarificationFreq > 0.7 && policy === 'full') {
      policy = 'reflect-first'
    }

    // High autonomy → upgrade reflect-first to full
    if (vector.autonomy > 0.6 && policy === 'reflect-first') {
      policy = 'full'
    }

    return policy
  }

  // ===== Persistence =====

  loadGlobalState(): BehaviorPolicyState {
    try {
      const stored = this.store.get('policyState') as BehaviorPolicyState | undefined
      if (stored && stored.version === 1) {
        // Ensure all dimensions exist (forward compat)
        for (const dim of ALL_DIMENSIONS) {
          if (stored.globalVector[dim] === undefined) stored.globalVector[dim] = 0.5
          if (!stored.globalBandits[dim]) stored.globalBandits[dim] = {
            alphaHigh: 1, betaHigh: 1, alphaLow: 1, betaLow: 1, ema: 0.5, n: 0
          }
        }
        return stored
      }
    } catch (err) {
      console.error('[BehaviorPolicy] Failed to load global state:', err)
    }
    return createDefaultPolicyState()
  }

  saveGlobalState(state: BehaviorPolicyState): void {
    try {
      this.store.set('policyState', state)
    } catch (err) {
      console.error('[BehaviorPolicy] Failed to save global state:', err)
    }
  }

  loadProjectState(projectPath: string): BehaviorPolicyState | null {
    try {
      const filePath = path.join(projectPath, THOUGHT_PARTNER_DIR, BEHAVIOR_DIR, PROJECT_POLICY_FILE)
      if (!fs.existsSync(filePath)) return null
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      if (data.version === 1) return data
    } catch (err) {
      console.error('[BehaviorPolicy] Failed to load project state:', err)
    }
    return null
  }

  saveProjectState(projectPath: string, state: BehaviorPolicyState): void {
    try {
      const dir = path.join(projectPath, THOUGHT_PARTNER_DIR, BEHAVIOR_DIR)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const filePath = path.join(dir, PROJECT_POLICY_FILE)
      // Atomic write: write to temp file then rename
      const tmpPath = filePath + '.tmp'
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8')
      fs.renameSync(tmpPath, filePath)
    } catch (err) {
      console.error('[BehaviorPolicy] Failed to save project state:', err)
    }
  }

  // ===== Safeguards =====

  private clampVector(vector: BehaviorVector): BehaviorVector {
    const clamped = { ...vector }
    for (const dim of ALL_DIMENSIONS) {
      const bounds = DIMENSION_BOUNDS[dim]
      clamped[dim] = Math.max(bounds.min, Math.min(bounds.max, clamped[dim]))
    }
    return clamped
  }

  // ===== Reset =====

  resetGlobal(): void {
    this.store.delete('policyState')
    this.sessionVector = null
    this.explorationConfig = { ...DEFAULT_EXPLORATION_CONFIG }
    console.log('[BehaviorPolicy] Global state reset')
  }

  resetProject(projectPath: string): void {
    try {
      const filePath = path.join(projectPath, THOUGHT_PARTNER_DIR, BEHAVIOR_DIR, PROJECT_POLICY_FILE)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      console.log('[BehaviorPolicy] Project state reset')
    } catch (err) {
      console.error('[BehaviorPolicy] Failed to reset project state:', err)
    }
  }

  resetSession(): void {
    this.sessionVector = null
    console.log('[BehaviorPolicy] Session state reset')
  }
}

// Singleton
let behaviorPolicyInstance: BehaviorPolicyService | null = null
export function getBehaviorPolicyService(): BehaviorPolicyService {
  if (!behaviorPolicyInstance) {
    behaviorPolicyInstance = new BehaviorPolicyService()
  }
  return behaviorPolicyInstance
}
