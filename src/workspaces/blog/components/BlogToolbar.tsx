import { type Editor } from '@tiptap/react'
import {
  TextBoldRegular,
  TextItalicRegular,
  TextUnderlineRegular,
  TextStrikethroughRegular,
  TextAlignLeftRegular,
  TextAlignCenterRegular,
  ArrowUndoRegular,
  ArrowRedoRegular,
  ImageRegular,
  LinkRegular,
  CodeRegular,
  BookOpenRegular,
  DismissRegular,
  TextBulletListLtrRegular,
  TextNumberListLtrRegular,
  TextQuoteRegular,
} from '@fluentui/react-icons'
import { ToolbarButton, ToolbarDivider, TextColorDropdown, FontFamilyDropdown, RunBuildButton, ReaderModeButton, InfiniteCanvasButton, OverflowToolbar } from '../../shared/components'
import { useProjectStore } from '../../../stores/projectStore'

interface BlogToolbarProps {
  editor: Editor | null
}

export function BlogToolbar({ editor }: BlogToolbarProps) {
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

  const handleLinkInsert = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  return (
    <OverflowToolbar rightContent={<><RunBuildButton /><ReaderModeButton /></>}>
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
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Inline Code"
      >
        <CodeRegular className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Callout"
      >
        <TextQuoteRegular className="w-4 h-4" />
      </ToolbarButton>

      <TextColorDropdown editor={editor} />

      <ToolbarDivider />

      {/* Alignment */}
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

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <TextBulletListLtrRegular className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <TextNumberListLtrRegular className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Insert */}
      <ToolbarButton
        onClick={handleLinkInsert}
        isActive={editor.isActive('link')}
        title="Insert Link"
      >
        <LinkRegular className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={handleImageInsert}
        title="Insert Image"
      >
        <ImageRegular className="w-4 h-4" />
      </ToolbarButton>

      {/* Infinite canvas toggle */}
      <InfiniteCanvasButton />
    </OverflowToolbar>
  )
}
