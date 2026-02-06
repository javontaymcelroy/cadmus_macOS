/**
 * AI Suggestions Service
 * 
 * Uses OpenAI's Responses API to analyze document content and generate
 * constructive writing suggestions. These suggestions are converted to
 * Diagnostic format to display alongside build issues in the Problems Panel.
 */

import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'

// Types matching src/types/project.ts
export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export interface TextRange {
  from: number
  to: number
}

export interface DiagnosticSuggestion {
  label: string
  replacement?: string
  action?: string
}

export interface Diagnostic {
  id: string
  passId: string
  severity: DiagnosticSeverity
  title: string
  message: string
  documentId: string
  range?: TextRange
  suggestions?: DiagnosticSuggestion[]
  source?: string
  context?: {
    text: string
    offset: number
    length: number
  }
}

// Document content structure passed to the service
export interface DocumentContent {
  id: string
  title: string
  content: string
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

// Structured output schema for AI suggestions
interface AISuggestionOutput {
  suggestions: Array<{
    title: string
    message: string
    severity: 'error' | 'warning' | 'info'
    documentId: string
    issueText: string | null      // The exact text that has the issue (for highlighting)
    contextText: string | null    // Surrounding context containing the issue
    suggestedFix: string | null   // Replacement text
    fixLabel: string | null       // Button label for the fix
  }>
}

// JSON Schema for structured output
// Note: With strict mode, all properties must be in required array, use nullable types for optional fields
const SUGGESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Brief title summarizing the suggestion (5-10 words)'
          },
          message: {
            type: 'string',
            description: 'Detailed explanation of the suggestion and why it would improve the writing'
          },
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'info'],
            description: 'error for critical issues, warning for improvements, info for minor suggestions'
          },
          documentId: {
            type: 'string',
            description: 'The ID of the document this suggestion applies to'
          },
          issueText: {
            type: ['string', 'null'],
            description: 'The EXACT text from the document that has the issue (copy verbatim for highlighting). Null if the suggestion is general.'
          },
          contextText: {
            type: ['string', 'null'],
            description: 'A longer surrounding passage (~50-150 chars) containing the issueText for context. Must include the issueText verbatim. Null if not applicable.'
          },
          suggestedFix: {
            type: ['string', 'null'],
            description: 'The suggested replacement text for issueText, or null if no specific replacement'
          },
          fixLabel: {
            type: ['string', 'null'],
            description: 'Label for the fix button (e.g. "Replace with..."), or null if no fix available'
          }
        },
        required: ['title', 'message', 'severity', 'documentId', 'issueText', 'contextText', 'suggestedFix', 'fixLabel'],
        additionalProperties: false
      }
    }
  },
  required: ['suggestions'],
  additionalProperties: false
}

// System prompt for the AI
const SYSTEM_INSTRUCTIONS = `You are an expert writing assistant analyzing documents for a creative writing IDE. Your task is to provide constructive suggestions to improve the writing.

For each document provided, analyze:
1. **Grammar & Style**: Check for grammatical errors, awkward phrasing, passive voice overuse, repetitive words
2. **Clarity**: Identify unclear or ambiguous passages that could confuse readers
3. **Pacing**: Note sections that feel rushed or drag on too long
4. **Dialogue**: For screenplays/scripts, check dialogue naturalness and character voice consistency
5. **Show vs Tell**: Point out opportunities to show rather than tell
6. **Structure**: Identify structural issues like missing transitions or abrupt scene changes

Guidelines:
- Focus on actionable, specific suggestions
- Be constructive, not harsh
- Prioritize important issues over nitpicks
- Limit to 5-10 suggestions total across all documents
- Use 'error' severity sparingly (only for significant issues)
- Use 'warning' for improvements that would notably enhance the writing
- Use 'info' for minor suggestions or style preferences

IMPORTANT for issueText and contextText:
- issueText: Copy the EXACT problematic text from the document VERBATIM (character-for-character). This will be highlighted in the UI.
- contextText: Copy a larger surrounding passage (~50-150 chars) that CONTAINS the issueText verbatim. The issueText must appear exactly within contextText.
- If you cannot identify specific text, set both to null.
- suggestedFix: If providing a fix, this replaces issueText.

The documents are provided in format:
[Document: <title> (id: <id>)]
<content>
---`

export class AISuggestionsService {
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
   * Generate AI suggestions for the provided documents
   */
  async generateSuggestions(documents: DocumentContent[]): Promise<Diagnostic[]> {
    if (this.isGenerating) {
      console.log('[AISuggestions] Already generating, skipping...')
      return []
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      console.log('[AISuggestions] No API key configured')
      return []
    }

    if (documents.length === 0) {
      console.log('[AISuggestions] No documents to analyze')
      return []
    }

    this.isGenerating = true
    console.log(`[AISuggestions] Generating suggestions for ${documents.length} document(s)...`)

    try {
      // Build the input text from all documents
      const inputText = documents.map(doc => {
        return `[Document: ${doc.title} (id: ${doc.id})]\n${doc.content}\n---`
      }).join('\n\n')

      // Truncate if too long (keep under ~100k chars to be safe with tokens)
      const maxChars = 100000
      const truncatedInput = inputText.length > maxChars 
        ? inputText.slice(0, maxChars) + '\n\n[Content truncated due to length...]'
        : inputText

      // Make the API request
      const response = await this.callResponsesAPI(truncatedInput, apiKey)

      // Parse and convert to diagnostics, passing documents for range lookup
      const diagnostics = this.parseResponse(response, documents)
      
      console.log(`[AISuggestions] Generated ${diagnostics.length} suggestion(s)`)
      return diagnostics

    } catch (error) {
      console.error('[AISuggestions] Error generating suggestions:', error)
      
      // Return a system error diagnostic
      return [{
        id: uuidv4(),
        passId: 'ai-suggestions',
        severity: 'info',
        title: 'AI suggestions unavailable',
        message: error instanceof Error ? error.message : 'Failed to generate AI suggestions',
        documentId: documents[0]?.id || 'unknown',
        source: 'AI Suggestions'
      }]
    } finally {
      this.isGenerating = false
    }
  }

