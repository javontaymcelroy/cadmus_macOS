import { v4 as uuidv4 } from 'uuid'
import type { Pass, PassContext } from '../passEngine'
import type { Diagnostic, PassResult, Fix } from '../../../src/types/project'
import type { JSONContent } from '@tiptap/core'

// Citation patterns
// APA: (Author, Year) or (Author, Year, p. 123) or Author (Year)
const APA_INLINE_PATTERN = /\(([A-Z][a-zA-Z]+(?:\s*(?:&|and)\s*[A-Z][a-zA-Z]+)*(?:\s+et\s+al\.)?),?\s*(\d{4})(?:,?\s*pp?\.\s*\d+(?:-\d+)?)?\)/g
const APA_NARRATIVE_PATTERN = /([A-Z][a-zA-Z]+(?:\s*(?:&|and)\s*[A-Z][a-zA-Z]+)*(?:\s+et\s+al\.)?)\s*\((\d{4})\)/g

// MLA: (Author Page) or (Author)
const MLA_INLINE_PATTERN = /\(([A-Z][a-zA-Z]+(?:\s*(?:and)\s*[A-Z][a-zA-Z]+)*)\s+(\d+(?:-\d+)?)\)/g
const MLA_AUTHOR_ONLY_PATTERN = /\(([A-Z][a-zA-Z]+(?:\s*(?:and)\s*[A-Z][a-zA-Z]+)*)\)/g

// Bibliography entry patterns (simplified)
// APA: Author, A. B. (Year). Title. Publisher.
const APA_REFERENCE_PATTERN = /^([A-Z][a-zA-Z]+),\s*[A-Z]\.\s*(?:[A-Z]\.\s*)?\((\d{4})\)\./m

// MLA: Author. Title. Publisher, Year.
const MLA_REFERENCE_PATTERN = /^([A-Z][a-zA-Z]+),\s*[A-Za-z]+\.\s*.+\.\s*[A-Za-z\s]+,?\s*(\d{4})\./m

interface CitationMatch {
  author: string
  year?: string
  page?: string
  position: number
  length: number
  raw: string
}

interface ReferenceEntry {
  author: string
  year: string
  position: number
  raw: string
}

// Extract plain text from TipTap JSON content
function extractPlainText(content: JSONContent): string {
  function traverse(node: JSONContent): string {
    if (node.type === 'text' && node.text) {
      return node.text
    }
    if (node.content) {
      const text = node.content.map(traverse).join('')
      if (['paragraph', 'heading', 'blockquote', 'listItem'].includes(node.type || '')) {
        return text + '\n'
      }
      return text
    }
    return ''
  }
  return traverse(content)
}

// Parse APA citations from text
function parseAPACitations(text: string): CitationMatch[] {
  const citations: CitationMatch[] = []
  
  // Inline citations: (Author, Year)
  let match
  const inlinePattern = new RegExp(APA_INLINE_PATTERN.source, 'g')
  while ((match = inlinePattern.exec(text)) !== null) {
    citations.push({
      author: match[1].trim(),
      year: match[2],
      position: match.index,
      length: match[0].length,
      raw: match[0]
    })
  }
  
  // Narrative citations: Author (Year)
  const narrativePattern = new RegExp(APA_NARRATIVE_PATTERN.source, 'g')
  while ((match = narrativePattern.exec(text)) !== null) {
    // Avoid duplicates if the same citation was matched by inline pattern
    const isDuplicate = citations.some(c => 
      c.position === match!.index || 
      (c.author === match![1].trim() && c.year === match![2])
    )
    if (!isDuplicate) {
      citations.push({
        author: match[1].trim(),
        year: match[2],
        position: match.index,
        length: match[0].length,
        raw: match[0]
      })
    }
  }
  
  return citations
}

// Parse MLA citations from text
function parseMLACitations(text: string): CitationMatch[] {
  const citations: CitationMatch[] = []
  
  // Citations with page numbers: (Author Page)
  let match
  const pagePattern = new RegExp(MLA_INLINE_PATTERN.source, 'g')
  while ((match = pagePattern.exec(text)) !== null) {
    citations.push({
      author: match[1].trim(),
      page: match[2],
      position: match.index,
      length: match[0].length,
      raw: match[0]
    })
  }
  
  // Author-only citations: (Author)
  const authorPattern = new RegExp(MLA_AUTHOR_ONLY_PATTERN.source, 'g')
  while ((match = authorPattern.exec(text)) !== null) {
    // Avoid duplicates
    const isDuplicate = citations.some(c => c.position === match!.index)
    if (!isDuplicate) {
      citations.push({
        author: match[1].trim(),
        position: match.index,
        length: match[0].length,
        raw: match[0]
      })
    }
  }
  
  return citations
}

// Parse bibliography/references section
function parseReferences(text: string, style: 'apa' | 'mla'): ReferenceEntry[] {
  const references: ReferenceEntry[] = []
  const lines = text.split('\n')
  
  // Look for "References" or "Works Cited" section
  let inReferences = false
  let currentPosition = 0
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Detect start of references section
    if (/^(References|Works Cited|Bibliography)$/i.test(trimmedLine)) {
      inReferences = true
      currentPosition += line.length + 1
      continue
    }
    
    if (inReferences && trimmedLine) {
      const pattern = style === 'apa' ? APA_REFERENCE_PATTERN : MLA_REFERENCE_PATTERN
      const match = pattern.exec(trimmedLine)
      
      if (match) {
        references.push({
          author: match[1].trim(),
          year: match[2],
          position: currentPosition,
          raw: trimmedLine
        })
      }
    }
    
    currentPosition += line.length + 1
  }
  
  return references
}

