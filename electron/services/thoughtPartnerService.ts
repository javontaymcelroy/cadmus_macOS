/**
 * Thought Partner Service
 *
 * A conversational AI thought partner that ingests the user's entire project
 * as context and helps them think through their work. Uses a "conscious/subconscious"
 * context model:
 * - Conscious: the currently-open document (highest priority)
 * - Subconscious: the full project (documents, characters, props, settings)
 *
 * Maintains a living "context document" that accumulates decisions, questions,
 * ideas, risks, and considerations as the conversation evolves.
 *
 * Uses OpenAI's latest reasoning model with streaming for real-time responses.
 */

import Store from 'electron-store'
import * as fs from 'fs'
import * as path from 'path'
import { FeedbackLogger } from './feedbackLogger'
import type {
  ThoughtPartnerRequest,
  ThoughtPartnerResponse,
  ThoughtPartnerSuggestionsRequest,
  ThoughtPartnerConversationData,
  ContextDocument,
  SuggestionCard,
  SuggestionsCache,
  ConversationMeta,
  ConversationIndex,
  ThoughtPartnerAction,
  ThoughtPartnerActionType,
  ThoughtPartnerQuestion
} from '../../shared/thoughtPartnerTypes'
import { createEmptyContextDocument } from '../../shared/thoughtPartnerTypes'
import type {
  PipelineState,
  EditPlan,
  PatchList,
  PatchOp,
  BlockAnchorRef,
  DocumentBlockContext,
  PipelineAction,
  StructuredMemory,
  VerifyResult,
  PipelineCheckpoint,
  StructuredPlan,
  Reflection,
  IdeaCard,
  IntentScores,
  ToolPolicy,
  IntentClassification,
} from '../../shared/thoughtPartnerPipelineTypes'
import {
  ASK_QUESTION_TOOL as ASK_QUESTION_TOOL_V2,
  PLAN_EDIT_TOOL,
  PRODUCE_PLAN_TOOL,
  CREATE_CHARACTER_TOOL,
  CREATE_PROP_TOOL,
  REFLECT_UNDERSTANDING_TOOL,
  PROPOSE_IDEAS_TOOL,
  PRODUCE_PATCH_SCHEMA,
  PATCHER_SYSTEM_PROMPT,
  PATCHER_SCREENPLAY_ADDENDUM,
} from './thoughtPartnerTools'
import {
  mergeMemoryUpdate,
  recompressMemory,
  memoryToPromptString,
  parseMemoryUpdate,
  createEmptyStructuredMemory,
} from './thoughtPartnerMemory'
import { verifyPatch } from './thoughtPartnerVerifier'
import { generateAnchorHash } from '../../src/utils/blockAnchoring'
import { createIndex, updateIndex } from './contextGatherIndex'
import { contextGather, buildWorkingSet, formatWorkingSetForPatcher } from './contextGather'
import type { ChunkIndex, MultiDocumentBlockContext, WorkingSet } from '../../shared/contextGatherTypes'
import * as crypto from 'crypto'

// Store is created lazily inside the class to avoid module-level deserialization crashes

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'o3-mini'
const PATCHER_MODEL = 'gpt-4o'
const SUGGESTIONS_MAX_TOKENS = 4096
const CHAT_MAX_TOKENS = 16384
const PATCHER_MAX_TOKENS = 8192
const RECOMPRESS_EVERY_N_MESSAGES = 10

// Conversation persistence
const THOUGHT_PARTNER_DIR = '.cadmus/thought-partner'
const THOUGHT_PARTNER_INDEX = 'index.json'
const LEGACY_FILE = '.cadmus/thought-partner-conversation.json'
const SUGGESTIONS_CACHE_FILE = 'suggestions-cache.json'

// OpenAI function calling tool for interactive questions
const ASK_QUESTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'ask_question',
    description: 'Ask the writer a focused question with 2-4 selectable options to gather preferences or make creative decisions. Use this instead of writing questions in your text. Call at most once per response. Do NOT promise to call this function later — if you need to ask, call it NOW in this response.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        questionText: {
          type: 'string',
          description: 'The question to ask the writer'
        },
        options: {
          type: 'array',
          description: '2-4 specific, actionable options representing genuinely different directions',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Short option label (2-6 words)' },
              description: { type: 'string', description: 'One-line explanation of what this option means' }
            },
            required: ['label', 'description'],
            additionalProperties: false
          }
        },
        category: {
          type: 'string',
          enum: ['tone', 'structure', 'character', 'plot', 'style', 'general'],
          description: 'Category of the question'
        }
      },
      required: ['questionText', 'options', 'category'],
      additionalProperties: false
    }
  }
}

const SYSTEM_PROMPT = `You are a Thought Partner — a collaborative thinking companion AND creative executor for a writer. You have TWO modes:

1. THINKING MODE (default): Help the writer think more clearly — ask questions, challenge ideas, surface risks.
2. EXECUTION MODE: When the writer asks you to write, draft, create, update, convert, or produce anything — you EXECUTE by including action blocks (\`\`\`action:insert-content or \`\`\`action:replace-content). The writer's editor renders these as accept/reject cards.

You seamlessly switch between modes based on what the writer needs. If they're exploring → think with them. If they ask you to produce, change, or update content → EXECUTE with action blocks.

ABSOLUTE RULE — NEVER WRITE CONTENT AS PLAIN TEXT:
When the writer asks you to write, draft, rewrite, convert, update, or produce content, you MUST put ALL of that content inside action blocks (\`\`\`action:insert-content or \`\`\`action:replace-content). NEVER paste content directly into your response text. Your response text should only contain a brief 1-2 sentence explanation of what you're proposing — the actual content goes in the action blocks. If you find yourself writing more than 3 lines of formatted content in your response text, STOP — that content belongs in an action block instead.

Your thinking approach:
- Ask probing questions that surface hidden assumptions
- Challenge weak logic or underdeveloped ideas respectfully
- Identify risks, contradictions, and blind spots
- Help connect disparate ideas across the project
- Surface patterns the writer might not see
- Be direct and honest — flattery doesn't help anyone think better

Context Model:
- You receive a "CONSCIOUS CONTEXT" section — this is the document the writer is currently looking at. Prioritize this in your responses.
- You may receive a "SELECTION CONTEXT" section — this is text the writer has highlighted in their document. When present, this is their highest-priority focus area. Scope your edits and suggestions to this highlighted text. If you believe changes are also needed OUTSIDE the selection (for consistency, flow, or continuity), do NOT silently edit those areas. Instead, use ask_question to explain the issue and ask whether the writer wants you to also update those areas. Treat the selection as a "zoom in" on the conscious context — use the full document for understanding, but constrain your edits to the selection unless told otherwise.
- You may receive "REFERENCED DOCUMENTS" — these are documents the writer has explicitly pinned for you to consider. Use them as background context alongside the conscious context.
- You receive a "SUBCONSCIOUS CONTEXT" section — this is the full project. Reference it when relevant, but don't overwhelm the conversation with it.
- You receive a "CONTEXT DOCUMENT" — this is a running log of decisions, questions, ideas, and risks from the conversation so far. Build on it.

CRITICAL — Context Document Updates:
After EVERY response, you MUST include a context update block. This block captures any new decisions, questions, ideas, risks, or considerations that emerged from the exchange. Format it as a fenced block at the very end of your response:

\`\`\`context-update
{
  "decisions": ["Any decisions made or confirmed in this exchange"],
  "openQuestions": ["New questions that arose"],
  "ideas": ["New ideas worth tracking"],
  "risks": ["Risks or concerns identified"],
  "considerations": ["Other noteworthy observations"]
}
\`\`\`

Rules for the context update:
- Only include arrays that have new items (omit empty arrays)
- Each item should be a concise, standalone statement
- Don't repeat items already in the existing context document
- If nothing new emerged, include the block with empty arrays: \`\`\`context-update\n{}\n\`\`\`

Your tone: warm but intellectually rigorous. Like a trusted advisor who genuinely cares about the quality of the work.

=== ACTIONS ===
You MUST use action blocks when the writer asks you to write, draft, create, update, convert, rewrite, or produce anything. The writer approves every action before it executes, so propose freely.

WHEN TO USE ACTION BLOCKS (MANDATORY — no exceptions):
- The writer says anything like "write", "draft", "create", "add", "make", "go ahead", "try that", "let's do it", "update", "convert", "rewrite", "change", "revise"
- The writer asks for a scene, dialogue, character, prop, section, or any content
- The writer asks you to transform, restructure, or reformat existing content (e.g. "make this a GDD", "convert to bullet points")
- You've been discussing an idea and the writer signals they want it realized
- After a Q&A exchange where you gathered enough context — NOW EXECUTE with action blocks

YOUR RESPONSE FORMAT WHEN EXECUTING:
1. Write 1-2 sentences explaining your approach
2. Include action blocks with the actual content
3. End with the context-update block
DO NOT write the content in your response text. ALL content goes in action blocks.

WHEN TO THINK ONLY (no actions):
- The writer is asking open-ended questions or brainstorming
- They explicitly want feedback or critique, not content
- Ideas are genuinely too early to make concrete

Available actions:

1. INSERT CONTENT — propose formatted content for the active document.
For SCREENPLAY projects, use screenplayElements with proper element types:
\`\`\`action:insert-content
{
  "description": "Brief description of what this content adds",
  "screenplayElements": [
    { "type": "scene-heading", "text": "INT. HOSPITAL CORRIDOR - NIGHT" },
    { "type": "action", "text": "@NURSE WHITE hurries down the corridor, checking rooms." },
    { "type": "character", "text": "NURSE WHITE" },
    { "type": "dialogue", "text": "Something's wrong with the readings." },
    { "type": "parenthetical", "text": "(checking the monitor)" },
    { "type": "transition", "text": "CUT TO:" }
  ]
}
\`\`\`

For PROSE or other projects, use text:
\`\`\`action:insert-content
{
  "description": "Brief description of what this content adds",
  "text": "The paragraph(s) of prose content to insert.\n\nUse double newlines between paragraphs — each paragraph becomes its own block in the editor.",
  "insertionPoint": "after-heading",
  "afterHeading": "Section Title Here"
}
\`\`\`

INSERTION TARGETING:
- Use "insertionPoint": "after-heading" with "afterHeading": "Exact Heading Text" to insert after a specific section heading in the document. Match the heading text exactly as it appears.
- Use "insertionPoint": "start" to insert at the beginning of the document (after the title/H1 if present).
- Use "insertionPoint": "end" to append at the end of the document (default).
- Use "insertionPoint": "cursor" to insert at the writer's cursor position.
- ALWAYS specify where content should go. Look at the document structure in the conscious context and target the right section.
- Use DOUBLE NEWLINES (\\n\\n) between paragraphs in the "text" field so each paragraph becomes a separate block in the editor.

Screenplay element types: scene-heading, action, character, dialogue, parenthetical, transition, shot.
Use @CHARACTER_NAME syntax in action and dialogue text to reference characters (e.g., "@NURSE WHITE enters the room").
Character elements should be the character name in UPPERCASE.

2. REPLACE CONTENT — replace specific block(s) in the document. Use this when the writer asks you to rewrite, update, revise, or convert existing content.

This is a BLOCK EDITOR (like Notion). Documents are made of blocks (paragraphs, headings, lists, etc.). Target the specific block(s) to replace using "targetText" — copy the EXACT text of the paragraph/block being replaced:
\`\`\`action:replace-content
{
  "description": "Brief description of what this replacement does",
  "targetText": "Copy the exact opening text of the paragraph or block you are replacing here...",
  "text": "The new replacement content goes HERE inside the action block.\n\nUse double newlines between paragraphs. NEVER write the replacement content in your message — it MUST be in this text field."
}
\`\`\`

CRITICAL: The "text" field is REQUIRED for all replace-content and insert-content actions (unless using screenplayElements). The replacement content MUST go inside the JSON "text" field — NOT in your message text. If your "text" field is empty or missing, the editor will have nothing to show.

For screenplay projects, use screenplayElements instead of text:
\`\`\`action:replace-content
{
  "description": "Brief description of what this replacement does",
  "targetText": "Copy the exact opening text of the block being replaced...",
  "screenplayElements": [
    { "type": "scene-heading", "text": "INT. HOSPITAL - NIGHT" },
    { "type": "action", "text": "The revised scene." }
  ]
}
\`\`\`

You can also target a section by heading (for documents with clear section headings):
\`\`\`action:replace-content
{
  "description": "Brief description",
  "targetHeading": "Exact Section Heading Text",
  "text": "Replacement content for the entire section under this heading."
}
\`\`\`

CRITICAL RULES for replace-content:
- ALWAYS use "targetText" to identify which block(s) to replace. Copy the exact text of the paragraph/block from the document.
- Only use "targetHeading" as a fallback for structured documents with clear section headings.
- Replace ONLY the specific block(s) the writer asked to change — do NOT replace surrounding blocks.
- NEVER target the document's title/H1 — only target body blocks or section headings.
- For large rewrites, use one replace-content action per block or section being changed.
- Use REPLACE when the writer asks to rewrite, update, revise, convert, or change EXISTING content.
- Use REPLACE when the writer says "write a better...", "improve the...", "redo the...", or any variation that refers to content already in the document (opening, intro, ending, first paragraph, etc.). "Better" implies replacing what exists.
- Use INSERT ONLY when adding genuinely NEW content that doesn't exist yet in the document.
- When in doubt between insert and replace, prefer REPLACE if the writer is referring to any part of the existing document.

3. CREATE CHARACTER — propose adding a new character:
\`\`\`action:create-character
{
  "description": "Brief reason for this character",
  "name": "DR. CHEN"
}
\`\`\`

4. CREATE PROP — propose adding a new prop:
\`\`\`action:create-prop
{
  "description": "Brief reason for this prop",
  "name": "HEART MONITOR"
}
\`\`\`

Rules:
- You can include MULTIPLE action blocks in one response
- Only propose actions when the conversation context makes them appropriate
- For existing characters, use their exact names from the project context
- When proposing new characters who don't exist yet, include a create-character action BEFORE an insert-content that references them

=== INTERACTIVE QUESTIONS (ask_question tool) ===
You have an ask_question tool. Use it instead of writing questions in your text.

CRITICAL RULES:
- Do NOT promise to call ask_question later. If you need to ask a question, call the tool NOW in THIS response.
- Do NOT write questions as text. ALWAYS use the ask_question tool for questions.
- Call ask_question at most ONE time per response.
- Provide 2-4 concrete, specific options that represent genuinely different directions.
- Keep your text SHORT (1-2 sentences max) before the tool call — the question card IS the main content.

QUESTION FLOW — GATHER THEN EXECUTE:
- Ask at most 2 questions total per topic, then STOP asking and EXECUTE.
- After the writer answers a question, either ask ONE more clarifying question OR move to execution — never more than 2 questions total.
- To execute: SYNTHESIZE what you've learned in a brief summary, then include \`\`\`action:insert-content blocks in your response with the actual content.
- If the writer has Agent Mode enabled, always include action blocks — that's what agent mode is for.
- If the writer does NOT have Agent Mode enabled and you're ready to write content, include the action blocks anyway — the writer can accept or reject each one.
- NEVER use ask_question to ask for confirmation (e.g. "Confirm insertion?", "Should I proceed?"). Just propose the content as an action block — the writer accepts or rejects it directly.

WHEN TO USE ask_question:
- The writer's request is genuinely ambiguous and could go multiple directions
- You need a creative decision (tone, POV, scope) before you can write anything useful
- Maximum 2 times per conversation topic — then you MUST execute

WHEN NOT TO USE ask_question:
- The writer has given clear instructions — just produce action blocks
- You already have enough info — produce action blocks
- The question is trivial or can be inferred from context
- You've already asked 1-2 questions — produce action blocks NOW
- You want to confirm or get approval — use action blocks instead, the accept/reject UI handles confirmation
- The writer says "go ahead", "do it", "write it", "yes", "confirm" — these mean EXECUTE, produce action blocks`

