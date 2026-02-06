import { Image } from '@tiptap/extension-image'

export interface AssetImageOptions {
  inline: boolean
  allowBase64: boolean
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    assetImage: {
      /**
       * Insert an asset image
       */
      setAssetImage: (options: { src: string; assetId: string; alt?: string; title?: string }) => ReturnType
    }
  }
}

export const AssetImage = Image.extend<AssetImageOptions>({
  name: 'assetImage',

  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      allowBase64: false,
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      assetId: {
        default: null,
        parseHTML: element => element.getAttribute('data-asset-id'),
        renderHTML: attributes => {
          if (!attributes.assetId) {
            return {}
          }
          return {
            'data-asset-id': attributes.assetId,
          }
        },
      },
    }
  },

  addCommands() {
    return {
      setAssetImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})
