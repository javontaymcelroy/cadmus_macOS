/**
 * Document Generation Service
 * 
 * Uses OpenAI's Responses API to analyze script content and generate
 * production-focused reference documents for characters, props, and locations.
 * These are internal decision filters for production departments - not audience-facing content.
 */

import Store from 'electron-store'

// Script context passed to the service
export interface ScriptContext {
  sceneHeading: string
  elementType: 'character' | 'dialogue' | 'action' | 'parenthetical'
  content: string
  surroundingContext?: string // Additional context from surrounding blocks
}

// Character document output structure
export interface CharacterDocOutput {
  roleInStory: string
  backstory: string
  psychologyUnderStress: string
  physicalDescription: string
  wardrobeLogic: string
  movementHabits: string
  voiceSpeechPatterns: string
  relationshipToEnvironment: string
  arc: string
}

// Prop document output structure
export interface PropDocOutput {
  functionInPlot: string
  physicalDescription: string
  condition: string
  rulesLimitations: string
  symbolicWeight: string
  howUsedOnScreen: string
}

// Location document output structure
export interface LocationDocOutput {
  purpose: string
  moodTone: string
  visualLanguage: string
  soundProfile: string
  stateOfDecayOrOrder: string
  rulesOfSpace: string
  howCharactersBehaveHere: string
}

// Act break document output structure
export interface ActBreakDocOutput {
  plotSummary: string
  themes: string[]
  characterArcs: string[]
}

// Supplementary document for additional context (notes, synopsis, etc.)
export interface SupplementaryDocument {
  title: string
  content: string  // Plain text content
}

// OpenAI Responses API types
interface OpenAIResponsesRequest {
  model: string
  input: string
  instructions: string
  text?: {
    format: {
      type: 'json_schema'
      name: string
      schema: object
      strict: boolean
    }
  }
  temperature?: number
  max_output_tokens?: number
}

interface OpenAIResponseOutput {
  type: string
  id: string
  status: string
  role: string
  content: Array<{
    type: string
    text: string
  }>
}

interface OpenAIResponsesResponse {
  id: string
  object: string
  created_at: number
  status: string
  error?: {
    message: string
    type: string
    code?: string
  }
  output: OpenAIResponseOutput[]
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

// JSON Schema for character document output
const CHARACTER_DOC_SCHEMA = {
  type: 'object',
  properties: {
    roleInStory: {
      type: 'string',
      description: 'Function in the story (not job title). What purpose does this character serve narratively?'
    },
    backstory: {
      type: 'string',
      description: 'Only backstory elements that affect behavior shown onscreen. What shaped who they are now?'
    },
    psychologyUnderStress: {
      type: 'string',
      description: 'How does this character respond to pressure? Fight, flight, freeze, manipulate?'
    },
    physicalDescription: {
      type: 'string',
      description: 'What reads on camera - age, build, distinguishing features, how they carry themselves.'
    },
    wardrobeLogic: {
      type: 'string',
      description: 'Why they wear what they wear. What does clothing communicate about character?'
    },
    movementHabits: {
      type: 'string',
      description: 'Physical habits, gestures, how they move through space. Actor/blocking notes.'
    },
    voiceSpeechPatterns: {
      type: 'string',
      description: 'How they speak - vocabulary level, rhythm, verbal tics, what they avoid saying.'
    },
    relationshipToEnvironment: {
      type: 'string',
      description: 'How they interact with spaces and objects. Comfortable? Out of place? Territorial?'
    },
    arc: {
      type: 'string',
      description: 'Where they start vs where they end. The transformation or revelation.'
    }
  },
  required: [
    'roleInStory', 'backstory', 'psychologyUnderStress', 'physicalDescription',
    'wardrobeLogic', 'movementHabits', 'voiceSpeechPatterns', 'relationshipToEnvironment', 'arc'
  ],
  additionalProperties: false
}

// JSON Schema for prop document output
const PROP_DOC_SCHEMA = {
  type: 'object',
  properties: {
    functionInPlot: {
      type: 'string',
      description: 'What role does this prop serve in the story mechanics?'
    },
    physicalDescription: {
      type: 'string',
      description: 'What it looks like - size, material, color, distinctive features.'
    },
    condition: {
      type: 'string',
      description: 'State of the object - new, worn, damaged, modified, pristine.'
    },
    rulesLimitations: {
      type: 'string',
      description: 'How it works, what it can/cannot do, constraints on its use.'
    },
    symbolicWeight: {
      type: 'string',
      description: 'Optional thematic meaning - but keep minimal, do not overdo.'
    },
    howUsedOnScreen: {
      type: 'string',
      description: 'How characters interact with it. Blocking and handling notes.'
    }
  },
  required: [
    'functionInPlot', 'physicalDescription', 'condition',
    'rulesLimitations', 'symbolicWeight', 'howUsedOnScreen'
  ],
  additionalProperties: false
}

// JSON Schema for location document output
const LOCATION_DOC_SCHEMA = {
  type: 'object',
  properties: {
    purpose: {
      type: 'string',
      description: 'Story function + in-world function. Why scenes happen here.'
    },
    moodTone: {
      type: 'string',
      description: 'Emotional quality of the space. What should audience feel here?'
    },
    visualLanguage: {
      type: 'string',
      description: 'Shape language, scale, color palette, architectural style.'
    },
    soundProfile: {
      type: 'string',
      description: 'Ambient sounds, acoustics, what we hear in this space.'
    },
    stateOfDecayOrOrder: {
      type: 'string',
      description: 'Is it maintained? Falling apart? Sterile? Lived-in?'
    },
    rulesOfSpace: {
      type: 'string',
      description: 'Physical rules - gravity, power, visibility, access, hazards.'
    },
    howCharactersBehaveHere: {
      type: 'string',
      description: 'How does this space affect character behavior? Comfortable? On guard?'
    }
  },
  required: [
    'purpose', 'moodTone', 'visualLanguage', 'soundProfile',
    'stateOfDecayOrOrder', 'rulesOfSpace', 'howCharactersBehaveHere'
  ],
  additionalProperties: false
}

// JSON Schema for act break document output
const ACT_BREAK_DOC_SCHEMA = {
  type: 'object',
  properties: {
    plotSummary: {
      type: 'string',
      description: 'A concise summary of the major plot events and story beats in this act.'
    },
    themes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key themes, motifs, and recurring ideas explored in this act.'
    },
    characterArcs: {
      type: 'array',
      items: { type: 'string' },
      description: 'How major characters develop, change, or reveal themselves in this act. One entry per character.'
    }
  },
  required: ['plotSummary', 'themes', 'characterArcs'],
  additionalProperties: false
}

