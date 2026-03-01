import { HorizontalRule as TiptapHorizontalRule } from '@tiptap/extension-horizontal-rule'

/**
 * Custom HorizontalRule that's selectable and draggable.
 * The default renders a bare <hr> void element with no hover area.
 * This wraps it so the DragHandle can attach and users can click/grab it.
 */
export const HorizontalRule = TiptapHorizontalRule.extend({
  selectable: true,
  draggable: true,
  atom: true,
})
