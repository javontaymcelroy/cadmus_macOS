import { Extension } from '@tiptap/core'

/**
 * PreserveMarks Extension (Simplified)
 * 
 * This extension was previously used to preserve textStyle marks (fontFamily, etc.)
 * when creating new blocks. Now that fontFamily is a block-level attribute
 * (stored on paragraph/heading nodes, not as inline text marks), this workaround
 * is no longer needed.
 * 
 * The extension is kept as a no-op to avoid breaking imports in editors that
 * still reference it. It can be safely removed from editor configurations
 * in a future cleanup.
 */
export const PreserveMarks = Extension.create({
  name: 'preserveMarks',
  
  // No plugins needed - fontFamily is now block-level
})
