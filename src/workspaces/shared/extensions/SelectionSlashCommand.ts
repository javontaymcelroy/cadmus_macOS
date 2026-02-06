/**
 * SelectionSlashCommand Extension
 * 
 * Handles "/" key when text is selected to show revision commands.
 * This is separate from the main SlashCommand extension because the
 * suggestion plugin doesn't work well with selections (it replaces them).
 * 
 * When "/" is pressed with a selection:
 * 1. Prevents the keystroke from replacing the selection
 * 2. Shows a popup menu with revision commands (Rework, Expand, POV)
 * 3. Keeps the selection intact until the user accepts/rejects
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

export interface SelectionSlashCommandOptions {
  onTrigger?: (selectedText: string, selectionRange: { from: number; to: number }) => void
}

export const SelectionSlashCommandPluginKey = new PluginKey('selectionSlashCommand')

export const SelectionSlashCommand = Extension.create<SelectionSlashCommandOptions>({
  name: 'selectionSlashCommand',

  addOptions() {
    return {
      onTrigger: undefined,
    }
  },

  addProseMirrorPlugins() {
    const extension = this

    return [
      new Plugin({
        key: SelectionSlashCommandPluginKey,
        props: {
          handleKeyDown(view, event) {
            // Only handle "/" key
            if (event.key !== '/') {
              return false
            }

            const { state } = view
            const { selection } = state
            const { from, to, empty } = selection

            // Only handle when there's a selection (not empty)
            if (empty || to - from === 0) {
              return false
            }

            // Get the selected text, including mention nodes
            // Use a custom leaf text function to properly serialize mentions
            const selectedText = state.doc.textBetween(from, to, '\n', (node) => {
              // For mention nodes, return their text representation
              if (node.type.name === 'mention') {
                return `@${node.attrs.label || node.attrs.id || ''}`
              }
              // For other leaf nodes, use replacement character
              return '\ufffc'
            })
            
            if (!selectedText.trim()) {
              return false
            }

            // Prevent the "/" from being typed and replacing the selection
            event.preventDefault()

            // Call the trigger callback with selection info
            if (extension.options.onTrigger) {
              extension.options.onTrigger(selectedText, { from, to })
            }

            return true
          },
        },
      }),
    ]
  },
})

export default SelectionSlashCommand
