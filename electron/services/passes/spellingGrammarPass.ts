import { v4 as uuidv4 } from 'uuid'
import type { Pass, PassContext, PlainTextResult } from '../passEngine'
import { contentToPlainText, plainTextOffsetToDocPos } from '../passEngine'
import type { Diagnostic, PassResult, Fix } from '../../../src/types/project'

// LanguageTool API types
interface LanguageToolMatch {
  message: string
  shortMessage?: string
  offset: number
  length: number
  replacements: Array<{ value: string }>
  rule: {
    id: string
    description: string
    category: {
      id: string
      name: string
    }
  }
  context: {
    text: string
    offset: number
    length: number
  }
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
  language: {
    name: string
    code: string
  }
}

// LanguageTool server configuration
const LANGUAGETOOL_URL = 'http://localhost:8010/v2/check'

// Check if LanguageTool server is available
async function isLanguageToolAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    
    const response = await fetch('http://localhost:8010/v2/languages', {
      method: 'GET',
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

// Call LanguageTool API
async function checkText(text: string, language: string = 'en-US'): Promise<LanguageToolMatch[]> {
  try {
    const response = await fetch(LANGUAGETOOL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        text,
        language,
        enabledOnly: 'false'
      })
    })

    if (!response.ok) {
      throw new Error(`LanguageTool API error: ${response.status}`)
    }

    const data: LanguageToolResponse = await response.json()
    return data.matches
  } catch (error) {
    console.error('[SpellingGrammarPass] LanguageTool API error:', error)
    throw error
  }
}

// Map LanguageTool severity to our diagnostic severity
function mapSeverity(ruleCategory: string): 'error' | 'warning' | 'info' {
  const errorCategories = ['TYPOS', 'GRAMMAR']
  const warningCategories = ['PUNCTUATION', 'TYPOGRAPHY', 'CASING']
  
  if (errorCategories.includes(ruleCategory)) {
    return 'error'
  } else if (warningCategories.includes(ruleCategory)) {
    return 'warning'
  }
  return 'info'
}

export class SpellingGrammarPass implements Pass {
  id = 'spelling-grammar'
  name = 'Spelling & Grammar'
  kind: 'local' = 'local'

  async run(ctx: PassContext): Promise<PassResult> {
    const startTime = Date.now()
    const diagnostics: Diagnostic[] = []
    const fixes: Fix[] = []

    // Check if LanguageTool is available
    const available = await isLanguageToolAvailable()
    
    if (!available) {
      console.warn('[SpellingGrammarPass] LanguageTool server not available at localhost:8010')
      diagnostics.push({
        id: uuidv4(),
        passId: this.id,
        severity: 'info',
        title: 'Spelling Check Unavailable',
        message: 'LanguageTool server is not running. Start it with: docker run -d -p 8010:8010 erikvl87/languagetool',
        documentId: ''
      })
      
      return {
        passId: this.id,
        diagnostics,
        fixes,
        timing: Date.now() - startTime
      }
    }

    // Process each document
    for (const doc of ctx.documents) {
      try {
        // Convert document content to plain text with position mapping
        const { text, positions }: PlainTextResult = contentToPlainText(doc.content)
        
        if (!text.trim()) continue

        // Check text with LanguageTool
        const matches = await checkText(text)

        // Convert matches to diagnostics
        for (const match of matches) {
          const diagId = uuidv4()
          
          // Map plain text offset to document position
          const fromPos = plainTextOffsetToDocPos(match.offset, positions)
          const toPos = plainTextOffsetToDocPos(match.offset + match.length, positions)

          // Create suggestions from replacements
          const suggestions = match.replacements.slice(0, 5).map(r => ({
            label: `Replace with "${r.value}"`,
            replacement: r.value
          }))

          diagnostics.push({
            id: diagId,
            passId: this.id,
            severity: mapSeverity(match.rule.category.id),
            title: match.rule.category.name,
            message: match.message,
            documentId: doc.id,
            range: {
              from: fromPos,
              to: toPos
            },
            suggestions,
            source: `${match.rule.id}: ${match.rule.description}`,
            context: {
              text: match.context.text,
              offset: match.context.offset,
              length: match.context.length
            }
          })

          // Create fix for first suggestion
          if (match.replacements.length > 0) {
            fixes.push({
              id: uuidv4(),
              diagnosticId: diagId,
              label: `Replace with "${match.replacements[0].value}"`,
              patch: {
                documentId: doc.id,
                range: {
                  from: fromPos,
                  to: toPos
                },
                replacement: match.replacements[0].value
              }
            })
          }
        }
      } catch (error) {
        console.error(`[SpellingGrammarPass] Error processing document ${doc.id}:`, error)
        diagnostics.push({
          id: uuidv4(),
          passId: this.id,
          severity: 'warning',
          title: 'Spelling Check Error',
          message: `Failed to check document "${doc.title}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          documentId: doc.id
        })
      }
    }

    return {
      passId: this.id,
      diagnostics,
      fixes,
      timing: Date.now() - startTime
    }
  }
}