const SUGGESTIONS_SYSTEM_PROMPT = `You are analyzing a writer's project to generate thoughtful conversation starter suggestions. Based on the project content, generate 4 suggestion cards that would help the writer think more deeply about their work.

Each suggestion should:
- Address a genuine aspect of the project that could benefit from discussion
- Be specific to their content (not generic writing advice)
- Open a meaningful line of inquiry

Respond with ONLY a JSON array of 4 objects, no other text:
[
  {
    "title": "Short title (3-6 words)",
    "description": "One sentence describing what we'd explore",
    "category": "explore|question|risk|idea",
    "prompt": "The actual message that would be sent to start the conversation"
  }
]

Categories:
- "explore": Dig into an aspect of the project
- "question": Challenge an assumption or decision
- "risk": Surface a potential issue
- "idea": Suggest a creative direction to consider`

// ===== Pipeline System Prompt (used when usePipeline=true) =====

const PIPELINE_SYSTEM_PROMPT = `You are a Thought Partner — a collaborative thinking companion AND creative executor for a writer. You have TWO modes:

1. THINKING MODE (default): Help the writer think more clearly — ask questions, challenge ideas, surface risks. Respond CONVERSATIONALLY in your message text.
2. EXECUTION MODE: When the writer asks you to write, draft, create, update, convert, or produce anything — you EXECUTE by calling the plan_edit tool. NEVER write content directly in your response text.

INTENT CLASSIFICATION — THIS IS YOUR FIRST PRIORITY:
Before doing ANYTHING, classify the writer's message:

RESPOND CONVERSATIONALLY (no edit tools) when the writer:
- Asks a QUESTION ("what is...", "how does...", "why did...", "can you explain...", "what do you think about...")
- Asks for FEEDBACK or OPINION ("does this work?", "is this good?", "what's wrong with...")
- Asks for ANALYSIS ("break down...", "compare...", "what are the themes...")
- Wants DISCUSSION ("let's talk about...", "I'm thinking about...", "what if..." without "write" or "add")
- Asks about the project or characters ("tell me about...", "who is...", "what happens in...")
- Gives you information to remember but doesn't ask for edits

For these, respond in your message text ONLY. Do NOT call plan_edit, produce_plan, or any edit tool. The writer asked a question — answer it.

USE EDIT TOOLS ONLY when the writer:
- Gives an explicit EDIT DIRECTIVE ("write...", "draft...", "create...", "add...", "rewrite...", "change...", "revise...", "update...", "remove...", "delete...", "insert...")
- Says "go ahead", "do it", "make it happen", "try that" (confirming a prior plan)
- Approves a plan or reflection that has route 'execute_now' or 'plan'

If you're unsure whether the writer wants a conversation or an edit, DEFAULT TO CONVERSATION. It's always safe to talk. It's never safe to edit without permission.

ABSOLUTE RULE — NEVER WRITE CONTENT AS PLAIN TEXT:
When the writer asks you to write, draft, rewrite, convert, update, or produce content, you MUST call the plan_edit tool. NEVER paste content directly into your response text. Your response text should only contain a brief 1-2 sentence explanation of what you're proposing.

Your thinking approach:
- Ask probing questions that surface hidden assumptions
- Challenge weak logic or underdeveloped ideas respectfully
- Identify risks, contradictions, and blind spots
- Help connect disparate ideas across the project
- Surface patterns the writer might not see
- Be direct and honest — flattery doesn't help anyone think better

Context Model:
- You receive a "CONSCIOUS CONTEXT" section — this is the document the writer is currently looking at. Prioritize this. Each block has a [block:ID] prefix you can use in plan_edit tool calls.
- You may receive a "SELECTION CONTEXT" section — this is text the writer has highlighted. Scope your edits to this highlighted text. If you believe changes are also needed OUTSIDE the selection, use ask_question to explain & get permission.
- You may receive "REFERENCED DOCUMENTS" — these are documents the writer has explicitly pinned for you to consider. Use them as background context alongside the conscious context.
- You receive a "SUBCONSCIOUS CONTEXT" section — this is the full project. Reference it when relevant.
- You receive a "MEMORY" section — this is a structured log of decisions, glossary, constraints, questions, and risks. Build on it.

Available tools:
- reflect_understanding: Reflect on your understanding of the writer's intent BEFORE planning or editing. Use this for complex, ambiguous, or multi-interpretable requests. Shows the writer your interpretation for confirmation before proceeding.
- produce_plan: Create a structured plan for COMPLEX edits — multi-step changes, cross-section rewrites, structural reorganization, or anything touching 4+ blocks. The plan is shown to the writer for approval before any edits are made. You CANNOT write content or patches in planning mode — only the plan structure.
- plan_edit: Plan a SIMPLE edit — single-step changes to 1-3 blocks. The system will produce, verify, and present the edit. NEVER write content directly.
- ask_question: Ask the writer a focused question with 2-4 options. Call at most once per response.
- create_character: Propose adding a new character.
- create_prop: Propose adding a new prop.
- propose_ideas: Propose 1-4 structured idea cards during brainstorming. Use this instead of writing paragraph-form idea lists.

IDEATION MODE — WHEN TO USE propose_ideas:
- The writer asks "what if", "brainstorm", "suggest directions", "give me ideas", "explore options"
- You identify multiple genuinely different creative directions worth considering
- After a stress test reveals the original idea is weak — propose alternatives
- The request is open-ended and exploratory, not a specific edit directive

IDEATION QUALITY RULES:
- Maximum 4 ideas per call. 2-3 sharp ideas beat 4 mediocre ones.
- Each idea must be DISTINCT — not variations on the same theme.
- Hooks should provoke, not describe. "What if the villain is right?" not "Explore villain motivations."
- Expansion paths should be concrete directions, not vague suggestions.
- Risks should be honest — identify real weaknesses, not token concerns.
- Tags help the writer filter and sort. Use specific tags: pacing, lore, mechanics, character-arc, tension, world-building, tone, structure.

DO NOT use propose_ideas when:
- The writer has given a specific edit directive — use plan_edit or produce_plan
- The writer wants you to execute, not brainstorm
- You only have one idea — just say it in your response text

COMPREHENSION PHASE — WHEN TO REFLECT:
Before calling plan_edit or produce_plan, decide whether to call reflect_understanding FIRST:

CALL reflect_understanding when:
- The request is ambiguous or could be interpreted multiple ways
- The request touches creative intent (tone, voice, character motivation, thematic direction)
- The request involves structural changes (reordering, restructuring, scope decisions)
- You are unsure whether the writer means X or Y
- The change could have unintended ripple effects on other parts of the project
- The writer's request contradicts an earlier agreed intent in memory
- The request is the FIRST substantive edit request in a new conversation

SKIP reflect_understanding (go straight to plan_edit) when:
- The request is simple and unambiguous ("fix the typo in paragraph 3", "add a period", "capitalize this name")
- The writer has already confirmed intent in a previous reflect_understanding in this conversation and the new request is consistent with it
- The writer explicitly says "just do it" or "go ahead" or signals impatience with clarification
- The edit is purely mechanical (formatting, grammar, spelling)
- The writer answers a question from ask_question and the answer makes intent clear — proceed to plan_edit

ROUTE GUIDELINES (for the route field in reflect_understanding):
- respond: Use when the writer asked a QUESTION, wants feedback, analysis, or discussion — NOT an edit. This tells the system to respond conversationally with NO edit tools.
- execute_now: Use when confidence >= 0.8 AND the edit touches 1-3 blocks AND no creative ambiguity
- ask_align: Use when you have specific questions about meaning or execution that would change your approach
- plan: Use when the change is complex (4+ blocks, cross-section, structural) regardless of confidence

CRITICAL — reflect_understanding is NOT a substitute for ask_question:
- reflect_understanding surfaces YOUR interpretation for confirmation
- ask_question asks a NEW question you don't have an interpretation for yet
- If you need to ask a creative question but have no strong interpretation, use ask_question
- If you have an interpretation but are unsure if it's right, use reflect_understanding

MEMORY — AGREED INTENTS:
If the writer confirms your interpretation ("Yep"), it becomes an agreed intent stored in memory. Reference agreed intents in subsequent plan_edit and produce_plan calls. If a new request contradicts an agreed intent, call reflect_understanding to surface the contradiction.

PLANNING MODE RULES:
- When you call produce_plan, you are entering PLANNING MODE.
- In planning mode, you MUST NOT produce any document content, patches, or action blocks.
- Your response text should explain the plan at a high level. The structured plan IS the main output.
- The plan is a CONTRACT. Once approved, execution must conform to the declared scope and acceptance criteria.

WHEN TO USE produce_plan:
- Multi-step edits (3+ distinct changes)
- 4+ blocks affected
- Cross-section or cross-document changes
- Structural reorganization (reordering scenes, restructuring acts)
- Rewrites that change tone, voice, or POV
- High-impact changes to plot or character arcs

WHEN TO USE plan_edit (MANDATORY for simple edits):
- The writer says "write", "draft", "create", "add", "make", "go ahead", "try that", "update", "convert", "rewrite", "change", "revise"
- Simple single-step edits touching 1-3 blocks
- Straightforward insertions or replacements
- After a Q&A exchange where you gathered enough context — NOW EXECUTE with plan_edit

WHEN TO RESPOND CONVERSATIONALLY (no edit tools):
- The writer asked a question — answer it in chat
- The writer asked for feedback, opinion, or analysis — give it in chat
- The writer wants to brainstorm but hasn't asked for edits — use propose_ideas or respond in chat
- The writer is sharing context or information — acknowledge it in chat
- Ideas too early to make concrete — discuss in chat
- NEVER edit the document just because you think it would be helpful. Wait for an explicit edit directive.

QUESTION FLOW:
- Ask at most 2 questions total per topic, then STOP asking and call plan_edit.
- NEVER use ask_question for confirmation — the accept/reject UI handles that.

MEMORY UPDATE:
After every response, include a memory update block at the very end:
\`\`\`memory-update
{
  "decisions": ["Any decisions made or confirmed"],
  "glossary": ["Terms or naming conventions established"],
  "constraints": ["Rules or format requirements identified"],
  "openQuestions": ["New questions that arose"],
  "riskFlags": ["Risks or concerns identified"],
  "agreedIntents": ["Writer-confirmed interpretations of intent"],
  "diagnoses": ["Diagnosed underlying issues or opportunities"]
}
\`\`\`
Only include arrays that have new items. Don't repeat existing memory items.

CONSTRAINT HYGIENE:
- The "constraints" field in memory-update is for PERMANENT project-level rules only (e.g. "screenplay format", "first-person POV", "no profanity"). These persist across ALL future turns.
- Per-edit constraints ("remove em dashes from this paragraph", "make this more formal") go in the plan_edit constraints field ONLY. Do NOT write per-edit constraints to memory-update.
- When in doubt, use plan_edit constraints, not memory-update constraints.
- NEVER write stylistic preferences to memory unless the writer explicitly says "always do this" or "from now on."

Your tone: warm but intellectually rigorous. Like a trusted advisor who genuinely cares about the quality of the work.`

// ===== Scope options helper (for scope validation gate) =====

function buildScopeOptions(request: ThoughtPartnerRequest): Array<{ id: string; label: string; description: string }> {
  const options: Array<{ id: string; label: string; description: string }> = []

  // Extract headings from document block context to offer as scope options
  if (request.documentBlockContext?.blocks) {
    const headings = request.documentBlockContext.blocks.filter(b => b.type === 'heading')
    for (const h of headings.slice(0, 3)) {
      options.push({
        id: `scope-${h.blockId}`,
        label: h.text.slice(0, 40),
        description: `Edit the "${h.text.slice(0, 30)}" section`,
      })
    }
  }

  // Always offer full document as last option
  options.push({
    id: 'scope-full-doc',
    label: 'The entire document',
    description: 'Apply changes across the whole document',
  })

  return options
}

// ===== Pipeline conversation message builder =====