// System prompt for character documents
const CHARACTER_SYSTEM_INSTRUCTIONS = `You are a script supervisor analyzing a screenplay to build production reference documents for a CHARACTER.

Your job is to extract ONLY what is explicitly stated or strongly implied in the provided materials.
Focus on details that affect: performance, wardrobe, blocking, lighting, sound, VFX.

Guidelines:
- Extract only what the materials support - do NOT invent or assume details
- Use bullet points, not prose
- Be specific and concrete where the materials are specific
- If a section has no relevant information, write "No script evidence yet."
- These docs are for production departments: director, costume, VFX, sound, blocking
- Do not write character bios or fan wiki content - this is a decision filter
- If supplementary context documents (synopsis, notes) are provided, use them to inform your understanding of the character's role and motivations, but prioritize concrete script evidence for production-specific details

The script excerpts show scenes where this character appears, with surrounding context. Supplementary documents may provide additional story context.`

// System prompt for prop documents
const PROP_SYSTEM_INSTRUCTIONS = `You are a script supervisor analyzing a screenplay to build production reference documents for a PROP.

Your job is to extract ONLY what is explicitly stated or strongly implied in the provided materials.
Focus on details that affect: props department, VFX, blocking, story mechanics.

Guidelines:
- Extract only what the materials support - do NOT invent or assume details
- Use bullet points, not prose
- Be specific about physical attributes and handling
- If a section has no relevant information, write "No script evidence yet."
- Props are not random - they support story mechanics
- Do not add symbolic meaning unless the materials strongly imply it
- If supplementary context documents (synopsis, notes) are provided, use them to inform your understanding of the prop's significance and function, but prioritize concrete script evidence for production-specific details

The script excerpts show scenes where this prop appears or is mentioned. Supplementary documents may provide additional story context.`

// System prompt for location documents
const LOCATION_SYSTEM_INSTRUCTIONS = `You are a script supervisor analyzing a screenplay to build production reference documents for a LOCATION.

Your job is to extract ONLY what is explicitly stated or strongly implied in the provided script excerpts.
Focus on details that affect: blocking, lighting, sound design, set design, production design.

Guidelines:
- Extract only what the script supports - do NOT invent or assume details
- Use bullet points, not prose
- Note how the space is used in scenes, not just described
- If a section has no relevant information in the script, write "No script evidence yet."
- Locations reinforce story and tension
- Consider what happens in this space, not just what it looks like

The script excerpts show scenes set in this location.`

// System prompt for act break documents
const ACT_BREAK_SYSTEM_INSTRUCTIONS = `You are a script supervisor analyzing an ACT of a screenplay to create a summary document for the writing team.

Your job is to analyze the provided script content for this act and extract:
1. A plot summary covering the major events and story beats
2. Key themes and motifs that emerge in this act
3. Character arcs - how each major character develops or reveals themselves

Guidelines:
- Focus on what actually happens in the script, not speculation
- Keep the plot summary concise but complete - cover all major story beats
- Identify 3-5 key themes that are demonstrated through action or dialogue
- For character arcs, note the transformation or revelation for each significant character
- Use bullet points for themes and character arcs
- Be specific and reference actual events from the script

This document helps writers track the structural and thematic elements of their act.`

