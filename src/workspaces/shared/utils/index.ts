import type { JSONContent } from '@tiptap/core'

// Screenplay element types that should be displayed in uppercase
const UPPERCASE_ELEMENT_TYPES = ['scene-heading', 'character', 'transition']

/**
 * Helper to extract the first block's text from document content.
 * Used for deriving page/document titles from first heading, paragraph, or screenplay element.
 * Preserves uppercase formatting for screenplay elements that are styled as uppercase.
 */
export function getFirstBlockText(content: JSONContent | null): string | null {
  if (!content?.content) return null
  
  for (const node of content.content) {
    // Check for screenplayElement (scene heading, action, etc.)
    if (node.type === 'screenplayElement' && node.content) {
      const textParts: string[] = []
      for (const child of node.content) {
        if (child.type === 'text' && child.text) {
          textParts.push(child.text)
        }
      }
      let text = textParts.join('').trim()
      if (text) {
        // Apply uppercase if this element type is styled as uppercase
        const elementType = node.attrs?.elementType
        if (elementType && UPPERCASE_ELEMENT_TYPES.includes(elementType)) {
          text = text.toUpperCase()
        }
        return text
      }
    }
    
    // Check for heading
    if (node.type === 'heading' && node.content) {
      const textParts: string[] = []
      for (const child of node.content) {
        if (child.type === 'text' && child.text) {
          textParts.push(child.text)
        }
      }
      const text = textParts.join('').trim()
      if (text) return text
    }
    
    // Check for paragraph
    if (node.type === 'paragraph' && node.content) {
      const textParts: string[] = []
      for (const child of node.content) {
        if (child.type === 'text' && child.text) {
          textParts.push(child.text)
        }
      }
      const text = textParts.join('').trim()
      if (text) return text
    }
  }
  
  return null
}
