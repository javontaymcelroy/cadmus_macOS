import { type Editor } from '@tiptap/react'
import { clsx } from 'clsx'
import { useState, useEffect, useCallback } from 'react'
import {
  TextBoldRegular,
  TextItalicRegular,
  TextUnderlineRegular,
  TextStrikethroughRegular,
  TextAlignLeftRegular,
  TextAlignCenterRegular,
  TextAlignRightRegular,
  ArrowUndoRegular,
  ArrowRedoRegular,
  ImageSparkleFilled,
  PenSparkleFilled,
  VideoClipFilled,
  TaskListLtrRegular,
  BookOpenFilled,
  WhiteboardFilled,
} from '@fluentui/react-icons'
import { useProjectStore } from '../../../stores/projectStore'
import { ToolbarButton, ToolbarDivider, TextColorDropdown, RunBuildButton, OverflowToolbar } from '../../shared/components'
import { DismissRegular } from '@fluentui/react-icons'
import { SCREENPLAY_ELEMENTS, type ScreenplayElementType } from '../extensions/ScreenplayElement'
import { hasSelection, getSelectionInfo, extractSurroundingContextWithPronouns } from '../../../utils/selectionUtils'

interface ScreenplayToolbarProps {
  editor: Editor | null
  isNote?: boolean
}

function StoryboardToggleButton() {
  const { storyboardUI, setStoryboardMode } = useProjectStore()

  return (
    <button
      onClick={() => setStoryboardMode(storyboardUI.mode === 'side' ? null : 'side')}
      className={clsx(
        'flex items-center justify-center w-8 h-8 shrink-0 self-center transition-colors',
        storyboardUI.mode
          ? 'bg-amber-400/15 text-amber-400'
          : 'text-theme-primary hover:bg-theme-active'
      )}
      title={storyboardUI.mode ? "Close Storyboard" : "Open Storyboard"}
    >
      <VideoClipFilled className="w-4 h-4" />
    </button>
  )
}

function WritingPartnerToggleButton() {
  const { ui, toggleWritingPartnerPanel } = useProjectStore()

  return (
    <button
      onClick={toggleWritingPartnerPanel}
      className={clsx(
        'flex items-center justify-center w-8 h-8 shrink-0 self-center transition-colors',
        ui.writingPartnerPanelOpen
          ? 'bg-gold-400/15 text-gold-400'
          : 'text-theme-primary hover:bg-theme-active'
      )}
      title={ui.writingPartnerPanelOpen ? "Close Writing Partner (⌘⇧P)" : "Open Writing Partner (⌘⇧P)"}
    >
      <PenSparkleFilled className="w-4 h-4" />
    </button>
  )
}

function InfiniteCanvasGroupedButton() {
  const infiniteCanvas = useProjectStore(state => state.ui.infiniteCanvas)
  const toggleInfiniteCanvas = useProjectStore(state => state.toggleInfiniteCanvas)

  return (
    <button
      onClick={toggleInfiniteCanvas}
      className={clsx(
        'flex items-center justify-center w-8 h-8 shrink-0 self-center transition-colors',
        infiniteCanvas
          ? 'bg-theme-active text-theme-accent'
          : 'text-theme-primary hover:bg-theme-active'
      )}
      title={infiniteCanvas ? "Exit Infinite Canvas" : "Infinite Canvas Mode"}
    >
      <WhiteboardFilled className="w-4 h-4" />
    </button>
  )
}

function ReaderModeGroupedButton() {
  const readerMode = useProjectStore(state => state.ui.readerMode)
  const toggleReaderMode = useProjectStore(state => state.toggleReaderMode)

  return (
    <button
      onClick={toggleReaderMode}
      className={clsx(
        'flex items-center justify-center w-8 h-8 shrink-0 self-center transition-colors',
        readerMode
          ? 'bg-white/90 text-black'
          : 'text-theme-primary hover:bg-theme-active'
      )}
      title={readerMode ? "Exit Reader Mode" : "Preview in Reader Mode"}
    >
      <BookOpenFilled className="w-4 h-4" />
    </button>
  )
}

