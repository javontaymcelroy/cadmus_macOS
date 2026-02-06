/**
 * Character Eligibility Service
 * 
 * Derives character eligibility at request time based on scene state
 * and usage history. Characters are NOT simply "available" - they have
 * nuanced eligibility states that control how the AI can use them.
 * 
 * Key principle: eligibility is DERIVED, not stored. A lead character
 * might exist in the bank but be ineligible because their entrance
 * would collapse tension or pacing.
 */

import type {
  SceneState,
  CharacterEligibility,
  CharacterUsageHistory,
  EligibilityStatus
} from '../../shared/sceneStateTypes'
import type { CharacterInfo, SceneContext } from '../../shared/aiWritingTypes'

// =============================================================================
// USAGE HISTORY EXTRACTION
// =============================================================================

/**
 * Build character usage history from script content.
 * This scans the script to determine how each character has been used.
 */
export function buildCharacterUsageHistory(
  scriptContext: string,
  characters: CharacterInfo[]
): CharacterUsageHistory[] {
  const history: CharacterUsageHistory[] = []

  // Split script into scenes
  const scenePattern = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+.+$/gm
  const scenes: { heading: string; content: string; sceneNumber: number }[] = []

  let lastIdx = 0
  let sceneNum = 0
  let match: RegExpExecArray | null
  const scenePatternCopy = new RegExp(scenePattern.source, scenePattern.flags)

  while ((match = scenePatternCopy.exec(scriptContext)) !== null) {
    if (sceneNum > 0) {
      scenes[sceneNum - 1].content = scriptContext.slice(lastIdx, match.index)
    }
    sceneNum++
    scenes.push({
      heading: match[0],
      content: '',
      sceneNumber: sceneNum
    })
    lastIdx = match.index + match[0].length
  }

  // Capture content of the last scene
  if (scenes.length > 0) {
    scenes[scenes.length - 1].content = scriptContext.slice(lastIdx)
  }

  // If no scene headings found, treat entire context as scene 1
  if (scenes.length === 0) {
    scenes.push({
      heading: '',
      content: scriptContext,
      sceneNumber: 1
    })
  }

  for (const char of characters) {
    const charNameUpper = char.name.toUpperCase()

    // Track which scenes this character appears in
    const appearsInScenes: number[] = []
    let dialogueLineCount = 0
    let hasBeenIntroduced = false
    let firstAppearanceScene = -1

    for (const scene of scenes) {
      const sceneText = scene.content

      // Check for character name in dialogue headers (uppercase alone on a line)
      // Pattern: line starts with the character name (possibly with parenthetical)
      const dialogueHeaderPattern = new RegExp(
        `^\\s*${escapeRegExp(charNameUpper)}\\s*(?:\\(.*?\\))?\\s*$`,
        'gm'
      )
      const dialogueMatches = sceneText.match(dialogueHeaderPattern)

      if (dialogueMatches) {
        dialogueLineCount += dialogueMatches.length
        if (!appearsInScenes.includes(scene.sceneNumber)) {
          appearsInScenes.push(scene.sceneNumber)
        }
        if (firstAppearanceScene === -1) {
          firstAppearanceScene = scene.sceneNumber
        }
      }

      // Check for character name in action lines (could be formal introduction)
      // Formal introduction: ALL CAPS name followed by comma and description
      const introPattern = new RegExp(
        `(?:^|[.\\n]\\s*)${escapeRegExp(charNameUpper)}\\s*(?:\\([^)]+\\))?,\\s*`,
        'gm'
      )
      if (introPattern.test(sceneText)) {
        hasBeenIntroduced = true
        if (!appearsInScenes.includes(scene.sceneNumber)) {
          appearsInScenes.push(scene.sceneNumber)
        }
        if (firstAppearanceScene === -1) {
          firstAppearanceScene = scene.sceneNumber
        }
      }

      // Also check for plain mention in action lines
      const mentionPattern = new RegExp(`\\b${escapeRegExp(charNameUpper)}\\b`, 'g')
      if (mentionPattern.test(sceneText.toUpperCase())) {
        if (!appearsInScenes.includes(scene.sceneNumber)) {
          appearsInScenes.push(scene.sceneNumber)
        }
        if (firstAppearanceScene === -1) {
          firstAppearanceScene = scene.sceneNumber
        }
      }
    }

    history.push({
      characterId: char.id,
      name: char.name,
      appearsInScenes: appearsInScenes.sort((a, b) => a - b),
      isLead: false, // Will be determined below
      dialogueLineCount,
      hasBeenIntroduced,
      firstAppearanceScene: firstAppearanceScene === -1 ? 999 : firstAppearanceScene
    })
  }

  // Determine lead character
  markLeadCharacter(history)

  return history
}

/**
 * Mark the most likely lead character in the usage history.
 */
function markLeadCharacter(history: CharacterUsageHistory[]): void {
  if (history.length === 0) return

  // Score each character
  const scored = history.map(char => {
    let score = 0
    score += char.dialogueLineCount * 2
    score += char.appearsInScenes.length
    if (char.firstAppearanceScene <= 2) score += 5
    if (char.hasBeenIntroduced) score += 3
    return { char, score }
  })

  scored.sort((a, b) => b.score - a.score)

  // Only mark as lead if they clearly lead (1.3x the next character)
  if (scored.length === 1 || scored[0].score > scored[1].score * 1.3) {
    scored[0].char.isLead = true
  }
}