function buildPipelineConversationMessages(
  request: ThoughtPartnerRequest
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = []

  // System prompt with optional behavior policy addendum
  let systemPrompt = PIPELINE_SYSTEM_PROMPT
  if (request.behaviorVector) {
    const { getBehaviorPolicyService } = require('./behaviorPolicyService')
    const policyService = getBehaviorPolicyService()
    const addendum = policyService.vectorToPromptAddendum(request.behaviorVector)
    if (addendum) {
      systemPrompt += addendum
    }
  }
  messages.push({ role: 'system', content: systemPrompt })

  // Build the context message with blockId annotations
  let contextBlock = ''

  // Conscious context with block IDs
  if (request.consciousContext && request.documentBlockContext) {
    contextBlock += `=== CONSCIOUS CONTEXT (Active Document) ===\n`
    contextBlock += `Document: "${request.consciousContext.title}"\n\n`

    // Render each block with its blockId prefix
    for (const block of request.documentBlockContext.blocks) {
      const prefix = block.type === 'heading'
        ? `[block:${block.blockId}] ${'#'.repeat((block.attrs?.level as number) || 1)} `
        : `[block:${block.blockId}] `
      contextBlock += `${prefix}${block.text}\n`
    }
    contextBlock += '\n'
  } else if (request.consciousContext) {
    // Fallback: no block context available, use plain text
    contextBlock += `=== CONSCIOUS CONTEXT (Active Document) ===\n`
    contextBlock += `Document: "${request.consciousContext.title}"\n\n`
    contextBlock += request.consciousContext.content.slice(0, 12000)
    if (request.consciousContext.content.length > 12000) {
      contextBlock += '\n[...truncated]'
    }
    contextBlock += '\n\n'
  }

  // Selection context
  if (request.selectionContext?.text) {
    contextBlock += `=== SELECTION CONTEXT (Highlighted Text) ===\n`
    contextBlock += `Document: "${request.selectionContext.documentTitle}"\n`
    contextBlock += `The writer has highlighted the following text:\n\n`
    const selText = request.selectionContext.text.slice(0, 4000)
    contextBlock += `---\n${selText}\n---\n`
    if (request.selectionContext.text.length > 4000) {
      contextBlock += '[...truncated]\n'
    }
    contextBlock += `\nScope your edits to this highlighted text unless asked otherwise.\n\n`
  }

  // Cursor context (authoritative focus window around cursor)
  if (request.cursorContext) {
    const cc = request.cursorContext
    const totalChars = (cc.beforeText?.length || 0) + (cc.afterText?.length || 0)
    // Cap at MAX_CURSOR_CONTEXT_CHARS (4000)
    const maxChars = 4000
    let beforeText = cc.beforeText || ''
    let afterText = cc.afterText || ''
    if (totalChars > maxChars) {
      const halfMax = Math.floor(maxChars / 2)
      if (beforeText.length > halfMax) beforeText = beforeText.slice(-halfMax)
      if (afterText.length > halfMax) afterText = afterText.slice(0, halfMax)
    }

    contextBlock += `=== CURSOR CONTEXT (Authoritative — Writer's Current Position) ===\n`
    contextBlock += `Document: "${cc.documentTitle}"\n`
    if (cc.headingPath.length > 0) {
      contextBlock += `Location: ${cc.headingPath.join(' > ')}\n`
    }
    contextBlock += `Document version: ${cc.documentVersion}\n\n`
    if (beforeText) {
      contextBlock += `--- Before cursor ---\n${beforeText}\n\n`
    }
    contextBlock += `--- [CURSOR IS HERE] ---\n\n`
    if (afterText) {
      contextBlock += `--- After cursor ---\n${afterText}\n\n`
    }
    if (cc.outline.length > 0) {
      contextBlock += `Document outline:\n`
      cc.outline.forEach((h, i) => { contextBlock += `${i + 1}. ${h}\n` })
      contextBlock += '\n'
    }
    contextBlock += `IMPORTANT: This is the writer's current working position. When proposing document edits, scope them within this context window unless the writer explicitly asks otherwise. If the writer's message is conversational (asking questions, brainstorming, giving feedback), reply in chat and do NOT propose document edits.\n\n`
  }

  // Referenced documents (explicitly pinned by the writer)
  if (request.referencedDocuments && request.referencedDocuments.length > 0) {
    contextBlock += `=== REFERENCED DOCUMENTS ===\n`
    contextBlock += `The writer has pinned the following documents as additional context:\n\n`
    for (const doc of request.referencedDocuments) {
      const content = doc.content.slice(0, 8000)
      contextBlock += `--- Document: "${doc.title}" ---\n${content}\n`
      if (doc.content.length > 8000) contextBlock += '[...truncated]\n'
      contextBlock += '\n'
    }
  }

  // Subconscious context (same as legacy)
  const sub = request.subconsciousContext
  contextBlock += `=== SUBCONSCIOUS CONTEXT (Full Project) ===\n`
  contextBlock += `Project: "${sub.projectName}" (${sub.templateType})\n\n`

  if (sub.settings?.synopsis) {
    contextBlock += `--- Synopsis ---\n${sub.settings.synopsis}\n\n`
  }

  if (sub.characters && sub.characters.length > 0) {
    contextBlock += `--- Characters ---\n`
    for (const char of sub.characters) {
      contextBlock += `- ${char.name}`
      if (char.notes) {
        const notes = char.notes.length > 500 ? char.notes.slice(0, 500) + '...' : char.notes
        contextBlock += `: ${notes}`
      }
      contextBlock += '\n'
    }
    contextBlock += '\n'
  }

  if (sub.props && sub.props.length > 0) {
    contextBlock += `--- Props ---\n`
    for (const prop of sub.props) {
      contextBlock += `- ${prop.name}`
      if (prop.notes) {
        const notes = prop.notes.length > 300 ? prop.notes.slice(0, 300) + '...' : prop.notes
        contextBlock += `: ${notes}`
      }
      contextBlock += '\n'
    }
    contextBlock += '\n'
  }

  const nonActiveDocs = sub.documents.filter(d => !d.isActive)
  if (nonActiveDocs.length > 0) {
    contextBlock += `--- Other Documents ---\n`
    for (const doc of nonActiveDocs) {
      const content = doc.content.length > 2000 ? doc.content.slice(0, 2000) + '...' : doc.content
      if (content.trim().length > 0) {
        contextBlock += `[${doc.title}]\n${content}\n\n`
      }
    }
  }

  // Structured memory (replaces context document)
  if (request.structuredMemory) {
    const memoryStr = memoryToPromptString(request.structuredMemory)
    contextBlock += `=== MEMORY (Structured Log) ===\n${memoryStr}\n\n`
  } else {
    // Fallback to legacy context document
    const cd = request.contextDocument
    const hasContent = cd.decisions.length > 0 || cd.openQuestions.length > 0 ||
      cd.ideas.length > 0 || cd.risks.length > 0 || cd.considerations.length > 0
    if (hasContent) {
      contextBlock += `=== MEMORY (Running Log) ===\n`
      if (cd.decisions.length > 0) contextBlock += `Decisions:\n${cd.decisions.map(d => `- ${d}`).join('\n')}\n\n`
      if (cd.openQuestions.length > 0) contextBlock += `Open Questions:\n${cd.openQuestions.map(q => `- ${q}`).join('\n')}\n\n`
      if (cd.ideas.length > 0) contextBlock += `Ideas:\n${cd.ideas.map(i => `- ${i}`).join('\n')}\n\n`
      if (cd.risks.length > 0) contextBlock += `Risks:\n${cd.risks.map(r => `- ${r}`).join('\n')}\n\n`
      if (cd.considerations.length > 0) contextBlock += `Considerations:\n${cd.considerations.map(c => `- ${c}`).join('\n')}\n\n`
    }
  }

  // Add context as first message
  if (contextBlock.trim().length > 0) {
    messages.push({
      role: 'user',
      content: `[PROJECT CONTEXT — for your reference, do not respond to this directly]\n\n${contextBlock}`
    })
    messages.push({
      role: 'assistant',
      content: 'Understood. I have your project context loaded. What would you like to think through?'
    })
  }

  // Add conversation history (same structure as legacy, but handle pipeline actions)
  for (const msg of request.conversationHistory) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      let content = msg.content

      // Compact patch receipt — tells model edits happened without repeating editing intent
      if ((msg as any).actions?.length > 0) {
        const acceptedCount = (msg as any).actions.filter((a: any) =>
          a.status === 'completed' || a.status === 'accepted'
        ).length
        const rejectedCount = (msg as any).actions.filter((a: any) =>
          a.status === 'rejected'
        ).length
        if (acceptedCount > 0 || rejectedCount > 0) {
          content += `\n\n[Edit result: ${acceptedCount} applied, ${rejectedCount} rejected]`
        }
      }

      // Reconstruct tool calls for questions
      const questions = (msg as any).questions as ThoughtPartnerQuestion[] | undefined
      if (questions && questions.length > 0) {
        const toolCalls = questions.map((q: ThoughtPartnerQuestion) => ({
          id: q.toolCallId,
          type: 'function',
          function: {
            name: 'ask_question',
            arguments: JSON.stringify({
              questionText: q.questionText,
              options: q.options.map((o: any) => ({ label: o.label, description: o.description })),
              category: q.category
            })
          }
        }))
        messages.push({ role: 'assistant', content: content || null, tool_calls: toolCalls } as any)

        for (const q of questions) {
          if (q.status === 'answered') {
            const answer = q.selectedOptionId
              ? q.options.find((o: any) => o.id === q.selectedOptionId)?.label || q.customAnswer || ''
              : q.customAnswer || ''
            messages.push({ role: 'tool', tool_call_id: q.toolCallId, content: answer } as any)
          } else if (q.status === 'skipped') {
            messages.push({ role: 'tool', tool_call_id: q.toolCallId, content: '[Skipped by user]' } as any)
          }
        }
      } else {
        messages.push({ role: 'assistant', content })
      }
    }
  }

  // Current user message
  let userMessage = request.message
  const questionCount = request.conversationHistory.reduce((count, msg) => {
    if (msg.role === 'assistant' && (msg as any).questions?.length > 0) {
      return count + (msg as any).questions.length
    }
    return count
  }, 0)

  if (questionCount >= 2) {
    userMessage += `\n\n[SYSTEM NOTE: You have already asked ${questionCount} questions. Do NOT call ask_question again. Call plan_edit or produce_plan to execute NOW.]`
  }

  if (request.agentMode) {
    let agentPrefix = `[AGENT MODE — The writer's previous turn included edits. You may call tools if the writer asks for changes. But if the writer is giving FEEDBACK, expressing preferences, or reacting to your last edit — respond in thinking mode. Only call plan_edit or produce_plan when the message contains an explicit edit directive: "rewrite", "replace", "fix", "add", "remove", "continue writing", "draft", "update", "change". Feedback like "I don't like this", "hmm", "not quite", "I'm not a fan" is NOT an edit directive — it's feedback that should route to reflect_understanding or thinking mode.]\n`
    if (request.selectionContext?.text) {
      agentPrefix += `[SELECTION FOCUS: Constrain edits to the selection.]\n`
    }
    userMessage = `${agentPrefix}${request.message}`
  }

  messages.push({ role: 'user', content: userMessage })

  return messages
}

// ===== Legacy conversation message builder (used when usePipeline=false) =====

