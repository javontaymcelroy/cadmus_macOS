/**
 * Gated Writing Pipeline
 * 
 * Orchestrates the staged generation process:
 * 1. CLASSIFY - Label the current moment (act, phase, focus, exclusions)
 * 2. CONSTRAIN - Derive character eligibility and build constraint envelope
 * 3. GATE - Evaluate whether generation should proceed at all
 * 4. GENERATE - If gate passes, generate with hard constraints injected
 * 
 * The pipeline can decline to generate at any stage, returning guidance
 * to the writer instead. This is by design - the partner's job is to
 * protect the story from premature cleverness, including its own.
 */

import type {
  SceneState,
  CharacterEligibility,
  PipelineResult,
  GateEvaluation,
  ConstraintEnvelope,
  ContributionType,
  CharacterUsageHistory
} from '../../shared/sceneStateTypes'
import type { AIWritingRequest, AIWritingResponse, AIWritingCommand } from '../../shared/aiWritingTypes'
import type { StoryFacts } from './dramaticCritiqueService'
import { classifyFromContext } from './sceneStateClassifier'
import { deriveCharacterEligibility, buildCharacterUsageHistory } from './characterEligibility'
import { getAIWritingService } from './aiWritingService'

// =============================================================================
// PIPELINE ENTRY POINT
// =============================================================================

/**
 * Run the full gated writing pipeline.
 * 
 * @param request - The original AI writing request
 * @param storyFacts - Extracted story facts (from dramaticCritiqueService), if available
 * @param forceOverride - If true, skip gates and generate anyway (writer override)
 * @returns PipelineResult with full chain of reasoning
 */
export async function runGatedPipeline(
  request: AIWritingRequest,
  storyFacts?: StoryFacts,
  forceOverride: boolean = false
): Promise<PipelineResult> {
  console.log(`[GatedPipeline] Starting pipeline for command: ${request.command}`)

  // ============================================
  // STAGE 1: CLASSIFY
  // ============================================
  const usageHistory = buildCharacterUsageHistory(
    request.context,
    request.characters || []
  )

  const sceneState = classifyFromContext(
    request.context,
    request.sceneContext,
    storyFacts,
    usageHistory
  )

  console.log(`[GatedPipeline] Classification: Act ${sceneState.act} | ${sceneState.phase} | ${sceneState.focus} | confidence: ${sceneState.confidence.toFixed(2)}`)
  console.log(`[GatedPipeline] Exclusions: ${sceneState.exclusions.length}`)
  console.log(`[GatedPipeline] Allowed: ${sceneState.allowedContributions.join(', ')}`)

  // ============================================
  // STAGE 2: CONSTRAIN (derive eligibility)
  // ============================================
  const eligibility = deriveCharacterEligibility(
    sceneState,
    request.characters || [],
    usageHistory,
    request.sceneContext
  )

  const eligibleCount = eligibility.filter(e => e.status === 'eligible').length
  const excludedCount = eligibility.filter(e => e.status === 'excluded').length
  const passiveCount = eligibility.filter(e => e.status === 'present-passive').length
  const delayedCount = eligibility.filter(e => e.status === 'available-delayed').length

  console.log(`[GatedPipeline] Eligibility: ${eligibleCount} eligible, ${passiveCount} passive, ${delayedCount} delayed, ${excludedCount} excluded`)

  // ============================================
  // STAGE 3: GATE
  // ============================================
  if (!forceOverride) {
    const gateResult = evaluateGenerationGate(sceneState, request.command, eligibility)

    if (!gateResult.shouldGenerate) {
      console.log(`[GatedPipeline] Gate DECLINED: ${gateResult.reason}`)

      return {
        stage: 'declined',
        sceneState,
        eligibility,
        gatePassed: false,
        gateReason: gateResult.reason,
        suggestion: gateResult.suggestedAlternative
          ? `Consider using "${gateResult.suggestedAlternative}" instead`
          : undefined
      }
    }

    console.log(`[GatedPipeline] Gate PASSED: ${gateResult.reason}`)
  } else {
    console.log(`[GatedPipeline] Gate OVERRIDDEN by writer`)
  }

  // ============================================
  // STAGE 4: GENERATE with constraints
  // ============================================
  const constraintEnvelope = buildConstraintEnvelope(sceneState, eligibility)
  const constrainedRequest = applyConstraints(request, constraintEnvelope)

  console.log(`[GatedPipeline] Generating with ${constraintEnvelope.forbiddenActions.length} forbidden actions, ${constraintEnvelope.excludedCharacters.length} excluded characters`)

  const service = getAIWritingService()
  const generation = await service.generate(constrainedRequest)

  return {
    stage: 'generated',
    sceneState,
    eligibility,
    gatePassed: true,
    generation
  }
}

