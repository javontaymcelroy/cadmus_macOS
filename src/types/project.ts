import type { JSONContent } from '@tiptap/core'

// Template types
export type TemplateId = 
  | 'basic-document'
  | 'notes-journal'
  | 'blog-post'
  | 'screenplay'
  | 'academic-paper'

export interface Template {
  id: TemplateId
  name: string
  description: string
  icon: string
  defaultStructure: DefaultStructure
  enabledPasses: string[]
  settings: ProjectSettings
}

export interface DefaultStructure {
  folders: FolderStructure[]
  documents: DocumentStructure[]
}

export interface FolderStructure {
  name: string
  path: string
}

export interface DocumentStructure {
  title: string
  path: string
}

// Project types
export interface Project {
  id: string
  name: string
  templateId: TemplateId
  path: string
  createdAt: string
  updatedAt: string
  documents: ProjectDocument[]
  assets: Asset[]
  characters: Character[] // For screenplay character bank
  props: Prop[] // For screenplay prop bank
  storyboard?: Storyboard // For screenplay storyboard playback
  stickers?: Sticker[] // For NotesJournal overlay stickers
  settings: ProjectSettings
  buildProfiles: BuildProfile[]
}

export interface ProjectDocument {
  id: string
  path: string
  title: string
  order: number
  parentId?: string // For nesting documents in folders
  type: 'document' | 'folder'
  createdAt: string
  updatedAt: string
  // Note flag - explicitly marks a document as a note regardless of hierarchy depth
  isNote?: boolean
  // Character note fields (for screenplay projects)
  isCharacterNote?: boolean // True if this document is a character note
  characterId?: string // ID of the linked character (if isCharacterNote)
  // Prop note fields (for screenplay projects)
  isPropNote?: boolean // True if this document is a prop note
  propId?: string // ID of the linked prop (if isPropNote)
  // Act break flag - for act divider documents in screenplay projects
  isActBreak?: boolean // True if this document is an act break
  // Journal toolbar flag - for basic documents in screenplay projects that need text formatting
  useJournalToolbar?: boolean // True if document should use journal-style toolbar instead of screenplay elements
}

export interface DocumentContent {
  id: string
  content: JSONContent
  plainText: string
  wordCount: number
  lastModified: string
}

// Asset types
export type AssetType = 'image' | 'pdf' | 'link' | 'other'
export type AssetCategory = 'general' | 'storyboard'

export interface Asset {
  id: string
  path: string
  name: string
  type: AssetType
  mimeType?: string
  size: number
  createdAt: string
  references: AssetReference[]
  category?: AssetCategory // 'general' (default) or 'storyboard'
}

export interface AssetReference {
  documentId: string
  range?: TextRange
}

export interface TextRange {
  from: number
  to: number
}

// Character types (for screenplay projects)
export interface Character {
  id: string
  name: string
  color: string // hex color, defaults to gold (#fbbf24)
  noteDocumentId?: string // ID of the linked character notes document
}

// Prop types (for screenplay projects)
export interface Prop {
  id: string
  name: string
  icon: string // Fluent icon name (e.g., 'Box', 'Car', 'Key')
  noteDocumentId?: string // ID of the linked prop notes document
}

// Script reference tracking types (for screenplay projects)
export type ScriptReferenceElementType = 'character' | 'dialogue' | 'action' | 'parenthetical'

export interface ScriptReference {
  documentId: string              // Act/document containing the reference
  documentTitle: string           // Act name (e.g., "Act I")
  sceneHeading: string            // Full scene heading text (e.g., "INT. COFFEE SHOP - DAY")
  sceneNumber: number             // Scene # within the document
  blockId: string                 // For navigation via scrollTargetBlock
  elementType: ScriptReferenceElementType
  contextSnippet?: string         // Brief text snippet for context
}

export interface CharacterReferences {
  [characterId: string]: ScriptReference[]
}

export interface PropReferences {
  [propId: string]: ScriptReference[]
}

// AI Document Generation types (for production reference docs)
export interface ScriptContext {
  sceneHeading: string
  elementType: ScriptReferenceElementType
  content: string
  surroundingContext?: string // Additional context from surrounding blocks
  // Source reference for citations - allows linking back to original script block
  sourceDocumentId?: string
  sourceBlockId?: string
  sourceDocumentTitle?: string
}

// Supplementary document for additional context (notes, synopsis, etc.)
export interface SupplementaryDocument {
  title: string
  content: string  // Plain text content
}

export interface CharacterDocOutput {
  roleInStory: string
  backstory: string
  psychologyUnderStress: string
  physicalDescription: string
  wardrobeLogic: string
  movementHabits: string
  voiceSpeechPatterns: string
  relationshipToEnvironment: string
  arc: string
}