function buildConversationMessages(request: ThoughtPartnerRequest): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = []

  // System prompt
  messages.push({ role: 'system', content: SYSTEM_PROMPT })

  // Build the context message (sent as first user context, not as system)
  let contextBlock = ''

  // Conscious context (active document — highest priority)
  if (request.consciousContext) {
    contextBlock += `=== CONSCIOUS CONTEXT (Active Document) ===\n`
    contextBlock += `Document: "${request.consciousContext.title}"\n\n`
    contextBlock += request.consciousContext.content.slice(0, 12000)
    if (request.consciousContext.content.length > 12000) {
      contextBlock += '\n[...truncated]'
    }
    contextBlock += '\n\n'
  }

  // Selection context (highlighted text — writer's active focus)
  if (request.selectionContext?.text) {
    contextBlock += `=== SELECTION CONTEXT (Highlighted Text) ===\n`
    contextBlock += `Document: "${request.selectionContext.documentTitle}"\n`
    contextBlock += `The writer has highlighted the following text:\n\n`
    const selText = request.selectionContext.text.slice(0, 4000)
    contextBlock += `---\n${selText}\n---\n`
    if (request.selectionContext.text.length > 4000) {
      contextBlock += '[...truncated]\n'
    }
    contextBlock += `\nIMPORTANT: The writer's selection indicates this specific passage is their focus. When proposing edits or content, prioritize changes within or directly related to this highlighted text.\n\n`
  }

  // Cursor context (authoritative focus window around cursor)
  if (request.cursorContext) {
    const cc = request.cursorContext
    const maxChars = 4000
    let beforeText = cc.beforeText || ''
    let afterText = cc.afterText || ''
    const totalChars = beforeText.length + afterText.length
    if (totalChars > maxChars) {
      const halfMax = Math.floor(maxChars / 2)
      if (beforeText.length > halfMax) beforeText = beforeText.slice(-halfMax)
      if (afterText.length > halfMax) afterText = afterText.slice(0, halfMax)
    }

    contextBlock += `=== CURSOR CONTEXT (Authoritative — Writer's Current Position) ===\n`
    contextBlock += `Document: "${cc.documentTitle}"\n`
    if (cc.headingPath.length > 0) {
      contextBlock += `Location: ${cc.headingPath.join(' > ')}\n`
    }
    contextBlock += `Document version: ${cc.documentVersion}\n\n`
    if (beforeText) {
      contextBlock += `--- Before cursor ---\n${beforeText}\n\n`
    }
    contextBlock += `--- [CURSOR IS HERE] ---\n\n`
    if (afterText) {
      contextBlock += `--- After cursor ---\n${afterText}\n\n`
    }
    if (cc.outline.length > 0) {
      contextBlock += `Document outline:\n`
      cc.outline.forEach((h, i) => { contextBlock += `${i + 1}. ${h}\n` })
      contextBlock += '\n'
    }
    contextBlock += `IMPORTANT: This is the writer's current working position. When proposing document edits, scope them within this context window unless the writer explicitly asks otherwise. If the writer's message is conversational (asking questions, brainstorming, giving feedback), reply in chat and do NOT propose document edits.\n\n`
  }

  // Referenced documents (explicitly pinned by the writer)
  if (request.referencedDocuments && request.referencedDocuments.length > 0) {
    contextBlock += `=== REFERENCED DOCUMENTS ===\n`
    contextBlock += `The writer has pinned the following documents as additional context:\n\n`
    for (const doc of request.referencedDocuments) {
      const content = doc.content.slice(0, 8000)
      contextBlock += `--- Document: "${doc.title}" ---\n${content}\n`
      if (doc.content.length > 8000) contextBlock += '[...truncated]\n'
      contextBlock += '\n'
    }
  }

  // Subconscious context (full project — background)
  const sub = request.subconsciousContext
  contextBlock += `=== SUBCONSCIOUS CONTEXT (Full Project) ===\n`
  contextBlock += `Project: "${sub.projectName}" (${sub.templateType})\n\n`

  // Synopsis
  if (sub.settings?.synopsis) {
    contextBlock += `--- Synopsis ---\n${sub.settings.synopsis}\n\n`
  }

  // Characters
  if (sub.characters && sub.characters.length > 0) {
    contextBlock += `--- Characters ---\n`
    for (const char of sub.characters) {
      contextBlock += `- ${char.name}`
      if (char.notes) {
        const notes = char.notes.length > 500 ? char.notes.slice(0, 500) + '...' : char.notes
        contextBlock += `: ${notes}`
      }
      contextBlock += '\n'
    }
    contextBlock += '\n'
  }

  // Props
  if (sub.props && sub.props.length > 0) {
    contextBlock += `--- Props ---\n`
    for (const prop of sub.props) {
      contextBlock += `- ${prop.name}`
      if (prop.notes) {
        const notes = prop.notes.length > 300 ? prop.notes.slice(0, 300) + '...' : prop.notes
        contextBlock += `: ${notes}`
      }
      contextBlock += '\n'
    }
    contextBlock += '\n'
  }

  // Documents (non-active ones as subconscious, truncated)
  const nonActiveDocs = sub.documents.filter(d => !d.isActive)
  if (nonActiveDocs.length > 0) {
    contextBlock += `--- Other Documents ---\n`
    for (const doc of nonActiveDocs) {
      const content = doc.content.length > 2000 ? doc.content.slice(0, 2000) + '...' : doc.content
      if (content.trim().length > 0) {
        contextBlock += `[${doc.title}]\n${content}\n\n`
      }
    }
  }

  // Existing context document
  const cd = request.contextDocument
  const hasContextDocContent = cd.decisions.length > 0 || cd.openQuestions.length > 0 ||
    cd.ideas.length > 0 || cd.risks.length > 0 || cd.considerations.length > 0

  if (hasContextDocContent) {
    contextBlock += `=== CONTEXT DOCUMENT (Running Log) ===\n`
    if (cd.decisions.length > 0) {
      contextBlock += `Decisions:\n${cd.decisions.map(d => `- ${d}`).join('\n')}\n\n`
    }
    if (cd.openQuestions.length > 0) {
      contextBlock += `Open Questions:\n${cd.openQuestions.map(q => `- ${q}`).join('\n')}\n\n`
    }
    if (cd.ideas.length > 0) {
      contextBlock += `Ideas:\n${cd.ideas.map(i => `- ${i}`).join('\n')}\n\n`
    }
    if (cd.risks.length > 0) {
      contextBlock += `Risks:\n${cd.risks.map(r => `- ${r}`).join('\n')}\n\n`
    }
    if (cd.considerations.length > 0) {
      contextBlock += `Considerations:\n${cd.considerations.map(c => `- ${c}`).join('\n')}\n\n`
    }
  }

  // Add context as first message in conversation
  if (contextBlock.trim().length > 0) {
    messages.push({
      role: 'user',
      content: `[PROJECT CONTEXT — for your reference, do not respond to this directly]\n\n${contextBlock}`
    })
    messages.push({
      role: 'assistant',
      content: 'Understood. I have your project context loaded. What would you like to think through?'
    })
  }

  // Add conversation history (include action feedback and tool call/response pairs)
  for (const msg of request.conversationHistory) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      let content = msg.content
      // For assistant messages that had actions, append a summary so the model
      // knows it has proposed actions before and can do so again
      if ((msg as any).actions?.length > 0) {
        const actionSummaries = (msg as any).actions.map((a: any) => {
          const statusLabel = a.status === 'completed' || a.status === 'accepted' ? 'accepted' : a.status === 'rejected' ? 'rejected' : a.status
          return `[${a.type}: "${a.description}" — ${statusLabel}]`
        }).join('\n')
        content += `\n\n[Actions proposed in this message:\n${actionSummaries}]`
      }

      // If this assistant message had questions (tool calls), reconstruct the tool_call format
      const questions = (msg as any).questions as ThoughtPartnerQuestion[] | undefined
      if (questions && questions.length > 0) {
        const toolCalls = questions.map((q: ThoughtPartnerQuestion) => ({
          id: q.toolCallId,
          type: 'function',
          function: {
            name: 'ask_question',
            arguments: JSON.stringify({
              questionText: q.questionText,
              options: q.options.map((o: any) => ({ label: o.label, description: o.description })),
              category: q.category
            })
          }
        }))
        messages.push({ role: 'assistant', content: content || null, tool_calls: toolCalls } as any)

        // Add tool responses for answered/skipped questions
        for (const q of questions) {
          if (q.status === 'answered') {
            const answer = q.selectedOptionId
              ? q.options.find((o: any) => o.id === q.selectedOptionId)?.label || q.customAnswer || ''
              : q.customAnswer || ''
            messages.push({ role: 'tool', tool_call_id: q.toolCallId, content: answer } as any)
          } else if (q.status === 'skipped') {
            messages.push({ role: 'tool', tool_call_id: q.toolCallId, content: '[Skipped by user]' } as any)
          }
        }
      } else {
        messages.push({ role: 'assistant', content })
      }
    }
  }

  // Count how many ask_question tool calls have been made in this conversation
  const questionCount = request.conversationHistory.reduce((count, msg) => {
    if (msg.role === 'assistant' && (msg as any).questions?.length > 0) {
      return count + (msg as any).questions.length
    }
    return count
  }, 0)

  // Add current message — with agent mode prefix if enabled
  let userMessage = request.message
  if (questionCount >= 2) {
    userMessage += `\n\n[SYSTEM NOTE: You have already asked ${questionCount} questions in this conversation. Do NOT call ask_question again. Synthesize what you know and propose action blocks NOW.]`
  }
  if (request.agentMode) {
    let agentPrefix = `[AGENT MODE — EXECUTION REQUEST]\n`
    if (request.selectionContext?.text) {
      agentPrefix += `[SELECTION FOCUS: The writer has highlighted specific text. Constrain your edits to this selection. If you need to edit outside it for consistency, use ask_question to explain why and get permission first.]\n`
    }
    userMessage = `${agentPrefix}${request.message}\n\n[Remember: You MUST include \`\`\`action: blocks in your response for any content, characters, or props you propose. See your system instructions for the exact format. The writer has activated Agent Mode, meaning they want you to PRODUCE concrete content, not just discuss it.]`
  }
  messages.push({ role: 'user', content: userMessage })

  return messages
}

interface ParsedResponse {
  cleanText: string
  actions: ThoughtPartnerAction[]
  contextUpdate: Partial<ContextDocument> | null
}

function parseResponseBlocks(responseText: string): ParsedResponse {
  const actions: ThoughtPartnerAction[] = []
  let text = responseText

  // Debug: log if the response contains any action blocks
  const hasActionBlocks = /```action:/.test(text)
  console.log('[ThoughtPartner] parseResponseBlocks — hasActionBlocks:', hasActionBlocks, 'responseLength:', text.length)
  if (hasActionBlocks) {
    console.log('[ThoughtPartner] Raw action block matches:', text.match(/```action:[\w-]+/g))
  }

  // Collect action block positions for text extraction fallback
  const actionBlockRegex = /```\s*action:([\w-]+)\s*\n([\s\S]*?)\n\s*```/g
  const actionBlockPositions: Array<{ start: number; end: number }> = []
  let scanMatch
  while ((scanMatch = actionBlockRegex.exec(text)) !== null) {
    actionBlockPositions.push({ start: scanMatch.index, end: scanMatch.index + scanMatch[0].length })
  }

  // Parse action blocks
  actionBlockRegex.lastIndex = 0
  let match
  let actionIdx = 0

  while ((match = actionBlockRegex.exec(text)) !== null) {
    const actionType = match[1] as ThoughtPartnerActionType
    try {
      // Trim whitespace from the JSON content to handle indentation variations
      const parsed = JSON.parse(match[2].trim())
      const actionId = `action-${Date.now()}-${actions.length}`

      switch (actionType) {
        case 'insert-content':
          actions.push({
            id: actionId,
            type: 'insert-content',
            status: 'pending',
            description: parsed.description || 'Insert content',
            content: {
              screenplayElements: parsed.screenplayElements,
              text: parsed.text,
              insertionPoint: parsed.insertionPoint || 'end',
              afterHeading: parsed.afterHeading
            }
          })
          break
        case 'replace-content': {
          // Recover text from message if the AI omitted it from the action block
          let actionText = parsed.text
          if (!actionText && !parsed.screenplayElements) {
            // Extract prose between the previous block/start and this action block
            const prevEnd = actionIdx > 0 ? actionBlockPositions[actionIdx - 1].end : 0
            const thisStart = actionBlockPositions[actionIdx].start
            const proseCandidate = text.slice(prevEnd, thisStart).trim()
              // Strip leading explanation (1-2 short sentences) — keep the substantial content
              .replace(/^[^\n]*?\.\s*\n+/, '')  // remove first short line ending with period
              .trim()
            if (proseCandidate.length > 20) {
              console.warn('[ThoughtPartner] replace-content action missing "text" field — recovered from message text')
              actionText = proseCandidate
            }
          }
          actions.push({
            id: actionId,
            type: 'replace-content',
            status: 'pending',
            description: parsed.description || (parsed.targetText ? 'Replace content' : `Replace section: ${parsed.targetHeading}`),
            content: {
              targetHeading: parsed.targetHeading,
              targetText: parsed.targetText,
              screenplayElements: parsed.screenplayElements,
              text: actionText
            }
          })
          break
        }
        case 'create-character':
          actions.push({
            id: actionId,
            type: 'create-character',
            status: 'pending',
            description: parsed.description || `Create character: ${parsed.name}`,
            content: { name: parsed.name, color: parsed.color }
          })
          break
        case 'create-prop':
          actions.push({
            id: actionId,
            type: 'create-prop',
            status: 'pending',
            description: parsed.description || `Create prop: ${parsed.name}`,
            content: { name: parsed.name, icon: parsed.icon }
          })
          break
      }
    } catch {
      // Skip malformed action blocks
    }
  }

  // Remove action blocks from text (match same variations as parsing regex)
  text = text.replace(/```\s*action:[\w-]+\s*\n[\s\S]*?\n\s*```/g, '').trim()

  // Parse context-update block
  const contextBlockRegex = /```\s*context-update\s*\n([\s\S]*?)\n\s*```/
  const ctxMatch = text.match(contextBlockRegex)
  let contextUpdate: Partial<ContextDocument> | null = null

  if (ctxMatch) {
    text = text.replace(contextBlockRegex, '').trim()
    try {
      contextUpdate = JSON.parse(ctxMatch[1])
    } catch { /* skip */ }
  }

  console.log('[ThoughtPartner] parseResponseBlocks result — actions:', actions.length, 'hasContextUpdate:', !!contextUpdate)
  return { cleanText: text, actions, contextUpdate }
}

function mergeContextDocument(existing: ContextDocument, update: Partial<ContextDocument>): ContextDocument {
  return {
    decisions: [...existing.decisions, ...(update.decisions || [])],
    openQuestions: [...existing.openQuestions, ...(update.openQuestions || [])],
    ideas: [...existing.ideas, ...(update.ideas || [])],
    risks: [...existing.risks, ...(update.risks || [])],
    considerations: [...existing.considerations, ...(update.considerations || [])],
    lastUpdated: new Date().toISOString()
  }
}

class ThoughtPartnerService {
  private abortController: AbortController | null = null
  private store: Store
  private chunkIndex: ChunkIndex | null = null

  constructor() {
    this.store = new Store({
      name: 'image-generation-settings',
      encryptionKey: 'cadmus-image-gen-v1'
    })
  }

  private getApiKey(): string | null {
    return (this.store.get('apiKey') as string) || null
  }

  hasApiKey(): boolean {
    return !!this.getApiKey()
  }