export class DocumentGenerationService {
  private store: Store
  private isGenerating: boolean = false

  constructor() {
    // Use the same store as image generation for API key
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
   * Generate a character document from script context
   */
  async generateCharacterDoc(
    characterName: string,
    scriptContexts: ScriptContext[],
    supplementaryDocs?: SupplementaryDocument[]
  ): Promise<CharacterDocOutput | null> {
    if (this.isGenerating) {
      console.log('[DocumentGeneration] Already generating, skipping...')
      return null
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      console.log('[DocumentGeneration] No API key configured')
      return null
    }

    const suppCount = supplementaryDocs?.length || 0
    
    // Need either script contexts or supplementary docs to generate
    if (scriptContexts.length === 0 && suppCount === 0) {
      console.log('[DocumentGeneration] No script context or supplementary docs to analyze')
      return null
    }

    this.isGenerating = true
    console.log(`[DocumentGeneration] Generating character doc for "${characterName}" from ${scriptContexts.length} context(s) and ${suppCount} supplementary doc(s)...`)

    try {
      const inputText = this.buildInputText(characterName, 'character', scriptContexts, supplementaryDocs)
      const response = await this.callResponsesAPI(
        inputText,
        CHARACTER_SYSTEM_INSTRUCTIONS,
        'character_document',
        CHARACTER_DOC_SCHEMA,
        apiKey
      )

      const result = this.parseResponse<CharacterDocOutput>(response)
      console.log(`[DocumentGeneration] Generated character doc for "${characterName}"`)
      return result

    } catch (error) {
      console.error('[DocumentGeneration] Error generating character doc:', error)
      return null
    } finally {
      this.isGenerating = false
    }
  }

  /**
   * Generate a prop document from script context
   */
  async generatePropDoc(
    propName: string,
    scriptContexts: ScriptContext[],
    supplementaryDocs?: SupplementaryDocument[]
  ): Promise<PropDocOutput | null> {
    if (this.isGenerating) {
      console.log('[DocumentGeneration] Already generating, skipping...')
      return null
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      console.log('[DocumentGeneration] No API key configured')
      return null
    }

    const suppCount = supplementaryDocs?.length || 0
    
    // Need either script contexts or supplementary docs to generate
    if (scriptContexts.length === 0 && suppCount === 0) {
      console.log('[DocumentGeneration] No script context or supplementary docs to analyze')
      return null
    }

    this.isGenerating = true
    console.log(`[DocumentGeneration] Generating prop doc for "${propName}" from ${scriptContexts.length} context(s) and ${suppCount} supplementary doc(s)...`)

    try {
      const inputText = this.buildInputText(propName, 'prop', scriptContexts, supplementaryDocs)
      const response = await this.callResponsesAPI(
        inputText,
        PROP_SYSTEM_INSTRUCTIONS,
        'prop_document',
        PROP_DOC_SCHEMA,
        apiKey
      )

      const result = this.parseResponse<PropDocOutput>(response)
      console.log(`[DocumentGeneration] Generated prop doc for "${propName}"`)
      return result

    } catch (error) {
      console.error('[DocumentGeneration] Error generating prop doc:', error)
      return null
    } finally {
      this.isGenerating = false
    }
  }

  /**
   * Generate a location document from script context
   */
  async generateLocationDoc(
    locationName: string,
    scriptContexts: ScriptContext[]
  ): Promise<LocationDocOutput | null> {
    if (this.isGenerating) {
      console.log('[DocumentGeneration] Already generating, skipping...')
      return null
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      console.log('[DocumentGeneration] No API key configured')
      return null
    }

    if (scriptContexts.length === 0) {
      console.log('[DocumentGeneration] No script context to analyze')
      return null
    }

    this.isGenerating = true
    console.log(`[DocumentGeneration] Generating location doc for "${locationName}" from ${scriptContexts.length} context(s)...`)

    try {
      const inputText = this.buildInputText(locationName, 'location', scriptContexts)
      const response = await this.callResponsesAPI(
        inputText,
        LOCATION_SYSTEM_INSTRUCTIONS,
        'location_document',
        LOCATION_DOC_SCHEMA,
        apiKey
      )

      const result = this.parseResponse<LocationDocOutput>(response)
      console.log(`[DocumentGeneration] Generated location doc for "${locationName}"`)
      return result

    } catch (error) {
      console.error('[DocumentGeneration] Error generating location doc:', error)
      return null
    } finally {
      this.isGenerating = false
    }
  }

  /**
   * Generate an act break document from the act's script content
   */
  async generateActBreakDoc(
    actName: string,
    actScriptContent: string
  ): Promise<ActBreakDocOutput | null> {
    if (this.isGenerating) {
      console.log('[DocumentGeneration] Already generating, skipping...')
      return null
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      console.log('[DocumentGeneration] No API key configured')
      return null
    }

    if (!actScriptContent || actScriptContent.trim().length === 0) {
      console.log('[DocumentGeneration] No act content to analyze')
      return null
    }

    this.isGenerating = true
    console.log(`[DocumentGeneration] Generating act break doc for "${actName}"...`)

    try {
      const inputText = `Analyzing ACT: ${actName}\n\nScript content for this act:\n\n${actScriptContent}`
      const response = await this.callResponsesAPI(
        inputText,
        ACT_BREAK_SYSTEM_INSTRUCTIONS,
        'act_break_document',
        ACT_BREAK_DOC_SCHEMA,
        apiKey
      )

      const result = this.parseResponse<ActBreakDocOutput>(response)
      console.log(`[DocumentGeneration] Generated act break doc for "${actName}"`)
      return result

    } catch (error) {
      console.error('[DocumentGeneration] Error generating act break doc:', error)
      return null
    } finally {
      this.isGenerating = false
    }
  }

  /**
   * Build the input text from script contexts and optional supplementary documents
   */
  private buildInputText(
    entityName: string,
    entityType: 'character' | 'prop' | 'location',
    contexts: ScriptContext[],
    supplementaryDocs?: SupplementaryDocument[]
  ): string {
    let output = `Analyzing ${entityType.toUpperCase()}: ${entityName}\n\n`

    // Add supplementary context section if provided
    if (supplementaryDocs && supplementaryDocs.length > 0) {
      output += `=== SUPPLEMENTARY CONTEXT ===\n`
      output += `The following documents provide additional story context:\n\n`
      
      for (const doc of supplementaryDocs) {
        output += `--- ${doc.title} ---\n`
        output += doc.content
        output += '\n\n'
      }
    }

    // Add script excerpts section
    output += `=== SCRIPT EXCERPTS ===\n`
    
    if (contexts.length === 0) {
      output += `This ${entityType} has no direct appearances in the script yet.\n`
      output += `Generate the document based ONLY on the supplementary context provided above.\n`
    } else {
      output += `Script excerpts where this ${entityType} appears:\n\n`

      const contextBlocks = contexts.map((ctx, index) => {
        let block = `--- Scene ${index + 1}: ${ctx.sceneHeading} ---\n`
        block += `[${ctx.elementType.toUpperCase()}]\n`
        block += ctx.content
        if (ctx.surroundingContext) {
          block += `\n\n[SURROUNDING CONTEXT]\n${ctx.surroundingContext}`
        }
        return block
      }).join('\n\n')

      output += contextBlocks
    }
    
    return output
  }

  /**
   * Call the OpenAI Responses API
   */
  private async callResponsesAPI(
    input: string,
    instructions: string,
    schemaName: string,
    schema: object,
    apiKey: string
  ): Promise<OpenAIResponsesResponse> {
    const requestBody: OpenAIResponsesRequest = {
      model: 'gpt-4.1',
      input: input,
      instructions: instructions,
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          schema: schema,
          strict: true
        }
      },
      temperature: 0.5, // Lower temperature for more factual extraction
      max_output_tokens: 2048
    }

