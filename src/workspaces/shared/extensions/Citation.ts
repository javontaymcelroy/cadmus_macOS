import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface CitationOptions {
  /**
   * HTML attributes to add to the citation element
   */
  HTMLAttributes: Record<string, any>
  /**
   * Callback when a citation is clicked
   */
  onCitationClick?: (sourceDocumentId: string, sourceBlockId: string) => void
}

export interface CitationAttributes {
  sourceDocumentId: string
  sourceBlockId: string
  sourceDocumentTitle?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      /**
       * Set a citation mark
       */
      setCitation: (attributes: CitationAttributes) => ReturnType
      /**
       * Toggle a citation mark
       */
      toggleCitation: (attributes: CitationAttributes) => ReturnType
      /**
       * Unset a citation mark
       */
      unsetCitation: () => ReturnType
    }
  }
}

export const Citation = Mark.create<CitationOptions>({
  name: 'citation',

  priority: 1001, // Higher priority than link to handle clicks first

  keepOnSplit: false,

  exitable: true,

  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'citation',
      },
      onCitationClick: undefined,
    }
  },

  addAttributes() {
    return {
      sourceDocumentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-source-document-id'),
        renderHTML: attributes => {
          if (!attributes.sourceDocumentId) {
            return {}
          }
          return {
            'data-source-document-id': attributes.sourceDocumentId,
          }
        },
      },
      sourceBlockId: {
        default: null,
        parseHTML: element => element.getAttribute('data-source-block-id'),
        renderHTML: attributes => {
          if (!attributes.sourceBlockId) {
            return {}
          }
          return {
            'data-source-block-id': attributes.sourceBlockId,
          }
        },
      },
      sourceDocumentTitle: {
        default: null,
        parseHTML: element => element.getAttribute('data-source-document-title'),
        renderHTML: attributes => {
          if (!attributes.sourceDocumentTitle) {
            return {}
          }
          return {
            'data-source-document-title': attributes.sourceDocumentTitle,
            title: `Source: ${attributes.sourceDocumentTitle}`,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span.citation[data-source-document-id]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setCitation:
        (attributes) =>
        ({ chain }) => {
          return chain().setMark(this.name, attributes).run()
        },

      toggleCitation:
        (attributes) =>
        ({ chain }) => {
          return chain().toggleMark(this.name, attributes, { extendEmptyMarkRange: true }).run()
        },

      unsetCitation:
        () =>
        ({ chain }) => {
          return chain().unsetMark(this.name, { extendEmptyMarkRange: true }).run()
        },
    }
  },

  addProseMirrorPlugins() {
    const { onCitationClick } = this.options

    return [
      new Plugin({
        key: new PluginKey('citationClickHandler'),
        props: {
          handleClick: (view, pos, event) => {
            if (!onCitationClick) {
              return false
            }

            const { state } = view
            const { doc } = state
            const $pos = doc.resolve(pos)

            // Check if we clicked on a citation mark
            const marks = $pos.marks()
            const citationMark = marks.find(mark => mark.type.name === 'citation')

            if (citationMark) {
              const { sourceDocumentId, sourceBlockId } = citationMark.attrs

              // Navigate if we have at least a document ID (blockId can be empty)
              if (sourceDocumentId) {
                event.preventDefault()
                event.stopPropagation()
                onCitationClick(sourceDocumentId, sourceBlockId || '')
                return true
              }
            }

            return false
          },
        },
      }),
    ]
  },
})
