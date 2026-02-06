/**
 * Dramatic Critique Service (Writing Partner)
 * 
 * Uses OpenAI's Responses API to perform two-pass analysis:
 * 1. Pass 1: Extract structured facts (StoryFacts) from screenplay + entity docs
 * 2. Pass 2: Run critique operators over facts to find issues and generate questions
 * 
 * This acts as a "dramatic lint detector" - surfacing contradictions, dangling motivations,
 * and structural issues as pointed questions, not suggestions.
 */

import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'

// Types matching src/types/project.ts
export interface CharacterState {
  characterId: string
  name: string
  currentWants: string[]
  promises: string[]
  constraints: string[]
  relationshipStates: { with: string; state: string; scene: string }[]
  behaviorPattern: string[]
}

export interface PropState {
  propId: string
  name: string
  introduced: { scene: string; context: string } | null
  usages: { scene: string; how: string }[]
  rules: string[]
  symbolicSetup: string | null
}

export interface TimelineBeat {
  scene: string
  sceneNumber: number
  characters: string[]
  location: string
  timeOfDay: string
  impliedDuration: string | null
  keyEvents: string[]
}

export interface StoryFacts {
  characters: CharacterState[]
  props: PropState[]
  timeline: TimelineBeat[]
  establishedRules: string[]
  openPromises: string[]
}

// CinemaSins Master Index - 30 narrative sins
export type CritiqueOperator = 
  // Character/Motivation (1-4)
  | 'unclear_motivation'
  | 'motivation_shift'
  | 'behavior_contradiction'
  | 'protagonist_passivity'
  // Convenience/Coincidence (5-6)
  | 'coincidence_plotting'
  | 'convenient_information'
  // Exposition/Dialogue (7-8, 21-22)
  | 'exposition_dump'
  | 'audience_dialogue'
  | 'theme_stated'
  | 'plot_dialogue'
  // Rules/Logic (9-10, 25-26)
  | 'late_rules'
  | 'rules_broken'
  | 'impossible_knowledge'
  | 'undefined_tech'
  // Setup/Payoff (11-13)
  | 'setup_no_payoff'
  | 'payoff_no_setup'
  | 'forgotten_prop'
  // Continuity/Timeline (14-16)
  | 'location_logic'
  | 'timeline_issue'
  | 'spatial_error'
  // Stakes/Conflict (17-20, 23-24)
  | 'offscreen_resolution'
  | 'stakes_asserted'
  | 'unearned_emotion'
  | 'tonal_whiplash'
  | 'fake_conflict'
  | 'antagonist_fluctuation'
  // Structure/Ending (27-29)
  | 'montage_causality'
  | 'conflict_avoided'
  | 'consequence_dodged'
  // Meta (30)
  | 'repetition_sin'

export interface CritiqueEvidence {
  sourceDocument?: string  // Document name (e.g., "Synopsis and Appendix", "Low quality news.")
  sceneRef: string
  blockId?: string
  documentId: string
  excerpt: string
}

export type IssueSeverity = 'blocking' | 'warning' | 'optional'
export type IssueResolution = 'unresolved' | 'fixed' | 'intentional' | 'deferred'

export interface CritiqueIssue {
  id: string
  operator: CritiqueOperator
  confidence: number
  severity: IssueSeverity
  consequence: string
  deadline: string | null
  title: string
  evidence: CritiqueEvidence[]
  question: string
  context: string
  resolution: IssueResolution
  resolvedAt?: number
  resolutionNote?: string
}

// Entity doc passed to the service
export interface EntityDoc {
  type: 'character' | 'prop' | 'location'
  name: string
  content: string
}

// Supplementary document for additional context (notes, synopsis, etc.)
export interface SupplementaryDoc {
  title: string
  content: string
}

// OpenAI Chat Completions API types
interface ChatCompletionRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  response_format?: {
    type: 'json_object'
  }
  temperature?: number
  max_tokens?: number
}

interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  error?: {
    message: string
    type: string
    code?: string
  }
}

