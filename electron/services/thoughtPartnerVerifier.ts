/**
 * Thought Partner Pipeline — Local Verifier
 *
 * Validates patch lists against the edit plan and current document state.
 * All checks are local (no API call). Returns pass/fail with detailed
 * rule results and optional repair instructions for retry.
 */

import type {
  PatchList,
  PatchOp,
  EditPlan,
  DocumentBlockContext,
  VerifyResult,
  VerifyRule,
  StructuredPlan,
} from '../../shared/thoughtPartnerPipelineTypes'
import {
  VALID_SCREENPLAY_ELEMENT_TYPES,
  DEFAULT_VERIFY_LIMITS,
} from '../../shared/thoughtPartnerPipelineTypes'
import type { WorkingSet } from '../../shared/contextGatherTypes'
import { generateAnchorHash } from '../../src/utils/blockAnchoring'

/**
 * Verify a patch list against the edit plan and document state.
 * If a workingSet is provided, also verifies that all patch operations
 * cite valid span IDs from the working set.
 */
export function verifyPatch(
  patchList: PatchList,
  editPlan: EditPlan,
  blockContext: DocumentBlockContext,
  templateType: string,
  workingSet?: WorkingSet,
  selectionBlockIds?: string[],
  structuredPlan?: StructuredPlan
): VerifyResult {
  const rules: VerifyRule[] = []

  const maxChars = DEFAULT_VERIFY_LIMITS.maxCharsChanged
  const maxBlocks = DEFAULT_VERIFY_LIMITS.maxBlocksTouched

  // Build a lookup of current blocks
  const blockMap = new Map(
    blockContext.blocks.map((b) => [b.blockId, b])
  )

  // Rule 1: scope_check — all ops target blocks within declared scope
  rules.push(checkScope(patchList, editPlan, selectionBlockIds))

  // Rule 2: max_chars — total change size within limit
  rules.push(checkMaxChars(patchList, maxChars))

  // Rule 3: max_blocks — blocks touched within plan limit
  rules.push(checkMaxBlocks(patchList, editPlan, maxBlocks))

  // Rule 4: hash_match — anchor hashes match current document
  rules.push(checkHashMatch(patchList, blockMap))

  // Rule 5: block_exists — anchor blockIds exist in document
  rules.push(checkBlockExists(patchList, blockMap))

  // Rule 6: content_present — insert/replace ops have content
  rules.push(checkContentPresent(patchList))

  // Rule 7: format_valid — screenplay elements have valid types
  if (templateType === 'screenplay') {
    rules.push(checkScreenplayFormat(patchList))
  }

  // Rule 8: no_orphan_heading — heading replacement has following content
  rules.push(checkNoOrphanHeading(patchList, blockMap))

  // Rule 9: citations — every op cites valid working set span IDs
  if (workingSet) {
    rules.push(checkCitations(patchList, workingSet))
  }

  // Rule 10: plan_scope_conformance — patches must target blocks declared in the plan
  if (structuredPlan) {
    rules.push(checkPlanScopeConformance(patchList, structuredPlan))
  }

  // Rule 11: acceptance_criteria_check — patch content should address plan criteria
  if (structuredPlan) {
    rules.push(checkAcceptanceCriteria(patchList, structuredPlan))
  }

  const allPassed = rules.every((r) => r.passed)

  return {
    status: allPassed ? 'pass' : 'fail',
    rules,
    repairInstructions: allPassed
      ? undefined
      : buildRepairInstructions(rules),
  }
}

// ===== Individual rule checks =====

function checkScope(
  patchList: PatchList,
  editPlan: EditPlan,
  selectionBlockIds?: string[]
): VerifyRule {
  if (editPlan.scope !== 'selection' || !selectionBlockIds) {
    return { name: 'scope_check', passed: true }
  }

  const selectionSet = new Set(selectionBlockIds)
  const outOfScope: string[] = []

  for (const op of patchList.ops) {
    if (op.anchor && !selectionSet.has(op.anchor.blockId)) {
      outOfScope.push(op.anchor.blockId)
    }
  }

  if (outOfScope.length === 0) {
    return { name: 'scope_check', passed: true }
  }

  return {
    name: 'scope_check',
    passed: false,
    message: `Operations target blocks outside the selection scope: ${outOfScope.join(', ')}. Remove these ops or change scope to "document".`,
  }
}

