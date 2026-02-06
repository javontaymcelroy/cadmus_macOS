import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Fragment, Schema } from 'prosemirror-model'

/**
 * Screenplay element types based on industry-standard scriptwriting format
 */
export type ScreenplayElementType = 
  | 'scene-heading'    // INT./EXT. location - time (ALL CAPS, left-aligned)
  | 'action'           // Description of what happens (regular case, left-aligned)
  | 'character'        // Character name (ALL CAPS, centered)
  | 'dialogue'         // Character's spoken words (regular case, centered)
  | 'parenthetical'    // Acting direction (in parentheses, centered)
  | 'transition'       // Scene transition (ALL CAPS, right-aligned)
  | 'shot'             // Camera shot/angle (ALL CAPS, left-aligned)

export interface ScreenplayElementOptions {
  types: ScreenplayElementType[]
  onCharacterClick?: (characterId: string) => void
  onPropClick?: (propId: string) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    screenplayElement: {
      /**
       * Set the screenplay element type for the current block
       */
      setScreenplayElement: (elementType: ScreenplayElementType, attrs?: { characterId?: string; characterColor?: string }) => ReturnType
      /**
       * Toggle the screenplay element type for the current block
       */
      toggleScreenplayElement: (elementType: ScreenplayElementType) => ReturnType
      /**
       * Remove screenplay element formatting (convert back to paragraph)
       */
      unsetScreenplayElement: () => ReturnType
      /**
       * Set character attributes on a character element
       */
      setCharacterAttrs: (characterId: string, characterColor: string) => ReturnType
    }
  }
}

/**
 * Transform fragment content to uppercase while preserving non-text nodes (like mentions)
 */
function transformContentToUppercase(content: Fragment, schema: Schema): Fragment {
  const nodes: ReturnType<typeof schema.text>[] = []
  
  content.forEach(node => {
    if (node.isText && node.text) {
      // Uppercase text nodes
      nodes.push(schema.text(node.text.toUpperCase(), node.marks))
    } else if (node.type.name === 'mention') {
      // Preserve mention nodes as-is, but uppercase the label if present
      const newAttrs = { ...node.attrs }
      if (newAttrs.label && typeof newAttrs.label === 'string') {
        newAttrs.label = newAttrs.label.toUpperCase()
      }
      nodes.push(node.type.create(newAttrs))
    } else {
      // Keep other nodes unchanged
      nodes.push(node)
    }
  })
  
  return Fragment.from(nodes)
}

/**
 * Screenplay element definitions with formatting rules
 */
export const SCREENPLAY_ELEMENTS: {
  type: ScreenplayElementType
  name: string
  shortcut: string
  description: string
  uppercase: boolean
  alignment: 'left' | 'center' | 'right'
}[] = [
  {
    type: 'scene-heading',
    name: 'Scene Heading',
    shortcut: 'S',
    description: 'INT./EXT. LOCATION - TIME',
    uppercase: true,
    alignment: 'left'
  },
  {
    type: 'action',
    name: 'Action',
    shortcut: 'A',
    description: 'Describe what happens in the scene',
    uppercase: false,
    alignment: 'left'
  },
  {
    type: 'character',
    name: 'Character',
    shortcut: 'C',
    description: 'Character name before dialogue',
    uppercase: true,
    alignment: 'center'
  },
  {
    type: 'dialogue',
    name: 'Dialogue',
    shortcut: 'D',
    description: 'Character\'s spoken words',
    uppercase: false,
    alignment: 'center'
  },
  {
    type: 'parenthetical',
    name: 'Parenthetical',
    shortcut: 'P',
    description: 'Acting direction (e.g., whispering)',
    uppercase: false,
    alignment: 'center'
  },
  {
    type: 'transition',
    name: 'Transition',
    shortcut: 'T',
    description: 'CUT TO:, FADE OUT, etc.',
    uppercase: true,
    alignment: 'right'
  },
  {
    type: 'shot',
    name: 'Shot',
    shortcut: 'H',
    description: 'CLOSE UP, WIDE SHOT, ANGLE ON, etc.',
    uppercase: true,
    alignment: 'left'
  }
]

/**
 * Get element definition by type
 */
export function getScreenplayElementDef(type: ScreenplayElementType) {
  return SCREENPLAY_ELEMENTS.find(el => el.type === type)
}

/**
 * ScreenplayElement TipTap Extension
 */
