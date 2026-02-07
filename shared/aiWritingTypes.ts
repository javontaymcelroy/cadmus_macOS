/**
 * AI Writing Types
 * 
 * Shared types for the AI writing slash command feature.
 * Used by both the main process (electron) and renderer process (React).
 */

/**
 * Available AI writing commands
 * - Generative: continue, dialogue, setting, expand, pov (create new content)
 * - Revision: rework, adjustTone, shorten, clearer, elaborate, tension, soften, imagery, pacing, voice, contradiction
 */
export type AIWritingCommand =
  | 'continue' | 'dialogue' | 'setting' | 'expand' | 'pov' | 'negativeSpace'
  | 'rework' | 'adjustTone' | 'shorten' | 'clearer' | 'elaborate'
  | 'tension' | 'soften' | 'imagery' | 'pacing' | 'voice' | 'contradiction'
  | 'scriptDoctor'
  | 'fixGrammar' | 'makeLonger' | 'makeConcise' | 'actionItems' | 'extractQuestions' | 'summarize'

/**
 * Screenplay element types for formatted output
 */
export type ScreenplayElementType = 
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'

/**
 * A single screenplay element (block) with type and content
 */
export interface ScreenplayElement {
  type: ScreenplayElementType
  text: string
}

/**
 * Character info for AI context and mention resolution
 */
export interface CharacterInfo {
  id: string
  name: string
  color?: string
}

/**
 * Prop info for AI context and mention resolution
 */
export interface PropInfo {
  id: string
  name: string
  icon?: string
}

/**
 * Supplementary context from project documents
 */
export interface SupplementaryWritingContext {
  /** Main story synopsis/overview */
  synopsis?: string
  /** Character notes/bibles with content */
  characterNotes?: Array<{ name: string; content: string }>
  /** Prop notes with content */
  propNotes?: Array<{ name: string; content: string }>
  /** Any other supplementary docs (notes, outlines, etc.) */
  otherNotes?: Array<{ title: string; content: string }>
}

/**
 * Structured scene context extracted from the current document
 */
export interface SceneContext {
  /** Current scene heading (e.g., "INT. NURSE'S STATION - DAY") */
  sceneHeading?: string
  /** Characters present in the current scene (from dialogue headers and introductions) */
  charactersInScene: string[]
  /** Recent action lines providing immediate context */
  precedingAction?: string
}

/**
 * Request payload for AI writing generation
 */
export interface AIWritingRequest {
  /** The command to execute */
  command: AIWritingCommand
  /** Text context before the cursor (up to ~8000 chars) */
  context: string
  /** Selected text if any (used for expand command) */
  selection?: string
  /** Character name for POV command */
  characterName?: string
  /** Available characters with their IDs and colors */
  characters?: CharacterInfo[]
  /** Available props with their IDs */
  props?: PropInfo[]
  /** Hint for setting description */
  settingHint?: string
  /** Document title for context */
  documentTitle?: string
  /** Template type (screenplay, journal, etc.) - determines output format */
  templateType?: string
  /** Tone option for adjustTone command (calm, tense, playful, etc.) */
  toneOption?: string
  /** Background context from project documents (synopsis, character notes, etc.) */
  supplementaryContext?: SupplementaryWritingContext
  /** Structured scene context (current scene heading, characters in scene, etc.) */
  sceneContext?: SceneContext
}

/**
 * Response from AI writing generation
 */
export interface AIWritingResponse {
  /** Generated text to insert (plain text fallback) */
  text: string
  /** Error message if generation failed */
  error?: string
  /** Structured screenplay elements (if isScreenplay is true) */
  screenplayElements?: ScreenplayElement[]
  /** Whether this response contains formatted screenplay content */
  isScreenplay?: boolean
  /** Character name to ID/color mapping for mention resolution */
  characterMap?: Record<string, CharacterInfo>
  /** Prop name to ID mapping for mention resolution */
  propMap?: Record<string, PropInfo>
}

/**
 * Slash command item displayed in the menu
 */
export interface SlashCommandItem {
  /** Unique identifier matching AIWritingCommand */
  id: AIWritingCommand
  /** Display name */
  name: string
  /** Description shown below the name */
  description: string
  /** Single-letter keyboard shortcut */
  shortcut: string
  /** Icon identifier */
  icon: string
}

/**
 * Default slash commands available in the menu
 */
export const DEFAULT_SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'continue',
    name: 'Continue Writing',
    description: 'Keep the voice, mood, and details going',
    shortcut: 'C',
    icon: 'pen'
  },
  {
    id: 'dialogue',
    name: 'Dialogue Generator',
    description: 'Produce character dialog',
    shortcut: 'D',
    icon: 'chat'
  },
  {
    id: 'setting',
    name: 'Describe Setting',
    description: 'Flesh out environment details',
    shortcut: 'S',
    icon: 'location'
  },
  {
    id: 'pov',
    name: 'Write from POV',
    description: 'Produce text in a specific character voice',
    shortcut: 'P',
    icon: 'person'
  },
  {
    id: 'negativeSpace',
    name: 'Negative Space',
    description: 'Organic moments: pauses, texture, behavior — nothing that advances plot',
    shortcut: 'N',
    icon: 'weather'
  }
]
