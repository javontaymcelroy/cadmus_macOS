/**
 * Scene State Classifier
 * 
 * Runs BEFORE any AI generation to classify the current narrative moment.
 * This is the first gate in the pipeline: it labels the moment with
 * act, phase, focus, exclusions, and allowed contributions.
 * 
 * The classifier operates on observable signals extracted from the script,
 * NOT on AI interpretation. It uses heuristics and structural analysis
 * to determine where we are in the story and what's appropriate.
 * 
 * Exclusions matter more than inclusions.
 */

import type {
  SceneState,
  ActPosition,
  NarrativePhase,
  SceneFocus,
  ContributionType,
  SceneExclusion,
  ClassificationSignals,
  CharacterUsageHistory
} from '../../shared/sceneStateTypes'
import type { SceneContext } from '../../shared/aiWritingTypes'
import type { StoryFacts, CharacterState, TimelineBeat } from './dramaticCritiqueService'

// =============================================================================
// SIGNAL EXTRACTION
// =============================================================================

/**
 * Extract classification signals from the script context and story facts.
 * These are raw observable facts - no interpretation.
 */
export function extractClassificationSignals(
  scriptContext: string,
  sceneContext: SceneContext | undefined,
  storyFacts: StoryFacts | undefined,
  characterUsageHistory: CharacterUsageHistory[]
): ClassificationSignals {
  // Count scenes from script context by counting scene headings
  const sceneHeadingPattern = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+/gm
  const sceneHeadings = scriptContext.match(sceneHeadingPattern) || []
  const totalSceneCount = sceneHeadings.length

  // Count scenes from story facts timeline if available
  const timelineSceneCount = storyFacts?.timeline?.length || 0
  const effectiveSceneCount = Math.max(totalSceneCount, timelineSceneCount)

  // Detect act breaks in the text
  const actBreakPattern = /ACT\s+(II|III|IV|TWO|THREE|FOUR|2|3|4)/gi
  const actBreaks = scriptContext.match(actBreakPattern) || []
  const scenesSinceActBreak = actBreaks.length > 0
    ? countScenesSinceLastMatch(scriptContext, actBreakPattern, sceneHeadingPattern)
    : effectiveSceneCount

  // Characters introduced (from story facts or usage history)
  const charactersIntroducedCount = characterUsageHistory.filter(c => c.hasBeenIntroduced).length
    || storyFacts?.characters?.length
    || 0

  // Characters in current scene
  const charactersInCurrentScene = sceneContext?.charactersInScene?.length || 0

  // Identify lead character (most dialogue lines, earliest introduction)
  const leadChar = identifyLeadCharacter(characterUsageHistory, storyFacts?.characters)
  const leadCharacterIdentified = !!leadChar

  // Check if lead is in current scene
  const leadInCurrentScene = leadChar
    ? (sceneContext?.charactersInScene || []).some(
        name => name.toUpperCase() === leadChar.name.toUpperCase()
      )
    : false

  // Scenes since lead last appeared
  const scenesSinceLeadAppearance = leadChar
    ? computeScenesSinceLastAppearance(leadChar, effectiveSceneCount)
    : 0

  // Conflict established - check for tension markers in story facts
  const conflictEstablished = hasConflictBeenEstablished(storyFacts)

  // Is this the opening scene?
  const isOpeningScene = effectiveSceneCount <= 1

  // Active tension - check if there are open promises or unresolved conflicts
  const activeTension = (storyFacts?.openPromises?.length || 0) > 0

  return {
    totalSceneCount: effectiveSceneCount,
    scenesSinceActBreak,
    charactersIntroducedCount,
    charactersInCurrentScene,
    conflictEstablished,
    isOpeningScene,
    leadCharacterIdentified,
    leadInCurrentScene,
    scenesSinceLeadAppearance,
    activeTension,
    currentSceneHeading: sceneContext?.sceneHeading
  }
}

// =============================================================================
// CLASSIFICATION LOGIC
// =============================================================================

/**
 * Classify the current scene state from extracted signals.
 * This is pure logic - no AI calls.
 */
export function classifySceneState(
  signals: ClassificationSignals
): SceneState {
  const act = classifyAct(signals)
  const phase = classifyPhase(signals, act)
  const focus = classifyFocus(signals, act, phase)
  const exclusions = deriveExclusions(signals, act, phase, focus)
  const allowedContributions = deriveAllowedContributions(phase, focus, signals)

  // Compute confidence based on signal strength
  const confidence = computeConfidence(signals)

  // Generate human-readable reasoning
  const reasoning = generateReasoning(signals, act, phase, focus)

  return {
    act,
    phase,
    focus,
    exclusions,
    allowedContributions,
    confidence,
    reasoning,
    signals
  }
}

/**
 * Full classification pipeline: extract signals then classify.
 */