  /**
   * Call the OpenAI Responses API
   */
  private async callResponsesAPI(input: string, apiKey: string): Promise<OpenAIResponsesResponse> {
    const requestBody: OpenAIResponsesRequest = {
      model: 'gpt-4.1',
      input: input,
      instructions: SYSTEM_INSTRUCTIONS,
      text: {
        format: {
          type: 'json_schema',
          name: 'ai_suggestions',
          schema: SUGGESTIONS_SCHEMA,
          strict: true
        }
      },
      temperature: 0.7,
      max_output_tokens: 4096
    }

    console.log('[AISuggestions] Calling OpenAI Responses API...')

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
   * Parse the API response and convert to Diagnostic format
   */
  private parseResponse(response: OpenAIResponsesResponse, documents: DocumentContent[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = []

    // Create a map of document ID to content for quick lookup
    const documentMap = new Map<string, string>()
    for (const doc of documents) {
      documentMap.set(doc.id, doc.content)
    }

    // Find the message output
    const messageOutput = response.output?.find(o => o.type === 'message' && o.role === 'assistant')
    if (!messageOutput) {
      console.warn('[AISuggestions] No assistant message in response')
      return diagnostics
    }

    // Find the text content
    const textContent = messageOutput.content?.find(c => c.type === 'output_text')
    if (!textContent?.text) {
      console.warn('[AISuggestions] No text content in response')
      return diagnostics
    }

    try {
      // Parse the JSON response
      const parsed = JSON.parse(textContent.text) as AISuggestionOutput

      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        console.warn('[AISuggestions] Invalid suggestions format')
        return diagnostics
      }

      // Convert each suggestion to a Diagnostic
      for (const suggestion of parsed.suggestions) {
        const diagnostic: Diagnostic = {
          id: uuidv4(),
          passId: 'ai-suggestions',
          severity: suggestion.severity,
          title: suggestion.title,
          message: suggestion.message,
          documentId: suggestion.documentId,
          source: 'AI Suggestions'
        }

        // Get the document content for range lookup
        const docContent = documentMap.get(suggestion.documentId)

        // Try to find the issueText in the document to get the range
        if (suggestion.issueText !== null && docContent) {
          const issueIndex = docContent.indexOf(suggestion.issueText)
          
          if (issueIndex !== -1) {
            // Found the issue text in the document - set the range for navigation and fixes
            diagnostic.range = {
              from: issueIndex,
              to: issueIndex + suggestion.issueText.length
            }
          }
        }

        // Build context by finding issueText within contextText
        if (suggestion.contextText !== null && suggestion.issueText !== null) {
          // Try exact match first
          let issueIndex = suggestion.contextText.indexOf(suggestion.issueText)
          let matchLength = suggestion.issueText.length
          
          // If exact match fails, try case-insensitive search
          if (issueIndex === -1) {
            const lowerContext = suggestion.contextText.toLowerCase()
            const lowerIssue = suggestion.issueText.toLowerCase()
            issueIndex = lowerContext.indexOf(lowerIssue)
            
            // If found case-insensitively, use the actual text from context for proper length
            if (issueIndex !== -1) {
              matchLength = suggestion.issueText.length
            }
          }
          
          if (issueIndex !== -1) {
            // Found the issue text within context - calculate offset and length
            diagnostic.context = {
              text: suggestion.contextText,
              offset: issueIndex,
              length: matchLength
            }
          } else {
            // issueText not found in contextText - try to find it and build context ourselves
            // This handles cases where AI didn't copy text exactly
            console.warn('[AISuggestions] issueText not found in contextText:', {
              issueText: suggestion.issueText,
              contextText: suggestion.contextText
            })
            diagnostic.context = {
              text: suggestion.contextText,
              offset: 0,
              length: 0
            }
          }
        } else if (suggestion.contextText !== null) {
          // Only context provided, no specific issue text
          diagnostic.context = {
            text: suggestion.contextText,
            offset: 0,
            length: 0
          }
        } else if (suggestion.issueText !== null) {
          // Only issue text provided, use it as context
          diagnostic.context = {
            text: suggestion.issueText,
            offset: 0,
            length: suggestion.issueText.length
          }
        }

        // Add fix suggestion if provided (check for non-null values)
        if (suggestion.suggestedFix !== null) {
          diagnostic.suggestions = [{
            label: suggestion.fixLabel || 'Apply suggestion',
            replacement: suggestion.suggestedFix
          }]
        }

        diagnostics.push(diagnostic)
      }

    } catch (parseError) {
      console.error('[AISuggestions] Failed to parse response JSON:', parseError)
    }

    return diagnostics
  }
}

// Singleton instance
let instance: AISuggestionsService | null = null

export function getAISuggestionsService(): AISuggestionsService {
  if (!instance) {
    instance = new AISuggestionsService()
  }
  return instance
}
