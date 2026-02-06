import { type Editor } from '@tiptap/react'
import {
  TextBoldRegular,
  TextItalicRegular,
  TextUnderlineRegular,
  TextStrikethroughRegular,
  ArrowUndoRegular,
  ArrowRedoRegular,
  ClockRegular,
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

const TaskListIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M5.85 3.35a.5.5 0 1 0-.7-.7L3.5 4.29l-.65-.64a.5.5 0 1 0-.7.7l1 1c.2.2.5.2.7 0l2-2ZM8.5 4a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9Zm0 5a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9Zm0 5a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9ZM5.85 8.85a.5.5 0 1 0-.7-.7L3.5 9.79l-.65-.64a.5.5 0 1 0-.7.7l1 1c.2.2.5.2.7 0l2-2Zm0 4.3c.2.2.2.5 0 .7l-2 2a.5.5 0 0 1-.7 0l-1-1a.5.5 0 0 1 .7-.7l.65.64 1.65-1.64c.2-.2.5-.2.7 0Z"/>
  </svg>
)

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

      <TextColorDropdown editor={editor} />

      <ToolbarDivider />

      {/* Lists */}
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
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Task List (Todo)"
      >
        <TaskListIcon />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Timestamp insert */}
      <ToolbarButton
        onClick={handleTimestampInsert}
        title="Insert Timestamp"
      >
        <ClockRegular className="w-4 h-4" />
      </ToolbarButton>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Build */}
      <RunBuildButton />
      <ReaderModeButton />
    </div>
  )
}
