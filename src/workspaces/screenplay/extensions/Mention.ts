import { mergeAttributes, Node } from '@tiptap/core'
import { Node as ProseMirrorNode } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion'

export type MentionType = 'character' | 'prop'

export interface MentionOptions {
  HTMLAttributes: Record<string, unknown>
  renderText: (props: { options: MentionOptions; node: ProseMirrorNode }) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderHTML: (props: { options: MentionOptions; node: ProseMirrorNode }) => any
  suggestion: Omit<SuggestionOptions, 'editor'>
  onMentionClick?: (type: MentionType, id: string) => void
}

export const MentionPluginKey = new PluginKey('mention')

export const Mention = Node.create<MentionOptions>({
  name: 'mention',

  addOptions() {
    return {
      HTMLAttributes: {},
      renderText({ node }) {
        return `@${node.attrs.label ?? node.attrs.id}`
      },
      renderHTML({ options, node }) {
        // For props, use solid amber background with black text
        // For characters, use character color as background with contrasting text
        const bgColor = node.attrs.color || '#fbbf24'
        const textColor = '#000000' // Always black text for accessibility
        
        return [
          'span',
          mergeAttributes(
            { 'data-type': 'mention' },
            options.HTMLAttributes,
            {
              'data-mention-type': node.attrs.type,
              'data-mention-id': node.attrs.id,
              'data-mention-label': node.attrs.label,
              'data-mention-color': bgColor,
              class: 'mention',
              style: `background-color: ${bgColor}; color: ${textColor}; cursor: pointer;`
            }
          ),
          `@${node.attrs.label ?? node.attrs.id}`,
        ]
      },
      suggestion: {
        char: '@',
        pluginKey: MentionPluginKey,
        command: ({ editor, range, props }) => {
          // increase range.to by one when the next node is of type "text"
          // and starts with a space character
          const nodeAfter = editor.view.state.selection.$to.nodeAfter
          const overrideSpace = nodeAfter?.text?.startsWith(' ')

          if (overrideSpace) {
            range.to += 1
          }

          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: props,
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run()

          window.getSelection()?.collapseToEnd()
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from)
          const type = state.schema.nodes[this.name]
          const allow = !!$from.parent.type.contentMatch.matchType(type)
          return allow
        },
      },
      onMentionClick: undefined,
    }
  },

  group: 'inline',

  inline: true,

  selectable: true,  // Allow mentions to be selected as part of text selection

  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-mention-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {}
          }
          return { 'data-mention-id': attributes.id }
        },
      },
      type: {
        default: 'character',
        parseHTML: element => element.getAttribute('data-mention-type'),
        renderHTML: attributes => {
          return { 'data-mention-type': attributes.type }
        },
      },
      label: {
        default: null,
        parseHTML: element => element.getAttribute('data-mention-label'),
        renderHTML: attributes => {
          if (!attributes.label) {
            return {}
          }
          return { 'data-mention-label': attributes.label }
        },
      },
      color: {
        default: '#fbbf24',
        parseHTML: element => element.getAttribute('data-mention-color'),
        renderHTML: attributes => {
          return { 'data-mention-color': attributes.color || '#fbbf24' }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ]
  },

  renderHTML({ node }) {
    return this.options.renderHTML({ options: this.options, node })
  },

  renderText({ node }) {
    return this.options.renderText({ options: this.options, node })
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false
          const { selection } = state
          const { empty, anchor } = selection

          if (!empty) {
            return false
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true
              tr.insertText('', pos, pos + node.nodeSize)
              return false
            }
          })

          return isMention
        }),
    }
  },

  addProseMirrorPlugins() {
    const { onMentionClick } = this.options

    const plugins: Plugin[] = [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]

    // Add click handler plugin if callback is provided
    if (onMentionClick) {
      plugins.push(
        new Plugin({
          key: new PluginKey('mentionClick'),
          props: {
            handleClick: (view, _pos, event) => {
              // Don't intercept if user is making a selection (shift+click or drag selection)
              const selection = window.getSelection()
              if (selection && selection.toString().length > 0) {
                return false
              }
              
              // Don't intercept if shift is held (range selection)
              if (event.shiftKey) {
                return false
              }
              
              // Don't intercept if there's already a non-empty selection in the editor
              if (!view.state.selection.empty) {
                return false
              }
              
              const target = event.target as HTMLElement
              const mentionEl = target.closest('[data-type="mention"]')
              
              if (mentionEl) {
                const type = mentionEl.getAttribute('data-mention-type') as MentionType
                const id = mentionEl.getAttribute('data-mention-id')
                
                if (type && id) {
                  event.preventDefault()
                  event.stopPropagation()
                  onMentionClick(type, id)
                  return true
                }
              }
              
              return false
            },
          },
        })
      )
    }

    return plugins
  },
})

export default Mention
