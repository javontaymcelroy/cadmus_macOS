import { Extension } from '@tiptap/core'

export interface FontFamilyOptions {
  types: string[]
  defaultFontFamily: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      /**
       * Set the font family on the current block
       */
      setFontFamily: (fontFamily: string) => ReturnType
      /**
       * Unset the font family on the current block
       */
      unsetFontFamily: () => ReturnType
    }
  }
}

/**
 * FontFamily extension - applies font family as a BLOCK-LEVEL attribute
 * 
 * This follows the same pattern as LineHeight: the fontFamily is stored
 * on the block node (paragraph, heading, screenplayElement) rather than
 * as an inline text mark. This ensures:
 * - Toolbar updates block state directly without cursor manipulation
 * - Font persists properly when creating new blocks
 * - No buggy focus/selection behavior
 */
export const FontFamily = Extension.create<FontFamilyOptions>({
  name: 'fontFamily',

  addOptions() {
    return {
      // Block-level nodes that can have fontFamily
      // Note: screenplayElement excluded - uses fixed Courier New from CSS
      types: ['paragraph', 'heading'],
      defaultFontFamily: 'Carlito, sans-serif',
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: element => element.style.fontFamily?.replace(/['"]/g, '') || null,
            renderHTML: attributes => {
              if (!attributes.fontFamily) {
                return {}
              }
              return {
                style: `font-family: ${attributes.fontFamily}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontFamily:
        (fontFamily: string) =>
        ({ commands }) => {
          // Update the fontFamily attribute on whichever block type contains the cursor
          return this.options.types.every(type =>
            commands.updateAttributes(type, { fontFamily })
          )
        },
      unsetFontFamily:
        () =>
        ({ commands }) => {
          // Reset fontFamily attribute to default on all block types
          return this.options.types.every(type =>
            commands.resetAttributes(type, 'fontFamily')
          )
        },
    }
  },
})

// Font context types for filtering
export type FontContext = 'all' | 'notes-journal' | 'notes-only'

export interface FontFamily {
  name: string
  value: string
  /** 
   * Which contexts this font is available in:
   * - 'all': Available everywhere
   * - 'notes-journal': Available for all documents in NotesJournal workspace
   * - 'notes-only': Available only for Notes in all workspaces
   */
  context?: FontContext
}

// Available font families for the dropdown
export const FONT_FAMILIES: FontFamily[] = [
  // Standard fonts - available everywhere
  { name: 'Calibri', value: 'Carlito, Calibri, sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times New Roman', value: 'Times New Roman, serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  { name: 'Courier New', value: 'Courier New, Courier, monospace' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif' },
  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Lora', value: 'Lora, serif' },
  { name: 'Merriweather', value: 'Merriweather, serif' },
  { name: 'Source Serif', value: 'Source Serif Pro, serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
  { name: 'Space Mono', value: 'Space Mono, monospace' },
  
  // Handwriting fonts - available for Notes in all workspaces, and all documents in NotesJournal
  { name: 'Caveat', value: 'Caveat, cursive', context: 'notes-journal' },
  { name: 'Caveat Brush', value: 'Caveat Brush, cursive', context: 'notes-journal' },
  { name: 'Beth Ellen', value: 'Beth Ellen, cursive', context: 'notes-journal' },
]

/**
 * Get fonts available for a specific context
 * @param isNotesJournalWorkspace - Whether the current workspace is notes-journal
 * @param isNote - Whether the current document is a note
 */
export function getAvailableFonts(isNotesJournalWorkspace: boolean, isNote: boolean): FontFamily[] {
  return FONT_FAMILIES.filter(font => {
    // No context = available everywhere
    if (!font.context || font.context === 'all') return true
    
    // notes-journal context: available for all docs in NotesJournal, or notes in any workspace
    if (font.context === 'notes-journal') {
      return isNotesJournalWorkspace || isNote
    }
    
    // notes-only context: only available for notes
    if (font.context === 'notes-only') {
      return isNote
    }
    
    return true
  })
}