// =============================================================================
// ELIGIBILITY DERIVATION
// =============================================================================

/**
 * Derive character eligibility for all characters based on the current scene state.
 * This is the core function - it decides WHO can appear and HOW.
 */
export function deriveCharacterEligibility(
  sceneState: SceneState,
  characters: CharacterInfo[],
  usageHistory: CharacterUsageHistory[],
  sceneContext: SceneContext | undefined
): CharacterEligibility[] {
  const eligibility: CharacterEligibility[] = []
  const totalScenes = sceneState.signals.totalSceneCount
  const charactersInScene = (sceneContext?.charactersInScene || []).map(n => n.toUpperCase())

  for (const char of characters) {
    const usage = usageHistory.find(u => u.characterId === char.id)
    const isInCurrentScene = charactersInScene.some(
      name => name === char.name.toUpperCase()
    )
    const isLead = usage?.isLead || false
    const sceneAppearanceCount = usage?.appearsInScenes.length || 0
    const lastScene = usage?.appearsInScenes.length
      ? Math.max(...usage.appearsInScenes)
      : 0
    const scenesSinceLastAppearance = totalScenes - lastScene

    // Determine eligibility status
    const { status, reason, constraints } = determineEligibility(
      char,
      isLead,
      isInCurrentScene,
      sceneState,
      sceneAppearanceCount,
      scenesSinceLastAppearance,
      totalScenes,
      usage
    )

    eligibility.push({
      characterId: char.id,
      name: char.name,
      status,
      reason,
      constraints,
      isLead,
      sceneAppearanceCount,
      scenesSinceLastAppearance
    })
  }

  return eligibility
}

/**
 * Determine eligibility for a single character.
 */
function determineEligibility(
  char: CharacterInfo,
  isLead: boolean,
  isInCurrentScene: boolean,
  sceneState: SceneState,
  sceneAppearanceCount: number,
  scenesSinceLastAppearance: number,
  totalScenes: number,
  usage: CharacterUsageHistory | undefined
): { status: EligibilityStatus; reason: string; constraints?: string[] } {
  const { act, phase, focus, exclusions } = sceneState

  // Check if there's a hard exclusion for this character
  const charExcluded = exclusions.some(
    e => e.type === 'character' &&
      (e.target === char.name ||
       (e.target === 'lead/protagonist' && isLead))
  )

  if (charExcluded) {
    const exclusionReason = exclusions.find(
      e => e.type === 'character' &&
        (e.target === char.name || (e.target === 'lead/protagonist' && isLead))
    )
    return {
      status: 'excluded',
      reason: exclusionReason?.reason || 'Excluded by scene state constraints'
    }
  }

  // === CHARACTER IS ALREADY IN THE SCENE ===
  if (isInCurrentScene) {
    // If they're in the scene, they're at least present

    // But should they drive action?
    // If focus is supporting-cast and this is the lead, make them passive
    if (isLead && focus === 'supporting-cast') {
      return {
        status: 'present-passive',
        reason: 'Lead is present but this is a supporting cast scene - let others drive',
        constraints: ['only reactive', 'no new dialogue initiatives', 'background presence']
      }
    }

    // If this character just had a long stretch of scenes, dial them back
    if (sceneAppearanceCount > totalScenes * 0.6 && !isLead) {
      return {
        status: 'present-passive',
        reason: `Character appears in ${sceneAppearanceCount}/${totalScenes} scenes - risk of overuse`,
        constraints: ['reduced dialogue', 'reactive only']
      }
    }

    // Fully eligible
    return {
      status: 'eligible',
      reason: 'Character is in the current scene and eligible to act'
    }
  }

  // === CHARACTER IS NOT IN THE CURRENT SCENE ===

  // Lead character entrance protection in Act I setup
  if (isLead && act === 'I' && phase === 'setup') {
    if (!usage?.hasBeenIntroduced) {
      return {
        status: 'available-delayed',
        reason: 'Lead character entrance is being protected - establish world first',
        constraints: ['do not introduce yet']
      }
    }
  }

  // Lead character who hasn't appeared in a while - don't force them back
  if (isLead && scenesSinceLastAppearance <= 1) {
    return {
      status: 'available-delayed',
      reason: 'Lead just appeared - give the scene room to develop other elements',
      constraints: ['let other characters breathe']
    }
  }

  // Character whose arc needs space
  if (scenesSinceLastAppearance <= 0 && sceneAppearanceCount >= 3) {
    return {
      status: 'available-delayed',
      reason: 'Character appeared recently - let tension build before their return',
      constraints: ['delay entrance']
    }
  }

  // Non-introduced character in setup phase can be brought in
  if (phase === 'setup' && !isLead) {
    return {
      status: 'eligible',
      reason: 'Supporting character available for introduction during setup'
    }
  }

  // Default: character can enter if nothing prevents it
  if (phase === 'escalation' || phase === 'climax') {
    return {
      status: 'eligible',
      reason: 'Character available for scene entrance'
    }
  }

  // During transition or release, new entrances should be delayed
  if (phase === 'transition' || phase === 'release') {
    return {
      status: 'available-delayed',
      reason: `${phase} phase: not the right moment for new character entrances`
    }
  }

  return {
    status: 'eligible',
    reason: 'Character available'
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
