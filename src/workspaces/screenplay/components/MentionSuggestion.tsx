import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { PersonRegular, AddRegular } from '@fluentui/react-icons'
import { getPropIconComponent } from '../../../components/PropsPanel'
import type { Character, Prop } from '../../../types/project'

export interface MentionItem {
  id: string
  type: 'character' | 'prop'
  label: string
  color: string
  icon?: string
}

export interface MentionSuggestionProps {
  items: MentionItem[]
  command: (item: MentionItem) => void
  query: string
  onCreateCharacter?: (name: string) => Promise<Character | undefined>
  onCreateProp?: (name: string) => Promise<Prop | undefined>
}

export interface MentionSuggestionRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const MentionSuggestion = forwardRef<MentionSuggestionRef, MentionSuggestionProps>(
  ({ items, command, query, onCreateCharacter, onCreateProp }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Check if we should show create options
    const trimmedQuery = query.trim()
    const hasExactCharacterMatch = items.some(
      item => item.type === 'character' && item.label.toUpperCase() === trimmedQuery.toUpperCase()
    )
    const hasExactPropMatch = items.some(
      item => item.type === 'prop' && item.label.toUpperCase() === trimmedQuery.toUpperCase()
    )
    const showCreateCharacter = trimmedQuery && !hasExactCharacterMatch && onCreateCharacter
    const showCreateProp = trimmedQuery && !hasExactPropMatch && onCreateProp

    // Total items including create options
    const totalItems = items.length + (showCreateCharacter ? 1 : 0) + (showCreateProp ? 1 : 0)
    const createCharacterIndex = items.length
    const createPropIndex = items.length + (showCreateCharacter ? 1 : 0)

    const selectItem = useCallback(async (index: number) => {
      // Handle create character
      if (showCreateCharacter && index === createCharacterIndex) {
        const newChar = await onCreateCharacter!(trimmedQuery)
        if (newChar) {
          command({
            id: newChar.id,
            type: 'character',
            label: newChar.name,
            color: newChar.color,
          })
        }
        return
      }

      // Handle create prop
      if (showCreateProp && index === createPropIndex) {
        const newProp = await onCreateProp!(trimmedQuery)
        if (newProp) {
          command({
            id: newProp.id,
            type: 'prop',
            label: newProp.name,
            color: '#fbbf24', // Gold for props
            icon: newProp.icon,
          })
        }
        return
      }

      // Handle existing item
      const item = items[index]
      if (item) {
        command(item)
      }
    }, [items, command, showCreateCharacter, showCreateProp, createCharacterIndex, createPropIndex, trimmedQuery, onCreateCharacter, onCreateProp])

    const upHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1))
    }, [totalItems])

    const downHandler = useCallback(() => {
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0))
    }, [totalItems])

    const enterHandler = useCallback(() => {
      selectItem(selectedIndex)
    }, [selectItem, selectedIndex])

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          upHandler()
          return true
        }

        if (event.key === 'ArrowDown') {
          downHandler()
          return true
        }

        if (event.key === 'Enter') {
          enterHandler()
          return true
        }

        return false
      },
    }))

    if (totalItems === 0) {
      return (
        <div className="bg-ink-900 border border-ink-600 rounded-lg shadow-2xl p-3 min-w-[200px]">
          <p className="text-sm text-white/40 font-ui text-center">
            No matches found
          </p>
        </div>
      )
    }

    // Group items by type
    const characters = items.filter(item => item.type === 'character')
    const props = items.filter(item => item.type === 'prop')

    return (
      <div className="bg-ink-900 border border-ink-600 rounded-lg shadow-2xl py-1 min-w-[240px] max-h-[320px] overflow-auto">
        {/* Characters section */}
        {characters.length > 0 && (
          <>
            <div className="px-3 py-1.5 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider border-b border-ink-700 mb-1">
              Characters
            </div>
            {characters.map((item) => {
              const itemIndex = items.indexOf(item)
              return (
                <button
                  key={`char-${item.id}`}
                  onClick={() => selectItem(itemIndex)}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                  className={clsx(
                    'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                    itemIndex === selectedIndex
                      ? 'bg-gold-400/20'
                      : 'hover:bg-ink-800'
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  >
                    <PersonRegular className="w-3.5 h-3.5 text-ink-900" />
                  </div>
                  <span
                    className="text-sm font-medium truncate"
                    style={{
                      color: itemIndex === selectedIndex ? item.color : 'rgba(255,255,255,0.8)',
                      fontFamily: 'Courier New, Courier, monospace'
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </>
        )}

        {/* Props section */}
        {props.length > 0 && (
          <>
            <div className={clsx(
              "px-3 py-1.5 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider border-b border-ink-700 mb-1",
              characters.length > 0 && "border-t mt-1"
            )}>
              Props
            </div>
            {props.map((item) => {
              const itemIndex = items.indexOf(item)
              const IconComponent = getPropIconComponent(item.icon || 'Diamond')
              return (
                <button
                  key={`prop-${item.id}`}
                  onClick={() => selectItem(itemIndex)}
                  onMouseEnter={() => setSelectedIndex(itemIndex)}
                  className={clsx(
                    'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                    itemIndex === selectedIndex
                      ? 'bg-gold-400/20'
                      : 'hover:bg-ink-800'
                  )}
                >
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-gold-400/20">
                    <IconComponent className="w-3.5 h-3.5 text-gold-400" />
                  </div>
                  <span
                    className="text-sm font-medium truncate text-gold-400"
                    style={{ fontFamily: 'Courier New, Courier, monospace' }}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
          </>
        )}

        {/* Create options */}
        {(showCreateCharacter || showCreateProp) && (
          <>
            <div className={clsx(
              "px-3 py-1.5 text-[10px] font-ui font-semibold text-ink-400 uppercase tracking-wider border-b border-ink-700 mb-1",
              (characters.length > 0 || props.length > 0) && "border-t mt-1"
            )}>
              Create New
            </div>
            
            {showCreateCharacter && (
              <button
                onClick={() => selectItem(createCharacterIndex)}
                onMouseEnter={() => setSelectedIndex(createCharacterIndex)}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                  selectedIndex === createCharacterIndex
                    ? 'bg-gold-400/20'
                    : 'hover:bg-ink-800'
                )}
              >
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-gold-400/20 border border-gold-400/30">
                  <AddRegular className="w-3.5 h-3.5 text-gold-400" />
                </div>
                <span className="text-sm font-ui">
                  <span className="text-white/60">Character: </span>
                  <span
                    className="font-medium text-gold-400"
                    style={{ fontFamily: 'Courier New, Courier, monospace' }}
                  >
                    {trimmedQuery.toUpperCase()}
                  </span>
                </span>
              </button>
            )}

            {showCreateProp && (
              <button
                onClick={() => selectItem(createPropIndex)}
                onMouseEnter={() => setSelectedIndex(createPropIndex)}
                className={clsx(
                  'w-full px-3 py-2 flex items-center gap-3 text-left transition-colors',
                  selectedIndex === createPropIndex
                    ? 'bg-gold-400/20'
                    : 'hover:bg-ink-800'
                )}
              >
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-gold-400/20 border border-gold-400/30">
                  <AddRegular className="w-3.5 h-3.5 text-gold-400" />
                </div>
                <span className="text-sm font-ui">
                  <span className="text-white/60">Prop: </span>
                  <span
                    className="font-medium text-gold-400"
                    style={{ fontFamily: 'Courier New, Courier, monospace' }}
                  >
                    {trimmedQuery.toUpperCase()}
                  </span>
                </span>
              </button>
            )}
          </>
        )}

        <div className="px-3 py-1.5 mt-1 border-t border-ink-700 text-[10px] text-ink-500 font-ui">
          <span className="text-ink-400">↑↓</span> Navigate • <span className="text-ink-400">Enter</span> Select • <span className="text-ink-400">Esc</span> Close
        </div>
      </div>
    )
  }
)

MentionSuggestion.displayName = 'MentionSuggestion'
