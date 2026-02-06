import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { CheckmarkRegular, DismissRegular } from '@fluentui/react-icons'

export interface MentionPreviewOptions {
  HTMLAttributes: Record<string, unknown>
  onAccept?: (suggestionId: string) => void
  onReject?: (suggestionId: string) => void
}

export interface MentionPreviewAttributes {
  suggestionId: string
  originalText: string
  mentionId: string
  mentionType: 'character' | 'prop'
  mentionLabel: string
  mentionColor: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mentionPreview: {
      /**
       * Insert a mention preview node
       */
      insertMentionPreview: (attrs: MentionPreviewAttributes) => ReturnType
      /**
       * Accept a mention preview (replace with mention)
       */
      acceptMentionPreview: (suggestionId: string) => ReturnType
      /**
       * Reject a mention preview (restore original)
       */
      rejectMentionPreview: (suggestionId: string) => ReturnType
      /**
       * Accept all mention previews in the document
       */
      acceptAllMentionPreviews: () => ReturnType
      /**
       * Reject all mention previews in the document
       */
      rejectAllMentionPreviews: () => ReturnType
    }
  }
}

// React component for the mention preview node view
interface MentionPreviewComponentProps {
  node: {
    attrs: MentionPreviewAttributes
    nodeSize: number
  }
  extension: {
    options: MentionPreviewOptions
  }
  deleteNode: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: any
  getPos: () => number
}

function MentionPreviewComponent({ node, extension, editor, getPos }: MentionPreviewComponentProps) {
  const { suggestionId, originalText, mentionLabel, mentionColor } = node.attrs
  const { onAccept, onReject } = extension.options

  const handleAccept = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Replace with a mention node
    editor.chain().focus().command(({ tr, state }: { tr: { replaceWith: (from: number, to: number, node: unknown) => unknown }; state: { schema: { nodes: { mention: { create: (attrs: object) => unknown } } } } }) => {
      const pos = getPos()
      const nodeSize = node.nodeSize
      
      // Create a mention node
      const mentionNode = state.schema.nodes.mention?.create({
        id: node.attrs.mentionId,
        type: node.attrs.mentionType,
        label: node.attrs.mentionLabel,
        color: node.attrs.mentionColor,
      })
      
      if (mentionNode) {
        tr.replaceWith(pos, pos + nodeSize, mentionNode)
      }
      return true
    }).run()
    
    onAccept?.(suggestionId)
  }

  const handleReject = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Replace with original text
    editor.chain().focus().command(({ tr, state }: { tr: { replaceWith: (from: number, to: number, node: unknown) => unknown }; state: { schema: { text: (s: string) => unknown } } }) => {
      const pos = getPos()
      const nodeSize = node.nodeSize
      tr.replaceWith(pos, pos + nodeSize, state.schema.text(originalText))
      return true
    }).run()
    
    onReject?.(suggestionId)
  }

  return (
    <NodeViewWrapper as="span" className="mention-preview-wrapper inline">
      <span className="mention-preview inline-flex items-baseline gap-1 bg-ink-800/50 rounded px-0.5 py-0.5">
        {/* Original text with strikethrough */}
        <span className="line-through text-theme-muted/70 decoration-theme-muted">
          {originalText}
        </span>
        
        {/* Mention preview */}
        <span 
          className="rounded px-1 font-medium"
          style={{ 
            backgroundColor: mentionColor, 
            color: '#000000' 
          }}
        >
          @{mentionLabel}
        </span>
        
        {/* Action chips */}
        <span className="inline-flex items-center gap-0.5 ml-1">
          <button
            onClick={handleAccept}
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300 transition-colors"
            title="Accept mention"
            contentEditable={false}
          >
            <CheckmarkRegular className="w-3 h-3" />
          </button>
          <button
            onClick={handleReject}
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-colors"
            title="Reject mention"
            contentEditable={false}
          >
            <DismissRegular className="w-3 h-3" />
          </button>
        </span>
      </span>
    </NodeViewWrapper>
  )
}