// JSON Schema for Pass 1: Story Facts extraction
const STORY_FACTS_SCHEMA = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          characterId: { type: 'string', description: 'Unique identifier for this character' },
          name: { type: 'string', description: 'Character name as appears in script' },
          currentWants: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'What this character wants in each scene they appear'
          },
          promises: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Setups that imply future payoff (e.g., "mentioned the gun in the drawer")'
          },
          constraints: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Rules established about this character (e.g., "afraid of heights")'
          },
          relationshipStates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                with: { type: 'string' },
                state: { type: 'string' },
                scene: { type: 'string' }
              },
              required: ['with', 'state', 'scene'],
              additionalProperties: false
            },
            description: 'How relationships change across scenes'
          },
          behaviorPattern: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'How this character typically acts or responds'
          }
        },
        required: ['characterId', 'name', 'currentWants', 'promises', 'constraints', 'relationshipStates', 'behaviorPattern'],
        additionalProperties: false
      }
    },
    props: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          propId: { type: 'string', description: 'Unique identifier for this prop' },
          name: { type: 'string', description: 'Prop name' },
          introduced: { 
            type: ['object', 'null'],
            properties: {
              scene: { type: 'string' },
              context: { type: 'string' }
            },
            required: ['scene', 'context'],
            additionalProperties: false,
            description: 'When and how the prop was first introduced'
          },
          usages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scene: { type: 'string' },
                how: { type: 'string' }
              },
              required: ['scene', 'how'],
              additionalProperties: false
            },
            description: 'Each time the prop is used and how'
          },
          rules: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Established rules about how the prop works'
          },
          symbolicSetup: { 
            type: ['string', 'null'],
            description: 'Implied symbolic meaning that has not yet paid off'
          }
        },
        required: ['propId', 'name', 'introduced', 'usages', 'rules', 'symbolicSetup'],
        additionalProperties: false
      }
    },
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          scene: { type: 'string', description: 'Scene heading' },
          sceneNumber: { type: 'number', description: 'Sequential scene number' },
          characters: { type: 'array', items: { type: 'string' }, description: 'Characters present' },
          location: { type: 'string', description: 'Location name' },
          timeOfDay: { type: 'string', description: 'DAY, NIGHT, DAWN, etc.' },
          impliedDuration: { type: ['string', 'null'], description: 'How long this scene seems to take' },
          keyEvents: { type: 'array', items: { type: 'string' }, description: 'Major events that happen' }
        },
        required: ['scene', 'sceneNumber', 'characters', 'location', 'timeOfDay', 'impliedDuration', 'keyEvents'],
        additionalProperties: false
      }
    },
    establishedRules: {
      type: 'array',
      items: { type: 'string' },
      description: 'World rules established by the story (e.g., "vampires can\'t enter without invitation")'
    },
    openPromises: {
      type: 'array',
      items: { type: 'string' },
      description: 'Setups that have not yet paid off'
    }
  },
  required: ['characters', 'props', 'timeline', 'establishedRules', 'openPromises'],
  additionalProperties: false
}

// JSON Schema for Pass 2: Critique Issues
const CRITIQUE_ISSUES_SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          operator: {
            type: 'string',
            enum: [
              // Character/Motivation (1-4)
              'unclear_motivation', 'motivation_shift', 'behavior_contradiction', 'protagonist_passivity',
              // Convenience/Coincidence (5-6)
              'coincidence_plotting', 'convenient_information',
              // Exposition/Dialogue (7-8, 21-22)
              'exposition_dump', 'audience_dialogue', 'theme_stated', 'plot_dialogue',
              // Rules/Logic (9-10, 25-26)
              'late_rules', 'rules_broken', 'impossible_knowledge', 'undefined_tech',
              // Setup/Payoff (11-13)
              'setup_no_payoff', 'payoff_no_setup', 'forgotten_prop',
              // Continuity/Timeline (14-16)
              'location_logic', 'timeline_issue', 'spatial_error',
              // Stakes/Conflict (17-20, 23-24)
              'offscreen_resolution', 'stakes_asserted', 'unearned_emotion', 'tonal_whiplash', 'fake_conflict', 'antagonist_fluctuation',
              // Structure/Ending (27-29)
              'montage_causality', 'conflict_avoided', 'consequence_dodged',
              // Meta (30)
              'repetition_sin'
            ],
            description: 'The CinemaSins narrative sin type detected'
          },
          confidence: {
            type: 'number',
            description: 'Confidence level 0-1. Only report if >= 0.6'
          },
          severity: {
            type: 'string',
            enum: ['blocking', 'warning', 'optional'],
            description: 'blocking = cannot progress cleanly without addressing; warning = debt accumulating; optional = texture/polish'
          },
          consequence: {
            type: 'string',
            description: 'Specific downstream failure: "If [this issue remains], then [specific thing] will fail/break"'
          },
          deadline: {
            type: ['string', 'null'],
            description: 'When this must be resolved (e.g., "by Act 2", "before the climax", "by scene 5") or null if no timing pressure'
          },
          title: {
            type: 'string',
            description: 'Brief 5-10 word label for the issue'
          },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sourceDocument: { type: 'string', description: 'The document this evidence comes from (e.g., "Synopsis and Appendix", "Low quality news.", or the script page title)' },
                sceneRef: { type: 'string', description: 'Scene or section reference (e.g., "Scene 3: INT. KITCHEN - NIGHT" or "Character Background section")' },
                excerpt: { type: 'string', description: 'EXACT quote from the document - copy the text verbatim, do not paraphrase' }
              },
              required: ['sourceDocument', 'sceneRef', 'excerpt'],
              additionalProperties: false
            },
            description: 'Evidence citations from script pages AND/OR supplementary documents (synopsis, notes). MUST include at least one specific quote.'
          },
          question: {
            type: 'string',
            description: 'A pointed question to the writer that would resolve this issue. DO NOT give answers or suggestions.'
          },
          context: {
            type: 'string',
            description: 'Brief explanation of why this matters structurally'
          }
        },
        required: ['operator', 'confidence', 'severity', 'consequence', 'deadline', 'title', 'evidence', 'question', 'context'],
        additionalProperties: false
      }
    }
  },
  required: ['issues'],
  additionalProperties: false
}