export function classifyFromContext(
  scriptContext: string,
  sceneContext: SceneContext | undefined,
  storyFacts: StoryFacts | undefined,
  characterUsageHistory: CharacterUsageHistory[]
): SceneState {
  const signals = extractClassificationSignals(
    scriptContext,
    sceneContext,
    storyFacts,
    characterUsageHistory
  )
  return classifySceneState(signals)
}

// =============================================================================
// ACT CLASSIFICATION
// =============================================================================

function classifyAct(signals: ClassificationSignals): ActPosition {
  const { totalSceneCount, scenesSinceActBreak, conflictEstablished } = signals

  // Very early in the script
  if (totalSceneCount <= 3) return 'I'

  // Use typical screenplay structure proportions:
  // Act I: ~25% of scenes (setup)
  // Act II-A: ~25% (rising action to midpoint)
  // Act II-B: ~25% (midpoint to crisis)
  // Act III: ~25% (climax to resolution)
  //
  // For a standard 40-60 scene screenplay:
  if (totalSceneCount <= 8) {
    // Still early - likely Act I
    if (!conflictEstablished) return 'I'
    return 'II-A'
  }

  if (totalSceneCount <= 15) {
    if (!conflictEstablished) return 'I'
    return 'II-A'
  }

  if (totalSceneCount <= 30) {
    // Mid-script
    if (scenesSinceActBreak < 5) return 'II-A'
    return 'II-B'
  }

  if (totalSceneCount <= 45) {
    return 'II-B'
  }

  // Late in the script
  return 'III'
}

// =============================================================================
// PHASE CLASSIFICATION
// =============================================================================

function classifyPhase(signals: ClassificationSignals, act: ActPosition): NarrativePhase {
  const {
    isOpeningScene,
    scenesSinceActBreak,
    conflictEstablished,
    activeTension,
    totalSceneCount,
    charactersIntroducedCount
  } = signals

  // Opening scenes are always setup
  if (isOpeningScene) return 'setup'

  // Just after an act break = transition
  if (scenesSinceActBreak <= 1 && totalSceneCount > 3) return 'transition'

  // Act I logic
  if (act === 'I') {
    // Still introducing characters and world
    if (charactersIntroducedCount <= 2 || !conflictEstablished) return 'setup'
    // Conflict established, building toward act break
    return 'escalation'
  }

  // Act II-A logic
  if (act === 'II-A') {
    if (scenesSinceActBreak <= 3) return 'escalation'
    return 'escalation' // Most of II-A is rising action
  }

  // Act II-B logic
  if (act === 'II-B') {
    if (activeTension) return 'escalation'
    return 'climax' // Building toward the crisis
  }

  // Act III logic
  if (act === 'III') {
    if (scenesSinceActBreak <= 3) return 'climax'
    return 'release'
  }

  return 'setup'
}

// =============================================================================
// FOCUS CLASSIFICATION
// =============================================================================

function classifyFocus(
  signals: ClassificationSignals,
  act: ActPosition,
  phase: NarrativePhase
): SceneFocus {
  const {
    charactersInCurrentScene,
    leadInCurrentScene,
    conflictEstablished,
    isOpeningScene,
    charactersIntroducedCount
  } = signals

  // Opening scene with no characters yet = world-building
  if (isOpeningScene && charactersInCurrentScene === 0) return 'world-building'

  // Early script, still introducing characters
  if (act === 'I' && phase === 'setup') {
    if (charactersIntroducedCount <= 2) return 'world-building'
    if (!leadInCurrentScene) return 'supporting-cast'
    return 'lead-driven'
  }

  // Lead is present and driving action
  if (leadInCurrentScene && conflictEstablished) return 'lead-driven'

  // No lead present, multiple supporting characters
  if (!leadInCurrentScene && charactersInCurrentScene >= 2) return 'supporting-cast'

  // Conflict-focused scenes
  if (conflictEstablished && phase === 'escalation') return 'conflict'

  // Theme scenes (usually quieter moments)
  if (phase === 'release' || phase === 'transition') return 'theme'

  // Default: whatever characters are present
  if (leadInCurrentScene) return 'lead-driven'
  if (charactersInCurrentScene > 0) return 'supporting-cast'
  return 'world-building'
}

// =============================================================================
// EXCLUSION DERIVATION
// =============================================================================

/**
 * Derive hard exclusions based on the classified scene state.
 * These become FORBIDDEN constraints that the AI must obey.
 */