export const MentionPreview = Node.create<MentionPreviewOptions>({
  name: 'mentionPreview',

  group: 'inline',

  inline: true,

  atom: true,

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
      suggestionId: {
        default: null,
        parseHTML: element => element.getAttribute('data-suggestion-id'),
        renderHTML: attributes => ({
          'data-suggestion-id': attributes.suggestionId,
        }),
      },
      originalText: {
        default: '',
        parseHTML: element => element.getAttribute('data-original-text'),
        renderHTML: attributes => ({
          'data-original-text': attributes.originalText,
        }),
      },
      mentionId: {
        default: null,
        parseHTML: element => element.getAttribute('data-mention-id'),
        renderHTML: attributes => ({
          'data-mention-id': attributes.mentionId,
        }),
      },
      mentionType: {
        default: 'character',
        parseHTML: element => element.getAttribute('data-mention-type'),
        renderHTML: attributes => ({
          'data-mention-type': attributes.mentionType,
        }),
      },
      mentionLabel: {
        default: '',
        parseHTML: element => element.getAttribute('data-mention-label'),
        renderHTML: attributes => ({
          'data-mention-label': attributes.mentionLabel,
        }),
      },
      mentionColor: {
        default: '#fbbf24',
        parseHTML: element => element.getAttribute('data-mention-color'),
        renderHTML: attributes => ({
          'data-mention-color': attributes.mentionColor,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention-preview]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-mention-preview': '' }, this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionPreviewComponent)
  },

  addCommands() {
    return {
      insertMentionPreview:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          })
        },

      acceptMentionPreview:
        (suggestionId) =>
        ({ tr, state, dispatch }) => {
          let found = false
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.suggestionId === suggestionId) {
              if (dispatch) {
                const mentionNode = state.schema.nodes.mention?.create({
                  id: node.attrs.mentionId,
                  type: node.attrs.mentionType,
                  label: node.attrs.mentionLabel,
                  color: node.attrs.mentionColor,
                })
                if (mentionNode) {
                  tr.replaceWith(pos, pos + node.nodeSize, mentionNode)
                }
              }
              found = true
              return false
            }
            return true
          })
          return found
        },

      rejectMentionPreview:
        (suggestionId) =>
        ({ tr, state, dispatch }) => {
          let found = false
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.suggestionId === suggestionId) {
              if (dispatch) {
                const originalText = node.attrs.originalText
                tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(originalText))
              }
              found = true
              return false
            }
            return true
          })
          return found
        },

      acceptAllMentionPreviews:
        () =>
        ({ tr, state, dispatch }) => {
          const nodesToReplace: { pos: number; node: typeof state.doc.type.prototype }[] = []
          
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name) {
              nodesToReplace.push({ pos, node })
            }
            return true
          })
          
          if (nodesToReplace.length === 0) return false
          
          if (dispatch) {
            // Process in reverse order to maintain correct positions
            for (let i = nodesToReplace.length - 1; i >= 0; i--) {
              const { pos, node } = nodesToReplace[i]
              const mentionNode = state.schema.nodes.mention?.create({
                id: node.attrs.mentionId,
                type: node.attrs.mentionType,
                label: node.attrs.mentionLabel,
                color: node.attrs.mentionColor,
              })
              if (mentionNode) {
                tr.replaceWith(pos, pos + node.nodeSize, mentionNode)
              }
            }
          }
          return true
        },

      rejectAllMentionPreviews:
        () =>
        ({ tr, state, dispatch }) => {
          const nodesToReplace: { pos: number; node: typeof state.doc.type.prototype }[] = []
          
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name) {
              nodesToReplace.push({ pos, node })
            }
            return true
          })
          
          if (nodesToReplace.length === 0) return false
          
          if (dispatch) {
            // Process in reverse order to maintain correct positions
            for (let i = nodesToReplace.length - 1; i >= 0; i--) {
              const { pos, node } = nodesToReplace[i]
              tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(node.attrs.originalText))
            }
          }
          return true
        },
    }
  },
})