export interface PropDocOutput {
  functionInPlot: string
  physicalDescription: string
  condition: string
  rulesLimitations: string
  symbolicWeight: string
  howUsedOnScreen: string
}

export interface LocationDocOutput {
  purpose: string
  moodTone: string
  visualLanguage: string
  soundProfile: string
  stateOfDecayOrOrder: string
  rulesOfSpace: string
  howCharactersBehaveHere: string
}

export interface ActBreakDocOutput {
  plotSummary: string
  themes: string[]
  characterArcs: string[]
}

// Writing Partner / Dramatic Critique types
export interface CharacterState {
  characterId: string
  name: string
  currentWants: string[]           // What they want in each scene
  promises: string[]               // Setup that implies future payoff
  constraints: string[]            // Rules established about them
  relationshipStates: { with: string; state: string; scene: string }[]
  behaviorPattern: string[]        // How they typically act
}

export interface PropState {
  propId: string
  name: string
  introduced: { scene: string; context: string } | null
  usages: { scene: string; how: string }[]
  rules: string[]                  // Established rules about the prop
  symbolicSetup: string | null     // Implied meaning not yet resolved
}

export interface TimelineBeat {
  scene: string
  sceneNumber: number
  characters: string[]
  location: string
  timeOfDay: string
  impliedDuration: string | null
  keyEvents: string[]
}

export interface StoryFacts {
  characters: CharacterState[]
  props: PropState[]
  timeline: TimelineBeat[]
  establishedRules: string[]       // World rules (e.g., "magic has a cost")
  openPromises: string[]           // Setups without payoffs yet
}

// CinemaSins Master Index - 30 narrative sins
export type CritiqueOperator = 
  // Character/Motivation (1-4)
  | 'unclear_motivation'        // 1. Unclear character motivation
  | 'motivation_shift'          // 2. Motivation changes without on-screen cause
  | 'behavior_contradiction'    // 3. Character acts against established behavior
  | 'protagonist_passivity'     // 4. Protagonist lacks agency
  // Convenience/Coincidence (5-6)
  | 'coincidence_plotting'      // 5. Coincidence drives plot forward
  | 'convenient_information'    // 6. Information arrives exactly when needed
  // Exposition/Dialogue (7-8, 21-22)
  | 'exposition_dump'           // 7. Exposition dump instead of dramatization
  | 'audience_dialogue'         // 8. Characters say things only audience needs
  | 'theme_stated'              // 21. Theme stated explicitly instead of shown
  | 'plot_dialogue'             // 22. Dialogue exists only to move plot
  // Rules/Logic (9-10, 25-26)
  | 'late_rules'                // 9. Rules introduced after they become useful
  | 'rules_broken'              // 10. Rules broken without consequence
  | 'impossible_knowledge'      // 25. Character knows information they shouldn't
  | 'undefined_tech'            // 26. Convenient or undefined technology
  // Setup/Payoff (11-13)
  | 'setup_no_payoff'           // 11. Setup with no payoff
  | 'payoff_no_setup'           // 12. Payoff with no setup
  | 'forgotten_prop'            // 13. Prop introduced and forgotten
  // Continuity/Timeline (14-16)
  | 'location_logic'            // 14. Location logic inconsistency
  | 'timeline_issue'            // 15. Timeline compression or impossibility
  | 'spatial_error'             // 16. Spatial continuity error
  // Stakes/Conflict (17-20, 23-24)
  | 'offscreen_resolution'      // 17. Offscreen problem resolution
  | 'stakes_asserted'           // 18. Stakes asserted but never demonstrated
  | 'unearned_emotion'          // 19. Emotional beat not earned
  | 'tonal_whiplash'            // 20. Tonal whiplash
  | 'fake_conflict'             // 23. Fake conflict resolved immediately
  | 'antagonist_fluctuation'    // 24. Antagonist competence fluctuates for convenience
  // Structure/Ending (27-29)
  | 'montage_causality'         // 27. Montage used to skip causality
  | 'conflict_avoided'          // 28. Conflict avoided to reach ending
  | 'consequence_dodged'        // 29. Ending dodges consequences
  // Meta (30)
  | 'repetition_sin'            // 30. Repetition of any single sin without escalation

// Severity levels for accountability
export type IssueSeverity = 'blocking' | 'warning' | 'optional'

// Resolution states for tracking
export type IssueResolution = 'unresolved' | 'fixed' | 'intentional' | 'deferred'

