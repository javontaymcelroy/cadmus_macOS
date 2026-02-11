import { type Editor } from '@tiptap/react'
import {
  TextBoldRegular,
  TextItalicRegular,
  TextUnderlineRegular,
  TextStrikethroughRegular,
  HighlightRegular,
  CodeRegular,
  ArrowUndoRegular,
  ArrowRedoRegular,
  ClockRegular,
  BookOpenRegular,
  DismissRegular,
  TextBulletListLtrRegular,
  TextNumberListLtrRegular,
  TaskListLtrRegular,
  DrawTextRegular,
  TextQuoteRegular,
} from '@fluentui/react-icons'
import { ToolbarButton, ToolbarDivider, TextColorDropdown, FontFamilyDropdown, RunBuildButton, ReaderModeButton, InfiniteCanvasButton, OverflowToolbar } from '../../shared/components'
import { useProjectStore } from '../../../stores/projectStore'

// Format timestamp in a human-friendly way
function formatTimestamp(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }
  return date.toLocaleDateString('en-US', options)
}

interface JournalToolbarProps {
  editor: Editor | null
}

export function JournalToolbar({ editor }: JournalToolbarProps) {
  const { ui, setReaderMode, toggleDrawingMode } = useProjectStore()

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

  const handleTimestampInsert = () => {
    const timestamp = formatTimestamp(new Date())
    // Insert timestamp as a styled heading or bold text block
    editor.chain()
      .focus()
      .insertContent({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: timestamp }]
      })
      .run()
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

      {/* Block formatting - Body and Headings */}
      <button
        onClick={() => {
          // Get current fontFamily from any block type before changing
          const currentFont = editor.getAttributes('paragraph').fontFamily ||
                              editor.getAttributes('heading').fontFamily
          // Change to paragraph and preserve fontFamily
          editor.chain().setParagraph().updateAttributes('paragraph', { fontFamily: currentFont }).run()
        }}
        className={`px-2 py-1 text-xs font-ui font-medium rounded transition-colors whitespace-nowrap ${
          editor.isActive('paragraph') && !editor.isActive('heading')
            ? 'bg-theme-active text-theme-accent'
            : 'text-theme-secondary hover:text-theme-accent hover:bg-theme-hover'
        }`}
        title="Body text"
      >
        Body
      </button>
      <button
        onClick={() => {
          const currentFont = editor.getAttributes('paragraph').fontFamily ||
                              editor.getAttributes('heading').fontFamily
          editor.chain().toggleHeading({ level: 1 }).updateAttributes('heading', { fontFamily: currentFont }).run()
        }}
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
        onClick={() => {
          const currentFont = editor.getAttributes('paragraph').fontFamily ||
                              editor.getAttributes('heading').fontFamily
          editor.chain().toggleHeading({ level: 2 }).updateAttributes('heading', { fontFamily: currentFont }).run()
        }}
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
        onClick={() => {
          const currentFont = editor.getAttributes('paragraph').fontFamily ||
                              editor.getAttributes('heading').fontFamily
          editor.chain().toggleHeading({ level: 3 }).updateAttributes('heading', { fontFamily: currentFont }).run()
        }}
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
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title="Highlight"
      >
        <HighlightRegular className="w-4 h-4" />
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
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Task List (Todo)"
      >
        <TaskListLtrRegular className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Timestamp insert */}
      <ToolbarButton
        onClick={handleTimestampInsert}
        title="Insert Timestamp"
      >
        <ClockRegular className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Drawing mode toggle */}
      <ToolbarButton
        onClick={() => toggleDrawingMode()}
        isActive={ui.drawingMode}
        title={ui.drawingMode ? 'Exit Drawing Mode' : 'Drawing Mode'}
      >
        <DrawTextRegular className="w-4 h-4" />
      </ToolbarButton>

      {/* Infinite canvas toggle */}
      <InfiniteCanvasButton />
    </OverflowToolbar>
  )
}
