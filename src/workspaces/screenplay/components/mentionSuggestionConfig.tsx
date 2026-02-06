import { ReactRenderer } from '@tiptap/react'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { MentionSuggestion, MentionSuggestionRef, MentionItem } from './MentionSuggestion'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import type { Character, Prop } from '../../../types/project'

export interface MentionSuggestionConfigOptions {
  getCharacters: () => Character[]
  getProps: () => Prop[]
  onCreateCharacter?: (name: string) => Promise<Character | undefined>
  onCreateProp?: (name: string) => Promise<Prop | undefined>
}

export function createMentionSuggestionConfig(
  options: MentionSuggestionConfigOptions
): Omit<SuggestionOptions<MentionItem>, 'editor'> {
  return {
    items: ({ query }): MentionItem[] => {
      const characters = options.getCharacters()
      const props = options.getProps()
      const normalizedQuery = query.toLowerCase()

      const characterItems: MentionItem[] = characters
        .filter(char => char.name.toLowerCase().includes(normalizedQuery))
        .map(char => ({
          id: char.id,
          type: 'character' as const,
          label: char.name,
          color: char.color,
        }))

      const propItems: MentionItem[] = props
        .filter(prop => prop.name.toLowerCase().includes(normalizedQuery))
        .map(prop => ({
          id: prop.id,
          type: 'prop' as const,
          label: prop.name,
          color: '#fbbf24', // Gold for props
          icon: prop.icon,
        }))

      return [...characterItems, ...propItems]
    },

    render: () => {
      let component: ReactRenderer<MentionSuggestionRef> | null = null
      let popup: TippyInstance[] | null = null

      return {
        onStart: (props: SuggestionProps<MentionItem>) => {
          component = new ReactRenderer(MentionSuggestion, {
            props: {
              ...props,
              onCreateCharacter: options.onCreateCharacter,
              onCreateProp: options.onCreateProp,
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
            theme: 'mention',
            animation: 'shift-away',
            offset: [0, 4],
          })
        },

        onUpdate(props: SuggestionProps<MentionItem>) {
          component?.updateProps({
            ...props,
            onCreateCharacter: options.onCreateCharacter,
            onCreateProp: options.onCreateProp,
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