export interface CritiqueEvidence {
  sourceDocument?: string        // Document name (e.g., "Synopsis and Appendix", "Low quality news.")
  sceneRef: string               // "Act I, Scene 3" or section reference
  blockId?: string               // For navigation
  documentId: string
  excerpt: string                // Exact quote from the document
}

export interface CritiqueIssue {
  id: string
  operator: CritiqueOperator
  confidence: number               // 0-1, suppress if < 0.6
  severity: IssueSeverity          // blocking/warning/optional
  consequence: string              // "If X, then Y will fail"
  deadline: string | null          // "Must resolve by Act 2" or null
  title: string                    // Brief label
  evidence: CritiqueEvidence[]
  question: string                 // The pointed question to surface
  context: string                  // Why this might matter
  resolution: IssueResolution      // Current resolution state
  resolvedAt?: number              // Timestamp when resolved
  resolutionNote?: string          // Writer's note about resolution
}

// Stored resolution for persistence across analysis runs
export interface StoredCritiqueResolution {
  issueHash: string                // Hash of operator + evidence to match issues
  resolution: IssueResolution
  note?: string
  timestamp: number
}

// Storyboard types (for screenplay projects)
export interface BlockAnchor {
  blockId: string           // UniqueID block identifier
  documentId: string        // Document containing the block
  prefixHash: string        // Hash of ~50 chars before the block for re-anchoring
  suffixHash: string        // Hash of ~50 chars after the block for re-anchoring
  textSnapshot: string      // Full text of the block at link time
}

export interface StoryboardShot {
  id: string
  assetId: string           // Reference to project Asset (image)
  order: number
  durationMs?: number       // Manual override duration in milliseconds
  linkedBlock: BlockAnchor | null
  isUnlinked?: boolean      // True if re-anchoring failed after edits
}

export interface Storyboard {
  shots: StoryboardShot[]
}

// Sticker types (for NotesJournal overlay stickers)
export interface Sticker {
  id: string
  documentId: string        // Document this sticker belongs to
  assetId: string           // Reference to uploaded asset
  x: number                 // Position relative to editor container
  y: number
  width: number
  height: number
  rotation?: number
  zIndex?: number
}

export interface DocumentStickers {
  [documentId: string]: Sticker[]
}

// Version history types
export interface DocumentVersion {
  id: string
  documentId: string
  timestamp: string // ISO date
  label?: string // Optional user-provided label
  content: JSONContent
  wordCount: number
}

// Settings types
export interface ProjectSettings {
  citationStyle?: 'apa' | 'mla' | 'chicago' | 'none'
  formattingRules: FormattingRules
  enabledPasses: string[]
  // Image generation custom prompt (per-project)
  customImagePromptTemplate?: string
  // Image generation custom instructions - always appended to prompts as "non-negotiables"
  customImageInstructions?: string
}

export interface FormattingRules {
  headingStyle: 'sentence' | 'title' | 'none'
  quotationStyle: 'straight' | 'curly'
  enforceDoubleSpacing: boolean
  maxLineLength?: number
  defaultFontFamily?: string
}

// Build types
export interface BuildProfile {
  id: string
  name: string
  includedDocumentIds: string[]
  exportFormats: ExportFormat[]
}

export type ExportFormat = 'html' | 'pdf' | 'docx'

// Diagnostic types
export type DiagnosticSeverity = 'error' | 'warning' | 'info'

export interface Diagnostic {
  id: string
  passId: string
  severity: DiagnosticSeverity
  title: string
  message: string
  documentId: string
  range?: TextRange
  suggestions?: DiagnosticSuggestion[]
  source?: string
  context?: {
    text: string      // Surrounding text snippet
    offset: number    // Offset of the issue within the snippet
    length: number    // Length of the issue within the snippet
  }
}

export interface DiagnosticSuggestion {
  label: string
  replacement?: string
  action?: string
}

// Pass types
export type PassKind = 'local' | 'ai'

export interface Pass {
  id: string
  name: string
  kind: PassKind
  defaultEnabledByTemplate: TemplateId[]
}

export interface PassResult {
  passId: string
  diagnostics: Diagnostic[]
  fixes?: Fix[]
  timing: number
}

export interface Fix {
  id: string
  diagnosticId: string
  label: string
  patch: Patch
}

export interface Patch {
  documentId: string
  range: TextRange
  replacement: string
}

// Build results
export interface BuildResult {
  success: boolean
  diagnostics: Diagnostic[]
  passResults: PassResult[]
  totalTiming: number
  artifacts?: BuildArtifact[]
}

export interface BuildArtifact {
  format: ExportFormat
  path: string
  size: number
}