// =============================================================================
// GATE EVALUATION
// =============================================================================

/**
 * Evaluate whether the pipeline should proceed to generation.
 * This is the critical decision point.
 */
function evaluateGenerationGate(
  sceneState: SceneState,
  command: AIWritingCommand,
  eligibility: CharacterEligibility[]
): GateEvaluation {
  // Map commands to the contribution types they represent
  const commandToContribution: Record<string, ContributionType> = {
    'continue': 'action',
    'dialogue': 'dialogue',
    'setting': 'texture',
    'expand': 'action',
    'pov': 'action',
    'negativeSpace': 'negativeSpace',
    // Revision commands are always allowed (they work on existing text)
    'rework': 'action',
    'adjustTone': 'texture',
    'shorten': 'texture',
    'clearer': 'texture',
    'elaborate': 'texture',
    'tension': 'tension',
    'soften': 'texture',
    'imagery': 'texture',
    'pacing': 'texture',
    'voice': 'texture',
    'contradiction': 'question'
  }

  // Revision commands always pass - they work on existing text, not generating new narrative
  const revisionCommands: AIWritingCommand[] = [
    'rework', 'adjustTone', 'shorten', 'clearer', 'elaborate',
    'soften', 'imagery', 'pacing', 'voice', 'contradiction'
  ]

  if (revisionCommands.includes(command)) {
    return {
      shouldGenerate: true,
      reason: 'Revision commands always pass - they refine existing text'
    }
  }

  const contributionType = commandToContribution[command] || 'action'

  // Check if this contribution type is allowed
  if (!sceneState.allowedContributions.includes(contributionType)) {
    // Find what IS allowed
    const allowed = sceneState.allowedContributions.filter(c => c !== 'question' && c !== 'none')
    const suggestedAlternative = allowed.length > 0 ? allowed[0] : 'question'

    return {
      shouldGenerate: false,
      reason: `"${command}" maps to "${contributionType}" which is not allowed in the current ${sceneState.phase} phase (${sceneState.focus} focus). ${sceneState.reasoning}`,
      suggestedAlternative
    }
  }

  // Check if dialogue/action commands have eligible characters
  if (['dialogue', 'continue', 'expand', 'pov'].includes(command)) {
    const eligibleChars = eligibility.filter(e =>
      e.status === 'eligible' || e.status === 'present-passive'
    )

    if (eligibleChars.length === 0 && eligibility.length > 0) {
      return {
        shouldGenerate: false,
        reason: 'No characters are eligible to drive this scene right now. All characters are either excluded or delayed.',
        suggestedAlternative: 'texture'
      }
    }
  }

  // Check for tension command during release phase
  if (command === 'tension' && sceneState.phase === 'release') {
    return {
      shouldGenerate: false,
      reason: 'The story is in a release phase - adding tension would undercut the resolution.',
      suggestedAlternative: 'negativeSpace'
    }
  }

  return {
    shouldGenerate: true,
    reason: `"${command}" is appropriate for ${sceneState.phase} phase with ${sceneState.focus} focus`
  }
}

// =============================================================================
// CONSTRAINT ENVELOPE BUILDING
// =============================================================================

/**
 * Build the constraint envelope from scene state and eligibility.
 * This is what gets passed to the generation step.
 */
