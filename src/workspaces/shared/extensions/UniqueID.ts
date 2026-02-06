import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface UniqueIDOptions {
  /**
   * The attribute name to use for the block ID
   * @default 'blockId'
   */
  attributeName: string
  /**
   * The types of nodes to add unique IDs to
   * @default ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'bulletList', 'orderedList']
   */
  types: string[]
  /**
   * Function to generate unique IDs
   * @default () => crypto.randomUUID()
   */
  generateID: () => string
}

export const UniqueID = Extension.create<UniqueIDOptions>({
  name: 'uniqueID',

  addOptions() {
    return {
      attributeName: 'blockId',
      types: ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'bulletList', 'orderedList'],
      generateID: () => crypto.randomUUID(),
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: element => element.getAttribute(`data-block-id`),
            renderHTML: attributes => {
              if (!attributes[this.options.attributeName]) {
                return {}
              }
              return {
                'data-block-id': attributes[this.options.attributeName],
              }
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    const { types, attributeName, generateID } = this.options

    return [
      new Plugin({
        key: new PluginKey('uniqueID'),
        appendTransaction: (transactions, _oldState, newState) => {
          // Only process if document changed
          const docChanged = transactions.some(tr => tr.docChanged)
          if (!docChanged) {
            return null
          }

          const tr = newState.tr
          let modified = false
          
          // Track seen IDs to detect duplicates
          const seenIds = new Set<string>()
          const nodesToFix: Array<{ pos: number; node: ProseMirrorNode }> = []

          // First pass: find nodes without IDs or with duplicate IDs
          newState.doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (types.includes(node.type.name)) {
              const blockId = node.attrs[attributeName]
              
              if (!blockId || seenIds.has(blockId)) {
                // No ID or duplicate ID - needs a new one
                nodesToFix.push({ pos, node })
              } else {
                seenIds.add(blockId)
              }
            }
          })

          // Second pass: assign new unique IDs
          // Process in reverse order to maintain correct positions
          for (let i = nodesToFix.length - 1; i >= 0; i--) {
            const { pos, node } = nodesToFix[i]
            const newId = generateID()
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              [attributeName]: newId,
            })
            modified = true
          }

          return modified ? tr : null
        },
      }),
    ]
  },
})

/**
 * Helper function to get the block ID at a given position in the document
 */
export function getBlockIdAtPos(doc: ProseMirrorNode, pos: number, attributeName = 'blockId'): string | null {
  let blockId: string | null = null
  
  doc.nodesBetween(pos, pos, (node: ProseMirrorNode) => {
    if (node.attrs && node.attrs[attributeName]) {
      blockId = node.attrs[attributeName] as string
      return false
    }
  })
  
  return blockId
}
