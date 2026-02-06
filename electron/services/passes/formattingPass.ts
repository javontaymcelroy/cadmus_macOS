import { v4 as uuidv4 } from 'uuid'
import type { Pass, PassContext, DocumentWithContent } from '../passEngine'
import type { Diagnostic, DiagnosticSuggestion, PassResult, Fix, FormattingRules } from '../../../src/types/project'
import type { JSONContent } from '@tiptap/core'

// Helper to check if text is in title case
function isTitleCase(text: string): boolean {
  const words = text.split(/\s+/)
  const minorWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in']
  
  return words.every((word, index) => {
    if (!word) return true
    const isMinor = minorWords.includes(word.toLowerCase())
    const isFirstOrLast = index === 0 || index === words.length - 1
    
    if (isMinor && !isFirstOrLast) {
      return word === word.toLowerCase()
    }
    return word[0] === word[0].toUpperCase()
  })
}

// Helper to check if text is in sentence case
function isSentenceCase(text: string): boolean {
  if (!text) return true
  // First letter should be uppercase, rest should follow normal sentence rules
  return text[0] === text[0].toUpperCase()
}

// Helper to convert to title case
function toTitleCase(text: string): string {
  const minorWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in']
  
  return text.split(/\s+/).map((word, index, arr) => {
    if (!word) return word
    const isMinor = minorWords.includes(word.toLowerCase())
    const isFirstOrLast = index === 0 || index === arr.length - 1
    
    if (isMinor && !isFirstOrLast) {
      return word.toLowerCase()
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }).join(' ')
}

// Helper to convert to sentence case
function toSentenceCase(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Check for straight vs curly quotes
function hasInconsistentQuotes(text: string, preferCurly: boolean): { found: boolean; positions: number[] } {
  const positions: number[] = []
  const straightQuotes = ['"', "'"]
  // Curly quotes: " " ' ' (using Unicode escapes to avoid parsing issues)
  const curlyQuotes = ['\u201C', '\u201D', '\u2018', '\u2019']
  
  const targetQuotes = preferCurly ? straightQuotes : curlyQuotes
  
  for (let i = 0; i < text.length; i++) {
    if (targetQuotes.includes(text[i])) {
      positions.push(i)
    }
  }
  
  return { found: positions.length > 0, positions }
}

// Check for excessive whitespace
function findExcessiveWhitespace(text: string): { start: number; end: number; type: string }[] {
  const issues: { start: number; end: number; type: string }[] = []
  
  // Multiple consecutive spaces
  const multipleSpaces = /  +/g
  let match
  while ((match = multipleSpaces.exec(text)) !== null) {
    issues.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'multiple-spaces'
    })
  }
  
  // Multiple consecutive newlines (more than 2)
  const multipleNewlines = /\n{3,}/g
  while ((match = multipleNewlines.exec(text)) !== null) {
    issues.push({
      start: match.index,
      end: match.index + match[0].length,
      type: 'excessive-blank-lines'
    })
  }
  
  // Trailing whitespace before newlines
  const trailingWhitespace = /[ \t]+\n/g
  while ((match = trailingWhitespace.exec(text)) !== null) {
    issues.push({
      start: match.index,
      end: match.index + match[0].length - 1,
      type: 'trailing-whitespace'
    })
  }
  
  return issues
}

// Extract text from heading nodes
interface HeadingInfo {
  level: number
  text: string
  nodePosition: number
}

function extractHeadings(content: JSONContent, position: number = 0): HeadingInfo[] {
  const headings: HeadingInfo[] = []
  
  function traverse(node: JSONContent, pos: number): number {
    if (node.type === 'heading' && node.attrs?.level) {
      const headingText = extractTextFromNode(node)
      headings.push({
        level: node.attrs.level as number,
        text: headingText,
        nodePosition: pos
      })
    }
    
    let currentPos = pos + 1 // Node opening
    if (node.content) {
      for (const child of node.content) {
        currentPos = traverse(child, currentPos)
      }
    }
    if (node.type === 'text' && node.text) {
      currentPos += node.text.length
    }
    return currentPos + 1 // Node closing
  }
  
  traverse(content, position)
  return headings
}

function extractTextFromNode(node: JSONContent): string {
  if (node.type === 'text' && node.text) {
    return node.text
  }
  if (node.content) {
    return node.content.map(extractTextFromNode).join('')
  }
  return ''
}