// Normalize author name for comparison
function normalizeAuthor(author: string): string {
  return author
    .toLowerCase()
    .replace(/\s*et\s+al\.?\s*/g, '')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim()
}

export class CitationPass implements Pass {
  id = 'citation'
  name = 'Citation Validator'
  kind: 'local' = 'local'

  async run(ctx: PassContext): Promise<PassResult> {
    const startTime = Date.now()
    const diagnostics: Diagnostic[] = []
    const fixes: Fix[] = []

    // Skip if citation style is 'none'
    if (!ctx.settings.citationStyle || ctx.settings.citationStyle === 'none') {
      return {
        passId: this.id,
        diagnostics,
        fixes,
        timing: Date.now() - startTime
      }
    }

    const style = ctx.settings.citationStyle

    // Collect all citations and references across all documents
    const allCitations: Array<CitationMatch & { documentId: string }> = []
    const allReferences: Array<ReferenceEntry & { documentId: string }> = []

    for (const doc of ctx.documents) {
      const text = extractPlainText(doc.content)
      
      // Parse citations based on style
      const citations = style === 'apa' 
        ? parseAPACitations(text)
        : parseMLACitations(text)
      
      allCitations.push(...citations.map(c => ({ ...c, documentId: doc.id })))
      
      // Parse references
      const references = parseReferences(text, style)
      allReferences.push(...references.map(r => ({ ...r, documentId: doc.id })))
    }

    // Check each citation has a matching reference
    for (const citation of allCitations) {
      const normalizedCitationAuthor = normalizeAuthor(citation.author)
      
      const matchingRef = allReferences.find(ref => {
        const normalizedRefAuthor = normalizeAuthor(ref.author)
        const authorMatch = normalizedRefAuthor.includes(normalizedCitationAuthor) ||
                           normalizedCitationAuthor.includes(normalizedRefAuthor)
        
        if (style === 'apa') {
          return authorMatch && ref.year === citation.year
        } else {
          // MLA doesn't require year match in citation
          return authorMatch
        }
      })

      if (!matchingRef) {
        diagnostics.push({
          id: uuidv4(),
          passId: this.id,
          severity: 'warning',
          title: 'Missing Reference',
          message: style === 'apa'
            ? `No reference found for citation "${citation.author}, ${citation.year}". Add this source to your References section.`
            : `No reference found for citation "${citation.author}". Add this source to your Works Cited.`,
          documentId: citation.documentId,
          range: {
            from: citation.position,
            to: citation.position + citation.length
          },
          suggestions: [{
            label: 'Add to references',
            action: 'add-reference'
          }]
        })
      }
    }

    // Check each reference is cited
    for (const ref of allReferences) {
      const normalizedRefAuthor = normalizeAuthor(ref.author)
      
      const isCited = allCitations.some(citation => {
        const normalizedCitationAuthor = normalizeAuthor(citation.author)
        const authorMatch = normalizedRefAuthor.includes(normalizedCitationAuthor) ||
                           normalizedCitationAuthor.includes(normalizedRefAuthor)
        
        if (style === 'apa') {
          return authorMatch && citation.year === ref.year
        } else {
          return authorMatch
        }
      })

      if (!isCited) {
        diagnostics.push({
          id: uuidv4(),
          passId: this.id,
          severity: 'info',
          title: 'Uncited Reference',
          message: `Reference "${ref.author}" is not cited in the document. Consider removing or citing this source.`,
          documentId: ref.documentId,
          range: {
            from: ref.position,
            to: ref.position + ref.raw.length
          }
        })
      }
    }

    // Check for citation formatting issues
    for (const doc of ctx.documents) {
      const text = extractPlainText(doc.content)
      
      // Check for common citation format issues
      if (style === 'apa') {
        // Check for missing comma between author and year
        const missingComma = /\(([A-Z][a-zA-Z]+)\s+(\d{4})\)/g
        let match
        while ((match = missingComma.exec(text)) !== null) {
          // Make sure it's not already matched as a valid citation
          const isValid = allCitations.some(c => 
            c.position === match!.index && c.documentId === doc.id
          )
          if (!isValid) {
            diagnostics.push({
              id: uuidv4(),
              passId: this.id,
              severity: 'warning',
              title: 'Citation Format Error',
              message: 'APA citations require a comma between author and year: (Author, Year)',
              documentId: doc.id,
              range: {
                from: match.index,
                to: match.index + match[0].length
              },
              suggestions: [{
                label: 'Add comma',
                replacement: `(${match[1]}, ${match[2]})`
              }]
            })
          }
        }
      }

      // Check for year-only citations that might be errors
      const yearOnly = /\((\d{4})\)/g
      let match
      while ((match = yearOnly.exec(text)) !== null) {
        diagnostics.push({
          id: uuidv4(),
          passId: this.id,
          severity: 'info',
          title: 'Possible Incomplete Citation',
          message: `Year-only citation found. Did you mean to include an author? Example: (Author, ${match[1]})`,
          documentId: doc.id,
          range: {
            from: match.index,
            to: match.index + match[0].length
          }
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