function checkMaxChars(patchList: PatchList, maxChars: number): VerifyRule {
  if (patchList.totalCharsChanged <= maxChars) {
    return { name: 'max_chars', passed: true }
  }

  return {
    name: 'max_chars',
    passed: false,
    message: `Total change is ${patchList.totalCharsChanged} chars, exceeding limit of ${maxChars}. Reduce the scope of changes.`,
  }
}

function checkMaxBlocks(
  patchList: PatchList,
  editPlan: EditPlan,
  hardMax: number
): VerifyRule {
  const planLimit = Math.min(editPlan.maxBlocksAffected, hardMax)

  if (patchList.totalBlocksTouched <= planLimit) {
    return { name: 'max_blocks', passed: true }
  }

  return {
    name: 'max_blocks',
    passed: false,
    message: `Touching ${patchList.totalBlocksTouched} blocks, but plan allows ${planLimit}. Reduce the number of operations.`,
  }
}

function checkHashMatch(
  patchList: PatchList,
  blockMap: Map<string, { blockId: string; textHash: string; text: string }>
): VerifyRule {
  const mismatches: string[] = []

  for (const op of patchList.ops) {
    if (!op.anchor) continue

    const block = blockMap.get(op.anchor.blockId)
    if (!block) continue // block_exists check handles missing blocks

    // Verify the hash matches
    const currentHash = block.textHash
    if (op.anchor.originalTextHash !== currentHash) {
      // Double-check by re-computing the hash from the snapshot
      const snapshotHash = generateAnchorHash(op.anchor.textSnapshot)
      if (snapshotHash !== currentHash) {
        mismatches.push(op.anchor.blockId)
      }
    }
  }

  if (mismatches.length === 0) {
    return { name: 'hash_match', passed: true }
  }

  return {
    name: 'hash_match',
    passed: false,
    message: `Block text has changed since reading for blocks: ${mismatches.join(', ')}. Re-read these blocks and produce updated patches.`,
  }
}

function checkBlockExists(
  patchList: PatchList,
  blockMap: Map<string, { blockId: string }>
): VerifyRule {
  const missing: string[] = []

  for (const op of patchList.ops) {
    if (op.anchor && !blockMap.has(op.anchor.blockId)) {
      missing.push(op.anchor.blockId)
    }
  }

  if (missing.length === 0) {
    return { name: 'block_exists', passed: true }
  }

  return {
    name: 'block_exists',
    passed: false,
    message: `Block IDs not found in document: ${missing.join(', ')}. Use valid blockIds from the document context.`,
  }
}

function checkContentPresent(patchList: PatchList): VerifyRule {
  const empty: string[] = []

  for (const op of patchList.ops) {
    if (op.type === 'delete') continue

    const hasText = op.content && op.content.trim().length > 0
    const hasElements =
      op.screenplayElements && op.screenplayElements.length > 0

    if (!hasText && !hasElements) {
      empty.push(op.id)
    }
  }

  if (empty.length === 0) {
    return { name: 'content_present', passed: true }
  }

  return {
    name: 'content_present',
    passed: false,
    message: `Operations have no content: ${empty.join(', ')}. Add replacement text or screenplayElements.`,
  }
}

function checkScreenplayFormat(patchList: PatchList): VerifyRule {
  const validTypes = new Set(VALID_SCREENPLAY_ELEMENT_TYPES as readonly string[])
  const invalid: string[] = []

  for (const op of patchList.ops) {
    if (!op.screenplayElements) continue

    for (const el of op.screenplayElements) {
      if (!validTypes.has(el.type)) {
        invalid.push(`${op.id}:${el.type}`)
      }
    }
  }

  if (invalid.length === 0) {
    return { name: 'format_valid', passed: true }
  }

  return {
    name: 'format_valid',
    passed: false,
    message: `Invalid screenplay element types: ${invalid.join(', ')}. Valid types: ${Array.from(validTypes).join(', ')}.`,
  }
}

function checkNoOrphanHeading(
  patchList: PatchList,
  blockMap: Map<string, { blockId: string; type: string }>
): VerifyRule {
  const orphans: string[] = []

  for (const op of patchList.ops) {
    if (op.type !== 'delete' || !op.anchor) continue

    const block = blockMap.get(op.anchor.blockId)
    if (block && block.type === 'heading') {
      // Deleting a heading — check if we're also deleting or replacing its content
      // This is a heuristic: if the heading is being deleted without content following it,
      // it might leave orphan structure
      orphans.push(op.anchor.blockId)
    }
  }

  if (orphans.length === 0) {
    return { name: 'no_orphan_heading', passed: true }
  }

  return {
    name: 'no_orphan_heading',
    passed: false,
    message: `Deleting heading blocks may leave orphan structure: ${orphans.join(', ')}. Consider deleting or replacing the section content as well.`,
  }
}