// Extract full plain text from content
function getPlainText(content: JSONContent): string {
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

export class FormattingPass implements Pass {
  id = 'formatting-lint'
  name = 'Formatting Lint'
  kind: 'local' = 'local'

  async run(ctx: PassContext): Promise<PassResult> {
    const startTime = Date.now()
    const diagnostics: Diagnostic[] = []
    const fixes: Fix[] = []
    const rules = ctx.settings.formattingRules

    for (const doc of ctx.documents) {
      // Check heading style
      if (rules.headingStyle !== 'none') {
        const headings = extractHeadings(doc.content)
        
        for (const heading of headings) {
          if (!heading.text.trim()) continue
          
          const isCorrectCase = rules.headingStyle === 'title' 
            ? isTitleCase(heading.text)
            : isSentenceCase(heading.text)
          
          if (!isCorrectCase) {
            const expectedCase = rules.headingStyle === 'title' ? 'title case' : 'sentence case'
            const fixedText = rules.headingStyle === 'title' 
              ? toTitleCase(heading.text)
              : toSentenceCase(heading.text)
            
            const diagId = uuidv4()
            diagnostics.push({
              id: diagId,
              passId: this.id,
              severity: 'warning',
              title: 'Inconsistent Heading Style',
              message: `Heading "${heading.text}" should be in ${expectedCase}`,
              documentId: doc.id,
              range: {
                from: heading.nodePosition,
                to: heading.nodePosition + heading.text.length + 2
              },
              suggestions: [{
                label: `Convert to ${expectedCase}`,
                replacement: fixedText
              }]
            })
            
            // Add fix
            fixes.push({
              id: uuidv4(),
              diagnosticId: diagId,
              label: `Convert to ${expectedCase}`,
              patch: {
                documentId: doc.id,
                range: {
                  from: heading.nodePosition,
                  to: heading.nodePosition + heading.text.length + 2
                },
                replacement: fixedText
              }
            })
          }
        }
      }

      // Check quotation style
      const plainText = getPlainText(doc.content)
      const preferCurly = rules.quotationStyle === 'curly'
      const quoteIssues = hasInconsistentQuotes(plainText, preferCurly)
      
      if (quoteIssues.found && quoteIssues.positions.length > 0) {
        const expectedStyle = preferCurly ? 'curly quotes' : 'straight quotes'
        diagnostics.push({
          id: uuidv4(),
          passId: this.id,
          severity: 'info',
          title: 'Inconsistent Quotation Marks',
          message: `Document contains ${quoteIssues.positions.length} quotation mark(s) that should be ${expectedStyle}`,
          documentId: doc.id,
          suggestions: [{
            label: `Convert all to ${expectedStyle}`,
            action: 'convert-quotes'
          }]
        })
      }

      // Check for excessive whitespace
      const whitespaceIssues = findExcessiveWhitespace(plainText)
      
      for (const issue of whitespaceIssues) {
        let title: string
        let message: string
        
        switch (issue.type) {
          case 'multiple-spaces':
            title = 'Multiple Consecutive Spaces'
            message = 'Replace multiple spaces with a single space'
            break
          case 'excessive-blank-lines':
            title = 'Excessive Blank Lines'
            message = 'Reduce to maximum of one blank line'
            break
          case 'trailing-whitespace':
            title = 'Trailing Whitespace'
            message = 'Remove trailing whitespace at end of line'
            break
          default:
            title = 'Whitespace Issue'
            message = 'Fix whitespace formatting'
        }
        
        diagnostics.push({
          id: uuidv4(),
          passId: this.id,
          severity: 'info',
          title,
          message,
          documentId: doc.id,
          range: {
            from: issue.start,
            to: issue.end
          },
          suggestions: [{
            label: 'Fix whitespace',
            action: 'fix-whitespace'
          }]
        })
      }

      // Check double spacing if enforced
      if (rules.enforceDoubleSpacing) {
        // Check if paragraphs are followed by appropriate spacing
        // This is a simplified check - in practice you'd check line height
        const paragraphs = plainText.split(/\n+/)
        if (paragraphs.length > 1) {
          // Just a reminder diagnostic since actual line spacing is CSS-based
          const hasProperSpacing = doc.content.content?.every((node: JSONContent) => {
            if (node.type === 'paragraph' && node.attrs) {
              return node.attrs.lineHeight === '2' || node.attrs.lineHeight === 2
            }
            return true
          })
          
          if (!hasProperSpacing) {
            diagnostics.push({
              id: uuidv4(),
              passId: this.id,
              severity: 'warning',
              title: 'Double Spacing Required',
              message: 'This document requires double line spacing. Some paragraphs may not have proper spacing.',
              documentId: doc.id,
              suggestions: [{
                label: 'Apply double spacing',
                action: 'apply-double-spacing'
              }]
            })
          }
        }
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
