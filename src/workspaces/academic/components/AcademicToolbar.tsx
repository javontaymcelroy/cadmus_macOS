import { type Editor } from '@tiptap/react'
import {
  TextBoldRegular,
  TextItalicRegular,
  TextUnderlineRegular,
  TextStrikethroughRegular,
  TextAlignLeftRegular,
  TextAlignCenterRegular,
  TextAlignJustifyRegular,
  ArrowUndoRegular,
  ArrowRedoRegular,
  ImageRegular,
  BookOpenRegular,
  DismissRegular,
} from '@fluentui/react-icons'
import { ToolbarButton, ToolbarDivider, TextColorDropdown, FontFamilyDropdown, RunBuildButton, ReaderModeButton } from '../../shared/components'
import { useProjectStore } from '../../../stores/projectStore'

// Inline SVG icons for lists (not available in Fluent UI)
const BulletListIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M2 6h.01M2 12h.01M2 18h.01" />
  </svg>
)

const NumberedListIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 6h13M7 12h13m-13 6h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)

const BlockquoteIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
)

interface AcademicToolbarProps {
  editor: Editor | null
}

export function AcademicToolbar({ editor }: AcademicToolbarProps) {
  const { ui, setReaderMode } = useProjectStore()

  if (!editor) return null

  // Reader mode: show minimal header with exit button
  if (ui.readerMode) {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-theme-header border-b border-theme-subtle">
        <div className="flex items-center gap-2 text-theme-secondary">
          <BookOpenRegular className="w-4 h-4" />
          <span className="text-sm font-medium">Reader Mode</span>
        </div>
        <button
          onClick={() => setReaderMode(false)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-theme-tertiary text-theme-primary hover:bg-theme-active border border-theme-default"
          title="Exit Reader Mode"
        >
          <DismissRegular className="w-4 h-4" />
          <span>Exit</span>
        </button>
      </div>
    )
  }

  const handleImageInsert = async () => {
    try {
      const result = await window.api.dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        const assetUrl = `cadmus-asset://load?path=${encodeURIComponent(filePath)}`
        editor.chain().focus().setImage({ src: assetUrl }).run()
      }
    } catch (err) {
      console.error('Failed to insert image:', err)
    }
  }

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-theme-header border-b border-theme-subtle overflow-x-auto scrollbar-hide">
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (⌘Z)"
      >
        <ArrowUndoRegular className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (⌘⇧Z)"
      >
        <ArrowRedoRegular className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Font Family */}
      <FontFamilyDropdown editor={editor} />

      <ToolbarDivider />

      {/* Headings */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`px-2 py-1 text-xs font-ui font-medium rounded transition-colors whitespace-nowrap ${
          editor.isActive('heading', { level: 1 })
            ? 'bg-theme-active text-theme-accent'
            : 'text-theme-secondary hover:text-theme-accent hover:bg-theme-hover'
        }`}
        title="Heading 1"
      >
        H1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`px-2 py-1 text-xs font-ui font-medium rounded transition-colors whitespace-nowrap ${
          editor.isActive('heading', { level: 2 })
            ? 'bg-theme-active text-theme-accent'
            : 'text-theme-secondary hover:text-theme-accent hover:bg-theme-hover'
        }`}
        title="Heading 2"
      >
        H2
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`px-2 py-1 text-xs font-ui font-medium rounded transition-colors whitespace-nowrap ${
          editor.isActive('heading', { level: 3 })
            ? 'bg-theme-active text-theme-accent'
            : 'text-theme-secondary hover:text-theme-accent hover:bg-theme-hover'
        }`}
        title="Heading 3"
      >
        H3
      </button>

      <ToolbarDivider />

      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (⌘B)"
      >
        <TextBoldRegular className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (⌘I)"
      >
        <TextItalicRegular className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (⌘U)"
      >
        <TextUnderlineRegular className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <TextStrikethroughRegular className="w-4 h-4" />
      </ToolbarButton>

      <TextColorDropdown editor={editor} />

      <ToolbarDivider />

      {/* Text alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <TextAlignLeftRegular className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <TextAlignCenterRegular className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        title="Justify"
      >
        <TextAlignJustifyRegular className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists & Quote */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <BulletListIcon />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <NumberedListIcon />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Block Quote"
      >
        <BlockquoteIcon />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Image insert */}
      <ToolbarButton
        onClick={handleImageInsert}
        title="Insert Image"
      >
        <ImageRegular className="w-4 h-4" />
      </ToolbarButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Build */}
      <RunBuildButton />
      <ReaderModeButton />
    </div>
  )
}
