/**
 * SlashCommand Suggestion Configuration
 * 
 * Configures the TipTap suggestion plugin for the slash command menu.
 * Uses tippy.js for positioning and ReactRenderer for the menu component.
 * 
 * When text is selected, shows revision commands (Rework, Expand Selection, etc.)
 * When no selection, shows generative commands (Continue Writing, etc.)
 */

import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { SlashCommandMenu, SlashCommandMenuRef } from './SlashCommandMenu'
import { 
  SLASH_COMMANDS_GENERATE, 
  SLASH_COMMANDS_SELECTION, 
  SlashCommandPluginKey, 
  type SlashCommandItem 
} from '../extensions/SlashCommand'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'

export function createSlashCommandSuggestion(): Omit<SuggestionOptions<SlashCommandItem>, 'editor'> {
  return {
    char: '/',
    pluginKey: SlashCommandPluginKey,
    allowSpaces: false,
    
    items: ({ query, editor }): SlashCommandItem[] => {
      const normalizedQuery = query.toLowerCase()
      
      // Check if there's a text selection (not just cursor position)
      const { from, to, empty } = editor.state.selection
      const hasSelection = !empty && to - from > 0
      
      // Choose command set based on selection
      const commands = hasSelection ? SLASH_COMMANDS_SELECTION : SLASH_COMMANDS_GENERATE
      
      return commands.filter(item =>
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.id.includes(normalizedQuery)
      )
    },

    command: ({ editor, range }) => {
      // Delete the "/" trigger character and any typed query
      editor.chain().focus().deleteRange(range).run()
    },

    render: () => {
      let component: ReactRenderer<SlashCommandMenuRef> | null = null
      let popup: TippyInstance[] | null = null

      return {
        onStart: (props: SuggestionProps<SlashCommandItem>) => {
          // Check if there's a selection to pass to the menu
          const { from, to, empty } = props.editor.state.selection
          const hasSelection = !empty && to - from > 0
          
          // Get the selected text if there is one
          let selectedText: string | undefined
          let selectionRange: { from: number; to: number } | undefined
          
          if (hasSelection) {
            selectedText = props.editor.state.doc.textBetween(from, to, '\n', '\ufffc')
            selectionRange = { from, to }
          }
          
          component = new ReactRenderer(SlashCommandMenu, {
            props: {
              items: props.items,
              command: props.command,
              editor: props.editor,
              query: props.query,
              hasSelection,
              selectedText,
              selectionRange,
            },
            editor: props.editor,
          })

          if (!props.clientRect) {
            return
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            theme: 'slash-command',
            animation: 'shift-away',
            offset: [0, 4],
            zIndex: 100,
          })
        },

        onUpdate(props: SuggestionProps<SlashCommandItem>) {
          // Check if there's a selection
          const { from, to, empty } = props.editor.state.selection
          const hasSelection = !empty && to - from > 0
          
          let selectedText: string | undefined
          let selectionRange: { from: number; to: number } | undefined
          
          if (hasSelection) {
            selectedText = props.editor.state.doc.textBetween(from, to, '\n', '\ufffc')
            selectionRange = { from, to }
          }
          
          component?.updateProps({
            items: props.items,
            command: props.command,
            editor: props.editor,
            query: props.query,
            hasSelection,
            selectedText,
            selectionRange,
          })

          if (!props.clientRect) {
            return
          }

          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          })
        },

        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }

          return component?.ref?.onKeyDown(props) ?? false
        },

        onExit() {
          popup?.[0]?.destroy()
          component?.destroy()
        },
      }
    },
  }
}