// System prompt for Pass 1: Fact Extraction
const PASS1_SYSTEM_INSTRUCTIONS = `You are a script supervisor extracting structured facts from a screenplay.

Your job is to extract ONLY what is explicitly stated or strongly implied. Output structured JSON.

You may be provided with BACKGROUND CONTEXT (synopsis, notes, appendices) that provides additional information about the story, characters, and world. Use this to inform your understanding, but focus your extraction on what appears in the SCREENPLAY itself. The background context helps you understand authorial intent and planned story elements.

For each CHARACTER, track:
- What they want in each scene (goals, desires)
- Promises/setups that imply future payoff
- Constraints established about them (fears, limitations, rules)
- Relationship states with other characters and how they change
- Behavior patterns (how they typically respond to situations)

For each PROP, track:
- PROPS are physical objects that characters can pick up, use, or interact with
- Examples: guns, keys, letters, phones, photographs, vehicles, weapons, documents
- DO NOT include locations/settings (places where scenes happen) as props
- DO NOT include location names from scene headings (e.g., "LAKESIDE", "THE WAREHOUSE", "HOSPITAL")
- Location names that appear in INT./EXT. scene headings are SETTINGS, not props
- When and where the prop was introduced
- Each usage (scene and how it's used physically by characters)
- Any rules established about how it works
- Symbolic setup that hasn't paid off yet

For TIMELINE, track:
- Scene order, location, time of day
- Characters present in each scene
- Implied duration
- Key events

Also track:
- Established world rules
- Open promises (setups without payoffs)

CRITICAL: Extract only what the text supports. Do NOT interpret, speculate, or add meaning.
If something is ambiguous, do not include it.`