export const ScreenplayElement = Node.create<ScreenplayElementOptions>({
  name: 'screenplayElement',

  group: 'block',

  content: 'inline*',

  defining: true,

  addOptions() {
    return {
      types: ['scene-heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition', 'shot'],
      onCharacterClick: undefined,
      onPropClick: undefined
    }
  },

  addAttributes() {
    return {
      elementType: {
        default: 'action',
        parseHTML: element => element.getAttribute('data-element-type') || 'action',
        renderHTML: attributes => ({
          'data-element-type': attributes.elementType
        })
      },
      characterId: {
        default: null,
        parseHTML: element => element.getAttribute('data-character-id') || null,
        renderHTML: attributes => {
          if (!attributes.characterId) return {}
          return { 'data-character-id': attributes.characterId }
        }
      },
      characterColor: {
        default: null,
        parseHTML: element => element.getAttribute('data-character-color') || null,
        renderHTML: attributes => {
          if (!attributes.characterColor) return {}
          return { 'data-character-color': attributes.characterColor }
        }
      },
      propId: {
        default: null,
        parseHTML: element => element.getAttribute('data-prop-id') || null,
        renderHTML: attributes => {
          if (!attributes.propId) return {}
          return { 'data-prop-id': attributes.propId }
        }
      },
      propIcon: {
        default: null,
        parseHTML: element => element.getAttribute('data-prop-icon') || null,
        renderHTML: attributes => {
          if (!attributes.propIcon) return {}
          return { 'data-prop-icon': attributes.propIcon }
        }
      },
      propColor: {
        default: null,
        parseHTML: element => element.getAttribute('data-prop-color') || null,
        renderHTML: attributes => {
          if (!attributes.propColor) return {}
          return { 'data-prop-color': attributes.propColor }
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-screenplay-element]',
        getAttrs: element => {
          if (typeof element === 'string') return false
          return {
            elementType: element.getAttribute('data-element-type') || 'action',
            characterId: element.getAttribute('data-character-id') || null,
            characterColor: element.getAttribute('data-character-color') || null,
            propId: element.getAttribute('data-prop-id') || null,
            propIcon: element.getAttribute('data-prop-icon') || null,
            propColor: element.getAttribute('data-prop-color') || null
          }
        }
      }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const elementType = node.attrs.elementType as ScreenplayElementType
    const elementDef = getScreenplayElementDef(elementType)
    const characterColor = node.attrs.characterColor as string | null
    const characterId = node.attrs.characterId as string | null
    const propId = node.attrs.propId as string | null
    const propIcon = node.attrs.propIcon as string | null
    const propColor = node.attrs.propColor as string | null
    
    const styles: string[] = []
    if (elementDef?.uppercase) {
      styles.push('text-transform: uppercase')
    }
    if (elementType === 'character' && characterColor) {
      styles.push(`color: ${characterColor}`)
      styles.push('font-weight: bold')
    }
    // Apply prop styling (gold brand color)
    if (propId && propColor) {
      styles.push(`color: ${propColor}`)
      styles.push('font-weight: bold')
    }
    
    const attrs: Record<string, string> = {
      'data-screenplay-element': '',
      'data-element-type': elementType,
      class: `screenplay-element screenplay-${elementType}`
    }
    
    if (styles.length > 0) {
      attrs.style = styles.join('; ')
    }
    
    if (characterId) {
      attrs['data-character-id'] = characterId
      attrs['title'] = 'Ctrl+Click to view character notes'
    }
    
    if (characterColor) {
      attrs['data-character-color'] = characterColor
    }
    
    if (propId) {
      attrs['data-prop-id'] = propId
      attrs['title'] = 'Ctrl+Click to view prop notes'
    }
    
    if (propIcon) {
      attrs['data-prop-icon'] = propIcon
    }
    
    if (propColor) {
      attrs['data-prop-color'] = propColor
    }
    
    return [
      'div',
      mergeAttributes(HTMLAttributes, attrs),
      0
    ]
  },

  addCommands() {
    return {
      setScreenplayElement: (elementType: ScreenplayElementType, attrs?: { characterId?: string; characterColor?: string }) => ({ tr, state, dispatch }) => {
        const { from } = state.selection
        const $from = state.doc.resolve(from)
        const node = $from.parent
        const nodeStart = $from.before()
        
        // Build new attributes
        const nodeAttrs: Record<string, unknown> = { elementType }
        if (attrs?.characterId) {
          nodeAttrs.characterId = attrs.characterId
        }
        if (attrs?.characterColor) {
          nodeAttrs.characterColor = attrs.characterColor
        }
        
        // Get the screenplay element node type from the schema
        const screenplayNodeType = state.schema.nodes[this.name]
        if (!screenplayNodeType) {
          return false
        }
        
        // Check if the element type requires uppercase
        const elementDef = getScreenplayElementDef(elementType)
        const needsUppercase = elementDef?.uppercase
        
        // Create the new node with preserved content (uppercased if needed)
        const newNode = screenplayNodeType.create(
          nodeAttrs,
          needsUppercase ? transformContentToUppercase(node.content, state.schema) : node.content,
          node.marks
        )
        
        if (dispatch) {
          tr.replaceWith(nodeStart, nodeStart + node.nodeSize, newNode)
          dispatch(tr)
        }
        
        return true
      },

      toggleScreenplayElement: (elementType: ScreenplayElementType) => ({ tr, state, dispatch }) => {
        const { from } = state.selection
        const $from = state.doc.resolve(from)
        const node = $from.parent
        const nodeStart = $from.before()
        
        if (node.type.name === this.name && node.attrs.elementType === elementType) {
          // Convert back to paragraph, preserving content
          const paragraphType = state.schema.nodes.paragraph
          if (!paragraphType) return false
          
          const newNode = paragraphType.create(null, node.content, node.marks)
          if (dispatch) {
            tr.replaceWith(nodeStart, nodeStart + node.nodeSize, newNode)
            dispatch(tr)
          }
          return true
        }
        
        // Set to screenplay element, preserving content
        const screenplayNodeType = state.schema.nodes[this.name]
        if (!screenplayNodeType) return false
        
        const elementDef = getScreenplayElementDef(elementType)
        const needsUppercase = elementDef?.uppercase
        
        const newNode = screenplayNodeType.create(
          { elementType },
          needsUppercase ? transformContentToUppercase(node.content, state.schema) : node.content,
          node.marks
        )
        
        if (dispatch) {
          tr.replaceWith(nodeStart, nodeStart + node.nodeSize, newNode)
          dispatch(tr)
        }
        return true
      },

      unsetScreenplayElement: () => ({ tr, state, dispatch }) => {
        const { from } = state.selection
        const $from = state.doc.resolve(from)
        const node = $from.parent
        const nodeStart = $from.before()
        
        const paragraphType = state.schema.nodes.paragraph
        if (!paragraphType) return false
        
        // Preserve content when converting back to paragraph
        const newNode = paragraphType.create(null, node.content, node.marks)
        if (dispatch) {
          tr.replaceWith(nodeStart, nodeStart + node.nodeSize, newNode)
          dispatch(tr)
        }
        return true
      },

      setCharacterAttrs: (characterId: string, characterColor: string) => ({ commands, state }) => {
        const { from } = state.selection
        const $from = state.doc.resolve(from)
        const node = $from.parent
        
        if (node.type.name !== this.name || node.attrs.elementType !== 'character') {
          return false
        }
        
        return commands.updateAttributes(this.name, {
          characterId,
          characterColor
        })
      }
    }
  },

  addKeyboardShortcuts() {
    return {
      'Tab': ({ editor }) => {
        const { state } = editor
        const { from } = state.selection
        const $from = state.doc.resolve(from)
        const node = $from.parent
        
        if (node.type.name !== this.name) return false
        
        const currentType = node.attrs.elementType as ScreenplayElementType
        
        const flowMap: Record<ScreenplayElementType, ScreenplayElementType> = {
          'character': 'dialogue',
          'dialogue': 'action',
          'parenthetical': 'dialogue',
          'action': 'action',
          'scene-heading': 'action',
          'transition': 'action',
          'shot': 'action'
        }
        
        const nextType = flowMap[currentType]
        if (nextType && nextType !== currentType) {
          editor.chain()
            .splitBlock()
            .setScreenplayElement(nextType)
            .run()
          return true
        }
        
        return false
      }
    }
  },

  addProseMirrorPlugins() {
    const { onCharacterClick, onPropClick } = this.options

    return [
      new Plugin({
        key: new PluginKey('screenplayElementClick'),
        props: {
          handleClick: (view, _pos, event) => {
            if (!event.ctrlKey && !event.metaKey) return false

            const target = event.target as HTMLElement
            
            // Check for character click
            if (onCharacterClick) {
              const characterElement = target.closest('[data-element-type="character"]')
              
              if (characterElement) {
                const characterId = characterElement.getAttribute('data-character-id')
                
                if (characterId) {
                  const clickCoords = { left: event.clientX, top: event.clientY }
                  const posAtClick = view.posAtCoords(clickCoords)
                  
                  if (posAtClick && posAtClick.inside >= 0) {
                    onCharacterClick(characterId)
                    return true
                  }
                }
              }
            }

            // Check for prop click
            if (onPropClick) {
              const propElement = target.closest('[data-prop-id]')
              
              if (propElement) {
                const propId = propElement.getAttribute('data-prop-id')
                
                if (propId) {
                  const clickCoords = { left: event.clientX, top: event.clientY }
                  const posAtClick = view.posAtCoords(clickCoords)
                  
                  if (posAtClick && posAtClick.inside >= 0) {
                    onPropClick(propId)
                    return true
                  }
                }
              }
            }

            return false
          }
        }
      })
    ]
  }
})