export function ScreenplayToolbar({ editor, isNote = false }: ScreenplayToolbarProps) {
  const { openImageGenerationModal, currentProject, documents, ui, setReaderMode } = useProjectStore()
  const [hasTextSelection, setHasTextSelection] = useState(false)

  // Track selection state for enabling/disabling the generate button
  useEffect(() => {
    if (!editor) return

    const updateSelectionState = () => {
      setHasTextSelection(hasSelection(editor))
    }

    // Initial check
    updateSelectionState()

    // Listen for selection changes
    editor.on('selectionUpdate', updateSelectionState)
    editor.on('transaction', updateSelectionState)

    return () => {
      editor.off('selectionUpdate', updateSelectionState)
      editor.off('transaction', updateSelectionState)
    }
  }, [editor])

  const handleGenerateStoryboard = useCallback(() => {
    if (!editor || !hasTextSelection) return
    
    const selectionInfo = getSelectionInfo(editor)
    
    // Extract surrounding context for better image generation
    const characters = currentProject?.characters || []
    // Convert documents state to the format expected by extractSurroundingContext
    const docsWithContent: Record<string, { content: import('@tiptap/core').JSONContent | null }> = {}
    for (const [docId, docState] of Object.entries(documents)) {
      docsWithContent[docId] = { content: docState.content }
    }
    
    const surroundingContext = extractSurroundingContextWithPronouns(
      editor,
      selectionInfo.selectedText,
      characters,
      docsWithContent
    )
    
    openImageGenerationModal(selectionInfo.selectedText, selectionInfo.mentions, surroundingContext)
  }, [editor, hasTextSelection, openImageGenerationModal, currentProject, documents])

  if (!editor) return null

  const setScreenplayElement = (type: ScreenplayElementType) => {
    editor.chain().focus().setScreenplayElement(type).run()
  }

  // Reader mode: show minimal header with exit button
  if (ui.readerMode) {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-theme-header border-b border-theme-subtle">
        <div className="flex items-center gap-2 text-theme-secondary">
          <BookOpenFilled className="w-4 h-4" />
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

  return (
    <OverflowToolbar
      rightContent={
        <>
          <div className="flex items-center self-center rounded-lg border border-theme-default bg-theme-tertiary overflow-hidden">
            <InfiniteCanvasGroupedButton />
            <button
              onClick={handleGenerateStoryboard}
              disabled={!hasTextSelection}
              className={clsx(
                'flex items-center justify-center w-8 h-8 shrink-0 transition-colors',
                hasTextSelection
                  ? 'text-theme-primary hover:bg-theme-active'
                  : 'text-theme-muted cursor-not-allowed'
              )}
              title={hasTextSelection ? "Generate Storyboard Image from Selection" : "Select text to generate storyboard image"}
            >
              <ImageSparkleFilled className="w-4 h-4" />
            </button>
            <StoryboardToggleButton />
            <WritingPartnerToggleButton />
            <ReaderModeGroupedButton />
          </div>
          <ToolbarDivider />
          <RunBuildButton />
        </>
      }
    >
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

      {/* Normal/Body text + Screenplay Elements */}
      <div className="flex items-center gap-0.5">
        {/* Normal body text option */}
        <button
          onClick={() => {
            // Convert to paragraph and set fontFamily as block attribute
            editor.chain()
              .clearNodes()
              .updateAttributes('paragraph', { fontFamily: 'Carlito, Calibri, sans-serif' })
              .run()
          }}
          className={clsx(
            'px-2 py-1 text-xs font-ui font-medium rounded transition-colors whitespace-nowrap',
            // Active when in paragraph (not screenplayElement) with Calibri font
            !editor.isActive('screenplayElement') && editor.isActive('paragraph')
              ? 'bg-theme-active text-theme-accent'
              : 'text-theme-secondary hover:text-theme-accent hover:bg-theme-hover'
          )}
          title="Normal body text (Calibri)"
        >
          Body
        </button>

        {SCREENPLAY_ELEMENTS.map((element) => (
          <button
            key={element.type}
            onClick={() => setScreenplayElement(element.type)}
            className={clsx(
              'px-2 py-1 text-xs font-ui font-medium rounded transition-colors whitespace-nowrap',
              editor.isActive('screenplayElement', { elementType: element.type })
                ? 'bg-theme-active text-theme-accent'
                : 'text-theme-secondary hover:text-theme-accent hover:bg-theme-hover'
            )}
            title={`${element.name} (${element.shortcut})`}
          >
            {element.name.split(' ')[0]}
          </button>
        ))}
      </div>

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
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <TextAlignRightRegular className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Task list - only for notes */}
      {isNote && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            isActive={editor.isActive('taskList')}
            title="Task List (Todo)"
          >
            <TaskListLtrRegular className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarDivider />
        </>
      )}

    </OverflowToolbar>
  )
}
