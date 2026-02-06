/**
 * SlashCommand Extension
 * 
 * Provides a "/" triggered command menu for AI writing tools.
 * Uses TipTap's suggestion plugin to show a popover menu when the user types "/".
 * 
 * When text is selected, shows revision commands like "Rework", "Adjust Tone", etc.
 * When no selection, shows generative commands like "Continue Writing".
 * 
 * Selection tools are designed as "editors with guardrails" - they operate locally,
 * respect context, and never introduce new plot.
 */

import { Extension } from '@tiptap/core'
import { PluginKey } from 'prosemirror-state'
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion'

// Command types for AI writing tools
export type AIWritingCommand = 
  // Generative commands (no selection required)
  | 'continue' | 'dialogue' | 'setting' | 'expand' | 'pov' | 'negativeSpace'
  // Revision commands (selection required)
  | 'rework' | 'adjustTone' | 'shorten' | 'clearer' | 'elaborate'
  | 'tension' | 'soften' | 'imagery' | 'pacing' | 'voice' | 'contradiction'
  // Screenplay craft
  | 'scriptDoctor'

// Tone options for the "Adjust Tone" submenu
export interface ToneOption {
  id: string
  name: string
  description: string
}

export const TONE_OPTIONS: ToneOption[] = [
  { id: 'calm', name: 'Calm', description: 'Reduce emotional intensity' },
  { id: 'tense', name: 'Tense', description: 'Add urgency and pressure' },
  { id: 'playful', name: 'Playful', description: 'Lighter, more whimsical' },
  { id: 'colder', name: 'Colder', description: 'More detached, clinical' },
  { id: 'warmer', name: 'Warmer', description: 'More empathetic, caring' },
  { id: 'intimate', name: 'More Intimate', description: 'Closer, more personal' },
  { id: 'distant', name: 'More Distant', description: 'Removed, observational' },
  { id: 'confident', name: 'More Confident', description: 'Assertive, certain' },
  { id: 'uncertain', name: 'More Uncertain', description: 'Hesitant, questioning' },
]

export interface SlashCommandItem {
  id: AIWritingCommand
  name: string
  description: string
  shortcut: string
  icon: string
  requiresSelection?: boolean  // If true, only shown when text is selected
  submenu?: ToneOption[]       // For commands with submenus (e.g., Adjust Tone)
  separator?: boolean          // If true, show a separator before this item
  gated?: boolean              // If true, route through the gated writing pipeline
}

// Commands for generating NEW content (no selection)
export const SLASH_COMMANDS_GENERATE: SlashCommandItem[] = [
  {
    id: 'continue',
    name: 'Continue Writing',
    description: 'Keep the voice, mood, and details going',
    shortcut: 'C',
    icon: 'pen'
  },
  {
    id: 'dialogue',
    name: 'Dialogue Generator',
    description: 'Produce character dialog',
    shortcut: 'D',
    icon: 'chat'
  },
  {
    id: 'setting',
    name: 'Describe Setting',
    description: 'Flesh out environment details',
    shortcut: 'S',
    icon: 'location'
  },
  {
    id: 'pov',
    name: 'Write from POV',
    description: 'Produce text in a specific character voice',
    shortcut: 'P',
    icon: 'person'
  }
]