function checkCitations(
  patchList: PatchList,
  workingSet: WorkingSet
): VerifyRule {
  const validSpanIds = new Set(workingSet.entries.map(e => e.spanId))
  const uncited: string[] = []
  const invalidCitations: string[] = []

  for (const op of patchList.ops) {
    if (!op.sourceSpanIds || op.sourceSpanIds.length === 0) {
      uncited.push(op.id)
      continue
    }

    for (const spanId of op.sourceSpanIds) {
      if (!validSpanIds.has(spanId)) {
        invalidCitations.push(`${op.id} cites unknown span "${spanId}"`)
      }
    }
  }

  if (uncited.length === 0 && invalidCitations.length === 0) {
    return { name: 'citations', passed: true }
  }

  const messages: string[] = []
  if (uncited.length > 0) {
    messages.push(`Operations without citations: ${uncited.join(', ')}`)
  }
  if (invalidCitations.length > 0) {
    messages.push(`Invalid citations: ${invalidCitations.join('; ')}`)
  }

  return {
    name: 'citations',
    passed: false,
    message: messages.join('. ') +
      '. Every operation must include at least one valid sourceSpanIds entry from the working set.',
  }
}

function checkPlanScopeConformance(
  patchList: PatchList,
  plan: StructuredPlan
): VerifyRule {
  const declaredBlockIds = new Set(
    plan.steps.flatMap(s => s.targetBlockIds || [])
  )

  // If the plan declares no target blocks (all new content), pass
  if (declaredBlockIds.size === 0) {
    return { name: 'plan_scope_conformance', passed: true }
  }

  const violations: string[] = []
  for (const op of patchList.ops) {
    if (!op.anchor) continue
    // Inserts adjacent to declared blocks are OK
    if (op.type === 'insert') continue
    // Replace/delete must target declared blocks
    if (!declaredBlockIds.has(op.anchor.blockId)) {
      violations.push(op.anchor.blockId)
    }
  }

  if (violations.length === 0) {
    return { name: 'plan_scope_conformance', passed: true }
  }

  return {
    name: 'plan_scope_conformance',
    passed: false,
    message: `Patch modifies blocks not declared in the approved plan: ${violations.join(', ')}. ` +
      `Only blocks listed in plan steps may be modified: ${Array.from(declaredBlockIds).join(', ')}.`,
  }
}

function checkAcceptanceCriteria(
  patchList: PatchList,
  plan: StructuredPlan
): VerifyRule {
  if (plan.acceptanceCriteria.length === 0) {
    return { name: 'acceptance_criteria_check', passed: true }
  }

  // Concatenate all patch content for keyword matching
  const allPatchContent = patchList.ops
    .map(op => op.content || '')
    .join(' ')
    .toLowerCase()

  const allPatchScreenplay = patchList.ops
    .flatMap(op => op.screenplayElements || [])
    .map(el => el.text)
    .join(' ')
    .toLowerCase()

  const combinedContent = allPatchContent + ' ' + allPatchScreenplay

  const unaddressed: string[] = []
  for (const criterion of plan.acceptanceCriteria) {
    // Extract significant words (4+ chars) from criterion
    const keywords = criterion.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 4)
      .slice(0, 5)

    // Check if at least one keyword appears in patch content
    const hasMatch = keywords.some(kw => combinedContent.includes(kw))
    if (!hasMatch && keywords.length > 0) {
      unaddressed.push(criterion)
    }
  }

  if (unaddressed.length === 0) {
    return { name: 'acceptance_criteria_check', passed: true }
  }

  // Soft fail: only fail if majority of criteria appear unaddressed
  return {
    name: 'acceptance_criteria_check',
    passed: unaddressed.length <= plan.acceptanceCriteria.length / 2,
    message: `These acceptance criteria may not be addressed by the patches: ${unaddressed.map(u => `"${u}"`).join(', ')}. ` +
      `Ensure the patch content satisfies all criteria from the approved plan.`,
  }
}

// ===== Repair instructions builder =====

function buildRepairInstructions(rules: VerifyRule[]): string {
  const failures = rules.filter((r) => !r.passed)
  if (failures.length === 0) return ''

  const lines = failures.map(
    (r) => `[${r.name}] ${r.message}`
  )

  return `The following verification rules failed. Fix these issues and try again:\n\n${lines.join('\n\n')}`
}
