import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { CheckmarkRegular, DismissRegular } from '@fluentui/react-icons'

export interface FixPreviewOptions {
  HTMLAttributes: Record<string, unknown>
  onAccept?: (diagnosticId: string, suggestionText: string) => void
  onReject?: (diagnosticId: string, originalText: string) => void
}

export interface FixPreviewAttributes {
  diagnosticId: string
  originalText: string
  suggestionText: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fixPreview: {
      /**
       * Insert a fix preview node
       */
      insertFixPreview: (attrs: FixPreviewAttributes) => ReturnType
      /**
       * Accept a fix preview (replace with suggestion)
       */
      acceptFixPreview: (diagnosticId: string) => ReturnType
      /**
       * Reject a fix preview (restore original)
       */
      rejectFixPreview: (diagnosticId: string) => ReturnType
    }
  }
}

// React component for the fix preview node view
interface FixPreviewComponentProps {
  node: {
    attrs: FixPreviewAttributes
    nodeSize: number
  }
  extension: {
    options: FixPreviewOptions
  }
  deleteNode: () => void
  editor: {
    chain: () => {
      focus: () => {
        command: (fn: (props: { tr: unknown; state: unknown; dispatch: unknown }) => boolean) => {
          run: () => boolean
        }
      }
    }
    view: {
      state: {
        schema: {
          text: (content: string) => unknown
        }
      }
    }
  }
  getPos: () => number
}

function FixPreviewComponent({ node, extension, editor, getPos }: FixPreviewComponentProps) {
  const { diagnosticId, originalText, suggestionText } = node.attrs
  const { onAccept, onReject } = extension.options

  const handleAccept = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Use a single transaction to replace the node with suggestion text
    editor.chain().focus().command(({ tr, state }: { tr: { replaceWith: (from: number, to: number, node: unknown) => unknown }; state: { schema: { text: (s: string) => unknown } } }) => {
      const pos = getPos()
      const nodeSize = node.nodeSize
      // Replace the fix preview node with the suggestion text in one atomic operation
      tr.replaceWith(pos, pos + nodeSize, state.schema.text(suggestionText))
      return true
    }).run()
    
    // Call callback if provided
    onAccept?.(diagnosticId, suggestionText)
  }

  const handleReject = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Use a single transaction to replace the node with original text
    editor.chain().focus().command(({ tr, state }: { tr: { replaceWith: (from: number, to: number, node: unknown) => unknown }; state: { schema: { text: (s: string) => unknown } } }) => {
      const pos = getPos()
      const nodeSize = node.nodeSize
      // Replace the fix preview node with the original text in one atomic operation
      tr.replaceWith(pos, pos + nodeSize, state.schema.text(originalText))
      return true
    }).run()
    
    // Call callback if provided
    onReject?.(diagnosticId, originalText)
  }

  return (
    <NodeViewWrapper as="span" className="fix-preview-wrapper inline">
      <span className="fix-preview inline-flex items-baseline gap-1 bg-ink-800/50 rounded px-0.5 py-0.5">
        {/* Original text with strikethrough */}
        <span className="line-through text-red-400/70 decoration-red-400">
          {originalText}
        </span>
        
        {/* Suggestion text highlighted */}
        <span className="text-green-400 font-medium">
          {suggestionText}
        </span>
        
        {/* Action chips */}
        <span className="inline-flex items-center gap-0.5 ml-1">
          <button
            onClick={handleAccept}
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300 transition-colors"
            title="Accept suggestion"
            contentEditable={false}
          >
            <CheckmarkRegular className="w-3 h-3" />
          </button>
          <button
            onClick={handleReject}
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-colors"
            title="Reject suggestion"
            contentEditable={false}
          >
            <DismissRegular className="w-3 h-3" />
          </button>
        </span>
      </span>
    </NodeViewWrapper>
  )
}

export const FixPreview = Node.create<FixPreviewOptions>({
  name: 'fixPreview',

  group: 'inline',

  inline: true,

  atom: true, // This node is atomic (cannot have cursor inside)

  selectable: true,

  draggable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      onAccept: undefined,
      onReject: undefined,
    }
  },

  addAttributes() {
    return {
      diagnosticId: {
        default: null,
        parseHTML: element => element.getAttribute('data-diagnostic-id'),
        renderHTML: attributes => ({
          'data-diagnostic-id': attributes.diagnosticId,
        }),
      },
      originalText: {
        default: '',
        parseHTML: element => element.getAttribute('data-original-text'),
        renderHTML: attributes => ({
          'data-original-text': attributes.originalText,
        }),
      },
      suggestionText: {
        default: '',
        parseHTML: element => element.getAttribute('data-suggestion-text'),
        renderHTML: attributes => ({
          'data-suggestion-text': attributes.suggestionText,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-fix-preview]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-fix-preview': '' }, this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(FixPreviewComponent)
  },

  addCommands() {
    return {
      insertFixPreview:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          })
        },

      acceptFixPreview:
        (diagnosticId) =>
        ({ tr, state, dispatch }) => {
          let found = false
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.diagnosticId === diagnosticId) {
              if (dispatch) {
                const suggestionText = node.attrs.suggestionText
                tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(suggestionText))
              }
              found = true
              return false // Stop traversal
            }
            return true
          })
          return found
        },

      rejectFixPreview:
        (diagnosticId) =>
        ({ tr, state, dispatch }) => {
          let found = false
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.diagnosticId === diagnosticId) {
              if (dispatch) {
                const originalText = node.attrs.originalText
                tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(originalText))
              }
              found = true
              return false // Stop traversal
            }
            return true
          })
          return found
        },
    }
  },
})