// Commands for REVISING selected text - organized by category
export const SLASH_COMMANDS_SELECTION: SlashCommandItem[] = [
  // Expansion - turn selected prompt into full scene
  {
    id: 'expand',
    name: 'Expand Selection',
    description: 'Turn selected prompt into full scene',
    shortcut: 'E',
    icon: 'expand',
    requiresSelection: true
  },
  // General revision
  {
    id: 'rework',
    name: 'Rework',
    description: 'General revision, polish and refine',
    shortcut: 'R',
    icon: 'edit',
    requiresSelection: true
  },
  // Tone adjustment with submenu
  {
    id: 'adjustTone',
    name: 'Adjust Tone',
    description: 'Shift emotional temperature',
    shortcut: 'T',
    icon: 'emoji',
    requiresSelection: true,
    submenu: TONE_OPTIONS
  },
  // Content modification
  {
    id: 'shorten',
    name: 'Shorten',
    description: 'Compress without losing beats',
    shortcut: 'S',
    icon: 'compress',
    requiresSelection: true,
    separator: true
  },
  {
    id: 'clearer',
    name: 'Make Clearer',
    description: 'Sharpen muddy actions or motivations',
    shortcut: 'C',
    icon: 'lightbulb',
    requiresSelection: true
  },
  {
    id: 'elaborate',
    name: 'Elaborate',
    description: 'Add sensory or emotional detail',
    shortcut: 'L',
    icon: 'sparkle',
    requiresSelection: true
  },
  // Emotional adjustment
  {
    id: 'tension',
    name: 'Increase Tension',
    description: 'Raise stakes using existing elements',
    shortcut: 'N',
    icon: 'warning',
    requiresSelection: true,
    separator: true
  },
  {
    id: 'soften',
    name: 'Soften Impact',
    description: 'Same events, gentler delivery',
    shortcut: 'F',
    icon: 'heart',
    requiresSelection: true
  },
  {
    id: 'imagery',
    name: 'Sharpen Imagery',
    description: 'Concrete nouns, fewer abstractions',
    shortcut: 'I',
    icon: 'eye',
    requiresSelection: true
  },
  // Technical fixes
  {
    id: 'pacing',
    name: 'Fix Pacing',
    description: 'Balance sentence rhythm and flow',
    shortcut: 'P',
    icon: 'timer',
    requiresSelection: true,
    separator: true
  },
  {
    id: 'voice',
    name: 'Align Voice',
    description: 'Match surrounding paragraph style',
    shortcut: 'V',
    icon: 'textAlign',
    requiresSelection: true
  },
  {
    id: 'contradiction',
    name: 'Resolve Contradiction',
    description: 'Fix logical inconsistencies',
    shortcut: 'X',
    icon: 'checkmark',
    requiresSelection: true
  },
  // Screenplay craft
  {
    id: 'scriptDoctor',
    name: 'Script Doctor',
    description: 'Fix formatting — leverage shots, transitions, parentheticals',
    shortcut: 'D',
    icon: 'stethoscope',
    requiresSelection: true,
    separator: true
  },
  // --- AI Writing Partner (Gated Pipeline) ---
  {
    id: 'continue',
    name: 'Continue Writing',
    description: 'Scene-aware continuation with character constraints',
    shortcut: '1',
    icon: 'pen',
    requiresSelection: true,
    separator: true,
    gated: true
  },
  {
    id: 'dialogue',
    name: 'Dialogue Generator',
    description: 'Gated character dialog with eligibility checks',
    shortcut: '2',
    icon: 'chat',
    requiresSelection: true,
    gated: true
  },
  {
    id: 'setting',
    name: 'Describe Setting',
    description: 'Constrained environment details from scene state',
    shortcut: '3',
    icon: 'location',
    requiresSelection: true,
    gated: true
  },
  {
    id: 'pov',
    name: 'Write from POV',
    description: 'Character voice with eligibility enforcement',
    shortcut: '4',
    icon: 'person',
    requiresSelection: true,
    gated: true
  },
  {
    id: 'negativeSpace',
    name: 'Negative Space',
    description: 'Organic texture — pauses, behavior, atmosphere',
    shortcut: '5',
    icon: 'weather',
    requiresSelection: true,
    gated: true
  }
]

// Legacy export for backwards compatibility
export const SLASH_COMMANDS = SLASH_COMMANDS_GENERATE

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, 'editor'>
}

export const SlashCommandPluginKey = new PluginKey('slashCommand')

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        pluginKey: SlashCommandPluginKey,
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }) => {
          // Delete the "/" trigger character and any typed query
          editor.chain().focus().deleteRange(range).run()
          
          // The actual command execution is handled by the menu component
          // which calls props.command with the selected AI command
          if (props.command) {
            props.command(editor, props.id)
          }
        },
        items: ({ query }): SlashCommandItem[] => {
          const normalizedQuery = query.toLowerCase()
          
          return SLASH_COMMANDS_GENERATE.filter(item => 
            item.name.toLowerCase().includes(normalizedQuery) ||
            item.description.toLowerCase().includes(normalizedQuery) ||
            item.id.includes(normalizedQuery)
          )
        },
        allow: ({ state, range }) => {
          // Allow slash command at the start of a line or after whitespace
          const $from = state.doc.resolve(range.from)
          const textBefore = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - 1),
            $from.parentOffset,
            undefined,
            '\ufffc'
          )
          
          // Allow if at start of block or after whitespace
          const isStartOfBlock = $from.parentOffset === 0 || $from.parentOffset === 1
          const afterWhitespace = /\s$/.test(textBefore)
          
          return isStartOfBlock || afterWhitespace || textBefore === ''
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

export default SlashCommand