// Document lifecycle types
export type DocumentLifecycleState = 
  | 'active'      // WIP - currently working on
  | 'paused'      // On hold, with optional note
  | 'review'      // Ready for review
  | 'completed'   // Finished
  | 'archived'    // Hidden from main view

export interface LivingDocument {
  projectPath: string
  projectName: string
  templateId?: string
  state: DocumentLifecycleState
  stateNote?: string           // e.g., "waiting on feedback"
  lastStateChange: string      // ISO timestamp
  lastOpened: string           // ISO timestamp for sorting
}

// Agenda item types (for NotesJournal todo tracking)
export interface TodoItem {
  id: string
  text: string
  checked: boolean
}

export interface AgendaItem {
  projectPath: string
  projectName: string
  templateId: TemplateId
  documentId: string
  documentTitle: string
  todos: TodoItem[]
  state: DocumentLifecycleState
  stateNote?: string
  lastUpdated: string
}

// Image Generation types
export type ImageStyle = 'storyboard-sketch' | 'cinematic' | 'toon-boom' | 'custom'
// gpt-image-1 supported sizes
export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'

export interface ImageGenSettings {
  apiKey?: string  // Stored in electron-store, not in project
  defaultPromptTemplate: string
  defaultStyle: ImageStyle
  defaultSize: ImageSize
  useReferenceImages: boolean
}

export interface ImageGenOptions {
  style: ImageStyle
  size: ImageSize
  customPrompt?: string
  projectPath: string
  useReferenceImages?: boolean
}

export interface GeneratedImageResult {
  success: boolean
  imageData?: ArrayBuffer
  assetId?: string
  error?: string
  errorCode?: number
}

// Mention data extracted from selection
export interface ExtractedMention {
  type: 'character' | 'prop'
  id: string
  label: string
}

// Surrounding script context for image generation
export interface CharacterContextInfo {
  name: string
  id?: string                    // Character ID if known
  introductionText?: string      // Visual description from script (e.g., "30s, blood on her sleeve...")
  noteContent?: string           // From character notes document
}

export interface ResolvedPronoun {
  pronoun: string                // "She", "He", "They"
  resolvedTo: string             // "AVA KLINE"
  characterId?: string           // Character ID if known
  description?: string           // Visual description if available
}

export interface SurroundingScriptContext {
  sceneHeading?: string                    // "INT. CORRIDOR - NIGHT"
  recentCharacters: CharacterContextInfo[] // Characters in scene with descriptions
  precedingAction: string                  // 2-3 action lines before selection
  resolvedPronouns: ResolvedPronoun[]      // Pronoun resolutions (e.g., "She" -> "AVA KLINE")
}

// AI Writing types (slash command generative and revision tools)
type AIWritingCommand = 
  | 'continue' | 'dialogue' | 'setting' | 'expand' | 'pov' | 'negativeSpace'
  | 'rework' | 'adjustTone' | 'shorten' | 'clearer' | 'elaborate'
  | 'tension' | 'soften' | 'imagery' | 'pacing' | 'voice' | 'contradiction'
  | 'scriptDoctor'

type ScreenplayElementType = 
  | 'scene-heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'

interface ScreenplayElement {
  type: ScreenplayElementType
  text: string
}

interface CharacterInfo {
  id: string
  name: string
  color?: string
}

interface PropInfo {
  id: string
  name: string
  icon?: string
}

interface SupplementaryWritingContext {
  synopsis?: string
  characterNotes?: Array<{ name: string; content: string }>
  propNotes?: Array<{ name: string; content: string }>
  otherNotes?: Array<{ title: string; content: string }>
}

interface AIWritingRequest {
  command: AIWritingCommand
  context: string
  selection?: string
  characterName?: string
  characters?: CharacterInfo[]
  props?: PropInfo[]
  settingHint?: string
  documentTitle?: string
  templateType?: string
  toneOption?: string
  supplementaryContext?: SupplementaryWritingContext
}

interface AIWritingResponse {
  text: string
  error?: string
  screenplayElements?: ScreenplayElement[]
  isScreenplay?: boolean
  characterMap?: Record<string, CharacterInfo>
  propMap?: Record<string, PropInfo>
}

// Electron API type declaration
interface RecentProject {
  name: string
  path: string
  templateId?: string
}