function deriveExclusions(
  signals: ClassificationSignals,
  act: ActPosition,
  phase: NarrativePhase,
  focus: SceneFocus
): SceneExclusion[] {
  const exclusions: SceneExclusion[] = []

  // === SETUP PHASE EXCLUSIONS ===
  if (phase === 'setup') {
    // Don't resolve conflicts during setup - there shouldn't be any yet
    exclusions.push({
      type: 'resolution',
      reason: 'Setup phase: conflicts should be building, not resolving'
    })

    // If we're world-building, don't introduce lead yet
    if (focus === 'world-building' && !signals.leadInCurrentScene) {
      exclusions.push({
        type: 'character',
        target: 'lead/protagonist',
        reason: 'World-building phase: establish environment before introducing lead character'
      })
    }

    // Don't make big revelations during setup
    exclusions.push({
      type: 'revelation',
      reason: 'Setup phase: save revelations for after the world and characters are grounded'
    })
  }

  // === SUPPORTING CAST FOCUS EXCLUSIONS ===
  if (focus === 'supporting-cast') {
    // Lead shouldn't hijack a supporting cast scene
    if (!signals.leadInCurrentScene) {
      exclusions.push({
        type: 'character',
        target: 'lead/protagonist',
        reason: 'Supporting cast focus: let these characters breathe without the lead dominating'
      })
    }

    // Don't advance the main plot in supporting cast scenes
    exclusions.push({
      type: 'action',
      target: 'main-plot-advancement',
      reason: 'Supporting cast scene: develop these characters, don\'t advance the main plot'
    })
  }

  // === TRANSITION PHASE EXCLUSIONS ===
  if (phase === 'transition') {
    // Don't climax during a transition
    exclusions.push({
      type: 'action',
      target: 'climactic-action',
      reason: 'Transition phase: the audience needs to breathe between acts'
    })

    // Don't resolve anything
    exclusions.push({
      type: 'resolution',
      reason: 'Transition phase: carry tension forward, don\'t resolve it'
    })
  }

  // === RELEASE PHASE EXCLUSIONS ===
  if (phase === 'release') {
    // Don't introduce new conflicts during release
    exclusions.push({
      type: 'action',
      target: 'new-conflict',
      reason: 'Release phase: the story is winding down, don\'t introduce new tensions'
    })
  }

  // === ACT I PROTECTIONS ===
  if (act === 'I' && signals.totalSceneCount <= 3) {
    // Very early in the story - protect pacing
    exclusions.push({
      type: 'action',
      target: 'plot-acceleration',
      reason: 'Early Act I: the story needs room to establish its world before plot machinery kicks in'
    })
  }

  // === WORLD-BUILDING FOCUS EXCLUSIONS ===
  if (focus === 'world-building') {
    // Don't advance plot during world-building
    exclusions.push({
      type: 'action',
      target: 'plot-advancement',
      reason: 'World-building focus: establish the setting and atmosphere first'
    })
  }

  return exclusions
}

// =============================================================================
// ALLOWED CONTRIBUTIONS
// =============================================================================

/**
 * Derive what types of contributions are allowed based on phase and focus.
 * This is the "positive space" of what the AI can do.
 */