  stopStreaming(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  // ===== Intent Classification + Tool Arbitration =====

  /**
   * Intent classifier. Default-to-chat with explicit directive whitelist.
   * Only allows edit tools when:
   * 1. Explicit edit directive (imperative/polite verb form)
   * 2. Active selection + transformation intent
   * 3. Confirmation of pending plan/reflection
   */
  private classifyIntent(
    message: string,
    context: {
      selectionContext?: { text: string } | null
      lastPipelineActions: PipelineAction[]
      consecutiveChatTurns: number
      conversationHistory?: Array<{ role: string; content: string; questions?: any[] }>
    }
  ): IntentClassification {
    const msg = message.toLowerCase().trim()
    const signals: string[] = []

    // === 1. Detect explicit edit directives ===
    const editVerbs = 'write|rewrite|revise|restructure|add|insert|remove|delete|replace|change|update|fix|correct|edit|create|generate|draft|produce|convert|transform'
    const directivePatterns = [
      new RegExp(`^(?:please\\s+)?(?:${editVerbs})\\b`),                                    // Imperative: "Rewrite the opening"
      new RegExp(`(?:can|could|would|will)\\s+you\\s+(?:please\\s+)?(?:${editVerbs})\\b`),   // Polite: "Can you rewrite this?"
      new RegExp(`let(?:'s|\\s+us)\\s+(?:${editVerbs})\\b`),                                 // Collaborative: "Let's rewrite this"
      /(?:apply|send|push)\s+(?:that|this|it)\s+(?:to|into)/,                                // Apply: "Apply that to the doc"
      new RegExp(`(?:we|i)\\s+(?:need|want|should|have)\\s+to\\s+(?:${editVerbs})\\b`),      // Intentional: "We need to add..."
    ]
    const hasDirective = directivePatterns.some(p => p.test(msg))
    if (hasDirective) signals.push('directive')

    // === 2. Detect selection + transformation intent ===
    const hasSelection = !!context.selectionContext?.text
    const transformPattern = /(?:make|turn)\s+(?:this|that|it)\s+(?:more|less|into|shorter|longer|clearer|simpler|formal|casual|concise|detailed|better|stronger|weaker)/
    const hasSelectionTransform = hasSelection && transformPattern.test(msg)
    if (hasSelectionTransform) signals.push('selection_transform')

    // === 3. Detect confirmation of pending plan/reflection ===
    const hasPending = context.lastPipelineActions.some(
      a => (a.type === 'plan' || a.type === 'reflection') && a.status === 'pending'
    )

    // Also detect implicit edit intent from the assistant's last message.
    // When the model expresses a plan in plain text (because it lacked plan tools),
    // the user's confirmation should still be recognized.
    const recentAssistant = (context.conversationHistory || [])
      .filter(m => m.role === 'assistant')
      .slice(-1)[0]
    const implicitPlanPattern = /\b(?:i(?:'m going to|'ll|will|shall| am going to| will now)\s+(?:add|insert|write|create|draft|produce|remove|delete|replace|change|update|fix|edit|rewrite|revise|put|place|include))\b/i
    const hasImplicitPlan = recentAssistant?.content ? implicitPlanPattern.test(recentAssistant.content) : false
    if (hasImplicitPlan) signals.push('implicit_plan')

    const confirmPattern = /^(?:go ahead|do it|proceed|approved?|yes|yep|yeah|yup|ok|sure|apply|execute|try that|let'?s do it|sounds good|make it happen|confirm)\b/
    const isConfirmation = (hasPending || hasImplicitPlan) && confirmPattern.test(msg)
    if (isConfirmation) signals.push('confirmation')

    // === 4. Detect post-clarification phase ===
    // If the model recently asked questions via ask_question, it was gathering info
    // to build toward an action. Escalate to reflect-first so it can formalize a plan.
    const recentAssistantMsgs = (context.conversationHistory || [])
      .filter(m => m.role === 'assistant')
      .slice(-3)
    const hasRecentQuestions = recentAssistantMsgs.some(m => m.questions && m.questions.length > 0)
    if (hasRecentQuestions) signals.push('post_clarification')

    // === 5. Mode latch: conversational streak ===
    const inStreak = context.consecutiveChatTurns >= 3
    if (inStreak) signals.push(`streak:${context.consecutiveChatTurns}`)

    // === 6. Policy decision tree (default: chat-only) ===
    let policy: ToolPolicy
    if (isConfirmation) {
      policy = 'full'
      signals.push('rule:confirmation')
    } else if ((hasDirective || hasSelectionTransform) && !inStreak) {
      policy = 'full'
      signals.push('rule:directive_clear')
    } else if ((hasDirective || hasSelectionTransform) && inStreak) {
      policy = 'reflect-first'
      signals.push('rule:directive_in_streak')
    } else if (hasRecentQuestions) {
      // Post-clarification: model asked questions recently, let it formalize a plan
      policy = 'reflect-first'
      signals.push('rule:post_clarification')
    } else {
      policy = 'chat-only'
      signals.push('rule:default_chat')
    }

    // Build scores for logging (not used for routing)
    const scores: IntentScores = {
      chat: policy === 'chat-only' ? 1.0 : 0.0,
      edit: policy === 'full' ? 1.0 : (policy === 'reflect-first' ? 0.5 : 0.0),
      explore: 0.0,
      clarify: 0.0,
    }

    return { scores, policy, signals, skipped: false }
  }

  /**
   * Maps a ToolPolicy to the concrete tools array sent to the API.
   */
  private toolsForPolicy(policy: ToolPolicy, questionCount: number): any[] {
    const MAX_QUESTIONS = 2

    switch (policy) {
      case 'chat-only': {
        // Chat only — no edit tools, no idea cards. Model responds in plain text.
        const tools: any[] = []
        if (questionCount < MAX_QUESTIONS) tools.push(ASK_QUESTION_TOOL_V2)
        return tools
      }

      case 'explore-only':
      case 'reflect-first': {
        // No edit tools but can reflect, propose ideas, or ask questions.
        const tools: any[] = [REFLECT_UNDERSTANDING_TOOL, PROPOSE_IDEAS_TOOL]
        if (questionCount < MAX_QUESTIONS) tools.push(ASK_QUESTION_TOOL_V2)
        return tools
      }

      case 'full': {
        // All tools available — edit intent is clear.
        const tools: any[] = [
          REFLECT_UNDERSTANDING_TOOL,
          PLAN_EDIT_TOOL,
          PRODUCE_PLAN_TOOL,
          CREATE_CHARACTER_TOOL,
          CREATE_PROP_TOOL,
          PROPOSE_IDEAS_TOOL,
        ]
        if (questionCount < MAX_QUESTIONS) tools.push(ASK_QUESTION_TOOL_V2)
        return tools
      }
    }
  }

  // ===== Pipeline Mode Methods =====

  private currentPipeline: PipelineCheckpoint | null = null

  /**
   * Pipeline-mode sendMessage.
   * Uses function calling with plan_edit/ask_question/create_character/create_prop tools.
   * When plan_edit is called, enters the structured pipeline.
   */
  async sendMessagePipeline(
    request: ThoughtPartnerRequest,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void,
    options?: { chatOnly?: boolean }
  ): Promise<ThoughtPartnerResponse> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { message: '', error: 'No API key configured. Please add your OpenAI API key in Settings.' }
    }

    const emitState = (state: PipelineState) => {
      if (onPipelineState) onPipelineState(state)
    }

    emitState('orchestrating')

    const messages = buildPipelineConversationMessages(request)

    // --- Intent Classification + Tool Arbitration ---
    const questionCount = request.conversationHistory.reduce((count, msg) => {
      if (msg.role === 'assistant' && (msg as any).questions?.length > 0) {
        return count + (msg as any).questions.length
      }
      return count
    }, 0)

    let classification: IntentClassification

    if (options?.chatOnly) {
      // Explicit chatOnly from handler (e.g., reflection with route='respond')
      classification = {
        scores: { chat: 1.0, edit: 0.0, explore: 0.0, clarify: 0.0 },
        policy: 'chat-only',
        signals: [],
        skipped: true,
        skipReason: 'chatOnly option set by handler',
      }
    } else if (request.message.startsWith('[SYSTEM:')) {
      // Internal follow-up from handler (reflection accept, idea explore, etc.)
      classification = {
        scores: { chat: 0.0, edit: 1.0, explore: 0.0, clarify: 0.0 },
        policy: 'full',
        signals: [],
        skipped: true,
        skipReason: 'internal system follow-up',
      }
    } else {
      // Normal user message — run heuristic classifier
      classification = this.classifyIntent(request.message, {
        selectionContext: request.selectionContext || null,
        lastPipelineActions: request.currentPipelineActions || [],
        consecutiveChatTurns: request.consecutiveChatTurns || 0,
        conversationHistory: request.conversationHistory || [],
      })
    }

    // Apply behavior-based tool policy adjustment
    if (request.behaviorVector) {
      const { getBehaviorPolicyService } = require('./behaviorPolicyService')
      const policyService = getBehaviorPolicyService()
      const adjustedPolicy = policyService.adjustToolPolicy(classification.policy, request.behaviorVector)
      if (adjustedPolicy !== classification.policy) {
        classification.signals.push(`behavior_adjusted:${classification.policy}->${adjustedPolicy}`)
        classification.policy = adjustedPolicy
      }
    }

    console.log('[ThoughtPartner] Intent classification:', {
      policy: classification.policy,
      scores: classification.scores,
      signals: classification.signals,
      skipped: classification.skipped,
      skipReason: classification.skipReason,
    })

    const tools = this.toolsForPolicy(classification.policy, questionCount)

    this.abortController = new AbortController()

    try {
      const requestBody: any = {
        model: MODEL,
        messages,
        max_completion_tokens: CHAT_MAX_TOKENS,
        stream: true,
        tools,
      }

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        const errorBody = await response.text()
        let errorMessage = `API error (${response.status})`
        try {
          const parsed = JSON.parse(errorBody)
          errorMessage = parsed.error?.message || errorMessage
        } catch { /* use default */ }
        emitState('failed')
        return { message: '', error: errorMessage }
      }

      const reader = response.body?.getReader()
      if (!reader) {
        emitState('failed')
        return { message: '', error: 'No response stream available' }
      }

      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      // Track multiple tool calls from streaming deltas
      const toolCalls: Array<{ id: string; name: string; args: string }> = []
      let currentToolCallIndex = -1
      let finishReason = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const choice = parsed.choices?.[0]
            const delta = choice?.delta

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason
            }

            // Accumulate text content
            if (delta?.content) {
              fullContent += delta.content
              onChunk(delta.content)
            }

