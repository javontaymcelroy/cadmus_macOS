// Cursor Context — Semantic window around the user's cursor position
// Injected into thought partner prompt to scope edits to the relevant area

export interface CursorContext {
  documentId: string
  documentTitle: string
  /** Document version — revision counter if available, djb2 hash of full text as fallback */
  documentVersion: string
  /** blockId of the block containing the cursor */
  cursorBlockId: string
  /** Offset within the cursor block (char position) */
  cursorOffsetInBlock: number
  /** Short anchor snippet (20-40 chars) around the cursor for re-finding if blocks reflow */
  anchorSnippet: string
  /** ProseMirror doc offset */
  cursorOffset: number
  /** Non-empty when user has a selection */
  selectionRange?: { from: number; to: number }
  /** Breadcrumb of enclosing headings: ["Act 2", "Scene 5", "INT. HOSPITAL"] */
  headingPath: string[]
  /** Text before cursor, snapped to block boundaries */
  beforeText: string
  /** Text after cursor, snapped to block boundaries */
  afterText: string
  /** How many chars were requested each side */
  contextRadius: number
  /** All headings/scene-headings in the doc (global structure) */
  outline: string[]
}

/** Max chars allowed in combined beforeText + afterText to prevent oversized context */
export const MAX_CURSOR_CONTEXT_CHARS = 4000

/** Default context radius (chars each side) */
export const DEFAULT_CURSOR_CONTEXT_RADIUS = 1000

/** Min/max for the radius slider */
export const MIN_CURSOR_CONTEXT_RADIUS = 500
export const MAX_CURSOR_CONTEXT_RADIUS = 1500