function deriveAllowedContributions(
  phase: NarrativePhase,
  focus: SceneFocus,
  signals: ClassificationSignals
): ContributionType[] {
  const contributions: ContributionType[] = []

  // Questions are always allowed - the AI can always ask the writer something
  contributions.push('question')

  // Texture is almost always appropriate (environmental detail, behavior)
  contributions.push('texture')

  // Negative space is appropriate in most non-climax phases
  if (phase !== 'climax') {
    contributions.push('negativeSpace')
  }

  switch (phase) {
    case 'setup':
      contributions.push('delay')
      // Dialogue only if characters are present
      if (signals.charactersInCurrentScene > 0) {
        contributions.push('dialogue')
      }
      // Action only for minor character-establishing actions
      // (not plot-advancing, which is handled by exclusions)
      break

    case 'escalation':
      contributions.push('tension')
      contributions.push('dialogue')
      contributions.push('action')
      break

    case 'climax':
      contributions.push('tension')
      contributions.push('dialogue')
      contributions.push('action')
      break

    case 'release':
      contributions.push('delay')
      contributions.push('dialogue')
      contributions.push('negativeSpace')
      break

    case 'transition':
      contributions.push('delay')
      contributions.push('texture')
      if (signals.charactersInCurrentScene > 0) {
        contributions.push('dialogue')
      }
      break
  }

  // Deduplicate
  return [...new Set(contributions)]
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Identify the lead character from usage history.
 * Uses dialogue count and introduction order as primary signals.
 */
function identifyLeadCharacter(
  history: CharacterUsageHistory[],
  storyCharacters?: CharacterState[]
): CharacterUsageHistory | null {
  if (history.length === 0) return null

  // Score each character: dialogue weight + appearance weight + early introduction bonus
  const scored = history.map(char => {
    let score = 0
    score += char.dialogueLineCount * 2 // Dialogue is the strongest signal
    score += char.appearsInScenes.length * 1 // Appearances matter
    if (char.firstAppearanceScene <= 2) score += 5 // Early introduction bonus
    if (char.hasBeenIntroduced) score += 3 // Formal introduction bonus
    return { char, score }
  })

  scored.sort((a, b) => b.score - a.score)

  // The top scorer is likely the lead, but only if they meaningfully lead
  const top = scored[0]
  const second = scored[1]

  if (!second || top.score > second.score * 1.3) {
    return top.char
  }

  // If scores are close, it might be an ensemble - no clear lead
  return top.char
}

/**
 * Check if a major conflict has been established in the story.
 */
function hasConflictBeenEstablished(storyFacts?: StoryFacts): boolean {
  if (!storyFacts) return false

  // Check for open promises (indicates setup/payoff dynamics are in play)
  if (storyFacts.openPromises.length > 0) return true

  // Check if any character has clear wants/constraints in tension
  for (const char of storyFacts.characters) {
    if (char.currentWants.length > 0 && char.constraints.length > 0) return true
  }

  // Check for relationship dynamics
  for (const char of storyFacts.characters) {
    if (char.relationshipStates.some(r =>
      r.state.toLowerCase().includes('conflict') ||
      r.state.toLowerCase().includes('tension') ||
      r.state.toLowerCase().includes('distrust') ||
      r.state.toLowerCase().includes('antagoni')
    )) return true
  }

  return false
}

/**
 * Compute how many scenes since a character last appeared.
 */
function computeScenesSinceLastAppearance(
  char: CharacterUsageHistory,
  totalScenes: number
): number {
  if (char.appearsInScenes.length === 0) return totalScenes
  const lastScene = Math.max(...char.appearsInScenes)
  return totalScenes - lastScene
}

/**
 * Count scenes since the last occurrence of a pattern.
 */
function countScenesSinceLastMatch(
  text: string,
  targetPattern: RegExp,
  scenePattern: RegExp
): number {
  // Find last occurrence of target pattern
  let lastTargetIdx = -1
  const targetCopy = new RegExp(targetPattern.source, targetPattern.flags)
  let match: RegExpExecArray | null
  while ((match = targetCopy.exec(text)) !== null) {
    lastTargetIdx = match.index
  }

  if (lastTargetIdx === -1) return 0

  // Count scene headings after that position
  const textAfter = text.slice(lastTargetIdx)
  const sceneCopy = new RegExp(scenePattern.source, scenePattern.flags)
  const matches = textAfter.match(sceneCopy) || []
  return matches.length
}

/**
 * Compute confidence in the classification based on signal quality.
 */
function computeConfidence(signals: ClassificationSignals): number {
  let confidence = 0.5 // Base confidence

  // More scenes = more data = more confidence
  if (signals.totalSceneCount >= 5) confidence += 0.1
  if (signals.totalSceneCount >= 15) confidence += 0.1

  // Lead character identified increases confidence
  if (signals.leadCharacterIdentified) confidence += 0.1

  // Conflict state is clear
  if (signals.conflictEstablished) confidence += 0.1

  // Scene context available
  if (signals.currentSceneHeading) confidence += 0.05

  // Characters in scene provide more data
  if (signals.charactersInCurrentScene > 0) confidence += 0.05

  return Math.min(confidence, 1.0)
}

/**
 * Generate human-readable reasoning for the classification.
 */
function generateReasoning(
  signals: ClassificationSignals,
  act: ActPosition,
  phase: NarrativePhase,
  focus: SceneFocus
): string {
  const parts: string[] = []

  // Act reasoning
  parts.push(`Act ${act}:`)
  if (signals.totalSceneCount <= 3) {
    parts.push('very early in the script')
  } else if (act === 'I') {
    parts.push(`${signals.totalSceneCount} scenes in, still establishing`)
  } else {
    parts.push(`${signals.totalSceneCount} scenes deep`)
  }

  // Phase reasoning
  switch (phase) {
    case 'setup':
      parts.push(`${phase} phase (${signals.charactersIntroducedCount} characters introduced)`)
      break
    case 'escalation':
      parts.push(`${phase} phase (conflict ${signals.conflictEstablished ? 'active' : 'building'})`)
      break
    case 'transition':
      parts.push(`${phase} phase (breathing room between beats)`)
      break
    default:
      parts.push(`${phase} phase`)
  }

  // Focus reasoning
  switch (focus) {
    case 'world-building':
      parts.push('focus: establishing the world')
      break
    case 'supporting-cast':
      parts.push(`focus: supporting cast (${signals.charactersInCurrentScene} characters present, lead ${signals.leadInCurrentScene ? 'present' : 'absent'})`)
      break
    case 'lead-driven':
      parts.push('focus: lead character driving the scene')
      break
    default:
      parts.push(`focus: ${focus}`)
  }

  return parts.join(' | ')
}

// =============================================================================
// SINGLETON
// =============================================================================

// The classifier is stateless - just export the functions directly.
// No singleton needed since there's no state to maintain.