// System prompt for Pass 2: CinemaSins-style critique
const PASS2_SYSTEM_INSTRUCTIONS = `You are a ruthless script analyst operating like CinemaSins. Your job is to identify NARRATIVE SINS from the audience's perspective—not what the writer intended, but what's actually on screen.

You have been given extracted STORY FACTS. The facts may have been informed by BACKGROUND CONTEXT (synopsis, notes) that the writer provided. Use this background knowledge to understand what the writer INTENDS, but judge based on what's ACTUALLY in the screenplay. If something is clear in the notes but unclear in the script, that's still a sin—the audience won't read the notes.

Scan for these 30 sins. Each sin is +1 to the counter.

=== THE 30 SINS ===

CHARACTER/MOTIVATION SINS:
1. UNCLEAR_MOTIVATION: Character takes action but audience cannot identify their want or goal
2. MOTIVATION_SHIFT: Character's motivation changes without on-screen cause or development
3. BEHAVIOR_CONTRADICTION: Character acts against their established pattern without explanation
4. PROTAGONIST_PASSIVITY: Protagonist reacts to events rather than driving them; lacks agency

CONVENIENCE/COINCIDENCE SINS:
5. COINCIDENCE_PLOTTING: A coincidence or lucky break drives the plot forward
6. CONVENIENT_INFORMATION: Information arrives exactly when characters need it (phone call, overheard conversation, found document)

EXPOSITION/DIALOGUE SINS:
7. EXPOSITION_DUMP: Characters explain backstory or context instead of dramatizing it
8. AUDIENCE_DIALOGUE: Characters say things only the audience needs to know, not things real people would say
21. THEME_STATED: Theme is stated explicitly in dialogue instead of shown through action
22. PLOT_DIALOGUE: Dialogue exists solely to move plot forward, not to reveal character

RULES/LOGIC SINS:
9. LATE_RULES: A rule or ability is introduced only after it would have been useful earlier
10. RULES_BROKEN: Established rules are violated without consequence or acknowledgment
25. IMPOSSIBLE_KNOWLEDGE: Character knows information they have no way of knowing
26. UNDEFINED_TECH: Technology or magic solves problems without established rules or limits

SETUP/PAYOFF SINS:
11. SETUP_NO_PAYOFF: Prominent setup, foreshadowing, or promise that never pays off
12. PAYOFF_NO_SETUP: Major element arrives without any prior setup
13. FORGOTTEN_PROP: Physical prop is introduced prominently, then completely forgotten

CONTINUITY/TIMELINE SINS:
14. LOCATION_LOGIC: Characters move between locations in ways that don't make physical sense
15. TIMELINE_ISSUE: Events cannot fit the implied time between scenes
16. SPATIAL_ERROR: Spatial relationship between elements is inconsistent within a scene

STAKES/CONFLICT SINS:
17. OFFSCREEN_RESOLUTION: A problem is resolved offscreen or in a way the audience doesn't witness
18. STAKES_ASSERTED: Stakes are told to the audience but never demonstrated or felt
19. UNEARNED_EMOTION: Emotional beat (death, reunion, triumph) arrives without sufficient buildup
20. TONAL_WHIPLASH: Jarring tonal shift that breaks audience investment
23. FAKE_CONFLICT: Conflict is introduced and immediately resolved in the same scene
24. ANTAGONIST_FLUCTUATION: Antagonist is competent or incompetent based on plot convenience

STRUCTURE/ENDING SINS:
27. MONTAGE_CAUSALITY: A montage is used to skip over causal development the story needed
28. CONFLICT_AVOIDED: Story avoids confrontation to reach its ending
29. CONSEQUENCE_DODGED: Ending fails to address or pay off established consequences

META SIN:
30. REPETITION_SIN: The same sin occurs 3+ times without escalation or variation (compounds)

=== AUDIENCE PERSPECTIVE ===

CRITICAL: Judge ONLY what the audience can perceive on screen.
- NO charity for "the writer probably meant..."
- NO credit for subtext that isn't legible
- If it's not clear to the audience, it's sinful
- Intent doesn't matter. Execution does.

=== SEVERITY LEVELS ===

BLOCKING: Story logic breaks. Audience checks out.
- Protagonist has no discernible motivation before driving major action
- Timeline impossibility that breaks causality
- Rules contradiction that makes scenes illogical
- Payoff with zero setup for plot-critical element

WARNING: Debt accumulating. Audience trust eroding.
- Unfired setups the audience will remember
- Stakes drift that weakens tension
- Convenient coincidences that strain belief
- Exposition dumps that slow momentum

OPTIONAL: Polish issues. Wouldn't stop a good movie.
- Minor continuity errors
- Theme stated when already shown
- Tonal inconsistencies

=== CONSEQUENCE FRAMING ===

Every sin MUST state what it costs:
"If [sin], then [specific audience experience failure]"

Examples:
- "If the protagonist has no clear motivation, the audience has no one to root for"
- "If this gun is never fired, it's a broken promise that makes the story feel sloppy"
- "If this coincidence solves the problem, the victory feels unearned"

=== OUTPUT REQUIREMENTS ===

For EACH sin detected:
1. operator: The exact sin type from the 30 sins
2. confidence: 0.0-1.0 (only report if >= 0.6)
3. severity: blocking/warning/optional
4. consequence: What the audience loses or experiences negatively
5. deadline: "by Act 2" / "by the climax" / null
6. title: Brief 5-10 word label
7. evidence: REQUIRED - You MUST provide specific citations:
   - sourceDocument: Name of the document (script page title or supplementary doc like "Synopsis and Appendix")
   - sceneRef: The specific scene heading or section
   - excerpt: The EXACT quote copied verbatim from the text - DO NOT paraphrase
8. question: Corner the writer—demand a decision, don't suggest

=== EVIDENCE REQUIREMENTS ===

CRITICAL: Every issue MUST have at least one piece of evidence with an EXACT quote.
- If claiming a character has no motivation, QUOTE the text that shows them acting without stated goals
- If claiming information arrives conveniently, QUOTE the dialogue where the information is delivered
- If referencing something from the background context, cite that document specifically
- NO issue without textual evidence. If you can't quote it, don't report it.

Example evidence format:
{
  "sourceDocument": "Low quality news.",
  "sceneRef": "Scene 1: INT. NEWSROOM - DAY",
  "excerpt": "DONNIE enters, looks around confused."
}

CRITICAL: You are the audience's advocate. The counter is ticking. Be ruthless - but back up every claim with a direct quote.`