function buildConstraintEnvelope(
  sceneState: SceneState,
  eligibility: CharacterEligibility[]
): ConstraintEnvelope {
  const excludedCharacters = eligibility
    .filter(e => e.status === 'excluded')
    .map(e => e.name)

  const passiveCharacters = eligibility
    .filter(e => e.status === 'present-passive')
    .map(e => e.name)

  const eligibleCharacters = eligibility
    .filter(e => e.status === 'eligible')
    .map(e => ({
      name: e.name,
      constraints: e.constraints
    }))

  const forbiddenActions = sceneState.exclusions
    .filter(e => e.type === 'action' || e.type === 'resolution' || e.type === 'revelation')
    .map(e => {
      let action = e.type
      if (e.target) action += `: ${e.target}`
      action += ` (${e.reason})`
      return action
    })

  const sceneStateSummary = [
    `Act ${sceneState.act}`,
    `${sceneState.phase} phase`,
    `${sceneState.focus} focus`,
    sceneState.reasoning
  ].join(' | ')

  return {
    excludedCharacters,
    passiveCharacters,
    eligibleCharacters,
    forbiddenActions,
    allowedContributions: sceneState.allowedContributions,
    sceneStateSummary
  }
}

// =============================================================================
// CONSTRAINT APPLICATION
// =============================================================================

/**
 * Apply constraints to the AI writing request.
 * This modifies the request to inject hard constraints that the AI must obey.
 */
function applyConstraints(
  request: AIWritingRequest,
  envelope: ConstraintEnvelope
): AIWritingRequest {
  // Build the constraint section that gets prepended to context
  const constraintSection = buildConstraintPromptSection(envelope)

  // Filter out excluded characters from the character list
  const filteredCharacters = (request.characters || []).filter(
    c => !envelope.excludedCharacters.some(
      excluded => excluded.toUpperCase() === c.name.toUpperCase()
    )
  )

  return {
    ...request,
    // Prepend constraint section to the context
    context: constraintSection + '\n\n' + request.context,
    // Only pass eligible + passive characters
    characters: filteredCharacters,
    // Store the constraint envelope in supplementary context
    supplementaryContext: {
      ...request.supplementaryContext,
      otherNotes: [
        ...(request.supplementaryContext?.otherNotes || []),
        {
          title: 'SCENE STATE CONSTRAINTS (SYSTEM-ENFORCED)',
          content: constraintSection
        }
      ]
    }
  }
}

/**
 * Build the constraint section for the AI prompt.
 * These are injected as hard rules, not suggestions.
 */
function buildConstraintPromptSection(envelope: ConstraintEnvelope): string {
  const lines: string[] = []

  lines.push('=== SCENE STATE (SYSTEM-ENFORCED CONSTRAINTS) ===')
  lines.push(envelope.sceneStateSummary)
  lines.push('')

  // Hard forbidden actions
  if (envelope.forbiddenActions.length > 0) {
    lines.push('FORBIDDEN (you MUST NOT do any of these):')
    for (const action of envelope.forbiddenActions) {
      lines.push(`  - ${action}`)
    }
    lines.push('')
  }

  // Excluded characters
  if (envelope.excludedCharacters.length > 0) {
    lines.push(`DO NOT USE THESE CHARACTERS: ${envelope.excludedCharacters.join(', ')}`)
    lines.push('They are excluded from this scene beat for pacing/structural reasons.')
    lines.push('')
  }

  // Passive characters
  if (envelope.passiveCharacters.length > 0) {
    lines.push(`THESE CHARACTERS ARE PRESENT BUT MUST NOT DRIVE ACTION: ${envelope.passiveCharacters.join(', ')}`)
    lines.push('They can react, be background, or be mentioned - but should not initiate new beats.')
    lines.push('')
  }

  // Eligible characters with constraints
  if (envelope.eligibleCharacters.length > 0) {
    const constrained = envelope.eligibleCharacters.filter(c => c.constraints?.length)
    if (constrained.length > 0) {
      lines.push('CHARACTER CONSTRAINTS:')
      for (const c of constrained) {
        lines.push(`  - ${c.name}: ${c.constraints!.join(', ')}`)
      }
      lines.push('')
    }
  }

  // Allowed contribution types
  lines.push(`ALLOWED CONTRIBUTION TYPES: ${envelope.allowedContributions.join(', ')}`)
  lines.push('Your output should align with these contribution types.')
  lines.push('')
  lines.push('=== END SCENE STATE CONSTRAINTS ===')

  return lines.join('\n')
}

// =============================================================================
// SINGLETON
// =============================================================================

// Pipeline is stateless - just export the functions.
// The AIWritingService singleton is obtained inside runGatedPipeline.