    console.log('[DocumentGeneration] Calling OpenAI Responses API...')

    const response = await fetch('https://api.openai.com/v1/responses', {
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
      throw new Error(errorMessage)
    }

    const data = await response.json() as OpenAIResponsesResponse

    if (data.status === 'failed' && data.error) {
      throw new Error(data.error.message || 'AI response generation failed')
    }

    return data
  }

  /**
   * Parse the API response and extract the document output
   */
  private parseResponse<T>(response: OpenAIResponsesResponse): T | null {
    // Find the message output
    const messageOutput = response.output?.find(o => o.type === 'message' && o.role === 'assistant')
    if (!messageOutput) {
      console.warn('[DocumentGeneration] No assistant message in response')
      return null
    }

    // Find the text content
    const textContent = messageOutput.content?.find(c => c.type === 'output_text')
    if (!textContent?.text) {
      console.warn('[DocumentGeneration] No text content in response')
      return null
    }

    try {
      // Parse the JSON response
      const parsed = JSON.parse(textContent.text) as T
      return parsed
    } catch (parseError) {
      console.error('[DocumentGeneration] Failed to parse response JSON:', parseError)
      return null
    }
  }
}

// Singleton instance
let instance: DocumentGenerationService | null = null

export function getDocumentGenerationService(): DocumentGenerationService {
  if (!instance) {
    instance = new DocumentGenerationService()
  }
  return instance
}