export class DramaticCritiqueService {
  private store: Store
  private isGenerating: boolean = false

  constructor() {
    this.store = new Store({
      name: 'image-generation-settings',
      encryptionKey: 'cadmus-image-gen-v1'
    })
  }

  /**
   * Check if an API key is configured
   */
  hasApiKey(): boolean {
    const apiKey = this.store.get('apiKey') as string | undefined
    return !!apiKey && apiKey.length > 0
  }

  /**
   * Get the API key
   */
  private getApiKey(): string | null {
    const apiKey = this.store.get('apiKey') as string | undefined
    return apiKey && apiKey.length > 0 ? apiKey : null
  }

  /**
   * Main entry point: Generate critique issues for the screenplay
   */
  async generateCritique(
    screenplayText: string,
    entityDocs: EntityDoc[],
    supplementaryDocs?: SupplementaryDoc[]
  ): Promise<CritiqueIssue[]> {
    if (this.isGenerating) {
      console.log('[DramaticCritique] Already generating, skipping...')
      return []
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      console.log('[DramaticCritique] No API key configured')
      return []
    }

    if (!screenplayText || screenplayText.trim().length === 0) {
      console.log('[DramaticCritique] No screenplay text to analyze')
      return []
    }

    this.isGenerating = true
    const suppCount = supplementaryDocs?.length || 0
    console.log(`[DramaticCritique] Starting two-pass analysis (${suppCount} supplementary docs)...`)

    try {
      // Pass 1: Extract story facts
      console.log('[DramaticCritique] Pass 1: Extracting story facts...')
      const storyFacts = await this.extractStoryFacts(screenplayText, entityDocs, supplementaryDocs, apiKey)
      
      if (!storyFacts) {
        console.log('[DramaticCritique] Pass 1 failed to extract facts')
        return []
      }

      console.log('[DramaticCritique] Pass 1 complete:', {
        characters: storyFacts.characters.length,
        props: storyFacts.props.length,
        timeline: storyFacts.timeline.length,
        rules: storyFacts.establishedRules.length,
        promises: storyFacts.openPromises.length
      })

      // Pass 2: Run critique operators
      console.log('[DramaticCritique] Pass 2: Running critique operators...')
      const issues = await this.runCritiqueOperators(storyFacts, screenplayText, apiKey)

      // Filter by confidence threshold, add IDs, and set default resolution
      const filteredIssues = issues
        .filter(issue => issue.confidence >= 0.6)
        .map(issue => ({
          ...issue,
          id: uuidv4(),
          resolution: 'unresolved' as IssueResolution
        }))

      console.log(`[DramaticCritique] Pass 2 complete: ${filteredIssues.length} issues (filtered from ${issues.length})`)
      return filteredIssues

    } catch (error) {
      console.error('[DramaticCritique] Error during critique:', error)
      return []
    } finally {
      this.isGenerating = false
    }
  }

  /**
   * Pass 1: Extract structured story facts
   */
  private async extractStoryFacts(
    screenplayText: string,
    entityDocs: EntityDoc[],
    supplementaryDocs: SupplementaryDoc[] | undefined,
    apiKey: string
  ): Promise<StoryFacts | null> {
    // Build input with screenplay, supplementary context, and entity docs
    let input = ''
    
    // Add supplementary context first (synopsis, notes, etc.) as background
    if (supplementaryDocs && supplementaryDocs.length > 0) {
      input += `=== BACKGROUND CONTEXT ===\nThe following documents provide background context, story notes, and additional information about the world, characters, and plot:\n\n`
      for (const doc of supplementaryDocs) {
        input += `--- ${doc.title} ---\n${doc.content}\n\n`
      }
      input += `\n`
    }
    
    input += `=== SCREENPLAY ===\n\n${screenplayText}\n\n`

    if (entityDocs.length > 0) {
      input += `=== ENTITY DOCUMENTS ===\n\n`
      for (const doc of entityDocs) {
        input += `[${doc.type.toUpperCase()}: ${doc.name}]\n${doc.content}\n---\n`
      }
    }

    // Truncate if too long
    const maxChars = 120000
    if (input.length > maxChars) {
      input = input.slice(0, maxChars) + '\n\n[Content truncated due to length...]'
    }

    const response = await this.callChatCompletionsAPI(
      input,
      PASS1_SYSTEM_INSTRUCTIONS,
      'story_facts',
      STORY_FACTS_SCHEMA,
      apiKey,
      0.3 // Low temperature for factual extraction
    )

    return this.parseResponse<StoryFacts>(response)
  }