declare global {
  interface Window {
    api: {
      project: {
        create: (template: Template, name: string, basePath: string) => Promise<Project>
        open: (projectPath: string) => Promise<Project>
        save: (project: Project) => Promise<void>
        getLastOpened: () => Promise<string | null>
        setLastOpened: (path: string) => Promise<void>
        getRecentProjects: () => Promise<RecentProject[]>
        removeFromRecent: (projectPath: string) => Promise<void>
        moveToTrash: (projectPath: string) => Promise<{ success: boolean; error?: string }>
        // Living document methods
        getLivingDocuments: () => Promise<LivingDocument[]>
        updateLivingDocument: (projectPath: string, state: DocumentLifecycleState, stateNote?: string) => Promise<void>
        removeLivingDocument: (projectPath: string) => Promise<void>
      }
      document: {
        create: (projectPath: string, doc: Omit<ProjectDocument, 'createdAt' | 'updatedAt'>, templateId?: string, screenplayDocType?: 'title-page' | 'page' | 'break') => Promise<ProjectDocument>
        save: (projectPath: string, docId: string, content: JSONContent) => Promise<void>
        load: (projectPath: string, docId: string) => Promise<JSONContent>
        delete: (projectPath: string, docId: string) => Promise<void>
      }
      asset: {
        upload: (projectPath: string, filePath: string, fileName: string) => Promise<Asset>
        uploadFromBuffer: (projectPath: string, buffer: ArrayBuffer, fileName: string, mimeType: string) => Promise<Asset>
        delete: (projectPath: string, assetId: string) => Promise<void>
        getPath: (projectPath: string, assetId: string) => Promise<string>
      }
      dialog: {
        selectFolder: () => Promise<string | null>
        selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
      }
      build: {
        run: (project: Project, documentContents: Record<string, JSONContent>) => Promise<BuildResult>
      }
      version: {
        save: (projectPath: string, docId: string, content: JSONContent, label?: string) => Promise<DocumentVersion>
        load: (projectPath: string, docId: string) => Promise<DocumentVersion[]>
        delete: (projectPath: string, docId: string, versionId: string) => Promise<void>
      }
      utils: {
        getPathForFile: (file: File) => string
        getAssetUrl: (projectPath: string, assetPath: string) => string
      }
      agenda: {
        getAgendaItems: () => Promise<AgendaItem[]>
        updateAgendaItem: (projectPath: string, documentId: string, documentTitle: string, projectName: string, templateId: TemplateId, todos: TodoItem[]) => Promise<void>
        updateAgendaState: (projectPath: string, documentId: string, state: DocumentLifecycleState, stateNote?: string) => Promise<void>
        removeAgendaItem: (projectPath: string, documentId: string) => Promise<void>
        toggleTodo: (projectPath: string, documentId: string, todoId: string, checked: boolean) => Promise<void>
        markAllTodosDone: (projectPath: string, documentId: string) => Promise<void>
      }
      imageGeneration: {
        generate: (prompt: string, options: ImageGenOptions) => Promise<GeneratedImageResult>
        getSettings: () => Promise<ImageGenSettings>
        setSettings: (settings: Partial<ImageGenSettings>) => Promise<void>
        hasApiKey: () => Promise<boolean>
        buildPrompt: (selectedText: string, contextSection: string, promptTemplate?: string) => Promise<string>
      }
      theme: {
        get: () => Promise<'dark' | 'light'>
        set: (theme: 'dark' | 'light') => Promise<void>
      }
      aiSuggestions: {
        generate: (documents: { id: string; title: string; content: string }[]) => Promise<Diagnostic[]>
        hasApiKey: () => Promise<boolean>
      }
      documentGeneration: {
        generateCharacter: (characterName: string, scriptContexts: ScriptContext[], supplementaryDocs?: SupplementaryDocument[]) => Promise<CharacterDocOutput | null>
        generateProp: (propName: string, scriptContexts: ScriptContext[], supplementaryDocs?: SupplementaryDocument[]) => Promise<PropDocOutput | null>
        generateLocation: (locationName: string, scriptContexts: ScriptContext[]) => Promise<LocationDocOutput | null>
        generateActBreak: (actTitle: string, scriptContent: string) => Promise<ActBreakDocOutput | null>
        hasApiKey: () => Promise<boolean>
      }
      dramaticCritique: {
        generate: (screenplayText: string, entityDocs: { type: 'character' | 'prop' | 'location'; name: string; content: string }[], supplementaryDocs?: SupplementaryDocument[]) => Promise<CritiqueIssue[]>
        hasApiKey: () => Promise<boolean>
      }
      aiWriting: {
        generate: (request: AIWritingRequest) => Promise<AIWritingResponse>
        hasApiKey: () => Promise<boolean>
      }
      gatedWriting: {
        generate: (request: AIWritingRequest, storyFacts?: any, forceOverride?: boolean) => Promise<any>
      }
    }
  }
}

export {}