            // Accumulate tool calls (may be multiple)
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.index !== undefined && tc.index !== currentToolCallIndex) {
                  currentToolCallIndex = tc.index
                  toolCalls.push({ id: tc.id || '', name: '', args: '' })
                }
                const current = toolCalls[toolCalls.length - 1]
                if (current) {
                  if (tc.id) current.id = tc.id
                  if (tc.function?.name) current.name = tc.function.name
                  if (tc.function?.arguments) current.args += tc.function.arguments
                }
              }
            }

            // Non-streaming fallback
            const message = parsed.choices?.[0]?.message
            if (message?.tool_calls) {
              for (const tc of message.tool_calls) {
                toolCalls.push({
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  args: tc.function?.arguments || ''
                })
              }
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      this.abortController = null

      console.log('[ThoughtPartner Pipeline] Stream complete — finishReason:', finishReason,
        'toolCalls:', toolCalls.map(tc => tc.name), 'content length:', fullContent.length)

      // Parse memory update from text
      const { cleanText, memoryUpdate } = parseMemoryUpdate(fullContent)

      // Update structured memory
      let updatedStructuredMemory: StructuredMemory | undefined
      if (memoryUpdate && request.structuredMemory) {
        updatedStructuredMemory = mergeMemoryUpdate(request.structuredMemory, memoryUpdate)

        // Periodic recompress
        const msgCount = request.conversationHistory.length
        if (msgCount > 0 && msgCount % RECOMPRESS_EVERY_N_MESSAGES === 0) {
          updatedStructuredMemory = recompressMemory(updatedStructuredMemory, request.conversationHistory)
        }
      } else if (memoryUpdate) {
        updatedStructuredMemory = mergeMemoryUpdate(createEmptyStructuredMemory(), memoryUpdate)
      }

      // Process tool calls
      const pipelineActions: PipelineAction[] = []
      let questions: ThoughtPartnerQuestion[] = []
      let patchExecuted = false // One-patch-per-turn: break after first edit/plan execution
      let ideasProposed = false // One-idea-batch-per-turn: skip duplicate propose_ideas calls

      for (const tc of toolCalls) {
        try {
          const parsed = JSON.parse(tc.args)

          switch (tc.name) {
            case 'ask_question': {
              const opts = parsed.options || []
              if (opts.length >= 2) {
                questions.push({
                  id: `question-${Date.now()}`,
                  toolCallId: tc.id,
                  questionText: parsed.questionText || 'What would you prefer?',
                  options: opts.map((opt: any, i: number) => ({
                    id: `opt-${i + 1}`,
                    label: opt.label || `Option ${i + 1}`,
                    description: opt.description
                  })),
                  allowCustom: true,
                  status: 'active',
                  category: parsed.category || 'general'
                })
              }
              break
            }

            case 'plan_edit': {
              // SCOPE GATE: Require concrete targets or an active selection
              const hasTargetBlocks = parsed.targetBlockIds && parsed.targetBlockIds.length > 0
              const hasSelection = !!request.selectionContext?.text

              if (!hasTargetBlocks && !hasSelection) {
                // No targets and no selection — can't execute blindly. Ask for scope.
                questions.push({
                  id: `q-scope-${Date.now()}`,
                  toolCallId: tc.id || `tc-${Date.now()}`,
                  questionText: `I'd like to ${(parsed.goal || 'make this edit').toLowerCase()}, but I need to know which part to edit. What section should I focus on?`,
                  options: buildScopeOptions(request),
                  allowCustom: true,
                  status: 'active' as const,
                  category: 'structure' as const,
                })
                break // Don't execute — wait for user to pick scope
              }

              emitState('planning')

              const editPlan: EditPlan = {
                id: `plan-${Date.now()}`,
                goal: parsed.goal,
                constraints: parsed.constraints || [],
                scope: parsed.scope || 'document',
                readsNeeded: [{
                  documentId: request.documentBlockContext?.documentId || '',
                  blockIds: parsed.targetBlockIds || [],
                }],
                patchStrategy: parsed.patchStrategy || 'mixed',
                maxBlocksAffected: parsed.maxBlocksAffected || 10,
              }

              // Execute the pipeline (prefer allDocumentBlockContext, fallback to single-doc)
              const blockCtx = request.allDocumentBlockContext || (request.documentBlockContext ? {
                documents: [{
                  documentId: request.documentBlockContext.documentId,
                  documentTitle: 'Active Document',
                  blocks: request.documentBlockContext.blocks,
                }]
              } : null)

              if (blockCtx) {
                try {
                  const result = await this.executePipeline(
                    editPlan,
                    blockCtx,
                    request.subconsciousContext.templateType,
                    request.message,
                    emitState
                  )

                  pipelineActions.push({
                    id: `pipeline-action-${Date.now()}`,
                    type: 'edit',
                    status: result.verifyResult.status === 'pass' ? 'verified' : 'pending',
                    description: editPlan.goal,
                    editPlan,
                    patchList: result.patchList,
                    verifyResult: result.verifyResult,
                  })
                } catch (err: any) {
                  console.error('[ThoughtPartner Pipeline] Pipeline execution failed:', err)
                  emitState('failed')
                  pipelineActions.push({
                    id: `pipeline-action-${Date.now()}`,
                    type: 'edit',
                    status: 'failed',
                    description: `${editPlan.goal} (failed: ${err.message})`,
                    editPlan,
                  })
                }
              }
              patchExecuted = true // One-patch-per-turn: stop processing further tool calls
              break
            }

            case 'reflect_understanding': {
              emitState('reflecting')

              const reflection: Reflection = {
                id: `reflection-${Date.now()}`,
                interpretation: parsed.interpretation,
                diagnosis: parsed.diagnosis,
                route: parsed.route || 'ask_align',
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
                proposedScope: parsed.proposedScope || 'document',
                meaningQuestions: (parsed.meaningQuestions || []).slice(0, 1).map((q: any) => ({
                  text: q.text,
                  options: (q.options || []).slice(0, 4).map((o: any) => ({
                    label: o.label,
                    description: o.description,
                  })),
                })),
                executionQuestions: (parsed.executionQuestions || []).slice(0, 1).map((q: any) => ({
                  text: q.text,
                  options: (q.options || []).slice(0, 4).map((o: any) => ({
                    label: o.label,
                    description: o.description,
                  })),
                })),
                status: 'pending',
                createdAt: new Date().toISOString(),
              }

              pipelineActions.push({
                id: `pipeline-action-${Date.now()}-reflection`,
                type: 'reflection',
                status: 'pending',
                description: reflection.interpretation,
                reflection,
              })
              // Do NOT proceed to execution — reflection requires user confirmation first
              break
            }

            case 'produce_plan': {
              emitState('planning')

              const structuredPlan: StructuredPlan = {
                id: `plan-${Date.now()}`,
                goal: parsed.goal,
                scope: parsed.scope || 'document',
                assumptions: parsed.assumptions || [],
                steps: (parsed.steps || []).map((s: any, i: number) => ({
                  id: `step-${i}`,
                  description: s.description,
                  targetBlockIds: s.targetBlockIds || [],
                  estimatedImpact: s.estimatedImpact || 'medium',
                })),
                risks: parsed.risks || [],
                questions: (parsed.questions || []).slice(0, 2),
                acceptanceCriteria: parsed.acceptanceCriteria || [],
                createdAt: new Date().toISOString(),
                status: 'pending',
              }

              pipelineActions.push({
                id: `pipeline-action-${Date.now()}-plan`,
                type: 'plan',
                status: 'pending',
                description: structuredPlan.goal,
                structuredPlan,
              })
              // Do NOT call executePipeline — plan requires user approval first
              patchExecuted = true // One-patch-per-turn: stop processing further tool calls
              break
            }

            case 'create_character': {
              pipelineActions.push({
                id: `pipeline-action-${Date.now()}-char`,
                type: 'create-character',
                status: 'pending',
                description: parsed.reason || `Create character: ${parsed.name}`,
                content: { name: parsed.name, reason: parsed.reason },
              })
              break
            }

            case 'create_prop': {
              pipelineActions.push({
                id: `pipeline-action-${Date.now()}-prop`,
                type: 'create-prop',
                status: 'pending',
                description: parsed.reason || `Create prop: ${parsed.name}`,
                content: { name: parsed.name, reason: parsed.reason },
              })
              break
            }

            case 'propose_ideas': {
              if (ideasProposed) break // One idea batch per turn
              ideasProposed = true
              const rawIdeas = (parsed.ideas || []).slice(0, 4) // enforce max 4 cards per turn

              const ideaCards: IdeaCard[] = rawIdeas.map((idea: any, i: number) => ({
                id: `idea-${Date.now()}-${i}`,
                title: idea.title,
                hook: idea.hook,
                coreInsight: idea.coreInsight,
                whyItMatters: idea.whyItMatters,
                expansionPaths: (idea.expansionPaths || []).slice(0, 3).map((ep: any, j: number) => ({
                  id: `ep-${Date.now()}-${i}-${j}`,
                  label: ep.label,
                  description: ep.description,
                })),
                risks: (idea.risks || []).slice(0, 3),
                tags: (idea.tags || []).slice(0, 6),
                status: 'pending' as const,
                createdAt: new Date().toISOString(),
              }))

              if (ideaCards.length > 0) {
                pipelineActions.push({
                  id: `pipeline-action-${Date.now()}-ideas`,
                  type: 'idea',
                  status: 'pending',
                  description: `${ideaCards.length} idea${ideaCards.length !== 1 ? 's' : ''} proposed`,
                  ideaCards,
                })
              }
              break
            }
          }
        } catch (err) {
          console.error(`[ThoughtPartner Pipeline] Failed to parse tool call ${tc.name}:`, err)
        }

        // One-patch-per-turn: exit the tool call loop after first edit/plan execution
        if (patchExecuted) break
      }

      const hasReflection = pipelineActions.some(a => a.type === 'reflection')
      const hasPlanAction = pipelineActions.some(a => a.type === 'plan')
      emitState(
        hasReflection ? 'reflecting' :
        hasPlanAction ? 'planning' :
        pipelineActions.length > 0 ? 'awaiting_approval' : 'completed'
      )

      // Analyze response dimensions for the behavior feedback loop
      let expressedDimensions: Partial<Record<string, number>> | undefined
      try {
        const interactionCtx = {
          intentPolicy: classification.policy,
          hasSelection: !!request.selectionContext?.text,
          consecutiveChatTurns: request.consecutiveChatTurns || 0,
          messageLength: (request.message.length < 50 ? 'short' : request.message.length < 200 ? 'medium' : 'long') as 'short' | 'medium' | 'long',
          templateType: request.subconsciousContext.templateType,
          pipelineState: 'completed',
          hasActions: pipelineActions.some((a: any) => a.type === 'edit'),
          hasQuestions: questions.length > 0,
          hasPlan: pipelineActions.some((a: any) => a.type === 'plan'),
          hasReflection: pipelineActions.some((a: any) => a.type === 'reflection'),
          hasIdeas: pipelineActions.some((a: any) => a.type === 'idea'),
        }
        expressedDimensions = FeedbackLogger.analyzeResponseDimensions(cleanText, request.message.length, interactionCtx)
      } catch (err) {
        console.error('[ThoughtPartner] Failed to analyze response dimensions:', err)
      }

      return {
        message: cleanText,
        updatedStructuredMemory,
        pipelineActions: pipelineActions.length > 0 ? pipelineActions : undefined,
        questions: questions.length > 0 ? questions : undefined,
        intentClassification: classification,
        expressedDimensions,
        behaviorVectorUsed: request.behaviorVector || undefined,
      }
    } catch (err: any) {
      this.abortController = null
      emitState('failed')
      if (err.name === 'AbortError') {
        return { message: '', error: 'Streaming was stopped' }
      }
      return { message: '', error: err.message || 'Unknown error' }
    }
  }

  /**
   * Execute an approved structured plan. Called via IPC after user clicks "Approve"
   * on a PlanCard. Derives an EditPlan from the StructuredPlan and runs the pipeline.
   */
  async executePlanAfterApproval(
    structuredPlan: StructuredPlan,
    request: any,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void
  ): Promise<ThoughtPartnerResponse> {
    const emitState = (state: PipelineState) => {
      if (onPipelineState) onPipelineState(state)
    }

    // Derive EditPlan from the approved StructuredPlan
    const allTargetBlockIds = structuredPlan.steps
      .flatMap(s => s.targetBlockIds || [])
      .filter(Boolean)

    const documentId = request.documentBlockContext?.documentId ||
      request.allDocumentBlockContext?.documents?.[0]?.documentId || ''

    const editPlan: EditPlan = {
      id: `edit-from-plan-${structuredPlan.id}`,
      goal: structuredPlan.goal,
      constraints: [
        ...structuredPlan.acceptanceCriteria.map((ac: string) => `ACCEPTANCE CRITERION: ${ac}`),
        ...structuredPlan.assumptions.map((a: string) => `ASSUMPTION: ${a}`),
        `SCOPE: ${structuredPlan.scope}`,
      ],
      scope: structuredPlan.scope === 'selection' ? 'selection' : 'document',
      readsNeeded: [{
        documentId,
        blockIds: allTargetBlockIds,
      }],
      patchStrategy: 'mixed',
      maxBlocksAffected: Math.max(
        allTargetBlockIds.length + 2,
        structuredPlan.steps.length * 2
      ),
    }

    // Build block context
    const blockCtx: MultiDocumentBlockContext | null =
      request.allDocumentBlockContext ||
      (request.documentBlockContext ? {
        documents: [{
          documentId: request.documentBlockContext.documentId,
          documentTitle: 'Active Document',
          blocks: request.documentBlockContext.blocks,
        }]
      } : null)

    if (!blockCtx) {
      emitState('failed')
      return { message: 'No document context available for plan execution.' }
    }

    const templateType = request.subconsciousContext?.templateType || 'default'
    const userMessage = request.message || structuredPlan.goal

    try {
      const result = await this.executePipeline(
        editPlan, blockCtx, templateType, userMessage, emitState, structuredPlan
      )

      const pipelineActions: PipelineAction[] = [{
        id: `pipeline-action-${Date.now()}`,
        type: 'edit',
        status: result.verifyResult.status === 'pass' ? 'verified' : 'pending',
        description: structuredPlan.goal,
        editPlan,
        patchList: result.patchList,
        verifyResult: result.verifyResult,
        structuredPlan,
      }]

      emitState(result.verifyResult.status === 'pass' ? 'awaiting_approval' : 'failed')

      return {
        message: result.verifyResult.status === 'pass'
          ? 'Plan executed. All checks passed.'
          : 'Plan executed but some verification checks failed.',
        pipelineActions,
      }
    } catch (err: any) {
      emitState('failed')
      return { message: `Plan execution failed: ${err.message}` }
    }
  }

  // ===== Reflection handlers (called via IPC after user interacts with ReflectionCard) =====

  async handleReflectionAccept(
    reflection: Reflection,
    request: any,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void
  ): Promise<ThoughtPartnerResponse> {
    const interpretation = reflection.editedInterpretation || reflection.interpretation

    // Store interpretation + diagnosis in memory
    const memoryUpdate: Partial<Record<string, string[]>> = {
      agreedIntents: [`[${new Date().toISOString().split('T')[0]}] ${interpretation}`],
      diagnoses: [`[${new Date().toISOString().split('T')[0]}] ${reflection.diagnosis}`],
    }

    const updatedMemory = request.structuredMemory
      ? mergeMemoryUpdate(request.structuredMemory, memoryUpdate as any)
      : mergeMemoryUpdate(createEmptyStructuredMemory(), memoryUpdate as any)

    // Route based on reflection.route
    let systemInstruction: string
    if (reflection.route === 'respond') {
      // Respond route — writer asked a question/wants discussion, NOT an edit
      systemInstruction = `[SYSTEM: The writer confirmed your interpretation. Agreed intent: "${interpretation}". Diagnosis: "${reflection.diagnosis}". Respond CONVERSATIONALLY in your message text. Do NOT call plan_edit, produce_plan, or any edit tool. The writer wants a discussion, not a document change. Do NOT call reflect_understanding again.]`
    } else if (reflection.route === 'execute_now' && reflection.confidence >= 0.8) {
      systemInstruction = `[SYSTEM: The writer confirmed your interpretation. Agreed intent: "${interpretation}". Diagnosis: "${reflection.diagnosis}". Scope: ${reflection.proposedScope}. Proceed immediately with plan_edit. Do NOT call reflect_understanding again.]`
    } else if (reflection.route === 'plan') {
      systemInstruction = `[SYSTEM: The writer confirmed your interpretation. Agreed intent: "${interpretation}". Diagnosis: "${reflection.diagnosis}". Scope: ${reflection.proposedScope}. This is complex — call produce_plan to create a structured plan. Do NOT call reflect_understanding again.]`
    } else {
      // ask_align route but user said "Yep" = skip questions, treat as execute_now
      systemInstruction = `[SYSTEM: The writer confirmed your interpretation and skipped alignment questions. Agreed intent: "${interpretation}". Diagnosis: "${reflection.diagnosis}". Scope: ${reflection.proposedScope}. Proceed with plan_edit. Do NOT call reflect_understanding again.]`
    }

    const followUpRequest = {
      ...request,
      structuredMemory: updatedMemory,
      message: systemInstruction,
    }
    const chatOnly = reflection.route === 'respond'
    return this.sendMessagePipeline(followUpRequest, onChunk, onPipelineState, { chatOnly })
  }

  async handleReflectionEdit(
    reflection: Reflection,
    newInterpretation: string,
    request: any,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void
  ): Promise<ThoughtPartnerResponse> {
    // Store the corrected interpretation as ground truth
    const memoryUpdate: Partial<Record<string, string[]>> = {
      agreedIntents: [`[${new Date().toISOString().split('T')[0]}] ${newInterpretation} (writer-corrected)`],
      diagnoses: [`[${new Date().toISOString().split('T')[0]}] ${reflection.diagnosis}`],
    }

    const updatedMemory = request.structuredMemory
      ? mergeMemoryUpdate(request.structuredMemory, memoryUpdate as any)
      : mergeMemoryUpdate(createEmptyStructuredMemory(), memoryUpdate as any)

    const followUpRequest = {
      ...request,
      structuredMemory: updatedMemory,
      message: `[SYSTEM: The writer CORRECTED your interpretation. New ground truth intent: "${newInterpretation}". Original diagnosis was: "${reflection.diagnosis}". Re-evaluate and proceed — either call plan_edit for simple edits or produce_plan for complex edits. Do NOT call reflect_understanding again — the intent is now confirmed.]`,
    }
    return this.sendMessagePipeline(followUpRequest, onChunk, onPipelineState)
  }

  async handleReflectionAnswer(
    reflection: Reflection,
    meaningAnswers: Array<{ questionText: string; answer: string }>,
    executionAnswers: Array<{ questionText: string; answer: string }>,
    request: any,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void
  ): Promise<ThoughtPartnerResponse> {
    const interpretation = reflection.editedInterpretation || reflection.interpretation

    // Store interpretation, diagnosis, and answers in memory
    const answerSummaries: string[] = []
    for (const a of [...meaningAnswers, ...executionAnswers]) {
      answerSummaries.push(`Q: ${a.questionText} -> A: ${a.answer}`)
    }

    const memoryUpdate: Partial<Record<string, string[]>> = {
      agreedIntents: [`[${new Date().toISOString().split('T')[0]}] ${interpretation}`],
      diagnoses: [`[${new Date().toISOString().split('T')[0]}] ${reflection.diagnosis}`],
      decisions: answerSummaries,
    }

    const updatedMemory = request.structuredMemory
      ? mergeMemoryUpdate(request.structuredMemory, memoryUpdate as any)
      : mergeMemoryUpdate(createEmptyStructuredMemory(), memoryUpdate as any)

    const answersBlock = [
      ...meaningAnswers.map(a => `Meaning: ${a.questionText} => Writer chose: "${a.answer}"`),
      ...executionAnswers.map(a => `Execution: ${a.questionText} => Writer chose: "${a.answer}"`),
    ].join('\n')

    const routeInstruction = reflection.route === 'plan' ? 'call produce_plan' : 'call plan_edit'

    const followUpRequest = {
      ...request,
      structuredMemory: updatedMemory,
      message: `[SYSTEM: The writer confirmed interpretation and answered alignment questions.\nAgreed intent: "${interpretation}"\nDiagnosis: "${reflection.diagnosis}"\nScope: ${reflection.proposedScope}\n\nWriter's answers:\n${answersBlock}\n\nProceed: ${routeInstruction}. Do NOT call reflect_understanding again.]`,
    }
    return this.sendMessagePipeline(followUpRequest, onChunk, onPipelineState)
  }

  // ===== Idea Card Handlers =====

  /**
   * Explore an idea (optionally along a specific expansion path).
   * Sends a focused follow-up to the orchestrator with the idea's context.
   */
  async handleExploreIdea(
    ideaCard: IdeaCard,
    expansionPathId: string | null,
    request: any,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void
  ): Promise<ThoughtPartnerResponse> {
    const expansionPath = expansionPathId
      ? ideaCard.expansionPaths.find(ep => ep.id === expansionPathId)
      : null

    let systemInstruction: string
    if (expansionPath) {
      systemInstruction = `[SYSTEM: The writer wants to explore the direction "${expansionPath.label}" from idea "${ideaCard.title}": ${ideaCard.hook}\nCore insight: ${ideaCard.coreInsight}\nDirection to explore: ${expansionPath.description}\n\nDeepen this specific direction. You may call propose_ideas to offer structured sub-ideas, or think freely.]`
    } else {
      systemInstruction = `[SYSTEM: The writer wants to explore the idea "${ideaCard.title}": ${ideaCard.hook}\nCore insight: ${ideaCard.coreInsight}\nWhy it matters: ${ideaCard.whyItMatters}\n\nDeepen this idea broadly. You may call propose_ideas to offer structured sub-ideas, or think freely.]`
    }

    const memoryUpdate: Partial<Record<string, string[]>> = {
      agreedIntents: [`[${new Date().toISOString().split('T')[0]}] Exploring idea: ${ideaCard.title} — ${expansionPath?.label || 'general exploration'}`],
    }
    const updatedMemory = request.structuredMemory
      ? mergeMemoryUpdate(request.structuredMemory, memoryUpdate as any)
      : mergeMemoryUpdate(createEmptyStructuredMemory(), memoryUpdate as any)

    const followUpRequest = {
      ...request,
      structuredMemory: updatedMemory,
      message: systemInstruction,
    }
    return this.sendMessagePipeline(followUpRequest, onChunk, onPipelineState)
  }

  /**
   * Stress-test an idea — ask the model to find failure modes and weaknesses.
   */
  async handleStressTestIdea(
    ideaCard: IdeaCard,
    request: any,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void
  ): Promise<ThoughtPartnerResponse> {
    const risksStr = ideaCard.risks.length > 0 ? `Known risks: ${ideaCard.risks.join('; ')}.` : ''
    const systemInstruction = `[SYSTEM: The writer wants you to STRESS TEST the idea "${ideaCard.title}": ${ideaCard.hook}\nCore insight: ${ideaCard.coreInsight}\n${risksStr}\n\nBe rigorous. Challenge assumptions, find failure modes, identify where this breaks. Then suggest how to strengthen it. You may call propose_ideas to suggest refined alternatives.]`

    const followUpRequest = {
      ...request,
      message: systemInstruction,
    }
    return this.sendMessagePipeline(followUpRequest, onChunk, onPipelineState)
  }

  /**
   * Convert an idea into a scene or mechanic — transitions from brainstorming to execution.
   */
  async handleTurnIdeaInto(
    ideaCard: IdeaCard,
    targetType: 'scene' | 'mechanic',
    request: any,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void
  ): Promise<ThoughtPartnerResponse> {
    const typeLabel = targetType === 'scene' ? 'a scene' : 'a mechanic'
    const systemInstruction = `[SYSTEM: The writer wants to turn the idea "${ideaCard.title}" into ${typeLabel}.\nIdea: ${ideaCard.hook}\nInsight: ${ideaCard.coreInsight}\nImpact: ${ideaCard.whyItMatters}\n\nCall plan_edit or produce_plan to create concrete content from this idea. Do NOT call propose_ideas — the brainstorming phase is over for this idea.]`

    const memoryUpdate: Partial<Record<string, string[]>> = {
      decisions: [`[${new Date().toISOString().split('T')[0]}] Converting idea "${ideaCard.title}" into ${typeLabel}`],
    }
    const updatedMemory = request.structuredMemory
      ? mergeMemoryUpdate(request.structuredMemory, memoryUpdate as any)
      : mergeMemoryUpdate(createEmptyStructuredMemory(), memoryUpdate as any)

    const followUpRequest = {
      ...request,
      structuredMemory: updatedMemory,
      message: systemInstruction,
    }
    return this.sendMessagePipeline(followUpRequest, onChunk, onPipelineState)
  }

  /**
   * Merge two ideas — ask the model to synthesize them into something new.
   */
  async handleMergeIdeas(
    ideaA: IdeaCard,
    ideaB: IdeaCard,
    request: any,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void
  ): Promise<ThoughtPartnerResponse> {
    const systemInstruction = `[SYSTEM: The writer wants to MERGE two ideas into a synthesis.\n\nIdea A — "${ideaA.title}": ${ideaA.hook}\nInsight: ${ideaA.coreInsight}\n\nIdea B — "${ideaB.title}": ${ideaB.hook}\nInsight: ${ideaB.coreInsight}\n\nFind the synthesis. What new idea emerges from combining these? Call propose_ideas with 1-2 merged ideas that capture the best of both.]`

    const followUpRequest = {
      ...request,
      message: systemInstruction,
    }
    return this.sendMessagePipeline(followUpRequest, onChunk, onPipelineState)
  }

  /**
   * Execute the edit pipeline after plan_edit tool call.
   * Reads blocks → calls patcher model → verifies → retries if needed.
   */
  private async executePipeline(
    editPlan: EditPlan,
    allBlockContext: MultiDocumentBlockContext,
    templateType: string,
    userMessage: string,
    emitState: (state: PipelineState) => void,
    structuredPlan?: StructuredPlan
  ): Promise<{ patchList: PatchList; verifyResult: VerifyResult; workingSet: WorkingSet }> {
    const apiKey = this.getApiKey()
    if (!apiKey) throw new Error('No API key')

    // 1. Context Gathering — build/update BM25 index, gather relevant chunks
    emitState('context_gathering')

    this.chunkIndex = updateIndex(this.chunkIndex, allBlockContext)

    const activeDocId = allBlockContext.documents[0]?.documentId || ''
    const gatherReceipt = contextGather(
      {
        editPlan,
        userMessage,
        activeDocumentId: activeDocId,
        allBlockContext,
      },
      this.chunkIndex
    )

    const workingSet = buildWorkingSet(gatherReceipt)

    console.log(
      '[ThoughtPartner Pipeline] Context gathered:',
      gatherReceipt.totalChunksRead, 'chunks,',
      gatherReceipt.totalTokensUsed, 'tokens from',
      gatherReceipt.documentsAccessed.length, 'documents',
      gatherReceipt.stoppedEarly ? `(early stop: ${gatherReceipt.stopReason})` : ''
    )

    // 2. Call patcher model with working set
    emitState('patching')
    const targetBlockIds = editPlan.readsNeeded.flatMap(r => r.blockIds)
    let patchList = await this.callPatcherWithWorkingSet(
      editPlan, workingSet, targetBlockIds, templateType, apiKey,
      undefined, structuredPlan
    )

    // 3. Verify (with citation checking)
    emitState('verifying')
    // Build a single-doc blockContext for the verifier (uses the active document)
    const activeDocBlocks = allBlockContext.documents.find(d => d.documentId === activeDocId)
    const verifierBlockContext = activeDocBlocks ? {
      documentId: activeDocId,
      blocks: activeDocBlocks.blocks,
    } : { documentId: activeDocId, blocks: [] }
    let verifyResult = verifyPatch(patchList, editPlan, verifierBlockContext, templateType, workingSet, undefined, structuredPlan)

    // 4. Repair loop (max 1 retry)
    if (verifyResult.status === 'fail' && verifyResult.repairInstructions) {
      console.log('[ThoughtPartner Pipeline] Verification failed, retrying with repair instructions')
      emitState('repairing')

      try {
        patchList = await this.callPatcherWithWorkingSet(
          editPlan, workingSet, targetBlockIds, templateType, apiKey,
          verifyResult.repairInstructions, structuredPlan
        )

        emitState('verifying')
        verifyResult = verifyPatch(patchList, editPlan, verifierBlockContext, templateType, workingSet, undefined, structuredPlan)
      } catch (err) {
        console.error('[ThoughtPartner Pipeline] Repair retry failed:', err)
      }
    }

    return { patchList, verifyResult, workingSet }
  }

  /**
   * Call the patcher model (GPT-4o) with the working set as context.
   * The patcher sees ONLY the working set entries and must cite sourceSpanIds.
   */
  private async callPatcherWithWorkingSet(
    editPlan: EditPlan,
    workingSet: WorkingSet,
    targetBlockIds: string[],
    templateType: string,
    apiKey: string,
    repairInstructions?: string,
    structuredPlan?: StructuredPlan
  ): Promise<PatchList> {
    const isScreenplay = templateType === 'screenplay'

    // Build user prompt with edit plan + working set
    let userPrompt = `EDIT PLAN:\n`
    userPrompt += `Goal: ${editPlan.goal}\n`
    userPrompt += `Strategy: ${editPlan.patchStrategy}\n`
    userPrompt += `Scope: ${editPlan.scope}\n`
    userPrompt += `Max blocks: ${editPlan.maxBlocksAffected}\n`
    if (editPlan.constraints.length > 0) {
      userPrompt += `Constraints:\n${editPlan.constraints.map(c => `- ${c}`).join('\n')}\n`
    }
    userPrompt += '\n'

    // Inject approved plan steps and acceptance criteria
    if (structuredPlan) {
      userPrompt += `APPROVED PLAN (you MUST follow these steps):\n`
      userPrompt += `Goal: ${structuredPlan.goal}\n`
      userPrompt += `Scope: ${structuredPlan.scope}\n`
      userPrompt += `Steps:\n`
      for (const step of structuredPlan.steps) {
        userPrompt += `  ${step.id}. ${step.description}`
        if (step.targetBlockIds && step.targetBlockIds.length > 0) {
          userPrompt += ` [targets: ${step.targetBlockIds.join(', ')}]`
        }
        userPrompt += '\n'
      }
      userPrompt += `\nACCEPTANCE CRITERIA (your patches MUST satisfy ALL of these):\n`
      for (const ac of structuredPlan.acceptanceCriteria) {
        userPrompt += `- ${ac}\n`
      }
      userPrompt += '\n'
    }

    // Format the working set with span IDs
    userPrompt += formatWorkingSetForPatcher(workingSet, targetBlockIds)

    if (repairInstructions) {
      userPrompt += `\nREPAIR INSTRUCTIONS (fix these issues from the previous attempt):\n${repairInstructions}\n`
    }

    const systemPrompt = isScreenplay
      ? PATCHER_SYSTEM_PROMPT + PATCHER_SCREENPLAY_ADDENDUM
      : PATCHER_SYSTEM_PROMPT

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: PATCHER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: PATCHER_MAX_TOKENS,
        response_format: {
          type: 'json_schema',
          json_schema: PRODUCE_PATCH_SCHEMA,
        },
      }),
      signal: this.abortController?.signal,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Patcher API error (${response.status}): ${errorBody}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('Patcher returned no content')

    const parsed = JSON.parse(content)

    // Build a lookup of working set entries for anchor resolution
    const wsLookup = new Map(workingSet.entries.map(e => [e.blockId, e]))

    const ops: PatchOp[] = (parsed.ops || []).map((op: any, i: number) => {
      const blockId = op.anchorBlockId
      const wsEntry = wsLookup.get(blockId)

      return {
        id: `op-${Date.now()}-${i}`,
        type: op.type,
        anchor: wsEntry ? {
          blockId,
          documentId: wsEntry.documentId,
          originalTextHash: wsEntry.textHash,
          textSnapshot: wsEntry.text,
        } : null,
        insertPosition: op.insertPosition || 'replace',
        content: op.content,
        screenplayElements: op.screenplayElements,
        why: op.why || '',
        sourceSpanIds: op.sourceSpanIds || (wsEntry ? [wsEntry.spanId] : []),
      } satisfies PatchOp
    })

    // Compute totals
    let totalCharsChanged = 0
    const touchedBlocks = new Set<string>()

    for (const op of ops) {
      if (op.content) totalCharsChanged += op.content.length
      if (op.screenplayElements) {
        totalCharsChanged += op.screenplayElements.reduce((sum, el) => sum + el.text.length, 0)
      }
      if (op.anchor) touchedBlocks.add(op.anchor.blockId)
    }

    return {
      planId: editPlan.id,
      ops,
      totalCharsChanged,
      totalBlocksTouched: touchedBlocks.size,
    }
  }

  // ===== Legacy Methods (used when usePipeline=false) =====

  /**
   * When Agent Mode is on but the model didn't produce action blocks,
   * make a focused extraction call to convert the model's text into structured actions.
   */
  private async extractActions(responseText: string, templateType: string): Promise<ThoughtPartnerAction[]> {
    const apiKey = this.getApiKey()
    if (!apiKey) return []

    const isScreenplay = templateType === 'screenplay'
    const extractionPrompt = `You are a structured data extraction tool. Given a writing assistant's response below, extract any proposed content, characters, or props into structured action blocks.

Project type: ${templateType}

${isScreenplay
  ? `For screenplay content, convert scene descriptions, dialogue, action lines, etc. into screenplayElements.
Screenplay element types: scene-heading, action, character, dialogue, parenthetical, transition, shot.
Use @CHARACTER_NAME in action text for character references (e.g. "@JOHN enters the room").
Character names in "character" elements should be UPPERCASE.`
  : `For text content, use the "text" field with the proposed content as-is.`}

Output ONLY action blocks in this exact format. No other text. No explanations.

For content to insert into the editor:
\`\`\`action:insert-content
{
  "description": "Brief description of the content",
  ${isScreenplay
    ? '"screenplayElements": [{"type": "scene-heading", "text": "INT. LOCATION - TIME"}, {"type": "action", "text": "Description..."}, {"type": "character", "text": "CHARACTER NAME"}, {"type": "dialogue", "text": "What they say"}]'
    : '"text": "The content to insert"'}
}
\`\`\`

For new characters that should be created:
\`\`\`action:create-character
{
  "description": "Why this character",
  "name": "CHARACTER NAME"
}
\`\`\`

For new props that should be created:
\`\`\`action:create-prop
{
  "description": "Why this prop",
  "name": "PROP NAME"
}
\`\`\`

If there is absolutely no actionable content to extract, respond with exactly: NO_ACTIONS

--- ASSISTANT RESPONSE TO EXTRACT FROM ---
${responseText}
--- END ---`

    try {
      console.log('[ThoughtPartner] Running extraction fallback for agent mode...')
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: extractionPrompt }],
          max_completion_tokens: 8192
        })
      })

      if (!response.ok) {
        console.error('[ThoughtPartner] Extraction API error:', response.status)
        return []
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      console.log('[ThoughtPartner] Extraction response length:', content.length)

      if (content.includes('NO_ACTIONS')) {
        console.log('[ThoughtPartner] Extraction returned NO_ACTIONS')
        return []
      }

      const { actions } = parseResponseBlocks(content)
      console.log('[ThoughtPartner] Extraction produced', actions.length, 'actions')
      return actions
    } catch (err) {
      console.error('[ThoughtPartner] Extraction failed:', err)
      return []
    }
  }

  async sendMessage(
    request: ThoughtPartnerRequest,
    onChunk: (chunk: string) => void,
    onPipelineState?: (state: PipelineState) => void
  ): Promise<ThoughtPartnerResponse> {
    // Feature flag: route to pipeline mode if enabled
    if (request.usePipeline) {
      return this.sendMessagePipeline(request, onChunk, onPipelineState)
    }

    // Legacy mode below
    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { message: '', error: 'No API key configured. Please add your OpenAI API key in Settings.' }
    }

    const messages = buildConversationMessages(request)

    // Count questions already asked — stop offering the tool after 2
    const questionCount = request.conversationHistory.reduce((count, msg) => {
      if (msg.role === 'assistant' && (msg as any).questions?.length > 0) {
        return count + (msg as any).questions.length
      }
      return count
    }, 0)
    const includeQuestionTool = questionCount < 2

    console.log('[ThoughtPartner] questionCount:', questionCount, 'includeQuestionTool:', includeQuestionTool, 'agentMode:', request.agentMode)

    this.abortController = new AbortController()

    try {
      const requestBody: any = {
        model: MODEL,
        messages,
        max_completion_tokens: CHAT_MAX_TOKENS,
        stream: true
      }
      if (includeQuestionTool) {
        requestBody.tools = [ASK_QUESTION_TOOL]
      }

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        const errorBody = await response.text()
        let errorMessage = `API error (${response.status})`
        try {
          const parsed = JSON.parse(errorBody)
          errorMessage = parsed.error?.message || errorMessage
        } catch { /* use default */ }
        return { message: '', error: errorMessage }
      }

      const reader = response.body?.getReader()
      if (!reader) {
        return { message: '', error: 'No response stream available' }
      }

      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''

      // Track tool calls from streaming deltas
      let toolCallId = ''
      let toolCallName = ''
      let toolCallArgs = ''
      let finishReason = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const choice = parsed.choices?.[0]
            const delta = choice?.delta

            // Track finish reason
            if (choice?.finish_reason) {
              finishReason = choice.finish_reason
            }

            // Accumulate text content
            if (delta?.content) {
              fullContent += delta.content
              onChunk(delta.content)
            }

            // Accumulate tool call data from delta
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id) toolCallId = tc.id
                if (tc.function?.name) toolCallName = tc.function.name
                if (tc.function?.arguments) toolCallArgs += tc.function.arguments
              }
            }

            // Some models put tool_calls on the message object directly (non-streaming fallback)
            const message = parsed.choices?.[0]?.message
            if (message?.tool_calls) {
              for (const tc of message.tool_calls) {
                if (tc.id) toolCallId = tc.id
                if (tc.function?.name) toolCallName = tc.function.name
                if (tc.function?.arguments) toolCallArgs = tc.function.arguments
              }
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      this.abortController = null

      console.log('[ThoughtPartner] Stream complete — finishReason:', finishReason, 'toolCallName:', toolCallName, 'toolCallArgs length:', toolCallArgs.length, 'content length:', fullContent.length)

      // Parse tool call into a question if present
      let questions: ThoughtPartnerQuestion[] = []
      if (toolCallName === 'ask_question' && toolCallArgs) {
        try {
          const parsed = JSON.parse(toolCallArgs)
          const opts = parsed.options || []
          if (opts.length >= 2) {
            questions.push({
              id: `question-${Date.now()}`,
              toolCallId,
              questionText: parsed.questionText || 'What would you prefer?',
              options: opts.map((opt: any, i: number) => ({
                id: `opt-${i + 1}`,
                label: opt.label || `Option ${i + 1}`,
                description: opt.description
              })),
              allowCustom: true,
              status: 'active',
              category: parsed.category || 'general'
            })
            console.log('[ThoughtPartner] Parsed ask_question tool call:', parsed.questionText)
          }
        } catch (err) {
          console.error('[ThoughtPartner] Failed to parse ask_question tool call:', err)
        }
      }

      // Parse out actions and context update from text response
      let { cleanText, actions, contextUpdate } = parseResponseBlocks(fullContent)

      // Agent Mode extraction fallback: if agent mode is on but the model
      // didn't produce action blocks, run a focused extraction call
      if (request.agentMode && actions.length === 0 && cleanText.trim().length > 0) {
        console.log('[ThoughtPartner] Agent mode ON but no action blocks found — running extraction fallback')
        const extractedActions = await this.extractActions(cleanText, request.subconsciousContext.templateType)
        if (extractedActions.length > 0) {
          actions = extractedActions
        }
      }

      let updatedContextDocument: ContextDocument | undefined
      if (contextUpdate) {
        updatedContextDocument = mergeContextDocument(request.contextDocument, contextUpdate)
      }

      return {
        message: cleanText,
        updatedContextDocument,
        actions: actions.length > 0 ? actions : undefined,
        questions: questions.length > 0 ? questions : undefined
      }
    } catch (err: any) {
      this.abortController = null
      if (err.name === 'AbortError') {
        return { message: '', error: 'Streaming was stopped' }
      }
      return { message: '', error: err.message || 'Unknown error' }
    }
  }

  async generateSuggestions(request: ThoughtPartnerSuggestionsRequest): Promise<SuggestionCard[]> {
    const apiKey = this.getApiKey()
    if (!apiKey) return []

    // Build a concise project summary for suggestion generation
    const sub = request.subconsciousContext
    let projectSummary = `Project: "${sub.projectName}" (${sub.templateType})\n\n`

    if (sub.settings?.synopsis) {
      projectSummary += `Synopsis: ${sub.settings.synopsis}\n\n`
    }

    if (sub.characters && sub.characters.length > 0) {
      projectSummary += `Characters: ${sub.characters.map(c => c.name).join(', ')}\n\n`
    }

    // Include document titles and snippets
    for (const doc of sub.documents) {
      const snippet = doc.content.slice(0, 500)
      if (snippet.trim().length > 0) {
        projectSummary += `[${doc.title}]: ${snippet}...\n\n`
      }
    }

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SUGGESTIONS_SYSTEM_PROMPT },
            { role: 'user', content: projectSummary }
          ],
          max_completion_tokens: SUGGESTIONS_MAX_TOKENS
        })
      })

      if (!response.ok) return []

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) return []

      // Parse JSON from response (may be wrapped in markdown code block)
      let jsonStr = content
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }

      const suggestions = JSON.parse(jsonStr)
      if (!Array.isArray(suggestions)) return []

      return suggestions.map((s: any, i: number) => ({
        id: `suggestion-${Date.now()}-${i}`,
        title: s.title || 'Suggestion',
        description: s.description || '',
        category: s.category || 'explore',
        prompt: s.prompt || s.title || ''
      }))
    } catch {
      return []
    }
  }

  // --- Multi-conversation persistence ---

  private ensureDir(projectPath: string): string {
    const dirPath = path.join(projectPath, THOUGHT_PARTNER_DIR)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    return dirPath
  }

  private convFilename(conversationId: string): string {
    return `conv-${conversationId}.json`
  }

  async loadConversationIndex(projectPath: string): Promise<ConversationIndex> {
    const indexPath = path.join(projectPath, THOUGHT_PARTNER_DIR, THOUGHT_PARTNER_INDEX)

    // Check for new format first
    try {
      if (fs.existsSync(indexPath)) {
        const raw = fs.readFileSync(indexPath, 'utf-8')
        return JSON.parse(raw)
      }
    } catch {
      // Corrupted index, fall through to migration or empty
    }

    // Legacy migration: single-file format → multi-conversation
    const legacyPath = path.join(projectPath, LEGACY_FILE)
    try {
      if (fs.existsSync(legacyPath)) {
        const raw = fs.readFileSync(legacyPath, 'utf-8')
        const legacyData: ThoughtPartnerConversationData = JSON.parse(raw)

        const id = crypto.randomUUID()
        const firstUserMsg = legacyData.messages.find(m => m.role === 'user')
        const title = firstUserMsg
          ? firstUserMsg.content.slice(0, 50).replace(/\n/g, ' ').trim() + (firstUserMsg.content.length > 50 ? '...' : '')
          : 'Conversation'
        const now = new Date().toISOString()

        const meta: ConversationMeta = {
          id,
          title,
          createdAt: legacyData.messages[0]?.timestamp || now,
          updatedAt: legacyData.lastUpdated || now,
          messageCount: legacyData.messages.length
        }

        const index: ConversationIndex = {
          activeConversationId: id,
          conversations: [meta]
        }

        // Write new structure
        const dirPath = this.ensureDir(projectPath)
        fs.writeFileSync(path.join(dirPath, THOUGHT_PARTNER_INDEX), JSON.stringify(index, null, 2), 'utf-8')
        fs.writeFileSync(path.join(dirPath, this.convFilename(id)), JSON.stringify(legacyData, null, 2), 'utf-8')

        // Remove legacy file
        fs.unlinkSync(legacyPath)

        return index
      }
    } catch (err) {
      console.error('[ThoughtPartner] Legacy migration failed:', err)
    }

    return { activeConversationId: null, conversations: [] }
  }

  async saveConversationIndex(projectPath: string, index: ConversationIndex): Promise<void> {
    try {
      const dirPath = this.ensureDir(projectPath)
      fs.writeFileSync(path.join(dirPath, THOUGHT_PARTNER_INDEX), JSON.stringify(index, null, 2), 'utf-8')
    } catch (err) {
      console.error('[ThoughtPartner] Failed to save conversation index:', err)
    }
  }

  async loadConversation(projectPath: string, conversationId: string): Promise<ThoughtPartnerConversationData | null> {
    const filePath = path.join(projectPath, THOUGHT_PARTNER_DIR, this.convFilename(conversationId))
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(raw)
      }
    } catch {
      // Corrupted file
    }
    return null
  }

  async saveConversation(projectPath: string, conversationId: string, data: ThoughtPartnerConversationData): Promise<void> {
    try {
      const dirPath = this.ensureDir(projectPath)
      fs.writeFileSync(path.join(dirPath, this.convFilename(conversationId)), JSON.stringify(data, null, 2), 'utf-8')

      // Also update the index metadata
      const indexPath = path.join(dirPath, THOUGHT_PARTNER_INDEX)
      if (fs.existsSync(indexPath)) {
        const index: ConversationIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
        const meta = index.conversations.find(c => c.id === conversationId)
        if (meta) {
          meta.updatedAt = data.lastUpdated
          meta.messageCount = data.messages.length
          fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')
        }
      }
    } catch (err) {
      console.error('[ThoughtPartner] Failed to save conversation:', err)
    }
  }

  async createConversation(projectPath: string, title?: string): Promise<ConversationMeta> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const meta: ConversationMeta = {
      id,
      title: title || 'New Conversation',
      createdAt: now,
      updatedAt: now,
      messageCount: 0
    }

    const emptyData: ThoughtPartnerConversationData = {
      messages: [],
      contextDocument: createEmptyContextDocument(),
      lastUpdated: now
    }

    const dirPath = this.ensureDir(projectPath)

    // Write empty conversation file
    fs.writeFileSync(path.join(dirPath, this.convFilename(id)), JSON.stringify(emptyData, null, 2), 'utf-8')

    // Update index
    const indexPath = path.join(dirPath, THOUGHT_PARTNER_INDEX)
    let index: ConversationIndex = { activeConversationId: null, conversations: [] }
    try {
      if (fs.existsSync(indexPath)) {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
      }
    } catch { /* start fresh */ }

    index.conversations.unshift(meta)
    index.activeConversationId = id
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')

    return meta
  }

  async loadSuggestionsCache(projectPath: string): Promise<SuggestionsCache | null> {
    const filePath = path.join(projectPath, THOUGHT_PARTNER_DIR, SUGGESTIONS_CACHE_FILE)
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        return JSON.parse(raw)
      }
    } catch {
      // Corrupted cache, ignore
    }
    return null
  }

  async saveSuggestionsCache(projectPath: string, cache: SuggestionsCache): Promise<void> {
    try {
      const dirPath = this.ensureDir(projectPath)
      fs.writeFileSync(path.join(dirPath, SUGGESTIONS_CACHE_FILE), JSON.stringify(cache, null, 2), 'utf-8')
    } catch (err) {
      console.error('[ThoughtPartner] Failed to save suggestions cache:', err)
    }
  }

  async deleteConversation(projectPath: string, conversationId: string): Promise<ConversationIndex> {
    const dirPath = path.join(projectPath, THOUGHT_PARTNER_DIR)

    // Delete the conversation file
    const convPath = path.join(dirPath, this.convFilename(conversationId))
    try {
      if (fs.existsSync(convPath)) {
        fs.unlinkSync(convPath)
      }
    } catch (err) {
      console.error('[ThoughtPartner] Failed to delete conversation file:', err)
    }

    // Update the index
    const indexPath = path.join(dirPath, THOUGHT_PARTNER_INDEX)
    let index: ConversationIndex = { activeConversationId: null, conversations: [] }
    try {
      if (fs.existsSync(indexPath)) {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
      }
    } catch { /* start fresh */ }

    index.conversations = index.conversations.filter(c => c.id !== conversationId)

    // If deleted the active one, switch to the most recent remaining
    if (index.activeConversationId === conversationId) {
      index.activeConversationId = index.conversations.length > 0
        ? index.conversations[0].id
        : null
    }

    try {
      fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8')
    } catch { /* best effort */ }

    return index
  }
}

// Singleton
let instance: ThoughtPartnerService | null = null

export function getThoughtPartnerService(): ThoughtPartnerService {
  if (!instance) {
    instance = new ThoughtPartnerService()
  }
  return instance
}
