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
          handleDOMEvents: {
            click: (_view, event) => {
              if (!onCitationClick) return false

              const target = (event.target as HTMLElement).closest('.citation')
              if (!target) return false

              const docId = target.getAttribute('data-source-document-id')
              const blockId = target.getAttribute('data-source-block-id')

              if (docId) {
                event.preventDefault()
                event.stopPropagation()
                onCitationClick(docId, blockId || '')
                return true
              }

              return false
            },
          },
        },
      }),
    ]
  },
})