  /**
   * Pass 2: Run critique operators over extracted facts
   */
  private async runCritiqueOperators(
    facts: StoryFacts,
    screenplayText: string,
    apiKey: string
  ): Promise<Omit<CritiqueIssue, 'id' | 'resolution' | 'resolvedAt' | 'resolutionNote'>[]> {
    // Build input with facts and original screenplay for reference
    const factsJson = JSON.stringify(facts, null, 2)
    
    // Include a truncated version of the screenplay for quote verification
    const truncatedScreenplay = screenplayText.length > 50000 
      ? screenplayText.slice(0, 50000) + '\n[Truncated...]'
      : screenplayText

    const input = `EXTRACTED STORY FACTS:\n\n${factsJson}\n\nORIGINAL SCREENPLAY (for quote verification):\n\n${truncatedScreenplay}`

    const response = await this.callChatCompletionsAPI(
      input,
      PASS2_SYSTEM_INSTRUCTIONS,
      'critique_issues',
      CRITIQUE_ISSUES_SCHEMA,
      apiKey,
      0.5 // Moderate temperature for balanced critique
    )

    const result = this.parseResponse<{ issues: Omit<CritiqueIssue, 'id' | 'resolution' | 'resolvedAt' | 'resolutionNote'>[] }>(response)
    
    if (!result || !result.issues) {
      return []
    }

    // Add placeholder documentId to evidence (will be resolved by frontend)
    return result.issues.map(issue => ({
      ...issue,
      evidence: issue.evidence.map(e => ({
        ...e,
        documentId: '' // Frontend will resolve this from sceneRef
      }))
    }))
  }

  /**
   * Call the OpenAI Chat Completions API
   */
  private async callChatCompletionsAPI(
    input: string,
    instructions: string,
    schemaName: string,
    schema: object,
    apiKey: string,
    temperature: number = 0.5
  ): Promise<ChatCompletionResponse> {
    // Build system prompt with schema instructions
    const systemPrompt = `${instructions}

You MUST respond with valid JSON matching this schema:
${JSON.stringify(schema, null, 2)}

Respond ONLY with the JSON object, no other text.`

    const requestBody: ChatCompletionRequest = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input }
      ],
      response_format: { type: 'json_object' },
      temperature: temperature,
      max_tokens: 8192
    }

    console.log(`[DramaticCritique] Calling OpenAI Chat Completions API (${schemaName})...`)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `API request failed with status ${response.status}`
      console.error('[DramaticCritique] API error:', errorMessage)
      throw new Error(errorMessage)
    }

    const data = await response.json() as ChatCompletionResponse

    if (data.error) {
      throw new Error(data.error.message || 'AI response generation failed')
    }

    if (data.usage) {
      console.log(`[DramaticCritique] Token usage: ${data.usage.prompt_tokens} in, ${data.usage.completion_tokens} out`)
    }

    return data
  }

  /**
   * Parse the API response and extract the output
   */
  private parseResponse<T>(response: ChatCompletionResponse): T | null {
    const choice = response.choices?.[0]
    if (!choice) {
      console.warn('[DramaticCritique] No choices in response')
      return null
    }

    const content = choice.message?.content
    if (!content) {
      console.warn('[DramaticCritique] No content in response')
      return null
    }

    try {
      const parsed = JSON.parse(content) as T
      return parsed
    } catch (parseError) {
      console.error('[DramaticCritique] Failed to parse response JSON:', parseError)
      console.error('[DramaticCritique] Raw content:', content.slice(0, 500))
      return null
    }
  }
}

// Singleton instance
let instance: DramaticCritiqueService | null = null

export function getDramaticCritiqueService(): DramaticCritiqueService {
  if (!instance) {
    instance = new DramaticCritiqueService()
  }
  return instance
}
